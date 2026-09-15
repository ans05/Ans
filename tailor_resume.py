#!/usr/bin/env python3
"""
tailor_resume.py  —  Auto-tailor Aneesh's resume for any job description.

Usage:
    python3 tailor_resume.py                        # prompts for job description
    python3 tailor_resume.py job.txt                # reads from file
    python3 tailor_resume.py job.txt "Figma"        # optional company name for filename

Requires:
    pip install anthropic weasyprint
    export ANTHROPIC_API_KEY=sk-ant-...
"""

import sys, os, json, re, textwrap, pathlib, datetime
import anthropic
from weasyprint import HTML, CSS

# ── Base resume data ─────────────────────────────────────────────────────────

PROFILE = {
    "name": "Aneesh Srirambhatla",
    "phone": "424-390-9605",
    "email": "aneeshsri@berkeley.edu",
    "linkedin": "linkedin.com/in/aneesh-sri",
}

EDUCATION = {
    "school": "University of California, Berkeley",
    "grad": "Expected Graduation: Dec 2027",
    "degree": "B.A. Data Science | Certificate in Entrepreneurship & Technology",
    "coursework": "Data Structures & Algorithms, Foundations of Data Science, Statistical Analysis, Computational Structures in Data Science, Python Programming",
}

# Each experience has a fixed set of "truth" bullets — the raw facts.
# The AI picks which to emphasize and rewrites them for each role.
BASE_EXPERIENCE = [
    {
        "org": "Siemens Healthineers",
        "role": "Product & Strategy Intern",
        "location": "Berkeley, CA",
        "dates": "Jan 2026 – May 2026",
        "bullets": [
            "Synthesized customer-journey, workflow, and adoption-barrier research across 8+ organizations into a prioritized 90-day product activation strategy",
            "Analyzed patient advocacy networks and competitive positioning across 8+ organizations to identify strategic growth opportunities for theranostics business",
            "Developed data-informed patient engagement strategies by collaborating across clinical, marketing, and product teams",
            "Built a 90-day activation strategy from workflow and adoption-barrier research, prioritizing partnership opportunities across multiple product lines",
        ],
    },
    {
        "org": "Mercor",
        "role": "AI Growth Intern",
        "location": "San Francisco, CA",
        "dates": "Jan 2025 – June 2025",
        "bullets": [
            "Evaluated 500+ AI-generated responses using structured quality metrics to identify recurring patterns and improve model performance",
            "Contributed to a 15,000+ response training dataset by creating high-signal examples used to refine model behavior and evaluation quality",
            "Improved evaluation workflows by 15% through performance analysis and process optimization",
        ],
    },
    {
        "org": "Haas School of Business Lab",
        "role": "Undergraduate Research Assistant",
        "location": "Berkeley, CA",
        "dates": "Feb 2025 – Aug 2026",
        "bullets": [
            "Structured open-ended behavioral research questions into testable hypotheses; cleaned and analyzed 1,000+ participant responses using R, regression, and hypothesis testing",
            "Designed behavioral research studies to understand leadership, consumer decision-making, and organizational behavior",
            "Validated and communicated findings through written reports and slide decks to faculty and interdisciplinary research teams",
            "Analyzed datasets containing 1,000+ participant responses using regression models and statistical analysis to generate actionable behavioral insights",
        ],
    },
    {
        "org": "FlourishAI (Berkeley SkyDeck)",
        "role": "Software Engineer Intern",
        "location": "Berkeley, CA",
        "dates": "Dec 2024 – Aug 2025",
        "bullets": [
            "Engineered a Python and SQL ETL pipeline to ingest, clean, and validate data from 100+ research sources; benchmarked recommendations against expert-labeled references and used error analysis to improve accuracy by 15%",
            "Built and deployed a personalized nutrition recommendation platform using Python and SQL, increasing user engagement by 25%",
            "Developed an automated data pipeline processing 100+ research sources, improving recommendation accuracy by 15%",
            "Integrated continuous user feedback from 10+ SkyDeck startup seminars into agile development cycles, aligning product prototypes with user needs and business strategy",
        ],
    },
]

BASE_PROJECTS = [
    {
        "name": "Project GoalKeeper",
        "tech": "iOS, Python, A/B Testing",
        "dates": "May 2023 – Aug 2024",
        "bullets": [
            "Designed and analyzed A/B tests for an iOS product used by 100+ athletes, translating behavioral data and user feedback into feature decisions that increased average session duration by 30%",
            "Built and launched an iOS app to improve athletic performance through sports psychology techniques",
            "Led product strategy and partnership with NAMI, driving user adoption and iterating on features based on community feedback",
            "Used product analytics and A/B testing to guide feature decisions, increasing average session duration by 30%",
        ],
    },
]

BASE_SKILLS = {
    "Data & Analytics": "SQL, Python (pandas, NumPy), R, statistical modeling, regression analysis, hypothesis testing, experimental design, A/B testing, data cleaning & validation, ETL pipelines, model evaluation",
    "Languages & Tools": "Swift, Power BI, Git, Rust, Microsoft Azure, PostgreSQL",
    "Interests": "Consumer Technology, Product Strategy, Entrepreneurship, Experimental",
}

# ── Claude call ───────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a professional resume writer. Given a job description and a candidate's base resume bullets, you will:
1. Select the 3 most relevant bullets per experience (or rewrite them to better match the role — keep facts true, sharpen the language).
2. Adjust the Skills section to lead with keywords from the job description.
3. Return ONLY valid JSON in the exact schema provided. No extra text."""

def tailor_with_claude(job_description: str) -> dict:
    client = anthropic.Anthropic()

    base_data = {
        "experience": BASE_EXPERIENCE,
        "projects": BASE_PROJECTS,
        "base_skills": BASE_SKILLS,
    }

    user_prompt = f"""
Job Description:
{job_description}

Candidate's base resume data (JSON):
{json.dumps(base_data, indent=2)}

Return JSON with this exact schema:
{{
  "experience": [
    {{
      "org": "...",
      "role": "...",
      "location": "...",
      "dates": "...",
      "bullets": ["bullet 1", "bullet 2", "bullet 3"]
    }}
  ],
  "projects": [
    {{
      "name": "...",
      "tech": "...",
      "dates": "...",
      "bullets": ["bullet 1", "bullet 2"]
    }}
  ],
  "skills": {{
    "Data & Analytics": "...",
    "Languages & Tools": "...",
    "Interests": "..."
  }}
}}

Rules:
- Keep all org/role/location/dates exactly as given.
- 3 bullets per experience, 2 per project. Rewrite to match job keywords but keep every metric and fact true.
- Lead the skills Data & Analytics line with the tools most relevant to this job.
- Return only JSON, no markdown fences.
"""

    message = client.messages.create(
        model="claude-opus-5",
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = message.content[0].text.strip()
    # Strip markdown fences if model adds them anyway
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    return json.loads(raw)


# ── HTML template ─────────────────────────────────────────────────────────────

def build_html(tailored: dict) -> str:
    def esc(s):
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    def exp_block(e):
        bullets_html = "\n".join(f"<li>{esc(b)}</li>" for b in e["bullets"])
        return f"""
<div class="row">
  <span class="l">{esc(e['org'])}</span>
  <span class="r">{esc(e['dates'])}</span>
</div>
<div class="row sub">
  <span class="l">{esc(e['role'])}</span>
  <span class="r">{esc(e['location'])}</span>
</div>
<ul>{bullets_html}</ul>"""

    def proj_block(p):
        bullets_html = "\n".join(f"<li>{esc(b)}</li>" for b in p["bullets"])
        return f"""
<div class="proj-row">
  <span class="l">{esc(p['name'])} &nbsp;<em>| {esc(p['tech'])}</em></span>
  <span class="r">{esc(p['dates'])}</span>
</div>
<ul>{bullets_html}</ul>"""

    def skills_html(s):
        lines = ""
        for cat, vals in s.items():
            lines += f'<div class="skill-line"><strong>{esc(cat)}:</strong> {esc(vals)}</div>\n'
        return lines

    exp_blocks = "\n".join(exp_block(e) for e in tailored["experience"])
    proj_blocks = "\n".join(proj_block(p) for p in tailored["projects"])
    skill_block = skills_html(tailored["skills"])

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap');
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{
    font-family: 'EB Garamond', Georgia, 'Times New Roman', serif;
    font-size: 10pt;
    line-height: 1.28;
    color: #000;
    background: #fff;
    padding: 0.42in 0.58in;
  }}
  .name {{
    text-align: center;
    font-size: 23pt;
    font-variant: small-caps;
    font-weight: 700;
    letter-spacing: 0.02em;
    margin-bottom: 1pt;
  }}
  .contact {{
    text-align: center;
    font-size: 9pt;
    margin-bottom: 4pt;
  }}
  .contact a {{ color: #000; text-decoration: none; }}
  .sec {{
    font-size: 10.5pt;
    font-weight: 700;
    border-bottom: 0.8pt solid #000;
    padding-bottom: 1pt;
    margin-top: 5pt;
    margin-bottom: 2pt;
  }}
  .row {{
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }}
  .row .l {{ font-weight: 700; font-size: 10pt; }}
  .row .r {{ font-size: 9.2pt; white-space: nowrap; }}
  .row.sub .l {{ font-style: italic; font-weight: 400; font-size: 9.5pt; }}
  .row.sub .r {{ font-style: italic; font-size: 9.2pt; }}
  ul {{ margin: 1pt 0 3pt 0; padding-left: 13pt; }}
  ul li {{ font-size: 9.6pt; line-height: 1.32; margin-bottom: 0.5pt; }}
  .edu-degree {{ font-style: italic; font-size: 9.5pt; margin: 0.5pt 0; }}
  .edu-line {{ font-size: 9.6pt; margin: 1pt 0; }}
  .edu-line strong {{ font-weight: 700; }}
  .proj-row {{
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }}
  .proj-row .l {{ font-weight: 700; font-size: 10pt; }}
  .proj-row .l em {{ font-weight: 400; font-style: italic; }}
  .proj-row .r {{ font-size: 9.2pt; white-space: nowrap; }}
  .skill-line {{ font-size: 9.6pt; margin: 0.8pt 0; }}
  .skill-line strong {{ font-weight: 700; }}
</style>
</head>
<body>

<div class="name">{esc(PROFILE['name'])}</div>
<div class="contact">
  {esc(PROFILE['phone'])} &nbsp;&#9656;&nbsp;
  <a href="mailto:{esc(PROFILE['email'])}">{esc(PROFILE['email'])}</a> &nbsp;&#9656;&nbsp;
  <a href="https://{esc(PROFILE['linkedin'])}">{esc(PROFILE['linkedin'])}</a>
</div>

<div class="sec">Education</div>
<div class="row">
  <span class="l">{esc(EDUCATION['school'])}</span>
  <span class="r">{esc(EDUCATION['grad'])}</span>
</div>
<div class="edu-degree">{esc(EDUCATION['degree'])}</div>
<div class="edu-line"><strong>Relevant Coursework:</strong> {esc(EDUCATION['coursework'])}</div>

<div class="sec">Experience</div>
{exp_blocks}

<div class="sec">Projects</div>
{proj_blocks}

<div class="sec">Technical Skills</div>
{skill_block}

</body>
</html>"""


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Offline mode: python3 tailor_resume.py --from-json tailored.json "Figma"
    if len(sys.argv) >= 3 and sys.argv[1] == "--from-json":
        tailored = json.loads(pathlib.Path(sys.argv[2]).read_text())
        company_hint = sys.argv[3] if len(sys.argv) >= 4 else pathlib.Path(sys.argv[2]).stem
        write_pdf(tailored, company_hint)
        return

    # Read job description
    if len(sys.argv) >= 2 and pathlib.Path(sys.argv[1]).exists():
        job_desc = pathlib.Path(sys.argv[1]).read_text()
        company_hint = sys.argv[2] if len(sys.argv) >= 3 else pathlib.Path(sys.argv[1]).stem
    else:
        print("Paste the job description below. Press Enter twice then Ctrl+D when done:\n")
        lines = []
        try:
            while True:
                line = input()
                lines.append(line)
        except EOFError:
            pass
        job_desc = "\n".join(lines)
        company_hint = sys.argv[1] if len(sys.argv) >= 2 else "role"

    if not job_desc.strip():
        print("Error: no job description provided.")
        sys.exit(1)

    print(f"Tailoring resume for: {company_hint} ...")
    tailored = tailor_with_claude(job_desc)

    safe = re.sub(r'[^a-zA-Z0-9_-]', '_', company_hint)
    pathlib.Path(f"tailored_{safe}.json").write_text(json.dumps(tailored, indent=2))
    write_pdf(tailored, company_hint)


def write_pdf(tailored: dict, company_hint: str):
    safe = re.sub(r'[^a-zA-Z0-9_-]', '_', company_hint)
    out_path = pathlib.Path(f"Aneesh_Srirambhatla_{safe}.pdf")
    doc = HTML(string=build_html(tailored)).render(
        stylesheets=[CSS(string="@page { size: letter; margin: 0; }")]
    )
    doc.write_pdf(str(out_path))
    pages = len(doc.pages)
    print(f"Done → {out_path.resolve()}  ({pages} page{'s' if pages != 1 else ''})")
    if pages > 1:
        print("WARNING: resume spilled onto a second page — trim a bullet or two.")


if __name__ == "__main__":
    main()
