import datetime as dt
import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalProgress, GoalUpdate


def _goal_period_range(goal: Goal) -> tuple[dt.date, dt.date]:
    today = dt.date.today()

    if goal.period == "yearly":
        return today.replace(month=1, day=1), today
    if goal.period == "one_time":
        start = goal.created_at.date()
        end = goal.deadline or today
        return start, min(end, today)

    return today.replace(day=1), today


async def calculate_current_amount(db: AsyncSession, goal: Goal) -> Decimal:
    start, end = _goal_period_range(goal)

    if goal.type == "expense_limit":
        tx_type = "expense"
    elif goal.type == "income_target":
        tx_type = "income"
    elif goal.type == "investment":
        tx_type = "investment"
    else:  # savings: economia líquida (receitas - despesas) do período
        income = await db.scalar(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == goal.user_id,
                Transaction.type == "income",
                Transaction.date >= start,
                Transaction.date <= end,
            )
        )
        expense = await db.scalar(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == goal.user_id,
                Transaction.type == "expense",
                Transaction.date >= start,
                Transaction.date <= end,
            )
        )
        return Decimal(income) - Decimal(expense)

    query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.user_id == goal.user_id,
        Transaction.type == tx_type,
        Transaction.date >= start,
        Transaction.date <= end,
    )
    if goal.category_id is not None:
        query = query.where(Transaction.category_id == goal.category_id)

    return Decimal(await db.scalar(query))


async def _refresh_current_amount(db: AsyncSession, goal: Goal) -> Goal:
    goal.current_amount = await calculate_current_amount(db, goal)
    return goal


async def list_goals(db: AsyncSession, user: User) -> list[Goal]:
    result = await db.scalars(
        select(Goal).where(Goal.user_id == user.id, Goal.is_active.is_(True)).order_by(Goal.name)
    )
    goals = list(result.all())
    for goal in goals:
        await _refresh_current_amount(db, goal)
    await db.commit()
    return goals


async def get_goals_progress(db: AsyncSession, user: User) -> list[GoalProgress]:
    goals = await list_goals(db, user)
    progress = []
    for goal in goals:
        percentage = float(goal.current_amount / goal.target_amount * 100) if goal.target_amount > 0 else 0.0
        progress.append(
            GoalProgress(
                id=goal.id,
                name=goal.name,
                type=goal.type,
                target_amount=goal.target_amount,
                current_amount=goal.current_amount,
                percentage=round(percentage, 1),
            )
        )
    return progress


async def create_goal(db: AsyncSession, user: User, data: GoalCreate) -> Goal:
    goal = Goal(user_id=user.id, **data.model_dump())
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    await _refresh_current_amount(db, goal)
    await db.commit()
    return goal


async def get_owned_goal(db: AsyncSession, user: User, goal_id: uuid.UUID) -> Goal:
    goal = await db.get(Goal, goal_id)
    if goal is None or goal.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meta não encontrada")
    return goal


async def update_goal(db: AsyncSession, user: User, goal_id: uuid.UUID, data: GoalUpdate) -> Goal:
    goal = await get_owned_goal(db, user, goal_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    await db.commit()
    await db.refresh(goal)
    await _refresh_current_amount(db, goal)
    await db.commit()
    return goal


async def delete_goal(db: AsyncSession, user: User, goal_id: uuid.UUID) -> None:
    goal = await get_owned_goal(db, user, goal_id)
    goal.is_active = False
    await db.commit()
