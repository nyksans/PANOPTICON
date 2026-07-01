"""
AI routes — chat, processing jobs, report generation.
Delegates to LLMService for real Gemini responses (or graceful mock fallback).
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import time
import uuid
import logging

from app.db.base import get_db
from app.models.case import Case
from app.models.evidence import Evidence
from app.core.security import get_current_user_id
from app.core.config import settings

logger = logging.getLogger("panopticon.ai")

# ---------------------------------------------------------------------------
# Singleton LLM service — initialized once on first import
# ---------------------------------------------------------------------------
from ai.services.llm_service import LLMService  # noqa: E402 — path on PYTHONPATH

_llm_service: Optional[LLMService] = None


def _get_llm() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService(api_key=settings.GEMINI_API_KEY)
    return _llm_service


router = APIRouter(prefix="/ai", tags=["AI"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    case_id: str
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    id: str
    role: str = "assistant"
    content: str
    timestamp: str
    confidence: Optional[float] = None
    processing_time: Optional[int] = None
    evidence_refs: Optional[List[str]] = []
    suspect_refs: Optional[List[str]] = []


class ProcessingJobResponse(BaseModel):
    job_id: str
    evidence_id: str
    status: str
    progress: int
    started_at: str
    estimated_completion: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    start_ms = int(time.time() * 1000)

    # Build case context for the LLM
    case_context: dict = {"case_number": "N/A", "title": "", "evidence_count": 0, "suspect_count": 0, "confidence": 0}
    evidence_context: List[dict] = []

    case_result = await db.execute(select(Case).where(Case.id == payload.case_id))
    case = case_result.scalar_one_or_none()
    if case:
        case_context = {
            "case_number": case.case_number,
            "title": case.title,
            "confidence": case.confidence_score,
            "evidence_count": 0,
            "suspect_count": 0,
        }
        # Fetch evidence summaries for context
        ev_result = await db.execute(select(Evidence).where(Evidence.case_id == case.id).limit(10))
        evidences = ev_result.scalars().all()
        case_context["evidence_count"] = len(evidences)
        evidence_context = [
            {
                "id": e.id,
                "synopsis": (e.ai_results or {}).get("synopsis", e.original_name),
                "confidence": (e.ai_results or {}).get("confidence", 0),
            }
            for e in evidences
        ]

    llm = _get_llm()
    response = await llm.query(
        message=payload.message,
        case_context=case_context,
        evidence_context=evidence_context,
    )

    elapsed = int(time.time() * 1000) - start_ms

    # Surface relevant evidence refs from message keywords
    evidence_refs = []
    for ev in evidence_context:
        if any(kw in payload.message.lower() for kw in ["evidence", "footage", "camera", "video"]):
            evidence_refs.append(ev["id"])

    return ChatResponse(
        id=str(uuid.uuid4()),
        content=response["content"],
        timestamp=datetime.now(timezone.utc).isoformat(),
        confidence=float(response.get("confidence", 80)),
        processing_time=elapsed,
        evidence_refs=evidence_refs[:3],
        suspect_refs=[],
    )


@router.post("/process/{evidence_id}", response_model=ProcessingJobResponse, status_code=202)
async def start_processing(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    ev_result = await db.execute(select(Evidence).where(Evidence.id == evidence_id))
    ev = ev_result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")

    ev.status = "processing"
    job_id = str(uuid.uuid4())
    await db.flush()

    # Dispatch Celery task for async AI processing
    try:
        from app.tasks.video_processing import process_evidence_task
        task = process_evidence_task.delay(evidence_id, job_id)
        logger.info(f"Dispatched Celery task {task.id} for evidence {evidence_id}, job {job_id}")
    except Exception as exc:
        logger.warning(f"Celery dispatch failed ({exc}). Evidence marked as processing but no worker running.")

    return ProcessingJobResponse(
        job_id=job_id,
        evidence_id=evidence_id,
        status="queued",
        progress=0,
        started_at=datetime.now(timezone.utc).isoformat(),
        estimated_completion=None,
    )


@router.get("/process/{job_id}/status")
async def get_processing_status(
    job_id: str,
    user_id: str = Depends(get_current_user_id),
):
    # TODO: query Celery AsyncResult for real status
    return {
        "job_id": job_id,
        "status": "running",
        "progress": 65,
        "current_step": "Person re-identification",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/report/generate")
async def generate_report(
    case_id: str,
    report_type: str = "comprehensive",
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    case_result = await db.execute(select(Case).where(Case.id == case_id))
    case = case_result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    ev_result = await db.execute(select(Evidence).where(Evidence.case_id == case_id))
    evidences = ev_result.scalars().all()

    case_context = {
        "case_number": case.case_number,
        "title": case.title,
        "confidence": case.confidence_score,
    }
    evidence_summaries = [
        {
            "id": e.id,
            "synopsis": (e.ai_results or {}).get("synopsis", e.original_name),
        }
        for e in evidences
    ]

    llm = _get_llm()
    report_content = await llm.generate_report(case_context, evidence_summaries, report_type)

    report_id = str(uuid.uuid4())
    return {
        "report_id": report_id,
        "case_id": case_id,
        "type": report_type,
        "status": "completed",
        "content": report_content,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
