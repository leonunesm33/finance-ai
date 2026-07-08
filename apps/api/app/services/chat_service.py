import datetime as dt
import json
import uuid
from collections.abc import AsyncIterator

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.integrations.claude import stream_chat
from app.models.bank_account import BankAccount
from app.models.category import Category
from app.models.chat import ChatConversation, ChatMessage
from app.models.transaction import Transaction
from app.models.user import User
from app.services.dashboard_service import build_alerts
from app.services.goal_service import get_goals_progress

PERSONALITY_PROMPTS = {
    "neutro": "Você responde de forma objetiva e direta, sem julgamentos.",
    "direto": "Você é curto, sem rodeios, e foca em números e ações concretas.",
    "motivador": "Você tem um tom positivo e encorajador, e usa emojis sutis.",
}


async def build_financial_context(db: AsyncSession, user: User, period_days: int = 30) -> dict:
    end = dt.date.today()
    start = end - dt.timedelta(days=period_days)

    accounts = await db.scalars(
        select(BankAccount).where(BankAccount.user_id == user.id, BankAccount.is_active.is_(True))
    )
    accounts_summary = [{"name": a.name, "type": a.type, "balance": float(a.balance)} for a in accounts]

    category_rows = await db.execute(
        select(Category.name, func.sum(Transaction.amount))
        .select_from(Transaction)
        .join(Category, Category.id == Transaction.category_id, isouter=True)
        .where(
            Transaction.user_id == user.id,
            Transaction.type == "expense",
            Transaction.date >= start,
            Transaction.date <= end,
        )
        .group_by(Category.name)
    )
    period_expenses_by_category = [
        {"category": name or "Sem categoria", "amount": float(amount)} for name, amount in category_rows
    ]

    period_income_total = float(
        await db.scalar(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user.id,
                Transaction.type == "income",
                Transaction.date >= start,
                Transaction.date <= end,
            )
        )
    )
    period_expense_total = float(
        await db.scalar(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user.id,
                Transaction.type == "expense",
                Transaction.date >= start,
                Transaction.date <= end,
            )
        )
    )

    alerts = await build_alerts(db, user.id)
    goals_progress = await get_goals_progress(db, user)

    return {
        "current_date": dt.date.today().isoformat(),
        "period_days": period_days,
        "accounts_summary": accounts_summary,
        "period_expenses_by_category": period_expenses_by_category,
        "period_income_total": period_income_total,
        "period_expense_total": period_expense_total,
        "active_goals": [
            {
                "name": g.name,
                "target_amount": float(g.target_amount),
                "current_amount": float(g.current_amount),
                "percentage": g.percentage,
            }
            for g in goals_progress
        ],
        "recent_alerts": [a.message for a in alerts],
    }


async def list_conversations(db: AsyncSession, user: User) -> list[ChatConversation]:
    result = await db.scalars(
        select(ChatConversation)
        .where(ChatConversation.user_id == user.id)
        .order_by(ChatConversation.created_at.desc())
    )
    return list(result.all())


async def create_conversation(db: AsyncSession, user: User) -> ChatConversation:
    conversation = ChatConversation(user_id=user.id)
    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)
    return conversation


async def get_owned_conversation(db: AsyncSession, user: User, conversation_id: uuid.UUID) -> ChatConversation:
    conversation = await db.get(ChatConversation, conversation_id)
    if conversation is None or conversation.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversa não encontrada")
    return conversation


async def list_messages(db: AsyncSession, conversation: ChatConversation) -> list[ChatMessage]:
    result = await db.scalars(
        select(ChatMessage)
        .where(ChatMessage.conversation_id == conversation.id)
        .order_by(ChatMessage.created_at)
    )
    return list(result.all())


async def delete_conversation(db: AsyncSession, conversation: ChatConversation) -> None:
    await db.delete(conversation)
    await db.commit()


async def send_message(user: User, conversation_id: uuid.UUID, user_message: str) -> AsyncIterator[str]:
    """Abre sua própria sessão de DB, independente da requisição HTTP.

    O FastAPI encerra dependências `Depends(get_db)` assim que a função da rota
    retorna — o que acontece antes do corpo do StreamingResponse ser consumido.
    Usar a sessão da requisição aqui faria mudanças em objetos já carregados
    (como o título da conversa) se perderem silenciosamente, mesmo com INSERTs
    novos sendo persistidos normalmente.
    """
    async with async_session_factory() as db:
        conversation = await get_owned_conversation(db, user, conversation_id)
        history = await list_messages(db, conversation)

        context = await build_financial_context(db, user)
        personality_prompt = PERSONALITY_PROMPTS.get(user.ai_personality, PERSONALITY_PROMPTS["neutro"])

        system = f"""{personality_prompt}

Você é um assistente financeiro pessoal do usuário {user.name}.
Você tem acesso aos dados financeiros atuais dele:

{json.dumps(context, ensure_ascii=False, indent=2)}

Responda perguntas sobre suas finanças de forma precisa, baseada apenas nos dados acima.
Se precisar de dados fora do período disponível, informe que não tem acesso.
Formate valores sempre em R$ com duas casas decimais.
Nunca invente dados — se não souber, diga que não tem a informação disponível."""

        messages = [{"role": m.role, "content": m.content} for m in history]
        messages.append({"role": "user", "content": user_message})

        db.add(ChatMessage(conversation_id=conversation.id, role="user", content=user_message))
        if conversation.title is None:
            conversation.title = user_message[:60]
        await db.commit()

        full_response = ""
        async for chunk in stream_chat(system, messages):
            full_response += chunk
            yield chunk

        db.add(ChatMessage(conversation_id=conversation.id, role="assistant", content=full_response))
        await db.commit()
