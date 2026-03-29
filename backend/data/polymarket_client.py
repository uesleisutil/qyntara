"""
Cliente para Polymarket Gamma API + CLOB WebSocket.

Gamma API: dados de mercados, eventos, preços (REST, sem auth, 60 req/min).
CLOB API: order book, trades em tempo real (WebSocket, sem rate limit).

Docs: https://docs.polymarket.com
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

GAMMA_BASE = "https://gamma-api.polymarket.com"
CLOB_BASE = "https://clob.polymarket.com"
CLOB_WS = "wss://ws-subscriptions-clob.polymarket.com/ws/market"


class PolymarketClient:
    """Cliente REST para Polymarket Gamma API."""

    def __init__(self):
        self.client = httpx.AsyncClient(
            base_url=GAMMA_BASE,
            timeout=15.0,
            headers={"Accept": "application/json"},
        )

    async def close(self):
        await self.client.aclose()

    async def get_active_markets(self, limit: int = 100, offset: int = 0) -> list[dict]:
        """Lista mercados ativos e abertos."""
        resp = await self.client.get(
            "/markets",
            params={"active": "true", "closed": "false", "limit": limit, "offset": offset},
        )
        resp.raise_for_status()
        return resp.json()

    async def get_events(self, limit: int = 50) -> list[dict]:
        """Lista eventos (agrupam múltiplos mercados)."""
        resp = await self.client.get("/events", params={"limit": limit, "active": "true"})
        resp.raise_for_status()
        return resp.json()

    async def get_market(self, condition_id: str) -> dict:
        """Detalhes de um mercado específico."""
        resp = await self.client.get(f"/markets/{condition_id}")
        resp.raise_for_status()
        return resp.json()

    async def get_market_prices(self, token_id: str) -> dict:
        """Preço atual de um token (YES/NO)."""
        resp = await self.client.get(
            f"{CLOB_BASE}/price", params={"token_id": token_id, "side": "buy"}
        )
        resp.raise_for_status()
        return resp.json()

    async def get_market_history(self, condition_id: str, fidelity: int = 60) -> list[dict]:
        """Histórico de preços de um mercado. fidelity em minutos."""
        resp = await self.client.get(
            f"/markets/{condition_id}/timeseries",
            params={"fidelity": fidelity},
        )
        resp.raise_for_status()
        return resp.json()

    async def search_markets(self, query: str, limit: int = 20) -> list[dict]:
        """Busca textual em mercados."""
        resp = await self.client.get(
            "/markets", params={"tag": query, "limit": limit, "active": "true"}
        )
        resp.raise_for_status()
        return resp.json()

    async def get_all_active_markets(self) -> list[dict]:
        """Carrega TODOS os mercados ativos (paginado)."""
        all_markets = []
        offset = 0
        while True:
            batch = await self.get_active_markets(limit=100, offset=offset)
            if not batch:
                break
            all_markets.extend(batch)
            offset += len(batch)
            if len(batch) < 100:
                break
        logger.info(f"Polymarket: {len(all_markets)} mercados ativos carregados")
        return all_markets


def parse_market(raw: dict) -> dict:
    """Normaliza dados de um mercado Polymarket pro formato interno."""
    outcomes = raw.get("outcomes", ["Yes", "No"])
    prices = raw.get("outcomePrices", [])

    # outcomePrices pode vir como string JSON
    if isinstance(prices, str):
        try:
            import json
            prices = json.loads(prices)
        except (json.JSONDecodeError, TypeError):
            prices = []
    if isinstance(outcomes, str):
        try:
            import json
            outcomes = json.loads(outcomes)
        except (json.JSONDecodeError, TypeError):
            outcomes = ["Yes", "No"]

    try:
        yes_price = float(prices[0]) if prices else 0.0
    except (ValueError, TypeError):
        yes_price = 0.0
    try:
        no_price = float(prices[1]) if len(prices) > 1 else 1.0 - yes_price
    except (ValueError, TypeError):
        no_price = 1.0 - yes_price

    return {
        "source": "polymarket",
        "market_id": raw.get("conditionId", raw.get("id", "")),
        "question": raw.get("question", ""),
        "description": raw.get("description", ""),
        "category": raw.get("groupItemTitle", raw.get("category", "")),
        "yes_price": yes_price,
        "no_price": no_price,
        "volume": float(raw.get("volume", 0)),
        "volume_24h": float(raw.get("volume24hr", 0)),
        "liquidity": float(raw.get("liquidity", 0)),
        "end_date": raw.get("endDate", ""),
        "active": raw.get("active", False),
        "closed": raw.get("closed", False),
        "resolved": raw.get("resolved", False),
        "resolution": raw.get("resolution", None),
        "outcomes": outcomes,
        "tokens": raw.get("clobTokenIds", []),
        "slug": raw.get("slug", ""),
        "updated_at": raw.get("updatedAt", datetime.now(timezone.utc).isoformat()),
        "raw": raw,
    }
