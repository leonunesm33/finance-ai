import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.dashboard import DashboardPeriod, DashboardSummaryResponse
from app.services import dashboard_service

router = APIRouter(prefix="/v1/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    period: DashboardPeriod = "current_month",
    date_from: dt.date | None = None,
    date_to: dt.date | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await dashboard_service.build_dashboard_summary(db, current_user, period, date_from, date_to)
