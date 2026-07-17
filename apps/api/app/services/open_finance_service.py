import logging
import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.pluggy import PluggyError, pluggy_client
from app.models.bank_account import BankAccount
from app.models.bank_connection import BankConnection
from app.models.user import User
from app.schemas.open_finance import BankAccountsSummary

logger = logging.getLogger(__name__)


async def create_connect_token() -> str:
    try:
        data = await pluggy_client.create_connect_token()
    except PluggyError:
        logger.exception("Falha ao gerar connect token no Pluggy")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível gerar o connect token. Tente novamente mais tarde.",
        )
    return data["accessToken"]


async def register_connection(db: AsyncSession, user: User, item_id: str) -> BankConnection:
    existing = await db.scalar(select(BankConnection).where(BankConnection.pluggy_item_id == item_id))
    if existing is not None:
        if existing.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Item já vinculado a outra conta"
            )
        return existing

    try:
        item = await pluggy_client.get_item(item_id)
    except PluggyError:
        logger.exception("Falha ao consultar item %s no Pluggy", item_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível validar o item no Pluggy. Tente novamente mais tarde.",
        )

    connector = item.get("connector", {})
    connection = BankConnection(
        user_id=user.id,
        pluggy_item_id=item_id,
        institution_id=connector.get("id", 0),
        institution_name=connector.get("name", "Desconhecido"),
        institution_logo_url=connector.get("imageUrl"),
        status=item.get("status", "UPDATING"),
    )
    db.add(connection)
    await db.commit()
    await db.refresh(connection)
    return connection


async def get_connection_by_item_id(db: AsyncSession, item_id: str) -> BankConnection | None:
    return await db.scalar(select(BankConnection).where(BankConnection.pluggy_item_id == item_id))


async def list_connections(db: AsyncSession, user: User) -> list[BankConnection]:
    result = await db.scalars(
        select(BankConnection)
        .where(BankConnection.user_id == user.id, BankConnection.is_active.is_(True))
        .order_by(BankConnection.created_at.desc())
    )
    return list(result.all())


async def get_owned_connection(db: AsyncSession, user: User, connection_id: uuid.UUID) -> BankConnection:
    connection = await db.get(BankConnection, connection_id)
    if connection is None or connection.user_id != user.id or not connection.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conexão não encontrada")
    return connection


async def delete_connection(db: AsyncSession, user: User, connection_id: uuid.UUID) -> None:
    connection = await get_owned_connection(db, user, connection_id)

    try:
        await pluggy_client.delete_item(connection.pluggy_item_id)
    except PluggyError:
        pass  # best-effort: prossegue com o soft-delete local mesmo se o Pluggy falhar

    connection.is_active = False
    await db.commit()


async def list_bank_accounts(db: AsyncSession, user: User) -> list[BankAccount]:
    result = await db.scalars(
        select(BankAccount)
        .where(BankAccount.user_id == user.id, BankAccount.is_active.is_(True))
        .order_by(BankAccount.name)
    )
    return list(result.all())


async def bank_accounts_summary(db: AsyncSession, user: User) -> BankAccountsSummary:
    accounts = await list_bank_accounts(db, user)

    total_balance = sum((a.balance for a in accounts if a.type != "CREDIT"), Decimal("0"))
    total_credit_limit = sum((a.credit_limit or Decimal("0") for a in accounts if a.type == "CREDIT"), Decimal("0"))
    total_credit_available = sum(
        (a.available_credit or Decimal("0") for a in accounts if a.type == "CREDIT"), Decimal("0")
    )

    return BankAccountsSummary(
        total_balance=total_balance,
        total_credit_limit=total_credit_limit,
        total_credit_available=total_credit_available,
    )
