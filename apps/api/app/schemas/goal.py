import datetime as dt
import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

GoalType = Literal["expense_limit", "income_target", "savings", "investment"]
GoalPeriod = Literal["monthly", "yearly", "one_time"]


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: GoalType
    category_id: uuid.UUID | None = None
    target_amount: Decimal = Field(gt=0)
    period: GoalPeriod = "monthly"
    deadline: dt.date | None = None


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category_id: uuid.UUID | None = None
    target_amount: Decimal | None = Field(default=None, gt=0)
    period: GoalPeriod | None = None
    deadline: dt.date | None = None
    is_active: bool | None = None


class GoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    type: str
    category_id: uuid.UUID | None
    target_amount: Decimal
    current_amount: Decimal
    period: str
    deadline: dt.date | None
    is_active: bool
    created_at: dt.datetime


class GoalProgress(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    target_amount: Decimal
    current_amount: Decimal
    percentage: float
