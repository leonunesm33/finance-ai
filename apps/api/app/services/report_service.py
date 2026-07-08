import calendar
import datetime as dt
import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import redis_client
from app.models.category import Category
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.report import (
    CategoryHistoryPoint,
    CategoryReport,
    MonthlyReport,
    YearlyReport,
    YearlyReportMonth,
)
from app.services.dashboard_service import build_expenses_by_category, daily_spending, sum_by_type


def _month_range(year: int, month: int) -> tuple[dt.date, dt.date]:
    start = dt.date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    end = min(dt.date(year, month, last_day), dt.date.today())
    return start, max(start, end)


async def get_monthly_report(db: AsyncSession, user: User, year: int, month: int) -> MonthlyReport:
    start, end = _month_range(year, month)

    total_income = await sum_by_type(db, user.id, start, end, "income")
    total_expenses = await sum_by_type(db, user.id, start, end, "expense")
    expenses_by_category = await build_expenses_by_category(db, user.id, start, end, total_expenses)
    daily = await daily_spending(db, user.id, start, end)

    return MonthlyReport(
        year=year,
        month=month,
        total_income=total_income,
        total_expenses=total_expenses,
        net_balance=total_income - total_expenses,
        expenses_by_category=expenses_by_category,
        daily_spending=[d.model_dump() for d in daily],
    )


async def get_yearly_report(db: AsyncSession, user: User, year: int) -> YearlyReport:
    rows = await db.execute(
        select(extract("month", Transaction.date), Transaction.type, func.sum(Transaction.amount))
        .where(
            Transaction.user_id == user.id,
            Transaction.type.in_(["income", "expense"]),
            extract("year", Transaction.date) == year,
        )
        .group_by(extract("month", Transaction.date), Transaction.type)
    )

    by_month: dict[int, dict[str, Decimal]] = {}
    for month, tx_type, amount in rows:
        by_month.setdefault(int(month), {"income": Decimal(0), "expense": Decimal(0)})[tx_type] = Decimal(amount)

    months = [
        YearlyReportMonth(
            month=m,
            income=by_month.get(m, {}).get("income", Decimal(0)),
            expenses=by_month.get(m, {}).get("expense", Decimal(0)),
        )
        for m in range(1, 13)
    ]

    total_income = sum((m.income for m in months), Decimal(0))
    total_expenses = sum((m.expenses for m in months), Decimal(0))

    start = dt.date(year, 1, 1)
    end = min(dt.date(year, 12, 31), dt.date.today())
    expenses_by_category = await build_expenses_by_category(db, user.id, start, end, total_expenses)

    return YearlyReport(
        year=year,
        total_income=total_income,
        total_expenses=total_expenses,
        months=months,
        expenses_by_category=expenses_by_category,
    )


async def get_category_report(
    db: AsyncSession, user: User, category_id: uuid.UUID, months_back: int = 12
) -> CategoryReport:
    category = await db.get(Category, category_id)
    if category is None or (category.user_id is not None and category.user_id != user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoria não encontrada")

    today = dt.date.today()
    history: list[CategoryHistoryPoint] = []

    for i in range(months_back - 1, -1, -1):
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1
        start, end = _month_range(year, month)

        amount = await db.scalar(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user.id,
                Transaction.category_id == category_id,
                Transaction.type == "expense",
                Transaction.date >= start,
                Transaction.date <= end,
            )
        )
        history.append(CategoryHistoryPoint(period=f"{year:04d}-{month:02d}", amount=Decimal(amount)))

    return CategoryReport(category_id=category.id, category_name=category.name, history=history)


ANALYSIS_JOB_TTL_SECONDS = 3600


async def register_analysis_job(job_id: str, user_id: uuid.UUID) -> None:
    await redis_client.setex(f"analysis_job:{job_id}", ANALYSIS_JOB_TTL_SECONDS, str(user_id))


async def is_analysis_job_owner(job_id: str, user_id: uuid.UUID) -> bool:
    owner = await redis_client.get(f"analysis_job:{job_id}")
    return owner == str(user_id)
