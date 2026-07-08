import csv
import io
import uuid
from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.claude import ClaudeParseError, parse_transaction_text
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import (
    CsvImportResult,
    TransactionCreate,
    TransactionParseResponse,
    TransactionUpdate,
)
from app.services.reconciliation_service import reconcile_transaction

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200


async def list_transactions(
    db: AsyncSession,
    user: User,
    *,
    type_: str | None = None,
    account_id: uuid.UUID | None = None,
    category_id: uuid.UUID | None = None,
    origin: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[list[Transaction], int]:
    page_size = min(page_size, MAX_PAGE_SIZE)

    query = select(Transaction).where(Transaction.user_id == user.id)
    if type_:
        query = query.where(Transaction.type == type_)
    if account_id:
        query = query.where(Transaction.account_id == account_id)
    if category_id:
        query = query.where(Transaction.category_id == category_id)
    if origin:
        query = query.where(Transaction.origin == origin)
    if date_from:
        query = query.where(Transaction.date >= date_from)
    if date_to:
        query = query.where(Transaction.date <= date_to)
    if search:
        query = query.where(Transaction.description.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.scalar(count_query)) or 0

    query = query.order_by(Transaction.date.desc(), Transaction.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.scalars(query)
    return list(result.all()), total


async def get_owned_transaction(db: AsyncSession, user: User, transaction_id: uuid.UUID) -> Transaction:
    transaction = await db.get(Transaction, transaction_id)
    if transaction is None or transaction.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transação não encontrada")
    return transaction


async def create_transaction(db: AsyncSession, user: User, data: TransactionCreate) -> Transaction:
    transaction = Transaction(user_id=user.id, origin="manual", **data.model_dump())
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return transaction


async def update_transaction(
    db: AsyncSession, user: User, transaction_id: uuid.UUID, data: TransactionUpdate
) -> Transaction:
    transaction = await get_owned_transaction(db, user, transaction_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(transaction, field, value)
    await db.commit()
    await db.refresh(transaction)
    return transaction


async def delete_transaction(db: AsyncSession, user: User, transaction_id: uuid.UUID) -> None:
    transaction = await get_owned_transaction(db, user, transaction_id)
    await db.delete(transaction)
    await db.commit()


async def parse_transaction(db: AsyncSession, user: User, text: str) -> TransactionParseResponse:
    categories = await db.scalars(
        select(Category).where(
            Category.is_active.is_(True), or_(Category.user_id.is_(None), Category.user_id == user.id)
        )
    )
    category_list = list(categories)
    category_names = [c.name for c in category_list]

    try:
        raw = await parse_transaction_text(text, category_names, user.ai_personality)
    except ClaudeParseError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Não foi possível interpretar o texto: {error}"
        )

    category_by_name = {c.name.lower(): c for c in category_list}
    matched = category_by_name.get((raw.get("category_name") or "").lower())

    return TransactionParseResponse(
        description=raw["description"],
        amount=Decimal(str(raw["amount"])),
        type=raw["type"],
        category_id=matched.id if matched else None,
        category_name=matched.name if matched else raw.get("category_name"),
        date=raw["date"],
        confidence=raw.get("confidence", 0.5),
        alternatives=raw.get("alternatives", []),
    )


async def import_csv(
    db: AsyncSession,
    user: User,
    file_content: str,
    date_column: str,
    description_column: str,
    amount_column: str,
    type_column: str | None,
) -> CsvImportResult:
    reader = csv.DictReader(io.StringIO(file_content))
    created = reconciled = skipped = 0

    for row in reader:
        try:
            tx_date = date.fromisoformat(row[date_column].strip()[:10])
            description = row[description_column].strip()
            amount = abs(Decimal(row[amount_column].replace(",", ".").strip()))
            tx_type = row.get(type_column, "expense").strip().lower() if type_column else "expense"
            if tx_type not in ("expense", "income", "investment", "transfer"):
                tx_type = "expense"
        except (KeyError, ValueError, InvalidOperation):
            skipped += 1
            continue

        match = await reconcile_transaction(db, user.id, description, amount, tx_date)
        if match is not None:
            reconciled += 1
            continue

        db.add(
            Transaction(
                user_id=user.id,
                description=description,
                amount=amount,
                type=tx_type,
                date=tx_date,
                origin="csv_import",
            )
        )
        created += 1

    await db.commit()
    return CsvImportResult(created=created, reconciled=reconciled, skipped=skipped)


async def export_csv(db: AsyncSession, user: User, **filters) -> str:
    transactions, _ = await list_transactions(db, user, page=1, page_size=MAX_PAGE_SIZE, **filters)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["data", "descricao", "valor", "tipo", "origem", "categoria_id"])
    for tx in transactions:
        writer.writerow([tx.date.isoformat(), tx.description, tx.amount, tx.type, tx.origin, tx.category_id or ""])

    return buffer.getvalue()
