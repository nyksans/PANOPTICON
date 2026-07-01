from sqlalchemy import String, Text, Float, Integer, Boolean, DateTime, ForeignKey, Enum, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import uuid
import enum

from app.db.base import Base


class CaseStatus(str, enum.Enum):
    active = "active"
    pending = "pending"
    closed = "closed"
    archived = "archived"


class CasePriority(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    case_number: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(256))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default=CaseStatus.pending)
    priority: Mapped[str] = mapped_column(String(16), default=CasePriority.medium)
    category: Mapped[str] = mapped_column(String(64), default="")
    location: Mapped[str] = mapped_column(String(256), default="")
    incident_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ai_processed: Mapped[bool] = mapped_column(Boolean, default=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    created_by: Mapped[str] = mapped_column(String(128), default="")
    assigned_to: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    evidence: Mapped[list["Evidence"]] = relationship("Evidence", back_populates="case")
    suspects: Mapped[list["Suspect"]] = relationship("Suspect", back_populates="case")
    timeline_events: Mapped[list["TimelineEvent"]] = relationship("TimelineEvent", back_populates="case")

