"""Provedor Celcoin (https://www.celcoin.com.br) — estrutura pronta, não contratado.

Esqueleto planejado (docs: https://developers.celcoin.com.br):
- Autenticação: OAuth2 client_credentials (settings.CELCOIN_CLIENT_ID /
  CELCOIN_CLIENT_SECRET) -> token Bearer com expiração; renovar com margem.
- Fluxo Open Finance Celcoin: consentimento -> contas -> transações.
- Webhook: validação conforme especificação do produto contratado.
"""
from datetime import date

from app.core.config import settings

_NOT_IMPLEMENTED = "Integração Celcoin planejada — implementar quando o contrato for fechado"


class CelcoinProvider:
    def __init__(self) -> None:
        self.client_id = settings.CELCOIN_CLIENT_ID
        self.client_secret = settings.CELCOIN_CLIENT_SECRET

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
