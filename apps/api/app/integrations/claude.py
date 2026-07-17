"""Tarefas de IA do produto, agnósticas de provedor.

Histórico: este módulo nasceu acoplado à Anthropic (daí o nome). Hoje ele
delega ao provedor ativo via app.integrations.ai (OpenRouter por padrão;
Anthropic/OpenAI/Gemini/Groq prontos por configuração). Os modelos vêm de
settings.AI_CHAT_MODEL / AI_PARSE_MODEL.
"""
import json
from collections.abc import AsyncIterator
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

from app.core.config import settings
from app.integrations.ai import AIProviderError, get_ai_client


class ClaudeParseError(Exception):
    pass


class ParsedAlternative(BaseModel):
    category_name: str
    confidence: float = Field(ge=0, le=1)


class ParsedTransaction(BaseModel):
    """Schema interno que valida o JSON retornado pelo modelo antes de qualquer uso."""

    description: str = Field(min_length=1, max_length=500)
    amount: Decimal = Field(gt=0)
    type: Literal["expense", "income", "investment", "transfer"]
    category_name: str | None = None
    date: date
    confidence: float = Field(default=0.5, ge=0, le=1)
    alternatives: list[ParsedAlternative] = []


def validate_parsed_transaction(raw: object) -> ParsedTransaction:
    """Valida a resposta bruta do modelo; levanta ClaudeParseError se o shape for inválido."""
    try:
        return ParsedTransaction.model_validate(raw)
    except (ValidationError, TypeError) as error:
        raise ClaudeParseError(f"Resposta da IA fora do formato esperado: {error}")


async def stream_chat(system: str, messages: list[dict]) -> AsyncIterator[str]:
    try:
        client = get_ai_client()
        async for text in client.stream_chat(
            system, messages, model=settings.AI_CHAT_MODEL, max_tokens=1500
        ):
            yield text
    except AIProviderError as error:
        yield f"\n\n_Erro ao consultar a IA: {error}_"


def _strip_json_fences(text: str) -> str:
    """Alguns modelos ignoram o 'sem markdown' e devolvem ```json ... ```."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1] if "\n" in text else ""
        if text.rstrip().endswith("```"):
            text = text.rstrip()[: -len("```")]
    return text.strip()


async def parse_transaction_text(
    text: str, user_categories: list[str], user_personality: str
) -> ParsedTransaction:
    system = f"""Você é um assistente financeiro pessoal com personalidade '{user_personality}'.
Analise o texto do usuário e extraia os dados de uma transação financeira.
Categorias disponíveis: {json.dumps(user_categories, ensure_ascii=False)}
Data atual: {date.today().isoformat()} (fuso: America/Sao_Paulo)
Responda SOMENTE com um JSON válido, sem markdown, no formato exato:
{{"description": string, "amount": number, "type": "expense"|"income"|"investment"|"transfer",
"category_name": string ou null, "date": "YYYY-MM-DD", "confidence": number entre 0 e 1,
"alternatives": [{{"category_name": string, "confidence": number}}]}}"""

    try:
        raw_text = await get_ai_client().complete(
            system, text, model=settings.AI_PARSE_MODEL, max_tokens=500
        )
    except AIProviderError as error:
        raise ClaudeParseError(str(error))

    try:
        raw = json.loads(_strip_json_fences(raw_text))
    except json.JSONDecodeError as error:
        raise ClaudeParseError(f"Resposta da IA não é um JSON válido: {error}")

    return validate_parsed_transaction(raw)
