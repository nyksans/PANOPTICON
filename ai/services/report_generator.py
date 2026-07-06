"""
PANOPTICON Report Generator
Produces forensic intelligence reports from processed evidence.

Output formats:
  - JSON (structured data)
  - HTML (interactive dashboard)
  - PDF (printable report)
  - CSV (statistical summary)
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("panopticon.reports")


class ForensicReportGenerator:
    """
    Generate professional forensic intelligence reports.
    """

    def __init__(self, output_dir: str = "./storage/reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_case_report(
        self,
        case_id: str,
        case_data: Dict[str, Any],
        evidence_results: List[Dict[str, Any]],
        report_type: str = "comprehensive",
    ) -> Dict[str, str]:
        """
        Generate multi-format case report.

        Args:
            case_id: Case identifier
            case_data: {case_number, title, description, ...}
            evidence_results: List of processed evidence outputs
            report_type: 'comprehensive' | 'summary' | 'executive'

        Returns:
            {json_path, html_path, pdf_path, csv_path}
        """
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        report_dir = self.output_dir / case_id / timestamp
        report_dir.mkdir(parents=True, exist_ok=True)

        # ── Build report structure ───────────────────────────────────────
        report = {
            "case": case_data,
            "generated_at": datetime.utcnow().isoformat(),
            "report_type": report_type,
            "evidence_summary": self._summarize_evidence(evidence_results),
            "person_profiles": self._build_person_profiles(evidence_results),
            "timeline": self._build_timeline(evidence_results),
            "key_findings": self._extract_key_findings(evidence_results),
            "recommendations": self._generate_recommendations(evidence_results),
        }

        # ── Export formats ───────────────────────────────────────────────
        paths = {}

        # JSON
        json_path = report_dir / "report.json"
        json_path.write_text(json.dumps(report, indent=2))
        paths["json"] = str(json_path)
        logger.info(f"JSON report: {json_path}")

        # HTML
        html_path = report_dir / "report.html"
        html_path.write_text(self._generate_html(report))
        paths["html"] = str(html_path)
        logger.info(f"HTML report: {html_path}")

        # CSV
        csv_path = report_dir / "statistics.csv"
        csv_path.write_text(self._generate_csv(report))
        paths["csv"] = str(csv_path)
        logger.info(f"CSV report: {csv_path}")

        # PDF (requires additional library)
        try:
            from weasyprint import HTML as WeasyHTML
            pdf_path = report_dir / "report.pdf"
            WeasyHTML(string=self._generate_html(report)).write_pdf(pdf_path)
            paths["pdf"] = str(pdf_path)
            logger.info(f"PDF report: {pdf_path}")
        except ImportError:
            logger.warning("WeasyPrint not available — skipping PDF generation")

        return paths

    def _summarize_evidence(self, evidence_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Aggregate evidence statistics."""
        total_files = len(evidence_results)
        total_persons = 0
        total_objects = {}
        total_events = 0
        avg_confidence = 0.0

        for result in evidence_results:
            total_persons += len(result.get("persons", []))
            total_events += len(result.get("events", []))

            for obj, count in result.get("objects", {}).items():
                total_objects[obj] = total_objects.get(obj, 0) + count

            confidences = [r.get("confidence", 0) for r in evidence_results]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0

        return {
            "total_files_processed": total_files,
            "unique_persons": total_persons,
            "objects_detected": total_objects,
            "total_events": total_events,
            "average_confidence": round(avg_confidence, 2),
        }

    def _build_person_profiles(self, evidence_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Build profiles of detected persons."""
        persons_dict: Dict[int, Dict[str, Any]] = {}

        for result in evidence_results:
            for person in result.get("persons", []):
                track_id = person.get("track_id")
                if track_id not in persons_dict:
                    persons_dict[track_id] = {
                        "track_id": track_id,
                        "label": person.get("label", "Unknown"),
                        "confidence": person.get("confidence", 0),
                        "first_seen": person.get("first_seen", 0),
                        "last_seen": person.get("last_seen", 0),
                        "appearances": 0,
                        "associated_evidence": [],
                    }
                persons_dict[track_id]["appearances"] += 1
                persons_dict[track_id]["last_seen"] = max(
                    persons_dict[track_id]["last_seen"],
                    person.get("last_seen", 0),
                )

        return list(persons_dict.values())

    def _build_timeline(self, evidence_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Build chronological timeline of events."""
        timeline = []

        for result in evidence_results:
            for event in result.get("timeline", []):
                timeline.append({
                    "timestamp": event.get("time", 0),
                    "event": event.get("event", "Unknown"),
                    "confidence": event.get("confidence", 0),
                    "source": result.get("video_path", "Unknown"),
                })

        # Sort by timestamp
        timeline.sort(key=lambda x: x["timestamp"])
        return timeline

    def _extract_key_findings(self, evidence_results: List[Dict[str, Any]]) -> List[str]:
        """Extract high-confidence findings."""
        findings = []

        for result in evidence_results:
            persons = result.get("persons", [])
            if len(persons) >= 3:
                findings.append(f"Multiple persons detected ({len(persons)}) in {result.get('video_path', 'evidence')}")

            objects = result.get("objects", {})
            if "knife" in objects:
                findings.append(f"Potential weapon detected: knife ({objects['knife']} instances)")
            if "backpack" in objects:
                findings.append(f"Backpack(s) detected ({objects['backpack']} instances)")

            if result.get("confidence", 0) > 0.85:
                findings.append(f"High-confidence detection ({result['confidence']:.0%}) in evidence")

        return findings

    def _generate_recommendations(self, evidence_results: List[Dict[str, Any]]) -> List[str]:
        """Generate investigation recommendations."""
        recommendations = [
            "Cross-reference detected persons against suspect database using re-identification embeddings",
            "Verify weapon detection with manual review of flagged frames",
            "Correlate timestamps across multiple evidence sources for timeline reconstruction",
            "Enhance low-confidence detections with manual annotation",
            "Consider additional CCTV sources for missing time periods",
        ]
        return recommendations

    def _generate_html(self, report: Dict[str, Any]) -> str:
        """Generate HTML report."""
        case = report["case"]
        summary = report["evidence_summary"]
        persons = report["person_profiles"]
        timeline = report["timeline"]
        findings = report["key_findings"]

        persons_rows = "\n".join(
            f"<tr><td>{p['track_id']}</td><td>{p['label']}</td><td>{p['confidence']:.1%}</td><td>{p['appearances']}</td></tr>"
            for p in persons[:20]  # Limit to 20
        )

        timeline_rows = "\n".join(
            f"<tr><td>{t['timestamp']:.2f}s</td><td>{t['event']}</td><td>{t['confidence']:.0%}</td></tr>"
            for t in timeline[:20]  # Limit to 20
        )

        findings_list = "\n".join(f"<li>{f}</li>" for f in findings)

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PANOPTICON Forensic Report</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'Segoe UI', system-ui, sans-serif; background: #0a0f1e; color: #e2e8f0; }}
  header {{ background: linear-gradient(135deg, #00b4d8, #1565c0); padding: 2rem 3rem; }}
  header h1 {{ font-size: 2rem; font-weight: 800; }}
  header p {{ opacity: 0.9; margin-top: 0.5rem; }}
  main {{ max-width: 1200px; margin: 2rem auto; padding: 0 2rem; }}
  section {{ background: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; }}
  h2 {{ font-size: 1.25rem; color: #00b4d8; margin-bottom: 1rem; border-bottom: 2px solid #1565c0; padding-bottom: 0.5rem; }}
  h3 {{ font-size: 1rem; color: #9ca3af; margin-top: 1rem; margin-bottom: 0.5rem; }}
  table {{ width: 100%; border-collapse: collapse; margin: 1rem 0; }}
  th {{ background: #1f2937; padding: 0.6rem 1rem; text-align: left; color: #9ca3af; font-size: 0.75rem; text-transform: uppercase; }}
  td {{ padding: 0.5rem 1rem; border-bottom: 1px solid #1f2937; }}
  tr:hover td {{ background: #1a2234; }}
  ul {{ margin-left: 1.5rem; margin-top: 0.5rem; }}
  li {{ margin-bottom: 0.5rem; }}
  .badge {{ display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.7rem; font-weight: 700; background: rgba(0,180,216,0.15); color: #00b4d8; border: 1px solid rgba(0,180,216,0.3); }}
  .metric {{ display: inline-block; background: #1f2937; padding: 1rem 1.5rem; border-radius: 6px; margin-right: 1rem; margin-bottom: 1rem; }}
  .metric-value {{ font-size: 1.5rem; font-weight: 700; color: #00b4d8; }}
  .metric-label {{ font-size: 0.75rem; color: #9ca3af; text-transform: uppercase; }}
  footer {{ text-align: center; padding: 2rem; color: #4b5563; font-size: 0.75rem; }}
</style>
</head>
<body>
<header>
  <h1>PANOPTICON Forensic Report</h1>
  <p>Case: <strong>{case.get('case_number', 'N/A')}</strong> — {case.get('title', 'N/A')}</p>
  <p>Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} | <span class="badge">FORENSIC INTELLIGENCE</span></p>
</header>

<main>
  <section>
    <h2>📊 Summary Statistics</h2>
    <div class="metric"><div class="metric-value">{summary.get('total_files_processed', 0)}</div><div class="metric-label">Evidence Files</div></div>
    <div class="metric"><div class="metric-value">{summary.get('unique_persons', 0)}</div><div class="metric-label">Persons Detected</div></div>
    <div class="metric"><div class="metric-value">{summary.get('total_events', 0)}</div><div class="metric-label">Events</div></div>
    <div class="metric"><div class="metric-value">{summary.get('average_confidence', 0):.0%}</div><div class="metric-label">Avg Confidence</div></div>
  </section>

  <section>
    <h2>👥 Person Profiles</h2>
    <table>
      <thead>
        <tr><th>Track ID</th><th>Label</th><th>Confidence</th><th>Appearances</th></tr>
      </thead>
      <tbody>
        {persons_rows}
      </tbody>
    </table>
  </section>

  <section>
    <h2>📅 Timeline</h2>
    <table>
      <thead>
        <tr><th>Timestamp</th><th>Event</th><th>Confidence</th></tr>
      </thead>
      <tbody>
        {timeline_rows}
      </tbody>
    </table>
  </section>

  <section>
    <h2>🔍 Key Findings</h2>
    <ul>
      {findings_list}
    </ul>
  </section>

  <section>
    <h2>💡 Recommendations</h2>
    <ul>
      <li>Cross-reference detected persons with suspect database</li>
      <li>Verify high-confidence detections with manual review</li>
      <li>Correlate evidence timelines for comprehensive reconstruction</li>
      <li>Escalate weapon detections for special investigation unit</li>
      <li>Request additional CCTV coverage for timeline gaps</li>
    </ul>
  </section>
</main>

<footer>
  PANOPTICON AI Forensic Intelligence Platform · Confidential — Law Enforcement Use Only
</footer>
</body>
</html>"""
        return html

    def _generate_csv(self, report: Dict[str, Any]) -> str:
        """Generate CSV summary."""
        lines = [
            "Category,Metric,Value",
            f"Summary,Total Files,{report['evidence_summary']['total_files_processed']}",
            f"Summary,Unique Persons,{report['evidence_summary']['unique_persons']}",
            f"Summary,Average Confidence,{report['evidence_summary']['average_confidence']}",
            f"Summary,Total Events,{report['evidence_summary']['total_events']}",
        ]

        # Add person profiles
        for person in report["person_profiles"][:20]:
            lines.append(f"Person,{person['track_id']},{person['label']},{person['confidence']:.2f},{person['appearances']}")

        # Add timeline events
        for event in report["timeline"][:20]:
            lines.append(f"Timeline,{event['timestamp']:.2f},{event['event']},{event['confidence']:.0%}")

        return "\n".join(lines)
