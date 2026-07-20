import uuid
from datetime import date, timedelta
from decimal import Decimal

from rapidfuzz import fuzz
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction

MATCH_WINDOW_DAYS = 3
FUZZY_MATCH_THRESHOLD = 85.0


async def _find_matching_transaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    description: str,
    amount: Decimal,
    tx_date: date,
    *,
    only_unreconciled: bool,
) -> Transaction | None:
    """Busca pura (sem efeito colateral): mesmo valor, data +/-3 dias, descrição
    similar >85% — usada tanto pela reconciliação de Open Finance quanto pela
    deduplicação de importações."""
    query = select(Transaction).where(
        Transaction.user_id == user_id,
        Transaction.origin != "open_finance",
        Transaction.amount == amount,
        Transaction.date >= tx_date - timedelta(days=MATCH_WINDOW_DAYS),
        Transaction.date <= tx_date + timedelta(days=MATCH_WINDOW_DAYS),
    )
    if only_unreconciled:
        query = query.where(Transaction.is_reconciled.is_(False))

    candidates = await db.scalars(query)

    best_match: Transaction | None = None
    best_score = 0.0

    for candidate in candidates:
        score = fuzz.token_sort_ratio(description.lower(), candidate.description.lower())
        if score > best_score:
            best_score = score
            best_match = candidate

    if best_match is not None and best_score >= FUZZY_MATCH_THRESHOLD:
        return best_match
    return None


async def reconcile_transaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    description: str,
    amount: Decimal,
    tx_date: date,
) -> Transaction | None:
    """Usado pela sincronização do Open Finance: procura uma transação
    manual/CSV AINDA não confirmada e marca como reconciliada (uso único —
    uma vez marcada, não volta a ser candidata). Retorna a transação
    existente, ou None se não achou par.
    """
    match = await _find_matching_transaction(
        db, user_id, description, amount, tx_date, only_unreconciled=True
    )
    if match is not None:
        match.is_reconciled = True
    return match


async def find_duplicate_for_import(
    db: AsyncSession,
    user_id: uuid.UUID,
    description: str,
    amount: Decimal,
    tx_date: date,
) -> Transaction | None:
    """Usado pela importação de arquivos (CSV/XLS/XLSX/PDF): idempotente —
    não muda estado algum, pode ser chamado quantas vezes for preciso sem
    'consumir' o match (ao contrário de reconcile_transaction). Sem isso, ao
    reimportar o mesmo extrato uma 3ª vez, os pares já marcados reconciliados
    na 2ª rodada deixariam de ser candidatos e a importação criaria
    duplicatas.
    """
    return await _find_matching_transaction(
        db, user_id, description, amount, tx_date, only_unreconciled=False
    )
