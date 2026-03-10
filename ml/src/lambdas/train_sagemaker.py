"""
Lambda: Treinar Modelos no SageMaker

Inicia training job no SageMaker com os dados preparados.
Permite escolher tipo de instância (ml.m5.xlarge, ml.c5.2xlarge, etc)
"""

from __future__ import annotations

import csv
import json
import logging
import os
import tarfile
import tempfile
from datetime import UTC, datetime, timedelta

import boto3
import numpy as np
import pandas as pd

from ml.src.features.advanced_features import AdvancedFeatureEngineer, create_training_dataset
from ml.src.runtime_config import load_runtime_config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
sagemaker = boto3.client("sagemaker")


def load_monthly_data_for_training(bucket: str, days: int) -> dict[str, list[float]]:
    """Carrega dados históricos."""
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

    all_data.sort(key=lambda x: x["date"])

    if all_data:
        latest_date = max(row["date"] for row in all_data)
        cutoff_date = (
            (datetime.fromisoformat(latest_date) - timedelta(days=days)).date().isoformat()
        )
        recent_data = [row for row in all_data if row["date"] >= cutoff_date]
    else:
        recent_data = []

    series = {}
    for row in recent_data:
        ticker = row["ticker"]
        if ticker not in series:
            series[ticker] = []
        series[ticker].append(row["close"])

    return series


def prepare_training_data(series: dict[str, list[float]], target_horizon: int = 20) -> pd.DataFrame:
    """Prepara dados de treino com features avançadas."""
    logger.info("Gerando features avançadas...")
    
    # Usar o feature engineer avançado
    train_df = create_training_dataset(
        series_dict=series,
        target_horizon=target_horizon,
        min_history=120
    )
    
    logger.info(f"Features geradas: {len(train_df.columns)} colunas")
    
    return train_df


def upload_training_data(df: pd.DataFrame, bucket: str, prefix: str) -> str:
    """Faz upload dos dados de treino para S3."""
    # Salvar CSV temporário
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        df.to_csv(f, index=False)
        temp_path = f.name
    
    # Upload para S3
    s3_key = f"{prefix}/train.csv"
    s3.upload_file(temp_path, bucket, s3_key)
    
    logger.info(f"Dados de treino enviados para s3://{bucket}/{s3_key}")
    
    import os
    os.unlink(temp_path)
    
    return f"s3://{bucket}/{prefix}"


def upload_training_script(bucket: str) -> str:
    """
    Empacota e faz upload do script de treino para S3.
    Cria um sourcedir.tar.gz com o script train_ensemble.py
    """
    import os
    import tarfile
    
    logger.info("Empacotando script de treino...")
    
    # Criar tar.gz temporário
    with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as tmp:
        tar_path = tmp.name
    
    # Caminho do script
    script_dir = os.path.join(os.path.dirname(__file__), '..', 'sagemaker')
    script_file = os.path.join(script_dir, 'train_ensemble.py')
    
    # Criar tar.gz
    with tarfile.open(tar_path, 'w:gz') as tar:
        tar.add(script_file, arcname='train_ensemble.py')
    
    # Upload para S3
    s3_key = 'scripts/sourcedir.tar.gz'
    s3.upload_file(tar_path, bucket, s3_key)
    
    logger.info(f"Script empacotado e enviado para s3://{bucket}/{s3_key}")
    
    # Limpar
    os.unlink(tar_path)
    
    return f"s3://{bucket}/{s3_key}"


def start_training_job(
    job_name: str,
    train_data_s3: str,
    output_s3: str,
    role_arn: str,
    bucket: str,
    instance_type: str = "ml.m5.xlarge",
    hyperparameters: dict = None
) -> str:
    """Inicia training job no SageMaker usando script mode."""
    
    if hyperparameters is None:
        hyperparameters = {
            'max-depth': '6',
            'learning-rate': '0.1',
            'n-estimators': '100',
            'subsample': '0.8',
            'colsample-bytree': '0.8',
            'n-features': '30',
            'cv-splits': '5'
        }
    
    # Converter underscores para hyphens (padrão SageMaker)
    hyperparameters = {k.replace('_', '-'): str(v) for k, v in hyperparameters.items()}
    
    # Upload do script
    script_s3 = upload_training_script(bucket)
    
    # Imagem: usar customizada se disponível, senão XGBoost da AWS
    region = boto3.Session().region_name
    account_id = boto3.client('sts').get_caller_identity()['Account']
    
    # Tentar usar imagem customizada do ensemble
    custom_image = os.environ.get('ENSEMBLE_IMAGE_URI')
    if custom_image:
        image_uri = custom_image
        logger.info(f"Usando imagem customizada: {image_uri}")
    else:
        # Fallback para XGBoost da AWS
        image_uri = f"683313688378.dkr.ecr.{region}.amazonaws.com/sagemaker-xgboost:1.7-1"
        logger.info(f"Usando imagem XGBoost da AWS: {image_uri}")
    
    logger.info(f"Iniciando training job: {job_name}")
    logger.info(f"Instance type: {instance_type}")
    logger.info(f"Hyperparameters: {hyperparameters}")
    logger.info(f"Script: {script_s3}")
    
    # Adicionar parâmetros do script mode
    hyperparameters['sagemaker_program'] = 'train_ensemble.py'
    hyperparameters['sagemaker_submit_directory'] = script_s3
    
    response = sagemaker.create_training_job(
        TrainingJobName=job_name,
        RoleArn=role_arn,
        AlgorithmSpecification={
            'TrainingImage': image_uri,
            'TrainingInputMode': 'File'
        },
        InputDataConfig=[
            {
                'ChannelName': 'train',
                'DataSource': {
                    'S3DataSource': {
                        'S3DataType': 'S3Prefix',
                        'S3Uri': train_data_s3,
                        'S3DataDistributionType': 'FullyReplicated'
                    }
                },
                'ContentType': 'text/csv',
                'CompressionType': 'None'
            }
        ],
        OutputDataConfig={
            'S3OutputPath': output_s3
        },
        ResourceConfig={
            'InstanceType': instance_type,
            'InstanceCount': 1,
            'VolumeSizeInGB': 30
        },
        HyperParameters=hyperparameters,
        StoppingCondition={
            'MaxRuntimeInSeconds': 7200  # 2 horas
        }
    )
    
    logger.info(f"Training job iniciado: {response['TrainingJobArn']}")
    
    return job_name


def handler(event, context):
    """
    Handler principal.
    
    Event pode conter:
    - instance_type: Tipo de instância (ml.m5.xlarge, ml.c5.2xlarge, etc)
    - hyperparameters: Dict com hiperparâmetros
    - lookback_days: Dias de histórico para treino
    """
    cfg = load_runtime_config()
    bucket = cfg.bucket

    now = datetime.now(UTC)
    dt = now.date().isoformat()

    logger.info(f"Iniciando preparação de treino para {dt}")

    # Parâmetros
    instance_type = event.get('instance_type', 'ml.m5.xlarge')
    hyperparameters = event.get('hyperparameters', {
        'max_depth': '6',
        'learning_rate': '0.1',
        'n_estimators': '100'
    })
    lookback_days = event.get('lookback_days', 365)

    # Carregar dados
    logger.info(f"Carregando {lookback_days} dias de histórico...")
    series = load_monthly_data_for_training(bucket, lookback_days)
    logger.info(f"Séries carregadas: {len(series)} tickers")

    if not series:
        raise RuntimeError("Sem dados suficientes para treino.")

    # Preparar dados de treino
    logger.info("Preparando dados de treino...")
    train_df = prepare_training_data(series)
    logger.info(f"Dados de treino: {len(train_df)} amostras")

    if train_df.empty:
        raise RuntimeError("Nenhum dado de treino gerado.")

    # Upload para S3
    train_prefix = f"training/ensemble/{dt}"
    train_data_s3 = upload_training_data(train_df, bucket, train_prefix)

    # Iniciar training job
    job_name = f"b3tr-ensemble-{dt.replace('-', '')}-{now.strftime('%H%M%S')}"
    output_s3 = f"s3://{bucket}/models/ensemble/{dt}"

    job_name = start_training_job(
        job_name=job_name,
        train_data_s3=train_data_s3,
        output_s3=output_s3,
        role_arn=cfg.sagemaker_role_arn,
        bucket=bucket,
        instance_type=instance_type,
        hyperparameters=hyperparameters
    )

    return {
        "ok": True,
        "dt": dt,
        "training_job_name": job_name,
        "instance_type": instance_type,
        "train_data_s3": train_data_s3,
        "output_s3": output_s3,
        "train_samples": len(train_df),
        "message": f"Training job iniciado: {job_name}"
    }
