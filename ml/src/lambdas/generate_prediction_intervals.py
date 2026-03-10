"""
Lambda para gerar intervalos de predição
Calcula intervalos de confiança para as predições
"""
import json
import logging
from datetime import UTC, datetime
import boto3
import numpy as np

from ml.src.runtime_config import load_runtime_config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")


def handler(event, context):
    cfg = load_runtime_config()
    bucket = cfg.bucket
    
    now = datetime.now(UTC)
    dt_today = now.date().isoformat()
    
    try:
        # Buscar recomendações mais recentes
        prefix = f"recommendations/dt={dt_today}/"
        resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix, MaxKeys=1)
        
        if not resp.get("Contents"):
            return {"ok": False, "error": "No recommendations found for today"}
        
        key = resp["Contents"][0]["Key"]
        obj = s3.get_object(Bucket=bucket, Key=key)
        data = json.loads(obj["Body"].read().decode("utf-8"))
        
        items = data.get("items", [])
        
        if not items:
            return {"ok": False, "error": "No items in recommendations"}
        
        # Calcular intervalos de confiança (95%)
        # Usando volatilidade como proxy para incerteza
        intervals = []
        
        for item in items[:10]:  # Top 10 apenas
            ticker = item.get("ticker")
            pred_price = item.get("pred_price_t_plus_20")
            vol = item.get("vol_20d", 0.02)
            
            if not ticker or not pred_price:
                continue
            
            # Intervalo de confiança: pred ± 1.96 * vol * pred
            margin = 1.96 * vol * pred_price
            
            intervals.append({
                "ticker": ticker,
                "predicted": pred_price,
                "lower_bound": pred_price - margin,
                "upper_bound": pred_price + margin,
                "confidence": 0.95
            })
        
        report = {
            "timestamp": now.isoformat(),
            "dt": dt_today,
            "intervals": intervals
        }
        
        # Salvar relatório
        ts = now.strftime("%H%M%S")
        key = f"predictions/intervals/dt={dt_today}/intervals_{ts}.json"
        
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(report, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        
        logger.info(f"Prediction intervals saved to {key}")
        return {"ok": True, "intervals_key": key}
        
    except Exception as e:
        logger.error(f"Error generating prediction intervals: {e}")
        return {"ok": False, "error": str(e)}
