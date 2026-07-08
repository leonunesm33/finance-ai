from decimal import Decimal

from pydantic import BaseModel


class CalculatorPrefillData(BaseModel):
    avg_monthly_savings: Decimal
    avg_fixed_expenses_3m: Decimal
    avg_monthly_expenses: Decimal
