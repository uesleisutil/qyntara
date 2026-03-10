"""
Lambda para monitorar drift de features e predições
Gera dados para o painel de Drift Monitoring
"""
import json
import logging
from datetime import UTC, datetime, timedelta
import boto3
import numpy as np

from ml.src.runtime_config import load_runtime_config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")


def calculate_drift_score(current_data, reference_data):
    """Calcula score de drift usando KL divergence simplificado"""
    if not current_data or not reference_data:
        return 0.0
    
    # Simples diferença de médias normalizada
    current_mean = np.mean(current_data)
    reference_mean = np.mean(reference_data)
    current_std = np.std(current_data) if len(current_data) > 1 else 1.0
    
    if current_std == 0:
        return 0.0
    
    drift = abs(current_mean - reference_mean) / current_std
    return min(drift, 1.0)  # Cap at 1.0


def handler(event, context):
    cfg = load_runtime_config()
    bucket = cfg.bucket
    
    now = datetime.now(UTC)
    dt_today = now.date().isoformat()
    
    # Buscar recomendações recentes para analisar features
    try:
        # Últimas 7 recomendações
        dates = [(now.date() - timedelta(days=i)).isoformat() for i in range(7)]
        
        all_scores = []
        all_returns = []
        all_vols = []
        
        for dt in dates:
            try:
                prefix = f"recommendations/dt={dt}/"
                resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix, MaxKeys=1)
                
                if not resp.get("Contents"):
                    continue
                
                key = resp["Contents"][0]["Key"]
                obj = s3.get_object(Bucket=bucket, Key=key)
                data = json.loads(obj["Body"].read().decode("utf-8"))
                
                items = data.get("items", [])
                for item in items:
                    if item.get("score"):
                        all_scores.append(item["score"])
                    if item.get("exp_return_20"):
                        all_returns.append(item["exp_return_20"])
                    if item.get("vol_20d"):
                        all_vols.append(item["vol_20d"])
                        
            except Exception as e:
                logger.warning(f"Error loading recommendations for {dt}: {e}")
                continue
        
        # Calcular drift comparando últimos 2 dias vs 5 dias anteriores
        if len(all_scores) < 10:
            drift_detected = False
            drift_score = 0.0
            features_drift = {}
        else:
            # Dividir em current (últimos 2 dias) e reference (5 dias anteriores)
            split_point = len(all_scores) // 3
            current_scores = all_scores[:split_point]
            reference_scores = all_scores[split_point:]
            
            current_returns = all_returns[:split_point] if all_returns else []
            reference_returns = all_returns[split_point:] if all_returns else []
            
            current_vols = all_vols[:split_point] if all_vols else []
            reference_vols = all_vols[split_point:] if all_vols else []
            
            # Calcular drift para cada feature
            score_drift = calculate_drift_score(current_scores, reference_scores)
            return_drift = calculate_drift_score(current_returns, reference_returns)
            vol_drift = calculate_drift_score(current_vols, reference_vols)
            
            drift_score = (score_drift + return_drift + vol_drift) / 3
            drift_detected = drift_score > 0.3  # Threshold
            
            features_drift = {
                "score": score_drift,
                "expected_return": return_drift,
                "volatility": vol_drift
            }
        
        # Salvar relatório
        report = {
            "timestamp": now.isoformat(),
            "dt": dt_today,
            "drift_detected": bool(drift_detected),
            "drift_score": float(drift_score),
            "features_drift": {k: float(v) for k, v in features_drift.items()},
            "samples_analyzed": len(all_scores)
        }
        
        ts = now.strftime("%H%M%S")
        key = f"monitoring/drift/dt={dt_today}/drift_{ts}.json"
        
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(report, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        
        logger.info(f"Drift report saved to {key}")
        return {"ok": True, "drift_detected": bool(drift_detected), "drift_score": float(drift_score)}
        
    except Exception as e:
        logger.error(f"Error in drift monitoring: {e}")
        return {"ok": False, "error": str(e)}
