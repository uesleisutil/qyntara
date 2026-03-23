"""
Features fundamentalistas via BRAPI.

P/L, P/VP, dividend yield, ROE, dívida/EBITDA.
Ações baratas por fundamento + momentum técnico é uma combinação poderosa.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

import boto3
import requests

logger = logging.getLogger(__name__)

s3 = boto3.client("s3")


def fetch_fundamentals_brapi(ticker: str, token: str) -> Dict[str, Any]:
    """
    Busca dados fundamentalistas de um ticker via BRAPI.

    Args:
        ticker: Símbolo da ação (ex: PETR4)
        token: Token BRAPI

    Returns:
        Dict com indicadores fundamentalistas
    """
    url = f"https://brapi.dev/api/quote/{ticker}"
    params = {"token": token, "fundamental": "true"}

    try:
        resp = requests.get(url, params=params, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"BRAPI fundamentals {ticker}: HTTP {resp.status_code}")
            return {}

        data = resp.json()
        results = data.get("results", [])
        if not results:
            return {}

        r = results[0]
        summary = r.get("summaryProfile", {}) or {}
        financial = r.get("financialData", {}) or {}
        default_key = r.get("defaultKeyStatistics", {}) or {}

        return {
            "pe_ratio": _safe_float(r.get("priceEarnings")),
            "pb_ratio": _safe_float(r.get("priceToBook") or default_key.get("priceToBook")),
            "dividend_yield": _safe_float(r.get("dividendYield") or default_key.get("dividendYield")),
            "roe": _safe_float(financial.get("returnOnEquity")),
            "debt_to_ebitda": _safe_float(financial.get("debtToEquity")),  # proxy
            "earnings_growth": _safe_float(financial.get("earningsGrowth")),
            "revenue_growth": _safe_float(financial.get("revenueGrowth")),
            "profit_margin": _safe_float(financial.get("profitMargins")),
            "market_cap": _safe_float(r.get("marketCap")),
            "sector": summary.get("sector", "Unknown"),
        }
    except Exception as e:
        logger.error(f"Erro ao buscar fundamentals {ticker}: {e}")
        return {}


def calculate_fundamental_features(fundamentals: Dict[str, Any]) -> Dict[str, float]:
    """
    Transforma dados fundamentalistas em features numéricas para o modelo.

    Args:
        fundamentals: Dict retornado por fetch_fundamentals_brapi

    Returns:
        Dict com features numéricas
    """
    features: Dict[str, float] = {}

    pe = fundamentals.get("pe_ratio")
    features["f_pe_ratio"] = pe if pe is not None else 0.0
    # P/L invertido (earnings yield) — mais útil para modelos
    features["f_earnings_yield"] = (1.0 / pe) if pe and pe > 0 else 0.0

    pb = fundamentals.get("pb_ratio")
    features["f_pb_ratio"] = pb if pb is not None else 0.0

    dy = fundamentals.get("dividend_yield")
    features["f_dividend_yield"] = dy if dy is not None else 0.0

    roe = fundamentals.get("roe")
    features["f_roe"] = roe if roe is not None else 0.0

    debt = fundamentals.get("debt_to_ebitda")
    features["f_debt_to_ebitda"] = debt if debt is not None else 0.0

    eg = fundamentals.get("earnings_growth")
    features["f_earnings_growth"] = eg if eg is not None else 0.0

    rg = fundamentals.get("revenue_growth")
    features["f_revenue_growth"] = rg if rg is not None else 0.0

    pm = fundamentals.get("profit_margin")
    features["f_profit_margin"] = pm if pm is not None else 0.0

    mc = fundamentals.get("market_cap")
    features["f_log_market_cap"] = float(__import__("math").log(mc)) if mc and mc > 0 else 0.0

    # Score composto: value + quality
    features["f_value_score"] = (
        features["f_earnings_yield"] * 0.3
        + features["f_dividend_yield"] * 0.2
        + (1.0 / (features["f_pb_ratio"] + 1e-6)) * 0.2
        + features["f_roe"] * 0.15
        + features["f_profit_margin"] * 0.15
    )

    return features


def save_fundamentals_to_s3(
    bucket: str, ticker: str, fundamentals: Dict[str, Any], date_str: str
) -> None:
    """Salva dados fundamentalistas no Feature Store (S3)."""
    key = f"feature_store/fundamentals/dt={date_str}/{ticker}.json"
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(fundamentals).encode("utf-8"),
        ContentType="application/json",
    )


def load_fundamentals_from_s3(bucket: str, ticker: str, date_str: str) -> Dict[str, Any]:
    """Carrega dados fundamentalistas do Feature Store (S3)."""
    key = f"feature_store/fundamentals/dt={date_str}/{ticker}.json"
    try:
        obj = s3.get_object(Bucket=bucket, Key=key)
        return json.loads(obj["Body"].read().decode("utf-8"))
    except Exception:
        return {}


def _safe_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None
