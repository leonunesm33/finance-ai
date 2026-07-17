"""Validação de ownership de chaves estrangeiras enviadas pelo cliente.

Impede que um usuário referencie categorias/contas de outros usuários
(IDOR via FK). Categorias de sistema (user_id IS NULL) são permitidas.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bank_account import BankAccount
from app.models.category import Category
from app.models.user import User


async def validate_owned_category(db: AsyncSession, user: User, category_id: uuid.UUID | None) -> None:
    """Aceita categoria do próprio usuário ou de sistema (user_id IS NULL); senão 422."""
    if category_id is None:
        return

    category = await db.get(Category, category_id)
    if category is None or (category.user_id is not None and category.user_id != user.id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Categoria inválida ou não pertence ao usuário",
        )


async def validate_owned_account(db: AsyncSession, user: User, account_id: uuid.UUID | None) -> None:
    """Aceita apenas conta bancária do próprio usuário; senão 422."""
    if account_id is None:
        return

    account = await db.get(BankAccount, account_id)
    if account is None or account.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Conta bancária inválida ou não pertence ao usuário",
        )
