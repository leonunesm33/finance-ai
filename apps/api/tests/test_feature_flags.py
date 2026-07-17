"""Testes das camadas multi-provedor: Open Finance (flag OFF) e IA."""
import pytest

from conftest import API


# ------------------------------------------------------------ config público

def test_config_publico(client):
    r = client.get(f"{API}/config")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["open_finance_enabled"] is False
    assert body["ai_enabled"] is False  # OPENROUTER_API_KEY ainda vazio
    assert body["app_name"]


# ------------------------------------------------- Open Finance: fail-closed

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


# -------------------------------------------------------------- IA: gates

def test_endpoints_ia_503_sem_provedor_configurado(client, auth_a):
    r = client.post(f"{API}/transactions/parse", headers=auth_a, json={"text": "mercado 50 reais"})
    assert r.status_code == 503, r.text
    assert "não configurado" in r.json()["detail"]

    r = client.post(f"{API}/reports/ai-analysis", headers=auth_a, json={})
    assert r.status_code == 503, r.text


def test_chat_send_503_sem_provedor(client, auth_a):
    r = client.post(f"{API}/chat/conversations", headers=auth_a)
    assert r.status_code in (200, 201), r.text
    conv_id = r.json()["id"]

    r = client.post(
        f"{API}/chat/conversations/{conv_id}/messages",
        headers=auth_a,
        json={"content": "olá"},
    )
    assert r.status_code == 503, r.text

    client.delete(f"{API}/chat/conversations/{conv_id}", headers=auth_a)


def test_factory_ia_sem_key_levanta_disabled():
    from app.integrations.ai import AIDisabledError
    from app.integrations.ai.factory import get_ai_client

    with pytest.raises(AIDisabledError):
        get_ai_client()


def test_parse_sse_line():
    from app.integrations.ai.openai_compat import parse_sse_line

    assert parse_sse_line('data: {"choices":[{"delta":{"content":"Olá"}}]}') == "Olá"
    assert parse_sse_line("data: [DONE]") is None
    assert parse_sse_line(": keep-alive") is None
    assert parse_sse_line("") is None
    assert parse_sse_line('data: {"choices":[{"delta":{}}]}') is None
    assert parse_sse_line("data: nao-e-json") is None
