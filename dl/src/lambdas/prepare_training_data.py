"""
Lambda: Prepara dados de treino DeepAR automaticamente.

Lê dados históricos de curated/daily_monthly/ e gera:
- training/deepar/train.jsonl
- training/deepar/test.jsonl
- training/deepar/metadata.json

Roda automaticamente após bootstrap ou quando necessário.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

import boto3
import pandas as pd

from dl.src.runtime_config import load_runtime_config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")


def _s3_exists(bucket: str, key: str) -> bool:
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except Exception:
        return False


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


def load_monthly_data(bucket: str) -> pd.DataFrame:
    """Carrega todos os dados históricos mensais."""
    logger.info("Carregando dados históricos mensais...")

    # Listar todos os arquivos CSV mensais
    paginator = s3.get_paginator("list_objects_v2")
    dfs = []

    for page in paginator.paginate(Bucket=bucket, Prefix="curated/daily_monthly/year="):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if not key.endswith(".csv"):
                continue

            logger.info(f"Carregando {key}")
            obj_data = s3.get_object(Bucket=bucket, Key=key)
            df = pd.read_csv(obj_data["Body"])
            dfs.append(df)

    if not dfs:
        raise RuntimeError("Nenhum dado histórico encontrado em curated/daily_monthly/")

    # Combinar todos os dados
    df_all = pd.concat(dfs, ignore_index=True)
    df_all["date"] = pd.to_datetime(df_all["date"])
    df_all = df_all.sort_values(["ticker", "date"])

    logger.info(f"Dados carregados: {len(df_all)} registros, {df_all['ticker'].nunique()} tickers")
    return df_all


def prepare_deepar_data(df: pd.DataFrame, cfg) -> tuple[list[dict], list[dict], dict]:
    """Prepara dados no formato DeepAR."""
    logger.info("Preparando dados para DeepAR...")

    # Agrupar por ticker
    series_data = {}
    for ticker, group in df.groupby("ticker"):
        group = group.sort_values("date")
        dates = group["date"].dt.strftime("%Y-%m-%d").tolist()
        prices = group["close"].tolist()

        # Filtrar séries com dados suficientes
        min_points = max(
            cfg.min_points, cfg.context_length + cfg.prediction_length + cfg.test_days + 1
        )
        if len(prices) >= min_points:
            series_data[ticker] = {"dates": dates, "prices": prices, "start_date": dates[0]}

    logger.info(f"Séries válidas: {len(series_data)} de {df['ticker'].nunique()} tickers")

    if len(series_data) < 3:
        raise RuntimeError(f"Dados insuficientes: apenas {len(series_data)} séries válidas")

    # Criar mapeamento categórico
    tickers = sorted(series_data.keys())
    cat_map = {ticker: i for i, ticker in enumerate(tickers)}

    # Dividir em treino e teste
    train_data = []
    test_data = []

    for ticker in tickers:
        data = series_data[ticker]
        prices = data["prices"]
        start_date = data["start_date"]

        # Split: últimos test_days para teste
        split_point = len(prices) - cfg.test_days

        train_series = prices[:split_point]
        test_series = prices  # Série completa para teste

        if len(train_series) >= cfg.context_length + cfg.prediction_length:
            train_data.append(
                {"start": start_date, "target": train_series, "cat": [cat_map[ticker]]}
            )

            test_data.append({"start": start_date, "target": test_series, "cat": [cat_map[ticker]]})

    metadata = {
        "cat_map": cat_map,
        "num_time_series": len(train_data),
        "context_length": cfg.context_length,
        "prediction_length": cfg.prediction_length,
        "test_days": cfg.test_days,
        "created_at": datetime.now(UTC).isoformat(),
    }

    logger.info(
        f"Dados preparados: {len(train_data)} séries de treino, {len(test_data)} séries de teste"
    )
    return train_data, test_data, metadata


def save_jsonl(bucket: str, key: str, data: list[dict]) -> None:
    """Salva dados em formato JSONL."""
    lines = [json.dumps(item) for item in data]
    content = "\n".join(lines) + "\n"

    s3.put_object(
        Bucket=bucket, Key=key, Body=content.encode("utf-8"), ContentType="application/jsonlines"
    )
    logger.info(f"Salvo {key}: {len(data)} registros")


def save_json(bucket: str, key: str, data: dict) -> None:
    """Salva dados em formato JSON."""
    content = json.dumps(data, indent=2, ensure_ascii=False)

    s3.put_object(
        Bucket=bucket, Key=key, Body=content.encode("utf-8"), ContentType="application/json"
    )
    logger.info(f"Salvo {key}")


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Handler principal da Lambda."""
    cfg = load_runtime_config()
    bucket = cfg.bucket

    logger.info("Iniciando preparação de dados de treino...")

    # Verificar se bootstrap foi concluído
    bootstrap_done_key = "curated/daily_monthly/_bootstrap/_BOOTSTRAP_DONE.json"
    if not _s3_exists(bucket, bootstrap_done_key):
        return {
            "ok": False,
            "skipped": True,
            "reason": "bootstrap_not_completed",
            "message": "Aguardando conclusão do bootstrap histórico",
        }

    # Verificar se dados de treino já existem e são recentes
    train_key = "training/deepar/train.jsonl"
    if _s3_exists(bucket, train_key):
        try:
            # Verificar idade dos dados de treino
            obj = s3.head_object(Bucket=bucket, Key=train_key)
            last_modified = obj["LastModified"]
            age_hours = (datetime.now(UTC) - last_modified).total_seconds() / 3600

            if age_hours < 24:  # Dados de treino criados nas últimas 24h
                return {
                    "ok": True,
                    "skipped": True,
                    "reason": "training_data_recent",
                    "age_hours": age_hours,
                }
        except Exception:
            pass

    try:
        # Carregar dados históricos
        df = load_monthly_data(bucket)

        # Preparar dados DeepAR
        train_data, test_data, metadata = prepare_deepar_data(df, cfg)

        # Salvar arquivos de treino
        save_jsonl(bucket, "training/deepar/train.jsonl", train_data)
        save_jsonl(bucket, "training/deepar/test.jsonl", test_data)
        save_json(bucket, "training/deepar/metadata.json", metadata)

        return {
            "ok": True,
            "skipped": False,
            "train_series": len(train_data),
            "test_series": len(test_data),
            "tickers": len(metadata["cat_map"]),
            "data_points": sum(len(item["target"]) for item in train_data),
        }

    except Exception as e:
        logger.exception("Erro na preparação de dados")
        return {"ok": False, "error": str(e), "error_type": type(e).__name__}
