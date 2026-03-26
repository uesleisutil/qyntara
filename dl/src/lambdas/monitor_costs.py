"""
Lambda para monitoramento de custos da infraestrutura AWS.

Implementa:
- Req 9.1: Coletar custos diários de todos os serviços (Lambda, S3, SageMaker, CloudWatch)
- Req 9.2: Calcular projeção mensal baseada em custos dos últimos 7 dias
- Req 9.3: Gerar alerta crítico quando projeção ultrapassa R$500
- Req 9.4: Detalhar custos por serviço e componente (training, inference, storage, compute)
- Req 9.5: Calcular custo por recomendação gerada
- Req 9.6: Executar diariamente e armazenar histórico no S3
- Req 9.7: Detectar anomalias de custo (aumento > 50% vs média de 7 dias)
"""

import json
import logging
import os
import statistics
from datetime import UTC, datetime, timedelta
from typing import Dict, List, Optional, Tuple

import boto3

ce = boto3.client("ce")  # Cost Explorer
cloudwatch = boto3.client("cloudwatch")
s3 = boto3.client("s3")
logger = logging.getLogger()
logger.setLevel(logging.INFO)

BUCKET = os.environ["BUCKET"]
USD_TO_BRL = 5.0  # Taxa de câmbio aproximada (atualizar conforme necessário)
COST_THRESHOLD_BRL = 500.0  # R$500 por mês


def get_cost_and_usage(start_date: str, end_date: str) -> Dict:
    """
    Obtém custos do AWS Cost Explorer.
    
    Args:
        start_date: Data inicial (YYYY-MM-DD)
        end_date: Data final (YYYY-MM-DD)
    
    Returns:
        Resposta do Cost Explorer com custos por serviço
    """
    logger.info(f"Obtendo custos de {start_date} a {end_date}")
    
    try:
        response = ce.get_cost_and_usage(
            TimePeriod={
                "Start": start_date,
                "End": end_date
            },
            Granularity="DAILY",
            Metrics=["UnblendedCost"],
            GroupBy=[
                {"Type": "DIMENSION", "Key": "SERVICE"},
            ]
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Error getting cost and usage: {e}")
        return {"ResultsByTime": []}


def parse_costs_by_service(response: Dict) -> Dict[str, float]:
    """
    Parseia resposta do Cost Explorer e agrupa custos por serviço.
    
    Args:
        response: Resposta do Cost Explorer
    
    Returns:
        Dicionário com custos por serviço (em USD)
    """
    costs_by_service = {}
    
    for result in response.get("ResultsByTime", []):
        for group in result.get("Groups", []):
            service = group["Keys"][0]
            cost = float(group["Metrics"]["UnblendedCost"]["Amount"])
            
            if service not in costs_by_service:
                costs_by_service[service] = 0.0
            costs_by_service[service] += cost
    
    return costs_by_service


def categorize_costs(costs_by_service: Dict[str, float]) -> Dict[str, Dict]:
    """
    Categoriza custos por componente (training, inference, storage, compute).
    
    Implementa Req 9.4: Detalhar custos por serviço e componente.
    
    Args:
        costs_by_service: Custos por serviço AWS
    
    Returns:
        Custos categorizados por componente
    """
    categorized = {
        "training": 0.0,      # SageMaker training jobs
        "inference": 0.0,     # SageMaker endpoints
        "storage": 0.0,       # S3
        "compute": 0.0,       # Lambda
        "monitoring": 0.0,    # CloudWatch
        "other": 0.0          # Outros serviços
    }
    
    service_mapping = {
        "Amazon SageMaker": "training",  # Pode ser training ou inference
        "AWS Lambda": "compute",
        "Amazon Simple Storage Service": "storage",
        "AmazonCloudWatch": "monitoring",
        "Amazon CloudWatch": "monitoring",
    }
    
    for service, cost in costs_by_service.items():
        # Mapear serviço para componente
        if "SageMaker" in service:
            # Dividir entre training e inference (50/50 por simplicidade)
            # Em produção, usar tags ou APIs específicas
            categorized["training"] += cost * 0.5
            categorized["inference"] += cost * 0.5
        elif service in service_mapping:
            component = service_mapping[service]
            categorized[component] += cost
        else:
            categorized["other"] += cost
    
    return categorized


def calculate_monthly_projection(last_7_days_cost: float) -> float:
    """
    Calcula projeção mensal baseada em custos dos últimos 7 dias.
    
    Implementa Req 9.2: Calcular projeção mensal.
    
    Args:
        last_7_days_cost: Custo total dos últimos 7 dias (USD)
    
    Returns:
        Projeção mensal (USD)
    """
    daily_average = last_7_days_cost / 7
    monthly_projection = daily_average * 30
    
    return monthly_projection


def load_historical_costs(days: int = 7) -> List[Dict]:
    """
    Carrega custos históricos dos últimos N dias do S3.
    
    Args:
        days: Número de dias de histórico
    
    Returns:
        Lista de relatórios de custo
    """
    historical_costs = []
    
    try:
        for i in range(1, days + 1):  # Começar de 1 dia atrás
            date = (datetime.now(UTC).date() - timedelta(days=i)).isoformat()
            prefix = f"monitoring/costs/dt={date}/"
            
            try:
                response = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix)
                
                if "Contents" not in response:
                    continue
                
                # Pegar último arquivo do dia
                latest_file = sorted(response["Contents"], key=lambda x: x["Key"])[-1]
                key = latest_file["Key"]
                
                # Carregar relatório
                obj = s3.get_object(Bucket=BUCKET, Key=key)
                report = json.loads(obj["Body"].read().decode("utf-8"))
                historical_costs.append(report)
                
            except Exception:
                continue
        
    except Exception as e:
        logger.error(f"Error loading historical costs: {e}")
    
    return historical_costs


def detect_cost_anomalies(
    current_costs: Dict[str, float],
    historical_costs: List[Dict]
) -> List[Dict]:
    """
    Detecta anomalias de custo (aumento > 50% vs média de 7 dias).
    
    Implementa Req 9.7: Detectar anomalias de custo.
    
    Args:
        current_costs: Custos atuais por serviço
        historical_costs: Histórico de custos dos últimos 7 dias
    
    Returns:
        Lista de anomalias detectadas
    """
    anomalies = []
    
    if len(historical_costs) < 3:
        logger.warning("Insufficient historical data for anomaly detection")
        return anomalies
    
    # Calcular média histórica por serviço
    historical_by_service = {}
    
    for report in historical_costs:
        for service, cost in report.get("costs_by_service", {}).items():
            if service not in historical_by_service:
                historical_by_service[service] = []
            historical_by_service[service].append(cost)
    
    # Detectar anomalias
    for service, current_cost in current_costs.items():
        if service not in historical_by_service:
            continue
        
        historical_values = historical_by_service[service]
        avg_cost = statistics.mean(historical_values)
        
        if avg_cost == 0:
            continue
        
        # Calcular mudança percentual
        change_pct = ((current_cost - avg_cost) / avg_cost) * 100
        
        # Detectar anomalia (aumento > 50%)
        if change_pct > 50:
            anomalies.append({
                "service": service,
                "current_cost_usd": current_cost,
                "average_cost_usd": avg_cost,
                "change_percentage": change_pct,
                "severity": "critical" if change_pct > 100 else "warning"
            })
    
    return anomalies


def count_recommendations() -> int:
    """
    Conta número de recomendações geradas hoje.
    
    Returns:
        Número de recomendações
    """
    today = datetime.now(UTC).date().isoformat()
    prefix = f"recommendations/dt={today}/"
    
    try:
        response = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix)
        
        if "Contents" not in response:
            return 0
        
        # Pegar último arquivo
        latest_file = sorted(response["Contents"], key=lambda x: x["Key"])[-1]
        key = latest_file["Key"]
        
        # Carregar recomendações
        obj = s3.get_object(Bucket=BUCKET, Key=key)
        recs = json.loads(obj["Body"].read().decode("utf-8"))
        
        return len(recs.get("recommendations", []))
        
    except Exception as e:
        logger.warning(f"Error counting recommendations: {e}")
        return 0


def handler(event, context):
    """
    Monitora custos da infraestrutura AWS.
    
    Implementa:
    - Req 9.1-9.7: Monitoramento completo de custos
    """
    now = datetime.now(UTC)
    today_str = now.date().isoformat()
    
    logger.info(f"Starting cost monitoring for {today_str}")
    
    try:
        # 1. Obter custos dos últimos 7 dias (Req 9.1)
        end_date = now.date().isoformat()
        start_date = (now.date() - timedelta(days=7)).isoformat()
        
        cost_response = get_cost_and_usage(start_date, end_date)
        costs_by_service = parse_costs_by_service(cost_response)
        
        logger.info(f"Collected costs for {len(costs_by_service)} services")
        
        # 2. Categorizar custos por componente (Req 9.4)
        categorized_costs = categorize_costs(costs_by_service)
        
        # 3. Calcular total dos últimos 7 dias
        total_7_days_usd = sum(costs_by_service.values())
        total_7_days_brl = total_7_days_usd * USD_TO_BRL
        
        # 4. Calcular projeção mensal (Req 9.2)
        monthly_projection_usd = calculate_monthly_projection(total_7_days_usd)
        monthly_projection_brl = monthly_projection_usd * USD_TO_BRL
        
        logger.info(f"Monthly projection: ${monthly_projection_usd:.2f} USD (R${monthly_projection_brl:.2f} BRL)")
        
        # 5. Verificar threshold (Req 9.3)
        threshold_exceeded = monthly_projection_brl > COST_THRESHOLD_BRL
        threshold_warning = monthly_projection_brl > (COST_THRESHOLD_BRL * 0.8)  # 80%
        
        alert_level = None
        if threshold_exceeded:
            alert_level = "critical"
            logger.warning(f"CRITICAL: Monthly projection exceeds threshold (R${monthly_projection_brl:.2f} > R${COST_THRESHOLD_BRL})")
        elif threshold_warning:
            alert_level = "warning"
            logger.warning(f"WARNING: Monthly projection at 80% of threshold (R${monthly_projection_brl:.2f})")
        
        # 6. Contar recomendações e calcular custo por recomendação (Req 9.5)
        num_recommendations = count_recommendations()
        cost_per_recommendation_usd = monthly_projection_usd / num_recommendations if num_recommendations > 0 else 0
        cost_per_recommendation_brl = cost_per_recommendation_usd * USD_TO_BRL
        
        logger.info(f"Cost per recommendation: ${cost_per_recommendation_usd:.4f} USD (R${cost_per_recommendation_brl:.4f} BRL)")
        
        # 7. Carregar histórico e detectar anomalias (Req 9.7)
        historical_costs = load_historical_costs(days=7)
        anomalies = detect_cost_anomalies(costs_by_service, historical_costs)
        
        if anomalies:
            logger.warning(f"Detected {len(anomalies)} cost anomalies")
        
        # 8. Montar relatório completo (Req 9.6)
        report = {
            "timestamp": now.isoformat(),
            "date": today_str,
            "period": {
                "start_date": start_date,
                "end_date": end_date,
                "days": 7
            },
            "costs_by_service": costs_by_service,
            "costs_by_component": categorized_costs,
            "total_7_days": {
                "usd": total_7_days_usd,
                "brl": total_7_days_brl
            },
            "monthly_projection": {
                "usd": monthly_projection_usd,
                "brl": monthly_projection_brl
            },
            "threshold": {
                "limit_brl": COST_THRESHOLD_BRL,
                "exceeded": threshold_exceeded,
                "warning": threshold_warning,
                "percentage": (monthly_projection_brl / COST_THRESHOLD_BRL) * 100,
                "alert_level": alert_level
            },
            "recommendations": {
                "count": num_recommendations,
                "cost_per_recommendation_usd": cost_per_recommendation_usd,
                "cost_per_recommendation_brl": cost_per_recommendation_brl
            },
            "anomalies": anomalies,
            "exchange_rate": USD_TO_BRL
        }
        
        # 9. Salvar relatório no S3 (Req 9.6)
        cost_key = f"monitoring/costs/dt={today_str}/costs_{now.strftime('%H%M%S')}.json"
        s3.put_object(
            Bucket=BUCKET,
            Key=cost_key,
            Body=json.dumps(report, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        
        logger.info(f"Saved cost report to {cost_key}")
        
        # 10. Publicar métricas no CloudWatch
        try:
            cloudwatch.put_metric_data(
                Namespace="B3TR",
                MetricData=[
                    {
                        "MetricName": "TotalCostUSD",
                        "Value": total_7_days_usd,
                        "Unit": "None",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "MonthlyProjectionBRL",
                        "Value": monthly_projection_brl,
                        "Unit": "None",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "CostPerRecommendationBRL",
                        "Value": cost_per_recommendation_brl,
                        "Unit": "None",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "CostThresholdExceeded",
                        "Value": 1 if threshold_exceeded else 0,
                        "Unit": "None",
                        "Timestamp": now
                    },
                    {
                        "MetricName": "CostAnomaliesDetected",
                        "Value": len(anomalies),
                        "Unit": "Count",
                        "Timestamp": now
                    }
                ]
            )
        except Exception as e:
            logger.error(f"Error publishing CloudWatch metrics: {e}")
        
        result = {
            "ok": True,
            "total_7_days_usd": total_7_days_usd,
            "monthly_projection_brl": monthly_projection_brl,
            "threshold_exceeded": threshold_exceeded,
            "anomalies_count": len(anomalies),
            "cost_key": cost_key
        }

        try:
            from dl.src.lambdas.ws_broadcast import notify
            notify("costs", result)
        except Exception:
            pass

        return result
        
    except Exception as e:
        logger.error(f"Error in cost monitoring: {e}", exc_info=True)
        
        # Salvar erro
        error_key = f"monitoring/costs/dt={today_str}/error_{now.strftime('%H%M%S')}.json"
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
