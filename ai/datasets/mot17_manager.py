"""
PANOPTICON MOT17 Dataset Manager
Automatic download, verification, extraction and preparation.
"""

from __future__ import annotations

import configparser
import json
import logging
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .base import BaseDatasetManager, extract_archive

logger = logging.getLogger("panopticon.datasets.mot17")

# Official MOT Challenge download (requires registration in production)
# Mirror/direct links commonly used in research:
MOT17_URL = "https://motchallenge.net/data/MOT17.zip"

# Fallback: academic mirror
MOT17_MIRROR = "https://drive.usercontent.google.com/download?id=1ET-6w12yHNo8DKevOVgK1dBlYs739e_3&confirm=t"

MOT17_SEQUENCES = [
    "MOT17-01", "MOT17-02", "MOT17-03", "MOT17-04",
    "MOT17-05", "MOT17-06", "MOT17-07", "MOT17-08",
    "MOT17-09", "MOT17-10", "MOT17-11", "MOT17-12",
    "MOT17-13", "MOT17-14",
]
DETECTORS = ["DPM", "FRCNN", "SDP"]


class MOT17DatasetManager(BaseDatasetManager):
    """
    Downloads and prepares the MOT17 dataset.
    Parses ground truth annotations for all 14 sequences × 3 detectors.
    """

    name = "mot17"
    version = "2017"
    expected_size_gb = 5.7

    def __init__(self, root: Optional[Path] = None, **kwargs):
        super().__init__(root, **kwargs)
        self._sequence_stats: Dict[str, Any] = {}

    def _do_download(self) -> None:
        logger.info("Downloading MOT17 dataset (~5.7 GB)…")
        try:
            self._dl(MOT17_URL, "MOT17.zip")
        except Exception as e:
            logger.warning(f"Primary MOT17 URL failed ({e}), trying mirror…")
            self._dl(MOT17_MIRROR, "MOT17.zip")

    def _do_extract(self) -> None:
        archive = self.root / "MOT17.zip"
        if archive.exists():
            extract_archive(archive, self.root)
        else:
            logger.warning("MOT17.zip not found, skipping extraction")

    def _do_prepare(self) -> None:
        """Parse all ground truth files and build a statistics index."""
        mot_root = self._find_mot_root()
        if mot_root is None:
            logger.warning("MOT17 sequences not found — skipping prepare")
            return

        stats: Dict[str, Any] = {}
        total_tracks = 0
        total_frames = 0

        for seq_dir in sorted(mot_root.iterdir()):
            if not seq_dir.is_dir():
                continue
            seq_name = seq_dir.name
            gt_file = seq_dir / "gt" / "gt.txt"
            seqinfo_file = seq_dir / "seqinfo.ini"

            seq_stat: Dict[str, Any] = {"name": seq_name}

            # Parse seqinfo.ini
            if seqinfo_file.exists():
                cfg = configparser.ConfigParser()
                cfg.read(seqinfo_file)
                if "Sequence" in cfg:
                    seq_stat["fps"] = float(cfg["Sequence"].get("frameRate", 30))
                    seq_stat["img_width"] = int(cfg["Sequence"].get("imWidth", 0))
                    seq_stat["img_height"] = int(cfg["Sequence"].get("imHeight", 0))
                    seq_stat["seq_length"] = int(cfg["Sequence"].get("seqLength", 0))
                    total_frames += seq_stat["seq_length"]

            # Parse gt.txt
            if gt_file.exists():
                track_ids = set()
                frames = set()
                persons_per_frame: Dict[int, int] = {}
                track_lengths: Dict[int, int] = {}

                with open(gt_file) as f:
                    for line in f:
                        parts = line.strip().split(",")
                        if len(parts) < 9:
                            continue
                        frame = int(parts[0])
                        tid = int(parts[1])
                        class_id = int(parts[7]) if len(parts) > 7 else 1
                        visibility = float(parts[8]) if len(parts) > 8 else 1.0
                        if class_id != 1 or visibility < 0.25:
                            continue
                        track_ids.add(tid)
                        frames.add(frame)
                        persons_per_frame[frame] = persons_per_frame.get(frame, 0) + 1
                        track_lengths[tid] = track_lengths.get(tid, 0) + 1

                seq_stat["num_tracks"] = len(track_ids)
                seq_stat["num_frames"] = len(frames)
                seq_stat["avg_persons_per_frame"] = (
                    sum(persons_per_frame.values()) / len(persons_per_frame)
                    if persons_per_frame else 0
                )
                seq_stat["avg_track_length"] = (
                    sum(track_lengths.values()) / len(track_lengths)
                    if track_lengths else 0
                )
                seq_stat["max_persons_per_frame"] = max(persons_per_frame.values(), default=0)
                total_tracks += len(track_ids)

            stats[seq_name] = seq_stat

        index = {
            "sequences": stats,
            "total_sequences": len(stats),
            "total_tracks": total_tracks,
            "total_frames": total_frames,
        }
        (self.root / "index.json").write_text(json.dumps(index, indent=2))
        logger.info(f"MOT17 index: {len(stats)} sequences, {total_tracks} tracks, {total_frames} frames")

        self._save_meta(num_samples=total_frames, extra={
            "num_sequences": len(stats),
            "total_tracks": total_tracks,
        })

    def _find_mot_root(self) -> Optional[Path]:
        """Find the folder that actually contains MOT17-XX sequence dirs."""
        for candidate in [self.root, self.root / "MOT17", self.root / "MOT17" / "train"]:
            if candidate.exists() and any(
                d.name.startswith("MOT17-") for d in candidate.iterdir() if d.is_dir()
            ):
                return candidate
        return None

    def _verify_files(self) -> bool:
        mot_root = self._find_mot_root()
        if mot_root is None:
            return False
        # At least 5 sequences should exist
        seq_dirs = [d for d in mot_root.iterdir() if d.is_dir() and d.name.startswith("MOT17-")]
        return len(seq_dirs) >= 5

    def _is_ready(self) -> bool:
        return self._verify_files()

    def load_index(self) -> Dict[str, Any]:
        path = self.root / "index.json"
        if path.exists():
            return json.loads(path.read_text())
        return {}

    def iter_sequences(self):
        """Yield (seq_name, gt_path, seqinfo_path) tuples."""
        mot_root = self._find_mot_root()
        if mot_root is None:
            return
        for seq_dir in sorted(mot_root.iterdir()):
            if seq_dir.is_dir() and seq_dir.name.startswith("MOT17-"):
                yield (
                    seq_dir.name,
                    seq_dir / "gt" / "gt.txt",
                    seq_dir / "seqinfo.ini",
                    seq_dir / "img1",
                )
