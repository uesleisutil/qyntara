"""
Lambda: Ranking com SageMaker

Orquestra treinamento e inferência usando SageMaker:
1. Prepara dados e features
2. Inicia training job no SageMaker (se necessário)
3. Faz inferência usando endpoint SageMaker
4. Gera ranking e salva recomendações
"""

from __future__ import annotations

import csv
import json
import logging
import os
import tarfile
import tempfile
from datetime import UTC, datetime, timedelta
from typing import Any

import boto3

# Imports condicionais para ML
try:
    import numpy as np
    import pandas as pd
    import xgboost as xgb
    HAS_ML_LIBS = True
except ImportError:
    HAS_ML_LIBS = False
    logging.warning("Bibliotecas ML não disponíveis, usando modo fallback")

from ml.src.features.advanced_features import AdvancedFeatureEngineer
from ml.src.runtime_config import load_runtime_config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")


def load_holidays(bucket: str, key: str) -> set[str]:
    obj = s3.get_object(Bucket=bucket, Key=key)
    payload = json.loads(obj["Body"].read().decode("utf-8"))
    return set(str(x) for x in payload.get("holidays", []))


def load_universe(bucket: str, key: str) -> list[str]:
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
    """Carrega dados históricos mensais."""
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

    min_points = 120
    series = {t: v for t, v in series.items() if len(v) >= min_points}

    return series


def prepare_features(series: dict[str, list[float]]) -> pd.DataFrame:
    """Prepara features avançadas para inferência."""
    logger.info("Gerando features avançadas para inferência...")
    
    engineer = AdvancedFeatureEngineer()
    features_list = []
    
    for ticker, values in series.items():
        if len(values) < 120:
            continue
        
        # Gerar todas as features avançadas
        features = engineer.generate_all_features(np.array(values), ticker)
        features['last_close'] = values[-1]
        features_list.append(features)
    
    df = pd.DataFrame(features_list)
    logger.info(f"Features geradas: {len(df)} tickers, {len(df.columns)} colunas")
    
    return df


def find_latest_model(bucket: str) -> tuple[str, dict]:
    """
    Encontra o modelo mais recente no S3.
    
    Returns:
        Tuple (model_key, metadata)
    """
    logger.info("Procurando modelo mais recente no S3...")
    
    # Listar modelos disponíveis
    response = s3.list_objects_v2(
        Bucket=bucket,
        Prefix='models/ensemble/',
        Delimiter='/'
    )
    
    if 'CommonPrefixes' not in response:
        raise RuntimeError("Nenhum modelo encontrado no S3")
    
    # Pegar o mais recente (ordenado por data)
    model_dates = []
    for prefix in response['CommonPrefixes']:
        date_str = prefix['Prefix'].split('/')[-2]
        try:
            model_dates.append(date_str)
        except ValueError:
            continue
    
    if not model_dates:
        raise RuntimeError("Nenhum modelo válido encontrado")
    
    latest_date = max(model_dates)
    model_prefix = f"models/ensemble/{latest_date}/"
    
    logger.info(f"Modelo mais recente: {latest_date}")
    
    # Carregar metadados
    try:
        metrics_obj = s3.get_object(Bucket=bucket, Key=f"{model_prefix}metrics.json")
        metadata = json.loads(metrics_obj['Body'].read().decode())
    except Exception as e:
        logger.warning(f"Não foi possível carregar métricas: {e}")
        metadata = {}
    
    return f"{model_prefix}model.tar.gz", metadata


def load_model_from_s3(bucket: str, model_key: str) -> tuple[xgb.Booster, list]:
    """
    Carrega modelo XGBoost do S3.
    
    Returns:
        Tuple (model, selected_features)
    """
    logger.info(f"Carregando modelo de s3://{bucket}/{model_key}")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        # Download do tar.gz
        tar_path = os.path.join(tmpdir, 'model.tar.gz')
        s3.download_file(bucket, model_key, tar_path)
        
        # Extrair
        with tarfile.open(tar_path, 'r:gz') as tar:
            tar.extractall(tmpdir)
        
        # Carregar modelo
        model_path = os.path.join(tmpdir, 'xgboost_model.json')
        model = xgb.Booster()
        model.load_model(model_path)
        
        logger.info("Modelo carregado com sucesso")
        
        # Carregar features selecionadas
        features_path = os.path.join(tmpdir, 'selected_features.json')
        if os.path.exists(features_path):
            with open(features_path, 'r') as f:
                selected_features = json.load(f)
            logger.info(f"Features selecionadas: {len(selected_features)}")
        else:
            logger.warning("selected_features.json não encontrado, usando todas as features")
            selected_features = None
        
        return model, selected_features


def predict_with_model(
    model: xgb.Booster,
    features_df: pd.DataFrame,
    selected_features: list = None
) -> np.ndarray:
    """
    Faz predições usando modelo XGBoost.
    
    Args:
        model: Modelo XGBoost carregado
        features_df: DataFrame com features
        selected_features: Lista de features selecionadas (opcional)
    
    Returns:
        Array de predições
    """
    logger.info("Fazendo predições in-memory...")
    
    # Remover colunas não-numéricas
    exclude_cols = ['ticker', 'last_close', 'last_price']
    
    if selected_features:
        # Usar apenas features selecionadas
        feature_cols = [f for f in selected_features if f not in exclude_cols]
    else:
        # Usar todas as features numéricas
        feature_cols = [col for col in features_df.columns if col not in exclude_cols]
    
    # Garantir que temos apenas features numéricas
    X = features_df[feature_cols].select_dtypes(include=[np.number])
    
    logger.info(f"Predições para {len(X)} tickers com {len(feature_cols)} features")
    
    # Criar DMatrix e prever
    dmatrix = xgb.DMatrix(X)
    predictions = model.predict(dmatrix)
    
    logger.info(f"Predições geradas: min={predictions.min():.4f}, max={predictions.max():.4f}, mean={predictions.mean():.4f}")
    
    return predictions


def generate_ranking(
    features_df: pd.DataFrame,
    predictions: np.ndarray,
    top_n: int
) -> list[dict]:
    """Gera ranking final."""
    features_df = features_df.copy()
    features_df['predicted_return'] = predictions
    
    # Score ajustado por risco
    features_df['score'] = features_df['predicted_return'] / (features_df['vol_20d'] + 1e-6)
    
    features_df = features_df.sort_values('score', ascending=False)
    top_df = features_df.head(top_n)
    
    ranking = []
    for idx, row in top_df.iterrows():
        ranking.append({
            'ticker': row['ticker'],
            'last_close': float(row['last_close']),
            'pred_price_t_plus_20': float(row['last_close'] * (1 + row['predicted_return'])),
            'exp_return_20': float(row['predicted_return']),
            'vol_20d': float(row['vol_20d']),
            'score': float(row['score'])
        })
    
    return ranking


def put_json(bucket: str, key: str, payload: dict) -> None:
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(payload, indent=2).encode("utf-8"),
        ContentType="application/json",
    )


def handler(event, context):
    """
    Handler principal.
    
    Event pode conter:
    - model_key: Caminho específico do modelo no S3 (opcional, usa mais recente se não fornecido)
    - force_momentum: Se True, força uso de momentum (sem modelo)
    """
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
        }

    logger.info(f"Iniciando ranking para {dt}")

    # Carregar dados
    tickers = load_universe(bucket, cfg.universe_s3_key)
    logger.info(f"Universe: {len(tickers)} tickers")

    series = load_monthly_data_for_ranking(bucket, cfg.rank_lookback_days)
    logger.info(f"Séries carregadas: {len(series)} tickers")

    if not series:
        raise RuntimeError("Sem séries suficientes nos dados mensais.")

    # Preparar features
    features_df = prepare_features(series)
    logger.info(f"Features preparadas: {len(features_df)} tickers")

    if features_df.empty:
        raise RuntimeError("Nenhuma feature gerada.")

    # Decidir método de predição
    force_momentum = event.get('force_momentum', False)
    model_metadata = {}
    
    if force_momentum:
        logger.info("Modo momentum forçado")
        method = "momentum_fallback"
        momentum_score = (
            features_df['return_1d'] * 0.1 +
            features_df['return_5d'] * 0.3 +
            features_df['return_20d'] * 0.4 +
            features_df['trend_slope_20d'] * 0.2
        )
        predictions = momentum_score.values
    else:
        # Tentar usar modelo treinado
        try:
            # Encontrar modelo mais recente
            model_key = event.get('model_key')
            if not model_key:
                model_key, model_metadata = find_latest_model(bucket)
            
            # Carregar modelo
            model, selected_features = load_model_from_s3(bucket, model_key)
            
            # Fazer predições
            predictions = predict_with_model(model, features_df, selected_features)
            
            method = "xgboost_ensemble"
            logger.info(f"Usando modelo: {model_key}")
            
        except Exception as e:
            logger.error(f"Erro ao usar modelo: {e}")
            logger.info("Fallback para momentum avançado")
            
            momentum_score = (
                features_df['return_1d'] * 0.1 +
                features_df['return_5d'] * 0.3 +
                features_df['return_20d'] * 0.4 +
                features_df['trend_slope_20d'] * 0.2
            )
            predictions = momentum_score.values
            method = "momentum_fallback"
            model_key = None

    # Gerar ranking
    ranking = generate_ranking(features_df, predictions, cfg.top_n)
    logger.info(f"Ranking gerado: top {len(ranking)}")

    # Salvar recomendações
    run_id = now.strftime("rank-%Y%m%d-%H%M%S")
    rec_key = f"recommendations/dt={dt}/top{cfg.top_n}.json"
    
    payload = {
        "dt": dt,
        "top_n": cfg.top_n,
        "run_id": run_id,
        "method": method,
        "model_key": model_key if method == "xgboost_ensemble" else None,
        "items": ranking,
        "holidays_s3_key": cfg.holidays_s3_key,
    }
    
    # Adicionar métricas do modelo se disponível
    if model_metadata:
        payload['model_metadata'] = {
            'train_rmse': model_metadata.get('xgboost', {}).get('train_rmse'),
            'val_rmse': model_metadata.get('xgboost', {}).get('val_rmse'),
            'val_mape': model_metadata.get('xgboost', {}).get('mape'),
            'cv_avg_rmse': model_metadata.get('walk_forward_cv', {}).get('avg_rmse'),
            'cv_avg_mape': model_metadata.get('walk_forward_cv', {}).get('avg_mape'),
        }
    
    put_json(bucket, rec_key, payload)

    logger.info(f"Recomendações salvas em {rec_key}")

    return {
        "ok": True,
        "dt": dt,
        "run_id": run_id,
        "method": method,
        "model_key": model_key if method == "xgboost_ensemble" else None,
        "recommendations_key": rec_key,
        "count": len(ranking),
        "model_metadata": model_metadata if model_metadata else None,
    }
