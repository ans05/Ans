"""
Manual job source — accepts pasted URLs or raw job description text.
This is the primary path for LinkedIn, Glassdoor, or any paywalled site
where automated fetching is not permitted.
"""

from ..parsers.job_parser import ingest_job_from_url, ingest_job_from_text
import anthropic
from typing import Optional


def ingest_from_url(url: str, client: Optional[anthropic.Anthropic] = None) -> dict:
    """Fetch and parse a public job posting from a URL."""
    return ingest_job_from_url(url, client=client)


def ingest_from_paste(
    text: str,
    url: str = "",
    company: str = "",
    title: str = "",
    client: Optional[anthropic.Anthropic] = None,
) -> dict:
    """
    Parse a job from copy-pasted text (e.g. LinkedIn job description).
    Provide url, company, title if you have them — they override parsed values.
    """
    parsed = ingest_job_from_text(text, url=url, source="manual_paste", client=client)
    if company:
        parsed["company"] = company
    if title:
        parsed["title"] = title
    return parsed
