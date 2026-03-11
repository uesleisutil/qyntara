"""
Lambda para ingestão de cotações de 5 minutos da BRAPI.

Implementa:
- Integração com AWS Secrets Manager para token BRAPI (Req 1.1, 1.2)
- Leitura de lista de 50 tickers do S3 (Req 2.2)
- Batching de 20 tickers por request (Req 2.3)
- Retry logic com backoff exponencial (Req 2.4, 19.1-19.4)
- Medição de latência (p50, p95, p99) (Req 16.1, 16.2)
- Salvamento com particionamento por data (Req 2.5, 2.6)
- Tracking de lineage de dados (Req 5.1, 5.2, 5.3, 5.4, 5.5)
"""

import json
import os
import random
import time
from datetime import UTC, datetime
from typing import Dict, List, Optional, Tuple
import logging

import boto3
import requests

s3 = boto3.client("s3")
secrets = boto3.client("secretsmanager")
cloudwatch = boto3.client("cloudwatch")
logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET = os.environ["BUCKET"]
BRAPI_SECRET_ID = os.environ.get("BRAPI_SECRET_ID", "brapi/pro/token")
BATCH_SIZE = 20  # Máximo de tickers por request (Req 2.3)
RATE_LIMIT_DELAY = 0.5  # 500ms entre requests (Req 2.3)
MAX_RETRIES = 3  # Máximo de tentativas (Req 2.4, 19.3)
PIPELINE_VERSION = "1.0.0"  # Versão do pipeline para lineage tracking


def get_brapi_token() -> str:
    """
    Carrega token da BRAPI do Secrets Manager.
    
    Implementa Req 1.1, 1.2: Credenciais armazenadas no Secrets Manager,
    fornecidas sem exposição em logs.
    
    Returns:
        Token BRAPI ou string vazia se não disponível
    """
    try:
        resp = secrets.get_secret_value(SecretId=BRAPI_SECRET_ID)
        secret_str = resp.get("SecretString", "")
        
        # Pode ser JSON {"token": "..."} ou string simples
        try:
            secret_data = json.loads(secret_str)
            token = secret_data.get("token", secret_str)
        except json.JSONDecodeError:
            token = secret_str
        
        # IMPORTANTE: Não logar o token (Req 1.2)
        if token:
            logger.info("BRAPI token loaded successfully from Secrets Manager")
        else:
            logger.warning("BRAPI token is empty")
        
        return token
    except Exception as e:
        logger.error(f"Error loading BRAPI token from Secrets Manager: {e}")
        return ""


def fetch_with_retry(
    url: str,
    params: Dict,
    max_retries: int = MAX_RETRIES
) -> Tuple[Optional[Dict], Optional[str], float]:
    """
    Faz request HTTP com retry logic e backoff exponencial.
    
    Implementa:
    - Req 2.4: Retry com backoff exponencial (máximo 3 tentativas)
    - Req 19.1: Retry com backoff exponencial (1s, 2s, 4s)
    - Req 19.2: Aguardar tempo do header Retry-After para erro 429
    - Req 19.3: Retry até 3 vezes para erros 5xx
    - Req 19.4: Registrar erro e pular para erros 4xx (exceto 429)
    - Req 16.1: Medir tempo de resposta
    
    Args:
        url: URL da API
        params: Parâmetros da query
        max_retries: Número máximo de tentativas
    
    Returns:
        Tuple (data, error_message, latency_ms)
    """
    for attempt in range(max_retries):
        try:
            start_time = time.time()
            response = requests.get(url, params=params, timeout=30)
            latency_ms = (time.time() - start_time) * 1000
            
            # Sucesso
            if response.status_code == 200:
                data = response.json()
                return data, None, latency_ms
            
            # Erro 429: Rate limit (Req 19.2)
            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After", "60")
                try:
                    wait_time = int(retry_after)
                except ValueError:
                    wait_time = 60
                
                logger.warning(
                    f"Rate limit hit (429). Waiting {wait_time}s before retry. "
                    f"Attempt {attempt + 1}/{max_retries}"
                )
                
                if attempt < max_retries - 1:
                    time.sleep(wait_time)
                    continue
                else:
                    return None, f"Rate limit exceeded after {max_retries} attempts", latency_ms
            
            # Erro 5xx: Server error (Req 19.3)
            if response.status_code >= 500:
                logger.warning(
                    f"Server error {response.status_code}. "
                    f"Attempt {attempt + 1}/{max_retries}"
                )
                
                if attempt < max_retries - 1:
                    # Backoff exponencial com jitter (1s, 2s, 4s)
                    wait_time = (2 ** attempt) + random.uniform(0, 1)
                    logger.info(f"Waiting {wait_time:.2f}s before retry")
                    time.sleep(wait_time)
                    continue
                else:
                    return None, f"Server error {response.status_code} after {max_retries} attempts", latency_ms
            
            # Erro 4xx (exceto 429): Client error - não fazer retry (Req 19.4)
            if response.status_code >= 400:
                error_msg = f"Client error {response.status_code}: {response.text[:200]}"
                logger.error(error_msg)
                return None, error_msg, latency_ms
            
            # Outro status code inesperado
            return None, f"Unexpected status code {response.status_code}", latency_ms
            
        except requests.Timeout:
            logger.warning(f"Request timeout. Attempt {attempt + 1}/{max_retries}")
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(wait_time)
                continue
            else:
                return None, "Request timeout after retries", 0.0
        
        except requests.RequestException as e:
            logger.warning(f"Network error: {e}. Attempt {attempt + 1}/{max_retries}")
            if attempt < max_retries - 1:
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(wait_time)
                continue
            else:
                return None, f"Network error: {str(e)}", 0.0
    
    return None, "Max retries exceeded", 0.0


def calculate_latency_percentiles(latencies: List[float]) -> Dict[str, float]:
    """
    Calcula percentis de latência (p50, p95, p99).
    
    Implementa Req 16.2: Calcular latência média, p50, p95, e p99.
    
    Args:
        latencies: Lista de latências em milissegundos
    
    Returns:
        Dict com avg, p50, p95, p99
    """
    if not latencies:
        return {"avg": 0.0, "p50": 0.0, "p95": 0.0, "p99": 0.0}
    
    sorted_latencies = sorted(latencies)
    n = len(sorted_latencies)
    
    return {
        "avg": sum(latencies) / n,
        "p50": sorted_latencies[int(n * 0.50)],
        "p95": sorted_latencies[int(n * 0.95)] if n > 1 else sorted_latencies[0],
        "p99": sorted_latencies[int(n * 0.99)] if n > 1 else sorted_latencies[0],
    }


def create_lineage_record(
    ticker: str,
    timestamp: datetime,
    collection_timestamp: datetime,
    storage_timestamp: datetime,
    s3_location: str
) -> Dict:
    """
    Cria registro de lineage para um dado ingerido.
    
    Implementa:
    - Req 5.1: Registrar lineage para cada dado ingerido
    - Req 5.2: Incluir fonte, timestamps de coleta e armazenamento, versão do pipeline
    - Req 5.5: Armazenar em formato JSON
    
    Args:
        ticker: Símbolo da ação
        timestamp: Timestamp do dado (quando foi gerado na fonte)
        collection_timestamp: Quando foi coletado da API
        storage_timestamp: Quando foi armazenado no S3
        s3_location: Localização completa no S3
    
    Returns:
        Dict com registro de lineage
    """
    data_id = f"{ticker}_{timestamp.strftime('%Y%m%d_%H%M%S')}"
    
    return {
        "data_id": data_id,
        "ticker": ticker,
        "timestamp": timestamp.isoformat(),
        "source": "brapi",
        "source_version": "v2",
        "pipeline_version": PIPELINE_VERSION,
        "collection_timestamp": collection_timestamp.isoformat(),
        "storage_timestamp": storage_timestamp.isoformat(),
        "transformations": [],  # Será preenchido por outras Lambdas (Req 5.3)
        "s3_location": f"s3://{BUCKET}/{s3_location}"
    }


def handler(event, context):
    """
    Ingere cotações de 5 minutos da BRAPI.
    
    Implementa:
    - Req 2.1: Executar durante horário de pregão (controlado por EventBridge)
    - Req 2.2: Coletar cotações de 5 minutos para 50 tickers
    - Req 2.3: Respeitar rate limits (20 tickers/request, 500ms entre requests)
    - Req 2.5: Armazenar com particionamento por data
    - Req 2.6: Registrar metadados da execução
    """
    now = datetime.now(UTC)
    dt_str = now.date().isoformat()
    
    # Métricas de execução
    latencies = []
    errors = []
    records_saved = 0
    tickers_processed = 0
    
    try:
        # 1. Carregar token BRAPI (Req 1.1, 1.2)
        brapi_token = get_brapi_token()
        if not brapi_token:
            logger.warning("No BRAPI token available, using free tier")
        
        # 2. Ler universo de ações (Req 2.2)
        universe_key = os.environ.get("B3TR_UNIVERSE_S3_KEY", "config/universe.txt")
        try:
            obj = s3.get_object(Bucket=BUCKET, Key=universe_key)
            universe = obj["Body"].read().decode("utf-8").strip().split("\n")
            # Filtrar comentários e linhas vazias
            universe = [t.strip() for t in universe if t.strip() and not t.strip().startswith("#")]
        except Exception as e:
            logger.error(f"Error reading universe from {universe_key}: {e}")
            universe = ["PETR4", "VALE3", "ITUB4", "BBDC4", "ABEV3"]  # Fallback
        
        logger.info(f"Universe: {len(universe)} tickers")
        
        # 3. Buscar cotações em batches (Req 2.3)
        all_results = []
        
        for i in range(0, len(universe), BATCH_SIZE):
            batch = universe[i:i+BATCH_SIZE]
            tickers_str = ",".join(batch)
            
            url = f"https://brapi.dev/api/quote/{tickers_str}"
            params = {
                "range": "1d",
                "interval": "5m"
            }
            
            if brapi_token:
                params["token"] = brapi_token
            
            logger.info(f"Fetching batch {i//BATCH_SIZE + 1}: {len(batch)} tickers")
            
            # Fazer request com retry (Req 2.4, 19.1-19.4)
            data, error, latency_ms = fetch_with_retry(url, params)
            
            # Registrar latência (Req 16.1)
            if latency_ms > 0:
                latencies.append(latency_ms)
            
            if error:
                # Registrar erro (Req 19.6)
                error_record = {
                    "timestamp": now.isoformat(),
                    "batch": i//BATCH_SIZE + 1,
                    "tickers": batch,
                    "error": error,
                    "url": url
                }
                errors.append(error_record)
                logger.error(f"Batch {i//BATCH_SIZE + 1} failed: {error}")
                continue
            
            if data:
                batch_results = data.get("results", [])
                all_results.extend(batch_results)
                logger.info(f"Batch {i//BATCH_SIZE + 1}: {len(batch_results)} results")
            
            # Rate limiting (Req 2.3)
            if i + BATCH_SIZE < len(universe):
                time.sleep(RATE_LIMIT_DELAY)
        
        # 4. Salvar dados no S3 (Req 2.5)
        lineage_records = []  # Para acumular registros de lineage
        
        if not all_results:
            logger.warning("No results from BRAPI")
        else:
            for result in all_results:
                ticker = result.get("symbol", "UNKNOWN")
                historical_data = result.get("historicalDataPrice", [])
                
                if not historical_data:
                    continue
                
                tickers_processed += 1
                
                # Salvar cada ponto de dados
                for point in historical_data:
                    timestamp = point.get("date")
                    if not timestamp:
                        continue
                    
                    # Converter timestamp para datetime
                    dt = datetime.fromtimestamp(timestamp, tz=UTC)
                    date_str = dt.date().isoformat()
                    time_str = dt.strftime("%H%M%S")
                    
                    # Particionamento por data (Req 2.5)
                    key = f"quotes_5m/dt={date_str}/{ticker}_{time_str}.json"
                    
                    quote_data = {
                        "ticker": ticker,
                        "timestamp": dt.isoformat(),
                        "open": point.get("open"),
                        "high": point.get("high"),
                        "low": point.get("low"),
                        "close": point.get("close"),
                        "volume": point.get("volume"),
                        "ingested_at": now.isoformat()
                    }
                    
                    storage_time = datetime.now(UTC)
                    
                    s3.put_object(
                        Bucket=BUCKET,
                        Key=key,
                        Body=json.dumps(quote_data).encode("utf-8"),
                        ContentType="application/json",
                    )
                    records_saved += 1
                    
                    # Criar registro de lineage (Req 5.1, 5.2)
                    lineage_record = create_lineage_record(
                        ticker=ticker,
                        timestamp=dt,
                        collection_timestamp=now,
                        storage_timestamp=storage_time,
                        s3_location=key
                    )
                    lineage_records.append(lineage_record)
        
        logger.info(f"Saved {records_saved} quote records from {tickers_processed} tickers")
        
        # 4.1. Salvar registros de lineage (Req 5.4, 5.5)
        if lineage_records:
            # Agrupar registros de lineage por data para particionamento
            lineage_by_date = {}
            for record in lineage_records:
                date_str = datetime.fromisoformat(record["timestamp"]).date().isoformat()
                if date_str not in lineage_by_date:
                    lineage_by_date[date_str] = []
                lineage_by_date[date_str].append(record)
            
            # Salvar um arquivo de lineage por data
            for date_str, records in lineage_by_date.items():
                lineage_key = f"monitoring/lineage/dt={date_str}/lineage_{now.strftime('%H%M%S')}.json"
                lineage_data = {
                    "timestamp": now.isoformat(),
                    "pipeline_version": PIPELINE_VERSION,
                    "records": records,
                    "total_records": len(records)
                }
                
                s3.put_object(
                    Bucket=BUCKET,
                    Key=lineage_key,
                    Body=json.dumps(lineage_data).encode("utf-8"),
                    ContentType="application/json",
                )
            
            logger.info(f"Saved {len(lineage_records)} lineage records across {len(lineage_by_date)} dates")
        
        # 5. Calcular métricas de latência (Req 16.2)
        latency_metrics = calculate_latency_percentiles(latencies)
        logger.info(f"Latency metrics: {latency_metrics}")
        
        # Verificar latência alta (Req 16.3)
        if latency_metrics["p95"] > 5000:  # 5 segundos
            logger.warning(f"High latency detected: p95={latency_metrics['p95']:.2f}ms")
            
            # Salvar evento de latência alta
            latency_event_key = f"monitoring/api_latency/dt={dt_str}/high_latency_{now.strftime('%H%M%S')}.json"
            latency_event = {
                "timestamp": now.isoformat(),
                "event": "high_latency",
                "p95_ms": latency_metrics["p95"],
                "threshold_ms": 5000
            }
            s3.put_object(
                Bucket=BUCKET,
                Key=latency_event_key,
                Body=json.dumps(latency_event).encode("utf-8"),
                ContentType="application/json",
            )
        
        # 6. Salvar métricas de latência (Req 16.4)
        latency_key = f"monitoring/api_latency/dt={dt_str}/latency_{now.strftime('%H%M%S')}.json"
        latency_data = {
            "timestamp": now.isoformat(),
            "latencies_ms": latencies,
            "metrics": latency_metrics,
            "num_requests": len(latencies)
        }
        s3.put_object(
            Bucket=BUCKET,
            Key=latency_key,
            Body=json.dumps(latency_data).encode("utf-8"),
            ContentType="application/json",
        )
        
        # 7. Salvar erros (Req 19.6)
        if errors:
            error_key = f"monitoring/errors/dt={dt_str}/errors_{now.strftime('%H%M%S')}.json"
            error_data = {
                "timestamp": now.isoformat(),
                "errors": errors,
                "total_errors": len(errors)
            }
            s3.put_object(
                Bucket=BUCKET,
                Key=error_key,
                Body=json.dumps(error_data).encode("utf-8"),
                ContentType="application/json",
            )
        
        # 8. Salvar resumo da ingestão (Req 2.6)
        summary_key = f"monitoring/ingestion/dt={dt_str}/ingestion_{now.strftime('%H%M%S')}.json"
        summary = {
            "timestamp": now.isoformat(),
            "status": "success" if records_saved > 0 else "no_data",
            "records_ingested": records_saved,
            "tickers_processed": tickers_processed,
            "tickers_requested": len(universe),
            "errors_count": len(errors),
            "latency_metrics": latency_metrics,
            "source": "brapi"
        }
        
        s3.put_object(
            Bucket=BUCKET,
            Key=summary_key,
            Body=json.dumps(summary).encode("utf-8"),
            ContentType="application/json",
        )
        
        # 9. Publicar métrica no CloudWatch
        try:
            cloudwatch.put_metric_data(
                Namespace="B3TR",
                MetricData=[
                    {
                        "MetricName": "IngestionOK",
                        "Value": 1 if records_saved > 0 else 0,
                        "Unit": "None",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "RecordsIngested",
                        "Value": records_saved,
                        "Unit": "Count",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "IngestionLatencyP95",
                        "Value": latency_metrics["p95"],
                        "Unit": "Milliseconds",
                        "Timestamp": now
                    }
                ]
            )
        except Exception as e:
            logger.error(f"Error publishing CloudWatch metrics: {e}")
        
        return {
            "ok": True,
            "records_saved": records_saved,
            "tickers_processed": tickers_processed,
            "errors_count": len(errors),
            "latency_p95_ms": latency_metrics["p95"]
        }
        
    except Exception as e:
        logger.error(f"Error in ingestion: {e}", exc_info=True)
        
        # Salvar erro crítico (Req 19.5)
        error_key = f"monitoring/ingestion/dt={dt_str}/ingestion_{now.strftime('%H%M%S')}.json"
        error_summary = {
            "timestamp": now.isoformat(),
            "status": "error",
            "records_ingested": records_saved,
            "error_message": str(e),
            "error_type": type(e).__name__,
            "source": "brapi"
        }
        
        s3.put_object(
            Bucket=BUCKET,
            Key=error_key,
            Body=json.dumps(error_summary).encode("utf-8"),
            ContentType="application/json",
        )
        
        # Publicar métrica de falha
        try:
            cloudwatch.put_metric_data(
                Namespace="B3TR",
                MetricData=[
                    {
                        "MetricName": "IngestionOK",
                        "Value": 0,
                        "Unit": "None",
                        "Timestamp": now
                    }
                ]
            )
        except Exception as cw_error:
            logger.error(f"Error publishing CloudWatch metrics: {cw_error}")
        
        return {"ok": False, "error": str(e)}
