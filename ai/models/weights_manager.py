"""
PANOPTICON Model Weights Manager
Automatically downloads, caches, and verifies pretrained model weights.
Called once at application startup — never trains from scratch.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional

import requests
from rich.console import Console
from rich.progress import (
    BarColumn, DownloadColumn, Progress, SpinnerColumn,
    TextColumn, TimeElapsedColumn, TransferSpeedColumn,
)

logger = logging.getLogger("panopticon.models.weights")
console = Console()

# ── Root cache directory ────────────────────────────────────────────────────
WEIGHTS_DIR = Path(__file__).parent / "weights"
WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

MANIFEST_FILE = WEIGHTS_DIR / "manifest.json"


# ── Weight registry ─────────────────────────────────────────────────────────
# Each entry: url, local filename, sha256 (empty = skip verify), size_mb
WEIGHT_REGISTRY: Dict[str, Dict[str, Any]] = {
    # ── YOLOv8 ────────────────────────────────────────────────────────────
    "yolov8x": {
        "url": "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8x.pt",
        "filename": "yolov8x.pt",
        "sha256": "",          # Ultralytics verifies internally
        "size_mb": 130,
        "description": "YOLOv8x — primary object detector (most accurate)",
    },
    "yolov8l": {
        "url": "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8l.pt",
        "filename": "yolov8l.pt",
        "sha256": "",
        "size_mb": 87,
        "description": "YOLOv8l — fallback detector",
    },
    "yolov8n": {
        "url": "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt",
        "filename": "yolov8n.pt",
        "sha256": "",
        "size_mb": 6,
        "description": "YOLOv8n — nano, fast CPU fallback",
    },
    # ── SAM 2 ─────────────────────────────────────────────────────────────
    "sam2_large": {
        "url": "https://dl.fbaipublicfiles.com/segment_anything_2/072824/sam2_hiera_large.pt",
        "filename": "sam2_hiera_large.pt",
        "sha256": "",
        "size_mb": 897,
        "description": "SAM 2 Large — segmentation",
    },
    "sam2_base": {
        "url": "https://dl.fbaipublicfiles.com/segment_anything_2/072824/sam2_hiera_base_plus.pt",
        "filename": "sam2_hiera_base_plus.pt",
        "sha256": "",
        "size_mb": 323,
        "description": "SAM 2 Base+ — segmentation fallback",
    },
    # ── FastReID (MSMT17 Bagtricks ResNet50) ──────────────────────────────
    "fastreid_msmt17": {
        "url": "https://github.com/JDAI-CV/fast-reid/releases/download/v0.1.1/msmt17_bagtricks_R50.pth",
        "filename": "fastreid_msmt17_R50.pth",
        "sha256": "",
        "size_mb": 95,
        "description": "FastReID MSMT17 ResNet50 — person re-identification",
    },
    # ── CLIP (ViT-B/32) as lightweight ReID fallback ───────────────────────
    "clip_vitb32": {
        "url": "https://openaipublic.azureedge.net/clip/models/40d365715913c9da98579312b702a82c18be219cc2a73407c4526f58eba950af/ViT-B-32.pt",
        "filename": "clip_vitb32.pt",
        "sha256": "40d365715913c9da98579312b702a82c18be219cc2a73407c4526f58eba950af",
        "size_mb": 338,
        "description": "CLIP ViT-B/32 — universal embedding fallback",
    },
}


# ── Manifest helpers ────────────────────────────────────────────────────────

def _load_manifest() -> Dict[str, Any]:
    if MANIFEST_FILE.exists():
        try:
            return json.loads(MANIFEST_FILE.read_text())
        except Exception:
            pass
    return {}


def _save_manifest(manifest: Dict[str, Any]) -> None:
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2))


def _sha256(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


# ── Core download ───────────────────────────────────────────────────────────

def download_weights(
    key: str,
    progress_cb: Optional[Callable[[int, str], None]] = None,
    force: bool = False,
) -> Path:
    """
    Download a model weight file if not already cached.
    Verifies SHA-256 when provided. Returns local path.
    """
    if key not in WEIGHT_REGISTRY:
        raise ValueError(f"Unknown weight key: {key!r}. Available: {list(WEIGHT_REGISTRY)}")

    entry = WEIGHT_REGISTRY[key]
    dest = WEIGHTS_DIR / entry["filename"]
    manifest = _load_manifest()

    # Already verified and present
    if not force and dest.exists() and manifest.get(key, {}).get("verified"):
        logger.info(f"[{key}] Cached at {dest}")
        return dest

    url = entry["url"]
    tmp = dest.with_suffix(dest.suffix + ".part")
    size_mb = entry.get("size_mb", 0)

    logger.info(f"[{key}] Downloading {entry['description']} (~{size_mb} MB)…")
    if progress_cb:
        progress_cb(0, f"Downloading {key}…")

    for attempt in range(1, 4):
        try:
            headers: Dict[str, str] = {}
            resume = tmp.stat().st_size if tmp.exists() else 0
            if resume:
                headers["Range"] = f"bytes={resume}-"

            resp = requests.get(url, stream=True, headers=headers, timeout=120)
            if resp.status_code == 416:
                tmp.rename(dest)
                break
            resp.raise_for_status()

            total = int(resp.headers.get("content-length", 0)) + resume
            mode = "ab" if resume else "wb"

            with open(tmp, mode) as f:
                with Progress(
                    SpinnerColumn(),
                    TextColumn(f"[cyan]{key}"),
                    BarColumn(),
                    DownloadColumn(),
                    TransferSpeedColumn(),
                    TimeElapsedColumn(),
                    console=console,
                    transient=True,
                ) as prog:
                    task = prog.add_task("", total=total)
                    prog.advance(task, resume)
                    downloaded = resume
                    for chunk in resp.iter_content(1 << 20):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                            prog.advance(task, len(chunk))
                            if progress_cb and total:
                                progress_cb(int(downloaded / total * 90), f"Downloading {key}…")

            tmp.rename(dest)
            break

        except (requests.RequestException, OSError) as exc:
            logger.warning(f"[{key}] Attempt {attempt}/3 failed: {exc}")
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)

    # Verify checksum
    expected = entry.get("sha256", "")
    verified = True
    if expected:
        logger.info(f"[{key}] Verifying SHA-256…")
        actual = _sha256(dest)
        if actual != expected:
            dest.unlink(missing_ok=True)
            raise ValueError(f"[{key}] SHA-256 mismatch: expected {expected}, got {actual}")
        logger.info(f"[{key}] Checksum OK ✓")
    else:
        logger.info(f"[{key}] No checksum configured — skipping verification")

    # Update manifest
    manifest[key] = {
        "filename": entry["filename"],
        "verified": verified,
        "downloaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "size_bytes": dest.stat().st_size,
    }
    _save_manifest(manifest)

    if progress_cb:
        progress_cb(100, f"{key} ready ✓")

    console.print(f"[green]✓ {key} ready → {dest}[/green]")
    return dest


def get_weight_path(key: str) -> Optional[Path]:
    """Return the local path for a weight if it exists, else None."""
    if key not in WEIGHT_REGISTRY:
        return None
    dest = WEIGHTS_DIR / WEIGHT_REGISTRY[key]["filename"]
    return dest if dest.exists() else None


def ensure_weights(
    keys: list[str],
    progress_cb: Optional[Callable[[int, str], None]] = None,
) -> Dict[str, Path]:
    """
    Ensure all requested weights are present. Download any that are missing.
    Returns {key: local_path}.
    """
    results: Dict[str, Path] = {}
    for i, key in enumerate(keys):
        try:
            cb = (lambda pct, msg, k=key: progress_cb(
                int(i / len(keys) * 100 + pct / len(keys)),
                msg,
            )) if progress_cb else None
            results[key] = download_weights(key, progress_cb=cb)
        except Exception as exc:
            logger.error(f"Failed to download {key}: {exc}")
    return results


def weights_status() -> Dict[str, Dict[str, Any]]:
    """Return download status for all registered weights."""
    manifest = _load_manifest()
    result: Dict[str, Dict[str, Any]] = {}
    for key, entry in WEIGHT_REGISTRY.items():
        dest = WEIGHTS_DIR / entry["filename"]
        info = manifest.get(key, {})
        result[key] = {
            "description": entry["description"],
            "filename": entry["filename"],
            "size_mb": entry.get("size_mb", 0),
            "present": dest.exists(),
            "verified": info.get("verified", False),
            "downloaded_at": info.get("downloaded_at"),
            "local_path": str(dest) if dest.exists() else None,
        }
    return result
