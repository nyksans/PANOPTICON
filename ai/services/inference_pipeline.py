"""
PANOPTICON Full Inference Pipeline
Orchestrates all AI models for end-to-end video processing.

Pipeline:
  Video → Frames → Detection → Tracking → Segmentation → ReID → Results
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import cv2
import numpy as np

from ai.models import get_registry
from ai.preprocessing.pipeline import normalize_image, resize_with_padding

logger = logging.getLogger("panopticon.inference")


class InferencePipeline:
    """
    Production-grade inference pipeline.
    - Handles frame extraction and batching
    - Runs all models with proper error handling
    - Generates forensic-grade output JSON
    - Supports both video and image inputs
    """

    def __init__(
        self,
        confidence_threshold: float = 0.45,
        reid_threshold: float = 0.78,
        device: str = "auto",
        batch_size: int = 8,
        frame_skip: int = 1,
    ):
        self.conf_threshold = confidence_threshold
        self.reid_threshold = reid_threshold
        self.device = device
        self.batch_size = batch_size
        self.frame_skip = frame_skip
        self.registry = get_registry(device=device)
        self.logger = logging.getLogger("panopticon.inference")

    def startup(self, skip_models: Optional[list[str]] = None) -> Dict[str, bool]:
        """Initialize all models."""
        return self.registry.startup(skip_models=skip_models)

    def process_video(
        self,
        video_path: str,
        output_dir: Optional[str] = None,
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> Dict[str, Any]:
        """
        Process a video file end-to-end.

        Returns structured forensic results:
          {
            "video_path": str,
            "duration": float,
            "fps": float,
            "resolution": [width, height],
            "total_frames": int,
            "processed_frames": int,
            "detections": list,
            "persons": list,
            "events": list,
            "timeline": list,
            "confidence": float,
            "models_used": list,
            "processing_time": float,
          }
        """
        import time
        start_time = time.time()

        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video not found: {video_path}")

        if output_dir is None:
            output_dir = os.path.join("./storage/processing", Path(video_path).stem)
        os.makedirs(output_dir, exist_ok=True)

        # ── Extract video metadata ───────────────────────────────────────────
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0

        self.logger.info(
            f"Processing: {Path(video_path).name}\n"
            f"  Resolution: {width}×{height}\n"
            f"  FPS: {fps}\n"
            f"  Duration: {duration:.1f}s ({total_frames} frames)"
        )

        # ── Extract frames in batches ────────────────────────────────────────
        frames_dir = os.path.join(output_dir, "frames")
        os.makedirs(frames_dir, exist_ok=True)

        frames_list: List[np.ndarray] = []
        frame_metadata: List[Dict[str, Any]] = []
        frame_count = 0
        extracted_count = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_count % self.frame_skip == 0:
                frames_list.append(frame)
                timestamp = frame_count / fps
                frame_metadata.append({
                    "frame_number": frame_count,
                    "timestamp": timestamp,
                    "path": os.path.join(frames_dir, f"frame_{extracted_count:06d}.jpg"),
                })
                extracted_count += 1

                if progress_callback:
                    pct = int(frame_count / total_frames * 30)
                    progress_callback(pct, f"Extracting frames ({extracted_count})")

            frame_count += 1

        cap.release()

        self.logger.info(f"Extracted {extracted_count} frames")

        # Save frame samples
        for i, (frame, meta) in enumerate(zip(frames_list[::10], frame_metadata[::10])):
            cv2.imwrite(meta["path"], frame, [cv2.IMWRITE_JPEG_QUALITY, 85])

        # ── Batch inference ──────────────────────────────────────────────────
        all_detections: List[List[Dict]] = []
        all_masks: List[List[Dict]] = []
        person_crops: List[np.ndarray] = []
        person_crop_info: List[Dict[str, Any]] = []

        for batch_idx in range(0, len(frames_list), self.batch_size):
            batch_end = min(batch_idx + self.batch_size, len(frames_list))
            batch_frames = frames_list[batch_idx:batch_end]
            batch_meta = frame_metadata[batch_idx:batch_end]

            if progress_callback:
                pct = 30 + int(batch_idx / len(frames_list) * 50)
                progress_callback(pct, "Running inference…")

            # Detection
            batch_dets = self.registry.detector.infer(batch_frames) if self.registry.detector else [[]]
            all_detections.extend(batch_dets)

            # Tracking
            if self.registry.tracker:
                for frame_dets in batch_dets:
                    self.registry.tracker.infer(frame_dets)

            # Segmentation
            if self.registry.segmentor:
                for frame, frame_dets in zip(batch_frames, batch_dets):
                    masks = self.registry.segmentor.infer(frame, frame_dets)
                    all_masks.append(masks)

            # Collect person crops for ReID
            for frame, frame_dets, meta in zip(batch_frames, batch_dets, batch_meta):
                for det in frame_dets:
                    if det.get("label") == "person":
                        h, w = frame.shape[:2]
                        b = det["bbox"]
                        x1 = max(0, int(b["x"] * w))
                        y1 = max(0, int(b["y"] * h))
                        x2 = min(w, int((b["x"] + b["width"]) * w))
                        y2 = min(h, int((b["y"] + b["height"]) * h))
                        if x2 > x1 and y2 > y1:
                            crop = frame[y1:y2, x1:x2]
                            person_crops.append(crop)
                            person_crop_info.append({
                                "frame_idx": batch_idx + (batch_dets.index(frame_dets) if frame_dets in batch_dets else 0),
                                "detection_idx": frame_dets.index(det) if det in frame_dets else 0,
                                "track_id": det.get("track_id"),
                                "timestamp": meta["timestamp"],
                            })

        # ── Person ReID ──────────────────────────────────────────────────────
        embeddings: Optional[np.ndarray] = None
        if person_crops and self.registry.reid:
            if progress_callback:
                progress_callback(85, "Computing person embeddings…")
            embeddings = self.registry.reid.infer(person_crops)

        # ── Build results ────────────────────────────────────────────────────
        if progress_callback:
            progress_callback(90, "Generating report…")

        # Aggregate persons
        persons_dict: Dict[int, Dict[str, Any]] = {}
        for frame_dets, meta in zip(all_detections, frame_metadata):
            for det in frame_dets:
                if det.get("label") == "person":
                    track_id = det.get("track_id")
                    if track_id not in persons_dict:
                        persons_dict[track_id] = {
                            "track_id": track_id,
                            "label": f"Person_{track_id}" if track_id else "Unknown",
                            "confidence": 0,
                            "first_seen": meta["timestamp"],
                            "last_seen": meta["timestamp"],
                            "appearance_count": 0,
                        }
                    persons_dict[track_id]["last_seen"] = meta["timestamp"]
                    persons_dict[track_id]["appearance_count"] += 1
                    persons_dict[track_id]["confidence"] = max(
                        persons_dict[track_id]["confidence"],
                        det.get("confidence", 0),
                    )

        persons = list(persons_dict.values())

        # Objects
        objects: Dict[str, int] = {}
        for frame_dets in all_detections:
            for det in frame_dets:
                if det.get("label") != "person":
                    label = det.get("label", "unknown")
                    objects[label] = objects.get(label, 0) + 1

        # Events (simplified)
        events = []
        if persons:
            events.append({
                "type": "person_detected",
                "description": f"{len(persons)} person(s) detected",
                "timestamp": persons[0]["first_seen"],
                "confidence": 85,
            })

        # Timeline
        timeline = [
            {
                "time": p["first_seen"],
                "event": f"Person {p['track_id']} enters scene",
                "confidence": p["confidence"] * 100,
            }
            for p in persons
        ]

        elapsed = time.time() - start_time

        result = {
            "video_path": video_path,
            "duration": duration,
            "fps": fps,
            "resolution": [width, height],
            "total_frames": total_frames,
            "processed_frames": extracted_count,
            "detections": all_detections,
            "persons": persons,
            "objects": objects,
            "events": events,
            "timeline": timeline,
            "confidence": np.mean([p["confidence"] for p in persons]) if persons else 0.0,
            "models_used": [
                "YOLOv8" if self.registry.detector else None,
                "SAM2" if self.registry.segmentor else None,
                "ByteTrack" if self.registry.tracker else None,
                "FastReID" if self.registry.reid else None,
            ],
            "processing_time": elapsed,
            "generated_at": datetime.utcnow().isoformat(),
        }

        if progress_callback:
            progress_callback(100, "Complete ✓")

        self.logger.info(
            f"Processing complete: {extracted_count} frames, {len(persons)} persons, "
            f"{len(objects)} object types, {elapsed:.1f}s elapsed"
        )

        return result
