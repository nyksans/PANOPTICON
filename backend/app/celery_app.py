"""
Celery application factory for PANOPTICON background tasks.

Usage (from /backend):
  celery -A app.celery_app worker --loglevel=info --concurrency=2
"""
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "panopticon",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.video_processing"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)
