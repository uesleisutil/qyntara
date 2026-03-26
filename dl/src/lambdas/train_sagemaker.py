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

from dl.src.features.advanced_features import AdvancedFeatureEngineer, create_training_dataset
from dl.src.runtime_config import load_runtime_config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
sagemaker = boto3.client("sagemaker")


def load_monthly_data_for_training(bucket: str, days: int) -> tuple[dict[str, list[float]], dict[str, list[float]]]:
    """Carrega dados históricos (preços + volumes)."""
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
                entry = {"date": row["date"], "ticker": row["ticker"], "close": float(row["close"])}
                if "volume" in row and row["volume"]:
                    try:
                        entry["volume"] = float(row["volume"])
                    except (ValueError, TypeError):
                        entry["volume"] = 0.0
                else:
                    entry["volume"] = 0.0
                all_data.append(entry)

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
    volumes = {}
    for row in recent_data:
        ticker = row["ticker"]
        if ticker not in series:
            series[ticker] = []
            volumes[ticker] = []
        series[ticker].append(row["close"])
        volumes[ticker].append(row["volume"])

    return series, volumes


def prepare_training_data(
    series: dict[str, list[float]],
    target_horizon: int = 20,
    volumes: dict[str, list[float]] = None,
    fundamentals_dict: dict[str, dict] = None,
    macro_features: dict[str, float] = None,
    sentiment_dict: dict[str, float] = None,
) -> pd.DataFrame:
    """Prepara dados de treino com TODAS as features avançadas."""
    logger.info("Gerando features avançadas (preço + volume + fundamentals + macro + setor + sentimento)...")

    train_df = create_training_dataset(
        series_dict=series,
        target_horizon=target_horizon,
        min_history=120,
        volumes_dict=volumes,
        fundamentals_dict=fundamentals_dict,
        macro_features=macro_features,
        sentiment_dict=sentiment_dict,
    )

    logger.info(f"Features geradas: {len(train_df.columns)} colunas, {len(train_df)} amostras")
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
    Handler principal — treina ensemble DL com TODAS as features.

    Event pode conter:
    - lookback_days: Dias de histórico (default: 730 = 2 anos)
    - epochs: Número de épocas (default: 120)
    - train_local: Se True, treina na Lambda (default: True)
    """
    cfg = load_runtime_config()
    bucket = cfg.bucket

    now = datetime.now(UTC)
    dt = now.date().isoformat()

    logger.info(f"Iniciando treino DL para {dt}")

    lookback_days = event.get('lookback_days', 730)
    epochs = event.get('epochs', 120)
    train_local = event.get('train_local', True)

    # 1. Carregar preços + volumes
    logger.info(f"Carregando {lookback_days} dias de histórico...")
    series, volumes = load_monthly_data_for_training(bucket, lookback_days)
    logger.info(f"Séries carregadas: {len(series)} tickers")

    if not series:
        raise RuntimeError("Sem dados suficientes para treino.")

    # 2. Carregar dados macro do BCB
    macro_features = None
    try:
        from dl.src.features.macro_features import fetch_all_macro_data, calculate_macro_features as calc_macro
        macro_data = fetch_all_macro_data(days=90)
        macro_features = calc_macro(macro_data)
        logger.info(f"Macro features carregadas: {len(macro_features)} features")
    except Exception as e:
        logger.warning(f"Não foi possível carregar dados macro: {e}")

    # 3. Carregar fundamentalistas do Feature Store
    fundamentals_dict = None
    try:
        from dl.src.features.feature_store import FeatureStore
        store = FeatureStore(bucket)
        fundamentals_dict = {}
        for ticker in series.keys():
            fund = store.load_features_with_fallback("fundamentals", ticker, dt, fallback_days=30)
            if fund:
                fundamentals_dict[ticker] = fund
        if fundamentals_dict:
            logger.info(f"Fundamentals carregados: {len(fundamentals_dict)} tickers")
    except Exception as e:
        logger.warning(f"Não foi possível carregar fundamentals: {e}")

    # 4. Carregar sentimento do Feature Store
    sentiment_dict = None
    try:
        from dl.src.features.feature_store import FeatureStore as FS2
        store2 = FS2(bucket)
        sentiment_dict = {}
        for ticker in series.keys():
            sent = store2.load_features_with_fallback("sentiment", ticker, dt, fallback_days=3)
            if sent and "sentiment_score" in sent:
                sentiment_dict[ticker] = sent["sentiment_score"]
        if sentiment_dict:
            logger.info(f"Sentimento carregado: {len(sentiment_dict)} tickers")
    except Exception as e:
        logger.warning(f"Não foi possível carregar sentimento: {e}")

    # 5. Preparar dados de treino com TODAS as features
    logger.info("Preparando dados de treino com features completas...")
    train_df = prepare_training_data(
        series,
        volumes=volumes,
        fundamentals_dict=fundamentals_dict,
        macro_features=macro_features,
        sentiment_dict=sentiment_dict,
    )
    logger.info(f"Dados de treino: {len(train_df)} amostras, {len(train_df.columns)} colunas")

    if train_df.empty:
        raise RuntimeError("Nenhum dado de treino gerado.")

    if train_local:
        return _train_local(train_df, bucket, dt, epochs, event)
    else:
        instance_type = event.get('instance_type', 'ml.m5.xlarge')
        hyperparameters = event.get('hyperparameters', {})
        train_prefix = f"training/ensemble/{dt}"
        train_data_s3 = upload_training_data(train_df, bucket, train_prefix)
        job_name = f"b3tr-dl-{dt.replace('-', '')}-{now.strftime('%H%M%S')}"
        output_s3 = f"s3://{bucket}/models/deep_learning/{dt}"
        job_name = start_training_job(
            job_name=job_name, train_data_s3=train_data_s3, output_s3=output_s3,
            role_arn=cfg.sagemaker_role_arn, bucket=bucket,
            instance_type=instance_type, hyperparameters=hyperparameters,
        )
        result = {"ok": True, "dt": dt, "training_job_name": job_name, "method": "sagemaker", "train_samples": len(train_df)}

        # Broadcast via WebSocket para dashboard real-time
        try:
            from dl.src.lambdas.ws_broadcast import notify
            notify("training", result)
        except Exception:
            pass

        return result


def _train_local(train_df: pd.DataFrame, bucket: str, dt: str, epochs: int, event: dict) -> dict:
    """
    Treina ensemble DL em etapas (1 modelo por invocação para caber no timeout de 15min).

    Modos:
    - train_model=None: treina todos sequencialmente (pode dar timeout com dados grandes)
    - train_model="transformer_bilstm": treina só esse modelo e salva no S3
    - train_model="residual_mlp": treina só esse modelo
    - train_model="temporal_cnn": treina só esse modelo
    - combine_ensemble=True: combina os 3 modelos já treinados em um ensemble
    """
    import torch
    from dl.src.sagemaker.train_deep_learning import DeepLearningTrainer, EnsembleDLTrainer, MODEL_REGISTRY

    train_model = event.get('train_model')
    combine_only = event.get('combine_ensemble', False)
    model_prefix = f"models/deep_learning/{dt}"
    all_models = ['transformer_bilstm', 'tab_transformer', 'ft_transformer']

    # Separar features e target
    target_col = 'target'
    if target_col not in train_df.columns:
        target_col = 'target_return_20d'
    if target_col not in train_df.columns:
        target_candidates = [c for c in train_df.columns if c == 'target' or 'target_return' in c.lower()]
        target_col = target_candidates[0] if target_candidates else train_df.columns[-1]
    logger.info(f"Usando target: {target_col}")

    exclude_cols = ['ticker', 'date', 'date_index'] + [c for c in train_df.columns if 'target' in c.lower() or 'market_return' in c.lower()]
    feature_cols = [c for c in train_df.columns if c not in exclude_cols and train_df[c].dtype in ['float64', 'float32', 'int64']]

    X = train_df[feature_cols].fillna(0).values
    y = train_df[target_col].fillna(0).values
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    y = np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0)

    y_std = np.std(y)
    if y_std > 0:
        mask = np.abs(y) < 5 * y_std
        X, y = X[mask], y[mask]
        logger.info(f"Após limpeza de outliers: {len(X)} amostras (removidas {(~mask).sum()})")

    split_idx = int(len(X) * 0.8)
    X_train, X_val = X[:split_idx], X[split_idx:]
    y_train, y_val = y[:split_idx], y[split_idx:]
    logger.info(f"Train: {len(X_train)}, Val: {len(X_val)}, Features: {len(feature_cols)}")

    # === MODO: Combinar modelos já treinados ===
    if combine_only:
        return _combine_ensemble(bucket, dt, model_prefix, all_models, X_val, y_val, feature_cols)

    # === MODO: Treinar um modelo específico ===
    if train_model:
        return _train_single_model(
            train_model, bucket, dt, model_prefix, feature_cols,
            X_train, y_train, X_val, y_val, epochs, event,
        )

    # === MODO: Treinar todos (pode dar timeout com dados grandes) ===
    ensemble = EnsembleDLTrainer(n_features=len(feature_cols), model_names=all_models, device='cpu')
    metrics = ensemble.train_all(
        X_train, y_train, X_val, y_val,
        epochs=epochs, batch_size=min(128, len(X_train)), lr=5e-4, patience=20,
    )
    for trainer in ensemble.trainers.values():
        trainer.feature_names = feature_cols

    metrics['train_date'] = dt
    metrics['train_samples'] = len(X_train)
    metrics['n_features'] = len(feature_cols)
    ensemble.ensemble_metrics = metrics

    _upload_ensemble(ensemble, bucket, model_prefix)

    return {
        "ok": True, "dt": dt, "method": "local_dl_ensemble",
        "architecture": "DL_Ensemble_3Models", "models": all_models,
        "weights": ensemble.weights, "model_key": f"{model_prefix}/model.tar.gz",
        "train_samples": len(X_train), "n_features": len(feature_cols), "metrics": metrics,
    }


def _train_single_model(
    model_name: str, bucket: str, dt: str, model_prefix: str, feature_cols: list,
    X_train, y_train, X_val, y_val, epochs: int, event: dict,
) -> dict:
    """
    Inicia SageMaker Training Job para treinar um modelo DL.
    A Lambda só prepara dados e inicia o job — o treino roda no SageMaker.
    """
    logger.info(f"Iniciando SageMaker Training Job para {model_name}")

    cfg = load_runtime_config()

    # 1. Preparar dados de treino como DataFrame e upload para S3
    train_df = pd.DataFrame(X_train, columns=feature_cols)
    train_df['target'] = y_train
    # Adicionar validação
    val_df = pd.DataFrame(X_val, columns=feature_cols)
    val_df['target'] = y_val
    full_df = pd.concat([train_df, val_df], ignore_index=True)

    train_prefix = f"training/dl/{dt}/{model_name}"
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        full_df.to_csv(f, index=False)
        temp_path = f.name
    s3.upload_file(temp_path, bucket, f"{train_prefix}/train.csv")
    os.unlink(temp_path)
    train_data_s3 = f"s3://{bucket}/{train_prefix}"
    logger.info(f"Dados enviados para {train_data_s3} ({len(full_df)} amostras)")

    # 2. Empacotar scripts de treino (train_single_model.py + train_deep_learning.py)
    script_dir = os.path.join(os.path.dirname(__file__), '..', 'sagemaker')
    with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as tmp:
        tar_path = tmp.name
    with tarfile.open(tar_path, 'w:gz') as tar:
        for script in ['train_single_model.py', 'train_deep_learning.py']:
            script_path = os.path.join(script_dir, script)
            if os.path.exists(script_path):
                tar.add(script_path, arcname=script)
    s3.upload_file(tar_path, bucket, f"scripts/dl_train_{model_name}.tar.gz")
    os.unlink(tar_path)
    script_s3 = f"s3://{bucket}/scripts/dl_train_{model_name}.tar.gz"

    # 3. Iniciar SageMaker Training Job
    # Usar imagem PyTorch da AWS (tem torch pré-instalado)
    region = boto3.Session().region_name
    image_uri = f"763104351884.dkr.ecr.{region}.amazonaws.com/pytorch-training:2.2.0-cpu-py310-ubuntu20.04-sagemaker"

    job_name = f"b3tr-{model_name.replace('_', '-')}-{dt.replace('-', '')}-{os.urandom(3).hex()}"[:63]

    hyperparameters = {
        'model-name': model_name,
        'epochs': str(epochs),
        'batch-size': '128',
        'lr': '0.0005',
        'patience': '20',
        'sagemaker_program': 'train_single_model.py',
        'sagemaker_submit_directory': script_s3,
    }

    output_s3 = f"s3://{bucket}/{model_prefix}/individual/{model_name}"

    try:
        sagemaker.create_training_job(
            TrainingJobName=job_name,
            RoleArn=cfg.sagemaker_role_arn,
            AlgorithmSpecification={
                'TrainingImage': image_uri,
                'TrainingInputMode': 'File',
            },
            InputDataConfig=[{
                'ChannelName': 'train',
                'DataSource': {
                    'S3DataSource': {
                        'S3DataType': 'S3Prefix',
                        'S3Uri': train_data_s3,
                        'S3DataDistributionType': 'FullyReplicated',
                    }
                },
                'ContentType': 'text/csv',
            }],
            OutputDataConfig={'S3OutputPath': output_s3},
            ResourceConfig={
                'InstanceType': 'ml.m5.xlarge',  # 16GB RAM, 4 vCPUs
                'InstanceCount': 1,
                'VolumeSizeInGB': 30,
            },
            HyperParameters=hyperparameters,
            StoppingCondition={'MaxRuntimeInSeconds': 7200},  # 2 horas max
        )
        logger.info(f"SageMaker Training Job iniciado: {job_name}")
    except Exception as e:
        logger.error(f"Erro ao iniciar SageMaker job: {e}")
        return {"ok": False, "error": str(e), "model_name": model_name}

    return {
        "ok": True, "dt": dt, "method": f"sagemaker_{model_name}",
        "model_name": model_name, "training_job_name": job_name,
        "output_s3": output_s3, "instance_type": "ml.m5.xlarge",
    }


def _combine_ensemble(
    bucket: str, dt: str, model_prefix: str, model_names: list,
    X_val, y_val, feature_cols: list,
) -> dict:
    """Combina modelos individuais já treinados em um ensemble.
    Busca modelos tanto do formato Lambda (arquivos soltos) quanto SageMaker (model.tar.gz)."""
    import torch
    import gzip
    import io
    from dl.src.sagemaker.train_deep_learning import DeepLearningTrainer, EnsembleDLTrainer

    logger.info("Combinando modelos individuais em ensemble...")
    ensemble = EnsembleDLTrainer(n_features=len(feature_cols), model_names=model_names, device='cpu')

    for name in model_names:
        with tempfile.TemporaryDirectory() as tmpdir:
            loaded = False

            # Tentar formato Lambda (arquivos soltos no S3)
            prefix = f"{model_prefix}/individual/{name}/"
            resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix)
            files = [obj['Key'] for obj in resp.get('Contents', []) if not obj['Key'].endswith('/')]

            model_files = [f for f in files if f.split('/')[-1] in ('model_config.json', 'model_state.pt', 'scaler.pkl', 'metrics.json', 'selected_features.json')]
            if model_files:
                for key in model_files:
                    fname = key.split('/')[-1]
                    s3.download_file(bucket, key, os.path.join(tmpdir, fname))
                loaded = True
                logger.info(f"Carregado {name} (formato Lambda, {len(model_files)} arquivos)")

            # Tentar formato SageMaker (model.tar.gz dentro de output/)
            if not loaded:
                tar_files = [f for f in files if f.endswith('model.tar.gz')]
                if not tar_files:
                    # SageMaker salva em {output_s3}/{job_name}/output/model.tar.gz
                    deeper_resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix, MaxKeys=200)
                    tar_files = [obj['Key'] for obj in deeper_resp.get('Contents', []) if obj['Key'].endswith('model.tar.gz')]

                if tar_files:
                    tar_key = tar_files[0]
                    tar_path = os.path.join(tmpdir, 'model.tar.gz')
                    s3.download_file(bucket, tar_key, tar_path)
                    # Extrair
                    with open(tar_path, 'rb') as f:
                        decompressed = gzip.decompress(f.read())
                    with tarfile.open(fileobj=io.BytesIO(decompressed), mode='r:') as tar:
                        tar.extractall(tmpdir)
                    loaded = True
                    logger.info(f"Carregado {name} (formato SageMaker tar.gz)")

            if not loaded:
                logger.warning(f"Modelo {name} não encontrado em {prefix}")
                continue

            try:
                trainer = DeepLearningTrainer.load(tmpdir, device='cpu')
                trainer.feature_names = feature_cols
                ensemble.trainers[name] = trainer
                logger.info(f"  {name}: RMSE={trainer.metrics.get('val_rmse', 'N/A')}")
            except Exception as e:
                logger.error(f"Erro ao carregar {name}: {e}")

    if not ensemble.trainers:
        return {"ok": False, "error": "Nenhum modelo carregado"}

    # Calcular pesos
    val_rmses = {name: t.metrics.get('val_rmse', 999.0) for name, t in ensemble.trainers.items()}
    inv = {k: 1.0 / (v + 1e-8) for k, v in val_rmses.items()}
    total = sum(inv.values())
    ensemble.weights = {k: round(v / total, 4) for k, v in inv.items()}
    logger.info(f"Pesos do ensemble: {ensemble.weights}")

    # Métricas do ensemble
    ensemble_preds = ensemble.predict(X_val)
    residuals = y_val - ensemble_preds
    ens_rmse = float(np.sqrt(np.mean(residuals ** 2)))
    ens_mae = float(np.mean(np.abs(residuals)))
    mask = np.abs(y_val) > 1e-6
    ens_mape = float(np.mean(np.abs(residuals[mask] / y_val[mask])) * 100) if mask.any() else 999.0
    ens_dir_acc = float(np.mean(np.sign(ensemble_preds) == np.sign(y_val)))

    individual_metrics = {name: t.metrics for name, t in ensemble.trainers.items()}
    ensemble.ensemble_metrics = {
        'architecture': 'DL_Ensemble_3Models', 'models': list(ensemble.trainers.keys()),
        'weights': ensemble.weights, 'individual_metrics': individual_metrics,
        'ensemble_val_rmse': ens_rmse, 'ensemble_val_mae': ens_mae,
        'ensemble_val_mape': min(ens_mape, 999.0), 'ensemble_directional_accuracy': ens_dir_acc,
        'train_date': dt, 'n_features': len(feature_cols),
        'train_samples': individual_metrics.get(list(ensemble.trainers.keys())[0], {}).get('train_samples'),
    }
    logger.info(f"Ensemble: RMSE={ens_rmse:.4f}, DirAcc={ens_dir_acc:.2%}")

    _upload_ensemble(ensemble, bucket, model_prefix)

    return {
        "ok": True, "dt": dt, "method": "dl_ensemble",
        "architecture": "DL_Ensemble_3Models", "models": list(ensemble.trainers.keys()),
        "weights": ensemble.weights, "model_key": f"{model_prefix}/model.tar.gz",
        "n_features": len(feature_cols), "metrics": ensemble.ensemble_metrics,
    }


def _upload_ensemble(ensemble, bucket: str, model_prefix: str):
    """Salva ensemble completo no S3."""
    with tempfile.TemporaryDirectory() as tmpdir:
        ensemble.save(tmpdir)
        tar_path = os.path.join(tmpdir, 'model.tar.gz')
        with tarfile.open(tar_path, 'w:gz') as tar:
            for fname in ['ensemble_config.json', 'metrics.json']:
                fpath = os.path.join(tmpdir, fname)
                if os.path.exists(fpath):
                    tar.add(fpath, arcname=fname)
            for model_name in ensemble.model_names:
                model_dir = os.path.join(tmpdir, model_name)
                if os.path.exists(model_dir):
                    for fname in os.listdir(model_dir):
                        tar.add(os.path.join(model_dir, fname), arcname=f"{model_name}/{fname}")
        s3.upload_file(tar_path, bucket, f"{model_prefix}/model.tar.gz")
        s3.upload_file(os.path.join(tmpdir, 'metrics.json'), bucket, f"{model_prefix}/metrics.json")
    logger.info(f"Ensemble salvo em s3://{bucket}/{model_prefix}/")
