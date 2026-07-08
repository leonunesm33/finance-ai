import datetime as dt
import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

InvestmentType = Literal["renda_fixa", "renda_variavel", "fundo", "cripto", "outro"]


class InvestmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: InvestmentType
    institution: str | None = None
    quantity: Decimal = Field(default=Decimal(1), gt=0)
    unit_price: Decimal | None = None
    current_value: Decimal = Field(ge=0)
    invested_amount: Decimal = Field(ge=0)


class InvestmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    institution: str | None = None
    quantity: Decimal | None = Field(default=None, gt=0)
    unit_price: Decimal | None = None
    current_value: Decimal | None = Field(default=None, ge=0)
    invested_amount: Decimal | None = Field(default=None, ge=0)


class InvestmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    account_id: uuid.UUID | None
    name: str
    type: str
    institution: str | None
    quantity: Decimal
    unit_price: Decimal | None
    current_value: Decimal
    invested_amount: Decimal
    income: Decimal
    income_percentage: Decimal | None
    last_updated: dt.datetime | None
    created_at: dt.datetime


class InvestmentsSummary(BaseModel):
    total_patrimony: Decimal
    total_income: Decimal
    income_percentage: float
    asset_count: int
    by_type: dict[str, Decimal]
