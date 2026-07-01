from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.db.base import get_db
from app.models.case import Case
from app.models.evidence import Evidence
from app.schemas.case import CaseCreate, CaseUpdate, CaseResponse, CaseListResponse
from app.core.security import get_current_user_id

router = APIRouter(prefix="/cases", tags=["Cases"])


def _generate_case_number() -> str:
    import random
    year = datetime.now(timezone.utc).year
    num = random.randint(1000, 9999)
    return f"PAN-{year}-{num:04d}"


def _case_to_dict(case: Case, evidence_count: int = 0) -> dict:
    return {
        "id": case.id,
        "case_number": case.case_number,
        "title": case.title,
        "description": case.description,
        "status": case.status,
        "priority": case.priority,
        "category": case.category,
        "location": case.location,
        "incident_date": case.incident_date,
        "ai_processed": case.ai_processed,
        "confidence_score": case.confidence_score,
        "tags": case.tags or [],
        "created_by": case.created_by,
        "assigned_to": case.assigned_to or [],
        "created_at": case.created_at,
        "updated_at": case.updated_at,
        "evidence_count": evidence_count,
    }


@router.get("", response_model=CaseListResponse)
async def list_cases(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    stmt = select(Case)
    if status:
        stmt = stmt.where(Case.status == status)
    if priority:
        stmt = stmt.where(Case.priority == priority)
    if search:
        q = f"%{search}%"
        stmt = stmt.where(
            or_(Case.title.ilike(q), Case.case_number.ilike(q), Case.location.ilike(q))
        )

    # Total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    # Paginated data
    stmt = stmt.order_by(Case.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    cases = result.scalars().all()

    # Fetch evidence counts for returned cases in one query
    case_ids = [c.id for c in cases]
    ev_counts: dict[str, int] = {}
    if case_ids:
        ev_stmt = (
            select(Evidence.case_id, func.count(Evidence.id).label("cnt"))
            .where(Evidence.case_id.in_(case_ids))
            .group_by(Evidence.case_id)
        )
        ev_result = await db.execute(ev_stmt)
        ev_counts = {row.case_id: row.cnt for row in ev_result}

    data = [_case_to_dict(c, ev_counts.get(c.id, 0)) for c in cases]
    return CaseListResponse(data=data, total=total, page=page, page_size=page_size)


@router.post("", response_model=CaseResponse, status_code=201)
async def create_case(
    payload: CaseCreate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    case = Case(
        id=str(uuid.uuid4()),
        case_number=_generate_case_number(),
        title=payload.title,
        description=payload.description or "",
        status="pending",
        priority=payload.priority,
        category=payload.category or "",
        location=payload.location,
        incident_date=payload.incident_date,
        ai_processed=False,
        confidence_score=0.0,
        tags=payload.tags or [],
        created_by=user_id,
        assigned_to=payload.assigned_to or [],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(case)
    await db.flush()
    await db.refresh(case)
    return _case_to_dict(case, 0)


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    ev_count_result = await db.execute(
        select(func.count(Evidence.id)).where(Evidence.case_id == case_id)
    )
    ev_count = ev_count_result.scalar_one()
    return _case_to_dict(case, ev_count)


@router.patch("/{case_id}", response_model=CaseResponse)
async def update_case(
    case_id: str,
    payload: CaseUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    updates = payload.model_dump(exclude_none=True)
    for key, value in updates.items():
        setattr(case, key, value)
    case.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(case)

    ev_count_result = await db.execute(
        select(func.count(Evidence.id)).where(Evidence.case_id == case_id)
    )
    ev_count = ev_count_result.scalar_one()
    return _case_to_dict(case, ev_count)


@router.delete("/{case_id}", status_code=204)
async def delete_case(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    await db.delete(case)
