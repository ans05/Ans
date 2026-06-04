"""
Database CRUD operations with deduplication and safety guardrails.
"""

import hashlib
import json
from datetime import datetime
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .models import (
    Application,
    ApplicationMaterial,
    ApplicationStatus,
    Job,
    MatchScore,
    Resume,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _job_fingerprint(company: str, title: str) -> str:
    """Stable hash for deduplication: company + title (case-insensitive)."""
    key = f"{company.strip().lower()}::{title.strip().lower()}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Job operations
# ---------------------------------------------------------------------------

def upsert_job(db: Session, job_data: dict) -> tuple[Job, bool]:
    """
    Insert a job or skip if a duplicate fingerprint exists.
    Returns (job, created) where created=False means it was a duplicate.
    URL uniqueness is a secondary check; fingerprint is the primary dedup key.
    """
    fp = _job_fingerprint(job_data["company"], job_data["title"])

    # Check fingerprint first
    existing = db.scalar(select(Job).where(Job.fingerprint == fp))
    if existing:
        return existing, False

    # Check URL if provided
    if job_data.get("url"):
        existing = db.scalar(select(Job).where(Job.url == job_data["url"]))
        if existing:
            return existing, False

    job = Job(
        title=job_data["title"],
        company=job_data["company"],
        location=job_data.get("location"),
        remote=job_data.get("remote", False),
        url=job_data.get("url"),
        description=job_data.get("description"),
        required_skills=json.dumps(job_data.get("required_skills", [])),
        preferred_skills=json.dumps(job_data.get("preferred_skills", [])),
        source=job_data.get("source", "manual"),
        deadline=job_data.get("deadline"),
        fingerprint=fp,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job, True


def get_jobs(
    db: Session,
    status_filter: Optional[str] = None,
    min_score: Optional[float] = None,
    search: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
) -> list[dict]:
    """Return jobs joined with their latest match scores and application status."""
    stmt = select(Job).where(Job.is_active == True).offset(offset).limit(limit)
    jobs = db.scalars(stmt).all()

    results = []
    for job in jobs:
        app = job.applications[0] if job.applications else None
        score_obj = job.match_scores[-1] if job.match_scores else None

        if status_filter and (not app or app.status != status_filter):
            continue
        if min_score and (not score_obj or score_obj.score < min_score):
            continue
        if search:
            needle = search.lower()
            if needle not in (job.title + job.company + (job.description or "")).lower():
                continue

        results.append(_job_to_dict(job, app, score_obj))

    results.sort(key=lambda x: x.get("score", 0), reverse=True)
    return results


def _job_to_dict(job: Job, app: Optional[Application], score: Optional[MatchScore]) -> dict:
    return {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "remote": job.remote,
        "url": job.url,
        "source": job.source,
        "deadline": job.deadline.isoformat() if job.deadline else None,
        "date_found": job.date_found.isoformat() if job.date_found else None,
        "status": app.status if app else ApplicationStatus.FOUND,
        "application_id": app.id if app else None,
        "score": round(score.score, 1) if score else None,
        "explanation": score.explanation if score else None,
        "missing_keywords": json.loads(score.missing_keywords) if score and score.missing_keywords else [],
        "matched_keywords": json.loads(score.matched_keywords) if score and score.matched_keywords else [],
        "human_reviewed": app.human_reviewed if app else False,
    }


def get_job_detail(db: Session, job_id: int) -> Optional[dict]:
    job = db.get(Job, job_id)
    if not job:
        return None
    app = job.applications[0] if job.applications else None
    score = job.match_scores[-1] if job.match_scores else None
    detail = _job_to_dict(job, app, score)
    detail["description"] = job.description
    detail["required_skills"] = json.loads(job.required_skills or "[]")
    detail["preferred_skills"] = json.loads(job.preferred_skills or "[]")
    if app:
        detail["notes"] = app.notes
        detail["recruiter_name"] = app.recruiter_name
        detail["recruiter_email"] = app.recruiter_email
        detail["date_applied"] = app.date_applied.isoformat() if app.date_applied else None
        detail["follow_up_date"] = app.follow_up_date.isoformat() if app.follow_up_date else None
        detail["materials"] = [
            {"type": m.material_type, "content": m.content, "version": m.version}
            for m in app.materials
        ]
    return detail


# ---------------------------------------------------------------------------
# Application operations
# ---------------------------------------------------------------------------

def get_or_create_application(db: Session, job_id: int, resume_id: Optional[int] = None) -> Application:
    job = db.get(Job, job_id)
    if not job:
        raise ValueError(f"Job {job_id} not found")
    if job.applications:
        return job.applications[0]
    app = Application(job_id=job_id, resume_id=resume_id, status=ApplicationStatus.FOUND)
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


def update_application_status(db: Session, application_id: int, status: str, notes: Optional[str] = None) -> Application:
    app = db.get(Application, application_id)
    if not app:
        raise ValueError(f"Application {application_id} not found")

    # SAFETY: prevent automatic submission — status can be set to Ready to Apply
    # but marking as Applied requires human_reviewed=True
    if status == ApplicationStatus.APPLIED and not app.human_reviewed:
        raise ValueError("Cannot mark as Applied without human review. Set human_reviewed=True first.")

    app.status = status
    if notes:
        app.notes = notes
    if status == ApplicationStatus.APPLIED:
        app.date_applied = datetime.utcnow()
    db.commit()
    db.refresh(app)
    return app


def mark_human_reviewed(db: Session, application_id: int) -> Application:
    app = db.get(Application, application_id)
    if not app:
        raise ValueError(f"Application {application_id} not found")
    app.human_reviewed = True
    db.commit()
    db.refresh(app)
    return app


def save_material(db: Session, application_id: int, material_type: str, content: str) -> ApplicationMaterial:
    app = db.get(Application, application_id)
    if not app:
        raise ValueError(f"Application {application_id} not found")

    # Increment version if material of same type exists
    existing = [m for m in app.materials if m.material_type == material_type]
    version = len(existing) + 1

    mat = ApplicationMaterial(
        application_id=application_id,
        material_type=material_type,
        content=content,
        version=version,
    )
    db.add(mat)
    db.commit()
    db.refresh(mat)
    return mat


# ---------------------------------------------------------------------------
# Resume operations
# ---------------------------------------------------------------------------

def save_resume(db: Session, resume_data: dict) -> Resume:
    # Deactivate previous resumes
    db.execute(
        Resume.__table__.update().where(Resume.is_active == True).values(is_active=False)
    )
    resume = Resume(
        version=resume_data.get("version", f"v{datetime.utcnow().strftime('%Y%m%d')}"),
        file_path=resume_data.get("file_path"),
        raw_text=resume_data.get("raw_text"),
        education=json.dumps(resume_data.get("education", {})),
        skills=json.dumps(resume_data.get("skills", [])),
        experience=json.dumps(resume_data.get("experience", [])),
        projects=json.dumps(resume_data.get("projects", [])),
        is_active=True,
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


def get_active_resume(db: Session) -> Optional[Resume]:
    return db.scalar(select(Resume).where(Resume.is_active == True))


# ---------------------------------------------------------------------------
# Score operations
# ---------------------------------------------------------------------------

def save_match_score(db: Session, job_id: int, resume_id: int, score_data: dict) -> MatchScore:
    ms = MatchScore(
        job_id=job_id,
        resume_id=resume_id,
        score=score_data["score"],
        skill_overlap=score_data.get("skill_overlap"),
        role_relevance=score_data.get("role_relevance"),
        industry_fit=score_data.get("industry_fit"),
        eligibility=score_data.get("eligibility"),
        location_score=score_data.get("location_score"),
        keyword_score=score_data.get("keyword_score"),
        experience_match=score_data.get("experience_match"),
        explanation=score_data.get("explanation"),
        missing_keywords=json.dumps(score_data.get("missing_keywords", [])),
        matched_keywords=json.dumps(score_data.get("matched_keywords", [])),
    )
    db.add(ms)
    db.commit()
    db.refresh(ms)
    return ms


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def export_to_csv(db: Session) -> list[dict]:
    """Return all applications as a list of dicts suitable for CSV export."""
    rows = []
    apps = db.scalars(select(Application)).all()
    for app in apps:
        job = app.job
        score = job.match_scores[-1] if job.match_scores else None
        rows.append({
            "company": job.company,
            "title": job.title,
            "location": job.location,
            "url": job.url,
            "status": app.status,
            "score": round(score.score, 1) if score else "",
            "date_applied": app.date_applied.isoformat() if app.date_applied else "",
            "deadline": job.deadline.isoformat() if job.deadline else "",
            "follow_up_date": app.follow_up_date.isoformat() if app.follow_up_date else "",
            "notes": app.notes or "",
            "recruiter": app.recruiter_name or "",
            "source": job.source,
            "date_found": job.date_found.isoformat() if job.date_found else "",
        })
    return rows
