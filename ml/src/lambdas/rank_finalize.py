from __future__ import annotations

import csv
import json
from datetime import UTC, datetime, timedelta
from statistics import pstdev

import boto3

from ml.src.runtime_config import load_runtime_config

s3 = boto3.client("s3")
sm = boto3.client("sagemaker")


def load_holidays(bucket: str, key: str) -> set[str]:
    obj = s3.get_object(Bucket=bucket, Key=key)
    payload = json.loads(obj["Body"].read().decode("utf-8"))
    return set(str(x) for x in payload.get("holidays", []))


def should_skip_today(now_utc: datetime, holidays: set[str]) -> bool:
    if now_utc.weekday() >= 5:
        return True
    return now_utc.date().isoformat() in holidays


def list_recent_daily_keys(bucket: str, days: int) -> list[str]:
    keys: list[str] = []
    today = datetime.now(UTC).date()
    for i in range(days):
        d = today - timedelta(days=i)
        key = f"curated/daily/dt={d.isoformat()}/daily.csv"
        try:
            s3.head_object(Bucket=bucket, Key=key)
            keys.append(key)
        except Exception:
            pass
    return list(reversed(keys))


def load_universe(bucket: str, key: str) -> list[str]:
    obj = s3.get_object(Bucket=bucket, Key=key)
    text = obj["Body"].read().decode("utf-8")
    out: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        out.append(line)
    return out


def accumulate_series(
    bucket: str,
    daily_keys: list[str],
    tickers: list[str],
) -> dict[str, list[float]]:
    wanted = set(tickers)
    series: dict[str, list[float]] = {t: [] for t in tickers}

    for key in daily_keys:
        obj = s3.get_object(Bucket=bucket, Key=key)
        lines = obj["Body"].read().decode("utf-8").splitlines()
        rdr = csv.DictReader(lines)

        day_map: dict[str, float] = {}
        for row in rdr:
            t = (row.get("ticker") or "").strip()
            if t not in wanted:
                continue
            try:
                day_map[t] = float(row["close"])
            except Exception:
                continue

        for t in tickers:
            if t in day_map:
                series[t].append(day_map[t])

    return {t: v for t, v in series.items() if len(v) >= 21}


def find_latest_run_key(bucket: str, dt: str) -> str | None:
    prefix = f"predictions/dt={dt}/run_"
    resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
    items = resp.get("Contents", [])
    if not items:
        return None
    items.sort(key=lambda x: x["LastModified"], reverse=True)
    return items[0]["Key"]


def read_json(bucket: str, key: str) -> dict:
    obj = s3.get_object(Bucket=bucket, Key=key)
    return json.loads(obj["Body"].read().decode("utf-8"))


def find_out_file(bucket: str, prefix: str) -> str:
    resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
    items = resp.get("Contents", [])
    if not items:
        raise RuntimeError("Sem output do transform no S3.")
    outs = [x["Key"] for x in items if x["Key"].endswith(".out")]
    return sorted(outs)[0] if outs else sorted([x["Key"] for x in items])[0]


def read_lines(bucket: str, key: str) -> list[str]:
    obj = s3.get_object(Bucket=bucket, Key=key)
    txt = obj["Body"].read().decode("utf-8").strip()
    return txt.splitlines() if txt else []


def vol_20(closes: list[float]) -> float | None:
    if len(closes) < 21:
        return None
    tail = closes[-21:]
    rets: list[float] = []
    for i in range(1, len(tail)):
        prev = tail[i - 1]
        cur = tail[i]
        if prev == 0:
            return None
        rets.append((cur / prev) - 1.0)
    v = pstdev(rets)
    return v if v > 0 else None


def put_json(bucket: str, key: str, payload: dict) -> None:
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(payload, indent=2).encode("utf-8"),
        ContentType="application/json",
    )


def handler(event, context):
    cfg = load_runtime_config()
    bucket = cfg.bucket

    now = datetime.now(UTC)
    dt = now.date().isoformat()

    holidays = load_holidays(bucket, cfg.holidays_s3_key)
    if should_skip_today(now, holidays):
        return {
            "ok": True,
            "skipped": True,
            "reason": "holiday_or_weekend",
            "dt": dt,
            "holidays_s3_key": cfg.holidays_s3_key,
        }

    run_key = find_latest_run_key(bucket, dt)
    if not run_key:
        return {"ok": True, "skipped": True, "reason": "no_run_for_dt", "dt": dt}

    run = read_json(bucket, run_key)

    transform_name = run["transform_job"]
    desc = sm.describe_transform_job(TransformJobName=transform_name)
    status = desc["TransformJobStatus"]
    if status != "Completed":
        raise RuntimeError(f"Transform job não completou: {status}")

    out_key = find_out_file(bucket, run["output_prefix"])
    out_lines = read_lines(bucket, out_key)

    order = read_json(bucket, run["order_key"])["order"]
    if len(out_lines) != len(order):
        raise RuntimeError(f"Mismatch: out={len(out_lines)} order={len(order)}")

    tickers = load_universe(bucket, cfg.universe_s3_key)
    daily_keys = list_recent_daily_keys(bucket, cfg.rank_lookback_days)
    series = accumulate_series(bucket, daily_keys, tickers)

    ranked: list[dict] = []

    for ticker, line in zip(order, out_lines, strict=True):
        pred = json.loads(line)
        mean = pred.get("mean")
        if not mean or len(mean) < cfg.prediction_length:
            continue

        pred_price = float(mean[cfg.prediction_length - 1])

        closes = series.get(ticker)
        if not closes:
            continue

        last_close = float(closes[-1])
        if last_close <= 0:
            continue

        exp_return = (pred_price / last_close) - 1.0
        v = vol_20(closes)
        if v is None:
            continue

        score = exp_return / v

        ranked.append(
            {
                "ticker": ticker,
                "last_close": last_close,
                "pred_price_t_plus_20": pred_price,
                "exp_return_20": exp_return,
                "vol_20d": v,
                "score": score,
            }
        )

    ranked.sort(key=lambda x: x["score"], reverse=True)
    top = ranked[: cfg.top_n]

    rec_key = f"recommendations/dt={dt}/top{cfg.top_n}.json"
    put_json(
        bucket,
        rec_key,
        {
            "dt": dt,
            "top_n": cfg.top_n,
            "run_id": run["run_id"],
            "transform_job": transform_name,
            "items": top,
            "holidays_s3_key": cfg.holidays_s3_key,
        },
    )

    return {"ok": True, "dt": dt, "recommendations_key": rec_key, "count": len(top)}
