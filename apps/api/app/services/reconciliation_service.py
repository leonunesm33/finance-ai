import uuid
from datetime import date, timedelta
from decimal import Decimal

from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction

MATCH_WINDOW_DAYS = 3
FUZZY_MATCH_THRESHOLD = 85.0


async def reconcile_transaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    description: str,
    amount: Decimal,
    tx_date: date,
) -> Transaction | None:
    """Procura uma transação manual/CSV existente que corresponda a uma transação
    vinda do Open Finance (mesmo valor, data +/-3 dias, descrição similar >85%).
    Retorna a transação existente marcada como reconciliada, ou None se não achou par.
    """
    candidates = await db.scalars(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.origin != "open_finance",
            Transaction.is_reconciled.is_(False),
            Transaction.amount == amount,
            Transaction.date >= tx_date - timedelta(days=MATCH_WINDOW_DAYS),
            Transaction.date <= tx_date + timedelta(days=MATCH_WINDOW_DAYS),
        )
    )

    best_match: Transaction | None = None
    best_score = 0.0

    for candidate in candidates:
        score = fuzz.token_sort_ratio(description.lower(), candidate.description.lower())
        if score > best_score:
            best_score = score
            best_match = candidate

    if best_match is not None and best_score >= FUZZY_MATCH_THRESHOLD:
        best_match.is_reconciled = True
        return best_match

    return None
