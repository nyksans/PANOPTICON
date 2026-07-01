from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.core.security import verify_password, hash_password, create_access_token, get_current_user_id

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ---------------------------------------------------------------------------
# Seeded demo users with properly hashed passwords.
# In production these come from the `users` table via SQLAlchemy.
# Passwords are hashed with bcrypt (passlib) — never stored plain-text.
# ---------------------------------------------------------------------------
_DEMO_PASSWORD_HASH = hash_password("demo1234")
_ADMIN_PASSWORD_HASH = hash_password("admin1234")

MOCK_USERS: dict[str, dict] = {
    "analyst@panopticon.gov": {
        "id": "user-001",
        "email": "analyst@panopticon.gov",
        "name": "Det. Sarah Kim",
        "role": "investigator",
        "badge": "DET-4821",
        "department": "Homicide Division",
        "hashed_password": _DEMO_PASSWORD_HASH,
    },
    "admin@panopticon.gov": {
        "id": "user-admin",
        "email": "admin@panopticon.gov",
        "name": "Commander R. Torres",
        "role": "admin",
        "badge": "ADM-001",
        "department": "IT Security",
        "hashed_password": _ADMIN_PASSWORD_HASH,
    },
}


def _get_public_fields(user: dict) -> dict:
    return {k: v for k, v in user.items() if k != "hashed_password"}


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
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


@router.post("/logout")
async def logout():
    # JWT is stateless; client should discard the token.
    # A production implementation would add the jti to a Redis blacklist.
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(user_id: str = Depends(get_current_user_id)):
    """Return the profile of the currently authenticated user."""
    user = next((u for u in MOCK_USERS.values() if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**_get_public_fields(user))
