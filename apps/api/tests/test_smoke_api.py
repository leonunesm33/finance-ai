"""Bateria de testes de integração (smoke) da API FinanceAI.

Cobre: health, autenticação, isolamento entre usuários (ownership),
CRUDs principais, dashboard e relatórios. Endpoints que dependem de
serviços externos pagos (Pluggy, Claude) são testados apenas quanto
à exigência de autenticação.
"""
import datetime as dt
import uuid

from conftest import API, PASSWORD

TODAY = dt.date.today().isoformat()


# ---------------------------------------------------------------- health

def test_health(client):
    r = client.get(f"{API.rsplit('/', 1)[0]}/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["db"] == "ok"
    assert body["redis"] == "ok"


# ---------------------------------------------------------------- auth

def test_register_email_duplicado(client, user_a):
    r = client.post(f"{API}/auth/register", json={
        "name": "Duplicado", "email": user_a["email"], "password": PASSWORD,
    })
    assert r.status_code in (400, 409), r.text


def test_register_payload_invalido(client):
    r = client.post(f"{API}/auth/register", json={"email": "nao-e-email", "password": "x"})
    assert r.status_code == 422


def test_login_senha_errada(client, user_a):
    r = client.post(f"{API}/auth/login", json={
        "email": user_a["email"], "password": "senha-errada-123",
    })
    assert r.status_code in (400, 401), r.text


def test_users_me_sem_token(client):
    r = client.get(f"{API}/users/me")
    assert r.status_code == 401


def test_users_me_token_invalido(client):
    r = client.get(f"{API}/users/me", headers={"Authorization": "Bearer token-falso"})
    assert r.status_code == 401


def test_users_me_ok(client, auth_a, user_a):
    r = client.get(f"{API}/users/me", headers=auth_a)
    assert r.status_code == 200
    assert r.json()["email"] == user_a["email"]


def test_refresh_token_via_cookie(client, user_a):
    """O refresh token agora trafega por cookie httpOnly — não mais no body do login."""
    import httpx

    from conftest import _register_and_login

    assert "refresh_token" not in user_a["login_response"], "refresh_token não deve vazar no body"

    # Cliente próprio: o jar de cookies não pode ser poluído pelos outros usuários da suíte.
    with httpx.Client(timeout=30) as c:
        _register_and_login(c)
        assert c.cookies.get("refresh_token"), "login deve setar o cookie refresh_token"

        r = c.post(f"{API}/auth/refresh")
        assert r.status_code == 200, r.text
        assert r.json().get("access_token")


# ---------------------------------------------------------------- categorias

def test_categorias_crud(client, auth_a):
    r = client.post(f"{API}/categories/", headers=auth_a, json={
        "name": f"Cat Teste {uuid.uuid4().hex[:6]}", "type": "expense",
        "color": "#FF0000", "icon": "tag",
    })
    assert r.status_code in (200, 201), r.text
    cat = r.json()

    r = client.get(f"{API}/categories/", headers=auth_a)
    assert r.status_code == 200
    assert any(c["id"] == cat["id"] for c in r.json())

    r = client.put(f"{API}/categories/{cat['id']}", headers=auth_a,
                   json={"name": "Cat Renomeada"})
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Cat Renomeada"

    r = client.delete(f"{API}/categories/{cat['id']}", headers=auth_a)
    assert r.status_code in (200, 204), r.text


def test_categoria_ownership(client, auth_a, auth_b):
    r = client.post(f"{API}/categories/", headers=auth_a, json={
        "name": f"Privada {uuid.uuid4().hex[:6]}", "type": "expense",
    })
    cat_id = r.json()["id"]

    r = client.put(f"{API}/categories/{cat_id}", headers=auth_b,
                   json={"name": "Invadida"})
    assert r.status_code in (403, 404), f"usuário B alterou categoria de A: {r.status_code}"

    r = client.delete(f"{API}/categories/{cat_id}", headers=auth_b)
    assert r.status_code in (403, 404), f"usuário B removeu categoria de A: {r.status_code}"


# ---------------------------------------------------------------- transações

def _nova_transacao(client, headers, **overrides):
    payload = {
        "description": f"Mercado {uuid.uuid4().hex[:6]}",
        "amount": "123.45",
        "type": "expense",
        "date": TODAY,
    }
    payload.update(overrides)
    r = client.post(f"{API}/transactions/", headers=headers, json=payload)
    assert r.status_code in (200, 201), r.text
    return r.json()


def test_transacao_crud(client, auth_a):
    tx = _nova_transacao(client, auth_a)
    assert tx["amount"] in ("123.45", 123.45, "123.4500")

    r = client.get(f"{API}/transactions/{tx['id']}", headers=auth_a)
    assert r.status_code == 200

    r = client.put(f"{API}/transactions/{tx['id']}", headers=auth_a,
                   json={"description": "Mercado editado", "amount": "99.90"})
    assert r.status_code == 200, r.text
    assert r.json()["description"] == "Mercado editado"

    r = client.delete(f"{API}/transactions/{tx['id']}", headers=auth_a)
    assert r.status_code in (200, 204), r.text

    r = client.get(f"{API}/transactions/{tx['id']}", headers=auth_a)
    assert r.status_code == 404


def test_transacao_valor_negativo_rejeitado(client, auth_a):
    r = client.post(f"{API}/transactions/", headers=auth_a, json={
        "description": "Inválida", "amount": "-10", "type": "expense", "date": TODAY,
    })
    assert r.status_code == 422


def test_transacao_listagem_paginada(client, auth_a):
    for _ in range(3):
        _nova_transacao(client, auth_a)
    r = client.get(f"{API}/transactions/", headers=auth_a,
                   params={"page": 1, "page_size": 2})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["items"]) <= 2
    assert body["total"] >= 3


def test_transacao_ownership(client, auth_a, auth_b):
    tx = _nova_transacao(client, auth_a)

    r = client.get(f"{API}/transactions/{tx['id']}", headers=auth_b)
    assert r.status_code in (403, 404), f"usuário B leu transação de A: {r.status_code}"

    r = client.delete(f"{API}/transactions/{tx['id']}", headers=auth_b)
    assert r.status_code in (403, 404), f"usuário B removeu transação de A: {r.status_code}"


def test_export_csv(client, auth_a):
    r = client.get(f"{API}/transactions/export-csv", headers=auth_a)
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")


# ---------------------------------------------------------------- metas

def test_goal_crud_e_progress(client, auth_a):
    r = client.post(f"{API}/goals/", headers=auth_a, json={
        "name": "Limite mercado", "type": "expense_limit",
        "target_amount": "1000.00", "period": "monthly",
    })
    assert r.status_code in (200, 201), r.text
    goal = r.json()

    r = client.get(f"{API}/goals/progress", headers=auth_a)
    assert r.status_code == 200, r.text

    r = client.put(f"{API}/goals/{goal['id']}", headers=auth_a,
                   json={"target_amount": "1500.00"})
    assert r.status_code == 200, r.text

    r = client.delete(f"{API}/goals/{goal['id']}", headers=auth_a)
    assert r.status_code in (200, 204), r.text


def test_goal_ownership(client, auth_a, auth_b):
    r = client.post(f"{API}/goals/", headers=auth_a, json={
        "name": "Meta privada", "type": "savings", "target_amount": "500",
    })
    goal_id = r.json()["id"]
    r = client.delete(f"{API}/goals/{goal_id}", headers=auth_b)
    assert r.status_code in (403, 404), f"usuário B removeu meta de A: {r.status_code}"


# ---------------------------------------------------------------- investimentos

def test_investimento_crud_e_summary(client, auth_a):
    r = client.post(f"{API}/investments/", headers=auth_a, json={
        "name": "CDB Teste", "type": "renda_fixa", "institution": "Banco X",
        "current_value": "1050.00", "invested_amount": "1000.00",
    })
    assert r.status_code in (200, 201), r.text
    inv = r.json()

    r = client.get(f"{API}/investments/summary", headers=auth_a)
    assert r.status_code == 200, r.text
    summary = r.json()
    assert float(summary["total_patrimony"]) >= 1050.0

    r = client.delete(f"{API}/investments/{inv['id']}", headers=auth_a)
    assert r.status_code in (200, 204), r.text


def test_investimento_ownership(client, auth_a, auth_b):
    r = client.post(f"{API}/investments/", headers=auth_a, json={
        "name": "Privado", "type": "cripto",
        "current_value": "10", "invested_amount": "10",
    })
    inv_id = r.json()["id"]
    r = client.put(f"{API}/investments/{inv_id}", headers=auth_b,
                   json={"name": "Invadido"})
    assert r.status_code in (403, 404), f"usuário B alterou investimento de A: {r.status_code}"
    client.delete(f"{API}/investments/{inv_id}", headers=auth_a)


# ---------------------------------------------------------------- recorrentes

def test_recorrente_crud(client, auth_a):
    r = client.post(f"{API}/recurring/", headers=auth_a, json={
        "description": "Aluguel", "amount": "1800.00", "type": "expense",
        "frequency": "monthly", "day_of_month": 5, "start_date": TODAY,
    })
    assert r.status_code in (200, 201), r.text
    rec = r.json()

    r = client.get(f"{API}/recurring/", headers=auth_a)
    assert r.status_code == 200
    assert any(item["id"] == rec["id"] for item in r.json())

    r = client.put(f"{API}/recurring/{rec['id']}", headers=auth_a,
                   json={"is_active": False})
    assert r.status_code == 200, r.text

    r = client.delete(f"{API}/recurring/{rec['id']}", headers=auth_a)
    assert r.status_code in (200, 204), r.text


# ------------------------------------------------- dashboard / relatórios

def test_dashboard_summary(client, auth_a):
    r = client.get(f"{API}/dashboard/summary", headers=auth_a)
    assert r.status_code == 200, r.text


def test_report_monthly(client, auth_a):
    now = dt.date.today()
    r = client.get(f"{API}/reports/monthly", headers=auth_a,
                   params={"year": now.year, "month": now.month})
    assert r.status_code == 200, r.text


def test_report_yearly(client, auth_a):
    r = client.get(f"{API}/reports/yearly", headers=auth_a,
                   params={"year": dt.date.today().year})
    assert r.status_code == 200, r.text


# ------------------------------- serviços externos: só exigem autenticação
# Open Finance fica fora desta lista: com a feature flag desligada o router
# inteiro responde 503 antes da autenticação (fail-closed) — coberto em
# tests/test_open_finance_flag.py.

def test_endpoints_externos_exigem_auth(client):
    protegidos = [
        ("get", f"{API}/bank-accounts/"),
        ("get", f"{API}/chat/conversations"),
        ("post", f"{API}/reports/ai-analysis"),
        ("post", f"{API}/transactions/parse"),
        ("get", f"{API}/calculators/prefill"),
    ]
    for method, url in protegidos:
        r = getattr(client, method)(url)
        assert r.status_code == 401, f"{method.upper()} {url} sem token devolveu {r.status_code}"
