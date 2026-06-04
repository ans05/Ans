from .github_repos import fetch_jobs_from_github, GITHUB_SOURCES
from .manual_source import ingest_from_url, ingest_from_paste

# ---------------------------------------------------------------------------
# To add a new job source, create a new module in this package and import it
# here. Your module should expose a function returning list[dict] where each
# dict has at minimum: title, company, url, source.
#
# Example sources to add:
#   - Greenhouse public APIs (greenhouse_source.py)
#   - Lever public job boards (lever_source.py)
#   - Wellfound/AngelList public listings (wellfound_source.py)
#   - Company career page scrapers (company_careers.py)
# ---------------------------------------------------------------------------
