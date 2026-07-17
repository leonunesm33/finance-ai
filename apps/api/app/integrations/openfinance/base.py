"""Contrato comum dos provedores de Open Finance.

O app conversa apenas com esta interface; cada agregador (Pluggy, Polp,
Belvo, Celcoin) implementa os mesmos métodos. O provedor ativo é escolhido
por settings.OPEN_FINANCE_PROVIDER e a funcionalidade inteira fica atrás de
settings.OPEN_FINANCE_ENABLED (fail-closed).
"""
from datetime import date
from typing import Protocol, runtime_checkable


class OpenFinanceProviderError(Exception):
    """Erro genérico de comunicação com o agregador."""


@runtime_checkable
class OpenFinanceProvider(Protocol):
    async def create_connect_token(self, item_id: str | None = None) -> dict:
        """Token de curta duração para o widget de conexão do provedor."""
        ...

    async def get_item(self, item_id: str) -> dict:
        """Metadados de uma conexão (item) no provedor."""
        ...

    async def delete_item(self, item_id: str) -> None:
        """Remove a conexão no provedor (revoga o consentimento)."""
        ...

    async def get_accounts(self, item_id: str) -> list[dict]:
        """Contas bancárias/cartões vinculados ao item."""
        ...

    async def get_transactions(self, account_id: str, from_date: date) -> list[dict]:
        """Transações da conta a partir de from_date."""
        ...

    def verify_webhook(self, signature: str | None, body: bytes) -> bool:
        """Valida a assinatura do webhook do provedor. Fail-closed sem segredo."""
        ...
