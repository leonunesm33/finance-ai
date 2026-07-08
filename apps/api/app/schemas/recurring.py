import uuid
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RecurringFrequency = Literal["daily", "weekly", "monthly", "yearly"]


class RecurringCreate(BaseModel):
    description: str = Field(min_length=1)
    amount: Decimal = Field(gt=0)
    type: Literal["expense", "income", "investment", "transfer"]
    category_id: uuid.UUID | None = None
    frequency: RecurringFrequency
    day_of_month: int | None = Field(default=None, ge=1, le=28)
    start_date: date
    end_date: date | None = None


class RecurringUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=1)
    amount: Decimal | None = Field(default=None, gt=0)
    category_id: uuid.UUID | None = None
    frequency: RecurringFrequency | None = None
    day_of_month: int | None = Field(default=None, ge=1, le=28)
    end_date: date | None = None
    is_active: bool | None = None


class RecurringResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    description: str
    amount: Decimal
    type: str
    category_id: uuid.UUID | None
    frequency: str
    day_of_month: int | None
    start_date: date
    end_date: date | None
    last_generated_at: date | None
    is_active: bool
