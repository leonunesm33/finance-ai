"""Gestão de usuários pelo administrador: criação, remoção e bloqueio.

Regras de segurança (fail-safe): um admin nunca pode alterar/remover a
própria conta por aqui (evita bloqueio acidental — use as Configurações
normais para isso), e o sistema nunca fica sem nenhum administrador ativo.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import AdminUserCreate, AdminUserUpdate
from app.services.account_wipe_service import delete_user_completely


async def list_users(db: AsyncSession) -> list[User]:
    result = await db.scalars(select(User).order_by(User.created_at.desc()))
    return list(result.all())


async def create_user(db: AsyncSession, data: AdminUserCreate) -> User:
    existing = await db.scalar(select(User).where(User.email == data.email))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já cadastrado")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
        role=data.role,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já cadastrado")
    await db.refresh(user)
    return user


async def get_managed_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    return user


async def _remaining_active_admins(db: AsyncSession, excluding: uuid.UUID) -> int:
    query = (
        select(func.count())
        .select_from(User)
        .where(User.role == "admin", User.is_active.is_(True), User.id != excluding)
    )
    return await db.scalar(query) or 0


async def _ensure_not_last_admin(db: AsyncSession, target: User) -> None:
    if target.role != "admin":
        return
    if await _remaining_active_admins(db, excluding=target.id) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível remover o último administrador",
        )


async def update_user(
    db: AsyncSession, admin: User, target_id: uuid.UUID, data: AdminUserUpdate
) -> User:
    if target_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use as Configurações para gerenciar a própria conta",
        )

    target = await get_managed_user(db, target_id)
    changes = data.model_dump(exclude_unset=True)

    would_demote = changes.get("role") == "user" and target.role == "admin"
    would_deactivate = changes.get("is_active") is False and target.is_active
    if would_demote or would_deactivate:
        await _ensure_not_last_admin(db, target)

    for field, value in changes.items():
        setattr(target, field, value)
    await db.commit()
    await db.refresh(target)
    return target


async def remove_user(db: AsyncSession, admin: User, target_id: uuid.UUID) -> None:
    if target_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode remover a própria conta",
        )

    target = await get_managed_user(db, target_id)
    await _ensure_not_last_admin(db, target)
    await delete_user_completely(db, target.id)
