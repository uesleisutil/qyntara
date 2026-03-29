"""
Cliente para Kalshi API (dados públicos, sem auth necessária para leitura).

Docs: https://docs.kalshi.com
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2"


class KalshiClient:
    """Cliente REST para Kalshi (dados públicos)."""

    def __init__(self):
        self.client = httpx.AsyncClient(
            base_url=KALSHI_BASE,
            timeout=15.0,
            headers={"Accept": "application/json"},
        )

    async def close(self):
        await self.client.aclose()

    async def get_events(self, limit: int = 50, status: str = "open") -> list[dict]:
        """Lista eventos ativos."""
        resp = await self.client.get(
            "/events", params={"limit": limit, "status": status}
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("events", [])

    async def get_markets(
        self, event_ticker: str | None = None, limit: int = 100, status: str = "open"
    ) -> list[dict]:
        """Lista mercados. Opcionalmente filtra por evento."""
        params: dict = {"limit": limit, "status": status}
        if event_ticker:
            params["event_ticker"] = event_ticker
        resp = await self.client.get("/markets", params=params)
        resp.raise_for_status()
        data = resp.json()
        return data.get("markets", [])

    async def get_market(self, ticker: str) -> dict:
        """Detalhes de um mercado específico."""
        resp = await self.client.get(f"/markets/{ticker}")
        resp.raise_for_status()
        return resp.json().get("market", {})

    async def get_orderbook(self, ticker: str) -> dict:
        """Order book de um mercado."""
        resp = await self.client.get(f"/orderbook/{ticker}")
        resp.raise_for_status()
        return resp.json().get("orderbook", {})

    async def get_trades(self, ticker: str, limit: int = 100) -> list[dict]:
        """Trades recentes de um mercado."""
        resp = await self.client.get(
            "/trades", params={"ticker": ticker, "limit": limit}
        )
        resp.raise_for_status()
        return resp.json().get("trades", [])


def parse_kalshi_market(raw: dict) -> dict:
    """Normaliza dados de um mercado Kalshi pro formato interno."""
    yes_price = raw.get("yes_ask", raw.get("last_price", 0)) / 100.0
    no_price = 1.0 - yes_price

    return {
        "source": "kalshi",
        "market_id": raw.get("ticker", ""),
        "question": raw.get("title", raw.get("subtitle", "")),
        "description": raw.get("rules_primary", ""),
        "category": raw.get("category", ""),
        "yes_price": yes_price,
        "no_price": no_price,
        "volume": float(raw.get("volume", 0)),
        "volume_24h": float(raw.get("volume_24h", 0)),
        "liquidity": float(raw.get("open_interest", 0)),
        "end_date": raw.get("close_time", ""),
        "active": raw.get("status") == "open",
        "closed": raw.get("status") == "closed",
        "resolved": raw.get("status") == "settled",
        "resolution": raw.get("result", None),
        "outcomes": ["Yes", "No"],
        "tokens": [],
        "slug": raw.get("ticker", ""),
        "updated_at": raw.get("last_price_time", datetime.now(timezone.utc).isoformat()),
        "raw": raw,
    }
