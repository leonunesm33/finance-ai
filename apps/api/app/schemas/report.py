import datetime as dt
import uuid
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.dashboard import ExpenseByCategory


class MonthlyReport(BaseModel):
    year: int
    month: int
    total_income: Decimal
    total_expenses: Decimal
    net_balance: Decimal
    expenses_by_category: list[ExpenseByCategory]
    daily_spending: list[dict]


class YearlyReportMonth(BaseModel):
    month: int
    income: Decimal
    expenses: Decimal


class YearlyReport(BaseModel):
    year: int
    total_income: Decimal
    total_expenses: Decimal
    months: list[YearlyReportMonth]
    expenses_by_category: list[ExpenseByCategory]


class CategoryHistoryPoint(BaseModel):
    period: str
    amount: Decimal


class CategoryReport(BaseModel):
    category_id: uuid.UUID
    category_name: str
    history: list[CategoryHistoryPoint]


class AIAnalysisJobResponse(BaseModel):
    job_id: str


class AIAnalysisStatusResponse(BaseModel):
    status: str
    result: str | None = None


class AIAnalysisRequest(BaseModel):
    period_start: dt.date
    period_end: dt.date
