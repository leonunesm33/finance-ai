"""Testes de 'Limpar todas as informações financeiras' (self-service, Configurações)."""
import datetime as dt
import uuid

from conftest import API, PASSWORD, _register_and_login

TODAY = dt.date.today().isoformat()


def _fresh_user_auth(client):
    """Usuário descartável isolado — não reaproveita user_a/user_b, que outros
    testes da suíte também usam (evita apagar dados de outro teste em execução)."""
    user = _register_and_login(client)
    return {"Authorization": f"Bearer {user['token']}"}


def test_wipe_exige_senha_correta(client):
    auth = _fresh_user_auth(client)
    r = client.post(f"{API}/users/me/wipe-financial-data", headers=auth,
                     json={"current_password": "senha-errada-123"})
    assert r.status_code == 400
    assert "senha" in r.json()["detail"].lower()


def test_wipe_apaga_dados_financeiros_preserva_categorias(client):
    auth = _fresh_user_auth(client)

    cat = client.post(f"{API}/categories/", headers=auth, json={
        "name": f"Cat Preservada {uuid.uuid4().hex[:6]}", "type": "expense",
    }).json()
    client.post(f"{API}/transactions/", headers=auth, json={
        "description": "Para apagar", "amount": "50.00", "type": "expense", "date": TODAY,
    })
    client.post(f"{API}/goals/", headers=auth, json={
        "name": "Meta para apagar", "type": "savings", "target_amount": "1000",
    })
    client.post(f"{API}/investments/", headers=auth, json={
        "name": "Ativo para apagar", "type": "renda_fixa",
        "current_value": "100", "invested_amount": "100",
    })
    client.post(f"{API}/recurring/", headers=auth, json={
        "description": "Recorrente para apagar", "amount": "30", "type": "expense",
        "frequency": "monthly", "day_of_month": 5, "start_date": TODAY,
    })

    r = client.post(f"{API}/users/me/wipe-financial-data", headers=auth,
                     json={"current_password": PASSWORD})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["transactions_deleted"] >= 1
    assert body["goals_deleted"] >= 1
    assert body["investments_deleted"] >= 1
    assert body["recurring_deleted"] >= 1

    assert client.get(f"{API}/transactions/", headers=auth).json()["total"] == 0
    assert client.get(f"{API}/goals/", headers=auth).json() == []
    assert client.get(f"{API}/investments/", headers=auth).json() == []
    assert client.get(f"{API}/recurring/", headers=auth).json() == []

    # categorias e perfil sobrevivem — é possível recomeçar as importações
    categorias_restantes = [c["id"] for c in client.get(f"{API}/categories/", headers=auth).json()]
    assert cat["id"] in categorias_restantes

    r = client.get(f"{API}/users/me", headers=auth)
    assert r.status_code == 200


def test_wipe_e_idempotente(client):
    auth = _fresh_user_auth(client)
    r = client.post(f"{API}/users/me/wipe-financial-data", headers=auth,
                     json={"current_password": PASSWORD})
    assert r.status_code == 200
    assert r.json()["transactions_deleted"] == 0

    r = client.post(f"{API}/users/me/wipe-financial-data", headers=auth,
                     json={"current_password": PASSWORD})
    assert r.status_code == 200
    assert r.json() == {
        "transactions_deleted": 0, "recurring_deleted": 0, "goals_deleted": 0,
        "investments_deleted": 0, "bank_accounts_deleted": 0, "bank_connections_deleted": 0,
    }


def test_wipe_so_afeta_o_proprio_usuario(client):
    """Usuário A cria dados; wipe do usuário B não deve apagar nada de A.
    Usa 2 usuários descartáveis próprios (não auth_a/auth_b, que são
    compartilhados com o resto da suíte durante toda a sessão)."""
    auth_a = _fresh_user_auth(client)
    auth_b = _fresh_user_auth(client)

    tx = client.post(f"{API}/transactions/", headers=auth_a, json={
        "description": "Intocavel", "amount": "77.00", "type": "expense", "date": TODAY,
    }).json()

    r = client.post(f"{API}/users/me/wipe-financial-data", headers=auth_b,
                     json={"current_password": PASSWORD})
    assert r.status_code == 200

    r = client.get(f"{API}/transactions/{tx['id']}", headers=auth_a)
    assert r.status_code == 200
