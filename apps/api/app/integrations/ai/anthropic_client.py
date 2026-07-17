"""Implementação da interface AIClient sobre o SDK oficial da Anthropic."""
import logging
from collections.abc import AsyncIterator

import anthropic

from app.core.config import settings
from app.integrations.ai.base import AIProviderError

logger = logging.getLogger(__name__)


class AnthropicClient:
    def _client(self) -> anthropic.AsyncAnthropic:
        return anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=30.0)

    async def stream_chat(
        self, system: str, messages: list[dict], model: str, max_tokens: int = 1500
    ) -> AsyncIterator[str]:
        try:
            async with self._client().messages.stream(
                model=model, max_tokens=max_tokens, system=system, messages=messages
            ) as stream:
                async for text in stream.text_stream:
                    yield text
        except anthropic.APIError as error:
            logger.error("Erro na API da Anthropic: %s", error)
            raise AIProviderError("Falha de comunicação com o provedor de IA")

    async def complete(
        self, system: str, prompt: str, model: str, max_tokens: int = 1000
    ) -> str:
        try:
            message = await self._client().messages.create(
                model=model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": prompt}],
            )
        except anthropic.APIError as error:
            logger.error("Erro na API da Anthropic: %s", error)
            raise AIProviderError("Falha de comunicação com o provedor de IA")
        return message.content[0].text if message.content else ""
