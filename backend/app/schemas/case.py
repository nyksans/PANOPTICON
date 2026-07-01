from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class CaseStatus(str, Enum):
    active = "active"
    pending = "pending"
    closed = "closed"
    archived = "archived"


class CasePriority(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class CaseCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=256)
    description: Optional[str] = ""
    priority: CasePriority = CasePriority.medium
    category: Optional[str] = ""
    location: str = Field(..., min_length=1)
    incident_date: datetime
    tags: Optional[List[str]] = []
    assigned_to: Optional[List[str]] = []


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[CaseStatus] = None
    priority: Optional[CasePriority] = None
    category: Optional[str] = None
    location: Optional[str] = None
    incident_date: Optional[datetime] = None
    tags: Optional[List[str]] = None
    assigned_to: Optional[List[str]] = None


class CaseResponse(BaseModel):
    id: str
    case_number: str
    title: str
    description: str
    status: str
    priority: str
    category: str
    location: str
    incident_date: datetime
    ai_processed: bool
    confidence_score: float
    tags: List[str]
    created_by: str
    assigned_to: List[str]
    created_at: datetime
    updated_at: datetime
    evidence_count: int = 0

    model_config = {"from_attributes": True}


class CaseListResponse(BaseModel):
    data: List[CaseResponse]
    total: int
    page: int
    page_size: int
