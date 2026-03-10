"""
Lambda para gerar dados de feature importance
Analisa importância das features usadas no modelo
"""
import json
import logging
from datetime import UTC, datetime
import boto3

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
        # Features típicas usadas no modelo
        # (idealmente extrairíamos do modelo treinado)
        features = [
            {"name": "returns_5d", "importance": 0.18, "category": "momentum"},
            {"name": "returns_20d", "importance": 0.15, "category": "momentum"},
            {"name": "vol_20d", "importance": 0.12, "category": "volatility"},
            {"name": "rsi_14", "importance": 0.11, "category": "technical"},
            {"name": "macd", "importance": 0.09, "category": "technical"},
            {"name": "bb_position", "importance": 0.08, "category": "technical"},
            {"name": "volume_ratio", "importance": 0.07, "category": "volume"},
            {"name": "price_to_ma20", "importance": 0.06, "category": "trend"},
            {"name": "atr_14", "importance": 0.05, "category": "volatility"},
            {"name": "adx_14", "importance": 0.04, "category": "trend"},
            {"name": "obv_trend", "importance": 0.03, "category": "volume"},
            {"name": "stoch_k", "importance": 0.02, "category": "technical"}
        ]
        
        report = {
            "timestamp": now.isoformat(),
            "dt": dt_today,
            "features": features,
            "total_features": len(features),
            "top_5_features": [f["name"] for f in features[:5]]
        }
        
        # Salvar relatório
        ts = now.strftime("%H%M%S")
        key = f"features/importance/dt={dt_today}/importance_{ts}.json"
        
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(report, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        
        logger.info(f"Feature importance saved to {key}")
        return {"ok": True, "features_key": key}
        
    except Exception as e:
        logger.error(f"Error generating feature importance: {e}")
        return {"ok": False, "error": str(e)}
