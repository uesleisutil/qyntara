from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import boto3

from dl.src.runtime_config import load_runtime_config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
cw = boto3.client("cloudwatch")


@dataclass(frozen=True)
class Settings:
    bucket: str
    lookback_minutes: int


def list_recent_raw_prefixes(bucket: str, now: datetime, lookback_minutes: int) -> list[str]:
    """
    Procura em raw/quotes_5m/ nos últimos X minutos:
      raw/quotes_5m/dt=YYYY-MM-DD/hour=HH/min=MM/
    """
    prefixes: list[str] = []
    for i in range(lookback_minutes + 1):
        t = now - timedelta(minutes=i)
        dt = t.strftime("%Y-%m-%d")
        hh = t.strftime("%H")
        mm = t.strftime("%M")
        prefixes.append(f"raw/quotes_5m/dt={dt}/hour={hh}/min={mm}/")
    return prefixes


def any_object_under_prefix(bucket: str, prefix: str) -> bool:
    resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix, MaxKeys=1)
    return bool(resp.get("KeyCount", 0) > 0)


def put_metric(ok: bool) -> None:
    cw.put_metric_data(
        Namespace="B3TR",
        MetricData=[
            {
                "MetricName": "IngestionOK",
                "Timestamp": datetime.now(UTC),
                "Value": 1.0 if ok else 0.0,
                "Unit": "Count",
            }
        ],
    )


def put_report(bucket: str, now: datetime, report: dict[str, Any]) -> str:
    dt = now.strftime("%Y-%m-%d")
    ts = now.strftime("%H%M%S")
    key = f"monitoring/ingestion/dt={dt}/ingestion_{ts}.json"

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(report, indent=2).encode("utf-8"),
        ContentType="application/json",
    )
    return key


def handler(event, context):
    cfg = load_runtime_config()
    s = Settings(bucket=cfg.bucket, lookback_minutes=cfg.ingest_lookback_minutes)

    now = datetime.now(UTC)

    prefixes = list_recent_raw_prefixes(s.bucket, now, s.lookback_minutes)
    found_prefix = None
    for p in prefixes:
        if any_object_under_prefix(s.bucket, p):
            found_prefix = p
            break

    ok = found_prefix is not None
    put_metric(ok)

    report = {
        "ts_utc": now.isoformat(),
        "ok": ok,
        "lookback_minutes": s.lookback_minutes,
        "found_prefix": found_prefix,
    }
    report_key = put_report(s.bucket, now, report)

    return {
        "ok": ok,
        "skipped": False,
        "report_key": report_key,
        "found_prefix": found_prefix,
    }
