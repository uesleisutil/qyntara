"""
Config central do projeto (lê .env local + variáveis do ambiente).

Regras:
- Local: carrega .env automaticamente.
- AWS (Lambda/SageMaker): usa env vars já definidas no serviço (não precisa .env).
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

# Carrega .env local se existir (não quebra em produção)
load_dotenv(override=False)


def _get(name: str, default: str | None = None) -> str:
    """Busca env var com default; se não houver, explode com erro claro."""
    val = os.getenv(name, default)
    if val is None or val == "":
        raise RuntimeError(f"Config faltando: {name}")
    return val


def _get_int(name: str, default: int | None = None) -> int:
    v = os.getenv(name)
    if v is None or v == "":
        if default is None:
            raise RuntimeError(f"Config faltando: {name}")
        return int(default)
    return int(v)


@dataclass(frozen=True)
class AppConfig:
    # AWS
    aws_region: str
    bucket_prefix: str

    # BRAPI
    brapi_secret_id: str

    # Ingest
    universe_s3_key: str
    batch_size: int
    schedule_minutes: int

    # Train
    prediction_length: int
    context_length: int
    epochs: int
    train_instance_type: str

    # Rank
    rank_instance_type: str
    top_n: int

    # Dataset
    test_days: int


def load_config() -> AppConfig:
    return AppConfig(
        aws_region=_get("AWS_REGION", _get("AWS_DEFAULT_REGION", "us-east-1")),
        bucket_prefix=_get("B3TR_BUCKET_PREFIX", "b3-tactical-ranking"),
        brapi_secret_id=_get("BRAPI_SECRET_ID", "brapi/pro/token"),
        universe_s3_key=_get("B3TR_UNIVERSE_S3_KEY", "config/universe.txt"),
        batch_size=_get_int("B3TR_BATCH_SIZE", 20),
        schedule_minutes=_get_int("B3TR_SCHEDULE_MINUTES", 5),
        prediction_length=_get_int("B3TR_PREDICTION_LENGTH", 20),
        context_length=_get_int("B3TR_CONTEXT_LENGTH", 60),
        epochs=_get_int("B3TR_EPOCHS", 30),
        train_instance_type=_get("B3TR_TRAIN_INSTANCE_TYPE", "ml.m5.large"),
        rank_instance_type=_get("B3TR_RANK_INSTANCE_TYPE", "ml.m5.large"),
        top_n=_get_int("B3TR_TOP_N", 10),
        test_days=_get_int("B3TR_TEST_DAYS", 60),
    )
