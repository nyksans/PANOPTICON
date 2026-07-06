# PANOPTICON Deployment Guide
## Production-Ready AI Forensic Intelligence Platform

**Version:** 1.0  
**Status:** Enterprise-Ready  
**Last Updated:** 2026-07-06

---

## Overview

PANOPTICON is a production-grade forensic intelligence platform that:
- **Automatically downloads** pretrained AI models (zero training required)
- **Detects & tracks** persons and objects across CCTV footage
- **Re-identifies** suspects across camera views
- **Generates forensic reports** with timeline reconstruction
- **Scales to GPU/CPU** with automatic device detection

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                     │
│                    Case Management UI                        │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTPS
┌──────────────────┴──────────────────────────────────────────┐
│                 Backend API (FastAPI)                        │
│              /evidence, /ai, /datasets, /chat               │
├──────────────────────────────────────────────────────────────┤
│  Database (PostgreSQL)  │ Cache (Redis)  │ Vector DB (Chroma) │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────────────┐
│         Celery Workers (Async Processing)                   │
│     ↓ Evidence Processing Pipeline ↓                        │
│  ┌────────────────────────────────────┐                    │
│  │  AI Model Registry                 │                    │
│  │  ├─ YOLOv8 (Detection)             │                    │
│  │  ├─ SAM 2 (Segmentation)           │                    │
│  │  ├─ ByteTrack (Tracking)           │                    │
│  │  └─ FastReID (Re-ID)               │                    │
│  └────────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────┘
```

---

## Pre-Deployment Requirements

### Hardware
- **CPU:** 4+ cores (minimum), 8+ cores (recommended)
- **RAM:** 8 GB (CPU mode), 16 GB (recommended with GPU)
- **GPU:** NVIDIA with CUDA Compute Capability 6.0+ (optional but recommended)
  - Tesla K80, V100, A100, or RTX series
  - VRAM: 6 GB (minimum), 12 GB+ (recommended)
- **Storage:** 50 GB (models + datasets + processing)
  - SSD preferred for performance

### Software
- **OS:** Linux (Ubuntu 20.04+) or Windows Server 2019+
- **Docker:** 20.10+
- **Docker Compose:** 2.0+
- **Python:** 3.10+ (if not using Docker)
- **NVIDIA Container Runtime:** For GPU support

### Network
- **API Port:** 8000 (HTTP) or 443 (HTTPS)
- **Database Port:** 5432 (PostgreSQL)
- **Redis Port:** 6379
- **ChromaDB Port:** 8001
- **Outbound HTTPS:** For model weight downloads

---

## Installation Steps

### Step 1: Clone & Setup

```bash
cd c:\2026proj\SIC CAPSTONE

# Create Python virtual environment (if not using Docker)
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Install dependencies
cd backend
pip install -r requirements.txt
cd ..
```

### Step 2: Configure Environment

```bash
# Create .env files
cat > backend/.env << EOF
# Database
DATABASE_URL=postgresql+asyncpg://panopticon:panopticon@localhost:5432/panopticon

# Redis
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1

# Storage
LOCAL_STORAGE_PATH=./storage/evidence
MAX_UPLOAD_SIZE_MB=10240

# AI/ML
DETECTION_CONFIDENCE_THRESHOLD=0.45
REID_SIMILARITY_THRESHOLD=0.78
GPU_ENABLED=true

# API
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
SECRET_KEY=your-secret-key-change-in-production

# Optional: Gemini API for LLM
GEMINI_API_KEY=your_key_here

# Optional: AWS S3
STORAGE_BACKEND=local
# STORAGE_BACKEND=s3
# S3_BUCKET=panopticon-evidence
# S3_REGION=us-east-1
EOF

cat > docker/.env << EOF
POSTGRES_USER=panopticon
POSTGRES_PASSWORD=panopticon
POSTGRES_DB=panopticon
ENVIRONMENT=production
DEBUG=false
EOF
```

### Step 3: Initialize AI Models

```bash
# Download and verify all model weights
python ai/startup.py --device auto

# Or with Docker
docker-compose -f docker/docker-compose.yml run backend python ai/startup.py --device auto
```

This will:
- Check system requirements (Python, PyTorch, OpenCV, etc.)
- Auto-download model weights (~2.5 GB total)
- Verify checksums
- Initialize all AI modules
- Report status

### Step 4: Start Services

#### Option A: Docker Compose (Recommended)

```bash
cd docker

# Build images
docker-compose build

# Start all services
docker-compose up -d

# Verify health
docker-compose ps
docker-compose logs -f backend

# Run migrations
docker-compose exec backend alembic upgrade head
```

#### Option B: Manual (Development)

```bash
# Terminal 1: PostgreSQL
# (Ensure running on localhost:5432)

# Terminal 2: Redis
redis-server

# Terminal 3: Celery Worker
cd backend
celery -A app.celery_app worker --loglevel=info

# Terminal 4: FastAPI Backend
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 5: Frontend (optional)
cd frontend
npm run dev
```

### Step 5: Verify Deployment

```bash
# Check API health
curl http://localhost:8000/health

# Check models status
curl http://localhost:8000/api/v1/models/status

# Access UI
# http://localhost:3000 (frontend)
# http://localhost:8000/api/docs (API documentation)
```

---

## Production Deployment

### Docker Deployment

```bash
# Build production images
docker build -t panopticon-backend:latest backend/
docker build -t panopticon-frontend:latest frontend/

# Push to registry (if using cloud)
docker tag panopticon-backend:latest your-registry/panopticon-backend:latest
docker push your-registry/panopticon-backend:latest

# Deploy with docker-compose
docker-compose -f docker/docker-compose.yml up -d
```

### Kubernetes Deployment (Optional)

```yaml
# Example k8s manifest (partial)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: panopticon-api
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: api
        image: panopticon-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: panopticon-secrets
              key: database-url
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
            nvidia.com/gpu: "1"  # If GPU available
          limits:
            memory: "8Gi"
            cpu: "4"
```

### SSL/HTTPS Setup

```bash
# Using Let's Encrypt with certbot
sudo certbot certonly --standalone -d your-domain.com

# Update docker-compose or nginx config with certificate paths
# Certificates in: /etc/letsencrypt/live/your-domain.com/
```

---

## Post-Deployment Configuration

### 1. Create Initial Admin User

```bash
docker-compose exec backend python -c "
from app.models.case import Case
from app.db.base import engine
from sqlalchemy.orm import sessionmaker

Session = sessionmaker(bind=engine)
session = Session()

# Create admin case
case = Case(
    id='admin-demo',
    case_number='ADMIN-001',
    title='Demo Case',
    created_by='admin'
)
session.add(case)
session.commit()
print('Demo case created')
"
```

### 2. Load Sample Datasets

```bash
# Download evaluation datasets (optional)
python ai/run_pipeline.py --dataset coco --eda-only
python ai/run_pipeline.py --dataset mot17 --eda-only
```

### 3. Configure Monitoring

```bash
# Enable Prometheus metrics
# Add to docker-compose.yml:
prometheus:
  image: prom/prometheus
  ports:
    - "9090:9090"
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml

# Add to backend config for metrics export
```

### 4. Setup Backups

```bash
# Backup database daily
docker-compose exec postgres pg_dump -U panopticon panopticon > backup_$(date +%Y%m%d).sql

# Backup storage
tar -czf evidence_backup_$(date +%Y%m%d).tar.gz ./storage/evidence/
```

---

## Model Weight Management

### Automatic Downloads

Weights are downloaded on first use:

```
ai/models/weights/
├── yolov8x.pt (130 MB)
├── yolov8l.pt (87 MB)
├── sam2_hiera_large.pt (897 MB)
├── fastreid_msmt17_R50.pth (95 MB)
└── manifest.json
```

### Manual Weight Management

```bash
# Check status
python -c "from ai.models.weights_manager import weights_status; import json; print(json.dumps(weights_status(), indent=2))"

# Pre-download weights
python ai/startup.py --check-only

# Force re-download
python -c "from ai.models.weights_manager import download_weights; download_weights('yolov8x', force=True)"

# Pre-populate weights (for air-gapped environments)
# Copy weights files to ai/models/weights/ before deployment
```

---

## Performance Tuning

### GPU Acceleration

```bash
# Verify GPU support
python -c "
import torch
print(f'CUDA available: {torch.cuda.is_available()}')
print(f'Device: {torch.cuda.get_device_name(0)}')
print(f'VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB')
"

# Enable FP16 precision
DETECTION_CONFIDENCE_THRESHOLD=0.45 docker-compose up -d

# Use TensorRT (optional)
pip install tensorrt
```

### Batch Processing

```python
# Configure batch size based on available memory
# backend/.env
BATCH_SIZE=8  # Adjust: 2 for GPU memory <6GB, 16 for >12GB

# Monitor memory usage during processing
docker stats panopticon_api
```

### Celery Optimization

```bash
# backend/.env
PROCESSING_WORKERS=4  # CPU cores or GPU count
CELERY_PREFETCH_MULTIPLIER=1
CELERY_BROKER_POOL_LIMIT=10
```

---

## Monitoring & Logging

### Health Checks

```bash
# API health
curl http://localhost:8000/health

# Database health
docker-compose exec postgres psql -U panopticon -c "SELECT 1"

# Redis health
docker-compose exec redis redis-cli ping

# Celery workers
docker-compose exec backend celery -A app.celery_app inspect active_queues
```

### Log Monitoring

```bash
# Backend logs
docker-compose logs -f backend

# Worker logs
docker-compose logs -f worker

# All services
docker-compose logs -f

# Save logs
docker-compose logs > panopticon_logs_$(date +%Y%m%d).txt
```

### Metrics Export

```bash
# Prometheus metrics available at:
# http://localhost:9090/

# Query examples:
# - http_requests_total
# - process_runtime_go_goroutines
# - panopticon_inference_duration_seconds
```

---

## Troubleshooting

### Issue: GPU Not Detected

```bash
# Check NVIDIA drivers
nvidia-smi

# Verify CUDA installation
python -c "import torch; print(torch.cuda.is_available())"

# Reinstall PyTorch with CUDA support
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### Issue: Out of Memory

```bash
# Reduce batch size
echo "BATCH_SIZE=2" >> backend/.env

# Skip segmentation (memory-intensive)
python ai/startup.py --skip-segmentor

# Use CPU mode
echo "GPU_ENABLED=false" >> backend/.env
```

### Issue: Slow Processing

```bash
# Check device (should be CUDA for GPU)
curl http://localhost:8000/api/v1/models/status | grep device

# Monitor CPU/GPU usage
docker stats

# Enable logging for timing analysis
echo "DEBUG=true" >> backend/.env
docker-compose restart backend
```

### Issue: Database Connection Failed

```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check connection string
grep DATABASE_URL backend/.env

# Reset database
docker-compose down -v
docker-compose up postgres -d
docker-compose exec postgres psql -U panopticon -c "CREATE DATABASE panopticon"
```

---

## Security Checklist

- [ ] Change default database password
- [ ] Set strong SECRET_KEY in .env
- [ ] Enable HTTPS/SSL certificates
- [ ] Configure firewall rules (restrict port access)
- [ ] Set up authentication (OAuth2/JWT)
- [ ] Enable rate limiting on API endpoints
- [ ] Rotate API keys regularly
- [ ] Enable audit logging
- [ ] Encrypt sensitive data at rest
- [ ] Use VPN for database access
- [ ] Regular security updates (docker images, dependencies)

---

## Scaling Considerations

### Horizontal Scaling

```yaml
# docker-compose.yml
services:
  backend:
    deploy:
      replicas: 3  # Run 3 API instances
  worker:
    deploy:
      replicas: 4  # Run 4 workers for parallel processing
```

### Load Balancing

```bash
# Use nginx or HAProxy in front of API instances
# Example nginx config:
upstream panopticon_api {
  server backend1:8000;
  server backend2:8000;
  server backend3:8000;
}
server {
  listen 443 ssl http2;
  server_name panopticon.example.com;
  location / {
    proxy_pass http://panopticon_api;
  }
}
```

### Storage Scaling

```bash
# Use S3 instead of local storage
# backend/.env
STORAGE_BACKEND=s3
S3_BUCKET=panopticon-evidence
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
```

---

## Maintenance

### Regular Tasks

```bash
# Daily: Database backup
0 2 * * * docker-compose exec postgres pg_dump -U panopticon panopticon > /backups/db_$(date +\%Y\%m\%d).sql

# Weekly: Clean up old processing files
0 3 * * 0 find ./storage/processing -mtime +7 -delete

# Monthly: Rebuild search indices
0 4 1 * * docker-compose exec chromadb ...
```

### Version Updates

```bash
# Update images
docker pull panopticon-backend:latest
docker-compose up -d --no-deps backend

# Run migrations
docker-compose exec backend alembic upgrade head

# Verify health
curl http://localhost:8000/health
```

---

## Support & Resources

- **Documentation:** See `AI_INFERENCE_GUIDE.md`
- **API Docs:** http://localhost:8000/api/docs
- **Issues:** Check Docker logs and application logs
- **Model Weights:** Auto-downloaded from official sources
- **Datasets:** Available at http://localhost:8000/api/v1/datasets/

---

**Deployment Status:** ✓ Ready for Production

For questions or issues, refer to the main documentation or check logs:
```bash
docker-compose logs -f backend | grep -i error
```
