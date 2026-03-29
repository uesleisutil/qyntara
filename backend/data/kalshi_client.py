"""
Cliente para Kalshi API (dados públicos via elections endpoint).

Estratégia: buscar eventos primeiro, depois mercados de cada evento.
A busca genérica /markets retorna lixo esportivo sem volume.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2"


class KalshiClient:
    def __init__(self):
        self.client = httpx.AsyncClient(
            base_url=KALSHI_BASE,
            timeout=20.0,
            headers={"Accept": "application/json"},
        )

    async def close(self):
        await self.client.aclose()

    async def get_markets(self, limit: int = 200, **kwargs) -> list[dict]:
        """Busca mercados via eventos pra pegar dados com volume real."""
        all_markets: list[dict] = []
        try:
            # 1. Buscar eventos ativos
            resp = await self.client.get("/events", params={"limit": 100, "status": "open"})
            resp.raise_for_status()
            events = resp.json().get("events", [])

            # 2. Pra cada evento, buscar mercados
            for event in events[:50]:  # limitar pra não demorar
                ticker = event.get("event_ticker", "")
                if not ticker:
                    continue
                try:
                    mresp = await self.client.get(
                        "/markets", params={"event_ticker": ticker, "limit": 50}
                    )
                    mresp.raise_for_status()
                    markets = mresp.json().get("markets", [])
                    for m in markets:
                        # Enriquecer com dados do evento
                        m["_event_title"] = event.get("title", "")
                        m["_event_category"] = event.get("category", "")
                    all_markets.extend(markets)
                except Exception as e:
                    logger.debug(f"Kalshi event {ticker}: {e}")
                    continue

            # Filtrar só mercados com volume
            with_volume = [m for m in all_markets if float(m.get("volume_fp", "0") or "0") > 0]
            logger.info(f"Kalshi: {len(with_volume)} markets with volume (from {len(all_markets)} total)")
            return with_volume[:limit]

        except Exception as e:
            logger.warning(f"Kalshi get_markets error: {e}")
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

    def _float(val):
        try:
            return float(val or "0")
        except (ValueError, TypeError):
            return 0.0

    volume = _float(raw.get("volume_fp", raw.get("volume", 0)))
    volume_24h = _float(raw.get("volume_24h_fp", raw.get("volume_24h", 0)))
    liquidity = _float(raw.get("open_interest_fp", raw.get("open_interest", 0)))

    # Usar yes_sub_title ou title do evento
    title = raw.get("yes_sub_title", "") or raw.get("title", "")
    event_title = raw.get("_event_title", "")
    if event_title and title and title != event_title:
        question = f"{event_title}: {title}"[:200]
    else:
        question = (event_title or title)[:200]

    category = raw.get("_event_category", "") or raw.get("category", "")

    return {
        "source": "kalshi",
        "market_id": raw.get("ticker", ""),
        "question": question,
        "description": raw.get("rules_primary", ""),
        "category": category,
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
