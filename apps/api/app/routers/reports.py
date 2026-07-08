import uuid

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.celery_app import celery_app
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.report import (
    AIAnalysisJobResponse,
    AIAnalysisRequest,
    AIAnalysisStatusResponse,
    CategoryReport,
    MonthlyReport,
    YearlyReport,
)
from app.services import report_service
from app.tasks.ai_analysis import generate_ai_analysis

router = APIRouter(prefix="/v1/reports", tags=["reports"])


@router.get("/monthly", response_model=MonthlyReport)
async def get_monthly_report(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await report_service.get_monthly_report(db, current_user, year, month)


@router.get("/yearly", response_model=YearlyReport)
async def get_yearly_report(
    year: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await report_service.get_yearly_report(db, current_user, year)


@router.get("/category/{category_id}", response_model=CategoryReport)
async def get_category_report(
    category_id: uuid.UUID,
    months: int = Query(default=12, ge=1, le=36),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await report_service.get_category_report(db, current_user, category_id, months)


@router.post("/ai-analysis", response_model=AIAnalysisJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def request_ai_analysis(data: AIAnalysisRequest, current_user: User = Depends(get_current_user)):
    task = generate_ai_analysis.delay(
        str(current_user.id), data.period_start.isoformat(), data.period_end.isoformat()
    )
    await report_service.register_analysis_job(task.id, current_user.id)
    return AIAnalysisJobResponse(job_id=task.id)


@router.get("/ai-analysis/{job_id}", response_model=AIAnalysisStatusResponse)
async def get_ai_analysis_status(job_id: str, current_user: User = Depends(get_current_user)):
    if not await report_service.is_analysis_job_owner(job_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Análise não encontrada")

    result = AsyncResult(job_id, app=celery_app)
    if result.state == "SUCCESS":
        return AIAnalysisStatusResponse(status=result.state, result=result.result)
    if result.state == "FAILURE":
        return AIAnalysisStatusResponse(status=result.state, result=str(result.result))
    return AIAnalysisStatusResponse(status=result.state)
