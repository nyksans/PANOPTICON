"""
PANOPTICON Device Management
Auto-detects GPU/CPU, configures FP16, sets up torch compile if available.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger("panopticon.inference.device")


@dataclass
class DeviceConfig:
    device:     str          # "cuda:0" | "cpu"
    fp16:       bool         # use half-precision
    use_compile: bool        # torch.compile available
    gpu_name:   Optional[str]
    vram_gb:    float
    cuda_version: Optional[str]


def detect_device(force_cpu: bool = False) -> DeviceConfig:
    """
    Auto-detect best available device.
    Returns a fully configured DeviceConfig.
    """
    try:
        import torch

        if not force_cpu and torch.cuda.is_available():
            idx  = 0
            name = torch.cuda.get_device_name(idx)
            vram = torch.cuda.get_device_properties(idx).total_memory / 1e9
            cuda_ver = torch.version.cuda

            # FP16 is safe on Ampere+ (sm_80+) and all modern GPUs
            fp16 = torch.cuda.get_device_capability(idx)[0] >= 7

            # torch.compile available in PyTorch ≥ 2.0
            use_compile = int(torch.__version__.split(".")[0]) >= 2

            cfg = DeviceConfig(
                device=f"cuda:{idx}",
                fp16=fp16,
                use_compile=use_compile,
                gpu_name=name,
                vram_gb=round(vram, 1),
                cuda_version=cuda_ver,
            )
            logger.info(f"GPU detected: {name} ({vram:.1f} GB VRAM) | FP16={fp16} | compile={use_compile}")
            return cfg

    except ImportError:
        pass

    cfg = DeviceConfig(
        device="cpu",
        fp16=False,
        use_compile=False,
        gpu_name=None,
        vram_gb=0.0,
        cuda_version=None,
    )
    logger.info("Running on CPU (no CUDA available)")
    return cfg


# Global device config — resolved once at import time
DEVICE = detect_device(force_cpu=os.getenv("FORCE_CPU", "0") == "1")
