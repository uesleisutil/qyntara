"""
Lambda: Treina modelo DeepAR automaticamente no SageMaker.

Executa após preparação dos dados de treino.
Cria job de treinamento no SageMaker e salva modelo em S3.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

import boto3

from ml.src.runtime_config import load_runtime_config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
sm = boto3.client("sagemaker")


def _s3_exists(bucket: str, key: str) -> bool:
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except Exception:
        return False


def get_latest_training_job(prefix: str = "b3tr-deepar-") -> str | None:
    """Encontra o job de treinamento mais recente."""
    try:
        response = sm.list_training_jobs(
            SortBy="CreationTime", SortOrder="Descending", NameContains=prefix, MaxResults=10
        )

        for job in response.get("TrainingJobSummaries", []):
            if job["TrainingJobStatus"] in ["Completed", "InProgress"]:
                return job["TrainingJobName"]

        return None
    except Exception:
        return None


def check_recent_model(bucket: str, hours: int = 24) -> bool:
    """Verifica se existe modelo treinado recentemente."""
    try:
        paginator = s3.get_paginator("list_objects_v2")
        cutoff_time = datetime.now(UTC).timestamp() - (hours * 3600)

        for page in paginator.paginate(Bucket=bucket, Prefix="models/bfti/"):
            for obj in page.get("Contents", []):
                if obj["Key"].endswith("model.tar.gz"):
                    if obj["LastModified"].timestamp() > cutoff_time:
                        return True

        return False
    except Exception:
        return False


def load_metadata(bucket: str) -> dict:
    """Carrega metadados dos dados de treino."""
    obj = s3.get_object(Bucket=bucket, Key="training/deepar/metadata.json")
    return json.loads(obj["Body"].read().decode("utf-8"))


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Handler principal da Lambda."""
    cfg = load_runtime_config()
    bucket = cfg.bucket

    logger.info("Iniciando treinamento de modelo...")

    # Verificar se dados de treino existem
    if not _s3_exists(bucket, "training/deepar/train.jsonl"):
        return {
            "ok": False,
            "skipped": True,
            "reason": "no_training_data",
            "message": "Dados de treino não encontrados. Execute prepare_training_data primeiro.",
        }

    # Verificar se já existe modelo recente
    if check_recent_model(bucket, hours=24):
        return {
            "ok": True,
            "skipped": True,
            "reason": "recent_model_exists",
            "message": "Modelo treinado nas últimas 24h já existe",
        }

    # Verificar se já existe job de treinamento em andamento
    recent_job = get_latest_training_job()
    if recent_job:
        try:
            job_info = sm.describe_training_job(TrainingJobName=recent_job)
            status = job_info["TrainingJobStatus"]

            if status == "InProgress":
                return {
                    "ok": True,
                    "skipped": True,
                    "reason": "training_in_progress",
                    "job_name": recent_job,
                    "status": status,
                }
        except Exception:
            pass

    try:
        # Carregar metadados
        metadata = load_metadata(bucket)

        # Criar nome único para o job
        timestamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
        job_name = f"b3tr-deepar-{timestamp}"

        # Configurar hiperparâmetros
        hyperparameters = {
            "time_freq": "D",  # Frequência diária
            "context_length": str(cfg.context_length),
            "prediction_length": str(cfg.prediction_length),
            "num_cells": "40",
            "num_layers": "2",
            "likelihood": "gaussian",
            "epochs": "100",
            "mini_batch_size": "32",
            "learning_rate": "0.001",
            "dropout_rate": "0.1",
            "early_stopping_patience": "10",
        }

        # Configurar job de treinamento
        training_config = {
            "TrainingJobName": job_name,
            "AlgorithmSpecification": {
                "TrainingImage": cfg.deepar_image_uri,
                "TrainingInputMode": "File",
            },
            "RoleArn": cfg.sagemaker_role_arn,
            "InputDataConfig": [
                {
                    "ChannelName": "training",
                    "DataSource": {
                        "S3DataSource": {
                            "S3DataType": "S3Prefix",
                            "S3Uri": f"s3://{bucket}/training/deepar/",
                            "S3DataDistributionType": "FullyReplicated",
                        }
                    },
                    "ContentType": "application/jsonlines",
                    "CompressionType": "None",
                }
            ],
            "OutputDataConfig": {"S3OutputPath": f"s3://{bucket}/models/bfti/{job_name}/"},
            "ResourceConfig": {
                "InstanceType": "ml.m5.large",
                "InstanceCount": 1,
                "VolumeSizeInGB": 30,
            },
            "StoppingCondition": {"MaxRuntimeInSeconds": 3600},  # 1 hora máximo
            "HyperParameters": hyperparameters,
            "Tags": [
                {"Key": "Project", "Value": "B3TR"},
                {"Key": "Component", "Value": "DeepAR"},
                {"Key": "Environment", "Value": "Production"},
            ],
        }

        # Iniciar job de treinamento
        logger.info(f"Iniciando job de treinamento: {job_name}")
        sm.create_training_job(**training_config)

        # Salvar informações do job
        job_info = {
            "job_name": job_name,
            "started_at": datetime.now(UTC).isoformat(),
            "hyperparameters": hyperparameters,
            "training_data": {
                "num_series": metadata.get("num_time_series", 0),
                "context_length": cfg.context_length,
                "prediction_length": cfg.prediction_length,
            },
            "s3_output": f"s3://{bucket}/models/bfti/{job_name}/",
        }

        s3.put_object(
            Bucket=bucket,
            Key=f"models/bfti/{job_name}/job_info.json",
            Body=json.dumps(job_info, indent=2).encode("utf-8"),
            ContentType="application/json",
        )

        return {
            "ok": True,
            "skipped": False,
            "job_name": job_name,
            "status": "InProgress",
            "estimated_duration_minutes": 30,
            "output_path": f"s3://{bucket}/models/bfti/{job_name}/",
            "num_series": metadata.get("num_time_series", 0),
        }

    except Exception as e:
        logger.exception("Erro no treinamento do modelo")
        return {"ok": False, "error": str(e), "error_type": type(e).__name__}
