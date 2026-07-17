import asyncio
import datetime as dt
import json

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import task_session
from app.integrations.ai import get_ai_client
from app.models.user import User
from app.services import goal_service
from app.services.dashboard_service import build_alerts, build_expenses_by_category, sum_by_type

ANALYSIS_SYSTEM_PROMPT = """Você é um analista financeiro pessoal. Gere uma análise narrativa
personalizada em markdown com exatamente estas seções: ## Resumo, ## Destaques,
## Pontos de Atenção, ## Recomendações. Baseie-se apenas nos dados fornecidos,
nunca invente números. Formate valores sempre em R$ com duas casas decimais."""


async def _build_analysis_context(user_id: str, period_start: dt.date, period_end: dt.date) -> dict:
    async with task_session() as db:
        user = await db.get(User, user_id)

        total_income = await sum_by_type(db, user.id, period_start, period_end, "income")
        total_expenses = await sum_by_type(db, user.id, period_start, period_end, "expense")
        expenses_by_category = await build_expenses_by_category(
            db, user.id, period_start, period_end, total_expenses
        )
        goals_progress = await goal_service.get_goals_progress(db, user)
        alerts = await build_alerts(db, user.id)

        return {
            "period": {"start": period_start.isoformat(), "end": period_end.isoformat()},
            "total_income": float(total_income),
            "total_expenses": float(total_expenses),
            "net_balance": float(total_income - total_expenses),
            "expenses_by_category": [
                {"category": c.category, "amount": float(c.amount), "vs_previous_percent": c.vs_previous}
                for c in expenses_by_category
            ],
            "goals": [g.model_dump(mode="json") for g in goals_progress],
            "alerts": [a.message for a in alerts],
        }


async def _run_analysis(user_id: str, period_start: str, period_end: str) -> str:
    context = await _build_analysis_context(
        user_id, dt.date.fromisoformat(period_start), dt.date.fromisoformat(period_end)
    )

    return await get_ai_client().complete(
        ANALYSIS_SYSTEM_PROMPT,
        json.dumps(context, ensure_ascii=False),
        model=settings.AI_ANALYSIS_MODEL,
        max_tokens=4096,
    )


@celery_app.task(name="reports.generate_ai_analysis")
def generate_ai_analysis(user_id: str, period_start: str, period_end: str) -> str:
    return asyncio.run(_run_analysis(user_id, period_start, period_end))
