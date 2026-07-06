# PANOPTICON Quick Start
## Get Running in 10 Minutes

---

## Prerequisites
- Docker & Docker Compose
- 50 GB free disk space
- 16 GB RAM (GPU recommended)

---

## Step 1: Clone & Navigate
```bash
cd c:\2026proj\SIC CAPSTONE
```

---

## Step 2: Start Services
```bash
cd docker
docker-compose up -d

# Verify all services running
docker-compose ps
```

Expected:
```
postgres        postgres:16-alpine      Up
redis           redis:7-alpine          Up
chromadb        chroma:0.5.3            Up
backend         panopticon_api          Up (healthy)
frontend        next:latest             Up
worker          celery worker           Up
```

---

## Step 3: Initialize AI Models (First Run Only)
```bash
# This downloads ~2.5GB and takes 2-5 minutes
docker-compose exec backend python ai/startup.py --device auto

# You should see:
# ✓ PyTorch detected (CUDA available)
# ✓ YOLOv8x downloaded
# ✓ FastReID downloaded
# ✓ All models initialized
```

---

## Step 4: Verify Health
```bash
# API health check
curl http://localhost:8000/health

# Should return:
# {"status":"healthy","version":"1.0.0","env":"development"}

# UI access
open http://localhost:3000  # or visit in browser
```

---

## Step 5: Process Your First Evidence

### Option A: Using API (CLI)

```bash
# 1. Create a case
CASE_ID=$(curl -s -X POST http://localhost:8000/api/v1/cases \
  -H "Content-Type: application/json" \
  -d '{
    "case_number": "DEMO-001",
    "title": "Test Case",
    "incident_date": "2026-07-06T12:00:00Z"
  }' | jq -r '.id')

echo "Case ID: $CASE_ID"

# 2. Upload evidence video
EVIDENCE_ID=$(curl -s -X POST http://localhost:8000/api/v1/evidence/upload \
  -F "case_id=$CASE_ID" \
  -F "file=@your_video.mp4" \
  -F "notes=Test evidence" | jq -r '.id')

echo "Evidence ID: $EVIDENCE_ID"

# 3. Trigger processing
curl -X POST http://localhost:8000/api/v1/evidence/$EVIDENCE_ID/process

# 4. Poll for results (wait 30-60 seconds)
curl http://localhost:8000/api/v1/evidence/$EVIDENCE_ID/detections | jq

# 5. Generate report
curl -X POST http://localhost:8000/api/v1/ai/report/generate \
  -d "case_id=$CASE_ID&report_type=comprehensive"
```

### Option B: Using UI (GUI)

1. Open http://localhost:3000
2. Click "New Case"
3. Upload MP4/AVI video
4. Click "Process Evidence"
5. Watch real-time progress
6. Download report (JSON/PDF/HTML)

---

## Step 6: View Results

### API Response
```bash
curl http://localhost:8000/api/v1/evidence/<EVIDENCE_ID>/detections
```

Response includes:
```json
{
  "persons": [
    {"track_id": 1, "confidence": 0.92, "appearances": 45},
    {"track_id": 2, "confidence": 0.87, "appearances": 32}
  ],
  "objects": {
    "backpack": 2,
    "bottle": 1
  },
  "timeline": [
    {"time": 12.5, "event": "Person detected", "confidence": 0.92}
  ],
  "confidence": 0.89
}
```

### Generated Reports
- **JSON:** Structured data format
- **HTML:** Interactive dashboard (open in browser)
- **PDF:** Printable forensic report
- **CSV:** Statistical summary

---

## Common Commands

### Check Logs
```bash
docker-compose logs -f backend       # API logs
docker-compose logs -f worker        # Processing logs
docker-compose logs                  # All services
```

### Monitor Performance
```bash
docker stats                         # CPU/RAM/Network usage
```

### Restart Services
```bash
docker-compose restart backend       # Just API
docker-compose restart               # All services
docker-compose down                  # Stop all
```

### Clean Up (Remove Everything)
```bash
docker-compose down -v               # Delete volumes too
rm -rf storage/                      # Delete local evidence
```

---

## Troubleshooting

### GPU Not Detected
```bash
# Check inside container
docker-compose exec backend python -c "
import torch
print(f'CUDA: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'GPU: {torch.cuda.get_device_name(0)}')
"
```

### API Fails to Start
```bash
# Check database connection
docker-compose logs postgres
docker-compose logs backend | grep -i error

# Reset database
docker-compose down -v
docker-compose up postgres -d
docker-compose exec postgres psql -U panopticon -c "CREATE DATABASE panopticon"
```

### Processing Takes Too Long
```bash
# Check worker logs
docker-compose logs worker

# Monitor GPU usage
docker exec panopticon_worker nvidia-smi

# Reduce batch size
echo "BATCH_SIZE=2" >> backend/.env
docker-compose restart worker
```

### Out of Memory
```bash
# Skip segmentation (memory heavy)
docker-compose exec backend python ai/startup.py --skip-segmentor

# Use CPU mode
echo "GPU_ENABLED=false" >> backend/.env
docker-compose restart worker
```

---

## Testing Models Locally

### Test Detection
```python
from ai.models.detector import YOLODetector
import cv2

detector = YOLODetector(device="cpu")
detector.load()

frame = cv2.imread("test_image.jpg")
detections = detector.infer([frame])
print(detections)
```

### Test Tracking
```python
from ai.models.tracker import ByteTracker

tracker = ByteTracker()
tracker.load()

# Mock detections
dets = [{"label": "person", "bbox": {...}}]
tracked = tracker.infer(dets)
print(tracked)
```

### Test ReID
```python
from ai.models.reid import FastReIDModule
import cv2

reid = FastReIDModule(device="cpu")
reid.load()

crops = [cv2.imread(f"person_{i}.jpg") for i in range(3)]
embeddings = reid.infer(crops)
print(embeddings.shape)  # (3, 512)
```

---

## Next Steps

1. **Read Full Docs:** `AI_INFERENCE_GUIDE.md` (detailed)
2. **Deploy to Production:** `PANOPTICON_DEPLOYMENT.md`
3. **Run Tests:** `pytest ai/tests/ -v`
4. **API Docs:** Open http://localhost:8000/api/docs

---

## Performance Tips

### Faster Processing
```bash
# Use GPU (if available)
echo "GPU_ENABLED=true" >> backend/.env

# Increase batch size (if memory allows)
echo "BATCH_SIZE=16" >> backend/.env

# Reduce confidence threshold (more detections)
echo "DETECTION_CONFIDENCE_THRESHOLD=0.35" >> backend/.env

docker-compose restart worker
```

### Lower Memory Usage
```bash
# Use CPU only
echo "GPU_ENABLED=false" >> backend/.env

# Skip segmentation
docker-compose exec backend python ai/startup.py --skip-segmentor

# Reduce batch size
echo "BATCH_SIZE=2" >> backend/.env

docker-compose restart worker
```

---

## Example: Full Workflow

```bash
# 1. Start services
docker-compose up -d

# 2. Initialize models (one time)
docker-compose exec backend python ai/startup.py --device auto

# 3. Create case
CASE=$(curl -s -X POST http://localhost:8000/api/v1/cases \
  -H "Content-Type: application/json" \
  -d '{"case_number":"EX-001","title":"Example"}' | jq -r '.id')

# 4. Upload video
EV=$(curl -s -X POST http://localhost:8000/api/v1/evidence/upload \
  -F "case_id=$CASE" -F "file=@video.mp4" | jq -r '.id')

# 5. Process (async, ~30-60 seconds)
curl -X POST http://localhost:8000/api/v1/evidence/$EV/process

# 6. Wait and check results
sleep 60
curl http://localhost:8000/api/v1/evidence/$EV/detections | jq .

# 7. Generate report
curl -X POST http://localhost:8000/api/v1/ai/report/generate \
  -d "case_id=$CASE&report_type=comprehensive"

echo "✓ Complete!"
```

---

## Support

- **API Docs:** http://localhost:8000/api/docs
- **Logs:** `docker-compose logs -f`
- **Issues:** Check `PANOPTICON_DEPLOYMENT.md` troubleshooting
- **Code:** See `AI_INFERENCE_GUIDE.md` for implementation details

---

**Ready? Start with Step 1!**

Questions? Check full docs or review logs.

Status: ✅ Production Ready
