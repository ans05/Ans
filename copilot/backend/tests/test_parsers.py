"""Tests for job description parser (no API calls — mocked)."""

import json
from unittest.mock import MagicMock, patch

import pytest

from ..parsers.job_parser import parse_job_description, _is_blocked, fetch_job_page


def test_blocked_domain_linkedin():
    with pytest.raises(ValueError, match="blocked"):
        fetch_job_page("https://www.linkedin.com/jobs/view/123456")


def test_blocked_domain_glassdoor():
    with pytest.raises(ValueError, match="blocked"):
        fetch_job_page("https://www.glassdoor.com/job-listing/abc")


def test_parse_job_description_mock():
    """Test parsing with a mocked Claude response."""
    mock_response_json = {
        "title": "Data Science Intern",
        "company": "Stripe",
        "location": "San Francisco, CA",
        "remote": False,
        "description_summary": "Summer internship on the data team.",
        "required_skills": ["python", "sql", "statistics"],
        "preferred_skills": ["spark", "mlflow"],
        "is_internship": True,
        "is_new_grad": False,
        "salary_range": "$45/hour",
        "application_deadline": None,
        "apply_url": None,
    }

    mock_client = MagicMock()
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=json.dumps(mock_response_json))]
    mock_client.messages.create.return_value = mock_message

    result = parse_job_description(
        "Data Science Intern at Stripe. Python, SQL required. Summer 2026.",
        client=mock_client,
    )
    assert result["title"] == "Data Science Intern"
    assert result["company"] == "Stripe"
    assert "python" in result["required_skills"]
    assert result["is_internship"] is True


def test_parse_job_strips_markdown_fences():
    """Test that markdown code fences in response are handled."""
    mock_client = MagicMock()
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text='```json\n{"title": "ML Intern", "company": "OpenAI", "location": "SF", "remote": false, "description_summary": "test", "required_skills": [], "preferred_skills": [], "is_internship": true, "is_new_grad": false, "salary_range": null, "application_deadline": null, "apply_url": null}\n```')]
    mock_client.messages.create.return_value = mock_message

    result = parse_job_description("some text", client=mock_client)
    assert result["title"] == "ML Intern"
