"""
PANOPTICON Dataset Base Classes
Production-grade abstract base for all dataset managers.
"""

from __future__ import annotations

import abc
import hashlib
import json
import logging
import os
import shutil
import tarfile
import time
import zipfile
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import requests
from rich.console import Console
from rich.progress import (
    BarColumn, DownloadColumn, Progress, SpinnerColumn,
    TextColumn, TimeElapsedColumn, TransferSpeedColumn,
)

logger = logging.getLogger("panopticon.datasets")
console = Console()

DATASETS_ROOT = Path(__file__).parent.parent / "datasets"
CACHE_DIR = DATASETS_ROOT / ".cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class DatasetMeta:
    name: str
    version: str
    size_bytes: int
    num_samples: int
    downloaded_at: str
    checksum: str
    status: str  # "ready" | "partial" | "missing"
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def save(self, path: Path) -> None:
        path.write_text(json.dumps(self.to_dict(), indent=2))

    @classmethod
    def load(cls, path: Path) -> "DatasetMeta":
        data = json.loads(path.read_text())
        return cls(**data)


class DownloadProgressCallback:
    """Tracks download progress for WebSocket/Celery reporting."""

    def __init__(self, callback: Optional[Callable[[int, int, float], None]] = None):
        self.callback = callback
        self.downloaded = 0
        self.total = 0
        self.start_time = time.time()

    def update(self, chunk_size: int) -> None:
        self.downloaded += chunk_size
        elapsed = time.time() - self.start_time
        speed = self.downloaded / elapsed if elapsed > 0 else 0
        pct = int(self.downloaded / self.total * 100) if self.total > 0 else 0
        if self.callback:
            self.callback(pct, self.downloaded, speed)


def compute_checksum(path: Path, algorithm: str = "md5") -> str:
    """Compute file checksum — md5 or sha256."""
    h = hashlib.new(algorithm)
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download_file(
    url: str,
    dest: Path,
    expected_checksum: Optional[str] = None,
    checksum_algo: str = "md5",
    progress_cb: Optional[DownloadProgressCallback] = None,
    chunk_size: int = 1 << 20,
    retries: int = 3,
) -> Path:
    """
    Download a file with progress tracking, retry logic, and optional checksum verification.
    Resumes partial downloads via HTTP Range header.
    """
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")

    for attempt in range(1, retries + 1):
        try:
            headers = {}
            resume_pos = tmp.stat().st_size if tmp.exists() else 0
            if resume_pos > 0:
                headers["Range"] = f"bytes={resume_pos}-"
                logger.info(f"Resuming download from byte {resume_pos:,}")

            resp = requests.get(url, stream=True, headers=headers, timeout=60)

            if resp.status_code == 416:  # Range not satisfiable — file already complete
                tmp.rename(dest)
                return dest

            resp.raise_for_status()
            total = int(resp.headers.get("content-length", 0)) + resume_pos

            if progress_cb:
                progress_cb.total = total
                progress_cb.downloaded = resume_pos

            mode = "ab" if resume_pos > 0 else "wb"
            with open(tmp, mode) as f:
                with Progress(
                    SpinnerColumn(),
                    TextColumn("[bold cyan]{task.description}"),
                    BarColumn(),
                    DownloadColumn(),
                    TransferSpeedColumn(),
                    TimeElapsedColumn(),
                    console=console,
                ) as progress:
                    task = progress.add_task(f"[cyan]Downloading {dest.name}", total=total)
                    progress.advance(task, resume_pos)
                    for chunk in resp.iter_content(chunk_size=chunk_size):
                        if chunk:
                            f.write(chunk)
                            progress.advance(task, len(chunk))
                            if progress_cb:
                                progress_cb.update(len(chunk))

            tmp.rename(dest)

            if expected_checksum:
                logger.info(f"Verifying checksum ({checksum_algo})…")
                actual = compute_checksum(dest, checksum_algo)
                if actual != expected_checksum:
                    dest.unlink()
                    raise ValueError(f"Checksum mismatch: expected {expected_checksum}, got {actual}")
                logger.info("Checksum verified ✓")

            return dest

        except (requests.RequestException, OSError) as exc:
            logger.warning(f"Attempt {attempt}/{retries} failed: {exc}")
            if attempt == retries:
                raise
            time.sleep(2 ** attempt)

    raise RuntimeError(f"Failed to download {url} after {retries} attempts")


def extract_archive(archive: Path, dest: Path) -> None:
    """Extract zip or tar.gz/tar archives with progress."""
    dest.mkdir(parents=True, exist_ok=True)
    console.print(f"[cyan]Extracting {archive.name} → {dest}[/cyan]")

    if zipfile.is_zipfile(archive):
        with zipfile.ZipFile(archive, "r") as zf:
            members = zf.infolist()
            with Progress(
                SpinnerColumn(),
                TextColumn("[bold cyan]{task.description}"),
                BarColumn(),
                TextColumn("{task.completed}/{task.total} files"),
                console=console,
            ) as progress:
                task = progress.add_task("Extracting", total=len(members))
                for member in members:
                    zf.extract(member, dest)
                    progress.advance(task)
    elif tarfile.is_tarfile(archive):
        with tarfile.open(archive, "r:*") as tf:
            members = tf.getmembers()
            with Progress(
                SpinnerColumn(),
                TextColumn("[bold cyan]{task.description}"),
                BarColumn(),
                TextColumn("{task.completed}/{task.total} files"),
                console=console,
            ) as progress:
                task = progress.add_task("Extracting", total=len(members))
                for member in members:
                    tf.extract(member, dest, set_attrs=False)
                    progress.advance(task)
    else:
        raise ValueError(f"Unknown archive format: {archive}")

    console.print(f"[green]✓ Extracted to {dest}[/green]")


class BaseDatasetManager(abc.ABC):
    """
    Abstract base for all PANOPTICON dataset managers.
    Subclass and implement: urls, verify(), prepare().
    """

    name: str = ""
    version: str = "1.0"
    expected_size_gb: float = 0.0

    def __init__(
        self,
        root: Optional[Path] = None,
        progress_callback: Optional[Callable[[int, int, float], None]] = None,
        force_redownload: bool = False,
    ):
        self.root = (root or DATASETS_ROOT / self.name).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.meta_file = self.root / "metadata.json"
        self.force = force_redownload
        self._progress_cb = DownloadProgressCallback(progress_callback)
        self.logger = logging.getLogger(f"panopticon.datasets.{self.name}")

    # ── Public API ──────────────────────────────────────────────────────────

    def download(self) -> "BaseDatasetManager":
        """Download all required files if not already cached."""
        if not self.force and self._is_ready():
            console.print(f"[green]✓ {self.name} already downloaded and verified[/green]")
            return self
        self._do_download()
        return self

    def verify(self) -> bool:
        """Return True if dataset files pass integrity checks."""
        return self._verify_files()

    def extract(self) -> "BaseDatasetManager":
        """Extract all downloaded archives."""
        self._do_extract()
        return self

    def prepare(self) -> "BaseDatasetManager":
        """Run dataset-specific preparation (index building, annotation parsing, etc.)."""
        self._do_prepare()
        return self

    def cache(self) -> Dict[str, Any]:
        """Return cached metadata dict, loading from disk if available."""
        if self.meta_file.exists():
            return json.loads(self.meta_file.read_text())
        return {}

    def get_meta(self) -> Optional[DatasetMeta]:
        if self.meta_file.exists():
            return DatasetMeta.load(self.meta_file)
        return None

    def status(self) -> str:
        if self._is_ready():
            return "ready"
        if any(self.root.iterdir()):
            return "partial"
        return "missing"

    # ── Abstract hooks ──────────────────────────────────────────────────────

    @abc.abstractmethod
    def _do_download(self) -> None: ...

    @abc.abstractmethod
    def _do_extract(self) -> None: ...

    @abc.abstractmethod
    def _do_prepare(self) -> None: ...

    @abc.abstractmethod
    def _verify_files(self) -> bool: ...

    @abc.abstractmethod
    def _is_ready(self) -> bool: ...

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _save_meta(self, num_samples: int, extra: Dict[str, Any] = {}) -> None:
        size = sum(
            f.stat().st_size
            for f in self.root.rglob("*")
            if f.is_file() and f.suffix not in (".part",)
        )
        meta = DatasetMeta(
            name=self.name,
            version=self.version,
            size_bytes=size,
            num_samples=num_samples,
            downloaded_at=datetime.utcnow().isoformat(),
            checksum="",
            status="ready",
            extra=extra,
        )
        meta.save(self.meta_file)
        self.logger.info(f"Metadata saved: {num_samples} samples, {size / 1e9:.2f} GB")

    def _dl(self, url: str, filename: str, checksum: Optional[str] = None, algo: str = "md5") -> Path:
        dest = self.root / filename
        if dest.exists() and not self.force:
            self.logger.info(f"Already downloaded: {filename}")
            return dest
        return download_file(url, dest, checksum, algo, self._progress_cb)
