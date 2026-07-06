"""
PANOPTICON Startup Utility
Initialize all AI models with automatic weight downloading.

This script should be run once after installation to prepare the system.
Or call this programmatically in your application.

Usage:
    python ai/startup.py                     # Full startup with all models
    python ai/startup.py --skip-segmentor   # Skip memory-intensive models
    python ai/startup.py --device cpu       # Force CPU mode
    python ai/startup.py --check-only       # Check status without downloading
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("panopticon.startup")


def print_header(text: str) -> None:
    """Print formatted section header."""
    print(f"\n{'=' * 70}")
    print(f"  {text}")
    print(f"{'=' * 70}\n")


def print_status(name: str, success: bool, detail: str = "") -> None:
    """Print status line."""
    icon = "✓" if success else "✗"
    status_color = "\033[92m" if success else "\033[91m"  # Green or Red
    reset_color = "\033[0m"
    print(f"  {status_color}{icon}{reset_color} {name:<30} {detail}")


def check_system() -> Dict[str, bool]:
    """Check system requirements."""
    print_header("System Requirements")

    status = {}

    # Python version
    py_version = sys.version_info
    py_ok = py_version.major >= 3 and py_version.minor >= 10
    status["python"] = py_ok
    print_status("Python 3.10+", py_ok, f"({py_version.major}.{py_version.minor}.{py_version.micro})")

    # PyTorch
    try:
        import torch
        status["torch"] = True
        cuda_ok = torch.cuda.is_available()
        device = f"GPU: {torch.cuda.get_device_name(0)}" if cuda_ok else "CPU"
        print_status("PyTorch", True, f"v{torch.__version__} ({device})")
    except ImportError:
        status["torch"] = False
        print_status("PyTorch", False, "Install: pip install torch")

    # Ultralytics
    try:
        import ultralytics
        status["ultralytics"] = True
        print_status("Ultralytics (YOLO)", True, f"v{ultralytics.__version__}")
    except ImportError:
        status["ultralytics"] = False
        print_status("Ultralytics", False, "Install: pip install ultralytics")

    # OpenCV
    try:
        import cv2
        status["cv2"] = True
        print_status("OpenCV", True, f"v{cv2.__version__}")
    except ImportError:
        status["cv2"] = False
        print_status("OpenCV", False, "Install: pip install opencv-python-headless")

    return status


def check_weights(skip_models: list[str] | None = None) -> Dict[str, Dict[str, Any]]:
    """Check model weight download status."""
    print_header("Model Weights Status")

    from ai.models.weights_manager import weights_status

    skip = set(skip_models or [])
    status = weights_status()

    for key, info in sorted(status.items()):
        if key in skip:
            continue
        present = info["present"]
        verified = info["verified"]
        size = info["size_mb"]
        status_str = f"{size} MB"
        if verified:
            status_str += " [verified]"
        elif present:
            status_str += " [unverified]"
        print_status(key, present, status_str)

    return status


def download_weights(skip_models: list[str] | None = None) -> Dict[str, bool]:
    """Download all missing model weights."""
    print_header("Downloading Model Weights")

    from ai.models.weights_manager import WEIGHT_REGISTRY, download_weights as _download

    skip = set(skip_models or [])
    results = {}

    def progress_cb(pct: int, msg: str) -> None:
        print(f"  [{pct:3d}%] {msg}")

    for key in sorted(WEIGHT_REGISTRY.keys()):
        if key in skip:
            continue
        try:
            print(f"\n  {key}…")
            _download(key, progress_cb=progress_cb)
            results[key] = True
        except Exception as exc:
            logger.error(f"Failed to download {key}: {exc}")
            results[key] = False

    return results


def startup_models(device: str = "auto", skip_models: list[str] | None = None) -> Dict[str, bool]:
    """Initialize all AI models."""
    print_header("Initializing AI Models")

    from ai.models import startup_models as _startup

    def progress_cb(pct: int, msg: str) -> None:
        if pct % 20 == 0 or pct == 100:
            print(f"  [{pct:3d}%] {msg}")

    try:
        results = _startup(device=device, skip=skip_models)
        for name, success in results.items():
            print_status(name, success, "loaded" if success else "failed")
        return results
    except Exception as exc:
        logger.error(f"Startup failed: {exc}", exc_info=True)
        return {}


def generate_report(
    system_status: Dict[str, bool],
    weights_status: Dict[str, Dict[str, Any]],
    models_status: Dict[str, bool],
) -> Dict[str, Any]:
    """Generate startup report."""
    print_header("Startup Report")

    system_ok = all(system_status.values())
    weights_ok = all(w["present"] for w in weights_status.values())
    models_ok = all(models_status.values())
    overall_ok = system_ok and weights_ok and models_ok

    report = {
        "system_ok": system_ok,
        "weights_ok": weights_ok,
        "models_ok": models_ok,
        "overall_ok": overall_ok,
        "system_status": system_status,
        "weights_status": weights_status,
        "models_status": models_status,
    }

    print(f"\n  System OK: {system_ok}")
    print(f"  Weights OK: {weights_ok}")
    print(f"  Models OK: {models_ok}")
    print(f"\n  Overall: {'✓ READY' if overall_ok else '✗ ISSUES'}\n")

    return report


def main():
    parser = argparse.ArgumentParser(
        description="PANOPTICON AI System Startup",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--device",
        default="auto",
        choices=["auto", "cuda", "cpu"],
        help="Target device (default: auto)",
    )
    parser.add_argument(
        "--skip-segmentor",
        action="store_true",
        help="Skip SAM 2 segmentation (memory-intensive)",
    )
    parser.add_argument(
        "--skip-detector",
        action="store_true",
        help="Skip YOLOv8 detector",
    )
    parser.add_argument(
        "--skip-reid",
        action="store_true",
        help="Skip FastReID module",
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Check status without downloading",
    )
    parser.add_argument(
        "--no-init",
        action="store_true",
        help="Skip model initialization (weights only)",
    )
    parser.add_argument(
        "--report",
        type=str,
        help="Save report to JSON file",
    )

    args = parser.parse_args()

    skip_models = []
    if args.skip_segmentor:
        skip_models.append("segmentor")
    if args.skip_detector:
        skip_models.append("detector")
    if args.skip_reid:
        skip_models.append("reid")

    # ── Run checks ───────────────────────────────────────────────────────
    system_status = check_system()

    weights_status_dict = check_weights(skip_models=skip_models)

    if args.check_only:
        print_header("Check Complete (no download)")
        print("Use without --check-only to download weights and initialize models\n")
        return

    # ── Download weights ─────────────────────────────────────────────────
    download_results = download_weights(skip_models=skip_models)

    # ── Initialize models ────────────────────────────────────────────────
    models_status_dict = {}
    if not args.no_init:
        models_status_dict = startup_models(device=args.device, skip_models=skip_models)

    # ── Generate report ──────────────────────────────────────────────────
    report = generate_report(
        system_status=system_status,
        weights_status=weights_status_dict,
        models_status=models_status_dict,
    )

    if args.report:
        report_path = Path(args.report)
        report_path.write_text(json.dumps(report, indent=2))
        print(f"Report saved: {report_path}\n")

    # Return appropriate exit code
    sys.exit(0 if report["overall_ok"] else 1)


if __name__ == "__main__":
    main()
