"""
PANOPTICON AI Model Base
Abstract interface for all inference modules.
Each module supports infer() now; train() and evaluate() are stubbed for future work.
"""

from __future__ import annotations

import abc
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional


class BaseModel(abc.ABC):
    """
    Abstract base for every PANOPTICON AI module.

    Current implementation: ONLY infer() is functional.
    train() and evaluate() are modular stubs for future fine-tuning.
    """

    name: str = ""
    version: str = "1.0"

    def __init__(self, device: str = "auto"):
        import torch
        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
        self.logger = logging.getLogger(f"panopticon.models.{self.name}")
        self._loaded = False

    # ── Core interface ──────────────────────────────────────────────────────

    @abc.abstractmethod
    def load(self) -> "BaseModel":
        """Load pretrained weights. Called once at startup."""
        ...

    @abc.abstractmethod
    def infer(self, inputs: Any, **kwargs) -> Any:
        """Run inference on inputs."""
        ...

    def train(self, *args, **kwargs) -> Dict[str, Any]:
        """
        Placeholder for future fine-tuning.
        NOT implemented — system uses pretrained weights only.
        """
        raise NotImplementedError(
            f"{self.name}.train() is reserved for future fine-tuning. "
            "Use pretrained infer() instead."
        )

    def evaluate(self, *args, **kwargs) -> Dict[str, Any]:
        """
        Placeholder for benchmark evaluation.
        Subclasses may implement for COCO/MOT17/Market-1501 benchmarking.
        """
        raise NotImplementedError(f"{self.name}.evaluate() not yet implemented.")

    # ── Helpers ─────────────────────────────────────────────────────────────

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(name={self.name!r}, device={self.device!r}, loaded={self._loaded})"
