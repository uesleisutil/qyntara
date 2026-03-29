"""
Feature engineering para mercados de predição.

Transforma dados brutos (preço, volume, tempo, notícias) em features
numéricas para os modelos DL.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

import numpy as np


FEATURE_NAMES = [
    "yes_price", "volume_log", "volume_24h_log", "liquidity_log",
    "time_to_close_days", "price_momentum_1h", "price_momentum_24h",
    "price_volatility", "spread", "sentiment_score",
    "sentiment_magnitude", "article_count_log",
]


def extract_features(market: dict, history: list[dict] | None = None,
                     sentiment: dict | None = None) -> np.ndarray:
    """
    Extrai feature vector de um mercado.

    Args:
        market: dados normalizados do mercado (parse_market output)
        history: lista de snapshots históricos [{price, volume, timestamp}, ...]
        sentiment: output do SentimentScorer

    Returns:
        np.ndarray shape (n_features,)
    """
    yes_price = market.get("yes_price", 0.5)
    volume = max(market.get("volume", 0), 1)
    volume_24h = max(market.get("volume_24h", 0), 1)
    liquidity = max(market.get("liquidity", 0), 1)

    # Tempo até fechamento
    end_date = market.get("end_date", "")
    time_to_close = _days_until(end_date) if end_date else 30.0

    # Momentum e volatilidade do histórico
    momentum_1h = 0.0
    momentum_24h = 0.0
    volatility = 0.0
    if history and len(history) >= 2:
        prices = [h.get("price", h.get("yes_price", 0.5)) for h in history]
        if len(prices) >= 2:
            momentum_1h = prices[-1] - prices[-2]
        if len(prices) >= 24:
            momentum_24h = prices[-1] - prices[-24]
        if len(prices) >= 5:
            volatility = float(np.std(prices[-24:]))

    # Spread
    spread = abs(market.get("yes_price", 0.5) - market.get("no_price", 0.5)) - 1.0
    spread = max(spread, 0.0)

    # Sentiment
    sent = sentiment or {}
    sent_score = sent.get("sentiment_score", 0.0)
    sent_magnitude = sent.get("sentiment_magnitude", 0.0)
    article_count = max(sent.get("article_count", 0), 1)

    features = np.array([
        yes_price,
        math.log1p(volume),
        math.log1p(volume_24h),
        math.log1p(liquidity),
        min(time_to_close, 365.0) / 365.0,  # normalizado 0-1
        momentum_1h,
        momentum_24h,
        volatility,
        spread,
        sent_score,
        sent_magnitude,
        math.log1p(article_count),
    ], dtype=np.float32)

    return features


def extract_features_batch(markets: list[dict],
                           histories: dict[str, list] | None = None,
                           sentiments: dict[str, dict] | None = None) -> np.ndarray:
    """Extrai features para múltiplos mercados. Retorna (n_markets, n_features)."""
    histories = histories or {}
    sentiments = sentiments or {}

    features_list = []
    for m in markets:
        mid = m.get("market_id", "")
        hist = histories.get(mid)
        sent = sentiments.get(mid)
        features_list.append(extract_features(m, hist, sent))

    return np.stack(features_list) if features_list else np.empty((0, len(FEATURE_NAMES)))


def _days_until(date_str: str) -> float:
    """Calcula dias até uma data ISO."""
    try:
        target = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        delta = (target - now).total_seconds() / 86400.0
        return max(delta, 0.0)
    except (ValueError, TypeError):
        return 30.0
