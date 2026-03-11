"""
Lambda para geração de recomendações diárias usando ensemble de modelos.

Implementa:
- Req 6.1: Gerar recomendações uma vez por dia após fechamento do mercado (18:30 BRT)
- Req 6.2: Usar dados ingeridos do mesmo dia
- Req 6.3: Gerar predições de preço para horizonte de 20 dias (t+20)
- Req 6.4: Incluir ticker, preço atual, preço predito, retorno esperado, score, ranking
- Req 6.5: Selecionar top 50 ações com maior score de confiança
- Req 6.6: Armazenar resultado no S3
- Req 18.1, 18.2: Registrar pesos do ensemble
"""

import json
import logging
import os
from datetime import UTC, datetime, timedelta
from typing import Dict, List, Optional, Tuple
import statistics

import boto3

s3 = boto3.client("s3")
sagemaker_runtime = boto3.client("sagemaker-runtime")
cloudwatch = boto3.client("cloudwatch")
logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET = os.environ["BUCKET"]
UNIVERSE_KEY = os.environ.get("B3TR_UNIVERSE_S3_KEY", "config/universe.txt")
SAGEMAKER_ENDPOINT = os.environ.get("SAGEMAKER_ENDPOINT", "b3tr-ensemble-endpoint")
PREDICTION_HORIZON_DAYS = 20  # Req 6.3


def load_universe() -> List[str]:
    """
    Carrega lista de tickers do S3.
    
    Returns:
        Lista de tickers configurados
    """
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=UNIVERSE_KEY)
        universe = obj["Body"].read().decode("utf-8").strip().split("\n")
        universe = [t.strip() for t in universe if t.strip() and not t.strip().startswith("#")]
        return universe
    except Exception as e:
        logger.error(f"Error loading universe from {UNIVERSE_KEY}: {e}")
        return []


def load_quotes_for_ticker(ticker: str, days: int = 60) -> List[Dict]:
    """
    Carrega cotações históricas de um ticker.
    
    Implementa Req 6.2: Preparar features (últimos 60 dias de contexto).
    
    Args:
        ticker: Símbolo da ação
        days: Número de dias de histórico
    
    Returns:
        Lista de cotações ordenadas por data
    """
    quotes = []
    
    try:
        # Carregar dados dos últimos N dias
        for i in range(days):
            date = (datetime.now(UTC).date() - timedelta(days=i)).isoformat()
            prefix = f"quotes_5m/dt={date}/"
            
            try:
                paginator = s3.get_paginator("list_objects_v2")
                for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
                    for obj in page.get("Contents", []):
                        key = obj["Key"]
                        
                        # Filtrar apenas arquivos do ticker
                        if f"/{ticker}_" in key:
                            try:
                                obj_data = s3.get_object(Bucket=BUCKET, Key=key)
                                quote = json.loads(obj_data["Body"].read().decode("utf-8"))
                                quotes.append(quote)
                            except Exception as e:
                                logger.warning(f"Error loading quote from {key}: {e}")
                                continue
            except Exception:
                # Data pode não existir (fim de semana, feriado)
                continue
        
        # Ordenar por timestamp
        quotes.sort(key=lambda x: x.get("timestamp", ""))
        
    except Exception as e:
        logger.error(f"Error loading quotes for {ticker}: {e}")
    
    return quotes


def prepare_features(quotes: List[Dict]) -> Optional[Dict]:
    """
    Prepara features para o modelo a partir das cotações.
    
    Args:
        quotes: Lista de cotações históricas
    
    Returns:
        Dict com features ou None se dados insuficientes
    """
    if len(quotes) < 20:  # Mínimo de dados necessários
        return None
    
    try:
        # Pegar últimas cotações
        recent_quotes = quotes[-60:] if len(quotes) >= 60 else quotes
        
        # Calcular features básicas
        closes = [q["close"] for q in recent_quotes if "close" in q]
        volumes = [q["volume"] for q in recent_quotes if "volume" in q]
        
        if not closes or not volumes:
            return None
        
        # Features de preço
        current_price = closes[-1]
        price_mean_20 = statistics.mean(closes[-20:]) if len(closes) >= 20 else current_price
        price_std_20 = statistics.stdev(closes[-20:]) if len(closes) >= 20 else 0.0
        
        # Features de volume
        volume_mean = statistics.mean(volumes)
        volume_std = statistics.stdev(volumes) if len(volumes) > 1 else 0.0
        
        # Retornos
        returns = []
        for i in range(1, len(closes)):
            ret = (closes[i] - closes[i-1]) / closes[i-1]
            returns.append(ret)
        
        return_mean = statistics.mean(returns) if returns else 0.0
        return_std = statistics.stdev(returns) if len(returns) > 1 else 0.0
        
        # Features finais
        features = {
            "current_price": current_price,
            "price_mean_20": price_mean_20,
            "price_std_20": price_std_20,
            "volume_mean": volume_mean,
            "volume_std": volume_std,
            "return_mean": return_mean,
            "return_std": return_std,
            "volatility": return_std,
            "momentum": (current_price - price_mean_20) / price_mean_20 if price_mean_20 > 0 else 0.0
        }
        
        return features
        
    except Exception as e:
        logger.error(f"Error preparing features: {e}")
        return None


def invoke_sagemaker_endpoint(features: Dict) -> Optional[Dict]:
    """
    Invoca SageMaker endpoint para obter predições do ensemble.
    
    Implementa Req 6.2: Invocar SageMaker endpoint e coletar predições dos 4 modelos.
    
    Args:
        features: Features preparadas
    
    Returns:
        Dict com predições de cada modelo ou None se erro
    """
    try:
        # Preparar payload
        payload = json.dumps(features)
        
        # Invocar endpoint
        response = sagemaker_runtime.invoke_endpoint(
            EndpointName=SAGEMAKER_ENDPOINT,
            ContentType="application/json",
            Body=payload
        )
        
        # Parse resposta
        result = json.loads(response["Body"].read().decode("utf-8"))
        
        return result
        
    except Exception as e:
        logger.error(f"Error invoking SageMaker endpoint: {e}")
        return None


def calculate_ensemble_prediction(
    model_predictions: Dict,
    adaptive_weights: bool = True
) -> Tuple[float, Dict[str, float]]:
    """
    Calcula predição ensemble usando pesos adaptativos.
    
    Implementa Req 6.2: Calcular predição ensemble usando pesos adaptativos.
    
    Args:
        model_predictions: Dict com predições de cada modelo
        adaptive_weights: Se True, usa pesos adaptativos baseados em performance histórica
    
    Returns:
        Tuple (ensemble_prediction, weights_used)
    """
    # Modelos disponíveis
    models = ["xgboost", "lstm", "prophet", "deepar"]
    
    # Pesos padrão (iguais)
    default_weights = {model: 0.25 for model in models}
    
    if not adaptive_weights:
        weights = default_weights
    else:
        # TODO: Carregar pesos adaptativos baseados em performance histórica
        # Por enquanto, usar pesos iguais
        weights = default_weights
    
    # Calcular predição ensemble
    ensemble_pred = 0.0
    total_weight = 0.0
    
    for model in models:
        if model in model_predictions and model_predictions[model] is not None:
            ensemble_pred += model_predictions[model] * weights[model]
            total_weight += weights[model]
    
    # Normalizar se nem todos os modelos retornaram predição
    if total_weight > 0:
        ensemble_pred = ensemble_pred / total_weight
    
    return ensemble_pred, weights


def calculate_confidence_score(model_predictions: Dict) -> float:
    """
    Calcula score de confiança baseado em concordância dos modelos.
    
    Implementa Req 6.4: Calcular score de confiança baseado em concordância dos modelos.
    
    Args:
        model_predictions: Dict com predições de cada modelo
    
    Returns:
        Score de confiança (0-1)
    """
    # Coletar predições válidas
    predictions = [
        pred for pred in model_predictions.values()
        if pred is not None and pred > 0
    ]
    
    if len(predictions) < 2:
        return 0.0
    
    # Calcular desvio padrão relativo
    mean_pred = statistics.mean(predictions)
    std_pred = statistics.stdev(predictions)
    
    # Coeficiente de variação (menor = maior concordância)
    cv = std_pred / mean_pred if mean_pred > 0 else 1.0
    
    # Converter para score de confiança (0-1)
    # cv baixo = alta confiança
    confidence = max(0.0, min(1.0, 1.0 - cv))
    
    return confidence


def generate_recommendations(universe: List[str]) -> List[Dict]:
    """
    Gera recomendações para todos os tickers do universo.
    
    Implementa:
    - Req 6.2: Carregar dados e preparar features
    - Req 6.3: Gerar predições para horizonte de 20 dias
    - Req 6.4: Calcular retorno esperado e score de confiança
    
    Args:
        universe: Lista de tickers
    
    Returns:
        Lista de recomendações
    """
    recommendations = []
    
    for ticker in universe:
        try:
            logger.info(f"Processing {ticker}...")
            
            # 1. Carregar cotações históricas (Req 6.2)
            quotes = load_quotes_for_ticker(ticker, days=60)
            
            if not quotes:
                logger.warning(f"No quotes found for {ticker}")
                continue
            
            # 2. Preparar features
            features = prepare_features(quotes)
            
            if not features:
                logger.warning(f"Could not prepare features for {ticker}")
                continue
            
            current_price = features["current_price"]
            
            # 3. Invocar SageMaker endpoint (Req 6.2)
            model_predictions = invoke_sagemaker_endpoint(features)
            
            if not model_predictions:
                logger.warning(f"No predictions from SageMaker for {ticker}")
                continue
            
            # 4. Calcular predição ensemble (Req 6.2)
            predicted_price, weights = calculate_ensemble_prediction(model_predictions)
            
            # 5. Calcular retorno esperado (Req 6.4)
            expected_return = (predicted_price - current_price) / current_price if current_price > 0 else 0.0
            
            # 6. Calcular score de confiança (Req 6.4)
            confidence_score = calculate_confidence_score(model_predictions)
            
            # 7. Criar recomendação
            recommendation = {
                "ticker": ticker,
                "current_price": current_price,
                "predicted_price": predicted_price,
                "expected_return": expected_return * 100,  # Converter para percentual
                "confidence_score": confidence_score,
                "model_contributions": {
                    "xgboost": model_predictions.get("xgboost"),
                    "lstm": model_predictions.get("lstm"),
                    "prophet": model_predictions.get("prophet"),
                    "deepar": model_predictions.get("deepar")
                },
                "ensemble_weights": weights,
                "prediction_horizon_days": PREDICTION_HORIZON_DAYS
            }
            
            recommendations.append(recommendation)
            
        except Exception as e:
            logger.error(f"Error processing {ticker}: {e}")
            continue
    
    return recommendations


def rank_and_select_top(recommendations: List[Dict], top_n: int = 50) -> List[Dict]:
    """
    Ranqueia recomendações por score de confiança e seleciona top N.
    
    Implementa Req 6.5: Ranquear ações por score de confiança e selecionar top 50.
    
    Args:
        recommendations: Lista de recomendações
        top_n: Número de recomendações a selecionar
    
    Returns:
        Lista de top N recomendações ranqueadas
    """
    # Ordenar por score de confiança (descendente)
    sorted_recs = sorted(
        recommendations,
        key=lambda x: x["confidence_score"],
        reverse=True
    )
    
    # Selecionar top N
    top_recs = sorted_recs[:top_n]
    
    # Adicionar ranking
    for i, rec in enumerate(top_recs, start=1):
        rec["rank"] = i
    
    return top_recs


def handler(event, context):
    """
    Gera recomendações diárias usando ensemble de modelos.
    
    Implementa:
    - Req 6.1: Executar após fechamento do mercado (controlado por EventBridge)
    - Req 6.6: Armazenar resultado no S3
    - Req 18.1, 18.2: Registrar pesos do ensemble
    """
    now = datetime.now(UTC)
    today_str = now.date().isoformat()
    
    logger.info(f"Starting recommendations generation for {today_str}")
    
    try:
        # 1. Carregar universo de tickers
        universe = load_universe()
        logger.info(f"Universe: {len(universe)} tickers")
        
        if not universe:
            raise ValueError("Universe is empty")
        
        # 2. Gerar recomendações para todos os tickers
        recommendations = generate_recommendations(universe)
        logger.info(f"Generated {len(recommendations)} recommendations")
        
        if not recommendations:
            raise ValueError("No recommendations generated")
        
        # 3. Ranquear e selecionar top 50 (Req 6.5)
        top_recommendations = rank_and_select_top(recommendations, top_n=50)
        logger.info(f"Selected top {len(top_recommendations)} recommendations")
        
        # 4. Calcular estatísticas
        avg_expected_return = statistics.mean([r["expected_return"] for r in top_recommendations])
        avg_confidence = statistics.mean([r["confidence_score"] for r in top_recommendations])
        
        # 5. Extrair pesos do ensemble (Req 18.1)
        # Usar pesos da primeira recomendação (todos usam os mesmos pesos)
        ensemble_weights = top_recommendations[0]["ensemble_weights"] if top_recommendations else {}
        
        # 6. Salvar recomendações no S3 (Req 6.6)
        recommendations_data = {
            "timestamp": now.isoformat(),
            "date": today_str,
            "prediction_horizon_days": PREDICTION_HORIZON_DAYS,
            "total_recommendations": len(top_recommendations),
            "avg_expected_return": avg_expected_return,
            "avg_confidence_score": avg_confidence,
            "recommendations": top_recommendations
        }
        
        recs_key = f"recommendations/dt={today_str}/recommendations_{now.strftime('%H%M%S')}.json"
        s3.put_object(
            Bucket=BUCKET,
            Key=recs_key,
            Body=json.dumps(recommendations_data, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        
        logger.info(f"Saved recommendations to {recs_key}")
        
        # 7. Salvar pesos do ensemble (Req 18.2)
        weights_data = {
            "timestamp": now.isoformat(),
            "date": today_str,
            "weights": ensemble_weights
        }
        
        weights_key = f"monitoring/ensemble_weights/dt={today_str}/weights_{now.strftime('%H%M%S')}.json"
        s3.put_object(
            Bucket=BUCKET,
            Key=weights_key,
            Body=json.dumps(weights_data, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        
        logger.info(f"Saved ensemble weights to {weights_key}")
        
        # 8. Publicar métricas no CloudWatch
        try:
            cloudwatch.put_metric_data(
                Namespace="B3TR",
                MetricData=[
                    {
                        "MetricName": "RecommendationsGenerated",
                        "Value": len(top_recommendations),
                        "Unit": "Count",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "AvgExpectedReturn",
                        "Value": avg_expected_return,
                        "Unit": "Percent",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "AvgConfidenceScore",
                        "Value": avg_confidence,
                        "Unit": "None",
                        "Timestamp": now
                    }
                ]
            )
        except Exception as e:
            logger.error(f"Error publishing CloudWatch metrics: {e}")
        
        return {
            "ok": True,
            "recommendations_count": len(top_recommendations),
            "avg_expected_return": avg_expected_return,
            "avg_confidence_score": avg_confidence,
            "recommendations_key": recs_key
        }
        
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}", exc_info=True)
        
        # Salvar erro
        error_key = f"recommendations/dt={today_str}/error_{now.strftime('%H%M%S')}.json"
        error_data = {
            "timestamp": now.isoformat(),
            "status": "error",
            "error_message": str(e),
            "error_type": type(e).__name__
        }
        
        s3.put_object(
            Bucket=BUCKET,
            Key=error_key,
            Body=json.dumps(error_data).encode("utf-8"),
            ContentType="application/json",
        )
        
        return {"ok": False, "error": str(e)}
