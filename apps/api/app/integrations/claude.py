import json
from datetime import date

import anthropic

from app.core.config import settings

PARSE_MODEL = "claude-haiku-4-5-20251001"


class ClaudeParseError(Exception):
    pass


async def parse_transaction_text(text: str, user_categories: list[str], user_personality: str) -> dict:
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
        return json.loads(raw_text)
    except json.JSONDecodeError as error:
        raise ClaudeParseError(f"Resposta da IA não é um JSON válido: {error}")
