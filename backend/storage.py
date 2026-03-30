"""
Storage layer — S3 para dados de mercados, modelos e cache.

Bucket: predikt-data-{account_id}
Prefixes:
  cache/markets.json          — cache de mercados ativos
  cache/signals.json          — sinais gerados
  cache/arbitrage.json        — oportunidades de arbitragem
  historical/training_*.json  — dados de treino
  models/edge_estimator/      — modelo treinado (state, scaler, config)
  metrics/model_metrics.json  — métricas dos modelos
  audit/audit_log.json        — log de auditoria
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

BUCKET = "predikt-data-200093399689"
_s3 = None


def _get_s3():
    global _s3
    if not _s3:
        _s3 = boto3.client("s3", region_name="us-east-1")
    return _s3


def ensure_bucket():
    """Cria o bucket se não existir."""
    s3 = _get_s3()
    try:
        s3.head_bucket(Bucket=BUCKET)
    except ClientError:
        try:
            s3.create_bucket(Bucket=BUCKET)
            logger.info(f"Created bucket {BUCKET}")
        except ClientError as e:
            if "BucketAlreadyOwnedByYou" not in str(e):
                logger.error(f"Failed to create bucket: {e}")


# ── JSON read/write ──

def save_json(key: str, data: Any):
    """Salva JSON no S3."""
    try:
        _get_s3().put_object(
            Bucket=BUCKET, Key=key,
            Body=json.dumps(data, default=str, ensure_ascii=False),
            ContentType="application/json",
        )
    except Exception as e:
        logger.warning(f"S3 save failed ({key}): {e}")


def load_json(key: str) -> Any | None:
    """Carrega JSON do S3. Retorna None se não existir."""
    try:
        resp = _get_s3().get_object(Bucket=BUCKET, Key=key)
        return json.loads(resp["Body"].read().decode("utf-8"))
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchKey":
            return None
        logger.warning(f"S3 load failed ({key}): {e}")
        return None
    except Exception as e:
        logger.warning(f"S3 load failed ({key}): {e}")
        return None


# ── Cache de mercados ──

def save_market_cache(markets: list[dict], signals: list[dict], arbitrage: list[dict], stats: dict):
    """Salva cache completo de mercados no S3."""
    save_json("cache/markets.json", markets)
    save_json("cache/signals.json", signals)
    save_json("cache/arbitrage.json", arbitrage)
    save_json("cache/stats.json", stats)


def load_market_cache() -> dict:
    """Carrega cache de mercados do S3."""
    return {
        "markets": load_json("cache/markets.json") or [],
        "signals": load_json("cache/signals.json") or [],
        "arbitrage": load_json("cache/arbitrage.json") or [],
        "stats": load_json("cache/stats.json") or {},
    }


# ── Dados de treino ──

def save_training_data(samples: list[dict]) -> str:
    """Salva dados de treino no S3."""
    key = f"historical/training_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    save_json(key, samples)
    logger.info(f"Training data saved: s3://{BUCKET}/{key} ({len(samples)} samples)")
    return key


def load_latest_training_data() -> list[dict]:
    """Carrega dados de treino mais recentes do S3."""
    s3 = _get_s3()
    try:
        resp = s3.list_objects_v2(Bucket=BUCKET, Prefix="historical/training_")
        files = sorted(
            [obj["Key"] for obj in resp.get("Contents", [])],
            reverse=True,
        )
        if not files:
            return []
        return load_json(files[0]) or []
    except Exception as e:
        logger.warning(f"Failed to load training data: {e}")
        return []


# ── Modelo treinado ──

def save_model_artifact(local_path: str, s3_prefix: str = "models/edge_estimator"):
    """Upload de arquivos do modelo pro S3."""
    import os
    s3 = _get_s3()
    for fname in os.listdir(local_path):
        fpath = os.path.join(local_path, fname)
        if os.path.isfile(fpath):
            key = f"{s3_prefix}/{fname}"
            s3.upload_file(fpath, BUCKET, key)
            logger.info(f"Uploaded model artifact: {key}")


def download_model_artifact(local_path: str, s3_prefix: str = "models/edge_estimator") -> bool:
    """Download de arquivos do modelo do S3."""
    import os
    s3 = _get_s3()
    os.makedirs(local_path, exist_ok=True)
    try:
        resp = s3.list_objects_v2(Bucket=BUCKET, Prefix=s3_prefix)
        files = [obj["Key"] for obj in resp.get("Contents", [])]
        if not files:
            return False
        for key in files:
            fname = key.split("/")[-1]
            s3.download_file(BUCKET, key, os.path.join(local_path, fname))
        return True
    except Exception as e:
        logger.warning(f"Failed to download model: {e}")
        return False


# ── Métricas e audit ──

def save_model_metrics(metrics: dict):
    save_json("metrics/model_metrics.json", metrics)


def load_model_metrics() -> dict:
    return load_json("metrics/model_metrics.json") or {}


def append_audit_log(entry: dict):
    """Append ao audit log (carrega, adiciona, salva — max 500 entries)."""
    log = load_json("audit/audit_log.json") or []
    log.append(entry)
    if len(log) > 500:
        log = log[-500:]
    save_json("audit/audit_log.json", log)


def load_audit_log(limit: int = 100) -> list[dict]:
    log = load_json("audit/audit_log.json") or []
    return list(reversed(log[-limit:]))


# ── Price history (odds over time) ──

def save_price_snapshot(markets: list[dict]):
    """Salva snapshot de preços dos mercados. Um arquivo por dia, append."""
    today = datetime.now().strftime("%Y-%m-%d")
    key = f"history/prices_{today}.json"

    # Carregar snapshots existentes do dia
    existing = load_json(key) or []

    now = datetime.now().isoformat()
    snapshot = {
        "t": now,
        "p": {m["market_id"]: round(m.get("yes_price", 0), 4) for m in markets if m.get("market_id")},
    }
    existing.append(snapshot)

    # Limitar a 144 snapshots por dia (1 a cada 10 min)
    if len(existing) > 144:
        existing = existing[-144:]

    save_json(key, existing)


def load_price_history(market_id: str, days: int = 7) -> list[dict]:
    """Carrega histórico de preços de um mercado nos últimos N dias."""
    from datetime import timedelta
    history: list[dict] = []
    now = datetime.now()

    for i in range(days):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        key = f"history/prices_{day}.json"
        snapshots = load_json(key)
        if not snapshots:
            continue
        for snap in snapshots:
            price = snap.get("p", {}).get(market_id)
            if price is not None:
                history.append({"t": snap["t"], "p": price})

    history.sort(key=lambda x: x["t"])
    return history
