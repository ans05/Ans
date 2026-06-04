"""
Seed script: loads your resume and sample job postings into the database.
Run from the project root:
    python -m scripts.seed
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

import anthropic
from sqlalchemy.orm import sessionmaker

from backend.database.models import get_engine, create_tables
from backend.database.operations import upsert_job, save_resume, save_match_score
from backend.parsers.resume_parser import parse_resume
from backend.scoring.match_scorer import compute_score

DB_PATH = os.getenv("DB_PATH", "copilot.db")
RESUME_PATH = os.path.join(os.path.dirname(__file__), "..", "config", "Aneesh_Srirambhatla_Resume.pdf")

SAMPLE_JOBS = [
    {
        "title": "Data Science Intern",
        "company": "Stripe",
        "location": "San Francisco, CA",
        "url": "https://stripe.com/jobs/listing/data-science-intern/example",
        "description": (
            "Join Stripe's Data Science team for Summer 2026. "
            "You'll analyze payment patterns, build ML models to detect fraud, "
            "run A/B tests, and create dashboards for executive stakeholders. "
            "Required: Python, SQL, statistics. Preferred: Spark, dbt, Looker. "
            "Must be a current undergraduate student graduating in 2026 or 2027."
        ),
        "required_skills": ["python", "sql", "statistics", "a/b testing"],
        "preferred_skills": ["spark", "dbt", "looker", "tensorflow"],
        "source": "sample_seed",
        "listing_type": "internship",
    },
    {
        "title": "Product Analytics Intern",
        "company": "Figma",
        "location": "San Francisco, CA",
        "url": "https://figma.com/careers/product-analytics-intern/example",
        "description": (
            "Figma is looking for a Product Analytics Intern to help us understand "
            "how designers use our product. You'll own end-to-end analysis, build dashboards, "
            "and partner with PMs on experimentation. "
            "Required: SQL, Python or R, data visualization. "
            "Experience with Amplitude or Mixpanel a plus. "
            "2026 or 2027 grads preferred."
        ),
        "required_skills": ["sql", "python", "data visualization", "product analytics"],
        "preferred_skills": ["r", "amplitude", "mixpanel", "tableau"],
        "source": "sample_seed",
        "listing_type": "internship",
    },
    {
        "title": "Machine Learning Engineer Intern",
        "company": "Scale AI",
        "location": "San Francisco, CA / Remote",
        "url": "https://scale.com/careers/ml-intern/example",
        "description": (
            "Build ML pipelines and evaluation frameworks for AI training data. "
            "Work with LLMs, fine-tuning, and RLHF workflows. "
            "Required: Python, PyTorch or TensorFlow, ML fundamentals. "
            "Ideal candidates have experience with NLP or LLM evaluation. "
            "Summer 2026 internship for current students."
        ),
        "required_skills": ["python", "machine learning", "nlp", "tensorflow"],
        "preferred_skills": ["pytorch", "llm", "rlhf", "huggingface"],
        "source": "sample_seed",
        "listing_type": "internship",
    },
    {
        "title": "Business Intelligence Intern",
        "company": "Databricks",
        "location": "San Francisco, CA",
        "url": "https://databricks.com/careers/bi-intern/example",
        "description": (
            "Join our BI team and build dashboards that drive decisions across the company. "
            "You'll work with Tableau, Power BI, and Databricks SQL. "
            "Strong SQL and data modeling skills required. "
            "Experience with dbt or Spark a plus. "
            "Graduating 2026 or 2027."
        ),
        "required_skills": ["sql", "tableau", "power bi", "data modeling"],
        "preferred_skills": ["dbt", "spark", "databricks", "python"],
        "source": "sample_seed",
        "listing_type": "internship",
    },
    {
        "title": "Product Strategy Intern",
        "company": "Notion",
        "location": "San Francisco, CA",
        "url": "https://notion.so/careers/product-strategy-intern/example",
        "description": (
            "Work directly with the Head of Strategy on competitive analysis, "
            "go-to-market strategy, and growth initiatives. "
            "You'll synthesize qualitative and quantitative insights. "
            "Strong analytical and communication skills. "
            "Experience in consulting, strategy, or product preferred. "
            "Current undergraduate students only."
        ),
        "required_skills": ["strategic analysis", "data analysis", "presentation"],
        "preferred_skills": ["sql", "excel", "python", "tableau"],
        "source": "sample_seed",
        "listing_type": "internship",
    },
]


def main():
    print("=== Job Copilot Seed Script ===\n")

    engine = get_engine(DB_PATH)
    create_tables(engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    api_key = os.getenv("ANTHROPIC_API_KEY")
    client = anthropic.Anthropic(api_key=api_key) if api_key else None
    if not client:
        print("⚠  ANTHROPIC_API_KEY not set — resume parsing and scoring explanations will be skipped.\n")

    # Load resume
    print(f"Loading resume from: {RESUME_PATH}")
    if os.path.exists(RESUME_PATH):
        try:
            parsed = parse_resume(RESUME_PATH, client=client)
            resume = save_resume(db, {**parsed, "version": "v1", "file_path": RESUME_PATH})
            print(f"✓ Resume loaded (id={resume.id}), {len(parsed.get('skills_flat', []))} skills extracted")
        except Exception as e:
            print(f"✗ Resume parsing failed: {e}")
            resume = None
    else:
        print(f"✗ Resume not found at {RESUME_PATH}")
        print("  Drop your PDF at config/Aneesh_Srirambhatla_Resume.pdf and re-run this script.")
        resume = None

    print()

    # Load sample jobs and score them
    print("Loading sample jobs…")
    for job_data in SAMPLE_JOBS:
        job, created = upsert_job(db, job_data)
        if created:
            print(f"  + {job.company}: {job.title}")
            if resume:
                resume_dict = {
                    "raw_text": resume.raw_text or "",
                    "skills_flat": json.loads(resume.skills or "[]"),
                    "experience": json.loads(resume.experience or "[]"),
                    "projects": json.loads(resume.projects or "[]"),
                }
                score_data = compute_score(resume_dict, job_data, client=client, explain=client is not None)
                save_match_score(db, job.id, resume.id, score_data)
                print(f"    Score: {score_data['score']:.0f}/100")
        else:
            print(f"  ~ {job.company}: {job.title} (already exists)")

    db.close()
    print("\n✓ Seed complete. Start the backend and visit http://localhost:3000\n")


if __name__ == "__main__":
    main()
