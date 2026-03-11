"""
Lambda para detecção de drift de modelo e features.

Implementa:
- Req 8.1: Detectar performance drift comparando MAPE de 5 dias recentes vs 5 dias anteriores
- Req 8.2: Sinalizar drift quando MAPE recente é 50% maior que baseline
- Req 8.3: Calcular drift score (0-1) baseado na magnitude da degradação
- Req 8.4: Gerar alerta com recomendação de retreinamento
- Req 8.5: Monitorar drift de features individuais
- Req 8.6: Sinalizar feature drift crítico quando > 30% das features apresentam drift
- Req 15.1-15.5: Lógica de recomendação de retreinamento
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


def load_performance_metrics(days: int = 10) -> List[Dict]:
    """
    Carrega métricas de performance dos últimos N dias.
    
    Args:
        days: Número de dias de histórico
    
    Returns:
        Lista de métricas ordenadas por data
    """
    metrics = []
    
    try:
        for i in range(days):
            date = (datetime.now(UTC).date() - timedelta(days=i)).isoformat()
            prefix = f"monitoring/performance/dt={date}/"
            
            try:
                response = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix)
                
                if "Contents" not in response:
                    continue
                
                # Pegar último arquivo do dia
                latest_file = sorted(response["Contents"], key=lambda x: x["Key"])[-1]
                key = latest_file["Key"]
                
                # Carregar métricas
                obj = s3.get_object(Bucket=BUCKET, Key=key)
                metric = json.loads(obj["Body"].read().decode("utf-8"))
                metrics.append(metric)
                
            except Exception:
                continue
        
        # Ordenar por data (mais antigo primeiro)
        metrics.sort(key=lambda x: x.get("date", ""))
        
    except Exception as e:
        logger.error(f"Error loading performance metrics: {e}")
    
    return metrics


def load_recommendations(days: int = 7) -> List[Dict]:
    """
    Carrega recomendações dos últimos N dias.
    
    Args:
        days: Número de dias de histórico
    
    Returns:
        Lista de recomendações ordenadas por data
    """
    recommendations = []
    
    try:
        for i in range(days):
            date = (datetime.now(UTC).date() - timedelta(days=i)).isoformat()
            prefix = f"recommendations/dt={date}/"
            
            try:
                response = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix)
                
                if "Contents" not in response:
                    continue
                
                # Pegar último arquivo do dia
                latest_file = sorted(response["Contents"], key=lambda x: x["Key"])[-1]
                key = latest_file["Key"]
                
                # Carregar recomendações
                obj = s3.get_object(Bucket=BUCKET, Key=key)
                recs = json.loads(obj["Body"].read().decode("utf-8"))
                recommendations.append(recs)
                
            except Exception:
                continue
        
        # Ordenar por data (mais antigo primeiro)
        recommendations.sort(key=lambda x: x.get("date", ""))
        
    except Exception as e:
        logger.error(f"Error loading recommendations: {e}")
    
    return recommendations


def detect_performance_drift(metrics: List[Dict]) -> Tuple[bool, float, Dict]:
    """
    Detecta drift de performance comparando MAPE recente vs baseline.
    
    Implementa:
    - Req 8.1: Comparar MAPE de 5 dias recentes vs 5 dias anteriores
    - Req 8.2: Sinalizar drift quando MAPE recente é 50% maior que baseline
    - Req 8.3: Calcular drift score (0-1)
    
    Args:
        metrics: Lista de métricas de performance
    
    Returns:
        Tuple (drift_detected, drift_score, details)
    """
    if len(metrics) < 10:
        logger.warning(f"Insufficient metrics for drift detection: {len(metrics)} < 10")
        return False, 0.0, {}
    
    # Dividir em janelas
    reference_window = metrics[:5]  # 5 dias mais antigos
    current_window = metrics[5:10]  # 5 dias mais recentes
    
    # Extrair MAPE
    reference_mape = [m["mape"] for m in reference_window if "mape" in m]
    current_mape = [m["mape"] for m in current_window if "mape" in m]
    
    if not reference_mape or not current_mape:
        return False, 0.0, {}
    
    # Calcular médias
    baseline_mape = statistics.mean(reference_mape)
    current_mape_avg = statistics.mean(current_mape)
    
    # Calcular mudança percentual
    if baseline_mape > 0:
        mape_change = (current_mape_avg - baseline_mape) / baseline_mape
    else:
        mape_change = 0.0
    
    # Detectar drift (Req 8.2)
    drift_detected = mape_change > 0.5  # 50% de degradação
    
    # Calcular drift score (Req 8.3)
    drift_score = min(max(mape_change, 0.0), 1.0)
    
    details = {
        "baseline_mape": baseline_mape,
        "current_mape": current_mape_avg,
        "mape_change_percentage": mape_change * 100,
        "mape_history": [
            {
                "date": m.get("date"),
                "current": m.get("mape"),
                "baseline": baseline_mape
            }
            for m in current_window
        ]
    }
    
    return drift_detected, drift_score, details


def detect_feature_drift(recommendations: List[Dict]) -> Tuple[int, Dict[str, float], List[Dict]]:
    """
    Detecta drift de features individuais.
    
    Implementa Req 8.5: Monitorar drift de features comparando distribuições.
    
    Args:
        recommendations: Lista de recomendações
    
    Returns:
        Tuple (feature_drift_count, features_drift_scores, drifted_features)
    """
    if len(recommendations) < 7:
        logger.warning(f"Insufficient recommendations for feature drift: {len(recommendations)} < 7")
        return 0, {}, []
    
    # Dividir em janelas
    reference_window = recommendations[:5]  # 5 dias mais antigos
    current_window = recommendations[5:7]   # 2 dias mais recentes
    
    # Features a monitorar
    features_to_monitor = ["confidence_score", "expected_return"]
    
    features_drift = {}
    drifted_features = []
    
    for feature in features_to_monitor:
        try:
            # Extrair valores da feature
            reference_values = []
            for rec_data in reference_window:
                for rec in rec_data.get("recommendations", []):
                    if feature in rec:
                        reference_values.append(rec[feature])
            
            current_values = []
            for rec_data in current_window:
                for rec in rec_data.get("recommendations", []):
                    if feature in rec:
                        current_values.append(rec[feature])
            
            if not reference_values or not current_values:
                continue
            
            # Calcular drift usando KL divergence simplificado
            ref_mean = statistics.mean(reference_values)
            ref_std = statistics.stdev(reference_values) if len(reference_values) > 1 else 1.0
            
            curr_mean = statistics.mean(current_values)
            
            # Drift score
            if ref_std > 0:
                drift = abs(curr_mean - ref_mean) / ref_std
                drift_score = min(drift, 1.0)
            else:
                drift_score = 0.0
            
            features_drift[feature] = drift_score
            
            # Marcar como drifted se score > 0.3
            if drift_score > 0.3:
                drifted_features.append({
                    "feature": feature,
                    "drift_score": drift_score,
                    "status": "drifted"
                })
            else:
                drifted_features.append({
                    "feature": feature,
                    "drift_score": drift_score,
                    "status": "stable"
                })
        
        except Exception as e:
            logger.warning(f"Error calculating drift for feature {feature}: {e}")
            continue
    
    # Contar features com drift
    feature_drift_count = sum(1 for f in drifted_features if f["status"] == "drifted")
    
    return feature_drift_count, features_drift, drifted_features


def evaluate_retraining_need(
    performance_drift: bool,
    drift_score: float,
    current_mape: float,
    feature_drift_count: int,
    total_features: int
) -> Tuple[bool, str]:
    """
    Avalia necessidade de retreinamento.
    
    Implementa Req 15.2: Recomendar retreinamento se:
    - MAPE > 20% OU
    - drift_score > 0.5 OU
    - > 30% das features com drift
    
    Args:
        performance_drift: Se drift de performance foi detectado
        drift_score: Score de drift (0-1)
        current_mape: MAPE atual
        feature_drift_count: Número de features com drift
        total_features: Total de features monitoradas
    
    Returns:
        Tuple (retrain_recommended, reason)
    """
    reasons = []
    
    # Verificar MAPE
    if current_mape > 20:
        reasons.append(f"MAPE acima de 20% ({current_mape:.2f}%)")
    
    # Verificar drift score
    if drift_score > 0.5:
        reasons.append(f"Drift score crítico ({drift_score:.2f})")
    
    # Verificar feature drift
    if total_features > 0:
        feature_drift_pct = (feature_drift_count / total_features) * 100
        if feature_drift_pct > 30:
            reasons.append(f"Mais de 30% das features com drift ({feature_drift_pct:.1f}%)")
    
    retrain_recommended = len(reasons) > 0
    reason = "; ".join(reasons) if reasons else None
    
    return retrain_recommended, reason


def handler(event, context):
    """
    Detecta drift de modelo e features.
    
    Implementa:
    - Req 8.1-8.6: Detecção de drift
    - Req 15.1-15.5: Recomendação de retreinamento
    """
    now = datetime.now(UTC)
    today_str = now.date().isoformat()
    
    logger.info(f"Starting drift detection for {today_str}")
    
    try:
        # 1. Carregar métricas de performance (últimos 10 dias)
        performance_metrics = load_performance_metrics(days=10)
        logger.info(f"Loaded {len(performance_metrics)} performance metrics")
        
        # 2. Detectar performance drift (Req 8.1, 8.2, 8.3)
        performance_drift, drift_score, drift_details = detect_performance_drift(performance_metrics)
        
        logger.info(f"Performance drift: {performance_drift}, score: {drift_score:.2f}")
        
        # 3. Carregar recomendações (últimos 7 dias)
        recommendations = load_recommendations(days=7)
        logger.info(f"Loaded {len(recommendations)} recommendation sets")
        
        # 4. Detectar feature drift (Req 8.5)
        feature_drift_count, features_drift, drifted_features = detect_feature_drift(recommendations)
        
        logger.info(f"Feature drift: {feature_drift_count} features drifted")
        
        # 5. Verificar feature drift crítico (Req 8.6)
        total_features = len(features_drift)
        feature_drift_critical = False
        
        if total_features > 0:
            feature_drift_pct = (feature_drift_count / total_features) * 100
            feature_drift_critical = feature_drift_pct > 30
        
        # 6. Avaliar necessidade de retreinamento (Req 15.1, 15.2)
        current_mape = drift_details.get("current_mape", 0.0)
        retrain_recommended, retrain_reason = evaluate_retraining_need(
            performance_drift,
            drift_score,
            current_mape,
            feature_drift_count,
            total_features
        )
        
        logger.info(f"Retrain recommended: {retrain_recommended}")
        if retrain_reason:
            logger.info(f"Reason: {retrain_reason}")
        
        # 7. Determinar severidade do drift (Req 11.8)
        if drift_score > 0.5:
            severity = "critical"
        elif drift_score > 0.3:
            severity = "warning"
        else:
            severity = "stable"
        
        # 8. Criar eventos de drift
        drift_events = []
        
        if performance_drift:
            drift_events.append({
                "date": today_str,
                "type": "performance_drift",
                "description": f"MAPE aumentou {drift_details.get('mape_change_percentage', 0):.1f}%",
                "severity": severity
            })
        
        if feature_drift_critical:
            drift_events.append({
                "date": today_str,
                "type": "feature_drift_critical",
                "description": f"{feature_drift_count} de {total_features} features com drift",
                "severity": "critical"
            })
        
        # 9. Salvar relatório de drift (Req 8.1)
        drift_report = {
            "timestamp": now.isoformat(),
            "date": today_str,
            "drift_detected": performance_drift or feature_drift_critical,
            "drift_score": drift_score,
            "performance_drift": performance_drift,
            "feature_drift_count": feature_drift_count,
            "baseline_mape": drift_details.get("baseline_mape", 0.0),
            "current_mape": current_mape,
            "mape_change_percentage": drift_details.get("mape_change_percentage", 0.0),
            "mape_history": drift_details.get("mape_history", []),
            "features_drift": features_drift,
            "drifted_features": drifted_features,
            "drift_events": drift_events,
            "retrain_recommended": retrain_recommended,
            "retrain_reason": retrain_reason
        }
        
        drift_key = f"monitoring/drift/dt={today_str}/drift_{now.strftime('%H%M%S')}.json"
        s3.put_object(
            Bucket=BUCKET,
            Key=drift_key,
            Body=json.dumps(drift_report, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        
        logger.info(f"Saved drift report to {drift_key}")
        
        # 10. Salvar recomendação de retreinamento se necessário (Req 15.3, 15.4, 15.5)
        if retrain_recommended:
            retrain_notification = {
                "timestamp": now.isoformat(),
                "date": today_str,
                "current_metrics": {
                    "mape": current_mape,
                    "drift_score": drift_score,
                    "feature_drift_count": feature_drift_count
                },
                "baseline_metrics": {
                    "mape": drift_details.get("baseline_mape", 0.0)
                },
                "drift_score": drift_score,
                "retrain_command": "aws sagemaker create-training-job --training-job-name b3tr-retrain-$(date +%Y%m%d)",
                "reason": retrain_reason
            }
            
            retrain_key = f"monitoring/retrain_recommendations/dt={today_str}/retrain_{now.strftime('%H%M%S')}.json"
            s3.put_object(
                Bucket=BUCKET,
                Key=retrain_key,
                Body=json.dumps(retrain_notification, indent=2).encode("utf-8"),
                ContentType="application/json",
            )
            
            logger.info(f"Saved retrain recommendation to {retrain_key}")
        
        # 11. Publicar métricas no CloudWatch
        try:
            cloudwatch.put_metric_data(
                Namespace="B3TR",
                MetricData=[
                    {
                        "MetricName": "DriftDetected",
                        "Value": 1 if (performance_drift or feature_drift_critical) else 0,
                        "Unit": "None",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "DriftScore",
                        "Value": drift_score,
                        "Unit": "None",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "FeatureDriftCount",
                        "Value": feature_drift_count,
                        "Unit": "Count",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "RetrainRecommended",
                        "Value": 1 if retrain_recommended else 0,
                        "Unit": "None",
                        "Timestamp": now
                    }
                ]
            )
        except Exception as e:
            logger.error(f"Error publishing CloudWatch metrics: {e}")
        
        return {
            "ok": True,
            "drift_detected": performance_drift or feature_drift_critical,
            "drift_score": drift_score,
            "feature_drift_count": feature_drift_count,
            "retrain_recommended": retrain_recommended,
            "drift_key": drift_key
        }
        
    except Exception as e:
        logger.error(f"Error in drift detection: {e}", exc_info=True)
        
        # Salvar erro
        error_key = f"monitoring/drift/dt={today_str}/error_{now.strftime('%H%M%S')}.json"
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
