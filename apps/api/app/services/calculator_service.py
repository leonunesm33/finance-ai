import datetime as dt
from decimal import ROUND_HALF_UP, Decimal

CENTS = Decimal("0.01")

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.calculator import CalculatorPrefillData


async def _sum(db: AsyncSession, user_id, tx_type: str, start: dt.date, end: dt.date) -> Decimal:
    total = await db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == tx_type,
            Transaction.date >= start,
            Transaction.date <= end,
        )
    )
    return Decimal(total)


async def get_prefill_data(db: AsyncSession, user: User) -> CalculatorPrefillData:
    today = dt.date.today()
    start_3m = today - dt.timedelta(days=90)
    start_6m = today - dt.timedelta(days=180)

    expenses_3m = await _sum(db, user.id, "expense", start_3m, today)
    income_6m = await _sum(db, user.id, "income", start_6m, today)
    expenses_6m = await _sum(db, user.id, "expense", start_6m, today)

    avg_monthly_savings = max((income_6m - expenses_6m) / 6, Decimal(0))
    avg_fixed_expenses_3m = expenses_3m / 3
    avg_monthly_expenses = expenses_6m / 6

    return CalculatorPrefillData(
        avg_monthly_savings=avg_monthly_savings.quantize(CENTS, rounding=ROUND_HALF_UP),
        avg_fixed_expenses_3m=avg_fixed_expenses_3m.quantize(CENTS, rounding=ROUND_HALF_UP),
        avg_monthly_expenses=avg_monthly_expenses.quantize(CENTS, rounding=ROUND_HALF_UP),
    )
