"""
PANOPTICON Dataset Registry
Central registry for all dataset managers with Celery task support.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Type

from .base import BaseDatasetManager, DATASETS_ROOT
from .coco_manager import COCODatasetManager
from .mot17_manager import MOT17DatasetManager
from .market1501_manager import Market1501DatasetManager
from .scannet_manager import ScanNetDatasetManager

logger = logging.getLogger("panopticon.datasets.registry")

_REGISTRY: Dict[str, Type[BaseDatasetManager]] = {
    "coco":        COCODatasetManager,
    "mot17":       MOT17DatasetManager,
    "market1501":  Market1501DatasetManager,
    "scannet":     ScanNetDatasetManager,
}


def get_manager(
    name: str,
    progress_callback: Optional[Callable] = None,
    force: bool = False,
    **kwargs,
) -> BaseDatasetManager:
    """Instantiate a dataset manager by name."""
    cls = _REGISTRY.get(name.lower())
    if cls is None:
        raise ValueError(f"Unknown dataset: {name}. Available: {list(_REGISTRY)}")
    return cls(
        root=DATASETS_ROOT / name.lower(),
        progress_callback=progress_callback,
        force_redownload=force,
        **kwargs,
    )


def run_pipeline(
    name: str,
    progress_callback: Optional[Callable] = None,
    force: bool = False,
    **kwargs,
) -> Dict[str, Any]:
    """
    Full pipeline: download → extract → prepare → return status dict.
    Safe to call repeatedly — skips completed steps.
    """
    mgr = get_manager(name, progress_callback=progress_callback, force=force, **kwargs)

    logger.info(f"[{name}] Starting pipeline (status={mgr.status()})")

    mgr.download()
    mgr.extract()
    mgr.prepare()

    meta = mgr.cache()
    status = mgr.status()
    logger.info(f"[{name}] Pipeline complete: {status}")

    return {"name": name, "status": status, "meta": meta}


def status_all() -> Dict[str, str]:
    """Return status of all registered datasets."""
    result = {}
    for name, cls in _REGISTRY.items():
        try:
            mgr = cls(root=DATASETS_ROOT / name)
            result[name] = mgr.status()
        except Exception as e:
            result[name] = f"error: {e}"
    return result


def list_datasets() -> Dict[str, Dict[str, Any]]:
    """Return info dict for all datasets."""
    result = {}
    for name, cls in _REGISTRY.items():
        mgr = cls(root=DATASETS_ROOT / name)
        meta = mgr.cache()
        result[name] = {
            "name": name,
            "status": mgr.status(),
            "version": cls.version,
            "expected_size_gb": cls.expected_size_gb,
            "meta": meta,
        }
    return result
