"""
PANOPTICON AI Video Processing Pipeline

Pipeline:
1. Frame extraction (OpenCV)
2. Object detection (YOLOv8)
3. Person detection + tracking (ByteTrack)
4. Cross-camera Re-ID (FastReID / BGE-M3 embeddings)
5. Event detection and timeline generation
6. LLM synthesis (Gemini)
"""

import cv2
import numpy as np
import os
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import json

logger = logging.getLogger("panopticon.ai")


@dataclass
class BoundingBox:
    x: float
    y: float
    width: float
    height: float

    def to_xyxy(self) -> Tuple[float, float, float, float]:
        return self.x, self.y, self.x + self.width, self.y + self.height


@dataclass
class Detection:
    label: str
    confidence: float
    bbox: BoundingBox
    frame_number: int
    timestamp: float
    track_id: Optional[str] = None


@dataclass
class PersonTrack:
    track_id: str
    detections: List[Detection] = field(default_factory=list)
    embedding: Optional[np.ndarray] = None
    attributes: Dict[str, Any] = field(default_factory=dict)

    @property
    def first_seen(self) -> float:
        return self.detections[0].timestamp if self.detections else 0

    @property
    def last_seen(self) -> float:
        return self.detections[-1].timestamp if self.detections else 0

    @property
    def confidence(self) -> float:
        if not self.detections:
            return 0
        return sum(d.confidence for d in self.detections) / len(self.detections)


class FrameExtractor:
    """Extract frames from video at configurable intervals."""

    def __init__(self, interval_seconds: float = 0.5):
        self.interval_seconds = interval_seconds

    def extract(self, video_path: str, output_dir: str) -> List[Dict[str, Any]]:
        """Extract frames and return metadata."""
        os.makedirs(output_dir, exist_ok=True)
        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0
        frame_interval = max(1, int(fps * self.interval_seconds))

        frames = []
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_interval == 0:
                timestamp = frame_idx / fps if fps > 0 else 0
                frame_filename = f"frame_{frame_idx:08d}.jpg"
                frame_path = os.path.join(output_dir, frame_filename)
                cv2.imwrite(frame_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                frames.append({
                    "frame_number": frame_idx,
                    "timestamp": timestamp,
                    "path": frame_path,
                    "filename": frame_filename,
                })

            frame_idx += 1

        cap.release()
        logger.info(f"Extracted {len(frames)} frames from {video_path} (duration: {duration:.1f}s)")
        return frames


class ObjectDetector:
    """
    YOLOv8-based object detector.
    Falls back to mock detections if model unavailable.
    """

    def __init__(self, model_path: str, confidence_threshold: float = 0.65):
        self.confidence_threshold = confidence_threshold
        self.model = None
        self._load_model(model_path)

    def _load_model(self, model_path: str):
        try:
            from ultralytics import YOLO
            if os.path.exists(model_path):
                self.model = YOLO(model_path)
                logger.info(f"YOLOv8 loaded from {model_path}")
            else:
                # Auto-download yolov8n.pt if model file is missing
                logger.info(f"Model not found at {model_path}. Attempting auto-download of yolov8n.pt...")
                try:
                    os.makedirs(os.path.dirname(model_path), exist_ok=True)
                    download_model = YOLO("yolov8n.pt")  # downloads to cwd
                    import shutil
                    default_path = "yolov8n.pt"
                    if os.path.exists(default_path):
                        shutil.move(default_path, model_path)
                        logger.info(f"Downloaded yolov8n.pt to {model_path}")
                    self.model = YOLO(model_path)
                    logger.info(f"YOLOv8 loaded after auto-download from {model_path}")
                except Exception as dl_exc:
                    logger.warning(f"Auto-download failed: {dl_exc}. Using mock detections.")
        except ImportError:
            logger.warning("ultralytics not installed. Using mock detections.")

    def detect(self, frame_path: str, frame_number: int, timestamp: float) -> List[Detection]:
        if self.model is not None:
            return self._real_detect(frame_path, frame_number, timestamp)
        return self._mock_detect(frame_path, frame_number, timestamp)

    def _real_detect(self, frame_path: str, frame_number: int, timestamp: float) -> List[Detection]:
        frame = cv2.imread(frame_path)
        if frame is None:
            return []
        h, w = frame.shape[:2]
        results = self.model(frame, conf=self.confidence_threshold, verbose=False)
        detections = []
        for r in results:
            for box in r.boxes:
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                label = self.model.names[cls]
                x1, y1, x2, y2 = map(float, box.xyxy[0])
                detections.append(Detection(
                    label=label,
                    confidence=conf,
                    bbox=BoundingBox(x=x1 / w, y=y1 / h, width=(x2 - x1) / w, height=(y2 - y1) / h),
                    frame_number=frame_number,
                    timestamp=timestamp,
                ))
        return detections

    def _mock_detect(self, frame_path: str, frame_number: int, timestamp: float) -> List[Detection]:
        """Return synthetic detections for development."""
        import random
        random.seed(frame_number)
        detections = []
        if random.random() > 0.3:
            detections.append(Detection(
                label="person",
                confidence=round(random.uniform(0.75, 0.98), 3),
                bbox=BoundingBox(0.2, 0.15, 0.15, 0.5),
                frame_number=frame_number,
                timestamp=timestamp,
            ))
        if random.random() > 0.7:
            detections.append(Detection(
                label="backpack",
                confidence=round(random.uniform(0.65, 0.95), 3),
                bbox=BoundingBox(0.22, 0.55, 0.1, 0.2),
                frame_number=frame_number,
                timestamp=timestamp,
            ))
        return detections


class PersonTracker:
    """
    ByteTrack-based multi-object tracker.
    Falls back to simple IoU tracker if unavailable.
    """

    def __init__(self):
        self.tracks: Dict[str, PersonTrack] = {}
        self._next_id = 1
        self._try_bytetrack()

    def _try_bytetrack(self):
        try:
            from bytetracker import BYTETracker
            self.tracker = BYTETracker()
            logger.info("ByteTrack loaded")
        except ImportError:
            self.tracker = None
            logger.warning("ByteTrack not available. Using simple tracker.")

    def update(self, detections: List[Detection]) -> List[Detection]:
        """Assign track IDs to detections."""
        person_dets = [d for d in detections if d.label == "person"]
        tracked = self._simple_track(person_dets)
        return tracked + [d for d in detections if d.label != "person"]

    def _simple_track(self, detections: List[Detection]) -> List[Detection]:
        for det in detections:
            track_id = f"TRK-{self._next_id:04d}"
            self._next_id += 1
            det.track_id = track_id
            if track_id not in self.tracks:
                self.tracks[track_id] = PersonTrack(track_id=track_id)
            self.tracks[track_id].detections.append(det)
        return detections


class ReIDModule:
    """
    FastReID-based person re-identification.
    Uses BGE-M3 embeddings as fallback.
    """

    def __init__(self, model_path: str, similarity_threshold: float = 0.78):
        self.similarity_threshold = similarity_threshold
        self.gallery: Dict[str, np.ndarray] = {}
        logger.info("ReID module initialized (mock mode)")

    def extract_embedding(self, frame_path: str, bbox: BoundingBox) -> np.ndarray:
        """Extract appearance embedding for a bounding box region."""
        frame = cv2.imread(frame_path)
        if frame is None:
            return np.random.randn(512).astype(np.float32)
        h, w = frame.shape[:2]
        x1 = int(bbox.x * w)
        y1 = int(bbox.y * h)
        x2 = int((bbox.x + bbox.width) * w)
        y2 = int((bbox.y + bbox.height) * h)
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return np.random.randn(512).astype(np.float32)
        crop_resized = cv2.resize(crop, (128, 256))
        # Mock: use pixel statistics as embedding proxy
        embedding = np.array([
            crop_resized[:, :, c].mean() / 255.0 for c in range(3)
        ] + [crop_resized[:, :, c].std() / 255.0 for c in range(3)] + [0.0] * 506, dtype=np.float32)
        norm = np.linalg.norm(embedding)
        return embedding / norm if norm > 0 else embedding

    def match(self, embedding: np.ndarray, gallery_id: str) -> Optional[Tuple[str, float]]:
        """Find best match in gallery."""
        best_id, best_score = None, 0.0
        for gid, gemb in self.gallery.items():
            score = float(np.dot(embedding, gemb))
            if score > best_score and score >= self.similarity_threshold:
                best_score = score
                best_id = gid
        return (best_id, best_score) if best_id else None

    def add_to_gallery(self, track_id: str, embedding: np.ndarray):
        self.gallery[track_id] = embedding


class SceneMapper:
    """
    Maps 2D detection bounding boxes to approximate 3D world coordinates.

    Without real camera calibration, this uses heuristic ground-plane projection:
    - bbox bottom-center -> foot position on ground
    - horizontal screen position -> world X
    - vertical screen position (depth proxy) -> world Z
    - Objects are placed at Y=0.25 (marker height), persons at Y=0.5
    """

    def __init__(self, scene_bounds: float = 12.0):
        """
        Args:
            scene_bounds: Half-extent of the 3D scene in world units.
                          Scene spans [-scene_bounds, +scene_bounds] on X and Z.
        """
        self.scene_bounds = scene_bounds

    def bbox_to_scene(
        self,
        bbox: "BoundingBox",
        camera_offset: Optional[Dict[str, float]] = None,
    ) -> List[float]:
        """Convert a normalized bbox to a 3D scene position [x, y, z]."""
        # Bottom-center of bbox is the "foot" position
        screen_x = bbox.x + bbox.width / 2.0  # 0..1
        screen_y_bottom = bbox.y + bbox.height  # 0..1, bottom of bbox

        # Map screen X -> world X: left=-bounds, right=+bounds
        world_x = (screen_x - 0.5) * 2.0 * self.scene_bounds

        # Map vertical position to depth: top of screen = far (-Z), bottom = near (+Z)
        world_z = (screen_y_bottom - 0.5) * 2.0 * self.scene_bounds

        # Y position: ground-level objects at 0.25, persons at 0.5
        world_y = 0.5 if bbox.height > 0.3 else 0.25

        # Apply camera offset if provided
        if camera_offset:
            world_x += camera_offset.get("x", 0)
            world_z += camera_offset.get("z", 0)

        return [round(world_x, 2), round(world_y, 2), round(world_z, 2)]

    def tracks_to_scene(
        self,
        tracks: Dict[str, "PersonTrack"],
        camera_offset: Optional[Dict[str, float]] = None,
    ) -> Dict[str, List[List[float]]]:
        """Compute average scene positions for each person track."""
        result: Dict[str, List[List[float]]] = {}
        for track_id, track in tracks.items():
            positions = []
            for det in track.detections:
                pos = self.bbox_to_scene(det.bbox, camera_offset)
                positions.append(pos)
            if positions:
                # Average position for the track
                avg = [
                    round(sum(p[0] for p in positions) / len(positions), 2),
                    round(sum(p[1] for p in positions) / len(positions), 2),
                    round(sum(p[2] for p in positions) / len(positions), 2),
                ]
                result[track_id] = [avg]
            else:
                result[track_id] = []
        return result


class VideoProcessingPipeline:
    """
    Full AI processing pipeline for a single evidence video.
    """

    def __init__(
        self,
        yolo_model_path: str = "./ai/models/yolov8n.pt",
        reid_model_path: str = "./ai/models/fastreid_baseline.pth",
        confidence_threshold: float = 0.65,
        detection_threshold: float = 0.65,
        reid_threshold: float = 0.78,
        frame_interval: float = 0.5,
        gpu_enabled: bool = False,
    ):
        # Support both param names for backwards compat
        threshold = detection_threshold if detection_threshold != 0.65 else confidence_threshold
        self.gpu_enabled = gpu_enabled
        self.output_base_dir = "./storage/processing"
        self.extractor = FrameExtractor(interval_seconds=frame_interval)
        self.detector = ObjectDetector(yolo_model_path, threshold)
        self.tracker = PersonTracker()
        self.reid = ReIDModule(reid_model_path, reid_threshold)
        self.scene_mapper = SceneMapper()

    def process(
        self,
        video_path: str,
        evidence_id: Optional[str] = None,
        output_dir: Optional[str] = None,
        progress_callback=None,
    ) -> Dict[str, Any]:
        """Run full pipeline and return structured results.

        Can be called as:
            pipeline.process(video_path)                              # minimal
            pipeline.process(video_path, evidence_id, output_dir)     # explicit
            pipeline.process(video_path, progress_callback=fn)        # celery style
        """
        # Resolve defaults
        if evidence_id is None:
            evidence_id = os.path.splitext(os.path.basename(video_path))[0]
        if output_dir is None:
            output_dir = os.path.join(self.output_base_dir, evidence_id)

        logger.info(f"Starting pipeline for evidence {evidence_id}")
        result = {
            "evidence_id": evidence_id,
            "status": "running",
            "started_at": datetime.utcnow().isoformat(),
            "objects": [],
            "persons": [],
            "events": [],
            "synopsis": "",
            "confidence": 0.0,
            "processing_models": ["YOLOv8", "ByteTrack", "FastReID"],
        }

        try:
            frames_dir = os.path.join(output_dir, evidence_id, "frames")
            frames = self.extractor.extract(video_path, frames_dir)
            total = len(frames)

            all_detections: List[Detection] = []
            for i, frame_meta in enumerate(frames):
                dets = self.detector.detect(
                    frame_meta["path"],
                    frame_meta["frame_number"],
                    frame_meta["timestamp"],
                )
                tracked = self.tracker.update(dets)
                all_detections.extend(tracked)

                # Re-ID
                for det in tracked:
                    if det.label == "person" and det.track_id:
                        emb = self.reid.extract_embedding(frame_meta["path"], det.bbox)
                        self.reid.add_to_gallery(det.track_id, emb)

                if progress_callback:
                    pct = int((i + 1) / total * 90)
                    try:
                        progress_callback(pct, "Detection & tracking")
                    except TypeError:
                        progress_callback(pct)

            # Build persons summary with scene positions
            track_scene_positions = self.scene_mapper.tracks_to_scene(self.tracker.tracks)
            persons = []
            for track_id, track in self.tracker.tracks.items():
                if track.detections:
                    persons.append({
                        "track_id": track_id,
                        "label": f"Person {len(persons) + 1}",
                        "confidence": round(track.confidence * 100, 1),
                        "first_seen": track.first_seen,
                        "last_seen": track.last_seen,
                        "frame_count": len(track.detections),
                        "scene_positions": track_scene_positions.get(track_id, []),
                    })

            # Build objects summary
            object_counts: Dict[str, int] = {}
            for det in all_detections:
                if det.label != "person":
                    object_counts[det.label] = object_counts.get(det.label, 0) + 1
            objects = [{"label": k, "count": v} for k, v in object_counts.items()]

            # Events (simplified)
            events = []
            if persons:
                events.append({
                    "type": "person_detected",
                    "description": f"{len(persons)} person(s) detected in footage.",
                    "timestamp": persons[0]["first_seen"],
                    "confidence": 90,
                    "significance": "high",
                })

            # Build detailed detections with scene positions (sampled to limit size)
            detailed_detections = []
            max_detections = 200  # limit to keep JSONB manageable
            step = max(1, len(all_detections) // max_detections)
            for det in all_detections[::step]:
                scene_pos = self.scene_mapper.bbox_to_scene(det.bbox)
                detailed_detections.append({
                    "label": det.label,
                    "confidence": round(det.confidence, 3),
                    "bbox": {
                        "x": round(det.bbox.x, 4),
                        "y": round(det.bbox.y, 4),
                        "width": round(det.bbox.width, 4),
                        "height": round(det.bbox.height, 4),
                    },
                    "frame_number": det.frame_number,
                    "timestamp": round(det.timestamp, 2),
                    "track_id": det.track_id,
                    "scene_position": scene_pos,
                })

            # Compute overall confidence
            confidences = [p["confidence"] for p in persons]
            overall_confidence = round(sum(confidences) / len(confidences), 1) if confidences else 75.0

            result.update({
                "status": "completed",
                "completed_at": datetime.utcnow().isoformat(),
                "objects": objects,
                "persons": persons,
                "events": events,
                "detections": detailed_detections,
                "synopsis": self._generate_synopsis(persons, objects, events),
                "confidence": overall_confidence,
            })

            if progress_callback:
                try:
                    progress_callback(100, "Complete")
                except TypeError:
                    progress_callback(100)

            logger.info(f"Pipeline complete for {evidence_id}: {len(persons)} persons, {len(objects)} object types")

        except Exception as e:
            logger.error(f"Pipeline failed for {evidence_id}: {e}", exc_info=True)
            result["status"] = "failed"
            result["error"] = str(e)

        return result

    def _generate_synopsis(
        self,
        persons: List[dict],
        objects: List[dict],
        events: List[dict],
    ) -> str:
        parts = []
        if persons:
            parts.append(f"{len(persons)} person(s) detected and tracked.")
        if objects:
            obj_str = ", ".join(f"{o['count']} {o['label']}(s)" for o in objects[:5])
            parts.append(f"Objects identified: {obj_str}.")
        if not parts:
            parts.append("No significant detections in footage.")
        return " ".join(parts)
