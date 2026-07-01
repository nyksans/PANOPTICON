"""
Dashboard routes — real-time stats from DB, live service health checks.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import time
import logging

from app.db.base import get_db, engine
from app.models.case import Case
from app.models.evidence import Evidence
from app.core.security import get_current_user_id
from app.core.config import settings

logger = logging.getLogger("panopticon.dashboard")
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    try:
        active_cases = (await db.execute(
            select(func.count(Case.id)).where(Case.status == "active")
        )).scalar_one()

        total_evidence = (await db.execute(
            select(func.count(Evidence.id))
        )).scalar_one()

        processing_queue = (await db.execute(
            select(func.count(Evidence.id)).where(Evidence.status == "processing")
        )).scalar_one()

        # Compute average AI confidence across AI-processed cases
        avg_confidence = (await db.execute(
            select(func.avg(Case.confidence_score)).where(Case.ai_processed == True)  # noqa: E712
        )).scalar_one() or 0.0

        return {
            "data": {
                "activeCases": active_cases,
                "totalEvidence": total_evidence,
                "processingQueue": processing_queue,
                "alertsToday": 0,           # populated by alerts endpoint
                "suspectsTracked": 0,        # populated when suspect routes exist
                "reportsGenerated": 0,
                "aiAccuracy": round(float(avg_confidence), 1),
                "systemHealth": "operational",
            },
            "success": True,
        }
    except Exception as exc:
        logger.error(f"Stats query failed: {exc}")
        return {
            "data": {
                "activeCases": 0, "totalEvidence": 0, "processingQueue": 0,
                "alertsToday": 0, "suspectsTracked": 0, "reportsGenerated": 0,
                "aiAccuracy": 0.0, "systemHealth": "degraded",
            },
            "success": False,
        }


@router.get("/health")
async def system_health():
    services: dict = {}

    # --- API self ---
    services["api"] = {"status": "operational", "latency": 1}

    # --- Database ---
    try:
        t0 = time.monotonic()
        async with engine.connect() as conn:
            await conn.execute(select(1))
        latency = int((time.monotonic() - t0) * 1000)
        services["database"] = {"status": "operational", "latency": latency}
    except Exception as exc:
        logger.warning(f"DB health check failed: {exc}")
        services["database"] = {"status": "down", "latency": None}

    # --- Redis ---
    try:
        import redis.asyncio as aioredis
        t0 = time.monotonic()
        r = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
        latency = int((time.monotonic() - t0) * 1000)
        services["redis"] = {"status": "operational", "latency": latency}
    except Exception as exc:
        logger.warning(f"Redis health check failed: {exc}")
        services["redis"] = {"status": "down", "latency": None}

    # --- AI pipeline (model file present?) ---
    import os
    model_ready = os.path.exists(settings.YOLO_MODEL_PATH)
    services["aiPipeline"] = {
        "status": "operational" if model_ready else "degraded",
        "latency": None,
        "message": None if model_ready else "YOLO model file not found",
    }

    # --- Storage ---
    try:
        storage_ok = os.path.isdir(settings.LOCAL_STORAGE_PATH)
        services["storage"] = {
            "status": "operational" if storage_ok else "degraded",
            "latency": 1,
        }
    except Exception:
        services["storage"] = {"status": "down", "latency": None}

    overall = (
        "operational"
        if all(s.get("status") == "operational" for s in services.values())
        else "degraded"
    )

    return {
        "status": overall,
        "services": services,
        "version": settings.APP_VERSION,
    }


@router.get("/alerts")
async def get_alerts(user_id: str = Depends(get_current_user_id)):
    # Alerts will be DB-backed once the alerts table and routes are added.
    # For now returns an empty list so the frontend shows no stale mock data.
    return {
        "data": [],
        "total": 0,
        "success": True,
    }
