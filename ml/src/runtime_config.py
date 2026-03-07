from __future__ import annotations

import os
from dataclasses import dataclass

import boto3

_ssm = boto3.client("ssm")


def _ssm_prefix() -> str:
    """
    Prefixo em PROD (Lambda) vem do env: B3TR_SSM_PREFIX.
    Ex: /b3tr
    """
    p = (os.getenv("B3TR_SSM_PREFIX") or "/b3tr").strip()
    if not p.startswith("/"):
        p = "/" + p
    if p.endswith("/"):
        p = p[:-1]
    return p


def _param_name(key: str) -> str:
    return f"{_ssm_prefix()}/{key}"


def _get_env(*names: str) -> str | None:
    for n in names:
        v = os.getenv(n)
        if v is not None and v != "":
            return v
    return None


def _get_ssm(key: str) -> str | None:
    try:
        resp = _ssm.get_parameter(Name=_param_name(key))
        return resp["Parameter"]["Value"]
    except _ssm.exceptions.ParameterNotFound:
        return None


def _require(key: str, *env_names: str, default: str | None = None) -> str:
    """
    Precedência:
      1) env (qualquer alias em env_names)
      2) SSM /<prefix>/<key>
      3) default (se fornecido)
    """
    v = _get_env(*env_names)
    if v is not None:
        return v

    v = _get_ssm(key)
    if v is not None:
        return v

    if default is not None:
        return default

    raise RuntimeError(f"Config faltando: {key} (env={env_names} ou SSM={_param_name(key)})")


def _require_int(key: str, *env_names: str, default: int | None = None) -> int:
    s = _require(key, *env_names, default=str(default) if default is not None else None)
    try:
        return int(s)
    except ValueError as e:
        raise RuntimeError(f"Config inválida (int): {key}={s}") from e


@dataclass(frozen=True)
class RuntimeConfig:
    bucket: str
    brapi_secret_id: str
    deepar_image_uri: str
    sagemaker_role_arn: str

    universe_s3_key: str
    holidays_s3_key: str

    schedule_minutes: int
    b3_open_hour_utc: int
    b3_close_hour_utc: int

    context_length: int
    prediction_length: int
    test_days: int
    min_points: int
    top_n: int

    rank_lookback_days: int
    rank_instance_type: str

    ingest_lookback_minutes: int


def load_runtime_config() -> RuntimeConfig:
    return RuntimeConfig(
        bucket=_require("BUCKET", "BUCKET"),
        brapi_secret_id=_require("BRAPI_SECRET_ID", "BRAPI_SECRET_ID", default="brapi/pro/token"),
        deepar_image_uri=_require("DEEPAR_IMAGE_URI", "DEEPAR_IMAGE_URI"),
        sagemaker_role_arn=_require("SAGEMAKER_ROLE_ARN", "SAGEMAKER_ROLE_ARN"),
        universe_s3_key=_require(
            "UNIVERSE_S3_KEY",
            "UNIVERSE_S3_KEY",
            "B3TR_UNIVERSE_S3_KEY",
            default="config/universe.txt",
        ),
        holidays_s3_key=_require(
            "HOLIDAYS_S3_KEY",
            "HOLIDAYS_S3_KEY",
            default="config/b3_holidays_2026.json",
        ),
        schedule_minutes=_require_int("B3TR_SCHEDULE_MINUTES", "B3TR_SCHEDULE_MINUTES", default=5),
        b3_open_hour_utc=_require_int("B3_OPEN_HOUR_UTC", "B3_OPEN_HOUR_UTC", default=13),
        b3_close_hour_utc=_require_int("B3_CLOSE_HOUR_UTC", "B3_CLOSE_HOUR_UTC", default=20),
        context_length=_require_int("B3TR_CONTEXT_LENGTH", "B3TR_CONTEXT_LENGTH", default=60),
        prediction_length=_require_int(
            "B3TR_PREDICTION_LENGTH",
            "B3TR_PREDICTION_LENGTH",
            default=20,
        ),
        test_days=_require_int("B3TR_TEST_DAYS", "B3TR_TEST_DAYS", default=60),
        min_points=_require_int("B3TR_MIN_POINTS", "B3TR_MIN_POINTS", default=252),
        top_n=_require_int("B3TR_TOP_N", "B3TR_TOP_N", default=50),
        rank_lookback_days=_require_int(
            "B3TR_RANK_LOOKBACK_DAYS",
            "B3TR_RANK_LOOKBACK_DAYS",
            default=260,
        ),
        rank_instance_type=_require(
            "B3TR_RANK_INSTANCE_TYPE",
            "B3TR_RANK_INSTANCE_TYPE",
            default="ml.m5.large",
        ),
        ingest_lookback_minutes=_require_int(
            "INGEST_LOOKBACK_MINUTES",
            "INGEST_LOOKBACK_MINUTES",
            default=15,
        ),
    )
