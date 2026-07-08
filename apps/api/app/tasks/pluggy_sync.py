import asyncio
from datetime import date, datetime, timezone

from sqlalchemy import select

from app.core.celery_app import celery_app
from app.core.database import async_session_factory
from app.integrations.pluggy import PluggyError, pluggy_client
from app.models.bank_account import BankAccount
from app.models.bank_connection import BankConnection


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value[:10])


async def _sync_connection(connection_id: str) -> None:
    async with async_session_factory() as db:
        connection = await db.get(BankConnection, connection_id)
        if connection is None or not connection.is_active:
            return

        try:
            item = await pluggy_client.get_item(connection.pluggy_item_id)
            accounts = await pluggy_client.get_accounts(connection.pluggy_item_id)
        except PluggyError as error:
            connection.status = "LOGIN_ERROR"
            connection.error_message = str(error)
            await db.commit()
            return

        connection.status = item.get("status", connection.status)
        connection.error_message = item.get("executionStatus") if connection.status == "LOGIN_ERROR" else None

        now = datetime.now(timezone.utc)

        for raw_account in accounts:
            existing = await db.scalar(
                select(BankAccount).where(BankAccount.pluggy_account_id == raw_account["id"])
            )
            credit_data = raw_account.get("creditData") or {}
            number = raw_account.get("number") or ""
            values = {
                "user_id": connection.user_id,
                "connection_id": connection.id,
                "pluggy_account_id": raw_account["id"],
                "name": raw_account.get("name", ""),
                "type": raw_account.get("type", "BANK"),
                "subtype": raw_account.get("subtype"),
                "number": number[-4:] if number else None,
                "currency": raw_account.get("currencyCode", "BRL"),
                "balance": raw_account.get("balance", 0),
                "credit_limit": credit_data.get("creditLimit"),
                "available_credit": credit_data.get("availableCreditLimit"),
                "due_date": _parse_date(credit_data.get("balanceCloseDate")),
                "last_sync_at": now,
            }

            if existing is not None:
                for field, value in values.items():
                    setattr(existing, field, value)
            else:
                db.add(BankAccount(**values))

        connection.last_sync_at = now
        await db.commit()

        # Sincronização de transações e reconciliação chegam no Módulo 4,
        # junto com o modelo Transaction.


@celery_app.task(name="pluggy.sync_connection")
def sync_connection(connection_id: str) -> None:
    asyncio.run(_sync_connection(connection_id))


async def _sync_all_connections() -> list[str]:
    async with async_session_factory() as db:
        result = await db.scalars(select(BankConnection.id).where(BankConnection.is_active.is_(True)))
        return [str(row) for row in result.all()]


@celery_app.task(name="pluggy.sync_all_connections")
def sync_all_connections() -> None:
    connection_ids = asyncio.run(_sync_all_connections())
    for connection_id in connection_ids:
        sync_connection.delay(connection_id)
