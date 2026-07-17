"""add transactions (user_id, type, date) index

Revision ID: 7f3a9c1d5e24
Revises: 2132ebae1939
Create Date: 2026-07-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f3a9c1d5e24'
down_revision: Union[str, None] = '2132ebae1939'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_transactions_user_id_type_date',
        'transactions',
        ['user_id', 'type', 'date'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_transactions_user_id_type_date', table_name='transactions')
