"""
Lambda para monitoramento de performance do modelo.

Implementa:
- Req 7.1: Calcular MAPE comparando predições de 20 dias atrás com preços reais
- Req 7.2: Calcular acurácia direcional (% de direções corretas)
- Req 7.3: Calcular MAE (Mean Absolute Error)
- Req 7.4: Calcular Sharpe Ratio (retorno ajustado por risco)
- Req 7.5: Calcular taxa de acerto (% de retornos positivos)
- Req 7.6: Executar diariamente após geração de recomendações
- Req 7.7: Armazenar histórico de métricas no S3
"""

import json
import logging
import os
import statistics
from datetime import UTC, datetime, timedelta
from typing import Dict, List, Optional, Tuple

import boto3

s3 = boto3.client("s3")
cloudwatch = boto3.client("cloudwatch")
logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET = os.environ["BUCKET"]
PREDICTION_HORIZON_DAYS = 20  # Horizonte de predição (t+20)


def load_predictions_from_date(date_str: str) -> Optional[Dict]:
    """
    Carrega recomendações (predições) de uma data específica.
    
    Args:
        date_str: Data no formato YYYY-MM-DD
    
    Returns:
        Dict com recomendações ou None se não encontrado
    """
    try:
        prefix = f"recommendations/dt={date_str}/"
        
        # Listar arquivos
        response = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix)
        
        if "Contents" not in response or len(response["Contents"]) == 0:
            logger.warning(f"No recommendations found for {date_str}")
            return None
        
        # Pegar último arquivo (mais recente)
        latest_file = sorted(response["Contents"], key=lambda x: x["Key"])[-1]
        key = latest_file["Key"]
        
        # Carregar dados
        obj = s3.get_object(Bucket=BUCKET, Key=key)
        data = json.loads(obj["Body"].read().decode("utf-8"))
        
        return data
        
    except Exception as e:
        logger.error(f"Error loading predictions from {date_str}: {e}")
        return None


def load_actual_prices(date_str: str, tickers: List[str]) -> Dict[str, float]:
    """
    Carrega preços reais (close) de uma data específica para lista de tickers.
    
    Args:
        date_str: Data no formato YYYY-MM-DD
        tickers: Lista de tickers
    
    Returns:
        Dict mapeando ticker -> preço de fechamento
    """
    actual_prices = {}
    
    try:
        prefix = f"quotes_5m/dt={date_str}/"
        
        # Listar arquivos
        paginator = s3.get_paginator("list_objects_v2")
        
        for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                
                # Verificar se é de um ticker que queremos
                ticker_match = None
                for ticker in tickers:
                    if f"/{ticker}_" in key:
                        ticker_match = ticker
                        break
                
                if not ticker_match:
                    continue
                
                try:
                    # Carregar cotação
                    obj_data = s3.get_object(Bucket=BUCKET, Key=key)
                    quote = json.loads(obj_data["Body"].read().decode("utf-8"))
                    
                    # Pegar preço de fechamento
                    close_price = quote.get("close")
                    
                    if close_price and close_price > 0:
                        # Atualizar com último preço (mais recente)
                        actual_prices[ticker_match] = close_price
                        
                except Exception as e:
                    logger.warning(f"Error loading quote from {key}: {e}")
                    continue
        
    except Exception as e:
        logger.error(f"Error loading actual prices for {date_str}: {e}")
    
    return actual_prices


def calculate_mape(predictions: List[float], actuals: List[float]) -> float:
    """
    Calcula MAPE (Mean Absolute Percentage Error).
    
    Implementa Req 7.1: MAPE = mean(|pred - actual| / actual) * 100
    
    Args:
        predictions: Lista de preços preditos
        actuals: Lista de preços reais
    
    Returns:
        MAPE em percentual
    """
    if len(predictions) != len(actuals) or len(predictions) == 0:
        return 0.0
    
    errors = []
    for pred, actual in zip(predictions, actuals):
        if actual > 0:
            error = abs(pred - actual) / actual
            errors.append(error)
    
    if not errors:
        return 0.0
    
    mape = statistics.mean(errors) * 100
    return mape


def calculate_directional_accuracy(
    predictions: List[float],
    actuals: List[float],
    baselines: List[float]
) -> float:
    """
    Calcula acurácia direcional (% de direções corretas).
    
    Implementa Req 7.2: % de vezes que o modelo acertou a direção do movimento.
    
    Args:
        predictions: Lista de preços preditos
        actuals: Lista de preços reais
        baselines: Lista de preços no momento da predição (t-20)
    
    Returns:
        Acurácia direcional em percentual
    """
    if len(predictions) != len(actuals) or len(predictions) != len(baselines):
        return 0.0
    
    if len(predictions) == 0:
        return 0.0
    
    correct_directions = 0
    
    for pred, actual, baseline in zip(predictions, actuals, baselines):
        if baseline <= 0:
            continue
        
        # Direção predita
        pred_direction = 1 if pred > baseline else -1
        
        # Direção real
        actual_direction = 1 if actual > baseline else -1
        
        # Verificar se acertou
        if pred_direction == actual_direction:
            correct_directions += 1
    
    accuracy = (correct_directions / len(predictions)) * 100
    return accuracy


def calculate_mae(predictions: List[float], actuals: List[float]) -> float:
    """
    Calcula MAE (Mean Absolute Error).
    
    Implementa Req 7.3: MAE = mean(|pred - actual|)
    
    Args:
        predictions: Lista de preços preditos
        actuals: Lista de preços reais
    
    Returns:
        MAE em valores absolutos
    """
    if len(predictions) != len(actuals) or len(predictions) == 0:
        return 0.0
    
    errors = [abs(pred - actual) for pred, actual in zip(predictions, actuals)]
    mae = statistics.mean(errors)
    return mae


def calculate_sharpe_ratio(returns: List[float], risk_free_rate: float = 0.0) -> float:
    """
    Calcula Sharpe Ratio (retorno ajustado por risco).
    
    Implementa Req 7.4: Sharpe = mean(returns) / std(returns)
    
    Args:
        returns: Lista de retornos
        risk_free_rate: Taxa livre de risco (padrão 0)
    
    Returns:
        Sharpe Ratio
    """
    if len(returns) < 2:
        return 0.0
    
    mean_return = statistics.mean(returns)
    std_return = statistics.stdev(returns)
    
    if std_return == 0:
        return 0.0
    
    sharpe = (mean_return - risk_free_rate) / std_return
    return sharpe


def calculate_hit_rate(returns: List[float]) -> float:
    """
    Calcula taxa de acerto (% de retornos positivos).
    
    Implementa Req 7.5: % de recomendações que geraram retorno positivo.
    
    Args:
        returns: Lista de retornos
    
    Returns:
        Taxa de acerto em percentual
    """
    if len(returns) == 0:
        return 0.0
    
    positive_returns = sum(1 for r in returns if r > 0)
    hit_rate = (positive_returns / len(returns)) * 100
    return hit_rate


def handler(event, context):
    """
    Monitora performance do modelo calculando múltiplas métricas.
    
    Implementa:
    - Req 7.1-7.5: Calcular 5 métricas de performance
    - Req 7.6: Executar diariamente (controlado por EventBridge)
    - Req 7.7: Armazenar histórico de métricas
    """
    now = datetime.now(UTC)
    today_str = now.date().isoformat()
    
    # Data da predição (20 dias atrás)
    prediction_date = (now.date() - timedelta(days=PREDICTION_HORIZON_DAYS)).isoformat()
    
    logger.info(f"Starting performance monitoring for predictions from {prediction_date}")
    
    try:
        # 1. Carregar predições de 20 dias atrás (Req 7.1)
        predictions_data = load_predictions_from_date(prediction_date)
        
        if not predictions_data:
            raise ValueError(f"No predictions found for {prediction_date}")
        
        recommendations = predictions_data.get("recommendations", [])
        
        if not recommendations:
            raise ValueError(f"No recommendations in predictions from {prediction_date}")
        
        logger.info(f"Loaded {len(recommendations)} predictions from {prediction_date}")
        
        # 2. Extrair tickers e preços preditos
        tickers = [rec["ticker"] for rec in recommendations]
        predicted_prices = [rec["predicted_price"] for rec in recommendations]
        baseline_prices = [rec["current_price"] for rec in recommendations]  # Preço no momento da predição
        
        # 3. Carregar preços reais de hoje (Req 7.1)
        actual_prices_dict = load_actual_prices(today_str, tickers)
        
        logger.info(f"Loaded actual prices for {len(actual_prices_dict)} tickers")
        
        # 4. Filtrar apenas tickers com preços reais disponíveis
        valid_predictions = []
        valid_actuals = []
        valid_baselines = []
        valid_tickers = []
        
        for i, ticker in enumerate(tickers):
            if ticker in actual_prices_dict:
                valid_predictions.append(predicted_prices[i])
                valid_actuals.append(actual_prices_dict[ticker])
                valid_baselines.append(baseline_prices[i])
                valid_tickers.append(ticker)
        
        if not valid_predictions:
            raise ValueError("No valid predictions with actual prices available")
        
        logger.info(f"Evaluating {len(valid_predictions)} predictions with actual prices")
        
        # 5. Calcular MAPE (Req 7.1)
        mape = calculate_mape(valid_predictions, valid_actuals)
        logger.info(f"MAPE: {mape:.2f}%")
        
        # 6. Calcular acurácia direcional (Req 7.2)
        directional_accuracy = calculate_directional_accuracy(
            valid_predictions,
            valid_actuals,
            valid_baselines
        )
        logger.info(f"Directional Accuracy: {directional_accuracy:.2f}%")
        
        # 7. Calcular MAE (Req 7.3)
        mae = calculate_mae(valid_predictions, valid_actuals)
        logger.info(f"MAE: {mae:.2f}")
        
        # 8. Calcular retornos para Sharpe Ratio e Hit Rate
        returns = []
        for actual, baseline in zip(valid_actuals, valid_baselines):
            if baseline > 0:
                ret = (actual - baseline) / baseline
                returns.append(ret)
        
        # 9. Calcular Sharpe Ratio (Req 7.4)
        sharpe_ratio = calculate_sharpe_ratio(returns)
        logger.info(f"Sharpe Ratio: {sharpe_ratio:.4f}")
        
        # 10. Calcular taxa de acerto (Req 7.5)
        hit_rate = calculate_hit_rate(returns)
        logger.info(f"Hit Rate: {hit_rate:.2f}%")
        
        # 11. Salvar métricas de performance (Req 7.7)
        performance_metrics = {
            "timestamp": now.isoformat(),
            "date": today_str,
            "prediction_date": prediction_date,
            "mape": mape,
            "directional_accuracy": directional_accuracy,
            "mae": mae,
            "sharpe_ratio": sharpe_ratio,
            "hit_rate": hit_rate,
            "samples_evaluated": len(valid_predictions),
            "tickers_evaluated": valid_tickers
        }
        
        perf_key = f"monitoring/performance/dt={today_str}/performance_{now.strftime('%H%M%S')}.json"
        s3.put_object(
            Bucket=BUCKET,
            Key=perf_key,
            Body=json.dumps(performance_metrics, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        
        logger.info(f"Saved performance metrics to {perf_key}")
        
        # 12. Publicar métricas no CloudWatch
        try:
            cloudwatch.put_metric_data(
                Namespace="B3TR",
                MetricData=[
                    {
                        "MetricName": "ModelMAPE",
                        "Value": mape,
                        "Unit": "Percent",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "DirectionalAccuracy",
                        "Value": directional_accuracy,
                        "Unit": "Percent",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "ModelMAE",
                        "Value": mae,
                        "Unit": "None",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "SharpeRatio",
                        "Value": sharpe_ratio,
                        "Unit": "None",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "HitRate",
                        "Value": hit_rate,
                        "Unit": "Percent",
                        "Timestamp": now
                    }
                ]
            )
        except Exception as e:
            logger.error(f"Error publishing CloudWatch metrics: {e}")
        
        return {
            "ok": True,
            "mape": mape,
            "directional_accuracy": directional_accuracy,
            "mae": mae,
            "sharpe_ratio": sharpe_ratio,
            "hit_rate": hit_rate,
            "samples_evaluated": len(valid_predictions),
            "performance_key": perf_key
        }
        
    except Exception as e:
        logger.error(f"Error in performance monitoring: {e}", exc_info=True)
        
        # Salvar erro
        error_key = f"monitoring/performance/dt={today_str}/error_{now.strftime('%H%M%S')}.json"
        error_data = {
            "timestamp": now.isoformat(),
            "status": "error",
            "error_message": str(e),
            "error_type": type(e).__name__,
            "prediction_date": prediction_date
        }
        
        s3.put_object(
            Bucket=BUCKET,
            Key=error_key,
            Body=json.dumps(error_data).encode("utf-8"),
            ContentType="application/json",
        )
        
        return {"ok": False, "error": str(e)}
