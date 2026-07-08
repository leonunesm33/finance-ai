import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.recurring import RecurringCreate, RecurringResponse, RecurringUpdate
from app.services import recurring_service

router = APIRouter(prefix="/v1/recurring", tags=["recurring"])


@router.get("/", response_model=list[RecurringResponse])
async def list_recurring(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await recurring_service.list_recurring(db, current_user)


@router.post("/", response_model=RecurringResponse, status_code=status.HTTP_201_CREATED)
async def create_recurring(
    data: RecurringCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await recurring_service.create_recurring(db, current_user, data)


@router.put("/{recurring_id}", response_model=RecurringResponse)
async def update_recurring(
    recurring_id: uuid.UUID,
    data: RecurringUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await recurring_service.update_recurring(db, current_user, recurring_id, data)


@router.delete("/{recurring_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring(
    recurring_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await recurring_service.delete_recurring(db, current_user, recurring_id)
