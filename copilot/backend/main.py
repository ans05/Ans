"""
Job Application Copilot — FastAPI backend entry point.
Run: uvicorn backend.main:app --reload --port 8000
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import sessionmaker

from .database.models import get_engine, create_tables
from .api.routes import router

DB_PATH = os.getenv("DB_PATH", "copilot.db")
engine = get_engine(DB_PATH)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables(engine)
    print(f"[copilot] Database ready at {DB_PATH}")
    yield


app = FastAPI(
    title="Job Application Copilot",
    description="Local-first automated job application assistant for Aneesh Srirambhatla",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")
