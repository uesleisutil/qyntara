"""
Polymarket CLOB WebSocket — preços em tempo real.

Conecta ao WebSocket do Polymarket e recebe updates de preço/volume
para todos os mercados monitorados.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable

import websockets

logger = logging.getLogger(__name__)

CLOB_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market"


class PolymarketWebSocket:
    """Listener de preços em tempo real via WebSocket."""

    def __init__(self, on_update: Callable[[dict], Any] | None = None):
        self.on_update = on_update
        self._ws = None
        self._running = False
        self._subscribed_tokens: set[str] = set()

    async def connect(self):
        """Conecta e mantém conexão com reconnect automático."""
        self._running = True
        while self._running:
            try:
                async with websockets.connect(CLOB_WS_URL, ping_interval=30) as ws:
                    self._ws = ws
                    logger.info("Polymarket WebSocket connected")

                    # Re-subscribe tokens
                    if self._subscribed_tokens:
                        await self._subscribe(list(self._subscribed_tokens))

                    async for message in ws:
                        try:
                            data = json.loads(message)
                            if self.on_update:
                                await self.on_update(data) if asyncio.iscoroutinefunction(self.on_update) else self.on_update(data)
                        except json.JSONDecodeError:
                            pass
            except Exception as e:
                if self._running:
                    logger.warning(f"WebSocket disconnected: {e}. Reconnecting in 5s...")
                    await asyncio.sleep(5)

    async def subscribe_markets(self, token_ids: list[str]):
        """Subscribe a updates de preço para tokens específicos."""
        self._subscribed_tokens.update(token_ids)
        if self._ws:
            await self._subscribe(token_ids)

    async def _subscribe(self, token_ids: list[str]):
        if not self._ws:
            return
        # Polymarket WS aceita subscribe por asset_id
        for batch_start in range(0, len(token_ids), 20):
            batch = token_ids[batch_start:batch_start + 20]
            msg = {"type": "subscribe", "channel": "market", "assets_ids": batch}
            try:
                await self._ws.send(json.dumps(msg))
            except Exception as e:
                logger.warning(f"Subscribe error: {e}")

    async def stop(self):
        self._running = False
        if self._ws:
            await self._ws.close()


class PriceTracker:
    """
    Mantém cache de preços em tempo real e detecta movimentos significativos.
    Alimenta o Anomaly Detector e o frontend via WebSocket.
    """

    def __init__(self):
        self.prices: dict[str, float] = {}  # token_id → last price
        self.volumes: dict[str, float] = {}
        self.price_history: dict[str, list[float]] = {}  # últimos 100 preços
        self.callbacks: list[Callable] = []

    def on_price_update(self, data: dict):
        """Processa update de preço do WebSocket."""
        market = data.get("market", "")
        price = data.get("price")
        if not market or price is None:
            # Tentar formato alternativo
            for event in data.get("events", [data]):
                asset_id = event.get("asset_id", "")
                p = event.get("price")
                if asset_id and p is not None:
                    self._update(asset_id, float(p))
            return
        self._update(market, float(price))

    def _update(self, token_id: str, price: float):
        old_price = self.prices.get(token_id)
        self.prices[token_id] = price

        # Manter histórico (últimos 100)
        if token_id not in self.price_history:
            self.price_history[token_id] = []
        self.price_history[token_id].append(price)
        if len(self.price_history[token_id]) > 100:
            self.price_history[token_id] = self.price_history[token_id][-100:]

        # Detectar movimento significativo (>5% em um update)
        if old_price and abs(price - old_price) / max(old_price, 0.01) > 0.05:
            for cb in self.callbacks:
                try:
                    cb({
                        "type": "significant_move",
                        "token_id": token_id,
                        "old_price": old_price,
                        "new_price": price,
                        "change_pct": (price - old_price) / old_price,
                    })
                except Exception:
                    pass

    def get_snapshot(self) -> dict:
        return {"prices": dict(self.prices), "count": len(self.prices)}
