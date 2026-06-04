"""
Tailored application material generator.
Produces cover letters, resume bullet suggestions, and "why this company" blurbs.
All suggestions are honest rewrites — no experience is invented.
Uses Claude Sonnet for higher-quality prose.
"""

import os
from typing import Optional

import anthropic

PROFILE = """
Candidate: Aneesh Srirambhatla
Background:
- UC Berkeley Data Science major, graduating May 2027
- Product & Strategy Intern at Siemens Healthineers (healthcare AI, data analytics)
- AI Development at Mercor (LLM applications, data pipelines)
- Behavioral research at Haas School of Business (statistical analysis, A/B testing)
- SWE/ML at FlourishAI (Python, TensorFlow, React)
Skills: Python, Java, SQL, R, TypeScript, JavaScript, TensorFlow, React, AWS/GCP/Azure, Tableau, Power BI,
A/B testing, statistical modeling, ML/LLMs, NLP, data visualization
"""

COVER_LETTER_PROMPT = """You are writing a cover letter for Aneesh Srirambhatla.

{profile}

Target job:
Company: {company}
Role: {title}
Location: {location}
Job description: {description}
Required skills: {required_skills}
Missing keywords from resume: {missing_keywords}

Write a cover letter that:
1. Opens with genuine enthusiasm for THIS specific company/role (not generic)
2. Highlights 2-3 most relevant experiences from Aneesh's background
3. Connects his specific skills to the role's requirements
4. Ends with a clear call to action
5. Is 3 paragraphs, under 300 words
6. Sounds natural and human — not robotic or templated
7. Does NOT invent experiences or skills he doesn't have

Do not use hollow phrases like "I am passionate about" or "I am excited to apply".
Start with something specific about the company or role."""


BULLET_OPTIMIZER_PROMPT = """You are helping Aneesh optimize his resume bullet points for a specific job.

{profile}

Target job:
Company: {company}
Role: {title}
Description: {description}
Keywords to incorporate: {missing_keywords}

His current resume bullets:
{current_bullets}

For each bullet that is relevant to this role:
1. Suggest a rewrite that incorporates missing keywords ONLY if it's truthful
2. Mark bullet as [KEEP AS IS] if it's already strong for this role
3. Mark bullet as [LOW RELEVANCE] if it's not relevant to this role
4. If a keyword can't be honestly incorporated, say [SKIP - not applicable]

Format each suggestion as:
ORIGINAL: <original bullet>
SUGGESTION: <rewritten bullet or tag>
REASON: <1 sentence why>

Be honest. Do not add technologies, metrics, or accomplishments that weren't in the original."""


WHY_COMPANY_PROMPT = """Write a "Why I want to work at {company}" paragraph for Aneesh for the role of {title}.

{profile}

Company context from job description: {description}

Write 3-4 sentences that are:
- Specific to {company}'s actual work, mission, or products
- Connected to Aneesh's genuine interests in {interests}
- Not generic flattery
- Honest and grounded

If you don't have enough company info, say what specific question Aneesh should research about {company}
before writing this paragraph."""


APP_QUESTION_PROMPT = """Answer this application question for Aneesh Srirambhatla.

{profile}

Target job: {title} at {company}

Question: {question}

Write a response that:
- Directly answers the question
- Uses specific examples from his background where relevant
- Is {word_limit} words or fewer
- Sounds like a real person wrote it
- Does not fabricate experiences"""


def _get_client(client: Optional[anthropic.Anthropic]) -> anthropic.Anthropic:
    if client:
        return client
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise EnvironmentError("ANTHROPIC_API_KEY not set")
    return anthropic.Anthropic(api_key=api_key)


def generate_cover_letter(
    job: dict,
    resume: dict,
    missing_keywords: list[str],
    client: Optional[anthropic.Anthropic] = None,
) -> str:
    cl = _get_client(client)
    experience = resume.get("experience", [])
    # Flatten bullet points for context
    all_bullets = []
    for exp in experience[:4]:
        all_bullets.extend(exp.get("bullets", [])[:3])

    prompt = COVER_LETTER_PROMPT.format(
        profile=PROFILE,
        company=job.get("company", ""),
        title=job.get("title", ""),
        location=job.get("location", ""),
        description=(job.get("description") or job.get("description_summary") or "")[:800],
        required_skills=", ".join((job.get("required_skills") or [])[:10]),
        missing_keywords=", ".join(missing_keywords[:8]),
    )
    msg = cl.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


def generate_bullet_suggestions(
    job: dict,
    resume: dict,
    missing_keywords: list[str],
    client: Optional[anthropic.Anthropic] = None,
) -> str:
    cl = _get_client(client)
    experience = resume.get("experience", [])
    bullets_text = ""
    for exp in experience[:5]:
        bullets_text += f"\n{exp.get('company', '')} - {exp.get('title', '')}:\n"
        for b in exp.get("bullets", [])[:4]:
            bullets_text += f"  • {b}\n"

    projects = resume.get("projects", [])
    for proj in projects[:3]:
        bullets_text += f"\nProject: {proj.get('name', '')}:\n"
        for b in proj.get("bullets", [])[:3]:
            bullets_text += f"  • {b}\n"

    prompt = BULLET_OPTIMIZER_PROMPT.format(
        profile=PROFILE,
        company=job.get("company", ""),
        title=job.get("title", ""),
        description=(job.get("description") or "")[:600],
        missing_keywords=", ".join(missing_keywords[:8]),
        current_bullets=bullets_text,
    )
    msg = cl.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1200,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


def generate_why_company(
    job: dict,
    interests: str = "data science, AI/ML, product analytics, and tech strategy",
    client: Optional[anthropic.Anthropic] = None,
) -> str:
    cl = _get_client(client)
    prompt = WHY_COMPANY_PROMPT.format(
        profile=PROFILE,
        company=job.get("company", ""),
        title=job.get("title", ""),
        description=(job.get("description") or "")[:600],
        interests=interests,
    )
    msg = cl.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


def answer_application_question(
    job: dict,
    question: str,
    word_limit: int = 200,
    client: Optional[anthropic.Anthropic] = None,
) -> str:
    cl = _get_client(client)
    prompt = APP_QUESTION_PROMPT.format(
        profile=PROFILE,
        company=job.get("company", ""),
        title=job.get("title", ""),
        question=question,
        word_limit=word_limit,
    )
    msg = cl.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()
