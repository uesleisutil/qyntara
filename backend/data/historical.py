"""
Pipeline de dados históricos — coleta mercados resolvidos do Polymarket
para treinar o Edge Estimator.

Polymarket Gamma API retorna mercados fechados com resolution (YES/NO).
Coletamos: preço ao longo do tempo + volume + resultado final.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path

import httpx
import numpy as np

logger = logging.getLogger(__name__)

GAMMA_BASE = "https://gamma-api.polymarket.com"
DATA_DIR = Path("data/historical")


async def fetch_resolved_markets(limit: int = 500, offset: int = 0) -> list[dict]:
    """Busca mercados já resolvidos do Polymarket."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        all_markets = []
        current_offset = offset
        while len(all_markets) < limit:
            batch_size = min(100, limit - len(all_markets))
            resp = await client.get(
                f"{GAMMA_BASE}/markets",
                params={
                    "closed": "true",
                    "resolved": "true",
                    "limit": batch_size,
                    "offset": current_offset,
                    "order": "volume",
                    "ascending": "false",
                },
            )
            if resp.status_code != 200:
                logger.warning(f"Gamma API {resp.status_code}")
                break
            batch = resp.json()
            if not batch:
                break
            all_markets.extend(batch)
            current_offset += len(batch)
            if len(batch) < batch_size:
                break
        logger.info(f"Fetched {len(all_markets)} resolved markets")
        return all_markets


async def fetch_market_timeseries(condition_id: str, fidelity: int = 60) -> list[dict]:
    """Busca histórico de preços de um mercado (fidelity em minutos)."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{GAMMA_BASE}/markets/{condition_id}/timeseries",
            params={"fidelity": fidelity},
        )
        if resp.status_code != 200:
            return []
        return resp.json()


def parse_resolved_market(raw: dict) -> dict | None:
    """Extrai dados de treino de um mercado resolvido."""
    resolution = raw.get("resolution")
    if resolution is None:
        return None

    prices = raw.get("outcomePrices", [])
    if not prices:
        return None

    yes_price = float(prices[0]) if prices else 0.5
    volume = float(raw.get("volume", 0))

    if volume < 1000:  # Filtrar mercados com pouca liquidez
        return None

    return {
        "condition_id": raw.get("conditionId", ""),
        "question": raw.get("question", ""),
        "category": raw.get("groupItemTitle", raw.get("category", "")),
        "final_yes_price": yes_price,
        "volume": volume,
        "volume_24h": float(raw.get("volume24hr", 0)),
        "liquidity": float(raw.get("liquidity", 0)),
        "resolution": resolution,  # "Yes" ou "No"
        "outcome": 1.0 if resolution.lower() == "yes" else 0.0,
        "end_date": raw.get("endDate", ""),
        "created_at": raw.get("createdAt", ""),
        "closed_at": raw.get("closedAt", ""),
    }


def build_training_sample(market: dict, timeseries: list[dict]) -> dict | None:
    """
    Constrói uma amostra de treino a partir de um mercado resolvido + seu histórico.

    Pega snapshots em diferentes momentos antes do fechamento e usa o outcome real como target.
    Isso treina o modelo a estimar probabilidade em qualquer ponto da vida do mercado.
    """
    if not timeseries or len(timeseries) < 10:
        return None

    # Extrair preços do timeseries
    prices = []
    for point in timeseries:
        p = point.get("price", point.get("yes", None))
        if p is not None:
            prices.append(float(p))

    if len(prices) < 10:
        return None

    # Pegar snapshot no meio da vida do mercado (50% do caminho)
    mid = len(prices) // 2
    snapshot_price = prices[mid]

    # Features do snapshot
    prices_before = prices[:mid + 1]
    momentum_short = prices_before[-1] - prices_before[-2] if len(prices_before) >= 2 else 0
    momentum_long = prices_before[-1] - prices_before[0] if len(prices_before) >= 2 else 0
    volatility = float(np.std(prices_before[-24:])) if len(prices_before) >= 24 else float(np.std(prices_before))
    time_progress = mid / len(prices)  # 0 = início, 1 = fim

    return {
        "yes_price": snapshot_price,
        "volume_log": np.log1p(market["volume"]),
        "volume_24h_log": np.log1p(market["volume_24h"]),
        "liquidity_log": np.log1p(market["liquidity"]),
        "time_remaining": 1.0 - time_progress,
        "momentum_short": momentum_short,
        "momentum_long": momentum_long,
        "volatility": volatility,
        "spread": 0.0,  # Não temos bid/ask histórico
        "sentiment_score": 0.0,  # Sem sentiment histórico
        "sentiment_magnitude": 0.0,
        "article_count_log": 0.0,
        "outcome": market["outcome"],  # Target: 1.0 (YES) ou 0.0 (NO)
    }


async def collect_training_data(n_markets: int = 500) -> list[dict]:
    """
    Pipeline completo: busca mercados resolvidos, coleta timeseries, gera amostras de treino.
    """
    logger.info(f"Collecting training data from {n_markets} resolved markets...")

    raw_markets = await fetch_resolved_markets(limit=n_markets)
    parsed = [parse_resolved_market(m) for m in raw_markets]
    parsed = [m for m in parsed if m is not None]
    logger.info(f"Parsed {len(parsed)} valid resolved markets")

    samples = []
    for i, market in enumerate(parsed):
        try:
            ts = await fetch_market_timeseries(market["condition_id"])
            sample = build_training_sample(market, ts)
            if sample:
                samples.append(sample)
        except Exception as e:
            logger.warning(f"Error processing {market['condition_id']}: {e}")

        if (i + 1) % 50 == 0:
            logger.info(f"Processed {i + 1}/{len(parsed)} markets, {len(samples)} samples")

    logger.info(f"Training data collected: {len(samples)} samples from {len(parsed)} markets")
    return samples


def save_training_data(samples: list[dict], path: str | None = None):
    """Salva dados de treino em JSON."""
    if path is None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        path = str(DATA_DIR / f"training_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")

    with open(path, "w") as f:
        json.dump(samples, f, indent=2)
    logger.info(f"Training data saved to {path} ({len(samples)} samples)")
    return path


def load_training_data(path: str | None = None) -> list[dict]:
    """Carrega dados de treino mais recentes."""
    if path:
        with open(path) as f:
            return json.load(f)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(DATA_DIR.glob("training_*.json"), reverse=True)
    if not files:
        return []
    with open(files[0]) as f:
        data = json.load(f)
    logger.info(f"Loaded {len(data)} training samples from {files[0]}")
    return data
