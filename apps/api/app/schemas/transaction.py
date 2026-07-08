import datetime as dt
import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TransactionType = Literal["expense", "income", "investment", "transfer"]
TransactionOrigin = Literal["manual", "open_finance", "csv_import"]


class TransactionCreate(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    amount: Decimal = Field(gt=0)
    type: TransactionType
    date: dt.date
    account_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    notes: str | None = None


class TransactionUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=1, max_length=500)
    amount: Decimal | None = Field(default=None, gt=0)
    type: TransactionType | None = None
    date: dt.date | None = None
    account_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    notes: str | None = None


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    account_id: uuid.UUID | None
    category_id: uuid.UUID | None
    description: str
    amount: Decimal
    type: str
    date: dt.date
    notes: str | None
    origin: str
    is_reconciled: bool
    is_recurring: bool
    ai_suggested_category_id: uuid.UUID | None
    ai_confidence: float | None
    created_at: dt.datetime


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    page_size: int


class TransactionParseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class ParsedCategoryAlternative(BaseModel):
    category_name: str
    confidence: float


class TransactionParseResponse(BaseModel):
    description: str
    amount: Decimal
    type: TransactionType
    category_id: uuid.UUID | None = None
    category_name: str | None = None
    date: dt.date
    confidence: float
    alternatives: list[ParsedCategoryAlternative] = []


class CsvImportResult(BaseModel):
    created: int
    reconciled: int
    skipped: int
