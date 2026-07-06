"""
PANOPTICON COCO 2017 Dataset Manager
Automatic download, verification, extraction and preparation.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .base import BaseDatasetManager, extract_archive

logger = logging.getLogger("panopticon.datasets.coco")

# Official COCO 2017 URLs
COCO_URLS = {
    "train_images":    "http://images.cocodataset.org/zips/train2017.zip",
    "val_images":      "http://images.cocodataset.org/zips/val2017.zip",
    "test_images":     "http://images.cocodataset.org/zips/test2017.zip",
    "annotations":     "http://images.cocodataset.org/annotations/annotations_trainval2017.zip",
    "stuff_anns":      "http://images.cocodataset.org/annotations/stuff_annotations_trainval2017.zip",
    "panoptic_anns":   "http://images.cocodataset.org/annotations/panoptic_annotations_trainval2017.zip",
}

# Minimal required files for validation (annotations only — images optional for EDA)
REQUIRED_ANNOTATIONS = [
    "annotations/instances_train2017.json",
    "annotations/instances_val2017.json",
    "annotations/captions_train2017.json",
    "annotations/person_keypoints_train2017.json",
]


class COCODatasetManager(BaseDatasetManager):
    """
    Downloads and prepares the COCO 2017 dataset.

    Minimal mode (annotations only, ~1GB) — sufficient for EDA and model training metadata.
    Full mode also downloads images (~25GB).
    """

    name = "coco"
    version = "2017"
    expected_size_gb = 1.2  # annotations only

    def __init__(
        self,
        root: Optional[Path] = None,
        include_images: bool = False,
        splits: List[str] = None,
        **kwargs,
    ):
        super().__init__(root, **kwargs)
        self.include_images = include_images
        self.splits = splits or ["val"]  # default: val only (saves bandwidth)
        self._instances: Dict[str, Any] = {}

    def _do_download(self) -> None:
        logger.info("Downloading COCO 2017 annotations…")
        ann_zip = self._dl(COCO_URLS["annotations"], "annotations_trainval2017.zip")

        if self.include_images:
            for split in self.splits:
                key = f"{split}_images"
                if key in COCO_URLS:
                    logger.info(f"Downloading COCO {split} images…")
                    self._dl(COCO_URLS[key], f"{split}2017.zip")

    def _do_extract(self) -> None:
        ann_zip = self.root / "annotations_trainval2017.zip"
        if ann_zip.exists():
            extract_archive(ann_zip, self.root)

        if self.include_images:
            for split in self.splits:
                img_zip = self.root / f"{split}2017.zip"
                if img_zip.exists():
                    extract_archive(img_zip, self.root)

    def _do_prepare(self) -> None:
        """Build an index of all annotations for fast access."""
        ann_file = self.root / "annotations" / "instances_val2017.json"
        if not ann_file.exists():
            logger.warning("COCO annotations not found — skipping prepare")
            return

        logger.info("Loading COCO instances_val2017.json…")
        with open(ann_file) as f:
            data = json.load(f)

        # Build category index
        cats = {c["id"]: c["name"] for c in data.get("categories", [])}
        num_images = len(data.get("images", []))
        num_anns = len(data.get("annotations", []))

        # Build category count index
        cat_counts: Dict[str, int] = {}
        for ann in data.get("annotations", []):
            name = cats.get(ann["category_id"], "unknown")
            cat_counts[name] = cat_counts.get(name, 0) + 1

        index = {
            "categories": cats,
            "category_counts": cat_counts,
            "num_images": num_images,
            "num_annotations": num_anns,
        }
        index_path = self.root / "index.json"
        index_path.write_text(json.dumps(index, indent=2))
        logger.info(f"COCO index built: {num_images} images, {num_anns} annotations, {len(cats)} categories")

        self._save_meta(num_samples=num_images, extra={
            "num_annotations": num_anns,
            "num_categories": len(cats),
            "top_categories": dict(sorted(cat_counts.items(), key=lambda x: -x[1])[:10]),
        })

    def _verify_files(self) -> bool:
        ann_dir = self.root / "annotations"
        if not ann_dir.exists():
            return False
        required = ["instances_val2017.json", "instances_train2017.json"]
        return all((ann_dir / f).exists() for f in required)

    def _is_ready(self) -> bool:
        return self._verify_files()

    def load_instances(self, split: str = "val") -> Dict[str, Any]:
        """Load and return COCO instances annotation dict."""
        path = self.root / "annotations" / f"instances_{split}2017.json"
        if not path.exists():
            raise FileNotFoundError(f"COCO annotations not found: {path}")
        with open(path) as f:
            return json.load(f)

    def get_category_stats(self) -> Dict[str, int]:
        index = self.root / "index.json"
        if index.exists():
            return json.loads(index.read_text()).get("category_counts", {})
        return {}
