from fastapi import APIRouter, HTTPException, status, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.core.security import verify_password, hash_password, create_access_token, get_current_user_id, verify_clerk_token
from app.db.base import get_db
from app.models.user import User
import uuid
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Lazy initialize password hashes to avoid bcrypt issues at import time
_password_hashes = {}
MOCK_USERS = {}

def _initialize_mock_users():
    global _password_hashes, MOCK_USERS
    if not MOCK_USERS:
        # Initialize password hashes
        _password_hashes["demo"] = hash_password("demo1234")
        _password_hashes["admin"] = hash_password("admin1234")
        
        MOCK_USERS = {
            "analyst@panopticon.gov": {
                "id": "user-001",
                "email": "analyst@panopticon.gov",
                "name": "Det. Sarah Kim",
                "role": "investigator",
                "badge": "DET-4821",
                "department": "Homicide Division",
                "hashed_password": _password_hashes["demo"],
            },
            "admin@panopticon.gov": {
                "id": "user-admin",
                "email": "admin@panopticon.gov",
                "name": "Commander R. Torres",
                "role": "admin",
                "badge": "ADM-001",
                "department": "IT Security",
                "hashed_password": _password_hashes["admin"],
            },
        }


def _get_public_fields(user: dict) -> dict:
    return {k: v for k, v in user.items() if k != "hashed_password"}


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    _initialize_mock_users()
    user = MOCK_USERS.get(payload.email.lower())
    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    token = create_access_token(subject=user["id"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(**_get_public_fields(user)),
    )


@router.post("/clerk-sync")
async def clerk_sync(request: Request, db: AsyncSession = Depends(get_db)):
    """Sync user from Clerk webhook"""
    try:
        data = await request.json()
        event_type = data.get("type")
        user_data = data.get("data", {})
        
        if event_type == "user.created":
            clerk_id = user_data.get("id")
            email = user_data.get("email_addresses", [{}])[0].get("email_address")
            first_name = user_data.get("first_name", "")
            last_name = user_data.get("last_name", "")
            name = f"{first_name} {last_name}".strip()
            
            if not clerk_id or not email:
                raise ValueError("Missing required fields")
            
            # Check if user exists
            result = await db.execute(select(User).where(User.clerk_id == clerk_id))
            existing_user = result.scalar_one_or_none()
            
            if not existing_user:
                new_user = User(
                    id=str(uuid.uuid4()),
                    clerk_id=clerk_id,
                    email=email,
                    name=name,
                    role="analyst",
                    active=True,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                db.add(new_user)
                await db.flush()
                logger.info(f"Synced new user from Clerk: {email}")
        
        elif event_type == "user.updated":
            clerk_id = user_data.get("id")
            result = await db.execute(select(User).where(User.clerk_id == clerk_id))
            user = result.scalar_one_or_none()
            
            if user:
                first_name = user_data.get("first_name", "")
                last_name = user_data.get("last_name", "")
                user.name = f"{first_name} {last_name}".strip() or user.name
                user.updated_at = datetime.now(timezone.utc)
                await db.flush()
                logger.info(f"Updated user from Clerk: {user.email}")
        
        elif event_type == "user.deleted":
            clerk_id = user_data.get("id")
            result = await db.execute(select(User).where(User.clerk_id == clerk_id))
            user = result.scalar_one_or_none()
            
            if user:
                user.active = False
                user.updated_at = datetime.now(timezone.utc)
                await db.flush()
                logger.info(f"Deactivated user from Clerk: {user.email}")
        
        return {"status": "ok", "event": event_type}
    except Exception as e:
        logger.error(f"Clerk sync error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    """Return the profile of the currently authenticated user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        # Fall back to mock users for compatibility
        _initialize_mock_users()
        mock_user = next((u for u in MOCK_USERS.values() if u["id"] == user_id), None)
        if not mock_user:
            raise HTTPException(status_code=404, detail="User not found")
        return UserResponse(**_get_public_fields(mock_user))
    
    return UserResponse.from_orm(user)
