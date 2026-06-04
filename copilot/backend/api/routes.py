"""
FastAPI routes for the job application copilot.
All application submission is human-gated — no auto-submit endpoints exist.
"""

import csv
import io
import json
import os
from typing import Optional

import anthropic
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import (
    upsert_job,
    get_jobs,
    get_job_detail,
    get_or_create_application,
    update_application_status,
    mark_human_reviewed,
    save_material,
    save_resume,
    get_active_resume,
    save_match_score,
    export_to_csv,
    ApplicationStatus,
)
from ..parsers import parse_resume, ingest_job_from_url, ingest_job_from_text
from ..scoring import compute_score, batch_score_jobs
from ..resume_optimizer import (
    generate_cover_letter,
    generate_bullet_suggestions,
    generate_why_company,
    answer_application_question,
)
from ..job_sources import fetch_jobs_from_github

router = APIRouter()


def get_db():
    from ..main import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_anthropic_client() -> Optional[anthropic.Anthropic]:
    key = os.getenv("ANTHROPIC_API_KEY")
    return anthropic.Anthropic(api_key=key) if key else None


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@router.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Resume
# ---------------------------------------------------------------------------

@router.post("/resume/upload")
async def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload a PDF resume for parsing and storage."""
    import tempfile, shutil
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    client = get_anthropic_client()
    try:
        parsed = parse_resume(tmp_path, client=client)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        os.unlink(tmp_path)

    resume = save_resume(db, {
        **parsed,
        "file_path": file.filename,
    })
    return {"id": resume.id, "version": resume.version, "skills": parsed.get("skills_flat", [])[:20]}


@router.get("/resume/active")
def get_resume(db: Session = Depends(get_db)):
    resume = get_active_resume(db)
    if not resume:
        raise HTTPException(status_code=404, detail="No active resume. Upload one first.")
    return {
        "id": resume.id,
        "version": resume.version,
        "education": json.loads(resume.education or "[]"),
        "skills": json.loads(resume.skills or "[]"),
        "experience": json.loads(resume.experience or "[]"),
        "projects": json.loads(resume.projects or "[]"),
    }


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------

class JobFilter(BaseModel):
    status: Optional[str] = None
    min_score: Optional[float] = None
    search: Optional[str] = None
    limit: int = 100
    offset: int = 0


@router.get("/jobs")
def list_jobs(
    status: Optional[str] = None,
    min_score: Optional[float] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    return get_jobs(db, status_filter=status, min_score=min_score, search=search, limit=limit, offset=offset)


@router.get("/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = get_job_detail(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


class ManualJobInput(BaseModel):
    url: Optional[str] = None
    text: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None


@router.post("/jobs/ingest/url")
def ingest_job_url(body: ManualJobInput, db: Session = Depends(get_db)):
    """Fetch and parse a public job posting from a URL."""
    if not body.url:
        raise HTTPException(status_code=400, detail="url is required")
    client = get_anthropic_client()
    try:
        parsed = ingest_job_from_url(body.url, client=client)
    except (ValueError, ConnectionError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    job, created = upsert_job(db, parsed)
    _score_job_if_resume(db, job, client)
    return {"job_id": job.id, "created": created, "title": job.title, "company": job.company}


@router.post("/jobs/ingest/paste")
def ingest_job_paste(body: ManualJobInput, db: Session = Depends(get_db)):
    """Parse a job from pasted text (e.g. from LinkedIn)."""
    if not body.text:
        raise HTTPException(status_code=400, detail="text is required")
    client = get_anthropic_client()
    parsed = ingest_job_from_text(body.text, url=body.url or "", source="manual_paste", client=client)
    if body.company:
        parsed["company"] = body.company
    if body.title:
        parsed["title"] = body.title

    job, created = upsert_job(db, parsed)
    _score_job_if_resume(db, job, client)
    return {"job_id": job.id, "created": created, "title": job.title, "company": job.company}


class GitHubSyncConfig(BaseModel):
    role_keywords: Optional[list[str]] = None
    company_exclusions: Optional[list[str]] = None


@router.post("/jobs/sync/github")
def sync_github_jobs(body: GitHubSyncConfig = GitHubSyncConfig(), db: Session = Depends(get_db)):
    """Fetch jobs from GitHub public internship repos."""
    client = get_anthropic_client()
    jobs_data = fetch_jobs_from_github(
        role_keywords=body.role_keywords,
        company_exclusions=body.company_exclusions,
    )
    added, skipped = 0, 0
    job_ids = []
    for job_data in jobs_data:
        job, created = upsert_job(db, job_data)
        if created:
            added += 1
            job_ids.append(job.id)
        else:
            skipped += 1

    # Score newly added jobs against active resume (lightweight, no explanation)
    resume = get_active_resume(db)
    if resume:
        resume_dict = _resume_to_dict(resume)
        for jid in job_ids[:50]:  # cap to avoid long waits
            from ..database.models import Job
            job_obj = db.get(Job, jid)
            if job_obj:
                job_dict = {
                    "title": job_obj.title,
                    "company": job_obj.company,
                    "location": job_obj.location,
                    "description": job_obj.description or "",
                    "required_skills": json.loads(job_obj.required_skills or "[]"),
                    "preferred_skills": json.loads(job_obj.preferred_skills or "[]"),
                    "listing_type": job_obj.source,
                }
                score_data = compute_score(resume_dict, job_dict, client=None, explain=False)
                save_match_score(db, jid, resume.id, score_data)

    return {"added": added, "skipped_duplicates": skipped}


def _score_job_if_resume(db: Session, job, client):
    """Score a single newly added job if we have an active resume."""
    resume = get_active_resume(db)
    if not resume:
        return
    resume_dict = _resume_to_dict(resume)
    job_dict = {
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "description": job.description or "",
        "required_skills": json.loads(job.required_skills or "[]"),
        "preferred_skills": json.loads(job.preferred_skills or "[]"),
    }
    score_data = compute_score(resume_dict, job_dict, client=client, explain=True)
    save_match_score(db, job.id, resume.id, score_data)


def _resume_to_dict(resume) -> dict:
    return {
        "raw_text": resume.raw_text or "",
        "skills_flat": json.loads(resume.skills or "[]"),
        "experience": json.loads(resume.experience or "[]"),
        "projects": json.loads(resume.projects or "[]"),
    }


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

@router.post("/jobs/{job_id}/score")
def score_job(job_id: int, db: Session = Depends(get_db)):
    """(Re)compute match score for a job."""
    from ..database.models import Job
    job_obj = db.get(Job, job_id)
    if not job_obj:
        raise HTTPException(status_code=404, detail="Job not found")
    resume = get_active_resume(db)
    if not resume:
        raise HTTPException(status_code=400, detail="No active resume")

    client = get_anthropic_client()
    resume_dict = _resume_to_dict(resume)
    job_dict = {
        "title": job_obj.title,
        "company": job_obj.company,
        "location": job_obj.location,
        "description": job_obj.description or "",
        "required_skills": json.loads(job_obj.required_skills or "[]"),
        "preferred_skills": json.loads(job_obj.preferred_skills or "[]"),
    }
    score_data = compute_score(resume_dict, job_dict, client=client, explain=True)
    save_match_score(db, job_id, resume.id, score_data)
    return score_data


# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------

class StatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


@router.post("/jobs/{job_id}/apply")
def create_application(job_id: int, db: Session = Depends(get_db)):
    """Create or retrieve an application record for a job."""
    resume = get_active_resume(db)
    app = get_or_create_application(db, job_id, resume_id=resume.id if resume else None)
    return {"application_id": app.id, "status": app.status}


@router.patch("/applications/{application_id}/status")
def update_status(application_id: int, body: StatusUpdate, db: Session = Depends(get_db)):
    """Update application status. Cannot set Applied without human review."""
    try:
        app = update_application_status(db, application_id, body.status, notes=body.notes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"application_id": app.id, "status": app.status}


@router.post("/applications/{application_id}/review")
def human_review(application_id: int, db: Session = Depends(get_db)):
    """
    Mark application as human-reviewed.
    SAFETY: this must be called explicitly by the user before status can be set to Applied.
    """
    app = mark_human_reviewed(db, application_id)
    return {"application_id": app.id, "human_reviewed": app.human_reviewed}


# ---------------------------------------------------------------------------
# Material generation
# ---------------------------------------------------------------------------

class MaterialRequest(BaseModel):
    material_type: str   # "cover_letter" | "bullets" | "why_company" | "app_question"
    question: Optional[str] = None
    word_limit: int = 200


@router.post("/jobs/{job_id}/generate")
def generate_material(job_id: int, body: MaterialRequest, db: Session = Depends(get_db)):
    """Generate tailored application material for a job."""
    job_detail = get_job_detail(db, job_id)
    if not job_detail:
        raise HTTPException(status_code=404, detail="Job not found")

    resume = get_active_resume(db)
    if not resume:
        raise HTTPException(status_code=400, detail="No active resume. Upload one first.")

    client = get_anthropic_client()
    resume_dict = _resume_to_dict(resume)
    missing = job_detail.get("missing_keywords", [])

    job_dict = {
        "company": job_detail["company"],
        "title": job_detail["title"],
        "location": job_detail.get("location", ""),
        "description": job_detail.get("description", ""),
        "required_skills": job_detail.get("required_skills", []),
    }

    if body.material_type == "cover_letter":
        content = generate_cover_letter(job_dict, resume_dict, missing, client=client)
    elif body.material_type == "bullets":
        content = generate_bullet_suggestions(job_dict, resume_dict, missing, client=client)
    elif body.material_type == "why_company":
        content = generate_why_company(job_dict, client=client)
    elif body.material_type == "app_question":
        if not body.question:
            raise HTTPException(status_code=400, detail="question is required for app_question type")
        content = answer_application_question(job_dict, body.question, body.word_limit, client=client)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown material_type: {body.material_type}")

    # Save to DB against the application
    app_id = job_detail.get("application_id")
    if app_id:
        mat = save_material(db, app_id, body.material_type, content)
        return {"content": content, "material_id": mat.id}

    return {"content": content}


# ---------------------------------------------------------------------------
# Export & Stats
# ---------------------------------------------------------------------------

@router.get("/export/csv")
def export_csv(db: Session = Depends(get_db)):
    rows = export_to_csv(db)
    if not rows:
        raise HTTPException(status_code=404, detail="No applications to export")
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=applications.csv"},
    )


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    jobs = get_jobs(db, limit=1000)
    status_counts = {}
    for job in jobs:
        s = job["status"]
        status_counts[s] = status_counts.get(s, 0) + 1

    scored = [j for j in jobs if j.get("score") is not None]
    avg_score = round(sum(j["score"] for j in scored) / len(scored), 1) if scored else 0

    return {
        "total_jobs": len(jobs),
        "scored_jobs": len(scored),
        "avg_score": avg_score,
        "status_breakdown": status_counts,
        "top_matches": [
            {"title": j["title"], "company": j["company"], "score": j["score"]}
            for j in jobs[:5] if j.get("score")
        ],
    }
