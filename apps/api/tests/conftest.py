"""Fixtures da bateria de testes de integração.

Roda contra a API viva (docker-compose). Executar de dentro do container:
    docker exec financeai-api python -m pytest tests -v
"""
import asyncio
import os
import uuid

import httpx
import pytest

BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8000")
API = f"{BASE_URL}/api/v1"

PASSWORD = "Senha@Forte123"


def run_db(main):
    """Executa uma corrotina que recebe uma AsyncSession, com engine descartável.

    Usa NullPool e um event loop próprio para não interferir no engine global da app.
    """
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.core.config import settings

    async def _runner():
        engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with factory() as session:
                return await main(session)
        finally:
            await engine.dispose()

    return asyncio.run(_runner())


def _register_and_login(client: httpx.Client) -> dict:
    email = f"test-{uuid.uuid4().hex[:12]}@gmail.com"
    payload = {"name": "Usuário Teste", "email": email, "password": PASSWORD}
    r = client.post(f"{API}/auth/register", json=payload)
    assert r.status_code in (200, 201), f"register falhou: {r.status_code} {r.text}"

    r = client.post(f"{API}/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, f"login falhou: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    assert token, f"login não retornou access_token: {data}"
    return {"email": email, "token": token, "login_response": data}


@pytest.fixture(scope="session")
def client():
    with httpx.Client(timeout=30) as c:
        yield c


@pytest.fixture(scope="session")
def user_a(client):
    return _register_and_login(client)


@pytest.fixture(scope="session")
def user_b(client):
    return _register_and_login(client)


@pytest.fixture(scope="session")
def auth_a(user_a):
    return {"Authorization": f"Bearer {user_a['token']}"}


@pytest.fixture(scope="session")
def auth_b(user_b):
    return {"Authorization": f"Bearer {user_b['token']}"}
