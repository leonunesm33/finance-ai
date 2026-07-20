"""Testes de níveis de acesso (Usuário / Administrador) e gestão de usuários."""
import uuid

from conftest import API, PASSWORD


def test_usuario_comum_tem_role_user(client, auth_a):
    r = client.get(f"{API}/users/me", headers=auth_a)
    assert r.status_code == 200
    assert r.json()["role"] == "user"
    assert r.json()["is_active"] is True


def test_admin_tem_role_admin(client, auth_admin):
    r = client.get(f"{API}/users/me", headers=auth_admin)
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


# --------------------------------------------------------------- gate 403/401

def test_admin_routes_exigem_auth(client):
    r = client.get(f"{API}/admin/users/")
    assert r.status_code == 401


def test_admin_routes_bloqueiam_usuario_comum(client, auth_a):
    r = client.get(f"{API}/admin/users/", headers=auth_a)
    assert r.status_code == 403
    assert "administrador" in r.json()["detail"].lower()

    r = client.post(f"{API}/admin/users/", headers=auth_a, json={
        "name": "Invasor", "email": "invasor@example.com", "password": PASSWORD,
    })
    assert r.status_code == 403


# ---------------------------------------------------------- CRUD de usuários

def test_admin_lista_usuarios(client, auth_admin, admin_a):
    r = client.get(f"{API}/admin/users/", headers=auth_admin)
    assert r.status_code == 200
    emails = [u["email"] for u in r.json()]
    assert admin_a["email"] in emails


def test_admin_cria_usuario(client, auth_admin):
    email = f"criado-pelo-admin-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(f"{API}/admin/users/", headers=auth_admin, json={
        "name": "Criado pelo Admin", "email": email, "password": PASSWORD,
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["role"] == "user"  # default
    assert body["is_active"] is True

    # o usuário criado consegue logar normalmente
    r = client.post(f"{API}/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200


def test_admin_cria_usuario_ja_com_role_admin(client, auth_admin):
    email = f"admin-criado-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(f"{API}/admin/users/", headers=auth_admin, json={
        "name": "Novo Admin", "email": email, "password": PASSWORD, "role": "admin",
    })
    assert r.status_code == 201, r.text
    assert r.json()["role"] == "admin"


def test_admin_email_duplicado(client, auth_admin, user_a):
    r = client.post(f"{API}/admin/users/", headers=auth_admin, json={
        "name": "Duplicado", "email": user_a["email"], "password": PASSWORD,
    })
    assert r.status_code == 409


def test_admin_bloqueia_e_desbloqueia_usuario(client, auth_admin):
    email = f"bloqueio-teste-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(f"{API}/admin/users/", headers=auth_admin, json={
        "name": "Sera Bloqueado", "email": email, "password": PASSWORD,
    })
    user_id = r.json()["id"]

    r = client.patch(f"{API}/admin/users/{user_id}", headers=auth_admin, json={"is_active": False})
    assert r.status_code == 200, r.text
    assert r.json()["is_active"] is False

    # usuário bloqueado não consegue mais logar
    r = client.post(f"{API}/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 401

    r = client.patch(f"{API}/admin/users/{user_id}", headers=auth_admin, json={"is_active": True})
    assert r.status_code == 200
    r = client.post(f"{API}/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200


def test_admin_promove_e_rebaixa_role(client, auth_admin):
    email = f"promocao-teste-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(f"{API}/admin/users/", headers=auth_admin, json={
        "name": "Sera Promovido", "email": email, "password": PASSWORD,
    })
    user_id = r.json()["id"]

    r = client.patch(f"{API}/admin/users/{user_id}", headers=auth_admin, json={"role": "admin"})
    assert r.status_code == 200 and r.json()["role"] == "admin"

    r = client.patch(f"{API}/admin/users/{user_id}", headers=auth_admin, json={"role": "user"})
    assert r.status_code == 200 and r.json()["role"] == "user"


def test_admin_remove_usuario(client, auth_admin):
    email = f"sera-removido-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(f"{API}/admin/users/", headers=auth_admin, json={
        "name": "Sera Removido", "email": email, "password": PASSWORD,
    })
    user_id = r.json()["id"]

    r = client.delete(f"{API}/admin/users/{user_id}", headers=auth_admin)
    assert r.status_code == 204, r.text

    r = client.get(f"{API}/admin/users/", headers=auth_admin)
    assert user_id not in [u["id"] for u in r.json()]

    r = client.post(f"{API}/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 401


def test_admin_nao_pode_gerenciar_a_propria_conta(client, auth_admin, admin_a):
    r = client.patch(f"{API}/admin/users/{admin_a['id']}", headers=auth_admin, json={"is_active": False})
    assert r.status_code == 400
    assert "própria conta" in r.json()["detail"].lower() or "configurações" in r.json()["detail"].lower()

    r = client.delete(f"{API}/admin/users/{admin_a['id']}", headers=auth_admin)
    assert r.status_code == 400


def test_admin_nao_encontrado(client, auth_admin):
    r = client.patch(f"{API}/admin/users/{uuid.uuid4()}", headers=auth_admin, json={"is_active": False})
    assert r.status_code == 404


# ----------------------------------------------- último administrador (unitário)
# Testado de forma isolada (sem tocar em admins reais do banco — via HTTP essa
# regra é inatingível de propósito, já que o próprio ator sempre conta como
# admin restante; ver bloqueio de auto-gestão acima).

def test_ensure_not_last_admin_bloqueia_quando_zero(monkeypatch):
    import asyncio

    import pytest
    from fastapi import HTTPException

    from app.models.user import User
    from app.services import admin_service

    async def fake_zero(db, excluding):
        return 0

    monkeypatch.setattr(admin_service, "_remaining_active_admins", fake_zero)
    target = User(id=uuid.uuid4(), role="admin", is_active=True)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(admin_service._ensure_not_last_admin(None, target))
    assert exc_info.value.status_code == 400
    assert "último administrador" in exc_info.value.detail.lower()


def test_ensure_not_last_admin_permite_quando_ha_outros(monkeypatch):
    import asyncio

    from app.models.user import User
    from app.services import admin_service

    async def fake_one(db, excluding):
        return 1

    monkeypatch.setattr(admin_service, "_remaining_active_admins", fake_one)
    target = User(id=uuid.uuid4(), role="admin", is_active=True)

    asyncio.run(admin_service._ensure_not_last_admin(None, target))  # não deve levantar


def test_ensure_not_last_admin_ignora_alvo_nao_admin(monkeypatch):
    """Bloquear/remover um usuário comum nunca precisa checar a contagem de admins."""
    import asyncio

    from app.models.user import User
    from app.services import admin_service

    async def fail_if_called(db, excluding):
        raise AssertionError("não deveria consultar contagem de admins para alvo não-admin")

    monkeypatch.setattr(admin_service, "_remaining_active_admins", fail_if_called)
    target = User(id=uuid.uuid4(), role="user", is_active=True)

    asyncio.run(admin_service._ensure_not_last_admin(None, target))
