"""Resolve o provedor de Open Finance ativo (settings.OPEN_FINANCE_PROVIDER)."""
from functools import lru_cache

from app.core.config import settings
from app.integrations.openfinance.base import OpenFinanceProvider


@lru_cache(maxsize=4)
def _build(provider_name: str) -> OpenFinanceProvider:
    if provider_name == "pluggy":
        from app.integrations.pluggy import pluggy_client

        return pluggy_client
    if provider_name == "polp":
        from app.integrations.openfinance.polp import PolpProvider

        return PolpProvider()
    if provider_name == "belvo":
        from app.integrations.openfinance.belvo import BelvoProvider

        return BelvoProvider()
    if provider_name == "celcoin":
        from app.integrations.openfinance.celcoin import CelcoinProvider

        return CelcoinProvider()
    raise ValueError(f"Provedor de Open Finance desconhecido: {provider_name!r}")


def get_provider() -> OpenFinanceProvider:
    return _build(settings.OPEN_FINANCE_PROVIDER)
