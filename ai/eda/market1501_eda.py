"""
PANOPTICON Market-1501 EDA
Complete exploratory data analysis for person re-identification dataset.
"""

from __future__ import annotations

import json
import logging
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from .base_eda import (
    BaseEDA, PALETTE, COLORS,
    bar_chart, histogram, pie_chart, scatter_plot, boxplot_chart,
    heatmap_chart, savefig,
)

logger = logging.getLogger("panopticon.eda.market1501")

IMG_PATTERN = re.compile(r"^(\d{4})_c(\d+)s(\d+)_(\d+)_(\d+)\.jpg$")


class Market1501EDA(BaseEDA):
    dataset_name = "market1501"

    def __init__(self, dataset_root: Path, output_dir: Path):
        super().__init__(output_dir)
        self.dataset_root = dataset_root

    def run(self) -> Dict[str, Any]:
        self.logger.info("Running Market-1501 EDA…")

        index_file = self.dataset_root / "index.json"
        if index_file.exists():
            index = json.loads(index_file.read_text())
            return self._eda_from_index(index)

        market_root = self._find_market_root()
        if market_root:
            return self._eda_from_filesystem(market_root)

        return self._synthetic_eda()

    def _eda_from_index(self, index: Dict) -> Dict[str, Any]:
        num_ids = index.get("num_identities", 0)
        total_imgs = index.get("total_images", 0)
        cross_cam = index.get("cross_camera_identities", 0)
        cam_dist = index.get("camera_distribution", {})
        identities = index.get("identities", {})

        # Overview
        self.report["sections"]["overview"] = {
            "num_identities":           num_ids,
            "total_images":             total_imgs,
            "cross_camera_identities":  cross_cam,
            "num_cameras":              len(cam_dist),
            "avg_images_per_identity":  round(total_imgs / max(num_ids, 1), 2),
        }

        # Images per identity distribution
        img_counts = [v["num_images"] for v in identities.values()]
        histogram(img_counts, "Market-1501 — Images per Identity",
                  "Images", "Identities",
                  self._plot("01_images_per_identity"), bins=40)

        # Camera distribution
        bar_chart(
            [f"Cam {k}" for k in sorted(cam_dist.keys(), key=lambda x: int(x) if str(x).isdigit() else 0)],
            [cam_dist[k] for k in sorted(cam_dist.keys(), key=lambda x: int(x) if str(x).isdigit() else 0)],
            "Market-1501 — Camera Distribution",
            "Camera ID", "Identities",
            self._plot("02_camera_distribution"),
            color=PALETTE["warning"],
        )

        # Cross-camera pie
        pie_chart(
            ["Cross-Camera", "Single-Camera"],
            [cross_cam, num_ids - cross_cam],
            "Market-1501 — Cross-Camera Identity Split",
            self._plot("03_cross_camera_pie"),
        )

        # Identity imbalance
        top_heavy = sorted(identities.items(), key=lambda x: -x[1]["num_images"])[:20]
        bar_chart(
            [f"ID {k}" for k, _ in top_heavy],
            [v["num_images"] for _, v in top_heavy],
            "Market-1501 — Top 20 Most Imaged Identities",
            "Identity", "Images",
            self._plot("04_identity_imbalance"),
            color=PALETTE["danger"],
        )

        # Cameras per identity
        cams_per_id = [len(v.get("cameras", [])) for v in identities.values()]
        histogram(cams_per_id, "Market-1501 — Cameras per Identity",
                  "Number of Cameras", "Identities",
                  self._plot("05_cameras_per_identity"),
                  bins=range(1, max(cams_per_id, default=7) + 2))

        # Cross-camera heatmap (which cameras co-appear)
        self._camera_cooccurrence(identities)

        self.csv_rows = [
            {
                "identity":    k,
                "num_images":  v["num_images"],
                "num_cameras": len(v.get("cameras", [])),
                "cross_camera": v.get("cross_camera", False),
            }
            for k, v in identities.items()
        ]
        self.export()
        return self.report

    def _camera_cooccurrence(self, identities: Dict) -> None:
        """Build 6×6 camera co-occurrence matrix."""
        cams = list(range(1, 7))
        matrix = np.zeros((6, 6), dtype=int)
        for v in identities.values():
            pid_cams = [int(c) - 1 for c in v.get("cameras", []) if 1 <= int(c) <= 6]
            for i in pid_cams:
                for j in pid_cams:
                    if i != j:
                        matrix[i][j] += 1
        heatmap_chart(
            matrix,
            [f"C{c}" for c in cams],
            [f"C{c}" for c in cams],
            "Market-1501 — Camera Co-Occurrence Matrix",
            self._plot("06_camera_cooccurrence"),
            fmt="d",
            cmap="YlOrRd",
        )

    def _eda_from_filesystem(self, market_root: Path) -> Dict[str, Any]:
        """Parse Market-1501 directly from image files."""
        identity_map: Dict[int, Dict] = defaultdict(lambda: {"cameras": set(), "count": 0})
        cam_counts: Dict[int, int] = defaultdict(int)
        total = 0

        for split in ["bounding_box_train", "bounding_box_test", "query"]:
            split_dir = market_root / split
            if not split_dir.exists():
                continue
            for img in split_dir.glob("*.jpg"):
                m = IMG_PATTERN.match(img.name)
                if not m:
                    continue
                pid, cam = int(m.group(1)), int(m.group(2))
                if pid < 0:
                    continue
                identity_map[pid]["cameras"].add(cam)
                identity_map[pid]["count"] += 1
                cam_counts[cam] += 1
                total += 1

        index = {
            "num_identities": len(identity_map),
            "total_images": total,
            "cross_camera_identities": sum(1 for v in identity_map.values() if len(v["cameras"]) > 1),
            "camera_distribution": dict(cam_counts),
            "identities": {
                str(k): {"num_images": v["count"], "cameras": sorted(v["cameras"])}
                for k, v in identity_map.items()
            },
        }
        return self._eda_from_index(index)

    def _find_market_root(self) -> Optional[Path]:
        for c in [self.dataset_root,
                  self.dataset_root / "Market-1501-v15.09.15",
                  self.dataset_root / "Market-1501"]:
            if c.exists() and (c / "bounding_box_train").exists():
                return c
        return None

    def _synthetic_eda(self) -> Dict[str, Any]:
        self.logger.info("Running Market-1501 EDA with synthetic data")
        import random
        random.seed(42)

        num_ids = 1501
        img_counts = [random.randint(4, 30) for _ in range(num_ids)]
        histogram(img_counts, "Market-1501 — Images per Identity (Synthetic)",
                  "Images", "Identities", self._plot("01_images_per_identity"), bins=25)

        cam_dist = {str(i): random.randint(500, 1200) for i in range(1, 7)}
        bar_chart([f"Cam {k}" for k in cam_dist], list(cam_dist.values()),
                  "Market-1501 — Camera Distribution", "Camera", "Identities",
                  self._plot("02_camera_distribution"), color=PALETTE["warning"])

        pie_chart(["Cross-Camera", "Single-Camera"], [1237, 264],
                  "Market-1501 — Cross-Camera Split", self._plot("03_cross_camera_pie"))

        # Synthetic co-occurrence
        matrix = np.random.randint(200, 1000, (6, 6))
        np.fill_diagonal(matrix, 0)
        heatmap_chart(matrix, [f"C{i}" for i in range(1, 7)],
                      [f"C{i}" for i in range(1, 7)],
                      "Market-1501 — Camera Co-Occurrence (Synthetic)",
                      self._plot("06_camera_cooccurrence"), fmt="d", cmap="YlOrRd")

        cams_per_id = [random.randint(1, 6) for _ in range(num_ids)]
        histogram(cams_per_id, "Market-1501 — Cameras per Identity",
                  "Cameras", "Identities", self._plot("05_cameras_per_identity"),
                  bins=range(1, 8))

        self.report["sections"]["overview"] = {
            "num_identities": num_ids, "total_images": 32668,
            "cross_camera_identities": 1237, "num_cameras": 6,
            "avg_images_per_identity": 21.8,
            "note": "Synthetic statistics — dataset not downloaded",
        }
        self.csv_rows = [{"identity_id": i, "num_images": img_counts[i], "cameras_seen": cams_per_id[i]}
                         for i in range(num_ids)]
        self.export()
        return self.report
