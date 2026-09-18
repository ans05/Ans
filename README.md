# Resume Tailor

Two ways to use it: the Chrome extension (recommended) or the Python script.

## Chrome extension

No Python, no terminal. Click the icon on any job posting, get a tailored one-page PDF.

**Install (once):**

1. Download this repo (green **Code** button → **Download ZIP**, then unzip), or `git clone` it.
2. In Chrome, open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the `extension` folder.
5. Click the puzzle-piece icon in the toolbar and pin **Resume Tailor**.
6. Click the Resume Tailor icon → **Settings** → paste your Anthropic API key → **Save**.

**Use:**

1. Open a job posting in any tab.
2. Click the Resume Tailor icon. A new tab opens with the posting and company already filled in.
3. Click **Tailor with Claude** (about 15 seconds).
4. Click any bullet in the preview to edit it.
5. Click **Download PDF**.

The base résumé is derived from a **verified evidence bank** (`extension/resume-data.js`): every fact carries the metrics and tools it is allowed to contain, the competencies it supports, and the extrapolations that are prohibited. Tailoring can only select, shorten, reorder, and rephrase those facts; a fact guard replaces any rewrite that introduces a number, tool, or claim the bank does not verify.

### Evidence Match Score

The Score tab reports an **Evidence Match Score** — an internal estimate of how much of a posting's requirements your verified evidence covers. It is not a prediction of any employer's ATS ranking or interview decision.

- One model call reads the posting and classifies each statement: required qualification, preferred qualification, responsibility, company language, logistics, or subjective trait. Only the first three are scored; the rest are shown but never counted.
- Each scorable statement maps to capabilities from a closed vocabulary (`web/scoring.js`). Evidence rules need an action **and** an object in one résumé statement ("engineering" alone is not collaboration; "roadmap" alone is not a specification; "launched" alone is not stakeholder communication). Degree requirements are checked against Education, not bullets.
- Statuses: `matched` (1.0), `partially_matched` (0.5), `missing` (0), `not_scorable` (excluded). Every number on the page — counts, score, checklist, missing list — comes from one evaluation result, so a missing item can never also show as matched.
- Score = 50% required + 10% preferred + 20% responsibilities + 10% bullet quality + 10% evidence ordering. Bullet quality accepts a strong verb with either a metric or a concrete scope and outcome; numbers are not required.
- Missing items are listed with a confirmation question; the tool never fills a gap by itself.

### Tests

```bash
cd web && npm test          # builds, then unit tests (scoring, fact guard, outreach) + Playwright e2e on jobs/roblox.txt
python3 web/validate_pdf.py web/tests/out/Aneesh_Srirambhatla_Roblox.pdf --expect-words web/tests/out/expected_words.txt --png page.png
```

## Python script

`tailor_resume.py` rewrites Aneesh's resume bullets for a specific job description using the Claude API and renders a one-page PDF in the standard Berkeley/LaTeX-style format. PDF rendering is pure Python (fpdf2) — no system packages needed. If the output runs long, the script shrinks the type in small steps until it fits one page.

## Setup (once)

```bash
git clone https://github.com/ans05/Ans.git
cd Ans
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...  # from console.anthropic.com
```

## Tailor for a job

1. Copy the job posting in your browser, then save it to a file. On macOS:
   `pbpaste > jobs/figma.txt` (type this command; do not paste the posting into the terminal).
2. Run:

```bash
python3 tailor_resume.py jobs/figma.txt "Figma"
```

Output:

- `Aneesh_Srirambhatla_Figma.pdf` — upload this.
- `tailored_Figma.json` — the bullets Claude chose, for hand edits.

## Edit and re-render without another API call

```bash
# tweak tailored_Figma.json, then:
python3 tailor_resume.py --from-json tailored_Figma.json "Figma"
```

## Updating your base resume

Edit `BASE_EXPERIENCE`, `BASE_PROJECTS`, `BASE_SKILLS`, `EDUCATION`, and `PROFILE` at the top of `tailor_resume.py`. Add every true bullet you have, even more than fit on a page — the script selects the best three per role for each job.
