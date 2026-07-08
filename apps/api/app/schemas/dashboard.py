import datetime as dt
import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from app.schemas.transaction import TransactionResponse

DashboardPeriod = Literal["last_7_days", "current_month", "previous_month", "this_year", "custom"]
AlertType = Literal["budget_warning", "invoice_due", "negative_balance", "anomaly", "connection_error"]


class PeriodRange(BaseModel):
    start: dt.date
    end: dt.date


class ExpenseByCategory(BaseModel):
    category_id: uuid.UUID | None
    category: str
    amount: Decimal
    percentage: float
    vs_previous: float | None


class DailySpending(BaseModel):
    date: dt.date
    expenses: Decimal
    income: Decimal


class OpenFinanceAccountSummary(BaseModel):
    connection_id: uuid.UUID
    institution_name: str
    institution_logo_url: str | None
    status: str
    last_sync_at: dt.datetime | None
    balance: Decimal


class DashboardAlert(BaseModel):
    type: AlertType
    message: str


class DashboardSummaryResponse(BaseModel):
    period: PeriodRange
    total_income: Decimal
    total_expenses: Decimal
    savings_rate: float
    net_balance: Decimal
    total_bank_balance: Decimal
    total_credit_limit: Decimal
    total_credit_available: Decimal
    expenses_by_category: list[ExpenseByCategory]
    daily_spending: list[DailySpending]
    recent_transactions: list[TransactionResponse]
    open_finance_accounts: list[OpenFinanceAccountSummary]
    alerts: list[DashboardAlert]
