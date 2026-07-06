"""
PANOPTICON Tracker — ByteTrack

Multi-object tracking with IoU and appearance matching.
Integrates with person detections for cross-frame identity persistence.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from .base import BaseModel

logger = logging.getLogger("panopticon.models.tracker")


@dataclass
class Track:
    """Tracked object (usually a person)."""
    track_id: int
    class_label: str
    detections: List[Dict[str, Any]] = field(default_factory=list)
    last_detection_frame: int = 0
    appearance_embedding: Optional[np.ndarray] = None
    age: int = 0  # frames since creation
    hits: int = 0  # confirmed detections
    confidence: float = 0.0

    @property
    def is_confirmed(self) -> bool:
        return self.hits >= 3

    @property
    def mean_confidence(self) -> float:
        if not self.detections:
            return 0.0
        confs = [d.get("confidence", 0) for d in self.detections]
        return sum(confs) / len(confs)


def _iou(box1: Dict[str, float], box2: Dict[str, float]) -> float:
    """Compute IoU between two normalized bboxes: {x, y, width, height}."""
    x1_min, y1_min = box1["x"], box1["y"]
    x1_max = x1_min + box1["width"]
    y1_max = y1_min + box1["height"]

    x2_min, y2_min = box2["x"], box2["y"]
    x2_max = x2_min + box2["width"]
    y2_max = y2_min + box2["height"]

    inter_x_min = max(x1_min, x2_min)
    inter_y_min = max(y1_min, y2_min)
    inter_x_max = min(x1_max, x2_max)
    inter_y_max = min(y1_max, y2_max)

    if inter_x_max < inter_x_min or inter_y_max < inter_y_min:
        return 0.0

    inter_area = (inter_x_max - inter_x_min) * (inter_y_max - inter_y_min)
    box1_area = box1["width"] * box1["height"]
    box2_area = box2["width"] * box2["height"]
    union_area = box1_area + box2_area - inter_area

    return inter_area / union_area if union_area > 0 else 0.0


class ByteTracker(BaseModel):
    """
    Simple yet effective multi-object tracker using IoU matching.

    Algorithm
    ---------
    1. Match current detections to existing tracks by IoU
    2. Unmatched detections → new tracks (provisional)
    3. Unmatched tracks → mark for deletion after max_age frames

    Intended for pedestrian tracking in CCTV (MOT17-like scenarios).
    """

    name = "byte_tracker"
    version = "1.0"

    def __init__(
        self,
        iou_threshold: float = 0.3,
        min_hits: int = 3,
        max_age: int = 30,
        device: str = "cpu",
    ):
        super().__init__(device=device)
        self.iou_threshold = iou_threshold
        self.min_hits = min_hits
        self.max_age = max_age
        self.tracks: Dict[int, Track] = {}
        self._next_id = 1
        self.frame_count = 0
        self._loaded = True  # No model to load

    def load(self) -> "ByteTracker":
        self.logger.info(f"ByteTracker initialized (iou_threshold={self.iou_threshold})")
        self._loaded = True
        return self

    def infer(self, detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Update tracker with current frame's detections.
        Returns detections with assigned track_ids.
        """
        self.frame_count += 1

        # Separate persons from other objects
        person_dets = [d for d in detections if d.get("label") == "person"]
        other_dets = [d for d in detections if d.get("label") != "person"]

        # Track persons
        tracked_persons = self._update(person_dets)

        # Other objects are passed through with dummy track_id
        for det in other_dets:
            det["track_id"] = None

        return tracked_persons + other_dets

    def _update(self, detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Hungarian-style matching + track management."""
        # Match detections to existing tracks
        matched_tracks: set[int] = set()
        matched_dets: set[int] = set()

        for track_id, track in list(self.tracks.items()):
            best_det_idx = -1
            best_iou = 0.0
            for det_idx, det in enumerate(detections):
                if det_idx in matched_dets:
                    continue
                iou = _iou(track.detections[-1]["bbox"], det["bbox"])
                if iou > best_iou:
                    best_iou = iou
                    best_det_idx = det_idx

            if best_iou >= self.iou_threshold:
                detections[best_det_idx]["track_id"] = track_id
                track.detections.append(detections[best_det_idx])
                track.hits += 1
                track.last_detection_frame = self.frame_count
                matched_tracks.add(track_id)
                matched_dets.add(best_det_idx)
            else:
                track.age += 1

        # Unmatched detections → new tracks
        for det_idx, det in enumerate(detections):
            if det_idx not in matched_dets:
                track_id = self._next_id
                self._next_id += 1
                det["track_id"] = track_id
                track = Track(
                    track_id=track_id,
                    class_label="person",
                    detections=[det],
                    last_detection_frame=self.frame_count,
                    hits=1,
                )
                self.tracks[track_id] = track
                matched_dets.add(det_idx)

        # Expire old tracks
        for track_id in list(self.tracks.keys()):
            if self.tracks[track_id].age > self.max_age:
                del self.tracks[track_id]

        return detections

    def get_active_tracks(self) -> Dict[int, Track]:
        """Return confirmed tracks only."""
        return {
            tid: t for tid, t in self.tracks.items()
            if t.is_confirmed
        }

    def reset(self) -> None:
        """Clear all tracks."""
        self.tracks.clear()
        self._next_id = 1
        self.frame_count = 0
