from pydantic_settings import BaseSettings
from pydantic import Field, field_validator, ConfigDict
from typing import List, Optional
import os


class Settings(BaseSettings):
    model_config = ConfigDict(
        extra="ignore",
        case_sensitive=True,
        env_file=".env"
    )
    
    # App
    APP_NAME: str = "PANOPTICON API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 1
    RELOAD: bool = True

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001"
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, list):
            return ",".join(v)
        if isinstance(v, str):
            return v
        return "http://localhost:3000"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://panopticon:panopticon@localhost:5432/panopticon"
    DATABASE_ECHO: bool = False

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL: int = 300  # 5 minutes

    # JWT Auth
    SECRET_KEY: str = "panopticon-secret-key-change-in-production-please"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours

    # Storage
    STORAGE_BACKEND: str = "local"  # local | s3
    LOCAL_STORAGE_PATH: str = "./storage/evidence"
    S3_BUCKET: Optional[str] = None
    S3_REGION: Optional[str] = None
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None

    # AI Models
    GEMINI_API_KEY: Optional[str] = None
    YOLO_MODEL_PATH: str = "./ai/models/yolov8n.pt"
    REID_MODEL_PATH: str = "./ai/models/fastreid_baseline.pth"

    # ChromaDB
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8001
    CHROMA_PERSIST_DIR: str = "./storage/chroma"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Processing
    MAX_UPLOAD_SIZE_MB: int = 10240  # 10 GB
    DETECTION_CONFIDENCE_THRESHOLD: float = 0.65
    REID_SIMILARITY_THRESHOLD: float = 0.78
    PROCESSING_WORKERS: int = 2
    GPU_ENABLED: bool = False


try:
    settings = Settings()
except Exception as e:
    print(f"Warning: Settings validation error: {e}")
    # Fallback to minimal settings
    settings = Settings(
        CORS_ORIGINS="http://localhost:3000,http://localhost:8000"
    )
