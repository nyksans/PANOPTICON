# PANOPTICON AI Inference Pipeline
## Production-Ready Pretrained Model System

**Objective:** Build an enterprise inference system using state-of-the-art pretrained models with zero training required.

---

## Architecture Overview

```
Video/Image Input
    ↓
┌─────────────────────────────────────────────┐
│  1. Frame Extraction (OpenCV)               │
├─────────────────────────────────────────────┤
│  2. Object Detection (YOLOv8x)              │
├─────────────────────────────────────────────┤
│  3. Multi-Object Tracking (ByteTrack)       │
├─────────────────────────────────────────────┤
│  4. Instance Segmentation (SAM 2)           │
├─────────────────────────────────────────────┤
│  5. Person Re-Identification (FastReID)     │
├─────────────────────────────────────────────┤
│  6. Forensic Report Generation (Gemini)     │
└─────────────────────────────────────────────┘
    ↓
Structured JSON Output + Timeline + 3D Positions
```

---

## Model Components

### 1. **Object Detection** — YOLOv8x
- **Purpose:** Detect forensically relevant objects
- **Classes:** person, vehicle, backpack, laptop, cell phone, knife, bottle, suitcase, chair, door
- **Weights:** Official Ultralytics pretrained (130 MB)
- **Fallbacks:** YOLOv8l (87 MB) → YOLOv8n (6 MB)
- **Auto-Download:** Yes — triggered on first inference
- **Device:** Automatic GPU/CPU switching

```python
from ai.models import get_registry

registry = get_registry(device="auto")
registry.startup()

# Inference
results = registry.detector.infer([frame1, frame2])
# Returns: List[List[{label, confidence, bbox, ...}]]
```

### 2. **Segmentation** — SAM 2 (Segment Anything 2)
- **Purpose:** Precise instance-level segmentation masks
- **Weights:** Meta SAM 2 Hiera Large (897 MB) → Base+ (323 MB)
- **Auto-Download:** Yes
- **Input:** Frame + detections
- **Output:** Binary masks for each detection

```python
masks = registry.segmentor.infer(frame, detections)
# Returns: detections with added .mask key (binary array)
```

### 3. **Tracking** — ByteTrack
- **Purpose:** Multi-object tracking with IoU + appearance matching
- **Algorithm:** Simple yet effective assignment matching
- **Classes:** Person (primary)
- **No Weights:** Pure algorithmic tracker
- **Output:** Consistent track IDs across frames

```python
tracker = ByteTracker(iou_threshold=0.3)
tracked_detections = tracker.infer(detections)
# Returns: detections with assigned track_id
```

### 4. **Person Re-ID** — FastReID MSMT17
- **Purpose:** Cross-camera identity matching for suspect tracking
- **Model:** ResNet50 trained on MSMT17 (95 MB)
- **Fallback:** CLIP ViT-B/32 (338 MB)
- **Embedding:** 512-dim (FastReID) or 768-dim (CLIP)
- **Similarity Metric:** Cosine distance (normalized embeddings)

```python
reid = FastReIDModule(device="auto")
reid.load()

# Extract embeddings for person crops
embeddings = reid.infer([crop1, crop2, crop3])
# Returns: (N, 512) array of unit-normalized embeddings

# Compute similarity
similarity = reid.similarity(embedding1, embedding2)
# Returns: float in [0, 1] (1 = identical person)
```

### 5. **Vision-Language** — Gemini Pro
- **Purpose:** Forensic Q&A and report generation
- **API:** Google Generative AI (requires API key)
- **Fallback:** Mock responses in dev mode
- **Context:** Case data + processed evidence summary

---

## Installation & Setup

### Step 1: Install Dependencies
```bash
cd backend
pip install -r requirements.txt

# Additional optional packages
pip install git+https://github.com/facebookresearch/sam2.git
pip install fast-reid
```

### Step 2: Verify GPU Support (Optional)
```bash
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"CPU\"}')"
```

### Step 3: Set Environment
```bash
# Create .env file
cat > backend/.env << EOF
DETECTION_CONFIDENCE_THRESHOLD=0.45
REID_SIMILARITY_THRESHOLD=0.78
GPU_ENABLED=true  # Auto-detected if not specified
GEMINI_API_KEY=your_key_here  # Optional for Gemini
EOF
```

---

## Usage Examples

### Example 1: Basic Video Processing

```python
from ai.services.inference_pipeline import InferencePipeline

# Initialize pipeline
pipeline = InferencePipeline(
    confidence_threshold=0.45,
    reid_threshold=0.78,
    device="auto",
    batch_size=8,
)

# Startup models (downloads weights if needed)
pipeline.startup()

# Process a video
results = pipeline.process_video(
    video_path="evidence.mp4",
    output_dir="./processing_output",
    progress_callback=lambda pct, msg: print(f"[{pct}%] {msg}")
)

# Results structure
print(f"Detected {len(results['persons'])} persons")
print(f"Detected {len(results['objects'])} object types")
print(f"Timeline events: {len(results['timeline'])}")
print(f"Confidence: {results['confidence']:.1%}")
print(f"Processing time: {results['processing_time']:.1f}s")
```

### Example 2: Model Registry API

```python
from ai.models import get_registry

registry = get_registry(device="auto")

# Startup all models
status = registry.startup(skip_models=["segmentor"])
print(status)  # {detector: True, segmentor: False, tracker: True, reid: True}

# Batch inference
results = registry.infer_batch(
    frames=[frame1, frame2, frame3],
    detections_only=False,
    track=True,
    segment=False,
    reid=True,
)

print(f"Detections: {len(results['detections'])} frames")
print(f"Active tracks: {len(results['tracks'])}")
print(f"Person embeddings: {results['embeddings'].shape}")
```

### Example 3: Direct Model Usage

```python
from ai.models.detector import YOLODetector
from ai.models.tracker import ByteTracker
from ai.models.reid import FastReIDModule

# Load detector
detector = YOLODetector(model_key="yolov8x", device="cuda")
detector.load()

# Load tracker
tracker = ByteTracker(iou_threshold=0.3)
tracker.load()

# Load ReID
reid = FastReIDModule(device="cuda")
reid.load()

# Process frames
for frame_idx, frame in enumerate(frames):
    # Detect
    detections = detector.infer([frame])
    
    # Track
    tracked = tracker.infer(detections[0])
    
    # Extract person crops
    person_crops = [...]
    
    # Re-ID
    embeddings = reid.infer(person_crops)
```

### Example 4: Benchmark Evaluation

```python
from ai.services.benchmark_evaluator import BenchmarkEvaluator

evaluator = BenchmarkEvaluator(output_dir="./benchmarks")

# Evaluate on COCO validation
coco_results = evaluator.evaluate_coco_detection(
    predictions=[...],  # Model outputs
    ground_truth=[...],  # Ground truth annotations
    iou_threshold=0.5,
)

# Evaluate on MOT17
mot_results = evaluator.evaluate_mot17_tracking(
    predictions={...},
    ground_truth_dir="./datasets/MOT17/",
)

# Evaluate on Market-1501
reid_results = evaluator.evaluate_market1501_reid(
    gallery_features=gallery_embeddings,
    query_features=query_embeddings,
    gallery_labels=[...],
    query_labels=[...],
    gallery_cams=[...],
    query_cams=[...],
)

# Generate report
report = evaluator.generate_benchmark_report(
    coco_results=coco_results,
    mot_results=mot_results,
    reid_results=reid_results,
)
```

---

## API Endpoints

### Evidence Processing
```
POST /api/v1/evidence/{evidence_id}/process
→ Returns: {job_id, status: "queued"}

GET /api/v1/evidence/{evidence_id}/detections
→ Returns: Structured detection results

GET /api/v1/ai/process/{job_id}/status
→ Returns: {status, progress, current_step}
```

### AI Chat & Report Generation
```
POST /api/v1/ai/chat
Body: {case_id, message, session_id?}
→ Returns: {content, confidence, processing_time, evidence_refs}

POST /api/v1/ai/report/generate
Params: case_id, report_type (comprehensive|summary)
→ Returns: {report_id, content, status}
```

---

## Weight Management

All model weights are automatically downloaded, cached, and verified:

```
ai/models/weights/
├── yolov8x.pt (130 MB)
├── yolov8l.pt (87 MB)
├── yolov8n.pt (6 MB)
├── sam2_hiera_large.pt (897 MB)
├── sam2_hiera_base_plus.pt (323 MB)
├── fastreid_msmt17_R50.pth (95 MB)
├── clip_vitb32.pt (338 MB)
└── manifest.json (metadata, checksums, verification status)
```

**Download Behavior:**
1. Check if file exists locally
2. If missing → auto-download from official sources
3. Verify checksum (when available)
4. Cache manifest with download timestamp

**Manual Weight Verification:**
```python
from ai.models.weights_manager import weights_status, download_weights

# Check status
status = weights_status()
print(status)

# Manually download a model
download_weights("yolov8x", progress_cb=lambda pct, msg: print(f"[{pct}%] {msg}"))
```

---

## Performance Optimization

### GPU Acceleration
- **FP16 Inference:** Enabled automatically on CUDA
- **torch.compile():** Applied to detector when PyTorch 2.0+
- **Batch Processing:** Process 8 frames per batch (configurable)
- **Frame Skipping:** Process every Nth frame (reduces computation)

### CPU Fallback
- Automatic detection of CUDA availability
- Graceful degradation: all modules work on CPU
- Performance: ~2-5x slower than GPU, still acceptable for low-FPS video

### Memory Management
- Lazy model loading: models loaded only on first use
- Batch inference: processes multiple frames without reloading models
- Cleanup: unused detections are pruned to keep JSON <100MB

---

## Monitoring & Logging

```python
import logging

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("panopticon.models")

# Track model loading
logger.info("Startup sequence:")
# Output:
# [INFO] Starting PANOPTICON API v1.0.0
# [INFO] Detecting device…
# [INFO] GPU: Tesla V100 (32 GB VRAM)
# [INFO] Loading detector (YOLOv8)…
# [INFO] ✓ Detector loaded
# [INFO] ✓ All models initialized
```

---

## Troubleshooting

### GPU Not Detected
```bash
# Verify CUDA installation
nvidia-smi

# Reinstall torch with CUDA support
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### Out of Memory (OOM)
```python
# Reduce batch size or use CPU
pipeline = InferencePipeline(batch_size=2, device="cpu")

# Skip segmentation (most memory-intensive)
registry.startup(skip_models=["segmentor"])
```

### Models Fail to Download
```python
# Check internet connectivity
# Manually download from URLs in weights_manager.py
# Or pre-populate ai/models/weights/ directory

# Force re-download
download_weights("yolov8x", force=True)
```

### Slow Inference
```python
# Check device (should be CUDA)
from ai.models import get_registry
registry = get_registry()
print(f"Device: {registry.device}")

# Profile inference time
import time
start = time.time()
results = detector.infer([frame])
elapsed = time.time() - start
print(f"Detection: {elapsed:.3f}s")
```

---

## Future Extensibility

### Training Interface (Modular for Future Work)
```python
# Current (inference only):
detector.infer(frames) → List[detections]

# Future (training stub ready):
try:
    detector.train(dataset="path", epochs=100)
except NotImplementedError:
    print("Train module not yet implemented")

try:
    metrics = detector.evaluate(dataset="coco_val")
except NotImplementedError:
    print("Evaluate module not yet implemented")
```

### Custom Model Integration
```python
from ai.models.base import BaseModel

class CustomDetector(BaseModel):
    name = "custom_detector"
    
    def load(self):
        # Load custom weights
        self._loaded = True
        return self
    
    def infer(self, inputs, **kwargs):
        # Custom inference logic
        pass

# Use in pipeline
from ai.models import ModelRegistry
registry = ModelRegistry()
registry.detector = CustomDetector(device="cuda").load()
```

---

## Deployment Checklist

- [ ] All model weights downloaded and cached
- [ ] GPU/CPU device auto-detection working
- [ ] Batch size configured for available VRAM
- [ ] Database connected and migrations applied
- [ ] Redis and Celery workers running
- [ ] Gemini API key configured (optional)
- [ ] Local storage paths created
- [ ] Docker containers built and running
- [ ] Health checks passing
- [ ] Logs configured for monitoring

---

## References

- **YOLOv8:** https://github.com/ultralytics/ultralytics
- **SAM 2:** https://github.com/facebookresearch/sam2
- **ByteTrack:** https://github.com/ifzhang/ByteTrack
- **FastReID:** https://github.com/JDAI-CV/fast-reid
- **CLIP:** https://github.com/openai/CLIP
- **Gemini:** https://ai.google.dev/

---

**Version:** 1.0  
**Last Updated:** 2026-07-06  
**Status:** Production Ready
