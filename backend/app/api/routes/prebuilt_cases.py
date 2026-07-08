from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.datasets.indian_cases import (
    get_all_cases, get_case_by_category, get_case_by_state, 
    get_case_by_priority, get_case_by_number
)

router = APIRouter(prefix="/prebuilt-cases", tags=["Prebuilt Cases"])

@router.get("")
async def list_prebuilt_cases(
    category: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
):
    """Get prebuilt Indian investigation cases with optional filters"""
    cases = get_all_cases()
    
    if category:
        cases = get_case_by_category(category)
    elif state:
        cases = get_case_by_state(state)
    elif priority:
        cases = get_case_by_priority(priority)
    
    return {"total": len(cases), "data": cases}

@router.get("/{case_number}")
async def get_prebuilt_case(case_number: str):
    """Get a specific prebuilt case by case number"""
    case = get_case_by_number(case_number)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_number} not found")
    return case
