"""
Bootstrap incremental do histórico diário (1d) via BRAPI (ex: 10y).

- Roda em "chunks" (N tickers por invocação) pra não estourar timeout da Lambda.
- Guarda progresso em S3 (state.json).
- Quando terminar tudo, grava um marker "_BOOTSTRAP_DONE.json" e passa a pular.

Lê:
- Token BRAPI (Secrets Manager)
- Universe (S3: config/universe.txt)

Escreve:
- Curated mensal: curated/daily_monthly/year=YYYY/month=MM/daily.csv
- Estado: curated/daily_monthly/_bootstrap/state.json
- Marker final: curated/daily_monthly/_bootstrap/_BOOTSTRAP_DONE.json
"""

from __future__ import annotations

import json
import logging
import os
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import boto3
import pandas as pd
import urllib3

from ml.src.runtime_config import load_runtime_config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_http = urllib3.PoolManager()
s3 = boto3.client("s3")
secrets = boto3.client("secretsmanager")


@dataclass(frozen=True)
class BootstrapCfg:
    bucket: str
    universe_key: str
    secret_id: str
    history_range: str
    tickers_per_run: int
    sleep_s: float
    min_points: int


def _env_int(name: str, default: int) -> int:
    v = os.environ.get(name)
    if not v:
        return default
    return int(v)


def _env_float(name: str, default: float) -> float:
    v = os.environ.get(name)
    if not v:
        return default
    return float(v)


def _s3_exists(bucket: str, key: str) -> bool:
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except Exception:
        return False


def _read_s3_json(bucket: str, key: str) -> dict[str, Any]:
    obj = s3.get_object(Bucket=bucket, Key=key)
    return json.loads(obj["Body"].read().decode("utf-8"))


def _write_s3_json(bucket: str, key: str, payload: dict[str, Any]) -> None:
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"),
        ContentType="application/json",
    )


def _read_s3_text(bucket: str, key: str) -> str:
    obj = s3.get_object(Bucket=bucket, Key=key)
    return obj["Body"].read().decode("utf-8")


def _get_brapi_token(secret_id: str) -> str:
    resp = secrets.get_secret_value(SecretId=secret_id)
    secret_str = resp.get("SecretString") or ""
    token = json.loads(secret_str).get("token")
    if not token:
        raise RuntimeError("Secret BRAPI sem campo 'token'.")
    return token


def _load_universe(bucket: str, key: str) -> list[str]:
    txt = _read_s3_text(bucket, key)
    out: list[str] = []
    for line in txt.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        out.append(line)
    if not out:
        raise RuntimeError("Universe vazio no S3.")
    return out


def _brapi_history(ticker: str, token: str, range_: str) -> dict[str, Any]:
    url = f"https://brapi.dev/api/quote/{ticker}?range={range_}&interval=1d"
    headers = {"Authorization": f"Bearer {token}"}
    r = _http.request("GET", url, headers=headers, timeout=30.0, retries=False)
    if r.status >= 400:
        raise RuntimeError(f"BRAPI {ticker} HTTP {r.status}: {r.data[:200]}")
    return json.loads(r.data.decode("utf-8"))


def _iter_rows(payload: dict[str, Any], ticker: str) -> list[tuple[str, str, float]]:
    results = payload.get("results") or []
    if not results:
        return []
    hist = results[0].get("historicalDataPrice") or []
    rows: list[tuple[str, str, float]] = []
    for p in hist:
        close = p.get("close")
        dt_epoch = p.get("date")
        if close is None or dt_epoch is None:
            continue
        dt = datetime.fromtimestamp(int(dt_epoch), tz=UTC).strftime("%Y-%m-%d")
        rows.append((dt, ticker, float(close)))
    return rows


def _month_key(year: int, month: int) -> str:
    return f"curated/daily_monthly/year={year:04d}/month={month:02d}/daily.csv"


def _upsert_month_csv(bucket: str, year: int, month: int, df_new: pd.DataFrame) -> None:
    key = _month_key(year, month)

    if _s3_exists(bucket, key):
        obj = s3.get_object(Bucket=bucket, Key=key)
        df_old = pd.read_csv(obj["Body"])
        df = pd.concat([df_old, df_new], ignore_index=True)
    else:
        df = df_new

    # dedup (date,ticker)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["date", "ticker"])
    df = df.drop_duplicates(subset=["date", "ticker"], keep="last")
    df["date"] = df["date"].dt.strftime("%Y-%m-%d")

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=df.to_csv(index=False).encode("utf-8"),
        ContentType="text/csv",
    )
    logger.info("Upsert %s rows=%d", key, len(df))


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    cfg = load_runtime_config()

    bcfg = BootstrapCfg(
        bucket=cfg.bucket,
        universe_key=cfg.universe_s3_key,
        secret_id=cfg.brapi_secret_id,
        history_range=os.environ.get("B3TR_HISTORY_RANGE", "10y"),
        tickers_per_run=_env_int("BOOTSTRAP_TICKERS_PER_RUN", 10),
        sleep_s=_env_float("BOOTSTRAP_SLEEP_S", 0.2),
        min_points=cfg.min_points,
    )

    base_prefix = "curated/daily_monthly/_bootstrap"
    done_key = f"{base_prefix}/_BOOTSTRAP_DONE.json"
    state_key = f"{base_prefix}/state.json"

    # Já terminou? então não faz nada.
    if _s3_exists(bcfg.bucket, done_key):
        return {"ok": True, "skipped": True, "reason": "bootstrap_done"}

    token = _get_brapi_token(bcfg.secret_id)
    universe = _load_universe(bcfg.bucket, bcfg.universe_key)

    state = {"next_index": 0, "kept": 0, "dropped": {}, "updated_at": None}
    if _s3_exists(bcfg.bucket, state_key):
        state = _read_s3_json(bcfg.bucket, state_key)

    start_i = int(state.get("next_index", 0))
    end_i = min(start_i + bcfg.tickers_per_run, len(universe))
    batch = universe[start_i:end_i]

    logger.info(
        "Bootstrap run: range=%s tickers_per_run=%d idx=%d..%d total=%d",
        bcfg.history_range,
        bcfg.tickers_per_run,
        start_i,
        end_i,
        len(universe),
    )

    dropped: dict[str, int] = dict(state.get("dropped", {}))
    kept = int(state.get("kept", 0))

    # Acumula por mês para reduzir re-writes
    month_rows: dict[tuple[int, int], list[tuple[str, str, float]]] = defaultdict(list)

    for t in batch:
        try:
            payload = _brapi_history(t, token, bcfg.history_range)
            rows = _iter_rows(payload, t)

            if len(rows) < bcfg.min_points:
                dropped[t] = len(rows)
                logger.warning("Skip %s: rows=%d (<%d)", t, len(rows), bcfg.min_points)
                time.sleep(bcfg.sleep_s)
                continue

            kept += 1

            for dt, ticker, close in rows:
                y = int(dt[0:4])
                m = int(dt[5:7])
                month_rows[(y, m)].append((dt, ticker, close))

            logger.info("Fetched %s rows=%d", t, len(rows))
            time.sleep(bcfg.sleep_s)
        except Exception as e:
            logger.exception("Ticker falhou %s: %s", t, str(e))
            # mantém o estado, mas não avança o cursor além desse batch inteiro
            raise

    # Upsert mensal
    months_written = 0
    for (y, m), rows in month_rows.items():
        df_new = pd.DataFrame(rows, columns=["date", "ticker", "close"])
        _upsert_month_csv(bcfg.bucket, y, m, df_new)
        months_written += 1

    # Atualiza estado
    state["next_index"] = end_i
    state["kept"] = kept
    state["dropped"] = dropped
    state["updated_at"] = datetime.now(UTC).isoformat()

    _write_s3_json(bcfg.bucket, state_key, state)

    # Terminou tudo?
    if end_i >= len(universe):
        _write_s3_json(
            bcfg.bucket,
            done_key,
            {
                "done": True,
                "range": bcfg.history_range,
                "kept": kept,
                "dropped": dropped,
                "finished_at": datetime.now(UTC).isoformat(),
            },
        )
        return {
            "ok": True,
            "skipped": False,
            "done": True,
            "processed": len(batch),
            "months_written": months_written,
        }

    return {
        "ok": True,
        "skipped": False,
        "done": False,
        "processed": len(batch),
        "next_index": end_i,
        "months_written": months_written,
    }
