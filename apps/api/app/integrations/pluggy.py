from datetime import date

import httpx

from app.core.config import settings

PLUGGY_BASE_URL = "https://api.pluggy.ai"


class PluggyError(Exception):
    pass


class PluggyClient:
    """Cliente HTTP para a API do Pluggy (agregador Open Finance Brasil).

    Docs: https://docs.pluggy.ai
    """

    def __init__(self) -> None:
        self._api_key: str | None = None

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        api_key = await self._get_api_key()
        headers = {**kwargs.pop("headers", {}), "X-API-KEY": api_key}

        async with httpx.AsyncClient(base_url=PLUGGY_BASE_URL, timeout=15.0) as client:
            response = await client.request(method, path, headers=headers, **kwargs)

        if response.status_code >= 400:
            raise PluggyError(f"Pluggy API error {response.status_code}: {response.text}")

        return response.json()

    async def _get_api_key(self) -> str:
        if self._api_key is not None:
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
            raise PluggyError(f"Falha ao autenticar no Pluggy: {response.text}")

        self._api_key = response.json()["apiKey"]
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
        data = await self._request(
            "GET",
            "/transactions",
            params={"accountId": account_id, "from": from_date.isoformat(), "pageSize": 500},
        )
        return data.get("results", [])


pluggy_client = PluggyClient()
