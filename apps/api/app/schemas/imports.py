import uuid
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

DocumentType = Literal["extrato", "fatura"]


class ImportedTransaction(BaseModel):
    date: date
    description: str = Field(min_length=1, max_length=500)
    amount: Decimal = Field(gt=0)
    type: Literal["expense", "income", "investment", "transfer"]
    category_id: uuid.UUID | None = None


class ImportPreviewResponse(BaseModel):
    file_format: Literal["csv", "xls", "xlsx", "pdf"]
    document_type: DocumentType
    confidence: float = Field(ge=0, le=1)
    transactions: list[ImportedTransaction]
    warnings: list[str] = []


class ImportCommitRequest(BaseModel):
    document_type: DocumentType = "extrato"
    transactions: list[ImportedTransaction] = Field(min_length=1, max_length=5000)


class ImportCommitResult(BaseModel):
    created: int
    reconciled: int
    skipped: int
