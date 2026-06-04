"""
Resume parser — extracts structured sections from PDF or plain text.
Uses pdfplumber for PDF extraction, then Claude for structured parsing.
"""

import json
import os
import re
from pathlib import Path
from typing import Optional

import anthropic

try:
    import pdfplumber
    HAS_PDF = True
except ImportError:
    HAS_PDF = False


PARSE_PROMPT = """You are parsing a resume into structured JSON.
Extract exactly these fields from the resume text below:

{{
  "name": "...",
  "email": "...",
  "phone": "...",
  "linkedin": "...",
  "github": "...",
  "education": [
    {{
      "institution": "...",
      "degree": "...",
      "major": "...",
      "graduation_date": "...",
      "gpa": "...",
      "relevant_courses": []
    }}
  ],
  "skills": {{
    "languages": [],
    "frameworks": [],
    "tools": [],
    "platforms": [],
    "other": []
  }},
  "experience": [
    {{
      "company": "...",
      "title": "...",
      "location": "...",
      "start_date": "...",
      "end_date": "...",
      "bullets": []
    }}
  ],
  "projects": [
    {{
      "name": "...",
      "description": "...",
      "tech": [],
      "bullets": [],
      "url": "..."
    }}
  ],
  "certifications": [],
  "awards": []
}}

Rules:
- Extract ONLY what is present; use null for missing fields
- Do not invent or embellish any content
- bullets should be the verbatim bullet text from the resume
- Return valid JSON only, no markdown fences

Resume text:
{resume_text}"""


def extract_text_from_pdf(pdf_path: str) -> str:
    if not HAS_PDF:
        raise ImportError("pdfplumber not installed. Run: pip install pdfplumber")
    with pdfplumber.open(pdf_path) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages)


def parse_resume(source: str | Path, client: Optional[anthropic.Anthropic] = None) -> dict:
    """
    Parse a resume from a PDF path or raw text string.
    Returns a structured dict with education, skills, experience, projects.
    """
    source = str(source)

    # Determine if it's a file path or raw text
    if os.path.isfile(source):
        ext = Path(source).suffix.lower()
        if ext == ".pdf":
            raw_text = extract_text_from_pdf(source)
        else:
            raw_text = Path(source).read_text(encoding="utf-8")
        file_path = source
    else:
        raw_text = source
        file_path = None

    if not raw_text.strip():
        raise ValueError("Resume text is empty")

    if client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise EnvironmentError("ANTHROPIC_API_KEY not set")
        client = anthropic.Anthropic(api_key=api_key)

    prompt = PARSE_PROMPT.format(resume_text=raw_text[:8000])  # cap tokens

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = message.content[0].text.strip()
    # Strip markdown fences if model added them
    response_text = re.sub(r"^```(?:json)?\s*", "", response_text)
    response_text = re.sub(r"\s*```$", "", response_text)

    parsed = json.loads(response_text)
    parsed["raw_text"] = raw_text
    parsed["file_path"] = file_path

    # Flatten skills to a single list for scoring convenience
    skills_obj = parsed.get("skills", {})
    if isinstance(skills_obj, dict):
        flat_skills = []
        for v in skills_obj.values():
            if isinstance(v, list):
                flat_skills.extend(v)
        parsed["skills_flat"] = [s.lower() for s in flat_skills]
    else:
        parsed["skills_flat"] = [s.lower() for s in (skills_obj or [])]

    return parsed


def get_skills_flat(parsed_resume: dict) -> list[str]:
    """Return a deduplicated lowercase list of all skills."""
    return list(set(parsed_resume.get("skills_flat", [])))
