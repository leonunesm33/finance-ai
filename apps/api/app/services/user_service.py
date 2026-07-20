from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserPasswordUpdate, UserUpdate, UserWipeRequest, UserWipeResult
from app.services import account_wipe_service


async def update_profile(db: AsyncSession, user: User, data: UserUpdate) -> User:
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user


async def update_password(db: AsyncSession, user: User, data: UserPasswordUpdate) -> None:
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Senha atual incorreta")

    user.password_hash = hash_password(data.new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    await db.commit()


async def wipe_financial_data(db: AsyncSession, user: User, data: UserWipeRequest) -> UserWipeResult:
    """Apaga transações/metas/investimentos/contas do próprio usuário.
    Exige a senha atual — ação destrutiva e irreversível."""
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Senha atual incorreta")

    return await account_wipe_service.wipe_financial_data(db, user.id)
