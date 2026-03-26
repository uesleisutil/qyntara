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

# Imports condicionais para DL
try:
    import numpy as np
    import pandas as pd
    HAS_DL_LIBS = True
except ImportError as e:
    HAS_DL_LIBS = False
    logging.warning(f"Bibliotecas DL não disponíveis, usando modo fallback: {e}")

# PyTorch (para modelo Transformer+BiLSTM)
try:
    import torch
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False
    logging.warning("PyTorch não disponível, modelo DL não poderá ser usado")

from dl.src.features.advanced_features import AdvancedFeatureEngineer
from dl.src.runtime_config import load_runtime_config

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
    # Usar horário de Brasília (UTC-3) para decidir se é fim de semana/feriado,
    # pois o mercado B3 opera em BRT e o dt de referência é BRT.
    brt = now_utc - timedelta(hours=3)
    if brt.weekday() >= 5:
        return True
    return brt.date().isoformat() in holidays


def load_monthly_data_for_ranking(bucket: str, days: int) -> tuple[dict[str, list[float]], dict[str, list[float]]]:
    """Carrega dados históricos mensais (preços e volumes)."""
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
                entry = {
                    "date": row["date"],
                    "ticker": row["ticker"],
                    "close": float(row["close"]),
                }
                # Volume pode não existir em dados antigos
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

    min_points = 120
    valid_tickers = {t for t, v in series.items() if len(v) >= min_points}
    series = {t: v for t, v in series.items() if t in valid_tickers}
    volumes = {t: v for t, v in volumes.items() if t in valid_tickers}

    return series, volumes


def prepare_features(
    series: dict[str, list[float]],
    volumes: dict[str, list[float]] = None,
    macro_features: dict[str, float] = None,
    fundamentals_dict: dict[str, dict] = None,
    sentiment_dict: dict[str, float] = None,
) -> pd.DataFrame:
    """Prepara features avançadas para inferência (incluindo volume, macro, setor, fundamentals, sentimento)."""
    logger.info("Gerando features avançadas para inferência...")
    
    engineer = AdvancedFeatureEngineer()
    features_list = []
    
    for ticker, values in series.items():
        if len(values) < 120:
            continue
        
        vol_array = None
        if volumes and ticker in volumes:
            vol_array = np.array(volumes[ticker])
        
        fundamentals = None
        if fundamentals_dict and ticker in fundamentals_dict:
            fundamentals = fundamentals_dict[ticker]
        
        sentiment = None
        if sentiment_dict and ticker in sentiment_dict:
            sentiment = sentiment_dict[ticker]
        
        # Gerar todas as features avançadas (volume, macro, setor, fundamentals, sentimento)
        features = engineer.generate_all_features(
            np.array(values),
            ticker,
            volumes=vol_array,
            fundamentals=fundamentals,
            macro_features=macro_features,
            all_series=series,
            sentiment_score=sentiment,
        )
        features['last_close'] = values[-1]
        features_list.append(features)
    
    df = pd.DataFrame(features_list)
    logger.info(f"Features geradas: {len(df)} tickers, {len(df.columns)} colunas")
    
    return df


def find_latest_model(bucket: str) -> tuple[str, dict]:
    """
    Encontra o modelo DL mais recente no S3.
    Procura primeiro em models/deep_learning/, depois fallback para models/ensemble/.

    Returns:
        Tuple (model_key, metadata)
    """
    logger.info("Procurando modelo DL mais recente no S3...")

    # Tentar modelos DL primeiro, depois ensemble (backward compat)
    for prefix_path in ['models/deep_learning/', 'models/ensemble/']:
        response = s3.list_objects_v2(Bucket=bucket, Prefix=prefix_path, Delimiter='/')

        if 'CommonPrefixes' not in response:
            continue

        model_dates = []
        for prefix in response['CommonPrefixes']:
            date_str = prefix['Prefix'].split('/')[-2]
            try:
                datetime.strptime(date_str, "%Y-%m-%d")
                model_dates.append(date_str)
            except ValueError:
                continue

        if not model_dates:
            continue

        latest_date = max(model_dates)
        model_prefix = f"{prefix_path}{latest_date}/"

        logger.info(f"Modelo mais recente: {model_prefix}")

        # Carregar metadados
        try:
            metrics_obj = s3.get_object(Bucket=bucket, Key=f"{model_prefix}metrics.json")
            metadata = json.loads(metrics_obj['Body'].read().decode())
        except Exception as e:
            logger.warning(f"Não foi possível carregar métricas: {e}")
            metadata = {}

        # Procurar model.tar.gz
        direct_key = f"{model_prefix}model.tar.gz"
        try:
            s3.head_object(Bucket=bucket, Key=direct_key)
            return direct_key, metadata
        except Exception:
            pass

        objs = s3.list_objects_v2(Bucket=bucket, Prefix=model_prefix)
        for obj in objs.get('Contents', []):
            if obj['Key'].endswith('/model.tar.gz'):
                logger.info(f"Modelo encontrado em: {obj['Key']}")
                return obj['Key'], metadata

    raise RuntimeError("Nenhum modelo DL encontrado no S3")


def load_model_from_s3(bucket: str, model_key: str):
    """
    Carrega modelo DL (Transformer+BiLSTM) do S3.
    Suporta tanto o novo formato DL quanto o legado XGBoost.

    Returns:
        Tuple (model_or_trainer, selected_features, metrics, model_type)
    """
    logger.info(f"Carregando modelo de s3://{bucket}/{model_key}")

    with tempfile.TemporaryDirectory() as tmpdir:
        tar_path = os.path.join(tmpdir, 'model.tar.gz')
        s3.download_file(bucket, model_key, tar_path)

        file_size = os.path.getsize(tar_path)
        logger.info(f"Modelo baixado: {file_size} bytes")

        import gzip
        import io

        with open(tar_path, 'rb') as f:
            decompressed = gzip.decompress(f.read())

        tar_io = io.BytesIO(decompressed)
        with tarfile.open(fileobj=tar_io, mode='r:') as tar:
            members = tar.getnames()
            logger.info(f"Membros do tar: {members}")
            tar.extractall(tmpdir)

        # Detectar tipo de modelo
        model_config_path = os.path.join(tmpdir, 'model_config.json')
        model_state_path = os.path.join(tmpdir, 'model_state.pt')

        if os.path.exists(model_config_path) and os.path.exists(model_state_path):
            # Modelo DL único (Transformer+BiLSTM)
            from dl.src.sagemaker.train_deep_learning import DeepLearningTrainer
            trainer = DeepLearningTrainer.load(tmpdir, device='cpu')
            logger.info(f"Modelo DL carregado: {trainer.n_features} features")
            return trainer, trainer.feature_names, trainer.metrics, 'transformer_bilstm'
        
        # Verificar se é ensemble DL (3 modelos)
        ensemble_config_path = os.path.join(tmpdir, 'ensemble_config.json')
        if os.path.exists(ensemble_config_path):
            from dl.src.sagemaker.train_deep_learning import EnsembleDLTrainer
            ensemble = EnsembleDLTrainer.load(tmpdir, device='cpu')
            # Pegar feature_names do primeiro modelo
            first_trainer = list(ensemble.trainers.values())[0]
            logger.info(f"Ensemble DL carregado: {ensemble.model_names}, pesos={ensemble.weights}")
            return ensemble, first_trainer.feature_names, ensemble.ensemble_metrics, 'dl_ensemble'

        # Fallback: tentar XGBoost legado
        xgb_path = os.path.join(tmpdir, 'xgboost_model.json')
        if os.path.exists(xgb_path):
            try:
                import xgboost as xgb
                model = xgb.Booster()
                model.load_model(xgb_path)

                features_path = os.path.join(tmpdir, 'selected_features.json')
                selected_features = None
                if os.path.exists(features_path):
                    with open(features_path, 'r') as f:
                        selected_features = json.load(f)

                metrics = {}
                metrics_path = os.path.join(tmpdir, 'metrics.json')
                if os.path.exists(metrics_path):
                    with open(metrics_path, 'r') as f:
                        metrics = json.load(f)

                logger.info("Modelo XGBoost legado carregado")
                return model, selected_features, metrics, 'xgboost_legacy'
            except ImportError:
                raise RuntimeError("Modelo XGBoost encontrado mas xgboost não instalado")

        raise RuntimeError(f"Formato de modelo não reconhecido. Arquivos: {members}")


def predict_with_model(
    model,
    features_df: pd.DataFrame,
    selected_features: list = None,
    model_type: str = 'transformer_bilstm',
) -> np.ndarray:
    """
    Faz predições usando modelo DL (Transformer+BiLSTM) ou XGBoost legado.
    """
    logger.info(f"Fazendo predições in-memory (tipo: {model_type})...")

    exclude_cols = ['ticker']

    if selected_features:
        feature_cols = [f for f in selected_features if f not in exclude_cols]
    else:
        feature_cols = [col for col in features_df.columns if col not in exclude_cols and col not in ['last_close']]

    missing_cols = [c for c in feature_cols if c not in features_df.columns]
    if missing_cols:
        logger.warning(f"Features ausentes (preenchidas com 0): {len(missing_cols)}")
        for col in missing_cols:
            features_df[col] = 0.0

    X = features_df[feature_cols].select_dtypes(include=[np.number])
    logger.info(f"Predições para {len(X)} tickers com {len(feature_cols)} features")

    if model_type == 'transformer_bilstm':
        # Modelo DL único — model é um DeepLearningTrainer
        predictions = model.predict(X.values)
    elif model_type == 'dl_ensemble':
        # Ensemble DL — model é um EnsembleDLTrainer
        predictions = model.predict(X.values)
    elif model_type == 'xgboost_legacy':
        # XGBoost legado
        import xgboost as xgb
        dmatrix = xgb.DMatrix(X)
        predictions = model.predict(dmatrix)
    else:
        raise ValueError(f"Tipo de modelo desconhecido: {model_type}")

    logger.info(f"Predições: min={predictions.min():.4f}, max={predictions.max():.4f}, mean={predictions.mean():.4f}")
    return predictions


def generate_ranking(
    features_df: pd.DataFrame,
    predictions: np.ndarray,
    top_n: int
) -> list[dict]:
    """Gera ranking final."""
    features_df = features_df.copy()
    
    # Clipar predições para range razoável (safety net — retornos de 20 dias raramente excedem ±30%)
    predictions = np.clip(predictions, -0.3, 0.3)
    features_df['predicted_return'] = predictions
    
    # Score ajustado por risco (usar volatility_20d se vol_20d não existir)
    vol_col = 'vol_20d' if 'vol_20d' in features_df.columns else 'volatility_20d'
    if vol_col not in features_df.columns:
        # Fallback: usar apenas predicted_return como score
        features_df['score'] = features_df['predicted_return']
    else:
        features_df['score'] = features_df['predicted_return'] / (features_df[vol_col] + 1e-6)
    
    features_df = features_df.sort_values('score', ascending=False)
    top_df = features_df.head(top_n)
    
    ranking = []
    for idx, row in top_df.iterrows():
        # Usar volatility_20d se vol_20d não existir
        vol_col = 'vol_20d' if 'vol_20d' in row.index else 'volatility_20d'
        vol_value = float(row[vol_col]) if vol_col in row.index else 0.0
        
        ranking.append({
            'ticker': row['ticker'],
            'last_close': float(row['last_close']),
            'pred_price_t_plus_20': float(row['last_close'] * (1 + row['predicted_return'])),
            'exp_return_20': float(row['predicted_return']),
            'vol_20d': vol_value,
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
    # Usar horário de Brasília (UTC-3) para determinar a data de referência
    # O modelo roda às 18:30 BRT (21:30 UTC), mas se rodar após meia-noite UTC
    # a data UTC seria D+1 enquanto em BRT ainda é D
    brt_now = now - timedelta(hours=3)
    dt = brt_now.date().isoformat()

    holidays = load_holidays(bucket, cfg.holidays_s3_key)
    force = event.get('force', False)
    if not force and should_skip_today(now, holidays):
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

    series, volumes = load_monthly_data_for_ranking(bucket, cfg.rank_lookback_days)
    logger.info(f"Séries carregadas: {len(series)} tickers")

    if not series:
        raise RuntimeError("Sem séries suficientes nos dados mensais.")

    # Carregar dados macro do BCB
    macro_features = None
    try:
        from dl.src.features.macro_features import fetch_all_macro_data, calculate_macro_features as calc_macro
        macro_data = fetch_all_macro_data(days=90)
        macro_features = calc_macro(macro_data)
        logger.info(f"Macro features carregadas: {len(macro_features)} features")
    except Exception as e:
        logger.warning(f"Não foi possível carregar dados macro: {e}")

    # Carregar dados fundamentalistas (do Feature Store ou BRAPI)
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

    # Carregar sentimento (do Feature Store)
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

    # Preparar features (com volume, macro, fundamentals, setor, sentimento)
    features_df = prepare_features(
        series,
        volumes=volumes,
        macro_features=macro_features,
        fundamentals_dict=fundamentals_dict,
        sentiment_dict=sentiment_dict,
    )
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
            model, selected_features, train_metrics, model_type = load_model_from_s3(bucket, model_key)
            
            # Usar métricas do tar.gz se disponíveis
            if train_metrics:
                model_metadata = train_metrics
            
            # Fazer predições
            predictions = predict_with_model(model, features_df, selected_features, model_type)
            
            method = model_type if model_type.startswith('dl_') else f"dl_{model_type}"
            logger.info(f"Usando modelo DL: {model_key} (tipo: {model_type})")
            
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
        "model_key": model_key if method.startswith("dl_") else None,
        "items": ranking,
        "holidays_s3_key": cfg.holidays_s3_key,
    }
    
    # Adicionar métricas do modelo se disponível
    if model_metadata:
        dl_metrics = model_metadata
        payload['model_metadata'] = {
            'architecture': dl_metrics.get('architecture', 'TransformerBiLSTM'),
            'models': dl_metrics.get('models'),
            'weights': dl_metrics.get('weights'),
            'train_rmse': dl_metrics.get('train_rmse') or dl_metrics.get('individual_models', {}).get('xgboost', {}).get('train_rmse'),
            'val_rmse': dl_metrics.get('val_rmse') or dl_metrics.get('ensemble_val_rmse'),
            'val_mae': dl_metrics.get('val_mae') or dl_metrics.get('ensemble_val_mae'),
            'val_mape': dl_metrics.get('val_mape') or dl_metrics.get('ensemble_val_mape'),
            'directional_accuracy': dl_metrics.get('directional_accuracy') or dl_metrics.get('ensemble_directional_accuracy'),
            'epochs_trained': dl_metrics.get('epochs_trained'),
            'best_val_loss': dl_metrics.get('best_val_loss'),
            'cv_avg_rmse': dl_metrics.get('walk_forward_cv', {}).get('avg_val_rmse') or dl_metrics.get('cv_avg_rmse'),
            'cv_avg_mape': dl_metrics.get('walk_forward_cv', {}).get('avg_val_mape') or dl_metrics.get('cv_avg_mape'),
            'n_features': dl_metrics.get('n_features') or dl_metrics.get('feature_selection', {}).get('n_features_selected'),
            'train_date': dl_metrics.get('train_date'),
            'train_samples': dl_metrics.get('train_samples'),
            'individual_metrics': dl_metrics.get('individual_metrics'),
        }
    
    put_json(bucket, rec_key, payload)

    logger.info(f"Recomendações salvas em {rec_key}")

    # Broadcast via WebSocket para dashboard real-time
    try:
        from dl.src.lambdas.ws_broadcast import notify
        notify("recommendations", {"dt": dt, "method": method, "count": len(ranking)})
    except Exception:
        pass

    return {
        "ok": True,
        "dt": dt,
        "run_id": run_id,
        "method": method,
        "model_key": model_key if method.startswith("dl_") else None,
        "recommendations_key": rec_key,
        "count": len(ranking),
        "model_metadata": model_metadata if model_metadata else None,
    }
