"""
PANOPTICON AI Model Registry
Central inference pipeline initialization.

This module is responsible for:
1. Auto-downloading all pretrained model weights on startup
2. Detecting GPU availability and configuring device placement
3. Initializing all AI modules in correct dependency order
4. Providing unified inference interface
5. Gracefully falling back to CPU on CUDA failures
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("panopticon.models")


class ModelRegistry:
    """
    Unified interface to all AI models.

    Usage:
        registry = ModelRegistry(device="auto")
        registry.startup()  # Downloads weights, initializes all models
        results = registry.infer_batch(frames, detections_only=False)
    """

    def __init__(self, device: str = "auto"):
        self.device = device
        self.detector = None
        self.segmentor = None
        self.tracker = None
        self.reid = None
        self.initialized = False

    def startup(
        self,
        skip_models: Optional[list[str]] = None,
        progress_cb: Optional[Any] = None,
    ) -> Dict[str, bool]:
        """
        Initialize all models and download weights.

        Args:
            skip_models: List of model names to skip (e.g., ["segmentor"])
            progress_cb: Optional callback(pct: int, msg: str)

        Returns:
            Dict of {model_name: loaded_successfully}
        """
        skip = set(skip_models or [])
        results = {}

        try:
            if progress_cb:
                progress_cb(0, "Detecting device…")

            import torch
            if self.device == "auto":
                self.device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"PANOPTICON using device: {self.device}")
            if self.device == "cuda":
                logger.info(f"  GPU: {torch.cuda.get_device_name(0)}")
                logger.info(f"  VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

        except Exception as e:
            logger.warning(f"Could not detect device: {e}. Defaulting to CPU.")
            self.device = "cpu"

        # ── Load Detector ────────────────────────────────────────────────────
        if "detector" not in skip:
            try:
                if progress_cb:
                    progress_cb(15, "Loading detector (YOLOv8)…")
                from .detector import YOLODetector
                self.detector = YOLODetector(device=self.device).load()
                results["detector"] = True
                logger.info("✓ Detector loaded")
            except Exception as e:
                logger.error(f"Failed to load detector: {e}", exc_info=True)
                results["detector"] = False

        # ── Load Segmentor ──────────────────────────────────────────────────
        if "segmentor" not in skip:
            try:
                if progress_cb:
                    progress_cb(30, "Loading segmentor (SAM 2)…")
                from .segmentor import SAM2Segmentor
                self.segmentor = SAM2Segmentor(device=self.device).load()
                results["segmentor"] = True
                logger.info("✓ Segmentor loaded")
            except Exception as e:
                logger.error(f"Failed to load segmentor: {e}")
                results["segmentor"] = False

        # ── Load Tracker ─────────────────────────────────────────────────────
        if "tracker" not in skip:
            try:
                if progress_cb:
                    progress_cb(45, "Loading tracker (ByteTrack)…")
                from .tracker import ByteTracker
                self.tracker = ByteTracker(device=self.device).load()
                results["tracker"] = True
                logger.info("✓ Tracker loaded")
            except Exception as e:
                logger.error(f"Failed to load tracker: {e}")
                results["tracker"] = False

        # ── Load ReID ────────────────────────────────────────────────────────
        if "reid" not in skip:
            try:
                if progress_cb:
                    progress_cb(60, "Loading ReID (FastReID)…")
                from .reid import FastReIDModule
                self.reid = FastReIDModule(device=self.device).load()
                results["reid"] = True
                logger.info("✓ ReID loaded")
            except Exception as e:
                logger.error(f"Failed to load ReID: {e}")
                results["reid"] = False

        if progress_cb:
            progress_cb(100, "All models ready")

        self.initialized = True
        logger.info(f"Model registry initialized: {sum(results.values())}/{len(results)} models loaded")
        return results

    def infer_batch(
        self,
        frames: list,
        detections_only: bool = False,
        track: bool = True,
        segment: bool = False,
        reid: bool = False,
    ) -> Dict[str, Any]:
        """
        Run full inference pipeline on a batch of frames.

        Returns:
            {
              "detections": [frame_detections_list],
              "tracks": {track_id: Track},
              "masks": [frame_masks_list],
              "embeddings": [embeddings_array],
            }
        """
        if not self.initialized:
            raise RuntimeError("Call startup() first")

        results = {
            "detections": [],
            "tracks": None,
            "masks": [],
            "embeddings": None,
        }

        # Object detection
        if self.detector:
            try:
                detections = self.detector.infer(frames)
                results["detections"] = detections
            except Exception as e:
                logger.error(f"Detection failed: {e}")

        # Multi-object tracking
        if track and self.tracker and results["detections"]:
            try:
                all_detections = []
                for frame_dets in results["detections"]:
                    tracked = self.tracker.infer(frame_dets)
                    all_detections.extend(tracked)
                results["tracks"] = self.tracker.get_active_tracks()
            except Exception as e:
                logger.error(f"Tracking failed: {e}")

        # Instance segmentation
        if segment and self.segmentor and results["detections"]:
            try:
                from concurrent.futures import ThreadPoolExecutor
                def segment_frame(args):
                    frame, frame_dets = args
                    return self.segmentor.infer(frame, frame_dets)

                with ThreadPoolExecutor(max_workers=4) as executor:
                    masks = list(executor.map(segment_frame, zip(frames, results["detections"])))
                results["masks"] = masks
            except Exception as e:
                logger.error(f"Segmentation failed: {e}")

        # Person re-identification
        if reid and self.reid and results["detections"]:
            try:
                import cv2
                all_crops = []
                for frame, frame_dets in zip(frames, results["detections"]):
                    for det in frame_dets:
                        if det.get("label") == "person":
                            b = det["bbox"]
                            h, w = frame.shape[:2]
                            x1, y1 = int(b["x"] * w), int(b["y"] * h)
                            x2, y2 = int((b["x"] + b["width"]) * w), int((b["y"] + b["height"]) * h)
                            crop = frame[max(0, y1):min(h, y2), max(0, x1):min(w, x2)]
                            if crop.size > 0:
                                all_crops.append(crop)

                if all_crops:
                    embeddings = self.reid.infer(all_crops)
                    results["embeddings"] = embeddings
            except Exception as e:
                logger.error(f"ReID inference failed: {e}")

        return results

    def __repr__(self) -> str:
        status = {
            "detector": bool(self.detector),
            "segmentor": bool(self.segmentor),
            "tracker": bool(self.tracker),
            "reid": bool(self.reid),
        }
        return f"ModelRegistry(device={self.device!r}, initialized={self.initialized}, models={status})"


# ── Singleton for application ────────────────────────────────────────────────
_global_registry: Optional[ModelRegistry] = None


def get_registry(device: str = "auto") -> ModelRegistry:
    """Get or create the global model registry."""
    global _global_registry
    if _global_registry is None:
        _global_registry = ModelRegistry(device=device)
    return _global_registry


def startup_models(device: str = "auto", skip: Optional[list[str]] = None) -> Dict[str, bool]:
    """Startup the global model registry."""
    registry = get_registry(device=device)
    return registry.startup(skip_models=skip)


# Exports
__all__ = [
    "ModelRegistry",
    "get_registry",
    "startup_models",
]
