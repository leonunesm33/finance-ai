from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "financeai",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone=settings.TZ,
    enable_utc=True,
)

celery_app.conf.beat_schedule = {
    "sync-all-connections": {
        "task": "pluggy.sync_all_connections",
        "schedule": settings.SYNC_INTERVAL_HOURS * 3600,
    },
}

from app.tasks import pluggy_sync  # noqa: E402,F401
