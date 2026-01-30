from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import boto3

from ml.src.runtime_config import load_runtime_config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
cw = boto3.client("cloudwatch")


@dataclass(frozen=True)
class Settings:
    bucket: str
    horizon_days: int


def list_latest_reco_key(bucket: str, dt: str) -> str | None:
    prefix = f"recommendations/dt={dt}/top"
    resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
    items = resp.get("Contents", [])
    if not items:
        return None
    items.sort(key=lambda x: x["LastModified"], reverse=True)
    return items[0]["Key"]


def read_json(bucket: str, key: str) -> dict[str, Any]:
    obj = s3.get_object(Bucket=bucket, Key=key)
    return json.loads(obj["Body"].read().decode("utf-8"))


def put_metric(mape: float) -> None:
    cw.put_metric_data(
        Namespace="B3TR",
        MetricData=[
            {
                "MetricName": "ModelMAPE",
                "Timestamp": datetime.now(UTC),
                "Value": float(mape),
                "Unit": "None",
            }
        ],
    )


def put_report(bucket: str, now: datetime, report: dict[str, Any]) -> str:
    dt = now.strftime("%Y-%m-%d")
    ts = now.strftime("%H%M%S")
    key = f"monitoring/model_quality/dt={dt}/quality_{ts}.json"

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(report, indent=2).encode("utf-8"),
        ContentType="application/json",
    )
    return key


def handler(event, context):
    cfg = load_runtime_config()
    s = Settings(bucket=cfg.bucket, horizon_days=cfg.prediction_length)

    now = datetime.now(UTC)
    dt_today = now.date().isoformat()
    dt_back = (now.date() - timedelta(days=s.horizon_days)).isoformat()

    # tenta achar recomendação de dt_back para avaliar hoje
    reco_key = list_latest_reco_key(s.bucket, dt_back)
    if not reco_key:
        report = {
            "ts_utc": now.isoformat(),
            "ok": True,
            "skipped": True,
            "reason": "no_recommendations_to_evaluate",
            "dt_eval": dt_today,
            "dt_origin": dt_back,
        }
        report_key = put_report(s.bucket, now, report)
        return {"ok": True, "skipped": True, "report_key": report_key}

    reco = read_json(s.bucket, reco_key)

    # Placeholder: aqui entraria o cálculo real do MAPE comparando
    # pred_price_t_plus_20 vs close real em dt_today para cada ticker
    # (quando você tiver essa truth disponível em curated/daily).
    mape = 0.0

    put_metric(mape)
    report = {
        "ts_utc": now.isoformat(),
        "ok": True,
        "skipped": False,
        "dt_eval": dt_today,
        "dt_origin": dt_back,
        "reco_key": reco_key,
        "mape": mape,
        "note": "MAPE placeholder. Implementar truth lookup em curated/daily.",
        "top_n": reco.get("top_n"),
    }
    report_key = put_report(s.bucket, now, report)
    return {"ok": True, "skipped": False, "report_key": report_key, "mape": mape}
