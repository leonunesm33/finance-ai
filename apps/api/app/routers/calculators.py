from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.calculator import CalculatorPrefillData
from app.services import calculator_service

router = APIRouter(prefix="/v1/calculators", tags=["calculators"])


@router.get("/prefill", response_model=CalculatorPrefillData)
async def get_prefill_data(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await calculator_service.get_prefill_data(db, current_user)
