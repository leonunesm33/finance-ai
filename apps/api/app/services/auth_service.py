import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import redis_client
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.user import UserCreate

BLACKLIST_KEY_PREFIX = "blacklist:refresh:"


async def register_user(db: AsyncSession, data: UserCreate) -> User:
    existing = await db.scalar(select(User).where(User.email == data.email))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já cadastrado")

    user = User(email=data.email, password_hash=hash_password(data.password), name=data.name)
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já cadastrado")
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    user = await db.scalar(select(User).where(User.email == email))
    if user is None or not user.is_active or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou senha inválidos")
    return user


def issue_tokens(user: User) -> tuple[str, str]:
    access_token = create_access_token(str(user.id))
    refresh_token, _jti, _expire = create_refresh_token(str(user.id))
    return access_token, refresh_token


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> tuple[str, str]:
    """Valida o refresh token e emite um novo par (access, refresh), com rotação.

    O refresh token antigo é colocado na blacklist (uso único): se vazar,
    não pode mais ser reutilizado após o próximo refresh legítimo.
    """
    invalid_token_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido"
    )

    try:
        payload = decode_token(refresh_token)
    except JWTError:
        raise invalid_token_exception

    if payload.get("type") != "refresh":
        raise invalid_token_exception

    jti = payload.get("jti")
    user_id = payload.get("sub")
    issued_at = payload.get("iat")
    if jti is None or user_id is None or issued_at is None:
        raise invalid_token_exception

    try:
        user_uuid = uuid.UUID(str(user_id))
        issued_at = int(issued_at)
    except (ValueError, TypeError):
        raise invalid_token_exception

    if await redis_client.exists(f"{BLACKLIST_KEY_PREFIX}{jti}"):
        raise invalid_token_exception

    user = await db.get(User, user_uuid)
    if user is None or not user.is_active:
        raise invalid_token_exception

    if user.password_changed_at is not None and issued_at < int(user.password_changed_at.timestamp()):
        raise invalid_token_exception

    # Rotação: invalida o token usado e emite um novo par.
    await revoke_refresh_token(refresh_token)
    new_access_token, new_refresh_token = issue_tokens(user)
    return new_access_token, new_refresh_token


async def revoke_refresh_token(refresh_token: str) -> None:
    try:
        payload = decode_token(refresh_token)
    except JWTError:
        return

    if payload.get("type") != "refresh":
        return

    jti = payload.get("jti")
    exp = payload.get("exp")
    if jti is None or exp is None:
        return

    ttl = int(exp - datetime.now(timezone.utc).timestamp())
    if ttl > 0:
        await redis_client.setex(f"{BLACKLIST_KEY_PREFIX}{jti}", ttl, "1")
