import datetime as dt
import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bank_account import BankAccount
from app.models.investment import Investment
from app.models.user import User
from app.schemas.investment import InvestmentCreate, InvestmentsSummary, InvestmentUpdate


def _with_income_percentage(investment: Investment) -> Investment:
    if investment.invested_amount and investment.invested_amount > 0:
        investment.income_percentage = (
            (investment.current_value - investment.invested_amount) / investment.invested_amount * 100
        )
    else:
        investment.income_percentage = Decimal(0)
    return investment


async def list_investments(db: AsyncSession, user: User) -> list[Investment]:
    result = await db.scalars(
        select(Investment).where(Investment.user_id == user.id).order_by(Investment.name)
    )
    return list(result.all())


async def create_investment(db: AsyncSession, user: User, data: InvestmentCreate) -> Investment:
    investment = Investment(user_id=user.id, last_updated=dt.datetime.now(dt.timezone.utc), **data.model_dump())
    _with_income_percentage(investment)
    db.add(investment)
    await db.commit()
    await db.refresh(investment)
    return investment


async def get_owned_investment(db: AsyncSession, user: User, investment_id: uuid.UUID) -> Investment:
    investment = await db.get(Investment, investment_id)
    if investment is None or investment.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ativo não encontrado")
    return investment


async def update_investment(
    db: AsyncSession, user: User, investment_id: uuid.UUID, data: InvestmentUpdate
) -> Investment:
    investment = await get_owned_investment(db, user, investment_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(investment, field, value)
    investment.last_updated = dt.datetime.now(dt.timezone.utc)
    _with_income_percentage(investment)
    await db.commit()
    await db.refresh(investment)
    return investment


async def delete_investment(db: AsyncSession, user: User, investment_id: uuid.UUID) -> None:
    investment = await get_owned_investment(db, user, investment_id)
    await db.delete(investment)
    await db.commit()


async def get_investments_summary(db: AsyncSession, user: User) -> InvestmentsSummary:
    investments = await list_investments(db, user)

    of_accounts = await db.scalars(
        select(BankAccount).where(
            BankAccount.user_id == user.id, BankAccount.is_active.is_(True), BankAccount.type == "INVESTMENT"
        )
    )
    of_accounts_list = list(of_accounts)

    total_current = sum((i.current_value for i in investments), Decimal(0)) + sum(
        (a.balance for a in of_accounts_list), Decimal(0)
    )
    total_invested = sum((i.invested_amount for i in investments), Decimal(0))
    total_income = sum((i.income for i in investments), Decimal(0))

    by_type: dict[str, Decimal] = {}
    for investment in investments:
        by_type[investment.type] = by_type.get(investment.type, Decimal(0)) + investment.current_value
    if of_accounts_list:
        by_type["open_finance"] = sum((a.balance for a in of_accounts_list), Decimal(0))

    income_percentage = float(total_income / total_invested * 100) if total_invested > 0 else 0.0

    return InvestmentsSummary(
        total_patrimony=total_current,
        total_income=total_income,
        income_percentage=round(income_percentage, 2),
        asset_count=len(investments) + len(of_accounts_list),
        by_type=by_type,
    )
