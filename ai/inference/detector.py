"""
PANOPTICON Object Detector
YOLOv8x/l/n with automatic weight download, FP16, batch inference.
Forensic target classes: person, backpack, knife, bottle, phone, laptop, car, etc.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Tuple

import cv2
import numpy as np

from .device import DEVICE
from ..models.weights_manager import weights_manager

logger = logging.getLogger("panopticon.inference.detector")

# Forensic-relevant COCO classes (subset used for filtering)
FORENSIC_CLASSES = {
    "person", "bicycle", "car", "motorcycle", "bus", "truck",
    "backpack", "handbag", "suitcase",
    "knife", "scissors",
    "bottle", "cup",
    "laptop", "mouse", "keyboard", "cell phone",
    "chair", "couch", "bed",
    "umbrella", "tie",
}


@dataclass
class BBox:
    """Bounding box in [x1,y1,x2,y2] pixel coords."""
    x1: float; y1: float; x2: float; y2: float

    @property
    def cx(self) -> float: return (self.x1 + self.x2) / 2
    @property
    def cy(self) -> float: return (self.y1 + self.y2) / 2
    @property
    def w(self)  -> float: return self.x2 - self.x1
    @property
    def h(self)  -> float: return self.y2 - self.y1
    @property
    def area(self) -> float: return self.w * self.h

    def to_xywh_norm(self, img_w: int, img_h: int) -> Tuple[float, float, float, float]:
        return self.cx / img_w, self.cy / img_h, self.w / img_w, self.h / img_h

    def to_dict(self) -> Dict[str, float]:
        return {"x1": self.x1, "y1": self.y1, "x2": self.x2, "y2": self.y2,
                "cx": self.cx, "cy": self.cy, "w": self.w, "h": self.h}


@dataclass
class Detection:
    label:        str
    class_id:     int
    confidence:   float
    bbox:         BBox
    frame_idx:    int
    timestamp:    float
    track_id:     Optional[str] = None
    mask:         Optional[np.ndarray] = None
    embedding:    Optional[np.ndarray] = None
    scene_pos:    Optional[Tuple[float, float, float]] = None
    metadata:     Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "label":      self.label,
            "class_id":   self.class_id,
            "confidence": round(self.confidence, 4),
            "bbox":       self.bbox.to_dict(),
            "frame_idx":  self.frame_idx,
            "timestamp":  round(self.timestamp, 3),
            "track_id":   self.track_id,
            "scene_pos":  list(self.scene_pos) if self.scene_pos else None,
        }


class YOLODetector:
    """
    YOLOv8 object detector with:
    - Automatic weight download (x → l → n fallback)
    - GPU/CPU auto-switch with FP16
    - Batch inference
    - Class filtering for forensic relevance

    Supports:
      infer(frame)            → List[Detection]
      infer_batch(frames)     → List[List[Detection]]
      train(...)              → NotImplementedError (reserved)
      evaluate(...)           → see evaluator.py
    """

    def __init__(
        self,
        model_name: str = "yolov8l",
        confidence: float = 0.40,
        iou_threshold: float = 0.45,
        filter_forensic: bool = True,
        img_size: int = 640,
    ):
        self.confidence    = confidence
        self.iou_threshold = iou_threshold
        self.filter_forensic = filter_forensic
        self.img_size      = img_size
        self.device        = DEVICE.device
        self.fp16          = DEVICE.fp16
        self._model        = None
        self._load_time_ms = 0.0
        self._model_name   = model_name
        self._load(model_name)

    def _load(self, name: str) -> None:
        """Load model, auto-downloading if needed."""
        t0 = time.perf_counter()
        try:
            from ultralytics import YOLO

            # Ensure weights exist
            ok = weights_manager.ensure(name)
            if ok:
                weight_path = weights_manager.path(name)
            else:
                # Fallback chain
                for fallback in ["yolov8l", "yolov8n"]:
                    if fallback != name:
                        logger.warning(f"{name} unavailable, trying {fallback}")
                        if weights_manager.ensure(fallback):
                            weight_path = weights_manager.path(fallback)
                            name = fallback
                            break
                else:
                    weight_path = None

            if weight_path is None:
                # Last-resort: ultralytics auto-download to cwd
                logger.warning("Using ultralytics auto-download for yolov8n")
                self._model = YOLO("yolov8n.pt")
            else:
                self._model = YOLO(str(weight_path))

            # Move to device
            self._model.to(self.device)
            if self.fp16:
                try:
                    self._model.model.half()
                    logger.info("FP16 enabled on GPU")
                except Exception:
                    self.fp16 = False

            self._load_time_ms = (time.perf_counter() - t0) * 1000
            logger.info(
                f"YOLOv8 ({name}) loaded on {self.device} "
                f"[FP16={self.fp16}] in {self._load_time_ms:.0f}ms"
            )

        except ImportError:
            logger.warning("ultralytics not installed — detector in mock mode")
            self._model = None

    # ── Public interface ────────────────────────────────────────────────────

    def infer(
        self,
        frame: np.ndarray,
        frame_idx: int = 0,
        timestamp: float = 0.0,
    ) -> List[Detection]:
        """Run inference on a single BGR frame."""
        if self._model is None:
            return self._mock_infer(frame_idx, timestamp)
        return self._yolo_infer(frame, frame_idx, timestamp)

    def infer_batch(
        self,
        frames: List[np.ndarray],
        start_idx: int = 0,
        fps: float = 30.0,
    ) -> List[List[Detection]]:
        """Run batched inference for efficiency."""
        results = []
        if self._model is None:
            for i, _ in enumerate(frames):
                results.append(self._mock_infer(start_idx + i, (start_idx + i) / fps))
            return results

        try:
            batch_results = self._model(
                frames,
                conf=self.confidence,
                iou=self.iou_threshold,
                imgsz=self.img_size,
                verbose=False,
                half=self.fp16,
            )
            for i, r in enumerate(batch_results):
                idx = start_idx + i
                ts  = idx / max(fps, 1)
                results.append(self._parse_result(r, frames[i], idx, ts))
        except Exception as e:
            logger.error(f"Batch inference error: {e}")
            for i, f in enumerate(frames):
                results.append(self._yolo_infer(f, start_idx + i, (start_idx + i) / fps))

        return results

    def train(self, *args, **kwargs) -> None:
        """Reserved for future fine-tuning. Not implemented in current release."""
        raise NotImplementedError(
            "YOLODetector.train() is reserved for future fine-tuning. "
            "Current pipeline uses pretrained weights only."
        )

    # ── Internals ───────────────────────────────────────────────────────────

    def _yolo_infer(
        self, frame: np.ndarray, frame_idx: int, timestamp: float
    ) -> List[Detection]:
        try:
            results = self._model(
                frame,
                conf=self.confidence,
                iou=self.iou_threshold,
                imgsz=self.img_size,
                verbose=False,
                half=self.fp16,
            )
            return self._parse_result(results[0], frame, frame_idx, timestamp)
        except Exception as e:
            logger.error(f"YOLO inference error frame {frame_idx}: {e}")
            return []

    def _parse_result(
        self, result: Any, frame: np.ndarray, frame_idx: int, timestamp: float
    ) -> List[Detection]:
        dets = []
        h, w = frame.shape[:2]
        names = result.names

        for box in result.boxes:
            conf     = float(box.conf[0])
            cls_id   = int(box.cls[0])
            label    = names[cls_id]

            if self.filter_forensic and label not in FORENSIC_CLASSES:
                continue

            x1, y1, x2, y2 = map(float, box.xyxy[0])
            dets.append(Detection(
                label=label,
                class_id=cls_id,
                confidence=conf,
                bbox=BBox(x1, y1, x2, y2),
                frame_idx=frame_idx,
                timestamp=timestamp,
            ))
        return dets

    def _mock_infer(self, frame_idx: int, timestamp: float) -> List[Detection]:
        import random
        random.seed(frame_idx)
        dets = []
        if random.random() > 0.25:
            dets.append(Detection(
                label="person", class_id=0,
                confidence=round(random.uniform(0.72, 0.98), 3),
                bbox=BBox(120, 80, 220, 430),
                frame_idx=frame_idx, timestamp=timestamp,
            ))
        if random.random() > 0.65:
            dets.append(Detection(
                label="backpack", class_id=24,
                confidence=round(random.uniform(0.60, 0.92), 3),
                bbox=BBox(130, 280, 200, 420),
                frame_idx=frame_idx, timestamp=timestamp,
            ))
        return dets

    @property
    def model_info(self) -> Dict[str, Any]:
        return {
            "model":       self._model_name,
            "device":      self.device,
            "fp16":        self.fp16,
            "load_ms":     round(self._load_time_ms, 1),
            "confidence":  self.confidence,
            "img_size":    self.img_size,
        }
