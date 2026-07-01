# PANOPTICON – AI Forensic Intelligence Platform

> Transform fragmented visual evidence into structured, explainable forensic intelligence.

PANOPTICON is an enterprise-grade forensic investigation platform powered by AI. It enables law enforcement and forensic analysts to reconstruct crime scenes, track suspects across camera networks, generate AI-powered timelines, and produce professional forensic reports.

---

# Architecture

```text
panopticon/
├── frontend/
│   ├── src/
│   │   └── components/
│   │       └── scene3d/         # 3D crime scene visualization
│   └── ...
├── backend/                     # FastAPI · Python 3.11
├── ai/
│   ├── models/                  # YOLOv8, FastReID, ByteTrack weights
│   └── services/                # Computer vision pipeline, LLM service
├── database/                    # PostgreSQL schema + migrations
├── docker/                      # Docker Compose stack
└── docs/                        # Architecture docs & screenshots
```

---

# Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Zustand, Three.js, React Three Fiber |
| Backend | FastAPI, Python 3.11, SQLAlchemy, AsyncPG |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Vector DB | ChromaDB |
| AI Vision | YOLOv8, ByteTrack, FastReID, SAM2, OpenCV |
| AI Language | Gemini Pro, Qwen, Llama |
| Embeddings | BGE-M3 |
| Auth | JWT (HS256) |

---

# Quick Start

## Prerequisites

- Node.js 20+
- Python 3.11+
- Docker + Docker Compose
- Git

---

## 1. Start Infrastructure

```bash
cd docker
docker compose up -d postgres redis chromadb
```

---

## 2. Backend

```bash
cd backend

python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

# Edit .env as needed

python -m uvicorn app.main:app --reload
```

API Docs:

```text
http://localhost:8000/api/docs
```

---

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Application:

```text
http://localhost:3000
```

---

# Demo Login

**Email**

```text
analyst@panopticon.gov
```

**Password**

```text
demo1234
```

---

# Modules

| Module | Route | Description |
|---|---|---|
| Dashboard | `/dashboard` | Operations overview, system stats, activity feed |
| Cases | `/cases` | Case management, creation and filtering |
| Case Detail | `/cases/[id]` | Evidence, suspects, timeline and reports |
| Evidence | `/evidence` | Upload, browse and AI analysis |
| Investigation | `/investigation` | Multi-camera viewer, timeline scrubber and interactive 3D crime scene mode |
| AI Copilot | `/ai-assistant` | Natural language forensic Q&A |
| Live Tracking | `/tracking` | Real-time suspect tracking |
| Reports | `/reports` | AI-generated forensic report viewer |
| Settings | `/settings` | Users, models, storage and system configuration |

---

# Features

## Investigation Platform

- Multi-camera investigation workspace
- Interactive 3D crime scene reconstruction
- Timeline-based event analysis
- Evidence marker visualization
- AI-assisted forensic analysis
- Cross-camera suspect tracking
- Automated report generation

---

## AI Capabilities

- Object detection using YOLOv8
- Multi-object tracking using ByteTrack
- Cross-camera re-identification
- Event timeline generation
- Natural language forensic querying
- Explainable AI-assisted reporting

---

# Investigation Workflow

```text
Video Evidence
      ↓
AI Detection Pipeline
      ↓
Timeline Generation
      ↓
Multi-Camera Investigation
      ↓
3D Crime Scene Reconstruction
      ↓
Evidence Correlation
      ↓
Forensic Report Generation
```

---

# AI Pipeline

```text
Video Upload
    │
    ▼
Frame Extraction (OpenCV)
    │
    ▼
Object Detection (YOLOv8)
    │
    ▼
Multi-Person Tracking (ByteTrack)
    │
    ▼
Appearance Embedding (FastReID / BGE-M3)
    │
    ▼
Cross-Camera Re-ID (ChromaDB similarity search)
    │
    ▼
Event Detection + Timeline Generation
    │
    ▼
LLM Synthesis (Gemini Pro)
    │
    ▼
Structured Forensic Output
```

---

# Screenshots

Create:

```text
docs/
└── screenshots/
    ├── dashboard.png
    ├── investigation.png
    └── crime-scene-3d.png
```

Then add screenshots here.

```md
![Dashboard](docs/screenshots/dashboard.png)

![Investigation](docs/screenshots/investigation.png)

![3D Crime Scene](docs/screenshots/crime-scene-3d.png)
```

---

# Environment Variables

See:

```text
backend/.env.example
```

Important variables:

- `GEMINI_API_KEY`
- `DATABASE_URL`
- `SECRET_KEY`
- `GPU_ENABLED`
- `STORAGE_BACKEND`
- `CHROMA_HOST`
- `CHROMA_PORT`

---

# Production Notes

- Replace `SECRET_KEY` with a secure value.
- Configure S3 storage.
- Set `GPU_ENABLED=true` for accelerated inference.
- Enable Redis persistence and PostgreSQL backups.
- Configure TLS/SSL using Nginx or Caddy.
- Set:

```env
DEBUG=false
ENVIRONMENT=production
```

---

# Roadmap

## Completed

- [x] Multi-camera investigation workspace
- [x] Interactive 3D crime scene visualization
- [x] Timeline generation
- [x] AI copilot
- [x] Report generation

---

## In Progress

- [ ] Real-time YOLO integration
- [ ] Evidence placement from detections
- [ ] Camera synchronization
- [ ] Cross-camera suspect reconstruction
- [ ] Automated scene reconstruction
- [ ] Scene timeline playback
- [ ] Real-time evidence metadata panel

---

# Recent Updates (v1.1)

- Added interactive 3D crime scene visualization mode.
- Added React Three Fiber and Three.js integration.
- Added evidence markers and metadata support.
- Improved Docker compatibility.
- Added modular 3D scene architecture.

---

# License

**Restricted — Law Enforcement Use Only**

© 2026 PANOPTICON Intelligence Systems
