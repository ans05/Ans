"""Tests for database operations including deduplication."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from ..database.models import Base, create_tables
from ..database.operations import (
    upsert_job,
    save_resume,
    get_active_resume,
    get_or_create_application,
    update_application_status,
    mark_human_reviewed,
    save_match_score,
    export_to_csv,
)
from ..database.models import ApplicationStatus


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    create_tables(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


SAMPLE_JOB = {
    "title": "Data Science Intern",
    "company": "Stripe",
    "location": "San Francisco, CA",
    "url": "https://stripe.com/jobs/data-science-intern",
    "description": "Summer 2026 data science internship",
    "required_skills": ["python", "sql"],
    "preferred_skills": ["tensorflow"],
    "source": "github:test",
}


def test_upsert_creates_job(db):
    job, created = upsert_job(db, SAMPLE_JOB)
    assert created is True
    assert job.title == "Data Science Intern"
    assert job.company == "Stripe"


def test_upsert_deduplicates_same_company_title(db):
    job1, created1 = upsert_job(db, SAMPLE_JOB)
    # Same company + title, different URL
    job2, created2 = upsert_job(db, {**SAMPLE_JOB, "url": "https://different-url.com/jobs/123"})
    assert created1 is True
    assert created2 is False  # Deduped by fingerprint
    assert job1.id == job2.id


def test_upsert_deduplicates_same_url(db):
    job1, created1 = upsert_job(db, SAMPLE_JOB)
    # Different title, same URL
    different_title = {**SAMPLE_JOB, "title": "Slightly Different Title"}
    job2, created2 = upsert_job(db, different_title)
    # URL match catches this
    assert created2 is False


def test_upsert_allows_different_companies(db):
    upsert_job(db, SAMPLE_JOB)
    other = {**SAMPLE_JOB, "company": "Plaid", "url": "https://plaid.com/jobs/ds"}
    job2, created2 = upsert_job(db, other)
    assert created2 is True


def test_resume_lifecycle(db):
    resume_data = {
        "version": "v1",
        "raw_text": "Python SQL machine learning",
        "skills": ["python", "sql"],
        "experience": [],
        "projects": [],
    }
    resume = save_resume(db, resume_data)
    assert resume.id is not None
    assert resume.is_active is True

    active = get_active_resume(db)
    assert active.id == resume.id

    # Saving a new resume deactivates old one
    resume2 = save_resume(db, {**resume_data, "version": "v2"})
    db.refresh(resume)
    assert resume.is_active is False
    assert resume2.is_active is True


def test_application_status_safety(db):
    job, _ = upsert_job(db, SAMPLE_JOB)
    app = get_or_create_application(db, job.id)

    # Cannot mark Applied without human review
    with pytest.raises(ValueError, match="human review"):
        update_application_status(db, app.id, ApplicationStatus.APPLIED)

    # But can set other statuses freely
    update_application_status(db, app.id, ApplicationStatus.INTERESTED)
    assert app.status == ApplicationStatus.INTERESTED

    update_application_status(db, app.id, ApplicationStatus.READY_TO_APPLY)
    assert app.status == ApplicationStatus.READY_TO_APPLY


def test_human_review_gate(db):
    job, _ = upsert_job(db, SAMPLE_JOB)
    app = get_or_create_application(db, job.id)
    assert app.human_reviewed is False

    mark_human_reviewed(db, app.id)
    db.refresh(app)
    assert app.human_reviewed is True

    # Now can mark as Applied
    update_application_status(db, app.id, ApplicationStatus.APPLIED)
    assert app.status == ApplicationStatus.APPLIED


def test_match_score_saved(db):
    job, _ = upsert_job(db, SAMPLE_JOB)
    resume = save_resume(db, {"version": "v1", "skills": ["python"], "experience": []})

    score_data = {
        "score": 75.5,
        "skill_overlap": 8.0,
        "role_relevance": 10.0,
        "explanation": "Strong match",
        "missing_keywords": ["tensorflow"],
        "matched_keywords": ["python"],
    }
    ms = save_match_score(db, job.id, resume.id, score_data)
    assert ms.score == 75.5
    assert ms.explanation == "Strong match"


def test_export_csv(db):
    job, _ = upsert_job(db, SAMPLE_JOB)
    resume = save_resume(db, {"version": "v1", "skills": [], "experience": []})
    app = get_or_create_application(db, job.id, resume.id)
    mark_human_reviewed(db, app.id)
    update_application_status(db, app.id, ApplicationStatus.APPLIED)

    rows = export_to_csv(db)
    assert len(rows) == 1
    assert rows[0]["company"] == "Stripe"
    assert rows[0]["status"] == ApplicationStatus.APPLIED
