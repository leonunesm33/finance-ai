"""Configuração pública consumida pelo frontend (feature flags, sem segredos)."""
from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(prefix="/v1/config", tags=["config"])


@router.get("")
async def get_public_config() -> dict:
    return {
        "app_name": settings.APP_NAME,
        "open_finance_enabled": settings.OPEN_FINANCE_ENABLED,
        "ai_enabled": settings.ai_enabled,
    }
