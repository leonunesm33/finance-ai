from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.open_finance import BankAccountResponse, BankAccountsSummary
from app.services import open_finance_service

router = APIRouter(prefix="/v1/bank-accounts", tags=["bank-accounts"])


@router.get("/", response_model=list[BankAccountResponse])
async def list_bank_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await open_finance_service.list_bank_accounts(db, current_user)


@router.get("/summary", response_model=BankAccountsSummary)
async def bank_accounts_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await open_finance_service.bank_accounts_summary(db, current_user)
