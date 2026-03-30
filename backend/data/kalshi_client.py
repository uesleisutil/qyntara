"""
Cliente para Kalshi API (dados públicos via elections endpoint).

Estratégia: buscar eventos primeiro, depois mercados em paralelo.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2"


class KalshiClient:
    def __init__(self):
        self.client = httpx.AsyncClient(
            base_url=KALSHI_BASE,
            timeout=15.0,
            headers={"Accept": "application/json"},
        )

    async def close(self):
        await self.client.aclose()

    async def _fetch_event_markets(self, event: dict) -> list[dict]:
        """Busca mercados de um evento e enriquece com dados do evento."""
        ticker = event.get("event_ticker", "")
        if not ticker:
            return []
        try:
            resp = await self.client.get("/markets", params={"event_ticker": ticker, "limit": 50})
            resp.raise_for_status()
            markets = resp.json().get("markets", [])
            for m in markets:
                m["_event_title"] = event.get("title", "")
                m["_event_category"] = event.get("category", "")
            return [m for m in markets if float(m.get("volume_fp", "0") or "0") > 0]
        except Exception:
            return []

    async def get_markets(self, limit: int = 200, **kwargs) -> list[dict]:
        """Busca mercados via eventos em paralelo."""
        try:
            resp = await self.client.get("/events", params={"limit": 50, "status": "open"})
            resp.raise_for_status()
            events = resp.json().get("events", [])

            # Buscar mercados de todos os eventos em paralelo (max 25)
            tasks = [self._fetch_event_markets(ev) for ev in events[:25]]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            all_markets: list[dict] = []
            for r in results:
                if isinstance(r, list):
                    all_markets.extend(r)

            logger.info(f"Kalshi: {len(all_markets)} markets with volume from {len(events)} events")
            return all_markets[:limit]
        except Exception as e:
            logger.warning(f"Kalshi error: {e}")
            return []


def parse_kalshi_market(raw: dict) -> dict:
    """Normaliza dados de um mercado Kalshi pro formato interno."""
    last_price_str = raw.get("last_price_dollars", "0") or "0"
    try:
        yes_price = float(last_price_str)
    except (ValueError, TypeError):
        yes_price = 0.0
    if yes_price > 1:
        yes_price = yes_price / 100.0
    no_price = max(0, 1.0 - yes_price)

    def _f(val):
        try:
            return float(val or "0")
        except (ValueError, TypeError):
            return 0.0

    volume = _f(raw.get("volume_fp", raw.get("volume", 0)))
    volume_24h = _f(raw.get("volume_24h_fp", raw.get("volume_24h", 0)))
    liquidity = _f(raw.get("open_interest_fp", raw.get("open_interest", 0)))

    title = raw.get("yes_sub_title", "") or raw.get("title", "")
    event_title = raw.get("_event_title", "")
    if event_title and title and title != event_title:
        question = f"{event_title}: {title}"[:200]
    else:
        question = (event_title or title)[:200]

    return {
        "source": "kalshi",
        "market_id": raw.get("ticker", ""),
        "question": question,
        "description": raw.get("rules_primary", ""),
        "category": raw.get("_event_category", ""),
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
