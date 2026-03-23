"""
Lambda: Monitor Model Performance

Monitora a performance do modelo em produção comparando predições com resultados reais.
Calcula MAPE, drift, e decide se é necessário re-treinar.

Roda diariamente após o mercado fechar para validar predições de 20 dias atrás.
"""

from __future__ import annotations

import csv
import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Dict, List

import boto3
import numpy as np

from ml.src.runtime_config import load_runtime_config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
sns = boto3.client("sns")
cloudwatch = boto3.client("cloudwatch")


def load_predictions(bucket: str, date: str) -> Dict:
    """Carrega predições de uma data específica."""
    key = f"recommendations/dt={date}/top50.json"
    
    try:
        obj = s3.get_object(Bucket=bucket, Key=key)
        data = json.loads(obj['Body'].read().decode())
        return data
    except s3.exceptions.NoSuchKey:
        logger.warning(f"Predições não encontradas para {date}")
        return None


def load_actual_prices(bucket: str, tickers: List[str], date: str) -> Dict[str, float]:
    """Carrega preços reais de uma data específica."""
    actual_prices = {}
    
    # Tentar carregar do curated
    try:
        # Converter data para year/month
        dt = datetime.fromisoformat(date)
        year = dt.year
        month = dt.month
        
        key = f"curated/daily_monthly/year={year}/month={month:02d}/{date}.csv"
        obj = s3.get_object(Bucket=bucket, Key=key)
        lines = obj['Body'].read().decode('utf-8').splitlines()
        reader = csv.DictReader(lines)
        
        for row in reader:
            if row['ticker'] in tickers:
                actual_prices[row['ticker']] = float(row['close'])
        
        logger.info(f"Carregados {len(actual_prices)} preços reais para {date}")
        
    except Exception as e:
        logger.error(f"Erro ao carregar preços reais: {e}")
    
    return actual_prices


def calculate_mape(predictions: List[float], actuals: List[float]) -> float:
    """Calcula MAPE (Mean Absolute Percentage Error)."""
    if len(predictions) != len(actuals) or len(predictions) == 0:
        return None
    
    errors = []
    for pred, actual in zip(predictions, actuals):
        if actual != 0:
            error = abs((actual - pred) / actual)
            errors.append(error)
    
    if not errors:
        return None
    
    mape = np.mean(errors) * 100
    return float(mape)


def calculate_directional_accuracy(predictions: List[float], actuals: List[float], baselines: List[float]) -> float:
    """
    Calcula acurácia direcional: % de vezes que o modelo acertou a direção do movimento.
    """
    if len(predictions) != len(actuals) or len(predictions) == 0:
        return None
    
    correct = 0
    total = 0
    
    for pred, actual, baseline in zip(predictions, actuals, baselines):
        pred_direction = pred > baseline
        actual_direction = actual > baseline
        
        if pred_direction == actual_direction:
            correct += 1
        total += 1
    
    if total == 0:
        return None
    
    accuracy = (correct / total) * 100
    return float(accuracy)


def detect_drift(recent_mapes: List[float], threshold: float = 1.5) -> bool:
    """
    Detecta drift comparando MAPE recente com histórico.
    
    Args:
        recent_mapes: Lista de MAPEs dos últimos N dias
        threshold: Multiplicador para considerar drift (1.5 = 50% pior)
    
    Returns:
        True se drift detectado
    """
    if len(recent_mapes) < 10:
        return False
    
    # Comparar últimos 5 dias com 5 anteriores
    recent_avg = np.mean(recent_mapes[-5:])
    baseline_avg = np.mean(recent_mapes[-10:-5])
    
    if baseline_avg == 0:
        return False
    
    ratio = recent_avg / baseline_avg
    
    logger.info(f"Drift check: recent={recent_avg:.2f}%, baseline={baseline_avg:.2f}%, ratio={ratio:.2f}")
    
    return ratio > threshold


def load_model_metadata(bucket: str) -> Dict:
    """Carrega metadados do modelo mais recente."""
    try:
        # Listar modelos
        response = s3.list_objects_v2(
            Bucket=bucket,
            Prefix='models/ensemble/',
            Delimiter='/'
        )
        
        if 'CommonPrefixes' not in response:
            return None
        
        # Pegar o mais recente
        model_dates = []
        for prefix in response['CommonPrefixes']:
            date_str = prefix['Prefix'].split('/')[-2]
            try:
                model_dates.append(date_str)
            except ValueError:
                continue
        
        if not model_dates:
            return None
        
        latest_date = max(model_dates)
        
        # Carregar métricas
        metrics_key = f"models/ensemble/{latest_date}/metrics.json"
        obj = s3.get_object(Bucket=bucket, Key=metrics_key)
        metadata = json.loads(obj['Body'].read().decode())
        metadata['model_date'] = latest_date
        
        return metadata
        
    except Exception as e:
        logger.error(f"Erro ao carregar metadados do modelo: {e}")
        return None


def save_performance_metrics(bucket: str, date: str, metrics: Dict):
    """Salva métricas de performance no S3."""
    key = f"monitoring/performance/dt={date}/metrics.json"
    
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(metrics, indent=2).encode('utf-8'),
        ContentType='application/json'
    )
    
    logger.info(f"Métricas salvas em {key}")


def load_recent_performance(bucket: str, days: int = 30) -> List[Dict]:
    """Carrega métricas de performance dos últimos N dias."""
    metrics_list = []
    
    try:
        response = s3.list_objects_v2(
            Bucket=bucket,
            Prefix='monitoring/performance/',
            MaxKeys=100
        )
        
        for obj in response.get('Contents', []):
            if obj['Key'].endswith('metrics.json'):
                try:
                    data = s3.get_object(Bucket=bucket, Key=obj['Key'])
                    metrics = json.loads(data['Body'].read().decode())
                    metrics_list.append(metrics)
                except Exception as e:
                    logger.warning(f"Erro ao carregar {obj['Key']}: {e}")
        
        # Ordenar por data e pegar últimos N
        metrics_list.sort(key=lambda x: x.get('date', ''), reverse=True)
        return metrics_list[:days]
        
    except Exception as e:
        logger.error(f"Erro ao carregar performance histórica: {e}")
        return []


def send_alert(topic_arn: str, subject: str, message: str):
    """Envia alerta via SNS."""
    try:
        sns.publish(
            TopicArn=topic_arn,
            Subject=subject,
            Message=message
        )
        logger.info(f"Alerta enviado: {subject}")
    except Exception as e:
        logger.error(f"Erro ao enviar alerta: {e}")


def put_cloudwatch_metric(namespace: str, metric_name: str, value: float, unit: str = 'None'):
    """Envia métrica para CloudWatch."""
    try:
        cloudwatch.put_metric_data(
            Namespace=namespace,
            MetricData=[
                {
                    'MetricName': metric_name,
                    'Value': value,
                    'Unit': unit,
                    'Timestamp': datetime.now(UTC)
                }
            ]
        )
    except Exception as e:
        logger.error(f"Erro ao enviar métrica CloudWatch: {e}")


def handler(event, context):
    """
    Handler principal.
    
    Valida predições de 20 dias atrás comparando com preços reais.
    """
    cfg = load_runtime_config()
    bucket = cfg.bucket
    
    now = datetime.now(UTC)
    today = now.date().isoformat()
    
    # Data das predições a validar (20 dias atrás)
    prediction_date = (now - timedelta(days=20)).date().isoformat()
    
    logger.info(f"Validando predições de {prediction_date} com dados de {today}")
    
    # Carregar predições
    predictions_data = load_predictions(bucket, prediction_date)
    
    if not predictions_data:
        logger.warning(f"Sem predições para validar em {prediction_date}")
        return {"ok": True, "skipped": True, "reason": "no_predictions"}
    
    # Extrair tickers e predições
    items = predictions_data.get('items', [])
    if not items:
        logger.warning("Nenhum item nas predições")
        return {"ok": True, "skipped": True, "reason": "no_items"}
    
    tickers = [item['ticker'] for item in items]
    predicted_prices = [item['pred_price_t_plus_20'] for item in items]
    baseline_prices = [item['last_close'] for item in items]
    
    # Carregar preços reais
    actual_prices_dict = load_actual_prices(bucket, tickers, today)
    
    if not actual_prices_dict:
        logger.warning(f"Sem preços reais para {today}")
        return {"ok": True, "skipped": True, "reason": "no_actual_prices"}
    
    # Filtrar apenas tickers com preços reais
    valid_predictions = []
    valid_actuals = []
    valid_baselines = []
    valid_tickers = []
    
    for ticker, pred, baseline in zip(tickers, predicted_prices, baseline_prices):
        if ticker in actual_prices_dict:
            valid_predictions.append(pred)
            valid_actuals.append(actual_prices_dict[ticker])
            valid_baselines.append(baseline)
            valid_tickers.append(ticker)
    
    if not valid_predictions:
        logger.warning("Nenhuma predição válida para comparar")
        return {"ok": True, "skipped": True, "reason": "no_valid_predictions"}
    
    logger.info(f"Validando {len(valid_predictions)} predições")
    
    # Calcular métricas
    mape = calculate_mape(valid_predictions, valid_actuals)
    directional_accuracy = calculate_directional_accuracy(
        valid_predictions, valid_actuals, valid_baselines
    )
    
    # Calcular erro médio absoluto
    errors = [abs(pred - actual) for pred, actual in zip(valid_predictions, valid_actuals)]
    mae = np.mean(errors)
    
    # --- Per-ticker accuracy ---
    per_ticker_metrics = {}
    for ticker, pred, actual, baseline in zip(valid_tickers, valid_predictions, valid_actuals, valid_baselines):
        error_pct = abs((actual - pred) / actual) * 100 if actual != 0 else 0
        direction_correct = (pred > baseline) == (actual > baseline)
        per_ticker_metrics[ticker] = {
            'predicted': float(pred),
            'actual': float(actual),
            'error_pct': float(error_pct),
            'direction_correct': direction_correct,
        }
    
    # --- Per-sector accuracy ---
    from ml.src.features.sector_features import get_sector
    sector_metrics: Dict[str, List[float]] = {}
    for ticker, pred, actual in zip(valid_tickers, valid_predictions, valid_actuals):
        sector = get_sector(ticker)
        if sector not in sector_metrics:
            sector_metrics[sector] = {'errors': [], 'count': 0}
        if actual != 0:
            sector_metrics[sector]['errors'].append(abs((actual - pred) / actual) * 100)
            sector_metrics[sector]['count'] += 1
    
    per_sector_mape = {}
    for sector, data in sector_metrics.items():
        if data['errors']:
            per_sector_mape[sector] = {
                'mape': float(np.mean(data['errors'])),
                'count': data['count'],
            }
    
    # Carregar metadados do modelo
    model_metadata = load_model_metadata(bucket)
    
    # Métricas de performance
    performance_metrics = {
        'date': today,
        'prediction_date': prediction_date,
        'n_predictions': len(valid_predictions),
        'mape': float(mape) if mape is not None else None,
        'mae': float(mae),
        'directional_accuracy': float(directional_accuracy) if directional_accuracy is not None else None,
        'method': predictions_data.get('method', 'unknown'),
        'per_ticker': per_ticker_metrics,
        'per_sector': per_sector_mape,
        'model_metadata': {
            'model_date': model_metadata.get('model_date') if model_metadata else None,
            'train_mape': model_metadata.get('xgboost', {}).get('mape') if model_metadata else None,
            'cv_avg_mape': model_metadata.get('walk_forward_cv', {}).get('avg_mape') if model_metadata else None,
        }
    }
    
    # Salvar métricas
    save_performance_metrics(bucket, today, performance_metrics)
    
    # Enviar para CloudWatch
    if mape is not None:
        put_cloudwatch_metric('B3TR', 'ModelMAPE', mape, 'Percent')
    if directional_accuracy is not None:
        put_cloudwatch_metric('B3TR', 'DirectionalAccuracy', directional_accuracy, 'Percent')
    put_cloudwatch_metric('B3TR', 'ModelMAE', mae, 'None')
    
    logger.info(f"Performance: MAPE={mape:.2f}%, Directional={directional_accuracy:.2f}%, MAE={mae:.2f}")
    
    # Carregar performance histórica
    recent_performance = load_recent_performance(bucket, days=30)
    recent_mapes = [m['mape'] for m in recent_performance if m.get('mape') is not None]
    
    # Detectar drift
    needs_retrain = False
    drift_detected = False
    
    if mape is not None:
        # Critério 1: MAPE muito alto (> 20%)
        if mape > 20:
            needs_retrain = True
            logger.warning(f"MAPE muito alto: {mape:.2f}% > 20%")
        
        # Critério 2: Drift detectado
        if len(recent_mapes) >= 10:
            drift_detected = detect_drift(recent_mapes)
            if drift_detected:
                needs_retrain = True
                logger.warning("Drift detectado na performance do modelo")
        
        # Critério 3: Performance pior que baseline (momentum)
        if model_metadata and model_metadata.get('xgboost', {}).get('mape'):
            train_mape = model_metadata['xgboost']['mape']
            if mape > train_mape * 2:
                needs_retrain = True
                logger.warning(f"Performance degradou: {mape:.2f}% vs treino {train_mape:.2f}%")
    
    # Enviar alertas se necessário
    if needs_retrain:
        alert_message = f"""
B3 Tactical Ranking - Re-treino Necessário

Data: {today}
Predições validadas: {prediction_date}

Métricas Atuais:
- MAPE: {mape:.2f}%
- Acurácia Direcional: {directional_accuracy:.2f}%
- MAE: {mae:.2f}

Modelo Atual:
- Data de treino: {model_metadata.get('model_date') if model_metadata else 'N/A'}
- MAPE de treino: {model_metadata.get('xgboost', {}).get('mape') if model_metadata else 'N/A'}%

Motivo:
- MAPE alto: {mape > 20 if mape else False}
- Drift detectado: {drift_detected}
- Performance degradada: {mape > (model_metadata.get('xgboost', {}).get('mape', 0) * 2) if mape and model_metadata else False}

Ação Recomendada:
aws lambda invoke --function-name TrainSageMaker --payload '{{"lookback_days": 365}}' output.json
        """
        
        # Enviar alerta SNS (se configurado)
        topic_arn = event.get('alerts_topic_arn')
        if topic_arn:
            send_alert(topic_arn, "B3TR: Re-treino Necessário", alert_message)
    
    return {
        "ok": True,
        "date": today,
        "prediction_date": prediction_date,
        "n_predictions": len(valid_predictions),
        "mape": float(mape) if mape is not None else None,
        "directional_accuracy": float(directional_accuracy) if directional_accuracy is not None else None,
        "mae": float(mae),
        "needs_retrain": needs_retrain,
        "drift_detected": drift_detected,
        "model_date": model_metadata.get('model_date') if model_metadata else None,
    }
