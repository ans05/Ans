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

The base resume lives in **Settings** as editable JSON. Add every true bullet you have; the model picks the best three per role for each job.

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
