"""
PANOPTICON Data Engineering CLI
Run the complete dataset download + EDA pipeline from the command line.

Usage:
    python ai/run_pipeline.py                          # Full pipeline (all datasets)
    python ai/run_pipeline.py --dataset coco           # Single dataset
    python ai/run_pipeline.py --eda-only               # EDA only (no download)
    python ai/run_pipeline.py --download-only          # Download only
    python ai/run_pipeline.py --dataset coco --force   # Force re-download
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Ensure project root is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("panopticon.pipeline")


def main():
    parser = argparse.ArgumentParser(
        description="PANOPTICON Data Engineering + EDA Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--dataset", default="all",
                        choices=["all", "coco", "mot17", "market1501", "scannet"],
                        help="Dataset to process (default: all)")
    parser.add_argument("--eda-only", action="store_true",
                        help="Skip download, run EDA only")
    parser.add_argument("--download-only", action="store_true",
                        help="Download only, skip EDA")
    parser.add_argument("--preprocess", action="store_true",
                        help="Also run preprocessing after EDA")
    parser.add_argument("--force", action="store_true",
                        help="Force re-download even if files exist")
    args = parser.parse_args()

    datasets = (
        ["coco", "mot17", "market1501", "scannet"]
        if args.dataset == "all"
        else [args.dataset]
    )

    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel

    console = Console()
    console.print(Panel.fit(
        "[bold cyan]PANOPTICON[/bold cyan] Data Engineering + EDA Pipeline\n"
        f"Datasets: [yellow]{', '.join(datasets)}[/yellow]",
        border_style="cyan",
    ))

    # ── Step 1: Download ────────────────────────────────────────────────────
    if not args.eda_only:
        console.print("\n[bold]Step 1: Dataset Download[/bold]")
        from ai.datasets.registry import run_pipeline

        for name in datasets:
            console.print(f"  ↳ [cyan]{name}[/cyan]…")
            try:
                result = run_pipeline(name, force=args.force)
                status = result.get("status", "unknown")
                icon = "✓" if status == "ready" else "⚠"
                console.print(f"    [{icon}] {name}: [green]{status}[/green]")
            except Exception as e:
                console.print(f"    [✗] {name}: [red]FAILED — {e}[/red]")

    # ── Step 2: EDA ─────────────────────────────────────────────────────────
    if not args.download_only:
        console.print("\n[bold]Step 2: Exploratory Data Analysis[/bold]")
        from ai.eda.pipeline import run_all_eda

        def progress_cb(name, pct, msg):
            if pct % 20 == 0:
                console.print(f"    [{pct:3d}%] [{name}] {msg}")

        try:
            result = run_all_eda(datasets=datasets, progress_cb=progress_cb)
            console.print("  ✓ [green]EDA complete[/green]")
        except Exception as e:
            console.print(f"  [red]EDA failed: {e}[/red]")
            logger.exception("EDA failure")

    # ── Step 3: Preprocessing ───────────────────────────────────────────────
    if args.preprocess:
        console.print("\n[bold]Step 3: Preprocessing[/bold]")
        from ai.preprocessing.pipeline import run_preprocessing

        for name in datasets:
            console.print(f"  ↳ [cyan]{name}[/cyan]…")
            try:
                result = run_preprocessing(name)
                console.print(f"    ✓ {result}")
            except Exception as e:
                console.print(f"    [red]Failed: {e}[/red]")

    # ── Summary table ────────────────────────────────────────────────────────
    console.print("\n[bold]Summary[/bold]")
    from ai.datasets.registry import list_datasets

    table = Table(show_header=True, header_style="bold cyan", border_style="dim")
    table.add_column("Dataset", style="cyan", width=14)
    table.add_column("Status", width=10)
    table.add_column("Samples", justify="right")
    table.add_column("Size", justify="right")
    table.add_column("EDA Report")

    all_info = list_datasets()
    for name, info in all_info.items():
        if name not in datasets:
            continue
        meta = info.get("meta", {})
        status = info["status"]
        status_color = "green" if status == "ready" else "yellow" if status == "partial" else "red"
        samples = str(meta.get("num_samples", "—"))
        size_bytes = meta.get("size_bytes", 0)
        size_str = f"{size_bytes / 1e9:.2f} GB" if size_bytes else "—"
        report = "✓" if (Path(__file__).parent / "eda" / name / "EDA_Report.html").exists() else "—"
        table.add_row(
            name,
            f"[{status_color}]{status}[/{status_color}]",
            samples,
            size_str,
            report,
        )

    console.print(table)
    console.print("\n[dim]Reports: ai/eda/<dataset>/EDA_Report.html[/dim]")
    console.print("[dim]Summary: ai/reports/Summary.json[/dim]\n")


if __name__ == "__main__":
    main()
