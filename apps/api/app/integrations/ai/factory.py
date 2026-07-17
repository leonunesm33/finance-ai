"""Resolve o cliente de IA ativo (settings.AI_PROVIDER)."""
from app.core.config import settings
from app.integrations.ai.base import AIClient, AIDisabledError
from app.integrations.ai.openai_compat import OpenAICompatClient

_OPENAI_COMPAT_BASES = {
    "openrouter": "https://openrouter.ai/api/v1",
    "openai": "https://api.openai.com/v1",
    "groq": "https://api.groq.com/openai/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
}

_cache: dict[str, AIClient] = {}


def _api_key_for(provider: str) -> str:
    return {
        "openrouter": settings.OPENROUTER_API_KEY,
        "anthropic": settings.ANTHROPIC_API_KEY,
        "openai": settings.OPENAI_API_KEY,
        "gemini": settings.GEMINI_API_KEY,
        "groq": settings.GROQ_API_KEY,
    }.get(provider, "")


def get_ai_client() -> AIClient:
    provider = settings.AI_PROVIDER

    api_key = _api_key_for(provider)
    if not api_key:
        raise AIDisabledError(f"Provedor de IA '{provider}' sem chave configurada")

    if provider in _cache:
        return _cache[provider]

    if provider == "anthropic":
        from app.integrations.ai.anthropic_client import AnthropicClient

        client: AIClient = AnthropicClient()
    elif provider in _OPENAI_COMPAT_BASES:
        extra_headers = {}
        if provider == "openrouter":
            # Recomendação do OpenRouter para atribuição/ranking do app
            extra_headers = {"HTTP-Referer": settings.FRONTEND_URL, "X-Title": settings.APP_NAME}
        client = OpenAICompatClient(_OPENAI_COMPAT_BASES[provider], api_key, extra_headers)
    else:
        raise ValueError(f"Provedor de IA desconhecido: {provider!r}")

    _cache[provider] = client
    return client
