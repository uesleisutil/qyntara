"""
Lambda: Retreino Semanal Automático.

Dispara retreino do modelo toda semana (domingo à noite) com os dados mais recentes.
Mantém o modelo sempre fresco, sem depender apenas de drift detection.

Acionado via EventBridge schedule: cron(0 22 ? * SUN *)
"""

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime
from typing import Any, Dict

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
lambda_client = boto3.client("lambda")

BUCKET = os.environ["BUCKET"]


def should_retrain(bucket: str) -> tuple[bool, str]:
    """
    Verifica se o retreino é necessário/desejável.
    Sempre retorna True para retreino semanal, mas inclui razão.
    """
    # Verificar idade do modelo atual
    try:
        response = s3.list_objects_v2(
            Bucket=bucket, Prefix="models/ensemble/", Delimiter="/"
        )
        if "CommonPrefixes" not in response:
            return True, "no_model_found"

        model_dates = []
        for prefix in response["CommonPrefixes"]:
            date_str = prefix["Prefix"].split("/")[-2]
            model_dates.append(date_str)

        if not model_dates:
            return True, "no_model_found"

        latest = max(model_dates)
        model_age = (datetime.now(UTC).date() - datetime.fromisoformat(latest).date()).days

        if model_age >= 7:
            return True, f"model_age_{model_age}d"
        else:
            return True, f"weekly_schedule_model_age_{model_age}d"

    except Exception as e:
        logger.error(f"Erro ao verificar modelo: {e}")
        return True, "check_failed"


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handler do retreino semanal.
    Invoca a Lambda TrainSageMaker com lookback de 365 dias.
    """
    now = datetime.now(UTC)
    dt = now.date().isoformat()

    logger.info(f"Retreino semanal iniciado: {dt}")

    do_retrain, reason = should_retrain(BUCKET)
    logger.info(f"Retreino: {do_retrain}, razão: {reason}")

    if not do_retrain:
        return {"ok": True, "retrained": False, "reason": reason}

    # Invocar Lambda de treino
    train_fn_name = os.environ.get("TRAIN_FUNCTION_NAME", "TrainSageMaker")

    try:
        payload = {
            "lookback_days": 365,
            "trigger": "weekly_retrain",
            "reason": reason,
        }

        response = lambda_client.invoke(
            FunctionName=train_fn_name,
            InvocationType="Event",  # Assíncrono
            Payload=json.dumps(payload).encode("utf-8"),
        )

        logger.info(f"Treino disparado: {response['StatusCode']}")

        # Salvar registro do retreino
        retrain_key = f"monitoring/retraining/dt={dt}/weekly_retrain.json"
        s3.put_object(
            Bucket=BUCKET,
            Key=retrain_key,
            Body=json.dumps({
                "timestamp": now.isoformat(),
                "trigger": "weekly_schedule",
                "reason": reason,
                "train_function": train_fn_name,
                "status": "triggered",
            }).encode("utf-8"),
            ContentType="application/json",
        )

        return {
            "ok": True,
            "retrained": True,
            "reason": reason,
            "date": dt,
        }

    except Exception as e:
        logger.error(f"Erro ao disparar retreino: {e}")
        return {"ok": False, "error": str(e)}
