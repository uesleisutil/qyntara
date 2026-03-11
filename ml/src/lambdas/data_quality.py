"""
Lambda para validação de qualidade dos dados ingeridos diariamente.

Implementa:
- Req 3.3, 3.4: Validação de invariantes de cotações (high >= low, preços positivos, volume >= 0)
- Req 4.1, 4.2: Cálculo de métricas de qualidade (completude, latência, taxa de erro)
- Req 4.3: Geração de alertas quando completude < 90%
- Req 4.4, 4.5: Detecção de anomalias (variações > 50% vs dia anterior)
- Req 4.6: Armazenamento de histórico de métricas
- Req 17.2, 17.3, 17.4: Validação de completude e identificação de tickers faltantes
- Req 5.3: Tracking de transformações aplicadas aos dados
"""

import json
import logging
import os
from datetime import UTC, datetime, timedelta
from typing import Dict, List, Optional, Tuple

import boto3

s3 = boto3.client("s3")
cloudwatch = boto3.client("cloudwatch")
logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET = os.environ["BUCKET"]
UNIVERSE_KEY = os.environ.get("B3TR_UNIVERSE_S3_KEY", "config/universe.txt")


def load_universe() -> List[str]:
    """
    Carrega lista de tickers do S3.
    
    Returns:
        Lista de tickers configurados
    """
    try:
        obj = s3.get_object(Bucket=BUCKET, Key=UNIVERSE_KEY)
        universe = obj["Body"].read().decode("utf-8").strip().split("\n")
        # Filtrar comentários e linhas vazias
        universe = [t.strip() for t in universe if t.strip() and not t.strip().startswith("#")]
        return universe
    except Exception as e:
        logger.error(f"Error loading universe from {UNIVERSE_KEY}: {e}")
        return []


def validate_quote(quote: Dict) -> Tuple[bool, List[str]]:
    """
    Valida invariantes de uma cotação.
    
    Implementa Req 3.3, 3.4:
    - high >= low
    - open, high, low, close > 0
    - volume >= 0
    
    Args:
        quote: Dicionário com dados da cotação
    
    Returns:
        Tuple (is_valid, list_of_errors)
    """
    errors = []
    
    # Validar campos obrigatórios
    required_fields = ["ticker", "timestamp", "open", "high", "low", "close", "volume"]
    for field in required_fields:
        if field not in quote:
            errors.append(f"missing_field_{field}")
    
    if errors:
        return False, errors
    
    # Validar high >= low (Req 3.3)
    if quote["high"] < quote["low"]:
        errors.append("high_less_than_low")
    
    # Validar preços positivos (Req 3.3)
    for field in ["open", "high", "low", "close"]:
        if quote[field] <= 0:
            errors.append(f"non_positive_{field}")
    
    # Validar volume não-negativo (Req 3.4)
    if quote["volume"] < 0:
        errors.append("negative_volume")
    
    return len(errors) == 0, errors


def load_quotes_for_date(date_str: str) -> Dict[str, List[Dict]]:
    """
    Carrega todas as cotações de uma data específica.
    
    Args:
        date_str: Data no formato YYYY-MM-DD
    
    Returns:
        Dict mapeando ticker -> lista de cotações
    """
    quotes_by_ticker = {}
    
    try:
        prefix = f"quotes_5m/dt={date_str}/"
        paginator = s3.get_paginator("list_objects_v2")
        
        for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                
                try:
                    # Carregar cotação
                    obj_data = s3.get_object(Bucket=BUCKET, Key=key)
                    quote = json.loads(obj_data["Body"].read().decode("utf-8"))
                    
                    ticker = quote.get("ticker", "UNKNOWN")
                    
                    if ticker not in quotes_by_ticker:
                        quotes_by_ticker[ticker] = []
                    
                    quotes_by_ticker[ticker].append(quote)
                    
                except Exception as e:
                    logger.warning(f"Error loading quote from {key}: {e}")
                    continue
        
    except Exception as e:
        logger.error(f"Error listing quotes for {date_str}: {e}")
    
    return quotes_by_ticker


def calculate_completeness(
    quotes_by_ticker: Dict[str, List[Dict]],
    universe: List[str]
) -> Tuple[float, List[str]]:
    """
    Calcula completude dos dados.
    
    Implementa Req 4.2, 17.2: Calcular taxa de completude (% de tickers com dados).
    Implementa Req 17.4: Identificar quais tickers específicos faltam dados.
    
    Args:
        quotes_by_ticker: Cotações por ticker
        universe: Lista de tickers esperados
    
    Returns:
        Tuple (completeness_percentage, missing_tickers)
    """
    tickers_with_data = set(quotes_by_ticker.keys())
    expected_tickers = set(universe)
    
    missing_tickers = sorted(expected_tickers - tickers_with_data)
    
    if len(expected_tickers) == 0:
        return 0.0, []
    
    completeness = (len(tickers_with_data) / len(expected_tickers)) * 100
    
    return completeness, missing_tickers


def detect_anomalies(
    current_quotes: Dict[str, List[Dict]],
    previous_quotes: Dict[str, List[Dict]]
) -> List[Dict]:
    """
    Detecta anomalias comparando com dia anterior.
    
    Implementa Req 4.4, 4.5: Detectar variações > 50% em volume ou preço.
    
    Args:
        current_quotes: Cotações do dia atual
        previous_quotes: Cotações do dia anterior
    
    Returns:
        Lista de anomalias detectadas
    """
    anomalies = []
    
    for ticker in current_quotes:
        if ticker not in previous_quotes:
            continue
        
        # Pegar última cotação de cada dia
        current_last = current_quotes[ticker][-1] if current_quotes[ticker] else None
        previous_last = previous_quotes[ticker][-1] if previous_quotes[ticker] else None
        
        if not current_last or not previous_last:
            continue
        
        # Comparar volume (Req 4.4)
        current_volume = current_last.get("volume", 0)
        previous_volume = previous_last.get("volume", 1)  # Evitar divisão por zero
        
        if previous_volume > 0:
            volume_change = abs(current_volume - previous_volume) / previous_volume
            
            if volume_change > 0.5:  # 50%
                anomalies.append({
                    "ticker": ticker,
                    "date": current_last.get("timestamp", "")[:10],
                    "metric": "volume",
                    "current_value": current_volume,
                    "previous_value": previous_volume,
                    "change_percentage": volume_change * 100
                })
        
        # Comparar preço de fechamento (Req 4.5)
        current_close = current_last.get("close", 0)
        previous_close = previous_last.get("close", 1)
        
        if previous_close > 0:
            price_change = abs(current_close - previous_close) / previous_close
            
            if price_change > 0.5:  # 50%
                anomalies.append({
                    "ticker": ticker,
                    "date": current_last.get("timestamp", "")[:10],
                    "metric": "price",
                    "current_value": current_close,
                    "previous_value": previous_close,
                    "change_percentage": price_change * 100
                })
    
    return anomalies


def calculate_quality_score(
    completeness: float,
    validation_errors: int,
    total_quotes: int
) -> float:
    """
    Calcula score de qualidade (0-100).
    
    Implementa Req 3.6: Calcular score de qualidade baseado em completude e consistência.
    
    Args:
        completeness: Percentual de completude (0-100)
        validation_errors: Número de erros de validação
        total_quotes: Total de cotações processadas
    
    Returns:
        Score de qualidade (0-100)
    """
    # Peso 70% para completude, 30% para consistência
    completeness_score = completeness * 0.7
    
    # Consistência: % de cotações válidas
    if total_quotes > 0:
        consistency = ((total_quotes - validation_errors) / total_quotes) * 100
    else:
        consistency = 0.0
    
    consistency_score = consistency * 0.3
    
    return completeness_score + consistency_score


def update_lineage_with_validation(
    date_str: str,
    validation_results: Dict[str, Dict]
) -> None:
    """
    Atualiza registros de lineage com resultados de validação.
    
    Implementa Req 5.3: Registrar transformações aplicadas aos dados.
    
    Args:
        date_str: Data no formato YYYY-MM-DD
        validation_results: Dict mapeando data_id -> resultado de validação
    """
    try:
        # Carregar registros de lineage existentes
        lineage_prefix = f"monitoring/lineage/dt={date_str}/"
        paginator = s3.get_paginator("list_objects_v2")
        
        for page in paginator.paginate(Bucket=BUCKET, Prefix=lineage_prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                
                try:
                    # Carregar arquivo de lineage
                    obj_data = s3.get_object(Bucket=BUCKET, Key=key)
                    lineage_data = json.loads(obj_data["Body"].read().decode("utf-8"))
                    
                    # Atualizar cada registro com resultado de validação
                    updated = False
                    for record in lineage_data.get("records", []):
                        data_id = record.get("data_id")
                        
                        if data_id in validation_results:
                            # Adicionar transformação de validação
                            validation_result = validation_results[data_id]
                            transformation = {
                                "type": "validation",
                                "timestamp": datetime.now(UTC).isoformat(),
                                "status": "passed" if validation_result["is_valid"] else "failed",
                                "details": {
                                    "errors": validation_result.get("errors", []),
                                    "quality_score": validation_result.get("quality_score")
                                }
                            }
                            
                            if "transformations" not in record:
                                record["transformations"] = []
                            
                            record["transformations"].append(transformation)
                            updated = True
                    
                    # Salvar arquivo atualizado se houve mudanças
                    if updated:
                        s3.put_object(
                            Bucket=BUCKET,
                            Key=key,
                            Body=json.dumps(lineage_data, indent=2).encode("utf-8"),
                            ContentType="application/json",
                        )
                        logger.info(f"Updated lineage file: {key}")
                
                except Exception as e:
                    logger.warning(f"Error updating lineage file {key}: {e}")
                    continue
    
    except Exception as e:
        logger.error(f"Error updating lineage records: {e}")


def handler(event, context):
    """
    Valida qualidade dos dados ingeridos diariamente.
    
    Implementa:
    - Req 4.1: Calcular Data_Quality_Metrics quando novos dados são ingeridos
    - Req 4.3: Gerar alerta quando completude < 90%
    - Req 4.6: Armazenar histórico de métricas
    """
    now = datetime.now(UTC)
    today_str = now.date().isoformat()
    yesterday_str = (now.date() - timedelta(days=1)).isoformat()
    
    logger.info(f"Starting data quality validation for {today_str}")
    
    try:
        # 1. Carregar universo de tickers
        universe = load_universe()
        logger.info(f"Universe: {len(universe)} tickers")
        
        if not universe:
            raise ValueError("Universe is empty")
        
        # 2. Carregar cotações de hoje
        current_quotes = load_quotes_for_date(today_str)
        logger.info(f"Loaded quotes for {len(current_quotes)} tickers today")
        
        # 3. Validar cotações (Req 3.3, 3.4)
        validation_errors = []
        validation_results = {}  # Para tracking de lineage
        total_quotes = 0
        
        for ticker, quotes in current_quotes.items():
            for quote in quotes:
                total_quotes += 1
                is_valid, errors = validate_quote(quote)
                
                # Criar data_id para tracking de lineage
                if "timestamp" in quote:
                    try:
                        dt = datetime.fromisoformat(quote["timestamp"].replace("Z", "+00:00"))
                        data_id = f"{ticker}_{dt.strftime('%Y%m%d_%H%M%S')}"
                        
                        validation_results[data_id] = {
                            "is_valid": is_valid,
                            "errors": errors,
                            "quality_score": 100.0 if is_valid else 0.0
                        }
                    except Exception:
                        pass
                
                if not is_valid:
                    validation_errors.append({
                        "ticker": ticker,
                        "timestamp": quote.get("timestamp"),
                        "errors": errors
                    })
        
        logger.info(f"Validated {total_quotes} quotes, found {len(validation_errors)} errors")
        
        # 4. Calcular completude (Req 4.2, 17.2, 17.4)
        completeness, missing_tickers = calculate_completeness(current_quotes, universe)
        logger.info(f"Completeness: {completeness:.2f}%, missing: {len(missing_tickers)} tickers")
        
        # 5. Detectar anomalias (Req 4.4, 4.5)
        previous_quotes = load_quotes_for_date(yesterday_str)
        anomalies = detect_anomalies(current_quotes, previous_quotes)
        logger.info(f"Detected {len(anomalies)} anomalies")
        
        # 6. Calcular latência média de ingestão (Req 4.2)
        ingestion_latencies = []
        for ticker, quotes in current_quotes.items():
            for quote in quotes:
                if "timestamp" in quote and "ingested_at" in quote:
                    try:
                        data_time = datetime.fromisoformat(quote["timestamp"].replace("Z", "+00:00"))
                        ingest_time = datetime.fromisoformat(quote["ingested_at"].replace("Z", "+00:00"))
                        latency_ms = (ingest_time - data_time).total_seconds() * 1000
                        ingestion_latencies.append(latency_ms)
                    except Exception:
                        pass
        
        avg_latency = sum(ingestion_latencies) / len(ingestion_latencies) if ingestion_latencies else 0.0
        
        # 7. Calcular taxa de erro (Req 4.2)
        error_rate = (len(validation_errors) / total_quotes * 100) if total_quotes > 0 else 0.0
        
        # 8. Calcular quality score (Req 3.6)
        quality_score = calculate_quality_score(completeness, len(validation_errors), total_quotes)
        
        # 8.1. Atualizar registros de lineage com resultados de validação (Req 5.3)
        if validation_results:
            logger.info(f"Updating {len(validation_results)} lineage records with validation results")
            update_lineage_with_validation(today_str, validation_results)
        
        # 9. Gerar alerta se completude < 90% (Req 4.3, 17.3)
        alert_generated = False
        alert_severity = None
        
        if completeness < 90:
            alert_severity = "critical"
            alert_generated = True
            logger.error(f"CRITICAL: Completeness below 90%: {completeness:.2f}%")
        elif completeness < 95:
            alert_severity = "warning"
            alert_generated = True
            logger.warning(f"WARNING: Completeness below 95%: {completeness:.2f}%")
        
        # 10. Salvar métricas de qualidade (Req 4.6)
        quality_metrics = {
            "timestamp": now.isoformat(),
            "date": today_str,
            "completeness_percentage": completeness,
            "missing_tickers": missing_tickers,
            "avg_ingestion_latency_ms": avg_latency,
            "error_rate": error_rate,
            "anomalies": anomalies,
            "quality_score": quality_score,
            "validation_errors_count": len(validation_errors),
            "total_quotes": total_quotes,
            "alert_generated": alert_generated,
            "alert_severity": alert_severity
        }
        
        quality_key = f"monitoring/data_quality/dt={today_str}/quality_{now.strftime('%H%M%S')}.json"
        s3.put_object(
            Bucket=BUCKET,
            Key=quality_key,
            Body=json.dumps(quality_metrics, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        
        # 11. Salvar completude separadamente (Req 17.5)
        completeness_data = {
            "timestamp": now.isoformat(),
            "date": today_str,
            "completeness_percentage": completeness,
            "tickers_with_data": len(current_quotes),
            "tickers_expected": len(universe),
            "missing_tickers": missing_tickers
        }
        
        completeness_key = f"monitoring/completeness/dt={today_str}/completeness_{now.strftime('%H%M%S')}.json"
        s3.put_object(
            Bucket=BUCKET,
            Key=completeness_key,
            Body=json.dumps(completeness_data, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        
        # 12. Salvar erros de validação detalhados
        if validation_errors:
            errors_key = f"monitoring/data_quality/dt={today_str}/validation_errors_{now.strftime('%H%M%S')}.json"
            s3.put_object(
                Bucket=BUCKET,
                Key=errors_key,
                Body=json.dumps({"errors": validation_errors}, indent=2).encode("utf-8"),
                ContentType="application/json",
            )
        
        # 13. Publicar métricas no CloudWatch
        try:
            cloudwatch.put_metric_data(
                Namespace="B3TR",
                MetricData=[
                    {
                        "MetricName": "DataCompleteness",
                        "Value": completeness,
                        "Unit": "Percent",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "DataQualityScore",
                        "Value": quality_score,
                        "Unit": "None",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "ValidationErrors",
                        "Value": len(validation_errors),
                        "Unit": "Count",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "AnomaliesDetected",
                        "Value": len(anomalies),
                        "Unit": "Count",
                        "Timestamp": now
                    }
                ]
            )
        except Exception as e:
            logger.error(f"Error publishing CloudWatch metrics: {e}")
        
        return {
            "ok": True,
            "completeness": completeness,
            "quality_score": quality_score,
            "validation_errors": len(validation_errors),
            "anomalies": len(anomalies),
            "alert_generated": alert_generated,
            "quality_key": quality_key
        }
        
    except Exception as e:
        logger.error(f"Error in data quality validation: {e}", exc_info=True)
        
        # Salvar erro
        error_key = f"monitoring/data_quality/dt={today_str}/error_{now.strftime('%H%M%S')}.json"
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
