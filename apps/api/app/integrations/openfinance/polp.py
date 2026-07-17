"""Provedor Polp (https://www.polp.com.br) — estrutura pronta, não contratado.

Esqueleto planejado (confirmar na documentação comercial da Polp ao contratar):
- Autenticação: API key em header (settings.POLP_API_KEY).
- Fluxo: criar consentimento/conexão -> listar contas -> listar transações.
- Webhook: validar assinatura conforme especificação do contrato.
"""
from datetime import date

from app.core.config import settings

_NOT_IMPLEMENTED = "Integração Polp planejada — implementar quando o contrato for fechado"


class PolpProvider:
    def __init__(self) -> None:
        self.api_key = settings.POLP_API_KEY

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
