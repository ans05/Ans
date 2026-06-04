# Job Application Copilot

A local-first automated job application assistant for Aneesh Srirambhatla.

**Not a spam bot.** Every application is human-reviewed before submission.

---

## What it does

- **Discovers jobs** from GitHub public internship repos, manual URL input, and copy-pasted descriptions
- **Scores each job 0–100** across 7 dimensions: skill overlap, role relevance, industry fit, eligibility, location, keyword density, and experience match
- **Generates tailored materials**: cover letters, resume bullet rewrites, "why this company" paragraphs, and application question answers
- **Tracks everything** in SQLite: status, notes, deadlines, recruiter contacts, resume version used
- **Human-review gate**: the UI requires you to click "Mark Reviewed" before you can set status to Applied — no auto-submit, ever
- **Deduplicates** by company+title fingerprint so you never see the same role twice

---

## Setup

### 1. Clone and navigate
```bash
cd copilot
```

### 2. Python backend
```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
```

### 3. Set your API key
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 4. Seed the database (loads your resume + sample jobs)
```bash
python -m scripts.seed
```

### 5. Start the backend
```bash
uvicorn backend.main:app --reload --port 8000
```

### 6. Start the frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

---

## Usage

### Sync GitHub jobs
Click **↻ Sync GitHub Jobs** in the sidebar. This pulls from:
- `SimplifyJobs/Summer2026-Internships`
- `SimplifyJobs/New-Grad-Positions`

Only roles matching your target keywords (data science, ML, product analytics, etc.) are imported.

### Add a job manually
- **URL**: paste a Greenhouse, Lever, or Workday URL into the URL box
- **LinkedIn / other paywalled**: copy-paste the job description text into the "Paste job description" form

### Review and apply
1. Click a job to open the detail panel
2. Review the match score and explanation
3. Click **Cover Letter**, **Resume Bullets**, or **Why This Company** to generate tailored materials
4. Edit the generated text as needed
5. When happy, click **Mark Reviewed** → set status to **Ready to Apply**
6. Click the **View Job Posting ↗** link to manually submit

---

## Project structure

```
copilot/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── api/routes.py            # All API endpoints
│   ├── database/
│   │   ├── models.py            # SQLAlchemy ORM models
│   │   └── operations.py        # CRUD with dedup + safety guardrails
│   ├── job_sources/
│   │   ├── github_repos.py      # SimplifyJobs GitHub parsers
│   │   └── manual_source.py     # URL + paste ingestion
│   ├── parsers/
│   │   ├── resume_parser.py     # PDF → structured JSON via Claude
│   │   └── job_parser.py        # Job page → structured JSON via Claude
│   ├── scoring/
│   │   └── match_scorer.py      # 7-dimension match scoring
│   ├── resume_optimizer/
│   │   └── generator.py         # Cover letter, bullets, why-company
│   ├── requirements.txt
│   └── tests/
│       ├── test_scoring.py
│       ├── test_database.py
│       ├── test_parsers.py
│       └── test_github_source.py
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── styles.css
│       ├── components/          # ScoreBadge, StatusBadge, JobCard, JobDetail
│       ├── pages/Dashboard.tsx
│       └── utils/api.ts
├── config/
│   ├── targets.json             # Your target roles, locations, companies
│   └── Aneesh_Srirambhatla_Resume.pdf
├── scripts/
│   └── seed.py                  # Load resume + sample jobs
├── .env.example
└── pytest.ini
```

---

## Adding new job sources

To add a new job source (e.g. Greenhouse, Lever, Wellfound), create a module in `backend/job_sources/` that:

1. Exposes a function returning `list[dict]` with fields: `title`, `company`, `url`, `source`, optionally `description`, `required_skills`, `preferred_skills`, `location`
2. Only fetches publicly accessible pages (no login walls, no CAPTCHA bypass)
3. Respects `robots.txt` and rate limits
4. Imports it in `backend/job_sources/__init__.py`
5. Calls it from the `/jobs/sync/*` route in `backend/api/routes.py`

Example skeleton is in `backend/job_sources/github_repos.py`.

---

## Running tests

```bash
cd copilot
pytest
```

---

## Safety guarantees

- **No auto-submit**: there is no endpoint that submits an application. The "Applied" status can only be set after `human_reviewed=True`.
- **No login bypass**: LinkedIn, Glassdoor, and any login-walled domains are blocked at the HTTP layer.
- **No CAPTCHA bypass**: all fetches use standard `requests` with a descriptive User-Agent.
- **No invented content**: all AI-generated materials use a system prompt that explicitly prohibits fabricating skills, companies, or metrics.
- **Local-only**: all data lives in `copilot.db` (SQLite) on your machine unless you explicitly configure cloud storage.

---

## Configuration

Edit `config/targets.json` to customize:
- Target role keywords
- Preferred locations
- Companies to prioritize or exclude
- Minimum score threshold for display
