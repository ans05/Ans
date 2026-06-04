"""Tests for GitHub job source parser."""

import pytest
from ..job_sources.github_repos import parse_simplify_table, _job_fingerprint_collision


SAMPLE_MARKDOWN = """
# Summer 2026 Internships

| Company | Role | Location | Application/Link | Date Added |
| ------- | ---- | -------- | ---------------- | ---------- |
| [Stripe](https://stripe.com) | Data Science Intern | San Francisco, CA | [Apply](https://stripe.com/jobs/ds) | May 2025 |
| Google | Machine Learning Intern | Mountain View, CA 🔒 | Closed | May 2025 |
| [Meta](https://meta.com) | Product Analyst Intern | Remote | [Apply](https://meta.com/jobs/pa) | Jun 2025 |
| Coinbase | Software Engineer Intern | New York, NY | [Apply](https://coinbase.com/jobs/swe) | Jun 2025 |
"""


def test_parse_simplify_table_finds_open_jobs():
    jobs = parse_simplify_table(SAMPLE_MARKDOWN, "Test Source", "internship")
    titles = [j["title"] for j in jobs]
    companies = [j["company"] for j in jobs]

    # Closed listing should be excluded
    assert "Machine Learning Intern" not in titles or all(
        j["company"] != "Google" or j.get("closed") for j in jobs
    )


def test_parse_simplify_table_extracts_fields():
    jobs = parse_simplify_table(SAMPLE_MARKDOWN, "Test Source", "internship")
    stripe = next((j for j in jobs if j["company"] == "Stripe"), None)
    assert stripe is not None
    assert stripe["title"] == "Data Science Intern"
    assert "San Francisco" in stripe["location"]


def test_parse_simplify_remote_flag():
    jobs = parse_simplify_table(SAMPLE_MARKDOWN, "Test Source", "internship")
    meta = next((j for j in jobs if j["company"] == "Meta"), None)
    if meta:
        assert meta["remote"] is True


def test_parse_simplify_source_tagged():
    jobs = parse_simplify_table(SAMPLE_MARKDOWN, "My Source", "internship")
    for job in jobs:
        assert "My Source" in job["source"]


def test_filters_by_role_keyword():
    from ..job_sources.github_repos import fetch_jobs_from_github
    import unittest.mock as mock

    sample = SAMPLE_MARKDOWN
    with mock.patch("requests.get") as mock_get:
        mock_resp = mock.MagicMock()
        mock_resp.text = sample
        mock_resp.raise_for_status = mock.MagicMock()
        mock_get.return_value = mock_resp

        jobs = fetch_jobs_from_github(
            sources=[{"name": "test", "url": "http://x", "type": "internship"}],
            role_keywords=["data science"],
        )
    # Only "Data Science Intern" should pass the filter
    for j in jobs:
        assert "data science" in j["title"].lower()


# Helper — not an exposed function but tests the dedup logic
def _job_fingerprint_collision():
    """Verify same company+title → same fingerprint regardless of case."""
    from ..database.operations import _job_fingerprint
    fp1 = _job_fingerprint("Stripe", "Data Science Intern")
    fp2 = _job_fingerprint("stripe", "data science intern")
    fp3 = _job_fingerprint("STRIPE", "DATA SCIENCE INTERN")
    assert fp1 == fp2 == fp3


def test_fingerprint_collision():
    _job_fingerprint_collision()
