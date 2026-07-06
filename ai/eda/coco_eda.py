"""
PANOPTICON COCO 2017 EDA
Complete exploratory data analysis for COCO object detection dataset.
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from .base_eda import (
    BaseEDA, PALETTE, COLORS,
    bar_chart, histogram, pie_chart, heatmap_chart, scatter_plot, boxplot_chart,
    savefig,
)

logger = logging.getLogger("panopticon.eda.coco")


class COCOEDA(BaseEDA):
    dataset_name = "coco"

    def __init__(
        self,
        dataset_root: Path,
        output_dir: Path,
        split: str = "val",
        max_samples: int = 50_000,
    ):
        super().__init__(output_dir)
        self.dataset_root = dataset_root
        self.split = split
        self.max_samples = max_samples

    def run(self) -> Dict[str, Any]:
        self.logger.info("Running COCO EDA…")
        data = self._load_annotations()
        if data is None:
            return self._synthetic_eda()

        images   = data.get("images", [])
        anns     = data.get("annotations", [])
        cats     = {c["id"]: c["name"] for c in data.get("categories", [])}
        sup_cats = {c["id"]: c.get("supercategory", "other") for c in data.get("categories", [])}

        if len(anns) > self.max_samples:
            anns = anns[:self.max_samples]

        # ── 1. Overview ────────────────────────────────────────────────────
        overview = {
            "total_images":       len(images),
            "total_annotations":  len(anns),
            "num_categories":     len(cats),
            "avg_objects_per_image": round(len(anns) / max(len(images), 1), 2),
        }
        self.report["sections"]["overview"] = overview

        # ── 2. Category frequency ──────────────────────────────────────────
        cat_counts: Dict[str, int] = defaultdict(int)
        for ann in anns:
            cat_counts[cats.get(ann["category_id"], "unknown")] += 1

        sorted_cats = sorted(cat_counts.items(), key=lambda x: -x[1])
        bar_chart(
            [k for k, _ in sorted_cats],
            [v for _, v in sorted_cats],
            "COCO — Object Category Frequency",
            "Category", "Count",
            self._plot("01_category_frequency"),
            horizontal=True,
        )
        pie_chart(
            [k for k, _ in sorted_cats],
            [v for _, v in sorted_cats],
            "COCO — Category Distribution",
            self._plot("02_category_pie"),
            top_n=15,
        )
        self.report["sections"]["category_frequency"] = dict(sorted_cats[:20])

        # ── 3. Bounding box analysis ───────────────────────────────────────
        widths, heights, areas, aspect_ratios = [], [], [], []
        img_ann_count: Dict[int, int] = defaultdict(int)

        for ann in anns:
            if "bbox" not in ann:
                continue
            x, y, w, h = ann["bbox"]
            widths.append(w)
            heights.append(h)
            areas.append(w * h)
            if h > 0:
                aspect_ratios.append(w / h)
            img_ann_count[ann["image_id"]] += 1

        histogram(widths, "COCO — BBox Width Distribution", "Width (px)", "Count",
                  self._plot("03_bbox_width"), bins=60)
        histogram(heights, "COCO — BBox Height Distribution", "Height (px)", "Count",
                  self._plot("04_bbox_height"), bins=60)
        histogram(areas, "COCO — BBox Area Distribution", "Area (px²)", "Count",
                  self._plot("05_bbox_area"), bins=80, log_scale=True)
        histogram(aspect_ratios, "COCO — BBox Aspect Ratio Distribution",
                  "Width/Height", "Count", self._plot("06_aspect_ratio"), bins=60)

        self.report["sections"]["bbox_stats"] = {
            "mean_width":     round(float(np.mean(widths)), 2),
            "mean_height":    round(float(np.mean(heights)), 2),
            "mean_area":      round(float(np.mean(areas)), 2),
            "median_area":    round(float(np.median(areas)), 2),
        }

        # ── 4. Objects per image ───────────────────────────────────────────
        obj_counts = list(img_ann_count.values())
        histogram(obj_counts, "COCO — Objects per Image",
                  "Objects", "Images", self._plot("07_objects_per_image"), bins=40)

        # ── 5. Image resolution ────────────────────────────────────────────
        widths_img = [img["width"] for img in images if "width" in img]
        heights_img = [img["height"] for img in images if "height" in img]
        if widths_img:
            scatter_plot(widths_img, heights_img,
                         "COCO — Image Resolution Distribution",
                         "Width (px)", "Height (px)",
                         self._plot("08_resolution_scatter"))

        # ── 6. Supercategory distribution ──────────────────────────────────
        sup_counts: Dict[str, int] = defaultdict(int)
        for ann in anns:
            sup = sup_cats.get(ann["category_id"], "other")
            sup_counts[sup] += 1
        bar_chart(
            list(sup_counts.keys()), list(sup_counts.values()),
            "COCO — Supercategory Distribution",
            "Supercategory", "Count",
            self._plot("09_supercategory"),
        )

        # ── 7. Class imbalance (top vs bottom) ────────────────────────────
        all_counts = [v for _, v in sorted_cats]
        if all_counts:
            imbalance_ratio = round(all_counts[0] / max(all_counts[-1], 1), 1)
            self.report["sections"]["class_imbalance"] = {
                "most_common":      sorted_cats[0][0],
                "most_common_count": sorted_cats[0][1],
                "least_common":     sorted_cats[-1][0],
                "least_common_count": sorted_cats[-1][1],
                "imbalance_ratio":  imbalance_ratio,
            }

        # ── 8. CSV export ──────────────────────────────────────────────────
        self.csv_rows = [
            {"category": k, "count": v, "pct": round(v / max(sum(cat_counts.values()), 1) * 100, 2)}
            for k, v in sorted_cats
        ]

        self.export()
        self.logger.info("COCO EDA complete")
        return self.report

    def _load_annotations(self) -> Optional[Dict]:
        ann_file = self.dataset_root / "annotations" / f"instances_{self.split}2017.json"
        if not ann_file.exists():
            logger.warning(f"COCO annotations not found at {ann_file}")
            return None
        logger.info(f"Loading {ann_file.name}…")
        with open(ann_file) as f:
            return json.load(f)

    def _synthetic_eda(self) -> Dict[str, Any]:
        """Generate EDA from synthetic data when real dataset is unavailable."""
        self.logger.info("Running COCO EDA with synthetic data (dataset not downloaded)")
        import random
        random.seed(42)

        COCO_CATS = [
            "person","bicycle","car","motorcycle","airplane","bus","train","truck","boat",
            "traffic light","fire hydrant","stop sign","parking meter","bench","bird","cat","dog",
            "horse","sheep","cow","elephant","bear","zebra","giraffe","backpack","umbrella",
            "handbag","tie","suitcase","frisbee","skis","snowboard","sports ball","kite",
            "baseball bat","baseball glove","skateboard","surfboard","tennis racket","bottle",
            "wine glass","cup","fork","knife","spoon","bowl","banana","apple","sandwich",
            "orange","broccoli","carrot","hot dog","pizza","donut","cake","chair","couch",
            "potted plant","bed","dining table","toilet","tv","laptop","mouse","remote",
            "keyboard","cell phone","microwave","oven","toaster","sink","refrigerator","book",
            "clock","vase","scissors","teddy bear","hair drier","toothbrush",
        ]
        cat_counts = {c: int(random.expovariate(0.05)) + 10 for c in COCO_CATS}
        cat_counts["person"] = 262465

        sorted_cats = sorted(cat_counts.items(), key=lambda x: -x[1])
        bar_chart([k for k,_ in sorted_cats], [v for _,v in sorted_cats],
                  "COCO 2017 — Category Frequency (Synthetic)",
                  "Category", "Count", self._plot("01_category_frequency"), horizontal=True)
        pie_chart([k for k,_ in sorted_cats], [v for _,v in sorted_cats],
                  "COCO — Category Distribution", self._plot("02_category_pie"), top_n=15)

        widths  = [random.gauss(120, 80) for _ in range(20000)]
        heights = [random.gauss(140, 90) for _ in range(20000)]
        areas   = [max(10, w * h) for w, h in zip(widths, heights)]
        histogram(widths, "COCO — BBox Width", "Width (px)", "Count",
                  self._plot("03_bbox_width"), bins=60)
        histogram(heights, "COCO — BBox Height", "Height (px)", "Count",
                  self._plot("04_bbox_height"), bins=60)
        histogram(areas, "COCO — BBox Area", "Area (px²)", "Count",
                  self._plot("05_bbox_area"), bins=80, log_scale=True)

        img_widths  = [random.choice([640, 480, 1280, 1920]) for _ in range(5000)]
        img_heights = [random.choice([480, 360, 720, 1080]) for _ in range(5000)]
        scatter_plot(img_widths, img_heights, "COCO — Image Resolution",
                     "Width", "Height", self._plot("08_resolution_scatter"))

        obj_counts = [max(1, int(random.expovariate(0.15))) for _ in range(5000)]
        histogram(obj_counts, "COCO — Objects per Image", "Objects", "Images",
                  self._plot("07_objects_per_image"), bins=30)

        self.report["sections"]["overview"] = {
            "total_images": 118287, "total_annotations": 860001,
            "num_categories": 80, "avg_objects_per_image": 7.3,
            "note": "Synthetic statistics — real dataset not downloaded",
        }
        self.report["sections"]["category_frequency"] = dict(sorted_cats[:20])
        self.csv_rows = [{"category": k, "count": v} for k, v in sorted_cats]
        self.export()
        return self.report
