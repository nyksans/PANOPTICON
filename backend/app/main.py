from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import sys
import logging

# ---------------------------------------------------------------------------
# Ensure the project root (parent of /backend) is on sys.path so that
# `from ai.services.llm_service import LLMService` resolves correctly.
# ---------------------------------------------------------------------------
_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from app.core.config import settings
from app.api.routes import auth, cases, evidence, ai, dashboard, prebuilt_cases
from app.api.routes import datasets as datasets_router


# Logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("panopticon")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting PANOPTICON API v{settings.APP_VERSION}")
    os.makedirs(settings.LOCAL_STORAGE_PATH, exist_ok=True)
    os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)

    # Auto-create tables in development (Alembic handles production migrations)
    if settings.ENVIRONMENT in ("development", "test"):
        try:
            from app.db.base import engine, Base
            # Import all models so Base.metadata is populated
            from app.models import case, evidence as evidence_model, user  # noqa: F401
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables verified/created")
        except Exception as exc:
            logger.warning(f"Could not auto-create tables (DB may not be ready): {exc}")

    # ── Initialize AI models on startup ────────────────────────────────────
    try:
        logger.info("Initializing AI inference models…")
        from ai.models import startup_models
        
        def progress_cb(pct: int, msg: str):
            if pct % 20 == 0 or pct == 100:
                logger.info(f"  [{pct:3d}%] {msg}")
        
        results = startup_models(device="auto")
        loaded_count = sum(1 for v in results.values() if v)
        logger.info(f"✓ AI models initialized: {loaded_count}/{len(results)} modules loaded")
        
        for name, success in results.items():
            status = "✓" if success else "✗"
            logger.info(f"  {status} {name}")
    except Exception as exc:
        logger.warning(f"Could not initialize AI models: {exc}. Inference may be unavailable.")

    yield
    logger.info("PANOPTICON API shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "PANOPTICON – AI-powered forensic intelligence platform. "
        "Reconstruct crime scenes from fragmented visual evidence."
    ),
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# API Routes
API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(cases.router, prefix=API_PREFIX)
app.include_router(evidence.router, prefix=API_PREFIX)
app.include_router(ai.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(prebuilt_cases.router, prefix=API_PREFIX)
app.include_router(datasets_router.router)

# Static files for local storage
if os.path.exists(settings.LOCAL_STORAGE_PATH):
    app.mount("/storage", StaticFiles(directory=settings.LOCAL_STORAGE_PATH), name="storage")


@app.get("/health")
async def health():
    return {"status": "healthy", "version": settings.APP_VERSION, "env": settings.ENVIRONMENT}


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/api/docs",
    }
