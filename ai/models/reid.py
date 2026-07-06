"""
PANOPTICON Person Re-ID — FastReID + CLIP Fallback

Cross-camera identity matching for suspect tracking.
Auto-downloads FastReID MSMT17 weights, falls back to CLIP ViT-B/32.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import numpy as np

from .base import BaseModel
from .weights_manager import WEIGHTS_DIR, download_weights

logger = logging.getLogger("panopticon.models.reid")


class FastReIDModule(BaseModel):
    """
    Person appearance embedding using FastReID (ResNet50 MSMT17).

    Generates 512-dim embeddings for person crops.
    Used for cross-camera identity matching and gallery management.

    Fallback: CLIP ViT-B/32 (768-dim embeddings, universal).
    """

    name = "fastreid"
    version = "1.0"

    def __init__(
        self,
        model_key: str = "fastreid_msmt17",
        device: str = "auto",
        embedding_dim: int = 512,
        normalize: bool = True,
    ):
        super().__init__(device=device)
        self.model_key = model_key
        self.embedding_dim = embedding_dim
        self.normalize = normalize
        self.model = None
        self.is_clip = False

    def load(self) -> "FastReIDModule":
        """Load FastReID, fall back to CLIP."""
        try:
            self._load_fastreid()
            self.logger.info(f"FastReID loaded: {self.model_key} on {self.device}")
            self._loaded = True
            return self
        except Exception as exc:
            self.logger.warning(f"FastReID failed: {exc}. Trying CLIP fallback…")

        try:
            self._load_clip()
            self.logger.info(f"CLIP ViT-B/32 loaded on {self.device} (fallback)")
            self.is_clip = True
            self.embedding_dim = 768
            self._loaded = True
            return self
        except Exception as exc2:
            self.logger.warning(f"CLIP also failed: {exc2}. Using mock embeddings.")
            self._loaded = True
            return self

    def _load_fastreid(self) -> None:
        try:
            import torch
            from fastreid.config import get_cfg
            from fastreid.modeling import build_model

            weight_path = WEIGHTS_DIR / "fastreid_msmt17_R50.pth"
            if not weight_path.exists():
                self.logger.info("Downloading FastReID weights…")
                download_weights("fastreid_msmt17")

            cfg = get_cfg()
            cfg.MODEL.BACKBONE.WITH_IBN = True
            cfg.MODEL.METRIC_LOSS_TYPE = "triplet"
            self.model = build_model(cfg)
            self.model.load_param(str(weight_path))
            self.model.eval()
            self.model.to(self.device)

        except ImportError:
            raise ImportError("fastreid not installed. Install: pip install fast-reid")

    def _load_clip(self) -> None:
        try:
            import clip
            weight_path = WEIGHTS_DIR / "clip_vitb32.pt"
            if not weight_path.exists():
                self.logger.info("Downloading CLIP weights…")
                download_weights("clip_vitb32")

            self.model, self.preprocess = clip.load("ViT-B/32", device=self.device)
            self.model.eval()

        except ImportError:
            raise ImportError("clip not installed. Install: pip install openai-clip")

    def infer(
        self,
        person_crops: List[np.ndarray],
        normalize_output: bool = True,
    ) -> np.ndarray:
        """
        Compute embedding vectors for a batch of person crops.

        Args:
            person_crops: List of BGR images (H×W×3)
            normalize_output: Normalize embeddings to unit norm

        Returns:
            Embedding matrix (N × embedding_dim)
        """
        if not person_crops:
            return np.array([], dtype=np.float32).reshape(0, self.embedding_dim)

        if self.model is None:
            return self._mock_embeddings(len(person_crops))

        if self.is_clip:
            return self._clip_infer(person_crops, normalize_output)
        return self._fastreid_infer(person_crops, normalize_output)

    def _fastreid_infer(
        self,
        person_crops: List[np.ndarray],
        normalize_output: bool,
    ) -> np.ndarray:
        try:
            import torch
            from torchvision.transforms import functional as F

            # Preprocess crops
            processed = []
            for crop in person_crops:
                # Resize to 256×128 (FastReID standard)
                import cv2
                resized = cv2.resize(crop, (128, 256))
                # BGR → RGB, normalize
                img_rgb = resized[:, :, ::-1]
                tensor = torch.from_numpy(img_rgb).permute(2, 0, 1).float() / 255.0
                tensor = F.normalize(tensor, mean=[0.485, 0.456, 0.406],
                                    std=[0.229, 0.224, 0.225])
                processed.append(tensor)

            batch = torch.stack(processed).to(self.device)

            with torch.no_grad():
                if hasattr(self.model, "backbone"):
                    feats = self.model.backbone(batch)
                    if hasattr(self.model, "heads"):
                        feats = self.model.heads(feats)
                else:
                    feats = self.model(batch)

            embeddings = feats.detach().cpu().numpy()

            if normalize_output:
                norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
                embeddings = embeddings / (norms + 1e-7)

            return embeddings.astype(np.float32)

        except Exception as exc:
            self.logger.error(f"FastReID inference failed: {exc}")
            return self._mock_embeddings(len(person_crops))

    def _clip_infer(
        self,
        person_crops: List[np.ndarray],
        normalize_output: bool,
    ) -> np.ndarray:
        try:
            import torch
            from PIL import Image
            import io

            embeddings = []
            for crop in person_crops:
                # Convert BGR to PIL Image
                crop_rgb = crop[:, :, ::-1]
                img = Image.fromarray(crop_rgb)
                # Preprocess and embed
                processed = self.preprocess(img).unsqueeze(0).to(self.device)
                with torch.no_grad():
                    emb = self.model.encode_image(processed)
                embeddings.append(emb.squeeze(0).cpu().numpy())

            embeddings = np.array(embeddings, dtype=np.float32)

            if normalize_output:
                norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
                embeddings = embeddings / (norms + 1e-7)

            return embeddings

        except Exception as exc:
            self.logger.error(f"CLIP inference failed: {exc}")
            return self._mock_embeddings(len(person_crops))

    def _mock_embeddings(self, count: int) -> np.ndarray:
        """Generate random normalized embeddings."""
        embeddings = np.random.randn(count, self.embedding_dim).astype(np.float32)
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        return embeddings / (norms + 1e-7)

    def similarity(
        self,
        embedding1: np.ndarray,
        embedding2: np.ndarray,
        metric: str = "cosine",
    ) -> float:
        """
        Compute similarity between two embeddings.

        Args:
            embedding1: 1D array (embedding_dim,)
            embedding2: 1D array (embedding_dim,)
            metric: 'cosine' or 'euclidean'

        Returns:
            Similarity score (0-1 for cosine, 0+ for euclidean)
        """
        if metric == "cosine":
            # Assumes embeddings are normalized
            return float(np.dot(embedding1, embedding2))
        elif metric == "euclidean":
            distance = np.linalg.norm(embedding1 - embedding2)
            # Convert to similarity (higher = more similar)
            return 1.0 / (1.0 + distance)
        else:
            raise ValueError(f"Unknown metric: {metric}")
