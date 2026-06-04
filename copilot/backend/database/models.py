"""
SQLAlchemy ORM models for the job application copilot.
All data is stored locally in SQLite.
"""

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class ApplicationStatus(str, PyEnum):
    FOUND = "Found"
    INTERESTED = "Interested"
    TAILORING = "Tailoring"
    READY_TO_APPLY = "Ready to Apply"
    APPLIED = "Applied"
    REJECTED = "Rejected"
    INTERVIEW = "Interview"
    ARCHIVED = "Archived"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    location = Column(String(255))
    remote = Column(Boolean, default=False)
    url = Column(String(1024), unique=True)
    description = Column(Text)
    required_skills = Column(Text)   # JSON list
    preferred_skills = Column(Text)  # JSON list
    source = Column(String(128))     # "github_repo", "manual", "greenhouse", etc.
    deadline = Column(DateTime)
    date_found = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Dedup fingerprint: hash of (company_lower + title_lower)
    fingerprint = Column(String(64), index=True)

    applications = relationship("Application", back_populates="job", cascade="all, delete-orphan")
    match_scores = relationship("MatchScore", back_populates="job", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("fingerprint", name="uq_job_fingerprint"),
    )


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version = Column(String(64), nullable=False)
    file_path = Column(String(512))
    raw_text = Column(Text)
    education = Column(Text)    # JSON
    skills = Column(Text)       # JSON list
    experience = Column(Text)   # JSON list of {company, title, bullets, dates}
    projects = Column(Text)     # JSON list of {name, bullets, tech}
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    applications = relationship("Application", back_populates="resume")


class MatchScore(Base):
    __tablename__ = "match_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False)
    score = Column(Float, nullable=False)           # 0–100
    skill_overlap = Column(Float)
    role_relevance = Column(Float)
    industry_fit = Column(Float)
    eligibility = Column(Float)
    location_score = Column(Float)
    keyword_score = Column(Float)
    experience_match = Column(Float)
    explanation = Column(Text)                       # Human-readable breakdown
    missing_keywords = Column(Text)                  # JSON list
    matched_keywords = Column(Text)                  # JSON list
    computed_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="match_scores")
    resume = relationship("Resume")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    resume_id = Column(Integer, ForeignKey("resumes.id"))
    status = Column(String(32), default=ApplicationStatus.FOUND)
    notes = Column(Text)
    recruiter_name = Column(String(255))
    recruiter_email = Column(String(255))
    date_applied = Column(DateTime)
    follow_up_date = Column(DateTime)
    deadline_reminder = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # SAFETY: this flag must be True before any apply link is surfaced for submission
    human_reviewed = Column(Boolean, default=False)
    # SAFETY: auto-submit is never allowed; this tracks if user manually submitted
    manually_submitted = Column(Boolean, default=False)

    job = relationship("Job", back_populates="applications")
    resume = relationship("Resume", back_populates="applications")
    materials = relationship("ApplicationMaterial", back_populates="application", cascade="all, delete-orphan")


class ApplicationMaterial(Base):
    __tablename__ = "application_materials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    material_type = Column(String(64))   # "cover_letter", "resume_bullets", "why_company", "app_answers"
    content = Column(Text)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("Application", back_populates="materials")


def get_engine(db_path: str = "copilot.db"):
    return create_engine(f"sqlite:///{db_path}", echo=False)


def create_tables(engine):
    Base.metadata.create_all(engine)
