"""Cliente genérico para APIs compatíveis com a OpenAI (chat/completions).

Cobre OpenRouter, OpenAI, Groq e o endpoint OpenAI-compat do Gemini — muda
apenas base_url, api_key e headers extras. Implementado sobre httpx para não
adicionar SDKs novos.
"""
import json
import logging
from collections.abc import AsyncIterator

import httpx

from app.integrations.ai.base import AIProviderError

logger = logging.getLogger(__name__)


def parse_sse_line(line: str) -> str | None:
    """Extrai o trecho de texto de uma linha SSE `data: {...}` do chat/completions.

    Retorna None para linhas sem conteúdo (comentários, keep-alive, [DONE]).
    Função pura para ser testável sem rede.
    """
    line = line.strip()
    if not line.startswith("data:"):
        return None
    payload = line[len("data:"):].strip()
    if not payload or payload == "[DONE]":
        return None
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        return None
    choices = data.get("choices") or []
    if not choices:
        return None
    delta = choices[0].get("delta") or {}
    return delta.get("content") or None


class OpenAICompatClient:
    def __init__(self, base_url: str, api_key: str, extra_headers: dict | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.extra_headers = extra_headers or {}

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            **self.extra_headers,
        }

    async def stream_chat(
        self, system: str, messages: list[dict], model: str, max_tokens: int = 1500
    ) -> AsyncIterator[str]:
        body = {
            "model": model,
            "max_tokens": max_tokens,
            "stream": True,
            "messages": [{"role": "system", "content": system}, *messages],
        }
        timeout = httpx.Timeout(connect=10.0, read=None, write=30.0, pool=10.0)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST", f"{self.base_url}/chat/completions", json=body, headers=self._headers()
                ) as response:
                    if response.status_code >= 400:
                        detail = (await response.aread()).decode(errors="replace")[:500]
                        logger.error("Provedor de IA respondeu %s: %s", response.status_code, detail)
                        raise AIProviderError(f"Provedor de IA respondeu HTTP {response.status_code}")
                    async for line in response.aiter_lines():
                        chunk = parse_sse_line(line)
                        if chunk:
                            yield chunk
        except httpx.HTTPError as error:
            logger.error("Falha de rede com o provedor de IA: %s", error)
            raise AIProviderError("Falha de comunicação com o provedor de IA")

    async def complete(
        self, system: str, prompt: str, model: str, max_tokens: int = 1000
    ) -> str:
        body = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions", json=body, headers=self._headers()
                )
        except httpx.HTTPError as error:
            logger.error("Falha de rede com o provedor de IA: %s", error)
            raise AIProviderError("Falha de comunicação com o provedor de IA")

        if response.status_code >= 400:
            logger.error(
                "Provedor de IA respondeu %s: %s", response.status_code, response.text[:500]
            )
            raise AIProviderError(f"Provedor de IA respondeu HTTP {response.status_code}")

        data = response.json()
        choices = data.get("choices") or []
        if not choices:
            raise AIProviderError("Provedor de IA retornou resposta vazia")
        return (choices[0].get("message") or {}).get("content") or ""
