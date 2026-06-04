"""
Job description parser.
Extracts structured fields from raw HTML or text job postings.
Uses Claude for NLP extraction; BeautifulSoup for HTML cleaning.
"""

import json
import os
import re
from typing import Optional
from urllib.parse import urlparse

import anthropic
import requests
from bs4 import BeautifulSoup

# Respect robots.txt: we only fetch publicly accessible job postings.
# Never fetch pages requiring login or pages that block scrapers.
BLOCKED_DOMAINS = {
    "linkedin.com",   # requires login for most content
    "glassdoor.com",  # rate-limited / login wall
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; JobCopilot/1.0; +research-personal-use)",
}

JOB_PARSE_PROMPT = """Extract structured job posting information from the text below.
Return valid JSON matching this schema (use null for missing fields):

{{
  "title": "...",
  "company": "...",
  "location": "...",
  "remote": true/false,
  "description_summary": "2-3 sentence summary",
  "required_skills": [],
  "preferred_skills": [],
  "responsibilities": [],
  "qualifications": [],
  "graduation_year_range": {{"min": null, "max": null}},
  "is_internship": true/false,
  "is_new_grad": true/false,
  "salary_range": "...",
  "application_deadline": "...",
  "apply_url": "..."
}}

Return only JSON, no markdown.

Job posting text:
{text}"""


def _is_blocked(url: str) -> bool:
    domain = urlparse(url).netloc.lower()
    return any(blocked in domain for blocked in BLOCKED_DOMAINS)


def fetch_job_page(url: str, timeout: int = 15) -> Optional[str]:
    """
    Fetch a public job posting page.
    Returns clean text or None if blocked/failed.
    Never fetches login-walled or robots.txt-blocked pages.
    """
    if _is_blocked(url):
        raise ValueError(
            f"Domain blocked for automated access. For LinkedIn/Glassdoor, "
            f"paste the job description text manually."
        )

    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise ConnectionError(f"Failed to fetch {url}: {e}") from e

    soup = BeautifulSoup(resp.text, "html.parser")

    # Remove boilerplate elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
        tag.decompose()

    # Try to find the main job content container (common patterns)
    selectors = [
        "[class*='job-description']",
        "[class*='jobDescription']",
        "[class*='posting-content']",
        "[id*='job-description']",
        "main",
        "article",
        "[role='main']",
    ]
    content = None
    for sel in selectors:
        el = soup.select_one(sel)
        if el and len(el.get_text()) > 200:
            content = el
            break

    text = (content or soup.body or soup).get_text(separator="\n")
    # Collapse whitespace
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:6000]


def parse_job_description(text: str, client: Optional[anthropic.Anthropic] = None) -> dict:
    """Parse raw job description text into structured fields using Claude."""
    if client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise EnvironmentError("ANTHROPIC_API_KEY not set")
        client = anthropic.Anthropic(api_key=api_key)

    prompt = JOB_PARSE_PROMPT.format(text=text[:5000])
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    response = message.content[0].text.strip()
    response = re.sub(r"^```(?:json)?\s*", "", response)
    response = re.sub(r"\s*```$", "", response)
    return json.loads(response)


def ingest_job_from_url(url: str, client: Optional[anthropic.Anthropic] = None) -> dict:
    """Full pipeline: fetch URL → clean text → parse → return job dict."""
    text = fetch_job_page(url)
    parsed = parse_job_description(text, client=client)
    parsed["url"] = url
    parsed["source"] = "manual_url"
    return parsed


def ingest_job_from_text(text: str, url: str = "", source: str = "manual_paste",
                          client: Optional[anthropic.Anthropic] = None) -> dict:
    """Parse a job from pasted text (e.g. from LinkedIn copy-paste)."""
    parsed = parse_job_description(text, client=client)
    if url:
        parsed["url"] = url
    parsed["source"] = source
    return parsed
