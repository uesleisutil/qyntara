import json
import os
from datetime import UTC, datetime, timedelta
import logging

import boto3
import requests

s3 = boto3.client("s3")
secrets = boto3.client("secretsmanager")
logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET = os.environ["BUCKET"]
BRAPI_SECRET_ID = os.environ.get("BRAPI_SECRET_ID", "brapi/pro/token")


def get_brapi_token() -> str:
    """Carrega token da BRAPI do Secrets Manager"""
    try:
        resp = secrets.get_secret_value(SecretId=BRAPI_SECRET_ID)
        secret_str = resp.get("SecretString", "")
        
        # Pode ser JSON ou string simples
        try:
            secret_data = json.loads(secret_str)
            return secret_data.get("token", secret_str)
        except json.JSONDecodeError:
            return secret_str
    except Exception as e:
        logger.error(f"Error loading BRAPI token: {e}")
        return ""


def handler(event, context):
    """
    Ingere cotações de 5 minutos da BRAPI
    """
    now = datetime.now(UTC)
    dt_str = now.date().isoformat()
    
    try:
        # Carregar token
        brapi_token = get_brapi_token()
        if not brapi_token:
            logger.warning("No BRAPI token available, using free tier")
        
        # Ler universo de ações
        universe_key = "config/universe.txt"
        try:
            obj = s3.get_object(Bucket=BUCKET, Key=universe_key)
            universe = obj["Body"].read().decode("utf-8").strip().split("\n")
            universe = [t.strip() for t in universe if t.strip()]
        except Exception as e:
            logger.error(f"Error reading universe: {e}")
            universe = ["PETR4", "VALE3", "ITUB4", "BBDC4", "ABEV3"]  # Fallback
        
        logger.info(f"Universe: {len(universe)} tickers")
        
        # Buscar cotações da BRAPI em batches (máximo 20 por request)
        batch_size = 20
        all_results = []
        
        for i in range(0, len(universe), batch_size):
            batch = universe[i:i+batch_size]
            tickers_str = ",".join(batch)
            
            url = f"https://brapi.dev/api/quote/{tickers_str}"
            params = {
                "range": "1d",
                "interval": "5m"
            }
            
            if brapi_token:
                params["token"] = brapi_token
            
            logger.info(f"Fetching batch {i//batch_size + 1}: {len(batch)} tickers")
            response = requests.get(url, params=params, timeout=30)
            
            if response.status_code != 200:
                logger.error(f"BRAPI error for batch: {response.status_code} - {response.text}")
                continue
            
            data = response.json()
            batch_results = data.get("results", [])
            all_results.extend(batch_results)
            
            # Rate limiting
            if i + batch_size < len(universe):
                import time
                time.sleep(0.5)  # 500ms entre requests
        
        if not all_results:
            logger.warning("No results from BRAPI")
            # Salvar heartbeat
            key = f"raw/quotes_5m/heartbeat_{now.strftime('%Y%m%dT%H%M%SZ')}.json"
            s3.put_object(
                Bucket=BUCKET,
                Key=key,
                Body=json.dumps({
                    "ok": True,
                    "ts": now.isoformat(),
                    "message": "No data available from BRAPI"
                }).encode("utf-8"),
                ContentType="application/json",
            )
            return {"ok": True, "message": "No data available"}
        
        # Salvar dados
        records_saved = 0
        for result in all_results:
            ticker = result.get("symbol", "UNKNOWN")
            historical_data = result.get("historicalDataPrice", [])
            
            if not historical_data:
                continue
            
            # Salvar cada ponto de dados
            for point in historical_data:
                timestamp = point.get("date")
                if not timestamp:
                    continue
                
                # Converter timestamp para datetime
                dt = datetime.fromtimestamp(timestamp, tz=UTC)
                date_str = dt.date().isoformat()
                time_str = dt.strftime("%H%M%S")
                
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
                
                s3.put_object(
                    Bucket=BUCKET,
                    Key=key,
                    Body=json.dumps(quote_data).encode("utf-8"),
                    ContentType="application/json",
                )
                records_saved += 1
        
        logger.info(f"Saved {records_saved} quote records")
        
        # Salvar resumo da ingestão
        summary_key = f"monitoring/ingestion/dt={dt_str}/ingestion_{now.strftime('%H%M%S')}.json"
        summary = {
            "timestamp": now.isoformat(),
            "status": "success",
            "records_ingested": records_saved,
            "tickers_processed": len(all_results),
            "source": "brapi"
        }
        
        s3.put_object(
            Bucket=BUCKET,
            Key=summary_key,
            Body=json.dumps(summary).encode("utf-8"),
            ContentType="application/json",
        )
        
        return {
            "ok": True,
            "records_saved": records_saved,
            "tickers_processed": len(all_results)
        }
        
    except Exception as e:
        logger.error(f"Error in ingestion: {e}", exc_info=True)
        
        # Salvar erro
        error_key = f"monitoring/ingestion/dt={dt_str}/ingestion_{now.strftime('%H%M%S')}.json"
        error_summary = {
            "timestamp": now.isoformat(),
            "status": "error",
            "records_ingested": 0,
            "error_message": str(e),
            "source": "brapi"
        }
        
        s3.put_object(
            Bucket=BUCKET,
            Key=error_key,
            Body=json.dumps(error_summary).encode("utf-8"),
            ContentType="application/json",
        )
        
        return {"ok": False, "error": str(e)}
