from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime, timezone
import uuid
import hashlib
import os
import logging
import aiofiles

from app.db.base import get_db
from app.models.evidence import Evidence
from app.models.case import Case
from app.schemas.evidence import EvidenceResponse, EvidenceListResponse, DetectionResultsResponse
from app.core.config import settings
from app.core.security import get_current_user_id

logger = logging.getLogger("panopticon.evidence")

router = APIRouter(prefix="/evidence", tags=["Evidence"])

_TYPE_MAP = {
    ".mp4": "video", ".avi": "video", ".mov": "video", ".mkv": "video",
    ".jpg": "image", ".jpeg": "image", ".png": "image", ".webp": "image",
}


def _ev_to_dict(ev: Evidence) -> dict:
    return {
        "id": ev.id,
        "case_id": ev.case_id,
        "filename": ev.filename,
        "original_name": ev.original_name,
        "file_type": ev.file_type,
        "file_size": ev.file_size,
        "file_url": ev.file_url,
        "thumbnail_url": ev.thumbnail_url or "",
        "duration": ev.duration,
        "resolution": ev.resolution,
        "fps": ev.fps,
        "status": ev.status,
        "metadata_": ev.metadata_ or {},
        "ai_results": ev.ai_results,
        "tags": ev.tags or [],
        "notes": ev.notes or "",
        "file_hash": ev.file_hash or "",
        "uploaded_by": ev.uploaded_by or "",
        "uploaded_at": ev.uploaded_at,
        "processed_at": ev.processed_at,
    }


@router.get("", response_model=EvidenceListResponse)
async def list_evidence(
    case_id: Optional[str] = None,
    file_type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    stmt = select(Evidence)
    if case_id:
        stmt = stmt.where(Evidence.case_id == case_id)
    if file_type:
        stmt = stmt.where(Evidence.file_type == file_type)
    if status:
        stmt = stmt.where(Evidence.status == status)

    count_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_result.scalar_one()

    stmt = stmt.order_by(Evidence.uploaded_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    evidence_list = result.scalars().all()

    return EvidenceListResponse(
        data=[_ev_to_dict(e) for e in evidence_list],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{evidence_id}", response_model=EvidenceResponse)
async def get_evidence(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(select(Evidence).where(Evidence.id == evidence_id))
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return _ev_to_dict(ev)


@router.get("/{evidence_id}/detections", response_model=DetectionResultsResponse)
async def get_detections(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """Return structured AI detection results for a processed evidence item."""
    result = await db.execute(select(Evidence).where(Evidence.id == evidence_id))
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")

    ai = ev.ai_results or {}
    if not ai:
        return DetectionResultsResponse(
            evidence_id=evidence_id,
            status=ev.status,
            synopsis="No AI results available yet.",
        )

    # Extract detections list if stored (from detailed pipeline output)
    detections_raw = ai.get("detections", [])
    detections = []
    for d in detections_raw:
        bbox = d.get("bbox", {})
        detections.append({
            "label": d.get("label", "unknown"),
            "confidence": d.get("confidence", 0),
            "bbox": {"x": bbox.get("x", 0), "y": bbox.get("y", 0),
                     "width": bbox.get("width", 0), "height": bbox.get("height", 0)},
            "frame_number": d.get("frame_number", 0),
            "timestamp": d.get("timestamp", 0),
            "track_id": d.get("track_id"),
            "scene_position": d.get("scene_position"),
        })

    return DetectionResultsResponse(
        evidence_id=evidence_id,
        status=ev.status,
        persons=ai.get("persons", []),
        objects=ai.get("objects", []),
        events=ai.get("events", []),
        detections=detections,
        synopsis=ai.get("synopsis", ""),
        confidence=ai.get("confidence", 0),
        processing_models=ai.get("processing_models", []),
        total_detections=len(detections),
    )


@router.post("/{evidence_id}/process", status_code=202)
async def trigger_processing(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(select(Evidence).where(Evidence.id == evidence_id))
    ev = result.scalar_one_or_none()
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

    return {"message": "Processing queued", "evidence_id": evidence_id, "job_id": job_id}


@router.delete("/{evidence_id}", status_code=204)
async def delete_evidence(
    evidence_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(select(Evidence).where(Evidence.id == evidence_id))
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")
    # Remove file from disk if it exists
    file_path = os.path.join(settings.LOCAL_STORAGE_PATH, ev.filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    await db.delete(ev)


@router.post("/upload", status_code=201, response_model=EvidenceResponse)
async def upload_evidence(
    case_id: str = Form(...),
    file: UploadFile = File(...),
    notes: Optional[str] = Form(""),
    tags: Optional[str] = Form(""),
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    # Validate case exists
    case_result = await db.execute(select(Case).where(Case.id == case_id))
    if not case_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Case not found")

    # Read and validate file size
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(status_code=413, detail="File too large")

    file_hash = "sha256:" + hashlib.sha256(contents).hexdigest()
    ext = os.path.splitext(file.filename or "")[1].lower()
    file_type = _TYPE_MAP.get(ext, "video")

    new_id = str(uuid.uuid4())
    safe_filename = f"{new_id}{ext}"

    # Write to disk
    os.makedirs(settings.LOCAL_STORAGE_PATH, exist_ok=True)
    out_path = os.path.join(settings.LOCAL_STORAGE_PATH, safe_filename)
    async with aiofiles.open(out_path, "wb") as f:
        await f.write(contents)

    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    ev = Evidence(
        id=new_id,
        case_id=case_id,
        filename=safe_filename,
        original_name=file.filename or safe_filename,
        file_type=file_type,
        file_size=len(contents),
        file_url=f"/storage/{safe_filename}",
        thumbnail_url="",
        duration=None,
        resolution=None,
        fps=None,
        status="uploaded",
        metadata_={},
        ai_results=None,
        tags=tag_list,
        notes=notes or "",
        file_hash=file_hash,
        uploaded_by=user_id,
        uploaded_at=datetime.now(timezone.utc),
        processed_at=None,
    )
    db.add(ev)
    await db.flush()
    await db.refresh(ev)
    return _ev_to_dict(ev)
