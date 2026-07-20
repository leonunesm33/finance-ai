"""add role to users

Revision ID: 9b4d2f6a1c33
Revises: 7f3a9c1d5e24
Create Date: 2026-07-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b4d2f6a1c33'
down_revision: Union[str, None] = '7f3a9c1d5e24'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('role', sa.String(length=20), nullable=False, server_default='user'),
    )


def downgrade() -> None:
    op.drop_column('users', 'role')
