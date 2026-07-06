"""
PANOPTICON Inference Pipeline Tests
Validates all AI models and integration points.

Run: pytest ai/tests/test_inference_pipeline.py -v
"""

import numpy as np
import pytest
from pathlib import Path


class TestDetector:
    """YOLOv8 Object Detection Tests"""

    def test_detector_initialization(self):
        from ai.models.detector import YOLODetector

        detector = YOLODetector(device="cpu")
        assert detector is not None
        assert detector.name == "yolo_detector"

    def test_detector_load(self):
        from ai.models.detector import YOLODetector

        detector = YOLODetector(device="cpu")
        result = detector.load()
        assert result.is_loaded

    def test_detector_mock_inference(self):
        from ai.models.detector import YOLODetector

        detector = YOLODetector(device="cpu")
        detector.load()

        # Create dummy frames
        frames = [np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8) for _ in range(2)]

        results = detector.infer(frames)
        assert len(results) == 2
        assert all(isinstance(r, list) for r in results)


class TestTracker:
    """ByteTrack Multi-Object Tracking Tests"""

    def test_tracker_initialization(self):
        from ai.models.tracker import ByteTracker

        tracker = ByteTracker(iou_threshold=0.3)
        assert tracker is not None
        assert tracker.name == "byte_tracker"

    def test_tracker_assignment(self):
        from ai.models.tracker import ByteTracker

        tracker = ByteTracker(iou_threshold=0.3)
        tracker.load()

        # Create mock detections
        det1 = {
            "label": "person",
            "confidence": 0.9,
            "bbox": {"x": 0.2, "y": 0.1, "width": 0.15, "height": 0.55},
        }
        det2 = {
            "label": "backpack",
            "confidence": 0.8,
            "bbox": {"x": 0.22, "y": 0.55, "width": 0.1, "height": 0.2},
        }

        detections = [det1, det2]
        result = tracker.infer(detections)

        # Should assign track IDs to persons
        person_dets = [d for d in result if d.get("label") == "person"]
        assert person_dets[0]["track_id"] is not None


class TestReID:
    """FastReID Person Re-Identification Tests"""

    def test_reid_initialization(self):
        from ai.models.reid import FastReIDModule

        reid = FastReIDModule(device="cpu")
        assert reid is not None
        assert reid.name == "fastreid"

    def test_reid_mock_embeddings(self):
        from ai.models.reid import FastReIDModule

        reid = FastReIDModule(device="cpu")
        reid.load()

        # Create mock person crops
        crops = [np.random.randint(0, 255, (128, 64, 3), dtype=np.uint8) for _ in range(3)]

        embeddings = reid.infer(crops)
        assert embeddings.shape == (3, reid.embedding_dim)

        # Check normalization (should be unit norm)
        norms = np.linalg.norm(embeddings, axis=1)
        np.testing.assert_array_almost_equal(norms, np.ones(3), decimal=5)

    def test_reid_similarity(self):
        from ai.models.reid import FastReIDModule

        reid = FastReIDModule(device="cpu")

        # Create two similar embeddings
        emb1 = np.array([1, 0, 0, 0], dtype=np.float32)
        emb1 = emb1 / np.linalg.norm(emb1)

        emb2 = np.array([1, 0.1, 0, 0], dtype=np.float32)
        emb2 = emb2 / np.linalg.norm(emb2)

        sim = reid.similarity(emb1, emb2, metric="cosine")
        assert 0 <= sim <= 1
        assert sim > 0.95  # Very similar


class TestModelRegistry:
    """Model Registry Integration Tests"""

    def test_registry_initialization(self):
        from ai.models import get_registry

        registry = get_registry(device="cpu")
        assert registry is not None

    def test_registry_startup(self):
        from ai.models import get_registry

        registry = get_registry(device="cpu")
        status = registry.startup(skip_models=["segmentor"])

        # Should at least have detector and tracker
        assert "detector" in status
        assert "tracker" in status

    def test_registry_batch_inference(self):
        from ai.models import get_registry

        registry = get_registry(device="cpu")
        registry.startup(skip_models=["segmentor", "reid"])

        # Create dummy frames
        frames = [np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8) for _ in range(2)]

        results = registry.infer_batch(
            frames,
            detections_only=True,
            track=False,
            segment=False,
            reid=False,
        )

        assert "detections" in results
        assert len(results["detections"]) == 2


class TestInferencePipeline:
    """Full Pipeline Integration Tests"""

    def test_pipeline_initialization(self):
        from ai.services.inference_pipeline import InferencePipeline

        pipeline = InferencePipeline(device="cpu", batch_size=2)
        assert pipeline is not None

    def test_pipeline_startup(self):
        from ai.services.inference_pipeline import InferencePipeline

        pipeline = InferencePipeline(device="cpu", batch_size=2)
        status = pipeline.startup(skip_models=["segmentor"])

        assert any(status.values())  # At least one model loaded

    def test_pipeline_mock_video_processing(self, tmp_path):
        """Test pipeline with mock video (requires actual video file)"""
        from ai.services.inference_pipeline import InferencePipeline

        pipeline = InferencePipeline(device="cpu")
        pipeline.startup(skip_models=["segmentor"])

        # This test requires actual video file
        # Skipping for unit tests, enable for integration tests
        pytest.skip("Requires video file")


class TestBenchmarkEvaluator:
    """Benchmark Evaluation Tests"""

    def test_evaluator_initialization(self):
        from ai.services.benchmark_evaluator import BenchmarkEvaluator

        evaluator = BenchmarkEvaluator()
        assert evaluator is not None

    def test_mock_coco_evaluation(self):
        from ai.services.benchmark_evaluator import BenchmarkEvaluator

        evaluator = BenchmarkEvaluator()
        results = evaluator.evaluate_coco_detection(
            predictions=[],
            ground_truth=[],
            iou_threshold=0.5,
        )

        assert "precision" in results
        assert "recall" in results
        assert "ap" in results

    def test_mock_mot_evaluation(self):
        from ai.services.benchmark_evaluator import BenchmarkEvaluator

        evaluator = BenchmarkEvaluator()
        results = evaluator.evaluate_mot17_tracking(
            predictions={},
            ground_truth_dir=".",
        )

        assert "mota" in results
        assert "motp" in results
        assert "idf1" in results


class TestReportGenerator:
    """Report Generation Tests"""

    def test_report_generator_initialization(self):
        from ai.services.report_generator import ForensicReportGenerator

        gen = ForensicReportGenerator()
        assert gen is not None

    def test_report_generation(self, tmp_path):
        from ai.services.report_generator import ForensicReportGenerator

        gen = ForensicReportGenerator(output_dir=str(tmp_path))

        case_data = {
            "case_number": "TEST-001",
            "title": "Test Case",
            "description": "Testing report generation",
        }

        evidence_results = [
            {
                "video_path": "test.mp4",
                "persons": [{"track_id": 1, "label": "Person_1", "confidence": 0.9}],
                "objects": {"backpack": 1},
                "events": [{"type": "person_detected"}],
                "confidence": 0.85,
            }
        ]

        paths = gen.generate_case_report(
            case_id="test-case",
            case_data=case_data,
            evidence_results=evidence_results,
            report_type="comprehensive",
        )

        assert "json" in paths
        assert Path(paths["json"]).exists()


class TestWeightsManager:
    """Model Weights Management Tests"""

    def test_weights_registry(self):
        from ai.models.weights_manager import WEIGHT_REGISTRY

        assert "yolov8x" in WEIGHT_REGISTRY
        assert "fastreid_msmt17" in WEIGHT_REGISTRY

    def test_weights_status(self):
        from ai.models.weights_manager import weights_status

        status = weights_status()
        assert isinstance(status, dict)
        assert len(status) > 0

    def test_get_weight_path(self):
        from ai.models.weights_manager import get_weight_path

        path = get_weight_path("yolov8x")
        # May be None if not downloaded yet
        assert path is None or isinstance(path, Path)


# ── Fixtures ─────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def dummy_video_path(tmp_path_factory):
    """Create a dummy video file for testing."""
    import cv2

    tmp_dir = tmp_path_factory.mktemp("videos")
    video_path = tmp_dir / "test.mp4"

    # Create dummy video
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(video_path), fourcc, 30.0, (640, 480))
    for _ in range(30):
        frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        out.write(frame)
    out.release()

    return video_path


# ── Markers ──────────────────────────────────────────────────────────────

pytestmark = [
    pytest.mark.unit,  # Unit tests
]


# ── Performance Benchmarks ───────────────────────────────────────────────

@pytest.mark.performance
def test_detector_inference_speed():
    """Benchmark detector inference time."""
    import time
    from ai.models.detector import YOLODetector

    detector = YOLODetector(device="cpu")
    detector.load()

    frames = [np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8) for _ in range(10)]

    start = time.time()
    detector.infer(frames)
    elapsed = time.time() - start

    fps = len(frames) / elapsed
    print(f"\nDetection FPS: {fps:.1f}")

    # On CPU, expect ~1-5 FPS
    assert fps > 0


@pytest.mark.performance
def test_reid_inference_speed():
    """Benchmark ReID inference time."""
    import time
    from ai.models.reid import FastReIDModule

    reid = FastReIDModule(device="cpu")
    reid.load()

    crops = [np.random.randint(0, 255, (128, 64, 3), dtype=np.uint8) for _ in range(100)]

    start = time.time()
    reid.infer(crops)
    elapsed = time.time() - start

    fps = len(crops) / elapsed
    print(f"\nReID FPS: {fps:.1f}")

    assert fps > 0
