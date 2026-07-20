"""Exclusão em massa dos dados de um usuário.

Usado por dois fluxos:
1. "Limpar todas as informações financeiras" (self-service, Configurações) —
   apaga transações/metas/investimentos/contas, mas preserva o perfil,
   categorias e histórico de chat, para o usuário recomeçar as importações.
2. Remoção de conta pelo admin — usa a mesma limpeza financeira e, em
   seguida, remove categorias próprias, conversas e o usuário.

Ordem de exclusão respeita as FKs (nenhuma tabela tem ON DELETE CASCADE para
"users", exceto chat_messages -> chat_conversations): transações antes de
contas/recorrências/categorias que elas referenciam; contas bancárias antes
das conexões que elas referenciam.
"""
import uuid

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bank_account import BankAccount
from app.models.bank_connection import BankConnection
from app.models.category import Category
from app.models.chat import ChatConversation
from app.models.goal import Goal
from app.models.investment import Investment
from app.models.recurring_transaction import RecurringTransaction
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.user import UserWipeResult


async def wipe_financial_data(db: AsyncSession, user_id: uuid.UUID) -> UserWipeResult:
    """Apaga transações, recorrências, metas, investimentos e contas/conexões
    bancárias do usuário. Preserva categorias, perfil e chat."""
    transactions = await db.execute(delete(Transaction).where(Transaction.user_id == user_id))
    recurring = await db.execute(delete(RecurringTransaction).where(RecurringTransaction.user_id == user_id))
    goals = await db.execute(delete(Goal).where(Goal.user_id == user_id))
    investments = await db.execute(delete(Investment).where(Investment.user_id == user_id))
    bank_accounts = await db.execute(delete(BankAccount).where(BankAccount.user_id == user_id))
    bank_connections = await db.execute(delete(BankConnection).where(BankConnection.user_id == user_id))

    await db.commit()

    return UserWipeResult(
        transactions_deleted=transactions.rowcount or 0,
        recurring_deleted=recurring.rowcount or 0,
        goals_deleted=goals.rowcount or 0,
        investments_deleted=investments.rowcount or 0,
        bank_accounts_deleted=bank_accounts.rowcount or 0,
        bank_connections_deleted=bank_connections.rowcount or 0,
    )


async def delete_user_completely(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Remove TODOS os dados do usuário, incluindo categorias próprias,
    conversas de chat e a conta em si. Usado pela remoção de conta pelo admin."""
    await wipe_financial_data(db, user_id)
    await db.execute(delete(ChatConversation).where(ChatConversation.user_id == user_id))
    await db.execute(delete(Category).where(Category.user_id == user_id))
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()
