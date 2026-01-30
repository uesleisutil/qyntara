from __future__ import annotations

import csv
import json
from datetime import UTC, datetime, timedelta

import boto3

from ml.src.runtime_config import load_runtime_config

s3 = boto3.client("s3")
sm = boto3.client("sagemaker")


def load_holidays(bucket: str, key: str) -> set[str]:
    obj = s3.get_object(Bucket=bucket, Key=key)
    payload = json.loads(obj["Body"].read().decode("utf-8"))
    return set(str(x) for x in payload.get("holidays", []))


def load_universe(bucket: str, key: str) -> list[str]:
    """Carrega lista de tickers do universe."""
    obj = s3.get_object(Bucket=bucket, Key=key)
    text = obj["Body"].read().decode("utf-8")
    tickers: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        tickers.append(line)
    return tickers


def should_skip_today(now_utc: datetime, holidays: set[str]) -> bool:
    if now_utc.weekday() >= 5:
        return True
    return now_utc.date().isoformat() in holidays


def load_monthly_data_for_ranking(bucket: str, days: int) -> dict[str, list[float]]:
    """Carrega dados históricos mensais para ranking."""
    # Listar todos os arquivos CSV mensais
    paginator = s3.get_paginator("list_objects_v2")
    all_data = []

    for page in paginator.paginate(Bucket=bucket, Prefix="curated/daily_monthly/year="):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.endswith(".csv"):
                continue

            obj_data = s3.get_object(Bucket=bucket, Key=key)
            lines = obj_data["Body"].read().decode("utf-8").splitlines()
            reader = csv.DictReader(lines)

            for row in reader:
                all_data.append(
                    {"date": row["date"], "ticker": row["ticker"], "close": float(row["close"])}
                )

    # Ordenar por data e agrupar por ticker
    all_data.sort(key=lambda x: x["date"])

    # Pegar apenas os últimos N dias
    if all_data:
        latest_date = max(row["date"] for row in all_data)
        cutoff_date = (
            (datetime.fromisoformat(latest_date) - timedelta(days=days)).date().isoformat()
        )
        recent_data = [row for row in all_data if row["date"] >= cutoff_date]
    else:
        recent_data = []

    # Agrupar por ticker
    series = {}
    for row in recent_data:
        ticker = row["ticker"]
        if ticker not in series:
            series[ticker] = []
        series[ticker].append(row["close"])

    # Filtrar séries com dados suficientes
    min_points = 120
    series = {t: v for t, v in series.items() if len(v) >= min_points}

    return series


def get_cat_map(bucket: str) -> dict[str, int]:
    obj = s3.get_object(Bucket=bucket, Key="training/deepar/metadata.json")
    payload = json.loads(obj["Body"].read().decode("utf-8"))
    return payload["cat_map"]


def find_latest_model_s3(bucket: str, prefix: str = "models/bfti/") -> str:
    paginator = s3.get_paginator("list_objects_v2")
    best_key: str | None = None
    best_time = None

    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            k = obj["Key"]
            if not k.endswith("model.tar.gz"):
                continue
            t = obj["LastModified"]
            if best_time is None or t > best_time:
                best_time = t
                best_key = k

    if not best_key:
        raise RuntimeError("Não encontrei model.tar.gz em models/bfti/")
    return f"s3://{bucket}/{best_key}"


def put_text(bucket: str, key: str, text: str, content_type: str) -> None:
    s3.put_object(Bucket=bucket, Key=key, Body=text.encode("utf-8"), ContentType=content_type)


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

    tickers = load_universe(bucket, cfg.universe_s3_key)

    series = load_monthly_data_for_ranking(bucket, cfg.rank_lookback_days)
    if not series:
        raise RuntimeError("Sem séries suficientes nos dados mensais.")

    cat_map = get_cat_map(bucket)

    # DeepAR só precisa de um start fixo; o importante é a sequência
    start = "2000-01-01 00:00:00"

    # Regras de corte de histórico pra inferência (estável)
    min_hist = max(cfg.context_length * 3, 180)

    lines: list[str] = []
    order: list[str] = []

    for t in tickers:
        values = series.get(t)
        if not values:
            continue
        if t not in cat_map:
            continue

        target = values[-min_hist:]
        if len(target) < 100:
            continue

        lines.append(json.dumps({"start": start, "target": target, "cat": [cat_map[t]]}))
        order.append(t)

    if not lines:
        raise RuntimeError("Nenhuma série válida para inferência (cat_map/histórico).")

    run_id = now.strftime("rank-%Y%m%d-%H%M%S")
    input_key = f"predictions/dt={dt}/input_{run_id}.jsonl"
    order_key = f"predictions/dt={dt}/order_{run_id}.json"
    run_key = f"predictions/dt={dt}/run_{run_id}.json"
    output_prefix = f"predictions/dt={dt}/output_{run_id}/"

    put_text(bucket, input_key, "\n".join(lines) + "\n", content_type="application/jsonlines")
    put_json(bucket, order_key, {"order": order})

    model_data = find_latest_model_s3(bucket)

    model_name = f"b3tr-deepar-{run_id}"
    transform_name = f"b3tr-transform-{run_id}"

    sm.create_model(
        ModelName=model_name,
        PrimaryContainer={
            "Image": cfg.deepar_image_uri,
            "ModelDataUrl": model_data,
            "Environment": {
                "DEEPAR_INFERENCE_CONFIG": '{ "num_samples": 200, "output_types": ["mean"] }'
            },
        },
        ExecutionRoleArn=cfg.sagemaker_role_arn,
    )

    sm.create_transform_job(
        TransformJobName=transform_name,
        ModelName=model_name,
        BatchStrategy="SINGLE_RECORD",
        TransformInput={
            "DataSource": {
                "S3DataSource": {
                    "S3DataType": "S3Prefix",
                    "S3Uri": f"s3://{bucket}/{input_key}",
                }
            },
            "ContentType": "application/jsonlines",
            "SplitType": "Line",
        },
        TransformOutput={
            "S3OutputPath": f"s3://{bucket}/{output_prefix}",
            "AssembleWith": "Line",
            "Accept": "application/jsonlines",
        },
        TransformResources={"InstanceType": cfg.rank_instance_type, "InstanceCount": 1},
        MaxConcurrentTransforms=2,
        MaxPayloadInMB=6,
    )

    put_json(
        bucket,
        run_key,
        {
            "dt": dt,
            "run_id": run_id,
            "input_key": input_key,
            "order_key": order_key,
            "output_prefix": output_prefix,
            "model_data": model_data,
            "model_name": model_name,
            "transform_job": transform_name,
            "prediction_length": cfg.prediction_length,
            "holidays_s3_key": cfg.holidays_s3_key,
        },
    )

    return {
        "ok": True,
        "dt": dt,
        "run_id": run_id,
        "transform_job": transform_name,
        "tickers": len(order),
        "run_key": run_key,
    }
