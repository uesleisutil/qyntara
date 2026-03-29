"""
Cliente para Kalshi API (dados públicos via elections endpoint).

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

    async def get_markets(self, limit: int = 200, **kwargs) -> list[dict]:
        """Lista mercados ativos com volume."""
        try:
            resp = await self.client.get("/markets", params={"limit": limit})
            resp.raise_for_status()
            data = resp.json()
            markets = data.get("markets", [])
            # Filtrar só mercados com volume real
            return [m for m in markets if float(m.get("volume_fp", "0") or "0") > 0]
        except Exception as e:
            logger.warning(f"Kalshi get_markets error: {e}")
            return []

    async def get_events(self, limit: int = 50) -> list[dict]:
        """Lista eventos."""
        try:
            resp = await self.client.get("/events", params={"limit": limit})
            resp.raise_for_status()
            return resp.json().get("events", [])
        except Exception as e:
            logger.warning(f"Kalshi get_events error: {e}")
            return []


def parse_kalshi_market(raw: dict) -> dict:
    """Normaliza dados de um mercado Kalshi pro formato interno."""
    # Kalshi API v2 usa campos com _fp (floating point) e _dollars
    last_price_str = raw.get("last_price_dollars", "0") or "0"
    try:
        yes_price = float(last_price_str)
    except (ValueError, TypeError):
        yes_price = 0.0

    # Se preço é em centavos (> 1), converter
    if yes_price > 1:
        yes_price = yes_price / 100.0

    no_price = max(0, 1.0 - yes_price)

    volume_str = raw.get("volume_fp", "0") or raw.get("volume", "0") or "0"
    volume_24h_str = raw.get("volume_24h_fp", "0") or raw.get("volume_24h", "0") or "0"
    oi_str = raw.get("open_interest_fp", "0") or raw.get("open_interest", "0") or "0"

    try:
        volume = float(volume_str)
    except (ValueError, TypeError):
        volume = 0.0
    try:
        volume_24h = float(volume_24h_str)
    except (ValueError, TypeError):
        volume_24h = 0.0
    try:
        liquidity = float(oi_str)
    except (ValueError, TypeError):
        liquidity = 0.0

    title = raw.get("title", "") or raw.get("subtitle", "") or raw.get("ticker", "")

    return {
        "source": "kalshi",
        "market_id": raw.get("ticker", ""),
        "question": title[:200],
        "description": raw.get("rules_primary", ""),
        "category": raw.get("category", raw.get("event_ticker", "").split("-")[0] if raw.get("event_ticker") else ""),
        "yes_price": yes_price,
        "no_price": no_price,
        "volume": volume,
        "volume_24h": volume_24h,
        "liquidity": liquidity,
        "end_date": raw.get("close_time", raw.get("expiration_time", "")),
        "active": raw.get("status") in ("open", "active"),
        "closed": raw.get("status") in ("closed", "settled"),
        "resolved": raw.get("status") == "settled",
        "resolution": raw.get("result", None),
        "outcomes": ["Yes", "No"],
        "tokens": [],
        "slug": raw.get("ticker", ""),
        "updated_at": raw.get("last_price_time", datetime.now(timezone.utc).isoformat()),
    }
