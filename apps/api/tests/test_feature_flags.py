"""Testes das camadas multi-provedor: Open Finance (flag OFF) e IA.

Nota sobre a suíte: `client` fala HTTP com o processo real do uvicorn (outro
processo do Python) — monkeypatch em `settings` dentro do teste NÃO afeta esse
processo. Por isso a lógica de fail-closed da IA (`require_ai`) é testada
chamando a dependency diretamente e por introspecção das rotas do FastAPI, em
vez de bater nos endpoints reais — o que também evita gastar cota diária dos
modelos gratuitos da OpenRouter a cada rodada de testes.
"""
import pytest

from conftest import API


# ------------------------------------------------------------ config público

def test_config_publico(client):
    """Reflete o estado real do .env compartilhado com o servidor, não um valor fixo."""
    from app.core.config import settings

    r = client.get(f"{API}/config")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["open_finance_enabled"] == settings.OPEN_FINANCE_ENABLED
    assert body["ai_enabled"] == settings.ai_enabled
    assert body["app_name"]


# ------------------------------------------------- Open Finance: fail-closed
# OPEN_FINANCE_ENABLED é uma decisão de produto estável (não depende de chave
# externa alguma) — seguro testar via HTTP contra o servidor real.

def test_open_finance_503_com_flag_desligada(client, auth_a):
    casos = [
        ("post", "/open-finance/connect-token"),
        ("get", "/open-finance/connections"),
        ("post", "/open-finance/items"),
        ("post", "/open-finance/webhook"),
    ]
    for method, path in casos:
        r = getattr(client, method)(f"{API}{path}", headers=auth_a)
        assert r.status_code == 503, f"{method.upper()} {path} devolveu {r.status_code}"
        assert "indisponível" in r.json()["detail"].lower()


def test_open_finance_503_mesmo_sem_token(client):
    r = client.post(f"{API}/open-finance/connect-token")
    assert r.status_code == 503


# ----------------------------------------------------- provedores: factory

def test_factory_openfinance_resolve_todos_os_provedores():
    from app.integrations.openfinance.belvo import BelvoProvider
    from app.integrations.openfinance.celcoin import CelcoinProvider
    from app.integrations.openfinance.factory import _build
    from app.integrations.openfinance.polp import PolpProvider

    assert _build("pluggy") is not None
    assert isinstance(_build("polp"), PolpProvider)
    assert isinstance(_build("belvo"), BelvoProvider)
    assert isinstance(_build("celcoin"), CelcoinProvider)
    with pytest.raises(ValueError):
        _build("desconhecido")


def test_stubs_falham_explicitamente():
    import asyncio

    from app.integrations.openfinance.polp import PolpProvider

    with pytest.raises(NotImplementedError):
        asyncio.run(PolpProvider().create_connect_token())
    assert PolpProvider().verify_webhook("x", b"y") is False  # fail-closed


# ------------------------------------------- IA: gate fail-closed (unitário)
# Chamamos require_ai() diretamente como função Python (fora do FastAPI DI) e
# forçamos settings via monkeypatch — funciona porque roda no MESMO processo
# do teste, ao contrário de uma chamada HTTP ao servidor real.

def test_require_ai_bloqueia_sem_key(monkeypatch):
    from fastapi import HTTPException

    from app.core.deps import require_ai
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")
    monkeypatch.setattr(settings, "AI_PROVIDER", "openrouter")

    with pytest.raises(HTTPException) as exc_info:
        require_ai(current_user=object())
    assert exc_info.value.status_code == 503
    assert "não configurado" in exc_info.value.detail


def test_require_ai_libera_com_key(monkeypatch):
    from app.core.deps import require_ai
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "sk-or-fake-para-teste")
    monkeypatch.setattr(settings, "AI_PROVIDER", "openrouter")

    stub_user = object()
    assert require_ai(current_user=stub_user) is stub_user


def test_rotas_de_ia_exigem_require_ai():
    """Introspecção do FastAPI: confirma que os 3 endpoints de IA estão
    protegidos por require_ai, sem precisar chamar o servidor real."""
    from app.core.deps import require_ai
    from app.main import app

    protegidas = {
        ("POST", "/api/v1/transactions/parse"),
        ("POST", "/api/v1/reports/ai-analysis"),
        ("POST", "/api/v1/chat/conversations/{conversation_id}/messages"),
    }
    encontradas = set()

    for route in app.routes:
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", None) or set()
        if path is None or not methods:
            continue
        dependant = getattr(route, "dependant", None)
        if dependant is None:
            continue
        calls = {dep.call for dep in dependant.dependencies}
        for method in methods:
            if (method, path) in protegidas and require_ai in calls:
                encontradas.add((method, path))

    assert encontradas == protegidas, f"faltando gate require_ai em: {protegidas - encontradas}"


def test_factory_ia_sem_key_levanta_disabled(monkeypatch):
    from app.integrations.ai import AIDisabledError
    from app.integrations.ai.factory import get_ai_client
    from app.core.config import settings

    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "")
    monkeypatch.setattr(settings, "AI_PROVIDER", "openrouter")

    with pytest.raises(AIDisabledError):
        get_ai_client()


# --------------------------------------------- IA: parsing robusto (unitário)
# Modelos gratuitos seguem "responda só com JSON" com menos disciplina que
# modelos pagos maiores — estes testes cobrem o fallback de extração.

def test_extract_json_object_direto():
    from app.integrations.claude import extract_json_object

    assert extract_json_object('{"a": 1}') == {"a": 1}


def test_extract_json_object_com_cercas_markdown():
    from app.integrations.claude import extract_json_object

    assert extract_json_object('```json\n{"a": 1}\n```') == {"a": 1}


def test_extract_json_object_com_raciocinio_solto():
    """Caso real observado: modelo gratuito narra o raciocínio antes do JSON."""
    from app.integrations.claude import extract_json_object

    raw = (
        'We need to produce JSON with fields description, amount...\n'
        'Here is the answer:\n'
        '{"description": "Almoço", "amount": 45, "type": "expense", '
        '"category_name": "Alimentação", "date": "2026-07-20", '
        '"confidence": 0.9, "alternatives": []}'
    )
    assert extract_json_object(raw)["description"] == "Almoço"


def test_extract_json_object_invalido_levanta_erro():
    from app.integrations.claude import ClaudeParseError, extract_json_object

    with pytest.raises(ClaudeParseError):
        extract_json_object("isso não é json nem contém chaves")


def test_parse_sse_line():
    from app.integrations.ai.openai_compat import parse_sse_line

    assert parse_sse_line('data: {"choices":[{"delta":{"content":"Olá"}}]}') == "Olá"
    assert parse_sse_line("data: [DONE]") is None
    assert parse_sse_line(": keep-alive") is None
    assert parse_sse_line("") is None
    assert parse_sse_line('data: {"choices":[{"delta":{}}]}') is None
    assert parse_sse_line("data: nao-e-json") is None
