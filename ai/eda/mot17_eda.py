"""
PANOPTICON MOT17 EDA
Complete exploratory data analysis for MOT17 multi-object tracking dataset.
"""

from __future__ import annotations

import configparser
import json
import logging
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import pandas as pd

from .base_eda import (
    BaseEDA, PALETTE, COLORS,
    bar_chart, histogram, pie_chart, scatter_plot, boxplot_chart,
    savefig,
)

logger = logging.getLogger("panopticon.eda.mot17")


class MOT17EDA(BaseEDA):
    dataset_name = "mot17"

    def __init__(self, dataset_root: Path, output_dir: Path):
        super().__init__(output_dir)
        self.dataset_root = dataset_root

    def run(self) -> Dict[str, Any]:
        self.logger.info("Running MOT17 EDA…")

        index_file = self.dataset_root / "index.json"
        if index_file.exists():
            index = json.loads(index_file.read_text())
            seq_stats = index.get("sequences", {})
        else:
            seq_stats = self._parse_sequences()

        if not seq_stats:
            return self._synthetic_eda()

        # ── 1. Overview ────────────────────────────────────────────────────
        total_seqs = len(seq_stats)
        total_frames = sum(s.get("seq_length", s.get("num_frames", 0)) for s in seq_stats.values())
        total_tracks = sum(s.get("num_tracks", 0) for s in seq_stats.values())

        overview = {
            "num_sequences":  total_seqs,
            "total_frames":   total_frames,
            "total_tracks":   total_tracks,
            "avg_fps":        round(np.mean([s.get("fps", 30) for s in seq_stats.values()]), 1),
        }
        self.report["sections"]["overview"] = overview

        # ── 2. Frames per sequence ─────────────────────────────────────────
        seq_names = list(seq_stats.keys())
        frame_counts = [seq_stats[s].get("seq_length", seq_stats[s].get("num_frames", 0))
                        for s in seq_names]
        bar_chart(seq_names, frame_counts,
                  "MOT17 — Frames per Sequence", "Sequence", "Frames",
                  self._plot("01_frames_per_sequence"))

        # ── 3. Tracks per sequence ─────────────────────────────────────────
        track_counts = [seq_stats[s].get("num_tracks", 0) for s in seq_names]
        bar_chart(seq_names, track_counts,
                  "MOT17 — Tracks per Sequence", "Sequence", "Tracks",
                  self._plot("02_tracks_per_sequence"), color=PALETTE["warning"])

        # ── 4. Persons per frame (avg) ────────────────────────────────────
        ppf = [seq_stats[s].get("avg_persons_per_frame", 0) for s in seq_names]
        bar_chart(seq_names, ppf,
                  "MOT17 — Average Persons per Frame", "Sequence", "Persons/Frame",
                  self._plot("03_avg_persons_per_frame"), color=PALETTE["success"])

        # ── 5. Track length distribution (from detailed parse if possible) ─
        all_track_lengths = self._collect_track_lengths()
        if all_track_lengths:
            histogram(all_track_lengths, "MOT17 — Track Length Distribution",
                      "Track Length (frames)", "Count",
                      self._plot("04_track_length_hist"), bins=50)
            self.report["sections"]["track_stats"] = {
                "mean_track_length":   round(float(np.mean(all_track_lengths)), 1),
                "median_track_length": round(float(np.median(all_track_lengths)), 1),
                "max_track_length":    int(np.max(all_track_lengths)),
                "min_track_length":    int(np.min(all_track_lengths)),
            }

        # ── 6. FPS distribution ───────────────────────────────────────────
        fps_vals = [seq_stats[s].get("fps", 30) for s in seq_names]
        fps_counts: Dict[float, int] = defaultdict(int)
        for f in fps_vals:
            fps_counts[f] += 1
        bar_chart(
            [str(k) for k in sorted(fps_counts)],
            [fps_counts[k] for k in sorted(fps_counts)],
            "MOT17 — FPS Distribution", "FPS", "Sequences",
            self._plot("05_fps_distribution"), color=PALETTE["purple"],
        )

        # ── 7. Tracking heatmap (trajectory density) ──────────────────────
        self._trajectory_heatmap()

        # ── 8. Max persons per frame ───────────────────────────────────────
        max_ppf = [seq_stats[s].get("max_persons_per_frame", 0) for s in seq_names]
        scatter_plot(frame_counts, max_ppf,
                     "MOT17 — Frames vs Max Persons per Frame",
                     "Total Frames", "Max Persons/Frame",
                     self._plot("07_frames_vs_max_persons"))

        self.csv_rows = [
            {
                "sequence": s,
                "frames": seq_stats[s].get("seq_length", 0),
                "tracks": seq_stats[s].get("num_tracks", 0),
                "avg_ppf": round(seq_stats[s].get("avg_persons_per_frame", 0), 2),
                "fps": seq_stats[s].get("fps", 30),
            }
            for s in seq_names
        ]
        self.export()
        self.logger.info("MOT17 EDA complete")
        return self.report

    def _parse_sequences(self) -> Dict[str, Any]:
        """Parse sequence data directly from filesystem."""
        seq_stats = {}
        mot_root = self._find_mot_root()
        if mot_root is None:
            return {}
        for seq_dir in sorted(mot_root.iterdir()):
            if not seq_dir.is_dir():
                continue
            gt = seq_dir / "gt" / "gt.txt"
            seqinfo = seq_dir / "seqinfo.ini"
            stat: Dict[str, Any] = {"name": seq_dir.name}
            if seqinfo.exists():
                cfg = configparser.ConfigParser()
                cfg.read(seqinfo)
                if "Sequence" in cfg:
                    stat["fps"] = float(cfg["Sequence"].get("frameRate", 30))
                    stat["seq_length"] = int(cfg["Sequence"].get("seqLength", 0))
            if gt.exists():
                tids, ppf = set(), defaultdict(int)
                with open(gt) as f:
                    for line in f:
                        p = line.strip().split(",")
                        if len(p) < 8: continue
                        if int(p[7]) != 1: continue
                        tids.add(int(p[1]))
                        ppf[int(p[0])] += 1
                stat["num_tracks"] = len(tids)
                stat["avg_persons_per_frame"] = sum(ppf.values()) / max(len(ppf), 1)
                stat["max_persons_per_frame"] = max(ppf.values(), default=0)
            seq_stats[seq_dir.name] = stat
        return seq_stats

    def _find_mot_root(self) -> Optional[Path]:
        for candidate in [self.dataset_root, self.dataset_root / "MOT17",
                          self.dataset_root / "MOT17" / "train"]:
            if candidate.exists() and any(
                d.name.startswith("MOT17-") for d in candidate.iterdir() if d.is_dir()
            ):
                return candidate
        return None

    def _collect_track_lengths(self) -> List[int]:
        mot_root = self._find_mot_root()
        if mot_root is None:
            return []
        lengths = []
        for seq_dir in mot_root.iterdir():
            gt = seq_dir / "gt" / "gt.txt"
            if not gt.exists():
                continue
            track_frames: Dict[int, int] = defaultdict(int)
            with open(gt) as f:
                for line in f:
                    p = line.strip().split(",")
                    if len(p) >= 8 and int(p[7]) == 1:
                        track_frames[int(p[1])] += 1
            lengths.extend(track_frames.values())
        return lengths

    def _trajectory_heatmap(self) -> None:
        """Generate a 2D heatmap of pedestrian trajectories across all sequences."""
        mot_root = self._find_mot_root()
        if mot_root is None:
            return

        # Accumulate normalised foot positions
        heat = np.zeros((100, 100), dtype=np.float32)
        for seq_dir in mot_root.iterdir():
            gt = seq_dir / "gt" / "gt.txt"
            seqinfo = seq_dir / "seqinfo.ini"
            if not gt.exists():
                continue
            W, H = 1920, 1080
            if seqinfo.exists():
                cfg = configparser.ConfigParser()
                cfg.read(seqinfo)
                if "Sequence" in cfg:
                    W = int(cfg["Sequence"].get("imWidth", 1920))
                    H = int(cfg["Sequence"].get("imHeight", 1080))
            with open(gt) as f:
                for line in f:
                    p = line.strip().split(",")
                    if len(p) < 8 or int(p[7]) != 1:
                        continue
                    x, y, w, h = float(p[2]), float(p[3]), float(p[4]), float(p[5])
                    cx = (x + w / 2) / W
                    cy = (y + h) / H
                    ix = min(int(cx * 99), 99)
                    iy = min(int(cy * 99), 99)
                    heat[iy, ix] += 1

        if heat.max() > 0:
            heat = heat / heat.max()
        fig, ax = plt.subplots(figsize=(10, 7))
        im = ax.imshow(heat, cmap="plasma", interpolation="bilinear", aspect="auto",
                       origin="upper", vmin=0, vmax=1)
        fig.colorbar(im, ax=ax, label="Normalised pedestrian density")
        ax.set_title("MOT17 — Trajectory Heatmap (all sequences)", fontsize=14, fontweight="bold")
        ax.set_xlabel("Normalised X position")
        ax.set_ylabel("Normalised Y position")
        ax.axis("off")
        savefig(fig, self._plot("06_trajectory_heatmap"))

    def _synthetic_eda(self) -> Dict[str, Any]:
        self.logger.info("Running MOT17 EDA with synthetic data")
        import random
        random.seed(7)

        seqs = [f"MOT17-{i:02d}-FRCNN" for i in [1,2,3,4,5,6,7,8,9,10,11,12,13,14]]
        frames = [random.randint(300, 1500) for _ in seqs]
        tracks = [random.randint(4, 45) for _ in seqs]
        ppf    = [random.uniform(3, 22) for _ in seqs]

        bar_chart(seqs, frames, "MOT17 — Frames per Sequence (Synthetic)", "Sequence", "Frames",
                  self._plot("01_frames_per_sequence"))
        bar_chart(seqs, tracks, "MOT17 — Tracks per Sequence", "Sequence", "Tracks",
                  self._plot("02_tracks_per_sequence"), color=PALETTE["warning"])
        bar_chart(seqs, ppf, "MOT17 — Avg Persons/Frame", "Sequence", "Persons/Frame",
                  self._plot("03_avg_persons_per_frame"), color=PALETTE["success"])

        track_lengths = [max(5, int(random.expovariate(0.01))) for _ in range(500)]
        histogram(track_lengths, "MOT17 — Track Length Distribution",
                  "Frames", "Count", self._plot("04_track_length_hist"), bins=50)

        # Synthetic heatmap
        x = np.concatenate([
            np.random.normal(0.3, 0.15, 3000),
            np.random.normal(0.7, 0.12, 2500),
            np.random.uniform(0, 1, 500),
        ])
        y = np.concatenate([
            np.random.normal(0.7, 0.2, 3000),
            np.random.normal(0.6, 0.18, 2500),
            np.random.uniform(0, 1, 500),
        ])
        heat, _, _ = np.histogram2d(
            np.clip(y, 0, 0.999), np.clip(x, 0, 0.999),
            bins=100, range=[[0, 1], [0, 1]]
        )
        heat = heat / heat.max()
        fig, ax = plt.subplots(figsize=(10, 7))
        im = ax.imshow(heat, cmap="plasma", interpolation="bilinear", aspect="auto")
        fig.colorbar(im, ax=ax, label="Normalised density")
        ax.set_title("MOT17 — Trajectory Heatmap (Synthetic)", fontsize=14, fontweight="bold")
        ax.axis("off")
        savefig(fig, self._plot("06_trajectory_heatmap"))

        self.report["sections"]["overview"] = {
            "num_sequences": 14, "total_frames": sum(frames),
            "total_tracks": sum(tracks),
            "note": "Synthetic statistics — dataset not downloaded",
        }
        self.csv_rows = [{"sequence": s, "frames": f, "tracks": t}
                         for s, f, t in zip(seqs, frames, tracks)]
        self.export()
        return self.report
