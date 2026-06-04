"""
Match scoring engine.
Computes a 0–100 score for each (resume, job) pair across 7 dimensions.
Uses keyword overlap for fast scoring + Claude for explanation and flag generation.
"""

import json
import os
import re
from typing import Optional

import anthropic

# ---------------------------------------------------------------------------
# Target role profiles — used to compute role_relevance
# ---------------------------------------------------------------------------

TARGET_ROLES = [
    "data science",
    "data scientist",
    "product analyst",
    "business intelligence",
    "bi analyst",
    "bi engineer",
    "machine learning",
    "ml engineer",
    "ai engineer",
    "artificial intelligence",
    "data analyst",
    "product strategy",
    "product management",
    "product manager",
    "analytics engineer",
    "quantitative analyst",
    "research scientist",
    "applied scientist",
]

# Skills Aneesh has — used as a base signal even before resume parsing
ANEESH_SKILLS = {
    "python", "java", "sql", "r", "typescript", "javascript",
    "tensorflow", "react", "aws", "gcp", "azure", "tableau", "power bi",
    "a/b testing", "statistical modeling", "machine learning", "llm",
    "nlp", "data visualization", "fastapi", "scikit-learn", "pandas",
    "numpy", "spark", "dbt", "looker",
}

PREFERRED_LOCATIONS = {"san francisco", "bay area", "new york", "remote", "seattle", "boston"}

EXPLANATION_PROMPT = """You are evaluating job fit for a UC Berkeley Data Science student (graduating May 2027)
with this background:
- Product & Strategy internship at Siemens Healthineers
- AI Development at Mercor
- Behavioral research at Haas School of Business
- SWE/ML at FlourishAI
- Skills: Python, SQL, R, TypeScript, TensorFlow, React, AWS/GCP/Azure, Tableau, A/B testing, ML/LLMs, NLP

Job being evaluated:
Title: {title}
Company: {company}
Location: {location}
Description summary: {description}
Required skills: {required_skills}
Preferred skills: {preferred_skills}

Numeric sub-scores already computed (0-10 each):
- skill_overlap: {skill_overlap}
- role_relevance: {role_relevance}
- industry_fit: {industry_fit}
- eligibility: {eligibility}
- location_score: {location_score}
- keyword_score: {keyword_score}
- experience_match: {experience_match}

Total score: {score}/100

Write a 3-5 sentence honest assessment:
1. Why this role is a good or bad fit
2. What makes the candidate competitive for this role
3. Any red flags or gaps

Then list:
MISSING_KEYWORDS: comma-separated list of keywords from the job that are NOT in the candidate's resume
MATCHED_KEYWORDS: comma-separated list of keywords that DO match

Keep it direct and honest."""


# ---------------------------------------------------------------------------
# Scoring functions
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> set[str]:
    """Lower-case word tokenizer, strips punctuation."""
    return set(re.findall(r"\b[a-z][a-z0-9+#./\-]{1,30}\b", text.lower()))


def _skill_overlap_score(resume_skills: list[str], job_required: list[str], job_preferred: list[str]) -> float:
    """0-10: fraction of required+preferred skills covered by resume."""
    if not job_required and not job_preferred:
        return 5.0  # no data, neutral
    resume_set = {s.lower() for s in resume_skills}
    required = {s.lower() for s in job_required}
    preferred = {s.lower() for s in job_preferred}
    total = len(required) + len(preferred) * 0.5
    if total == 0:
        return 5.0
    covered = sum(
        any(rs in req or req in rs for rs in resume_set) for req in required
    ) + 0.5 * sum(
        any(rs in pref or pref in rs for rs in resume_set) for pref in preferred
    )
    return min(10.0, (covered / total) * 10)


def _role_relevance_score(title: str) -> float:
    """0-10: how closely the job title matches target roles."""
    title_lower = title.lower()
    for role in TARGET_ROLES:
        if role in title_lower:
            return 10.0
    # Partial matches
    keywords = {"data", "analytics", "analysis", "ai", "ml", "product", "research", "science", "engineer"}
    matches = sum(1 for kw in keywords if kw in title_lower)
    return min(10.0, matches * 2.5)


def _industry_fit_score(company: str, description: str) -> float:
    """0-10: tech/AI/data industry signal."""
    text = (company + " " + (description or "")).lower()
    tech_signals = ["software", "technology", "data", "ai", "machine learning", "startup",
                    "platform", "saas", "cloud", "analytics", "fintech", "healthtech",
                    "edtech", "biotech", "enterprise", "digital"]
    matches = sum(1 for s in tech_signals if s in text)
    return min(10.0, matches * 1.2)


def _eligibility_score(description: str, listing_type: str = "") -> float:
    """0-10: is this role open to 2025/2026/2027 grads or current students?"""
    if not description:
        return 7.0
    text = description.lower()
    if any(y in text for y in ["2026", "2027", "2025"]):
        return 10.0
    if any(p in text for p in ["undergraduate", "junior", "sophomore",
                                "current student", "pursuing bachelor", "pursuing bs"]):
        return 10.0
    if "intern" in text or "internship" in text or listing_type == "internship":
        return 9.0
    if "new grad" in text or "recent grad" in text or "entry level" in text:
        return 8.0
    if "3+ years" in text or "5+ years" in text or "senior" in text:
        return 2.0
    return 6.0


def _location_score(location: str, preferred: set[str] = PREFERRED_LOCATIONS) -> float:
    """0-10: does the location match preferences?"""
    if not location:
        return 5.0
    loc = location.lower()
    if "remote" in loc:
        return 10.0
    for pref in preferred:
        if pref in loc:
            return 9.0
    return 4.0


def _keyword_score(resume_text: str, job_description: str) -> float:
    """0-10: keyword overlap between resume and job description."""
    if not job_description or not resume_text:
        return 5.0
    resume_tokens = _tokenize(resume_text)
    jd_tokens = _tokenize(job_description)
    # Remove very common stop words
    stop = {"the", "and", "for", "with", "are", "you", "our", "will", "that",
            "have", "this", "from", "your", "work", "team", "role", "we"}
    meaningful_jd = jd_tokens - stop - {t for t in jd_tokens if len(t) < 3}
    if not meaningful_jd:
        return 5.0
    overlap = resume_tokens & meaningful_jd
    return min(10.0, (len(overlap) / len(meaningful_jd)) * 20)  # cap at 10


def _experience_match_score(experience: list[dict], job_description: str) -> float:
    """0-10: do past roles/companies signal relevant experience?"""
    if not experience or not job_description:
        return 5.0
    jd_lower = job_description.lower()
    signals = {
        "data": 2, "analytics": 2, "machine learning": 3, "ai": 2,
        "product": 2, "strategy": 1, "research": 1, "engineer": 1,
        "sql": 1, "python": 1, "tableau": 1, "bi": 1,
    }
    score = 0.0
    for exp in experience:
        bullets_text = " ".join(exp.get("bullets", [])).lower()
        for signal, weight in signals.items():
            if signal in bullets_text and signal in jd_lower:
                score += weight * 0.5
    return min(10.0, score)


def compute_score(
    resume: dict,
    job: dict,
    client: Optional[anthropic.Anthropic] = None,
    explain: bool = True,
) -> dict:
    """
    Compute match score for a (resume, job) pair.
    Returns a dict with score, sub-scores, explanation, and keyword lists.
    """
    resume_skills = resume.get("skills_flat", list(ANEESH_SKILLS))
    resume_text = resume.get("raw_text", " ".join(resume_skills))
    experience = resume.get("experience", [])

    required_skills = job.get("required_skills") or []
    preferred_skills = job.get("preferred_skills") or []
    description = job.get("description", "") or job.get("description_summary", "") or ""

    sub_scores = {
        "skill_overlap": _skill_overlap_score(resume_skills, required_skills, preferred_skills),
        "role_relevance": _role_relevance_score(job.get("title", "")),
        "industry_fit": _industry_fit_score(job.get("company", ""), description),
        "eligibility": _eligibility_score(description, job.get("listing_type", "")),
        "location_score": _location_score(job.get("location", "")),
        "keyword_score": _keyword_score(resume_text, description),
        "experience_match": _experience_match_score(experience, description),
    }

    # Weighted average → 0-100
    weights = {
        "skill_overlap": 0.25,
        "role_relevance": 0.20,
        "industry_fit": 0.10,
        "eligibility": 0.15,
        "location_score": 0.05,
        "keyword_score": 0.15,
        "experience_match": 0.10,
    }
    weighted = sum(sub_scores[k] * weights[k] for k in weights)
    total_score = round(weighted * 10, 1)  # scale 0-10 → 0-100

    result = {
        "score": total_score,
        **sub_scores,
        "explanation": "",
        "missing_keywords": [],
        "matched_keywords": [],
    }

    if not explain:
        return result

    if client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if api_key:
            client = anthropic.Anthropic(api_key=api_key)

    if client:
        prompt = EXPLANATION_PROMPT.format(
            title=job.get("title", ""),
            company=job.get("company", ""),
            location=job.get("location", ""),
            description=description[:500],
            required_skills=", ".join(required_skills[:10]),
            preferred_skills=", ".join(preferred_skills[:10]),
            score=total_score,
            **{k: round(v, 1) for k, v in sub_scores.items()},
        )
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text

        # Split out keyword lists
        explanation_lines = []
        missing = []
        matched = []
        for line in raw.splitlines():
            if line.startswith("MISSING_KEYWORDS:"):
                missing = [k.strip() for k in line.replace("MISSING_KEYWORDS:", "").split(",") if k.strip()]
            elif line.startswith("MATCHED_KEYWORDS:"):
                matched = [k.strip() for k in line.replace("MATCHED_KEYWORDS:", "").split(",") if k.strip()]
            else:
                explanation_lines.append(line)

        result["explanation"] = "\n".join(explanation_lines).strip()
        result["missing_keywords"] = missing
        result["matched_keywords"] = matched

    return result


def batch_score_jobs(
    resume: dict,
    jobs: list[dict],
    client: Optional[anthropic.Anthropic] = None,
    explain: bool = True,
) -> list[tuple[dict, dict]]:
    """Score all jobs and return (job, score_dict) pairs sorted by score descending."""
    scored = []
    for job in jobs:
        score_data = compute_score(resume, job, client=client, explain=explain)
        scored.append((job, score_data))
    scored.sort(key=lambda x: x[1]["score"], reverse=True)
    return scored
