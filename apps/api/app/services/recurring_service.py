import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recurring_transaction import RecurringTransaction
from app.models.user import User
from app.schemas.recurring import RecurringCreate, RecurringUpdate
from app.services.ownership import validate_owned_category


async def list_recurring(db: AsyncSession, user: User) -> list[RecurringTransaction]:
    result = await db.scalars(
        select(RecurringTransaction)
        .where(RecurringTransaction.user_id == user.id, RecurringTransaction.is_active.is_(True))
        .order_by(RecurringTransaction.description)
    )
    return list(result.all())


async def create_recurring(db: AsyncSession, user: User, data: RecurringCreate) -> RecurringTransaction:
    await validate_owned_category(db, user, data.category_id)
    recurring = RecurringTransaction(user_id=user.id, **data.model_dump())
    db.add(recurring)
    await db.commit()
    await db.refresh(recurring)
    return recurring


async def get_owned_recurring(db: AsyncSession, user: User, recurring_id: uuid.UUID) -> RecurringTransaction:
    recurring = await db.get(RecurringTransaction, recurring_id)
    if recurring is None or recurring.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recorrência não encontrada")
    return recurring


async def update_recurring(
    db: AsyncSession, user: User, recurring_id: uuid.UUID, data: RecurringUpdate
) -> RecurringTransaction:
    recurring = await get_owned_recurring(db, user, recurring_id)
    changes = data.model_dump(exclude_unset=True)
    if "category_id" in changes:
        await validate_owned_category(db, user, changes["category_id"])
    for field, value in changes.items():
        setattr(recurring, field, value)
    await db.commit()
    await db.refresh(recurring)
    return recurring


async def delete_recurring(db: AsyncSession, user: User, recurring_id: uuid.UUID) -> None:
    recurring = await get_owned_recurring(db, user, recurring_id)
    recurring.is_active = False
    await db.commit()
