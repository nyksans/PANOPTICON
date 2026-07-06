"""
PANOPTICON Market-1501 Dataset Manager
Automatic download, verification, extraction and preparation.
"""

from __future__ import annotations

import json
import logging
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .base import BaseDatasetManager, extract_archive

logger = logging.getLogger("panopticon.datasets.market1501")

# Google Drive direct download (official source)
MARKET1501_GDRIVE_ID = "0B8-rUzbwVRk0c054eEozWG9COHM"
MARKET1501_GDRIVE_URL = f"https://drive.usercontent.google.com/download?id={MARKET1501_GDRIVE_ID}&export=download&confirm=t"

# Kaggle mirror (fallback)
MARKET1501_KAGGLE = "zhunzhong007/market-1501"

REQUIRED_DIRS = [
    "bounding_box_train",
    "bounding_box_test",
    "query",
]

# Filename regex: 0001_c1s1_000151_01.jpg
# groups: pid, cam_id, seq_id, frame_id
IMG_PATTERN = re.compile(r"^(\d{4})_c(\d+)s(\d+)_(\d+)_(\d+)\.jpg$")


class Market1501DatasetManager(BaseDatasetManager):
    """
    Downloads and prepares the Market-1501 Re-ID dataset.
    1,501 pedestrian identities across 6 cameras.
    """

    name = "market1501"
    version = "1.0"
    expected_size_gb = 0.6

    def __init__(self, root: Optional[Path] = None, **kwargs):
        super().__init__(root, **kwargs)

    def _do_download(self) -> None:
        logger.info("Downloading Market-1501 (~531MB)…")
        try:
            self._dl(MARKET1501_GDRIVE_URL, "Market-1501.zip")
        except Exception as e:
            logger.warning(f"GDrive download failed ({e}), trying Kaggle API…")
            self._try_kaggle()

    def _try_kaggle(self) -> None:
        try:
            import kaggle  # type: ignore
            kaggle.api.authenticate()
            kaggle.api.dataset_download_files(
                MARKET1501_KAGGLE,
                path=str(self.root),
                unzip=True,
            )
            logger.info("Downloaded via Kaggle API")
        except Exception as e:
            logger.error(f"Kaggle download also failed: {e}")
            logger.info("Please set KAGGLE_USERNAME and KAGGLE_KEY env vars, then retry.")

    def _do_extract(self) -> None:
        archive = self._find_archive()
        if archive:
            extract_archive(archive, self.root)
        else:
            logger.info("No archive to extract (may already be extracted)")

    def _find_archive(self) -> Optional[Path]:
        for name in ["Market-1501.zip", "Market-1501-v15.09.15.zip", "market1501.zip"]:
            p = self.root / name
            if p.exists():
                return p
        return None

    def _find_market_root(self) -> Optional[Path]:
        """Market-1501 may be nested inside extracted folder."""
        for candidate in [
            self.root,
            self.root / "Market-1501-v15.09.15",
            self.root / "Market-1501",
            self.root / "market1501",
        ]:
            if candidate.exists() and (candidate / "bounding_box_train").exists():
                return candidate
        return None

    def _do_prepare(self) -> None:
        market_root = self._find_market_root()
        if market_root is None:
            logger.warning("Market-1501 root not found — skipping prepare")
            return

        identity_map: Dict[int, List[Dict]] = defaultdict(list)
        total_images = 0

        for split in ["bounding_box_train", "bounding_box_test", "query"]:
            split_dir = market_root / split
            if not split_dir.exists():
                continue
            for img_file in split_dir.glob("*.jpg"):
                m = IMG_PATTERN.match(img_file.name)
                if not m:
                    continue
                pid = int(m.group(1))
                cam_id = int(m.group(2))
                if pid == -1:  # distractor / junk
                    continue
                identity_map[pid].append({
                    "camera": cam_id,
                    "split": split,
                    "path": str(img_file.relative_to(market_root)),
                })
                total_images += 1

        # Per-identity stats
        identity_stats = {}
        cam_distribution: Dict[int, int] = defaultdict(int)
        cross_cam_count = 0

        for pid, imgs in identity_map.items():
            cameras = set(i["camera"] for i in imgs)
            if len(cameras) > 1:
                cross_cam_count += 1
            for cam in cameras:
                cam_distribution[cam] += 1
            identity_stats[str(pid)] = {
                "num_images": len(imgs),
                "cameras": sorted(cameras),
                "cross_camera": len(cameras) > 1,
            }

        index = {
            "num_identities": len(identity_map),
            "total_images": total_images,
            "cross_camera_identities": cross_cam_count,
            "camera_distribution": dict(cam_distribution),
            "identities": identity_stats,
        }
        (self.root / "index.json").write_text(json.dumps(index, indent=2))
        logger.info(
            f"Market-1501 index: {len(identity_map)} identities, "
            f"{total_images} images, {cross_cam_count} cross-camera"
        )
        self._save_meta(num_samples=total_images, extra={
            "num_identities": len(identity_map),
            "cross_camera_identities": cross_cam_count,
        })

    def _verify_files(self) -> bool:
        root = self._find_market_root()
        if root is None:
            return False
        return all((root / d).exists() for d in REQUIRED_DIRS)

    def _is_ready(self) -> bool:
        return self._verify_files()

    def load_index(self) -> Dict[str, Any]:
        p = self.root / "index.json"
        if p.exists():
            return json.loads(p.read_text())
        return {}

    def iter_images(self, split: str = "bounding_box_test"):
        """Yield (path, pid, camera_id) for each image in a split."""
        root = self._find_market_root()
        if root is None:
            return
        for img_file in (root / split).glob("*.jpg"):
            m = IMG_PATTERN.match(img_file.name)
            if m:
                yield img_file, int(m.group(1)), int(m.group(2))
