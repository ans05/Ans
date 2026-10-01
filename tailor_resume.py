#!/usr/bin/env python3
"""
tailor_resume.py  —  Auto-tailor Aneesh's resume for any job description.

Usage:
    python3 tailor_resume.py                        # prompts for job description
    python3 tailor_resume.py job.txt                # reads from file
    python3 tailor_resume.py job.txt "Figma"        # optional company name for filename

Requires:
    pip install anthropic fpdf2
    export ANTHROPIC_API_KEY=sk-ant-...
"""

import sys, os, json, re, pathlib
import anthropic

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
        "dates": "Jan 2025 – Jun 2025",
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



# ── PDF renderer (fpdf2, pure Python) ────────────────────────────────────────

SERIF_CANDIDATES = {
    # macOS
    "mac": {
        "": "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
        "B": "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf",
        "I": "/System/Library/Fonts/Supplemental/Times New Roman Italic.ttf",
        "BI": "/System/Library/Fonts/Supplemental/Times New Roman Bold Italic.ttf",
    },
    # Linux (Liberation Serif is metric-compatible with Times New Roman)
    "linux": {
        "": "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
        "B": "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
        "I": "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf",
        "BI": "/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf",
    },
    # Windows
    "win": {
        "": "C:/Windows/Fonts/times.ttf",
        "B": "C:/Windows/Fonts/timesbd.ttf",
        "I": "C:/Windows/Fonts/timesi.ttf",
        "BI": "C:/Windows/Fonts/timesbi.ttf",
    },
}


def _register_font(pdf) -> str:
    for paths in SERIF_CANDIDATES.values():
        if all(pathlib.Path(p).exists() for p in paths.values()):
            for style, p in paths.items():
                pdf.add_font("Serif", style=style, fname=p)
            return "Serif"
    # Built-in Times: Latin-1 only, so drop characters it can't encode
    return "Times"


def _ascii_safe(s: str, font: str) -> str:
    if font != "Times":
        return s
    return s.replace("–", "-").replace("—", "-").replace("•", "-").replace("’", "'").replace("&", "&")


def _render(tailored: dict, scale: float):
    from fpdf import FPDF

    pdf = FPDF(unit="pt", format="letter")
    pdf.set_auto_page_break(auto=True, margin=28)
    font = _register_font(pdf)
    S = lambda s: _ascii_safe(s, font)

    LM, RM, TM = 42, 42, 34
    W = pdf.w - LM - RM
    pdf.set_margins(LM, TM, RM)
    pdf.add_page()

    # sizes (all scaled to fit one page)
    f = lambda pt: pt * scale
    LH = lambda pt: pt * scale * 1.24   # line height for a given font size

    def text_right(y, s, size, style=""):
        pdf.set_font(font, style, f(size))
        pdf.text(pdf.w - RM - pdf.get_string_width(s), y, s)

    def row(left, right, lsize, rsize, lstyle="B", rstyle=""):
        y = pdf.get_y() + f(lsize)
        pdf.set_font(font, lstyle, f(lsize))
        pdf.text(LM, y, S(left))
        text_right(y, S(right), rsize, rstyle)
        pdf.set_y(y + f(1.5))

    def section(title):
        pdf.set_y(pdf.get_y() + f(4))
        y = pdf.get_y() + f(10.5)
        pdf.set_font(font, "B", f(10.5))
        pdf.text(LM, y, S(title))
        pdf.set_line_width(0.7)
        pdf.line(LM, y + f(2.5), pdf.w - RM, y + f(2.5))
        pdf.set_y(y + f(5))

    def bullets(items):
        size = 9.6
        indent = f(11)
        pdf.set_font(font, "", f(size))
        for b in items:
            y = pdf.get_y()
            pdf.text(LM + f(3), y + f(size) * 0.82, S("•"))
            pdf.set_xy(LM + indent, y)
            pdf.multi_cell(W - indent, LH(size), S(b), align="L")
        pdf.set_y(pdf.get_y() + f(2))

    def line(txt, size=9.6, style="", bold_prefix=None):
        # a single wrapped paragraph, optionally with a bold "Label:" prefix
        pdf.set_font(font, style, f(size))
        if bold_prefix:
            pdf.set_x(LM)
            pdf.set_font(font, "B", f(size))
            pdf.write(LH(size), S(bold_prefix + " "))
            pdf.set_font(font, style, f(size))
            pdf.write(LH(size), S(txt))
            pdf.ln(LH(size))
        else:
            pdf.set_x(LM)
            pdf.multi_cell(W, LH(size), S(txt), align="L")

    # ── Name (faux small caps) ──
    name = PROFILE["name"]
    pieces = []
    for word in name.split():
        pieces.append((word[0].upper(), 23))
        pieces.append((word[1:].upper() + " ", 17.5))
    pdf.set_font(font, "B", 1)
    total = 0
    for s, sz in pieces:
        pdf.set_font(font, "B", f(sz))
        total += pdf.get_string_width(s)
    x = (pdf.w - total) / 2
    y = TM + f(23)
    for s, sz in pieces:
        pdf.set_font(font, "B", f(sz))
        pdf.text(x, y, s)
        x += pdf.get_string_width(s)
    pdf.set_y(y + f(3))

    # ── Contact ──
    contact = f"{PROFILE['phone']}   |   {PROFILE['email']}   |   {PROFILE['linkedin']}"
    pdf.set_font(font, "", f(9.5))
    cy = pdf.get_y() + f(9.5)
    pdf.text((pdf.w - pdf.get_string_width(contact)) / 2, cy, S(contact))
    pdf.set_y(cy + f(1))

    # ── Education ──
    section("Education")
    row(EDUCATION["school"], EDUCATION["grad"], 10, 9.2)
    line(EDUCATION["degree"], 9.5, "I")
    line(EDUCATION["coursework"], 9.6, "", bold_prefix="Relevant Coursework:")

    # ── Experience ──
    section("Experience")
    for e in tailored["experience"]:
        row(e["org"], e["dates"], 10, 9.2)
        row(e["role"], e["location"], 9.5, 9.2, lstyle="I", rstyle="I")
        bullets(e["bullets"])

    # ── Projects ──
    section("Projects")
    for p in tailored["projects"]:
        y = pdf.get_y() + f(10)
        pdf.set_font(font, "B", f(10))
        pdf.text(LM, y, S(p["name"]))
        nx = LM + pdf.get_string_width(S(p["name"]))
        pdf.set_font(font, "I", f(9.5))
        pdf.text(nx + f(4), y, S(f"| {p['tech']}"))
        text_right(y, S(p["dates"]), 9.2)
        pdf.set_y(y + f(1.5))
        bullets(p["bullets"])

    # ── Skills ──
    section("Technical Skills")
    for cat, vals in tailored["skills"].items():
        line(vals, 9.6, "", bold_prefix=f"{cat}:")

    return pdf


def write_pdf(tailored: dict, company_hint: str):
    safe = re.sub(r'[^a-zA-Z0-9_-]', '_', company_hint)
    out_path = pathlib.Path(f"Aneesh_Srirambhatla_{safe}.pdf")

    # Shrink type until it fits on one page
    for scale in (1.0, 0.97, 0.94, 0.91, 0.88, 0.85):
        pdf = _render(tailored, scale)
        if pdf.pages_count == 1:
            break

    pdf.output(str(out_path))
    pages = pdf.pages_count
    print(f"Done → {out_path.resolve()}  ({pages} page{'s' if pages != 1 else ''}, scale {scale:.2f})")
    if pages > 1:
        print("WARNING: still over one page even at minimum scale — trim a bullet or two.")


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
        print("Paste the job description below, then press Ctrl+D on an empty line:\n")
        job_desc = sys.stdin.read()
        company_hint = sys.argv[1] if len(sys.argv) >= 2 else "role"

    if not job_desc.strip():
        print("Error: no job description provided.")
        sys.exit(1)

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("Error: ANTHROPIC_API_KEY is not set. Run:  export ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)

    print(f"Tailoring resume for: {company_hint} ...")
    tailored = tailor_with_claude(job_desc)

    safe = re.sub(r'[^a-zA-Z0-9_-]', '_', company_hint)
    pathlib.Path(f"tailored_{safe}.json").write_text(json.dumps(tailored, indent=2))
    write_pdf(tailored, company_hint)


if __name__ == "__main__":
    main()
