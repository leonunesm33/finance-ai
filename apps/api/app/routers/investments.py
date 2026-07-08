import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.investment import InvestmentCreate, InvestmentResponse, InvestmentsSummary, InvestmentUpdate
from app.services import investment_service

router = APIRouter(prefix="/v1/investments", tags=["investments"])


@router.get("/", response_model=list[InvestmentResponse])
async def list_investments(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await investment_service.list_investments(db, current_user)


@router.get("/summary", response_model=InvestmentsSummary)
async def get_investments_summary(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await investment_service.get_investments_summary(db, current_user)


@router.post("/", response_model=InvestmentResponse, status_code=status.HTTP_201_CREATED)
async def create_investment(
    data: InvestmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await investment_service.create_investment(db, current_user, data)


@router.put("/{investment_id}", response_model=InvestmentResponse)
async def update_investment(
    investment_id: uuid.UUID,
    data: InvestmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await investment_service.update_investment(db, current_user, investment_id, data)


@router.delete("/{investment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_investment(
    investment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await investment_service.delete_investment(db, current_user, investment_id)
