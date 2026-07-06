"""
PANOPTICON Dataset Celery Tasks
Background workers for download, EDA, and preprocessing with WebSocket progress.
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Any, Dict, List, Optional

# Ensure project root is on path
_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
if _root not in sys.path:
    sys.path.insert(0, _root)

from app.celery_app import celery_app

logger = logging.getLogger("panopticon.tasks.datasets")


def _progress(task, pct: int, msg: str) -> None:
    """Update Celery task state for WebSocket polling."""
    task.update_state(
        state="PROGRESS",
        meta={"pct": pct, "message": msg},
    )


@celery_app.task(bind=True, name="tasks.download_dataset", max_retries=3)
def download_dataset(self, dataset_name: str, force: bool = False) -> Dict[str, Any]:
    """Download and prepare a single dataset."""
    try:
        from ai.datasets.registry import run_pipeline

        def cb(pct: int, msg: str = "") -> None:
            _progress(self, pct, msg or f"Downloading {dataset_name}…")

        _progress(self, 0, f"Starting download: {dataset_name}")
        result = run_pipeline(dataset_name, progress_callback=cb, force=force)
        _progress(self, 100, f"{dataset_name} ready")
        return result
    except Exception as exc:
        logger.error(f"Download task failed [{dataset_name}]: {exc}", exc_info=True)
        self.retry(exc=exc, countdown=30)


@celery_app.task(bind=True, name="tasks.run_eda", max_retries=2)
def run_eda(self, dataset_name: str) -> Dict[str, Any]:
    """Run EDA for a single dataset."""
    try:
        from ai.eda.pipeline import EDA_RUNNERS

        runner = EDA_RUNNERS.get(dataset_name)
        if runner is None:
            return {"status": "error", "message": f"Unknown dataset: {dataset_name}"}

        def cb(pct: int, msg: str = "") -> None:
            _progress(self, pct, msg or f"Running EDA: {dataset_name}…")

        _progress(self, 0, f"Starting EDA: {dataset_name}")
        result = runner(progress_cb=cb)
        _progress(self, 100, f"EDA complete: {dataset_name}")
        return {"status": "complete", "dataset": dataset_name, "sections": list(result.get("sections", {}).keys())}
    except Exception as exc:
        logger.error(f"EDA task failed [{dataset_name}]: {exc}", exc_info=True)
        self.retry(exc=exc, countdown=15)


@celery_app.task(bind=True, name="tasks.run_all_eda")
def run_all_eda(self, datasets: Optional[List[str]] = None) -> Dict[str, Any]:
    """Run EDA for all datasets."""
    try:
        from ai.eda.pipeline import run_all_eda as _run_all

        def cb(name: str, pct: int, msg: str) -> None:
            _progress(self, pct, f"[{name}] {msg}")

        _progress(self, 0, "Starting full EDA pipeline")
        result = _run_all(datasets=datasets, progress_cb=cb)
        _progress(self, 100, "All EDA complete")
        return result
    except Exception as exc:
        logger.error(f"Full EDA task failed: {exc}", exc_info=True)
        raise


@celery_app.task(bind=True, name="tasks.preprocess_dataset")
def preprocess_dataset(self, dataset_name: str) -> Dict[str, Any]:
    """Run preprocessing pipeline for a dataset."""
    try:
        from ai.preprocessing.pipeline import run_preprocessing

        def cb(pct: int, msg: str = "") -> None:
            _progress(self, pct, msg)

        _progress(self, 0, f"Preprocessing {dataset_name}…")
        result = run_preprocessing(dataset_name, progress_cb=cb)
        _progress(self, 100, "Preprocessing complete")
        return {"status": "complete", **result}
    except Exception as exc:
        logger.error(f"Preprocessing failed [{dataset_name}]: {exc}", exc_info=True)
        raise


@celery_app.task(bind=True, name="tasks.download_all_datasets")
def download_all_datasets(self, force: bool = False) -> Dict[str, Any]:
    """Download all four datasets sequentially."""
    datasets = ["coco", "mot17", "market1501", "scannet"]
    results = {}
    for i, name in enumerate(datasets):
        pct_base = i * 25
        _progress(self, pct_base, f"Starting {name}…")
        try:
            from ai.datasets.registry import run_pipeline
            results[name] = run_pipeline(name, force=force)
        except Exception as e:
            results[name] = {"status": "error", "error": str(e)}
        _progress(self, pct_base + 24, f"{name} done")
    _progress(self, 100, "All datasets complete")
    return results
