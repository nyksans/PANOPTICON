"""
Celery tasks for video/evidence AI processing.

These tasks run in the Celery worker process (separate from the FastAPI server).
Uses the unified InferencePipeline for all model inference.
"""
import logging
import json
import os
import sys
from datetime import datetime, timezone

from app.celery_app import celery_app
from app.core.config import settings

# Ensure project root is on sys.path so ai.services resolves
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

logger = logging.getLogger("panopticon.tasks")

# ── Global inference pipeline (lazy-initialized) ─────────────────────────────
_inference_pipeline = None


def _get_pipeline():
    global _inference_pipeline
    if _inference_pipeline is None:
        from ai.services.inference_pipeline import InferencePipeline
        _inference_pipeline = InferencePipeline(
            confidence_threshold=settings.DETECTION_CONFIDENCE_THRESHOLD,
            reid_threshold=settings.REID_SIMILARITY_THRESHOLD,
            device="auto",  # Automatic CUDA/CPU detection
            batch_size=8,
            frame_skip=1,
        )
        # Startup models once
        _inference_pipeline.startup()
    return _inference_pipeline


@celery_app.task(bind=True, name="process_evidence", max_retries=3)
def process_evidence_task(self, evidence_id: str, job_id: str) -> dict:
    """
    Process a single evidence file through the full PANOPTICON AI pipeline:
    1. Frame extraction
    2. Object detection (YOLOv8)
    3. Multi-object tracking (ByteTrack)
    4. Instance segmentation (SAM 2)
    5. Person re-identification (FastReID)
    6. Results aggregation and storage
    """
    logger.info(f"[{job_id}] Starting processing for evidence {evidence_id}")

    try:
        # ── Resolve file path ──────────────────────────────────────────────
        from sqlalchemy import create_engine, text
        from sqlalchemy.orm import sessionmaker

        sync_db_url = settings.DATABASE_URL.replace("+asyncpg", "+psycopg2", 1)
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

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Evidence file not found: {file_path}")

        # ── Progress callback ──────────────────────────────────────────────
        def progress_callback(pct: int, step: str):
            self.update_state(
                state="PROGRESS",
                meta={"progress": pct, "current_step": step, "job_id": job_id},
            )

        # ── Run inference pipeline ────────────────────────────────────────
        pipeline = _get_pipeline()
        output_dir = os.path.join(settings.LOCAL_STORAGE_PATH, "processing", evidence_id)

        results = pipeline.process_video(
            file_path,
            output_dir=output_dir,
            progress_callback=progress_callback,
        )

        # ── Persist results to database ────────────────────────────────────
        try:
            engine = create_engine(sync_db_url)
            Session = sessionmaker(bind=engine)
            with Session() as session:
                # Compute overall confidence
                confidence = float(results.get("confidence", 0))

                # Format results for JSONB storage
                ai_results = {
                    "status": "completed",
                    "persons": results.get("persons", []),
                    "objects": results.get("objects", {}),
                    "events": results.get("events", []),
                    "timeline": results.get("timeline", []),
                    "confidence": confidence,
                    "processing_models": results.get("models_used", []),
                    "detections": results.get("detections", [])[:100],  # Limit size
                    "processing_time": results.get("processing_time", 0),
                    "generated_at": results.get("generated_at"),
                }

                # Generate synopsis
                persons_count = len(results.get("persons", []))
                objects = results.get("objects", {})
                obj_str = ", ".join(f"{v} {k}" for k, v in list(objects.items())[:3])
                synopsis = f"{persons_count} person(s) detected."
                if obj_str:
                    synopsis += f" Objects: {obj_str}."

                session.execute(
                    text(
                        "UPDATE evidence SET status='processed', ai_results=:results, "
                        "processed_at=:ts, confidence_score=:confidence, "
                        "notes=:synopsis WHERE id=:id"
                    ),
                    {
                        "results": json.dumps(ai_results),
                        "ts": datetime.now(timezone.utc),
                        "id": evidence_id,
                        "confidence": confidence,
                        "synopsis": synopsis,
                    },
                )
                session.commit()
                logger.info(f"[{job_id}] AI results persisted to database")

        except Exception as persist_exc:
            logger.error(f"Failed to persist AI results: {persist_exc}", exc_info=True)
            # Don't fail the task — data was processed, just not stored

        logger.info(f"[{job_id}] Processing complete for evidence {evidence_id}")

        self.update_state(state="SUCCESS", meta={"job_id": job_id, "evidence_id": evidence_id})
        return {
            "job_id": job_id,
            "evidence_id": evidence_id,
            "status": "completed",
            "confidence": confidence,
            "persons_detected": persons_count,
        }

    except FileNotFoundError as exc:
        logger.error(f"[{job_id}] File not found: {exc}")
        self.update_state(state="FAILURE", meta={"error": str(exc), "job_id": job_id})
        raise

    except Exception as exc:
        logger.error(f"[{job_id}] Processing failed for evidence {evidence_id}: {exc}", exc_info=True)
        self.update_state(state="FAILURE", meta={"error": str(exc), "job_id": job_id})
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
