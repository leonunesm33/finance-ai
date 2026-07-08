import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalProgress, GoalResponse, GoalUpdate
from app.services import goal_service

router = APIRouter(prefix="/v1/goals", tags=["goals"])


@router.get("/", response_model=list[GoalResponse])
async def list_goals(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await goal_service.list_goals(db, current_user)


@router.get("/progress", response_model=list[GoalProgress])
async def get_goals_progress(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await goal_service.get_goals_progress(db, current_user)


@router.post("/", response_model=GoalResponse, status_code=status.HTTP_201_CREATED)
async def create_goal(
    data: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await goal_service.create_goal(db, current_user, data)


@router.put("/{goal_id}", response_model=GoalResponse)
async def update_goal(
    goal_id: uuid.UUID,
    data: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await goal_service.update_goal(db, current_user, goal_id, data)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await goal_service.delete_goal(db, current_user, goal_id)
