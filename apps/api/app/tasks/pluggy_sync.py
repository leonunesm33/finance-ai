import asyncio
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.core.celery_app import celery_app
from app.core.database import task_session
from app.integrations.pluggy import PluggyError, pluggy_client
from app.models.bank_account import BankAccount
from app.models.bank_connection import BankConnection
from app.models.transaction import Transaction
from app.services.reconciliation_service import reconcile_transaction

TRANSACTION_SYNC_DAYS = 90


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value[:10])


async def _sync_account_transactions(db, user_id, account: BankAccount) -> None:
    try:
        raw_transactions = await pluggy_client.get_transactions(
            account.pluggy_account_id, date.today() - timedelta(days=TRANSACTION_SYNC_DAYS)
        )
    except PluggyError:
        return

    for raw_tx in raw_transactions:
        existing_tx = await db.scalar(
            select(Transaction).where(Transaction.pluggy_transaction_id == raw_tx["id"])
        )
        if existing_tx is not None:
            continue

        raw_amount = raw_tx.get("amount", 0)
        tx_amount = Decimal(str(abs(raw_amount)))
        tx_type = "income" if raw_amount > 0 else "expense"
        tx_date = _parse_date(raw_tx.get("date")) or date.today()
        description = raw_tx.get("description", "")

        match = await reconcile_transaction(db, user_id, description, tx_amount, tx_date)
        if match is not None:
            continue

        db.add(
            Transaction(
                user_id=user_id,
                account_id=account.id,
                description=description,
                amount=tx_amount,
                type=tx_type,
                date=tx_date,
                origin="open_finance",
                pluggy_transaction_id=raw_tx["id"],
            )
        )


async def _sync_connection(connection_id: str) -> None:
    async with task_session() as db:
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
        account_objects: list[BankAccount] = []

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
                account_objects.append(existing)
            else:
                account = BankAccount(**values)
                db.add(account)
                account_objects.append(account)

        connection.last_sync_at = now
        await db.flush()  # garante account.id disponível antes de criar transações

        for account in account_objects:
            await _sync_account_transactions(db, connection.user_id, account)

        await db.commit()


@celery_app.task(name="pluggy.sync_connection")
def sync_connection(connection_id: str) -> None:
    asyncio.run(_sync_connection(connection_id))


async def _sync_all_connections() -> list[str]:
    async with task_session() as db:
        result = await db.scalars(select(BankConnection.id).where(BankConnection.is_active.is_(True)))
        return [str(row) for row in result.all()]


@celery_app.task(name="pluggy.sync_all_connections")
def sync_all_connections() -> None:
    connection_ids = asyncio.run(_sync_all_connections())
    for connection_id in connection_ids:
        sync_connection.delay(connection_id)
