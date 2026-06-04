"""Tests for match scoring engine."""

import pytest
from ..scoring.match_scorer import (
    _skill_overlap_score,
    _role_relevance_score,
    _eligibility_score,
    _keyword_score,
    _location_score,
    compute_score,
)

SAMPLE_RESUME = {
    "raw_text": "Python SQL machine learning data science TensorFlow A/B testing statistical modeling",
    "skills_flat": ["python", "sql", "machine learning", "tensorflow", "a/b testing", "tableau", "react"],
    "experience": [
        {
            "company": "Siemens Healthineers",
            "title": "Product Strategy Intern",
            "bullets": ["Built data pipeline with Python", "Conducted A/B testing analysis"],
        }
    ],
    "projects": [],
}


def test_skill_overlap_perfect():
    score = _skill_overlap_score(
        resume_skills=["python", "sql", "tensorflow"],
        job_required=["python", "sql"],
        job_preferred=["tensorflow"],
    )
    assert score >= 8.0


def test_skill_overlap_no_match():
    score = _skill_overlap_score(
        resume_skills=["python", "sql"],
        job_required=["kotlin", "rust", "haskell"],
        job_preferred=[],
    )
    assert score < 3.0


def test_skill_overlap_empty_job():
    score = _skill_overlap_score(["python"], [], [])
    assert score == 5.0  # neutral when no data


def test_role_relevance_data_science():
    assert _role_relevance_score("Data Science Intern") == 10.0


def test_role_relevance_ml():
    assert _role_relevance_score("Machine Learning Engineer") == 10.0


def test_role_relevance_unrelated():
    score = _role_relevance_score("Cashier Associate")
    assert score < 3.0


def test_eligibility_intern():
    score = _eligibility_score("We are looking for summer 2026 undergraduate interns")
    assert score >= 9.0


def test_eligibility_senior():
    score = _eligibility_score("Requires 5+ years of experience. Senior-level role.")
    assert score <= 3.0


def test_keyword_score_overlap():
    resume = "Python machine learning data analysis SQL tableau"
    jd = "looking for Python developer with machine learning experience and SQL skills"
    score = _keyword_score(resume, jd)
    assert score > 5.0


def test_location_remote():
    assert _location_score("Remote") == 10.0


def test_location_sf():
    assert _location_score("San Francisco, CA") >= 9.0


def test_location_nowhere():
    assert _location_score("Topeka, KS") < 6.0


def test_compute_score_no_api():
    """Compute score without API (no explanation)."""
    job = {
        "title": "Data Science Intern",
        "company": "Stripe",
        "location": "San Francisco, CA",
        "description": "Looking for Python machine learning intern for summer 2026",
        "required_skills": ["python", "sql", "machine learning"],
        "preferred_skills": ["tensorflow"],
        "listing_type": "internship",
    }
    result = compute_score(SAMPLE_RESUME, job, client=None, explain=False)
    assert 0 <= result["score"] <= 100
    assert result["skill_overlap"] is not None
    assert result["role_relevance"] is not None


def test_compute_score_high_match():
    """A perfect match should score highly."""
    job = {
        "title": "Data Science Intern",
        "company": "Google",
        "location": "Remote",
        "description": "2026 intern, Python, machine learning, SQL, A/B testing, data science",
        "required_skills": ["python", "sql", "machine learning", "a/b testing"],
        "preferred_skills": ["tensorflow", "tableau"],
        "listing_type": "internship",
    }
    result = compute_score(SAMPLE_RESUME, job, client=None, explain=False)
    assert result["score"] >= 60  # should be a strong match


def test_compute_score_bad_match():
    """An unrelated role should score low."""
    job = {
        "title": "Mechanical Engineer - Senior",
        "company": "Caterpillar",
        "location": "Peoria, IL",
        "description": "5+ years CAD design, SolidWorks, manufacturing",
        "required_skills": ["solidworks", "cad", "manufacturing"],
        "preferred_skills": [],
        "listing_type": "",
    }
    result = compute_score(SAMPLE_RESUME, job, client=None, explain=False)
    assert result["score"] < 40
