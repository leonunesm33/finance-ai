"""Provedor Belvo (https://belvo.com) — estrutura pronta, não contratado.

Esqueleto planejado (docs: https://developers.belvo.com):
- Autenticação: HTTP Basic com secretId/secretPassword (settings.BELVO_SECRET_ID /
  BELVO_SECRET_PASSWORD); ambientes sandbox.belvo.com e api.belvo.com
  (settings.BELVO_ENVIRONMENT).
- Fluxo: widget (access_token via POST /api/token/) -> "links" equivalem aos
  itens -> GET /api/accounts/?link= -> GET /api/transactions/?link=&account=.
- Webhook: eventos com autenticação própria por header.
"""
from datetime import date

from app.core.config import settings

_NOT_IMPLEMENTED = "Integração Belvo planejada — implementar quando o contrato for fechado"


class BelvoProvider:
    def __init__(self) -> None:
        self.secret_id = settings.BELVO_SECRET_ID
        self.secret_password = settings.BELVO_SECRET_PASSWORD
        self.base_url = (
            "https://sandbox.belvo.com"
            if settings.BELVO_ENVIRONMENT == "sandbox"
            else "https://api.belvo.com"
        )

    async def create_connect_token(self, item_id: str | None = None) -> dict:
        raise NotImplementedError(_NOT_IMPLEMENTED)

    async def get_item(self, item_id: str) -> dict:
        raise NotImplementedError(_NOT_IMPLEMENTED)

    async def delete_item(self, item_id: str) -> None:
        raise NotImplementedError(_NOT_IMPLEMENTED)

    async def get_accounts(self, item_id: str) -> list[dict]:
        raise NotImplementedError(_NOT_IMPLEMENTED)

    async def get_transactions(self, account_id: str, from_date: date) -> list[dict]:
        raise NotImplementedError(_NOT_IMPLEMENTED)

    def verify_webhook(self, signature: str | None, body: bytes) -> bool:
        return False  # fail-closed até a implementação real
