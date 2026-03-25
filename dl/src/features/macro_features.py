"""
Features macroeconômicas do Banco Central do Brasil (BCB).

Selic, IPCA, câmbio USD/BRL, Ibovespa.
Esses fatores movem o mercado inteiro. Um modelo que não sabe que a Selic
subiu vai errar sistematicamente em ações de crescimento.

Fonte: API pública do BCB (SGS - Sistema Gerenciador de Séries Temporais)
https://dadosabertos.bcb.gov.br/
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional

import boto3
import requests

logger = logging.getLogger(__name__)

s3 = boto3.client("s3")

# Códigos das séries no SGS do BCB
BCB_SERIES = {
    "selic_meta": 432,       # Taxa Selic Meta (% a.a.)
    "selic_diaria": 11,      # Taxa Selic diária
    "ipca_mensal": 433,      # IPCA mensal (%)
    "cambio_usd_brl": 1,    # Câmbio USD/BRL (PTAX venda)
    "ibovespa": 7,           # Ibovespa (pontos)
    "cdi_diario": 12,        # CDI diário
}


def fetch_bcb_series(series_code: int, days: int = 90) -> list[Dict]:
    """
    Busca série temporal do BCB via API pública SGS.

    Args:
        series_code: Código da série no SGS
        days: Número de dias de histórico

    Returns:
        Lista de dicts com {data, valor}
    """
    end = datetime.now()
    start = end - timedelta(days=days)

    url = (
        f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{series_code}"
        f"/dados?formato=json"
        f"&dataInicial={start.strftime('%d/%m/%Y')}"
        f"&dataFinal={end.strftime('%d/%m/%Y')}"
    )

    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"BCB series {series_code}: HTTP {resp.status_code}")
            return []
        return resp.json()
    except Exception as e:
        logger.error(f"Erro ao buscar BCB series {series_code}: {e}")
        return []


def fetch_all_macro_data(days: int = 90) -> Dict[str, list[Dict]]:
    """Busca todas as séries macro do BCB."""
    result = {}
    for name, code in BCB_SERIES.items():
        data = fetch_bcb_series(code, days)
        result[name] = data
        logger.info(f"BCB {name} (code={code}): {len(data)} pontos")
    return result


def calculate_macro_features(macro_data: Dict[str, list[Dict]]) -> Dict[str, float]:
    """
    Calcula features macroeconômicas a partir dos dados do BCB.

    Args:
        macro_data: Dict retornado por fetch_all_macro_data

    Returns:
        Dict com features macro numéricas
    """
    features: Dict[str, float] = {}

    # --- Selic ---
    selic = _latest_value(macro_data.get("selic_meta", []))
    features["m_selic_meta"] = selic if selic is not None else 0.0

    selic_diaria = _latest_value(macro_data.get("selic_diaria", []))
    features["m_selic_diaria"] = selic_diaria if selic_diaria is not None else 0.0

    # Variação da Selic (últimos 30 dias)
    features["m_selic_change_30d"] = _series_change(macro_data.get("selic_meta", []), 30)

    # --- IPCA ---
    ipca = _latest_value(macro_data.get("ipca_mensal", []))
    features["m_ipca_mensal"] = ipca if ipca is not None else 0.0

    # Juro real = Selic - IPCA (anualizado)
    if features["m_selic_meta"] > 0 and features["m_ipca_mensal"] != 0:
        ipca_anual = features["m_ipca_mensal"] * 12  # proxy simples
        features["m_juro_real"] = features["m_selic_meta"] - ipca_anual
    else:
        features["m_juro_real"] = 0.0

    # --- Câmbio USD/BRL ---
    cambio = _latest_value(macro_data.get("cambio_usd_brl", []))
    features["m_cambio_usd_brl"] = cambio if cambio is not None else 0.0
    features["m_cambio_change_5d"] = _series_change(macro_data.get("cambio_usd_brl", []), 5)
    features["m_cambio_change_20d"] = _series_change(macro_data.get("cambio_usd_brl", []), 20)

    # Volatilidade do câmbio (20d)
    cambio_vals = _series_values(macro_data.get("cambio_usd_brl", []), 20)
    if len(cambio_vals) >= 5:
        import numpy as np
        returns = [(cambio_vals[i] / cambio_vals[i - 1]) - 1.0 for i in range(1, len(cambio_vals))]
        features["m_cambio_vol_20d"] = float(np.std(returns))
    else:
        features["m_cambio_vol_20d"] = 0.0

    # --- CDI ---
    cdi = _latest_value(macro_data.get("cdi_diario", []))
    features["m_cdi_diario"] = cdi if cdi is not None else 0.0

    return features


def save_macro_to_s3(bucket: str, macro_data: Dict, date_str: str) -> None:
    """Salva dados macro no Feature Store (S3)."""
    key = f"feature_store/macro/dt={date_str}/macro.json"
    # Serializar de forma segura
    serializable = {}
    for k, v in macro_data.items():
        serializable[k] = v if isinstance(v, list) else [v]
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(serializable).encode("utf-8"),
        ContentType="application/json",
    )


def load_macro_from_s3(bucket: str, date_str: str) -> Dict:
    """Carrega dados macro do Feature Store (S3)."""
    key = f"feature_store/macro/dt={date_str}/macro.json"
    try:
        obj = s3.get_object(Bucket=bucket, Key=key)
        return json.loads(obj["Body"].read().decode("utf-8"))
    except Exception:
        return {}


# --- Helpers ---

def _latest_value(series: list[Dict]) -> Optional[float]:
    """Retorna o valor mais recente de uma série BCB."""
    if not series:
        return None
    try:
        return float(series[-1]["valor"].replace(",", "."))
    except (KeyError, ValueError, IndexError):
        return None


def _series_change(series: list[Dict], lookback: int) -> float:
    """Calcula variação percentual nos últimos N pontos."""
    vals = _series_values(series, lookback + 1)
    if len(vals) < 2:
        return 0.0
    return (vals[-1] / vals[0]) - 1.0 if vals[0] != 0 else 0.0


def _series_values(series: list[Dict], n: int) -> list[float]:
    """Extrai últimos N valores numéricos de uma série BCB."""
    vals = []
    for item in series[-n:]:
        try:
            vals.append(float(item["valor"].replace(",", ".")))
        except (KeyError, ValueError):
            continue
    return vals
