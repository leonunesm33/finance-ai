from fastapi import APIRouter

from app.core.database import check_db_connection
from app.core.redis import check_redis_connection

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check():
    try:
        await check_db_connection()
        db_status = "ok"
    except Exception:
        db_status = "error"

    try:
        await check_redis_connection()
        redis_status = "ok"
    except Exception:
        redis_status = "error"

    overall = "ok" if db_status == "ok" and redis_status == "ok" else "error"

    return {"status": overall, "db": db_status, "redis": redis_status}
