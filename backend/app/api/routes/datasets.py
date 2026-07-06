"""
PANOPTICON Datasets & EDA API
Full REST API for dataset management, EDA, statistics, reports, download, and preprocessing.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

# Ensure project root on path
_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
if _root not in sys.path:
    sys.path.insert(0, _root)

logger = logging.getLogger("panopticon.api.datasets")

router = APIRouter(prefix="/api/v1/datasets", tags=["datasets"])

# ── Pydantic models ────────────────────────────────────────────────────────


class DownloadRequest(BaseModel):
    dataset: str
    force: bool = False


class EDARequest(BaseModel):
    dataset: str


class PreprocessRequest(BaseModel):
    dataset: str


# ── Helpers ────────────────────────────────────────────────────────────────

DATASETS_ROOT = Path(_root) / "ai" / "datasets"
EDA_ROOT      = Path(_root) / "ai" / "eda"
REPORTS_ROOT  = Path(_root) / "ai" / "reports"

DATASET_INFO = {
    "coco": {
        "name": "COCO 2017",
        "purpose": "Object Detection — 80 categories, 330K images, 2.5M instances",
        "size_gb": 1.2,
        "url": "https://cocodataset.org/",
        "benchmark_metrics": ["AP", "AP50", "AP75"],
        "use_cases": ["Object detection", "Weapon detection", "Scene understanding"],
    },
    "mot17": {
        "name": "MOT17",
        "purpose": "Multi-Object Tracking — 14 sequences, pedestrian tracking",
        "size_gb": 5.7,
        "url": "https://motchallenge.net/data/MOT17/",
        "benchmark_metrics": ["MOTA", "MOTP", "IDF1", "ID Switches"],
        "use_cases": ["Pedestrian tracking", "Track validation", "CCTV analysis"],
    },
    "market1501": {
        "name": "Market-1501",
        "purpose": "Person Re-ID — 1,501 identities across 6 cameras",
        "size_gb": 0.6,
        "url": "https://zheng-lab.cecs.anu.edu.au/Project/project_reid.html",
        "benchmark_metrics": ["Rank-1", "mAP", "CMC"],
        "use_cases": ["Cross-camera tracking", "Suspect re-identification"],
    },
    "scannet": {
        "name": "ScanNet v2",
        "purpose": "3D Scene Reconstruction — 707 scenes with RGB-D frames and meshes",
        "size_gb": 2.5,
        "url": "http://www.scan-net.org/",
        "benchmark_metrics": ["mIoU", "Scene Completion"],
        "use_cases": ["3D reconstruction", "Scene understanding", "Camera calibration"],
    },
}


def _get_dataset_status(name: str) -> str:
    try:
        from ai.datasets.registry import get_manager
        mgr = get_manager(name)
        return mgr.status()
    except Exception:
        return "unknown"


def _get_dataset_meta(name: str) -> Dict[str, Any]:
    try:
        from ai.datasets.registry import get_manager
        mgr = get_manager(name)
        return mgr.cache()
    except Exception:
        return {}


# ── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/")
async def list_datasets() -> Dict[str, Any]:
    """List all datasets with status and metadata."""
    result = {}
    for name, info in DATASET_INFO.items():
        meta = _get_dataset_meta(name)
        result[name] = {
            **info,
            "status": _get_dataset_status(name),
            "meta": meta,
        }
    return {"datasets": result, "count": len(result)}


@router.get("/status")
async def get_all_status() -> Dict[str, str]:
    """Get download/readiness status for all datasets."""
    return {name: _get_dataset_status(name) for name in DATASET_INFO}


@router.get("/{dataset}/status")
async def get_dataset_status(dataset: str) -> Dict[str, Any]:
    if dataset not in DATASET_INFO:
        raise HTTPException(404, f"Unknown dataset: {dataset}")
    meta = _get_dataset_meta(dataset)
    return {
        "dataset": dataset,
        "status": _get_dataset_status(dataset),
        "info": DATASET_INFO[dataset],
        "meta": meta,
    }


@router.post("/download")
async def download_dataset(req: DownloadRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Trigger dataset download in background (Celery task)."""
    if req.dataset not in DATASET_INFO and req.dataset != "all":
        raise HTTPException(422, f"Unknown dataset: {req.dataset}")
    try:
        from app.tasks.dataset_tasks import download_dataset as _task, download_all_datasets
        if req.dataset == "all":
            task = download_all_datasets.delay(force=req.force)
        else:
            task = _task.delay(req.dataset, force=req.force)
        return {"task_id": task.id, "status": "queued", "dataset": req.dataset}
    except Exception as e:
        # Celery not running — run synchronously in background thread
        import threading
        from ai.datasets.registry import run_pipeline
        result_holder: Dict = {}

        def _run():
            try:
                result_holder["result"] = run_pipeline(req.dataset, force=req.force)
            except Exception as ex:
                result_holder["error"] = str(ex)

        t = threading.Thread(target=_run, daemon=True)
        t.start()
        return {"task_id": "sync", "status": "started", "dataset": req.dataset,
                "note": "Running synchronously (Celery not available)"}


@router.post("/download/all")
async def download_all() -> Dict[str, Any]:
    """Trigger download of all datasets."""
    try:
        from app.tasks.dataset_tasks import download_all_datasets
        task = download_all_datasets.delay()
        return {"task_id": task.id, "status": "queued"}
    except Exception:
        return {"status": "started", "note": "Celery unavailable — use individual /download endpoints"}


@router.post("/eda")
async def run_eda(req: EDARequest) -> Dict[str, Any]:
    """Trigger EDA for a dataset (Celery task)."""
    if req.dataset not in DATASET_INFO and req.dataset != "all":
        raise HTTPException(422, f"Unknown dataset: {req.dataset}")
    try:
        from app.tasks.dataset_tasks import run_eda as _task, run_all_eda
        if req.dataset == "all":
            task = run_all_eda.delay()
        else:
            task = _task.delay(req.dataset)
        return {"task_id": task.id, "status": "queued", "dataset": req.dataset}
    except Exception:
        # Synchronous fallback
        import threading
        from ai.eda.pipeline import EDA_RUNNERS

        def _run():
            runner = EDA_RUNNERS.get(req.dataset)
            if runner:
                runner()

        t = threading.Thread(target=_run, daemon=True)
        t.start()
        return {"task_id": "sync", "status": "started", "dataset": req.dataset}


@router.post("/preprocess")
async def preprocess(req: PreprocessRequest) -> Dict[str, Any]:
    """Trigger preprocessing for a dataset."""
    try:
        from app.tasks.dataset_tasks import preprocess_dataset
        task = preprocess_dataset.delay(req.dataset)
        return {"task_id": task.id, "status": "queued", "dataset": req.dataset}
    except Exception:
        import threading
        from ai.preprocessing.pipeline import run_preprocessing

        def _run():
            run_preprocessing(req.dataset)

        t = threading.Thread(target=_run, daemon=True)
        t.start()
        return {"task_id": "sync", "status": "started", "dataset": req.dataset}


@router.get("/statistics/{dataset}")
async def get_statistics(dataset: str) -> Dict[str, Any]:
    """Return EDA statistics for a dataset."""
    eda_dir = EDA_ROOT / dataset
    report_file = eda_dir / "EDA_Report.json"
    if not report_file.exists():
        # Generate on-the-fly
        try:
            from ai.eda.pipeline import EDA_RUNNERS
            runner = EDA_RUNNERS.get(dataset)
            if runner is None:
                raise HTTPException(404, f"No EDA runner for {dataset}")
            result = runner()
            return {"dataset": dataset, "report": result}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, f"EDA failed: {e}")
    return {"dataset": dataset, "report": json.loads(report_file.read_text())}


@router.get("/reports/{dataset}/html", response_class=HTMLResponse)
async def get_html_report(dataset: str) -> str:
    """Serve HTML EDA report for a dataset."""
    report_file = EDA_ROOT / dataset / "EDA_Report.html"
    if not report_file.exists():
        raise HTTPException(404, f"HTML report not found for {dataset}. Run EDA first.")
    return report_file.read_text(encoding="utf-8")


@router.get("/reports/{dataset}/json")
async def get_json_report(dataset: str) -> Dict[str, Any]:
    report_file = EDA_ROOT / dataset / "EDA_Report.json"
    if not report_file.exists():
        raise HTTPException(404, f"JSON report not found for {dataset}. Run EDA first.")
    return json.loads(report_file.read_text())


@router.get("/reports/{dataset}/csv")
async def download_csv_report(dataset: str) -> FileResponse:
    csv_file = EDA_ROOT / dataset / "Statistics.csv"
    if not csv_file.exists():
        raise HTTPException(404, f"CSV not found for {dataset}. Run EDA first.")
    return FileResponse(str(csv_file), media_type="text/csv",
                        filename=f"{dataset}_statistics.csv")


@router.get("/reports/summary")
async def get_summary() -> Dict[str, Any]:
    summary_file = REPORTS_ROOT / "Summary.json"
    if not summary_file.exists():
        return {"message": "No summary yet. Run /eda with dataset=all first."}
    return json.loads(summary_file.read_text())


@router.get("/task/{task_id}")
async def get_task_status(task_id: str) -> Dict[str, Any]:
    """Poll Celery task progress."""
    if task_id == "sync":
        return {"task_id": task_id, "status": "RUNNING", "pct": 50}
    try:
        from app.celery_app import celery_app
        result = celery_app.AsyncResult(task_id)
        response: Dict[str, Any] = {"task_id": task_id, "status": result.status}
        if result.status == "PROGRESS" and isinstance(result.info, dict):
            response.update(result.info)
        elif result.ready():
            response["result"] = result.get() if result.successful() else str(result.info)
        return response
    except Exception as e:
        return {"task_id": task_id, "status": "UNKNOWN", "error": str(e)}


@router.get("/plots/{dataset}/{filename}")
async def get_plot(dataset: str, filename: str) -> FileResponse:
    """Serve a plot PNG."""
    plot_file = EDA_ROOT / dataset / "plots" / filename
    if not plot_file.exists():
        raise HTTPException(404, f"Plot not found: {filename}")
    return FileResponse(str(plot_file), media_type="image/png")
