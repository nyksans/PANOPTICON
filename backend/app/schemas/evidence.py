from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class EvidenceResponse(BaseModel):
    id: str
    case_id: str
    filename: str
    original_name: str
    file_type: str
    file_size: int
    file_url: str
    thumbnail_url: str
    duration: Optional[float] = None
    resolution: Optional[str] = None
    fps: Optional[float] = None
    status: str
    metadata_: Optional[dict] = {}
    ai_results: Optional[dict] = None
    tags: List[str] = []
    notes: str = ""
    file_hash: str
    uploaded_by: str
    uploaded_at: datetime
    processed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class EvidenceListResponse(BaseModel):
    data: List[EvidenceResponse]
    total: int
    page: int
    page_size: int


class BBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class DetectionRecord(BaseModel):
    label: str
    confidence: float
    bbox: BBox
    frame_number: int
    timestamp: float
    track_id: Optional[str] = None
    scene_position: Optional[List[float]] = None


class PersonSummary(BaseModel):
    track_id: str
    label: str
    confidence: float
    first_seen: float
    last_seen: float
    frame_count: int
    scene_positions: Optional[List[List[float]]] = None


class ObjectSummary(BaseModel):
    label: str
    count: int


class EventRecord(BaseModel):
    type: str
    description: str
    timestamp: float
    confidence: float
    significance: str = "medium"


class DetectionResultsResponse(BaseModel):
    evidence_id: str
    status: str
    persons: List[PersonSummary] = []
    objects: List[ObjectSummary] = []
    events: List[EventRecord] = []
    detections: List[DetectionRecord] = []
    synopsis: str = ""
    confidence: float = 0.0
    processing_models: List[str] = []
    total_detections: int = 0
