"""
Job source: GitHub public internship/new-grad repositories.

Parses well-known community-maintained lists:
  - SimplifyJobs/Summer2026-Internships
  - SimplifyJobs/New-Grad-Positions
  - pittcsc/Summer2025-Internships (legacy, for reference)

These repos store job listings as markdown tables — we parse the README
via GitHub's raw content API (public, no auth needed for public repos).

To add a new source, create a new dict in GITHUB_SOURCES and implement
a parser function following the pattern below.
"""

import re
from datetime import datetime
from typing import Optional

import requests

GITHUB_SOURCES = [
    # -----------------------------------------------------------------------
    # Add more sources here following the same pattern:
    # {"name": "...", "url": "raw README URL", "type": "internship"|"new_grad"}
    # -----------------------------------------------------------------------
    {
        "name": "SimplifyJobs Summer 2026 Internships",
        "url": "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md",
        "type": "internship",
        "grad_year": 2026,
    },
    {
        "name": "SimplifyJobs New Grad 2025",
        "url": "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md",
        "type": "new_grad",
        "grad_year": 2025,
    },
    {
        "name": "SimplifyJobs Summer 2025 Internships",
        "url": "https://raw.githubusercontent.com/SimplifyJobs/Summer2025-Internships/dev/README.md",
        "type": "internship",
        "grad_year": 2025,
    },
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; JobCopilot/1.0; personal-use)",
    "Accept": "text/plain",
}

# Markdown table row pattern: | Company | Role | Location | Link | Date |
TABLE_ROW_RE = re.compile(r"^\|(.+)\|$")
LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
CLOSED_MARKERS = {"🔒", "closed", "no longer accepting"}


def _clean_cell(cell: str) -> str:
    cell = cell.strip()
    # Remove HTML tags
    cell = re.sub(r"<[^>]+>", "", cell)
    return cell.strip()


def _extract_link(cell: str) -> tuple[str, str]:
    """Return (text, url) from a markdown link cell, or (text, '') if no link."""
    m = LINK_RE.search(cell)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return _clean_cell(cell), ""


def _is_closed(row_text: str) -> bool:
    lower = row_text.lower()
    return any(marker in lower for marker in CLOSED_MARKERS) or "🔒" in row_text


def parse_simplify_table(markdown: str, source_name: str, listing_type: str) -> list[dict]:
    """
    Parse the SimplifyJobs markdown table format:
    | Company | Role | Location | Application/Link | Date Added |
    """
    jobs = []
    in_table = False
    header_cols: list[str] = []

    for line in markdown.splitlines():
        line = line.rstrip()
        if not TABLE_ROW_RE.match(line):
            in_table = False
            header_cols = []
            continue

        cells = [_clean_cell(c) for c in line.strip("|").split("|")]

        # Detect header row
        if not in_table:
            lower_cells = [c.lower() for c in cells]
            if any(h in lower_cells for h in ["company", "role", "position", "title"]):
                header_cols = lower_cells
                in_table = True
                continue
            # Separator row (---|---|---)
            if all(re.match(r"^[-: ]+$", c) for c in cells if c):
                continue

        if not in_table or not header_cols:
            continue

        # Skip separator rows
        if all(re.match(r"^[-: ]+$", c) for c in cells if c):
            continue

        if len(cells) < 2:
            continue

        # Skip closed listings
        if _is_closed(line):
            continue

        # Map columns by header name (flexible across different repo formats)
        def get(keys: list[str]) -> str:
            for k in keys:
                for i, h in enumerate(header_cols):
                    if k in h and i < len(cells):
                        return cells[i]
            return ""

        company_raw = get(["company"])
        role_raw = get(["role", "position", "title"])
        location_raw = get(["location"])
        link_raw = get(["application", "link", "apply", "url"])
        date_raw = get(["date", "added", "posted"])

        company_text, company_url = _extract_link(company_raw)
        role_text, role_url = _extract_link(role_raw)
        _, apply_url = _extract_link(link_raw) if link_raw else ("", "")

        # Some repos put the apply link on the role column
        url = apply_url or role_url or company_url or ""

        # Filter out empty rows
        if not company_text or not role_text:
            continue

        # Simplify Apply URL (some link to simplify.jobs)
        if "simplify.jobs" in url or url.startswith("https://simplify.jobs"):
            apply_url = url

        job = {
            "company": company_text,
            "title": role_text,
            "location": _clean_cell(location_raw),
            "remote": "remote" in location_raw.lower(),
            "url": url or None,
            "source": f"github:{source_name}",
            "listing_type": listing_type,
            "date_found": datetime.utcnow().isoformat(),
            "required_skills": [],
            "preferred_skills": [],
        }
        jobs.append(job)

    return jobs


def fetch_jobs_from_github(
    sources: Optional[list[dict]] = None,
    role_keywords: Optional[list[str]] = None,
    company_exclusions: Optional[list[str]] = None,
    timeout: int = 20,
) -> list[dict]:
    """
    Fetch jobs from all configured GitHub sources.
    Filters by role_keywords if provided.
    """
    if sources is None:
        sources = GITHUB_SOURCES

    role_keywords = [k.lower() for k in (role_keywords or [])]
    exclusions = [e.lower() for e in (company_exclusions or [])]

    all_jobs = []

    for source in sources:
        try:
            resp = requests.get(source["url"], headers=HEADERS, timeout=timeout)
            resp.raise_for_status()
            markdown = resp.text
        except requests.RequestException as e:
            print(f"[github_repos] Failed to fetch {source['name']}: {e}")
            continue

        jobs = parse_simplify_table(markdown, source["name"], source.get("type", "internship"))
        print(f"[github_repos] {source['name']}: {len(jobs)} active listings parsed")

        for job in jobs:
            # Filter by role keywords
            if role_keywords:
                title_lower = job["title"].lower()
                if not any(kw in title_lower for kw in role_keywords):
                    continue

            # Filter out excluded companies
            if exclusions:
                if job["company"].lower() in exclusions:
                    continue

            all_jobs.append(job)

    print(f"[github_repos] Total after filters: {len(all_jobs)} jobs")
    return all_jobs
