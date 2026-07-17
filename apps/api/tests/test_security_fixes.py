"""Testes das correções de segurança (revisão de 2026-07)."""
import datetime as dt
import uuid

import httpx

from conftest import API, PASSWORD, _register_and_login

TODAY = dt.date.today().isoformat()


def test_webhook_sem_assinatura_rejeitado(client):
    """Com PLUGGY_WEBHOOK_SECRET configurado, POST sem assinatura não pode processar."""
    r = client.post(f"{API}/open-finance/webhook", json={"itemId": "qualquer"})
    assert r.status_code in (401, 403, 503), f"webhook aceitou payload sem assinatura: {r.status_code}"


def test_webhook_assinatura_invalida_rejeitado(client):
    r = client.post(
        f"{API}/open-finance/webhook",
        json={"itemId": "qualquer"},
        headers={"X-Webhook-Signature": "assinatura-falsa"},
    )
    assert r.status_code in (401, 403, 503), r.status_code


def test_token_sem_exp_rejeitado(client):
    """Token assinado com a chave real, mas sem claim exp, deve ser recusado."""
    from jose import jwt

    from app.core.config import settings
    from app.core.security import ALGORITHM

    token = jwt.encode(
        {"sub": str(uuid.uuid4()), "type": "access"},
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )
    r = client.get(f"{API}/users/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401, f"token sem exp foi aceito: {r.status_code}"


def test_token_sub_invalido_retorna_401(client):
    """sub que não é UUID não pode virar erro 500."""
    from jose import jwt

    from app.core.config import settings
    from app.core.security import ALGORITHM

    token = jwt.encode(
        {
            "sub": "nao-e-uuid",
            "type": "access",
            "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5),
        },
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )
    r = client.get(f"{API}/users/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401, f"sub inválido devolveu {r.status_code}"


def test_transacao_com_categoria_de_outro_usuario(client, auth_a, auth_b):
    r = client.post(f"{API}/categories/", headers=auth_b, json={
        "name": f"Cat B {uuid.uuid4().hex[:6]}", "type": "expense",
    })
    cat_b = r.json()["id"]

    r = client.post(f"{API}/transactions/", headers=auth_a, json={
        "description": "Roubo de categoria", "amount": "10.00",
        "type": "expense", "date": TODAY, "category_id": cat_b,
    })
    assert r.status_code in (404, 422), f"usuário A usou categoria de B: {r.status_code}"


def test_refresh_sem_cookie_rejeitado():
    with httpx.Client(timeout=30) as c:
        r = c.post(f"{API}/auth/refresh")
        assert r.status_code in (400, 401, 422), r.status_code


def test_logout_limpa_cookie():
    with httpx.Client(timeout=30) as c:
        _register_and_login(c)
        assert c.cookies.get("refresh_token")
        r = c.post(f"{API}/auth/logout")
        assert r.status_code in (200, 204), r.text
        r = c.post(f"{API}/auth/refresh")
        assert r.status_code in (400, 401, 422), "refresh funcionou após logout"
