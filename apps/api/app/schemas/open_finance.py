import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ConnectTokenResponse(BaseModel):
    connect_token: str
    expires_in: int = 1800


class ItemCreatedRequest(BaseModel):
    item_id: str


class BankConnectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pluggy_item_id: str
    institution_id: int
    institution_name: str
    institution_logo_url: str | None
    status: str
    last_sync_at: datetime | None
    error_message: str | None
    created_at: datetime


class BankAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    connection_id: uuid.UUID
    name: str
    type: str
    subtype: str | None
    number: str | None
    currency: str
    balance: Decimal
    credit_limit: Decimal | None
    available_credit: Decimal | None
    due_date: date | None
    last_sync_at: datetime | None


class BankAccountsSummary(BaseModel):
    total_balance: Decimal
    total_credit_limit: Decimal
    total_credit_available: Decimal
