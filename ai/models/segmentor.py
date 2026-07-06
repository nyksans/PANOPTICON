"""
PANOPTICON Segmentor — SAM 2 (Segment Anything 2)

Provides precise instance segmentation masks for detected objects.
Auto-downloads official Meta SAM 2 checkpoints.
GPU/CPU automatic switching.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from .base import BaseModel
from .weights_manager import WEIGHTS_DIR, download_weights

logger = logging.getLogger("panopticon.models.segmentor")

_SAM2_PRIORITY = ["sam2_large", "sam2_base"]


class SAM2Segmentor(BaseModel):
    """
    Segment Anything Model 2 for precise instance-level segmentation.

    Startup behaviour
    -----------------
    1. Try sam2_large.pt
    2. Fall back to sam2_base_plus.pt if too large
    3. Mock segmentation if unavailable

    Inference
    ---------
    - Takes detections (bboxes) and returns binary masks
    - Can run in prompting mode (click-based) or bounding-box mode
    """

    name = "sam2_segmentor"
    version = "2.0"

    def __init__(
        self,
        model_key: str = "sam2_large",
        device: str = "auto",
    ):
        super().__init__(device=device)
        self.model_key = model_key
        self.model = None
        self.predictor = None

    def load(self) -> "SAM2Segmentor":
        """Download SAM 2 weights and initialize."""
        for key in _SAM2_PRIORITY:
            try:
                self._load_key(key)
                self.logger.info(f"SAM 2 loaded: {key} on {self.device}")
                self._loaded = True
                return self
            except Exception as exc:
                self.logger.warning(f"Could not load {key}: {exc}")

        self.logger.warning("SAM 2 unavailable — using mock segmentation")
        self._loaded = True
        return self

    def _load_key(self, key: str) -> None:
        try:
            from sam2.build_sam import build_sam2
            from sam2.sam2_image_predictor import SAM2ImagePredictor

            weight_map = {
                "sam2_large": "sam2_hiera_large.pt",
                "sam2_base": "sam2_hiera_base_plus.pt",
            }
            weight_path = WEIGHTS_DIR / weight_map[key]

            if not weight_path.exists():
                self.logger.info(f"Downloading {key} weights…")
                download_weights(key)

            self.model = build_sam2(
                model_cfg="large" if "large" in key else "base_plus",
                ckpt_path=str(weight_path),
            )
            self.model.to(self.device)
            self.predictor = SAM2ImagePredictor(self.model)
            self.model_key = key

        except ImportError:
            raise ImportError("sam2 package not installed. Install: pip install git+https://github.com/facebookresearch/sam2.git")

    def infer(
        self,
        frame: np.ndarray,
        detections: List[Dict[str, Any]],
        return_logits: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Run segmentation on detections from a single frame.

        Args:
            frame: BGR image (H×W×3)
            detections: List of {label, bbox, ...} from detector
            return_logits: If True, return raw logits; else binary masks

        Returns:
            detections with added keys:
              - mask: binary mask (H×W) or logits array
              - mask_area: number of foreground pixels
              - mask_iou: confidence metric
        """
        if not self.predictor or not detections:
            return self._mock_segment(detections)

        try:
            self.predictor.set_image(frame)
            h, w = frame.shape[:2]

            for det in detections:
                bbox = det["bbox"]
                x1 = int(bbox["x"] * w)
                y1 = int(bbox["y"] * h)
                x2 = int((bbox["x"] + bbox["width"]) * w)
                y2 = int((bbox["y"] + bbox["height"]) * h)

                # SAM 2 expects [x, y] point or [x1, y1, x2, y2] box
                input_box = np.array([x1, y1, x2, y2])

                masks, scores, logits = self.predictor.predict(
                    point_coords=None,
                    point_labels=None,
                    box=input_box[None, :],
                    multimask_output=False,
                )

                mask = masks[0].astype(np.uint8)
                det["mask"] = mask
                det["mask_area"] = int(mask.sum())
                det["mask_iou"] = float(scores[0])

            return detections

        except Exception as exc:
            self.logger.error(f"SAM2 inference failed: {exc}")
            return self._mock_segment(detections)

    def _mock_segment(self, detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Synthetic masks for development."""
        for det in detections:
            # Create a dummy mask
            det["mask"] = np.ones((480, 640), dtype=np.uint8)
            det["mask_area"] = 100000
            det["mask_iou"] = 0.85
        return detections
