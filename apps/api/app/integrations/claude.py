import json
from collections.abc import AsyncIterator
from datetime import date
from decimal import Decimal
from typing import Literal

import anthropic
from pydantic import BaseModel, Field, ValidationError

from app.core.config import settings

PARSE_MODEL = "claude-haiku-4-5-20251001"
CHAT_MODEL = "claude-sonnet-5"


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
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    try:
        async with client.messages.stream(
            model=CHAT_MODEL,
            max_tokens=1500,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text
    except anthropic.APIError as error:
        yield f"\n\n_Erro ao consultar a IA: {error}_"


async def parse_transaction_text(
    text: str, user_categories: list[str], user_personality: str
) -> ParsedTransaction:
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    system = f"""Você é um assistente financeiro pessoal com personalidade '{user_personality}'.
Analise o texto do usuário e extraia os dados de uma transação financeira.
Categorias disponíveis: {json.dumps(user_categories, ensure_ascii=False)}
Data atual: {date.today().isoformat()} (fuso: America/Sao_Paulo)
Responda SOMENTE com um JSON válido, sem markdown, no formato exato:
{{"description": string, "amount": number, "type": "expense"|"income"|"investment"|"transfer",
"category_name": string ou null, "date": "YYYY-MM-DD", "confidence": number entre 0 e 1,
"alternatives": [{{"category_name": string, "confidence": number}}]}}"""

    try:
        message = await client.messages.create(
            model=PARSE_MODEL,
            max_tokens=500,
            system=system,
            messages=[{"role": "user", "content": text}],
        )
    except anthropic.APIError as error:
        raise ClaudeParseError(str(error))

    raw_text = message.content[0].text if message.content else ""
    try:
        raw = json.loads(raw_text)
    except json.JSONDecodeError as error:
        raise ClaudeParseError(f"Resposta da IA não é um JSON válido: {error}")

    return validate_parsed_transaction(raw)
