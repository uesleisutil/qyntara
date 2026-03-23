"""
Features baseadas em Volume.

Volume é um dos melhores indicadores de convicção de movimento.
Sem volume, o modelo não sabe se uma alta é com força ou sem liquidez.
"""

from __future__ import annotations

import numpy as np
from typing import Dict


def calculate_volume_features(volumes: np.ndarray, prices: np.ndarray) -> Dict[str, float]:
    """
    Calcula features derivadas de volume diário.

    Args:
        volumes: Array de volumes históricos (mesmo tamanho que prices)
        prices: Array de preços de fechamento

    Returns:
        Dict com features de volume
    """
    features: Dict[str, float] = {}

    if len(volumes) < 2 or len(prices) < 2:
        return _default_volume_features()

    # --- Médias móveis de volume ---
    for period in (5, 10, 20):
        if len(volumes) >= period:
            features[f"vol_ma_{period}"] = float(np.mean(volumes[-period:]))
        else:
            features[f"vol_ma_{period}"] = float(np.mean(volumes))

    # Volume relativo (hoje / média 20d)
    ma20 = features.get("vol_ma_20", np.mean(volumes))
    features["volume_relative"] = float(volumes[-1] / ma20) if ma20 > 0 else 1.0

    # --- OBV (On-Balance Volume) simplificado ---
    obv = 0.0
    for i in range(1, min(len(volumes), len(prices))):
        if prices[i] > prices[i - 1]:
            obv += volumes[i]
        elif prices[i] < prices[i - 1]:
            obv -= volumes[i]
    features["obv"] = float(obv)

    # OBV slope (tendência do OBV nos últimos 20 dias)
    if len(volumes) >= 21 and len(prices) >= 21:
        obv_series = _obv_series(volumes[-21:], prices[-21:])
        x = np.arange(len(obv_series))
        if len(x) > 1:
            slope = np.polyfit(x, obv_series, 1)[0]
            features["obv_slope_20d"] = float(slope)
        else:
            features["obv_slope_20d"] = 0.0
    else:
        features["obv_slope_20d"] = 0.0

    # --- VWAP proxy (Volume-Weighted Average Price) ---
    if len(volumes) >= 20 and len(prices) >= 20:
        recent_v = volumes[-20:]
        recent_p = prices[-20:]
        total_vol = np.sum(recent_v)
        features["vwap_20d"] = float(np.sum(recent_p * recent_v) / total_vol) if total_vol > 0 else float(prices[-1])
        features["price_vs_vwap"] = float(prices[-1] / features["vwap_20d"] - 1.0) if features["vwap_20d"] > 0 else 0.0
    else:
        features["vwap_20d"] = float(prices[-1])
        features["price_vs_vwap"] = 0.0

    # --- Volume trend (aceleração) ---
    if len(volumes) >= 10:
        vol_5d = np.mean(volumes[-5:])
        vol_10d = np.mean(volumes[-10:])
        features["volume_acceleration"] = float(vol_5d / vol_10d - 1.0) if vol_10d > 0 else 0.0
    else:
        features["volume_acceleration"] = 0.0

    # --- Volume-price divergence ---
    # Alta de preço com queda de volume = sinal fraco
    if len(volumes) >= 5 and len(prices) >= 5:
        price_change = (prices[-1] / prices[-5]) - 1.0
        vol_change = (np.mean(volumes[-5:]) / np.mean(volumes[-10:-5])) - 1.0 if len(volumes) >= 10 else 0.0
        features["volume_price_divergence"] = float(price_change - vol_change)
    else:
        features["volume_price_divergence"] = 0.0

    # --- Volume spike (volume anormalmente alto) ---
    if len(volumes) >= 20:
        vol_std = np.std(volumes[-20:])
        vol_mean = np.mean(volumes[-20:])
        features["volume_zscore"] = float((volumes[-1] - vol_mean) / vol_std) if vol_std > 0 else 0.0
    else:
        features["volume_zscore"] = 0.0

    return features


def _obv_series(volumes: np.ndarray, prices: np.ndarray) -> np.ndarray:
    """Calcula série OBV completa."""
    obv = np.zeros(len(volumes))
    for i in range(1, len(volumes)):
        if prices[i] > prices[i - 1]:
            obv[i] = obv[i - 1] + volumes[i]
        elif prices[i] < prices[i - 1]:
            obv[i] = obv[i - 1] - volumes[i]
        else:
            obv[i] = obv[i - 1]
    return obv


def _default_volume_features() -> Dict[str, float]:
    """Retorna features de volume com valores default."""
    return {
        "vol_ma_5": 0.0,
        "vol_ma_10": 0.0,
        "vol_ma_20": 0.0,
        "volume_relative": 1.0,
        "obv": 0.0,
        "obv_slope_20d": 0.0,
        "vwap_20d": 0.0,
        "price_vs_vwap": 0.0,
        "volume_acceleration": 0.0,
        "volume_price_divergence": 0.0,
        "volume_zscore": 0.0,
    }
