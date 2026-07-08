import datetime as dt
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bank_account import BankAccount
from app.models.bank_connection import BankConnection
from app.models.category import Category
from app.models.goal import Goal
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.dashboard import (
    DailySpending,
    DashboardAlert,
    DashboardSummaryResponse,
    ExpenseByCategory,
    OpenFinanceAccountSummary,
    PeriodRange,
)

ANOMALY_MULTIPLIER = 3
INVOICE_DUE_SOON_DAYS = 3


def resolve_period(
    period: str, date_from: dt.date | None, date_to: dt.date | None
) -> tuple[dt.date, dt.date]:
    today = dt.date.today()

    if period == "last_7_days":
        return today - dt.timedelta(days=6), today
    if period == "current_month":
        return today.replace(day=1), today
    if period == "previous_month":
        last_of_prev = today.replace(day=1) - dt.timedelta(days=1)
        return last_of_prev.replace(day=1), last_of_prev
    if period == "this_year":
        return today.replace(month=1, day=1), today
    if period == "custom":
        if date_from is None or date_to is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="date_from e date_to são obrigatórios para período personalizado",
            )
        return date_from, date_to

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Período inválido")


def _previous_period(start: dt.date, end: dt.date) -> tuple[dt.date, dt.date]:
    length_days = (end - start).days + 1
    prev_end = start - dt.timedelta(days=1)
    prev_start = prev_end - dt.timedelta(days=length_days - 1)
    return prev_start, prev_end


async def _sum_by_type(
    db: AsyncSession, user_id, start: dt.date, end: dt.date, tx_type: str
) -> Decimal:
    total = await db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user_id,
            Transaction.type == tx_type,
            Transaction.date >= start,
            Transaction.date <= end,
        )
    )
    return Decimal(total)


async def _expenses_by_category(
    db: AsyncSession, user_id, start: dt.date, end: dt.date
) -> dict[str | None, Decimal]:
    rows = await db.execute(
        select(Transaction.category_id, func.sum(Transaction.amount))
        .where(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.date >= start,
            Transaction.date <= end,
        )
        .group_by(Transaction.category_id)
    )
    return {category_id: Decimal(amount) for category_id, amount in rows}


async def _build_expenses_by_category(
    db: AsyncSession, user_id, start: dt.date, end: dt.date, total_expenses: Decimal
) -> list[ExpenseByCategory]:
    current = await _expenses_by_category(db, user_id, start, end)
    prev_start, prev_end = _previous_period(start, end)
    previous = await _expenses_by_category(db, user_id, prev_start, prev_end)

    category_ids = [cid for cid in current if cid is not None]
    categories = {}
    if category_ids:
        result = await db.scalars(select(Category).where(Category.id.in_(category_ids)))
        categories = {c.id: c for c in result}

    items = []
    for category_id, amount in sorted(current.items(), key=lambda kv: kv[1], reverse=True):
        name = categories[category_id].name if category_id in categories else "Sem categoria"
        percentage = float(amount / total_expenses * 100) if total_expenses > 0 else 0.0

        vs_previous = None
        prev_amount = previous.get(category_id)
        if prev_amount is not None and prev_amount > 0:
            vs_previous = float((amount - prev_amount) / prev_amount * 100)

        items.append(
            ExpenseByCategory(
                category_id=category_id,
                category=name,
                amount=amount,
                percentage=round(percentage, 1),
                vs_previous=round(vs_previous, 1) if vs_previous is not None else None,
            )
        )

    return items


async def _daily_spending(db: AsyncSession, user_id, start: dt.date, end: dt.date) -> list[DailySpending]:
    rows = await db.execute(
        select(Transaction.date, Transaction.type, func.sum(Transaction.amount))
        .where(
            Transaction.user_id == user_id,
            Transaction.type.in_(["expense", "income"]),
            Transaction.date >= start,
            Transaction.date <= end,
        )
        .group_by(Transaction.date, Transaction.type)
    )
    by_day: dict[dt.date, dict[str, Decimal]] = {}
    for tx_date, tx_type, amount in rows:
        by_day.setdefault(tx_date, {"expense": Decimal(0), "income": Decimal(0)})[tx_type] = Decimal(amount)

    days = []
    current = start
    while current <= end:
        totals = by_day.get(current, {"expense": Decimal(0), "income": Decimal(0)})
        days.append(DailySpending(date=current, expenses=totals["expense"], income=totals["income"]))
        current += dt.timedelta(days=1)

    return days


async def _open_finance_accounts(db: AsyncSession, user_id) -> list[OpenFinanceAccountSummary]:
    result = await db.execute(
        select(BankConnection, func.coalesce(func.sum(BankAccount.balance), 0))
        .join(BankAccount, BankAccount.connection_id == BankConnection.id, isouter=True)
        .where(BankConnection.user_id == user_id, BankConnection.is_active.is_(True))
        .group_by(BankConnection.id)
    )

    return [
        OpenFinanceAccountSummary(
            connection_id=connection.id,
            institution_name=connection.institution_name,
            institution_logo_url=connection.institution_logo_url,
            status=connection.status,
            last_sync_at=connection.last_sync_at,
            balance=Decimal(balance),
        )
        for connection, balance in result
    ]


async def build_alerts(db: AsyncSession, user_id) -> list[DashboardAlert]:
    alerts: list[DashboardAlert] = []

    error_connections = await db.scalars(
        select(BankConnection).where(
            BankConnection.user_id == user_id,
            BankConnection.is_active.is_(True),
            BankConnection.status == "LOGIN_ERROR",
        )
    )
    for connection in error_connections:
        alerts.append(
            DashboardAlert(
                type="connection_error",
                message=f"Conexão com {connection.institution_name} está com erro de login",
            )
        )

    accounts = await db.scalars(
        select(BankAccount).where(BankAccount.user_id == user_id, BankAccount.is_active.is_(True))
    )
    today = dt.date.today()
    for account in accounts:
        if account.type != "CREDIT" and account.balance < 0:
            alerts.append(DashboardAlert(type="negative_balance", message=f"Conta {account.name} está negativa"))
        if account.due_date and 0 <= (account.due_date - today).days <= INVOICE_DUE_SOON_DAYS:
            alerts.append(
                DashboardAlert(
                    type="invoice_due", message=f"Fatura de {account.name} vence em {account.due_date.isoformat()}"
                )
            )

    alerts.extend(await _budget_alerts(db, user_id))
    alerts.extend(await _anomaly_alerts(db, user_id))

    return alerts


async def _budget_alerts(db: AsyncSession, user_id) -> list[DashboardAlert]:
    from app.services.goal_service import calculate_current_amount  # evita import circular no nível de módulo

    alerts: list[DashboardAlert] = []
    goals = await db.scalars(
        select(Goal).where(Goal.user_id == user_id, Goal.is_active.is_(True), Goal.type == "expense_limit")
    )
    for goal in goals:
        if goal.target_amount <= 0:
            continue
        current = await calculate_current_amount(db, goal)
        ratio = current / goal.target_amount
        if ratio >= Decimal("0.8"):
            alerts.append(
                DashboardAlert(
                    type="budget_warning", message=f"{goal.name} atingiu {round(float(ratio * 100))}% do orçamento"
                )
            )
    return alerts


async def _anomaly_alerts(db: AsyncSession, user_id) -> list[DashboardAlert]:
    today = dt.date.today()
    recent_start = today - dt.timedelta(days=7)

    avg_rows = await db.execute(
        select(Transaction.category_id, func.avg(Transaction.amount), func.count(Transaction.id))
        .where(Transaction.user_id == user_id, Transaction.type == "expense")
        .group_by(Transaction.category_id)
    )
    avg_by_category = {category_id: Decimal(avg) for category_id, avg, count in avg_rows if count >= 3}

    alerts: list[DashboardAlert] = []
    recent_transactions = await db.scalars(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.type == "expense",
            Transaction.date >= recent_start,
        )
    )
    for tx in recent_transactions:
        avg = avg_by_category.get(tx.category_id)
        if avg and avg > 0 and tx.amount >= avg * ANOMALY_MULTIPLIER:
            alerts.append(
                DashboardAlert(
                    type="anomaly",
                    message=f"'{tx.description}' ({tx.amount}) está {ANOMALY_MULTIPLIER}x acima da média da categoria",
                )
            )
    return alerts


async def build_dashboard_summary(
    db: AsyncSession, user: User, period: str, date_from: dt.date | None, date_to: dt.date | None
) -> DashboardSummaryResponse:
    start, end = resolve_period(period, date_from, date_to)

    total_income = await _sum_by_type(db, user.id, start, end, "income")
    total_expenses = await _sum_by_type(db, user.id, start, end, "expense")
    net_balance = total_income - total_expenses
    savings_rate = float(net_balance / total_income) if total_income > 0 else 0.0

    accounts = await db.scalars(
        select(BankAccount).where(BankAccount.user_id == user.id, BankAccount.is_active.is_(True))
    )
    total_bank_balance = Decimal(0)
    total_credit_limit = Decimal(0)
    total_credit_available = Decimal(0)
    for account in accounts:
        if account.type == "CREDIT":
            total_credit_limit += account.credit_limit or Decimal(0)
            total_credit_available += account.available_credit or Decimal(0)
        else:
            total_bank_balance += account.balance

    expenses_by_category = await _build_expenses_by_category(db, user.id, start, end, total_expenses)
    daily_spending = await _daily_spending(db, user.id, start, end)

    recent_result = await db.scalars(
        select(Transaction)
        .where(Transaction.user_id == user.id, Transaction.date >= start, Transaction.date <= end)
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
        .limit(10)
    )
    recent_transactions = list(recent_result.all())

    open_finance_accounts = await _open_finance_accounts(db, user.id)
    alerts = await build_alerts(db, user.id)

    return DashboardSummaryResponse(
        period=PeriodRange(start=start, end=end),
        total_income=total_income,
        total_expenses=total_expenses,
        savings_rate=round(savings_rate, 4),
        net_balance=net_balance,
        total_bank_balance=total_bank_balance,
        total_credit_limit=total_credit_limit,
        total_credit_available=total_credit_available,
        expenses_by_category=expenses_by_category,
        daily_spending=daily_spending,
        recent_transactions=recent_transactions,
        open_finance_accounts=open_finance_accounts,
        alerts=alerts,
    )
