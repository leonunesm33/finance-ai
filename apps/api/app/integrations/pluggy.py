import asyncio
import hashlib
import hmac
import logging
import time
from datetime import date

import httpx

from app.core.config import settings
from app.integrations.openfinance.base import OpenFinanceProviderError

logger = logging.getLogger(__name__)

PLUGGY_BASE_URL = "https://api.pluggy.ai"

# A API key do Pluggy vale 2 horas; renovamos com 5 minutos de margem.
API_KEY_TTL_SECONDS = 2 * 60 * 60
API_KEY_RENEW_MARGIN_SECONDS = 5 * 60


class PluggyError(OpenFinanceProviderError):
    pass


class PluggyClient:
    """Cliente HTTP para a API do Pluggy (agregador Open Finance Brasil).

    Docs: https://docs.pluggy.ai
    """

    def __init__(self) -> None:
        self._api_key: str | None = None
        self._api_key_expires_at: float = 0.0
        self._auth_lock = asyncio.Lock()

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        response = await self._send(method, path, **kwargs)

        # API key expirada/revogada no lado do Pluggy: invalida o cache e tenta 1 vez.
        if response.status_code in (401, 403):
            self._invalidate_api_key()
            response = await self._send(method, path, **kwargs)

        if response.status_code >= 400:
            logger.error(
                "Pluggy API error: %s %s -> %s: %s", method, path, response.status_code, response.text
            )
            raise PluggyError(f"Pluggy API error {response.status_code}")

        if response.status_code == 204 or not response.content:
            return {}
        return response.json()

    async def _send(self, method: str, path: str, **kwargs) -> httpx.Response:
        api_key = await self._get_api_key()
        headers = {**kwargs.get("headers", {}), "X-API-KEY": api_key}
        request_kwargs = {k: v for k, v in kwargs.items() if k != "headers"}

        async with httpx.AsyncClient(base_url=PLUGGY_BASE_URL, timeout=15.0) as client:
            return await client.request(method, path, headers=headers, **request_kwargs)

    def _invalidate_api_key(self) -> None:
        self._api_key = None
        self._api_key_expires_at = 0.0

    async def _get_api_key(self) -> str:
        if self._api_key is not None and time.monotonic() < self._api_key_expires_at:
            return self._api_key

        async with self._auth_lock:
            # Outra corrotina pode ter renovado enquanto aguardávamos o lock.
            if self._api_key is not None and time.monotonic() < self._api_key_expires_at:
                return self._api_key

            async with httpx.AsyncClient(base_url=PLUGGY_BASE_URL, timeout=15.0) as client:
                response = await client.post(
                    "/auth",
                    json={
                        "clientId": settings.PLUGGY_CLIENT_ID,
                        "clientSecret": settings.PLUGGY_CLIENT_SECRET,
                    },
                )

            if response.status_code >= 400:
                logger.error("Falha ao autenticar no Pluggy: %s: %s", response.status_code, response.text)
                raise PluggyError(f"Falha ao autenticar no Pluggy (HTTP {response.status_code})")

            self._api_key = response.json()["apiKey"]
            self._api_key_expires_at = time.monotonic() + API_KEY_TTL_SECONDS - API_KEY_RENEW_MARGIN_SECONDS
            return self._api_key

    async def create_connect_token(self, item_id: str | None = None) -> dict:
        body: dict = {}
        if item_id:
            body["itemId"] = item_id
        return await self._request("POST", "/connect_token", json=body)

    async def get_item(self, item_id: str) -> dict:
        return await self._request("GET", f"/items/{item_id}")

    async def delete_item(self, item_id: str) -> None:
        await self._request("DELETE", f"/items/{item_id}")

    async def get_accounts(self, item_id: str) -> list[dict]:
        data = await self._request("GET", "/accounts", params={"itemId": item_id})
        return data.get("results", [])

    async def get_transactions(self, account_id: str, from_date: date) -> list[dict]:
        """Lista transações via GET /v2/transactions (o v1 foi descontinuado — 410).

        O v2 pagina pelo campo `next` da resposta (URL completa da próxima página)
        e não aceita filtro pela data da transação, então o corte por `from_date`
        é aplicado aqui, client-side.
        """
        results: list[dict] = []
        path = "/v2/transactions"
        params: dict | None = {"accountId": account_id}

        for _ in range(100):  # trava de segurança contra paginação infinita
            data = await self._request("GET", path, params=params)
            results.extend(data.get("results", []))

            next_ref = data.get("next")
            if not next_ref:
                break
            if isinstance(next_ref, str) and next_ref.startswith("http"):
                # httpx ignora base_url quando a URL é absoluta; a query já vem embutida
                path, params = next_ref, None
            else:
                logger.warning("Formato de cursor inesperado em /v2/transactions: %r", next_ref)
                break

        cutoff = from_date.isoformat()
        return [t for t in results if str(t.get("date", ""))[:10] >= cutoff]

    def verify_webhook(self, signature: str | None, body: bytes) -> bool:
        """HMAC-SHA256 do corpo com PLUGGY_WEBHOOK_SECRET. Fail-closed sem segredo."""
        if not settings.PLUGGY_WEBHOOK_SECRET or not signature:
            return False
        expected = hmac.new(settings.PLUGGY_WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)


pluggy_client = PluggyClient()
