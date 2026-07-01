"""
Celery tasks for video/evidence AI processing.

These tasks run in the Celery worker process (separate from the FastAPI server).
"""
import logging
import asyncio
import os
import sys

from app.celery_app import celery_app
from app.core.config import settings

# Ensure project root is on sys.path so ai.services resolves
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

logger = logging.getLogger("panopticon.tasks")


@celery_app.task(bind=True, name="process_evidence")
def process_evidence_task(self, evidence_id: str, job_id: str) -> dict:
    """
    Process a single evidence file through the full AI pipeline:
    frame extraction → YOLO detection → ByteTrack → Re-ID → results storage.
    """
    logger.info(f"[{job_id}] Starting processing for evidence {evidence_id}")

    try:
        from ai.services.video_processor import VideoProcessingPipeline

        # Resolve file path from evidence record
        # We use a synchronous DB call here since Celery workers run sync tasks
        from sqlalchemy import create_engine, text
        from sqlalchemy.orm import sessionmaker

        sync_db_url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2", 1)
        # Fallback: if psycopg2 not installed, use the evidence id to construct path
        file_path = os.path.join(settings.LOCAL_STORAGE_PATH, evidence_id)

        try:
            engine = create_engine(sync_db_url)
            Session = sessionmaker(bind=engine)
            with Session() as session:
                row = session.execute(
                    text("SELECT filename, status FROM evidence WHERE id = :id"),
                    {"id": evidence_id},
                ).fetchone()
                if row:
                    file_path = os.path.join(settings.LOCAL_STORAGE_PATH, row.filename)
        except Exception as db_exc:
            logger.warning(f"Could not load evidence from DB: {db_exc}. Using path heuristic.")

        if not os.path.exists(file_path):
            # Try any extension
            for ext in (".mp4", ".avi", ".mov", ".mkv", ".jpg", ".jpeg", ".png"):
                candidate = os.path.join(settings.LOCAL_STORAGE_PATH, f"{evidence_id}{ext}")
                if os.path.exists(candidate):
                    file_path = candidate
                    break

        def progress_callback(pct: int, step: str):
            self.update_state(
                state="PROGRESS",
                meta={"progress": pct, "current_step": step, "job_id": job_id},
            )

        pipeline = VideoProcessingPipeline(
            confidence_threshold=settings.DETECTION_CONFIDENCE_THRESHOLD,
            reid_threshold=settings.REID_SIMILARITY_THRESHOLD,
            gpu_enabled=settings.GPU_ENABLED,
        )
        output_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "processing", evidence_id)
        results = pipeline.process(
            file_path,
            evidence_id=evidence_id,
            output_dir=output_dir,
            progress_callback=progress_callback,
        )

        # Persist AI results back to DB
        try:
            engine = create_engine(sync_db_url)
            Session = sessionmaker(bind=engine)
            import json
            from datetime import datetime, timezone
            with Session() as session:
                session.execute(
                    text(
                        "UPDATE evidence SET status='processed', ai_results=:results, "
                        "processed_at=:ts WHERE id=:id"
                    ),
                    {
                        "results": json.dumps(results),
                        "ts": datetime.now(timezone.utc),
                        "id": evidence_id,
                    },
                )
                session.commit()
        except Exception as persist_exc:
            logger.error(f"Failed to persist AI results: {persist_exc}")

        logger.info(f"[{job_id}] Processing complete for evidence {evidence_id}")
        return {"job_id": job_id, "evidence_id": evidence_id, "status": "completed", "results": results}

    except Exception as exc:
        logger.error(f"[{job_id}] Processing failed for evidence {evidence_id}: {exc}")
        self.update_state(state="FAILURE", meta={"error": str(exc), "job_id": job_id})
        raise
