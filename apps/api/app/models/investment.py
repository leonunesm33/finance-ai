import datetime as dt
import uuid
from decimal import Decimal

from sqlalchemy import Computed, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class Investment(Base):
    __tablename__ = "investments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bank_accounts.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    institution: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(20, 8), default=1, nullable=False)
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(15, 6), nullable=True)
    current_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    invested_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    income: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), Computed("current_value - invested_amount", persisted=True)
    )
    income_percentage: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    last_updated: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
