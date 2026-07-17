"""Contrato comum dos provedores de IA.

O provedor ativo vem de settings.AI_PROVIDER (openrouter | anthropic | openai |
gemini | groq) e os modelos por tarefa de settings.AI_CHAT_MODEL /
AI_PARSE_MODEL / AI_ANALYSIS_MODEL. O app conversa apenas com esta interface.
"""
from collections.abc import AsyncIterator
from typing import Protocol, runtime_checkable


class AIProviderError(Exception):
    """Erro de comunicação com o provedor de IA."""


class AIDisabledError(AIProviderError):
    """Nenhuma chave configurada para o provedor ativo."""


@runtime_checkable
class AIClient(Protocol):
    def stream_chat(
        self, system: str, messages: list[dict], model: str, max_tokens: int = 1500
    ) -> AsyncIterator[str]:
        """Gera a resposta em streaming (trechos de texto)."""
        ...

    async def complete(
        self, system: str, prompt: str, model: str, max_tokens: int = 1000
    ) -> str:
        """Resposta única (não-stream) para tarefas de extração/análise."""
        ...
