"""
PANOPTICON EDA Base
Shared plotting utilities and report scaffold used by all dataset EDA modules.
"""

from __future__ import annotations

import csv
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import matplotlib
matplotlib.use("Agg")  # non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import pandas as pd
import seaborn as sns

try:
    import plotly.express as px
    import plotly.graph_objects as go
    from plotly.subplots import make_subplots
    PLOTLY_AVAILABLE = True
except ImportError:
    PLOTLY_AVAILABLE = False

logger = logging.getLogger("panopticon.eda")

# ── Global style ────────────────────────────────────────────────────────────
PALETTE = {
    "primary":   "#00b4d8",
    "secondary": "#1565c0",
    "success":   "#22c55e",
    "warning":   "#f59e0b",
    "danger":    "#ef4444",
    "purple":    "#a78bfa",
    "bg":        "#0a0f1e",
    "surface":   "#111827",
    "text":      "#e2e8f0",
}

COLORS = [PALETTE["primary"], PALETTE["warning"], PALETTE["success"],
          PALETTE["danger"], PALETTE["purple"], PALETTE["secondary"],
          "#fb923c", "#38bdf8", "#4ade80", "#f472b6"]

sns.set_theme(style="darkgrid", palette=COLORS)
plt.rcParams.update({
    "figure.facecolor": PALETTE["bg"],
    "axes.facecolor":   PALETTE["surface"],
    "axes.edgecolor":   "#374151",
    "axes.labelcolor":  PALETTE["text"],
    "axes.titlecolor":  PALETTE["text"],
    "xtick.color":      "#9ca3af",
    "ytick.color":      "#9ca3af",
    "text.color":       PALETTE["text"],
    "grid.color":       "#1f2937",
    "grid.linewidth":   0.5,
    "figure.dpi":       120,
    "savefig.dpi":      150,
    "savefig.bbox":     "tight",
    "savefig.facecolor": PALETTE["bg"],
    "font.family":      "DejaVu Sans",
})


def savefig(fig: plt.Figure, path: Path, close: bool = True) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=150, bbox_inches="tight", facecolor=PALETTE["bg"])
    if close:
        plt.close(fig)
    logger.debug(f"Saved: {path.name}")
    return path


def bar_chart(
    labels: List[str],
    values: List[float],
    title: str,
    xlabel: str,
    ylabel: str,
    output: Path,
    color: str = PALETTE["primary"],
    top_n: int = 30,
    horizontal: bool = False,
) -> Path:
    if top_n and len(labels) > top_n:
        paired = sorted(zip(values, labels), reverse=True)[:top_n]
        values, labels = zip(*paired)
        values, labels = list(values), list(labels)

    fig, ax = plt.subplots(figsize=(12, 6))
    x = range(len(labels))

    if horizontal:
        bars = ax.barh(labels, values, color=color, alpha=0.85, edgecolor="#374151")
        ax.set_xlabel(ylabel)
        ax.set_ylabel(xlabel)
        for bar in bars:
            w = bar.get_width()
            ax.text(w + max(values) * 0.01, bar.get_y() + bar.get_height() / 2,
                    f"{w:,.0f}", va="center", fontsize=7, color=PALETTE["text"])
    else:
        bars = ax.bar(x, values, color=color, alpha=0.85, edgecolor="#374151", width=0.7)
        ax.set_xticks(list(x))
        ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=8)
        ax.set_xlabel(xlabel)
        ax.set_ylabel(ylabel)
        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width() / 2, h + max(values) * 0.01,
                    f"{h:,.0f}", ha="center", fontsize=7, color=PALETTE["text"])

    ax.set_title(title, fontsize=14, fontweight="bold", pad=12)
    fig.tight_layout()
    return savefig(fig, output)


def histogram(
    data: List[float],
    title: str,
    xlabel: str,
    ylabel: str,
    output: Path,
    bins: int = 50,
    color: str = PALETTE["primary"],
    log_scale: bool = False,
) -> Path:
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.hist(data, bins=bins, color=color, alpha=0.8, edgecolor="#374151", linewidth=0.4)
    if log_scale:
        ax.set_yscale("log")
    ax.set_title(title, fontsize=14, fontweight="bold", pad=12)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    # Stats annotation
    arr = np.array(data)
    stats_txt = f"μ={arr.mean():.1f}  σ={arr.std():.1f}  min={arr.min():.1f}  max={arr.max():.1f}"
    ax.text(0.98, 0.95, stats_txt, transform=ax.transAxes,
            ha="right", va="top", fontsize=8, color="#94a3b8",
            bbox=dict(boxstyle="round,pad=0.3", fc=PALETTE["surface"], ec="#374151", alpha=0.8))
    fig.tight_layout()
    return savefig(fig, output)


def pie_chart(
    labels: List[str],
    values: List[float],
    title: str,
    output: Path,
    top_n: int = 12,
) -> Path:
    if len(labels) > top_n:
        paired = sorted(zip(values, labels), reverse=True)
        top = paired[:top_n - 1]
        other_val = sum(v for v, _ in paired[top_n - 1:])
        top.append((other_val, "Other"))
        values, labels = zip(*top)
        values, labels = list(values), list(labels)

    fig, ax = plt.subplots(figsize=(9, 7))
    wedge_props = dict(width=0.6, edgecolor=PALETTE["bg"], linewidth=1.5)
    ax.pie(
        values, labels=labels, colors=COLORS[:len(labels)],
        autopct="%1.1f%%", pctdistance=0.75,
        wedgeprops=wedge_props, startangle=140,
        textprops={"color": PALETTE["text"], "fontsize": 8},
    )
    ax.set_title(title, fontsize=14, fontweight="bold", pad=12)
    fig.tight_layout()
    return savefig(fig, output)


def heatmap_chart(
    matrix: np.ndarray,
    xlabels: List[str],
    ylabels: List[str],
    title: str,
    output: Path,
    fmt: str = ".2f",
    cmap: str = "Blues",
) -> Path:
    fig, ax = plt.subplots(figsize=(max(8, len(xlabels) * 0.6), max(6, len(ylabels) * 0.5)))
    sns.heatmap(
        matrix, annot=len(xlabels) <= 20, fmt=fmt,
        xticklabels=xlabels, yticklabels=ylabels,
        cmap=cmap, ax=ax, linewidths=0.3, linecolor="#374151",
        annot_kws={"size": 8},
    )
    ax.set_title(title, fontsize=14, fontweight="bold", pad=12)
    plt.xticks(rotation=45, ha="right", fontsize=8)
    plt.yticks(fontsize=8)
    fig.tight_layout()
    return savefig(fig, output)


def scatter_plot(
    x: List[float],
    y: List[float],
    title: str,
    xlabel: str,
    ylabel: str,
    output: Path,
    color: str = PALETTE["primary"],
    alpha: float = 0.4,
    size: int = 8,
) -> Path:
    fig, ax = plt.subplots(figsize=(9, 6))
    ax.scatter(x, y, c=color, alpha=alpha, s=size, edgecolors="none")
    ax.set_title(title, fontsize=14, fontweight="bold", pad=12)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    fig.tight_layout()
    return savefig(fig, output)


def boxplot_chart(
    data: Dict[str, List[float]],
    title: str,
    ylabel: str,
    output: Path,
) -> Path:
    fig, ax = plt.subplots(figsize=(max(8, len(data) * 1.2), 6))
    bp = ax.boxplot(
        list(data.values()),
        labels=list(data.keys()),
        patch_artist=True,
        medianprops=dict(color=PALETTE["warning"], linewidth=2),
        boxprops=dict(facecolor=PALETTE["primary"] + "44", edgecolor=PALETTE["primary"]),
        whiskerprops=dict(color=PALETTE["text"]),
        capprops=dict(color=PALETTE["text"]),
        flierprops=dict(marker="o", markerfacecolor=PALETTE["danger"], markersize=3, alpha=0.4),
    )
    ax.set_title(title, fontsize=14, fontweight="bold", pad=12)
    ax.set_ylabel(ylabel)
    plt.xticks(rotation=30, ha="right")
    fig.tight_layout()
    return savefig(fig, output)


class BaseEDA:
    """Abstract EDA class with report scaffolding."""

    dataset_name: str = ""

    def __init__(self, output_dir: Path):
        self.out = output_dir
        self.out.mkdir(parents=True, exist_ok=True)
        (self.out / "plots").mkdir(exist_ok=True)
        (self.out / "data").mkdir(exist_ok=True)
        self.report: Dict[str, Any] = {
            "dataset": self.dataset_name,
            "generated_at": datetime.utcnow().isoformat(),
            "sections": {},
        }
        self.csv_rows: List[Dict] = []
        self.logger = logging.getLogger(f"panopticon.eda.{self.dataset_name}")

    def run(self) -> Dict[str, Any]:
        """Execute full EDA pipeline and return report dict."""
        raise NotImplementedError

    def export(self) -> None:
        """Export JSON report, CSV statistics, and HTML report."""
        # JSON
        json_path = self.out / "EDA_Report.json"
        json_path.write_text(json.dumps(self.report, indent=2))

        # CSV
        if self.csv_rows:
            csv_path = self.out / "Statistics.csv"
            with open(csv_path, "w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=self.csv_rows[0].keys())
                writer.writeheader()
                writer.writerows(self.csv_rows)

        # HTML
        self._export_html()
        self.logger.info(f"EDA exported to {self.out}")

    def _export_html(self) -> None:
        plots = sorted((self.out / "plots").glob("*.png"))
        plot_tags = "\n".join(
            f'<div class="card"><h3>{p.stem.replace("_", " ").title()}</h3>'
            f'<img src="plots/{p.name}" loading="lazy"/></div>'
            for p in plots
        )

        # Flatten sections to a summary table
        rows = ""
        for section, data in self.report.get("sections", {}).items():
            if isinstance(data, dict):
                for k, v in data.items():
                    rows += f"<tr><td>{section}</td><td>{k}</td><td>{v}</td></tr>"

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PANOPTICON EDA — {self.dataset_name}</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Segoe UI', system-ui, sans-serif; background: #03050d; color: #e2e8f0; }}
  header {{ background: linear-gradient(135deg, #00b4d8, #1565c0); padding: 2rem 3rem; }}
  header h1 {{ font-size: 2rem; font-weight: 800; letter-spacing: -0.03em; }}
  header p {{ opacity: 0.8; margin-top: 0.5rem; }}
  main {{ max-width: 1400px; margin: 2rem auto; padding: 0 2rem; }}
  h2 {{ font-size: 1.25rem; font-weight: 700; color: #00b4d8; margin: 2rem 0 1rem; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(580px, 1fr)); gap: 1.5rem; }}
  .card {{ background: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; padding: 1rem; }}
  .card h3 {{ font-size: 0.85rem; color: #9ca3af; margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }}
  .card img {{ width: 100%; border-radius: 6px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 0.875rem; }}
  th {{ background: #1f2937; padding: 0.6rem 1rem; text-align: left; color: #9ca3af; font-size: 0.75rem; text-transform: uppercase; }}
  td {{ padding: 0.5rem 1rem; border-bottom: 1px solid #1f2937; }}
  tr:hover td {{ background: #1a2234; }}
  footer {{ text-align: center; padding: 2rem; color: #4b5563; font-size: 0.75rem; }}
  .badge {{ display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.7rem; font-weight: 700;
            background: rgba(0,180,216,0.15); color: #00b4d8; border: 1px solid rgba(0,180,216,0.3); }}
</style>
</head>
<body>
<header>
  <h1>PANOPTICON EDA</h1>
  <p>Dataset: <strong>{self.dataset_name.upper()}</strong> &nbsp;|&nbsp;
     Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} &nbsp;|&nbsp;
     <span class="badge">FORENSIC INTELLIGENCE</span></p>
</header>
<main>
  <h2>📊 Visualizations</h2>
  <div class="grid">{plot_tags}</div>
  <h2>📋 Statistics Summary</h2>
  <table>
    <thead><tr><th>Section</th><th>Metric</th><th>Value</th></tr></thead>
    <tbody>{rows}</tbody>
  </table>
</main>
<footer>PANOPTICON AI Forensic Intelligence Platform · Law Enforcement Use Only</footer>
</body>
</html>"""
        (self.out / "EDA_Report.html").write_text(html, encoding="utf-8")

    def _plot(self, name: str) -> Path:
        return self.out / "plots" / f"{name}.png"

    def _data(self, name: str) -> Path:
        return self.out / "data" / f"{name}.csv"
