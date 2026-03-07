"""
Lambda para gerar dados de exemplo para o dashboard web
Executa uma vez para popular o dashboard com dados iniciais
"""

import json
import logging
import os
import random
from datetime import datetime, timedelta
from typing import Any

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")


def generate_sample_recommendations(bucket: str, days: int = 30) -> None:
    """Gera dados de exemplo para recomendações diárias"""

    tickers = [
        "PETR4",
        "VALE3",
        "ITUB4",
        "BBDC4",
        "ABEV3",
        "MGLU3",
        "WEGE3",
        "RENT3",
        "LREN3",
        "GGBR4",
    ]
    sectors = {
        "PETR4": "Petróleo",
        "VALE3": "Mineração",
        "ITUB4": "Bancos",
        "BBDC4": "Bancos",
        "ABEV3": "Bebidas",
        "MGLU3": "Varejo",
        "WEGE3": "Máquinas",
        "RENT3": "Locação",
        "LREN3": "Varejo",
        "GGBR4": "Siderurgia",
    }

    end_date = datetime.now().date()

    for i in range(days):
        dt = end_date - timedelta(days=i)

        # Gerar rankings para o dia
        recommendations = []
        for rank, ticker in enumerate(random.sample(tickers, 10), 1):
            score = random.uniform(0.6, 0.95)
            predicted_return = random.uniform(-0.05, 0.15)
            confidence = random.uniform(0.7, 0.95)

            recommendations.append(
                {
                    "ticker": ticker,
                    "score": round(score, 4),
                    "rank": rank,
                    "predicted_return": round(predicted_return, 4),
                    "confidence": round(confidence, 4),
                    "sector": sectors[ticker],
                    "dt": dt.isoformat(),
                }
            )

        # Salvar no S3
        key = f"recommendations/dt={dt.isoformat()}/top50.json"
        content = json.dumps({"recommendations": recommendations, "dt": dt.isoformat()}, indent=2)

        s3.put_object(
            Bucket=bucket, Key=key, Body=content.encode("utf-8"), ContentType="application/json"
        )

        logger.info(f"Generated recommendations for {dt}")


def generate_sample_quality_data(bucket: str, days: int = 30) -> None:
    """Gera dados de exemplo para qualidade do modelo"""

    end_date = datetime.now().date()

    for i in range(days):
        dt = end_date - timedelta(days=i)

        # Simular métricas de qualidade com tendência
        base_mape = 0.15 + random.uniform(-0.05, 0.05)
        mape = max(0.05, min(0.30, base_mape + random.uniform(-0.02, 0.02)))

        mae = mape * random.uniform(0.8, 1.2)
        rmse = mae * random.uniform(1.1, 1.4)
        coverage = random.uniform(0.85, 0.98)

        total_predictions = random.randint(180, 220)
        successful_predictions = int(total_predictions * coverage)

        status = "good" if mape < 0.20 else "warning" if mape < 0.25 else "critical"

        quality_data = {
            "dt": dt.isoformat(),
            "mape": round(mape, 4),
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "coverage": round(coverage, 4),
            "status": status,
            "total_predictions": total_predictions,
            "successful_predictions": successful_predictions,
            "dt_origin": (dt - timedelta(days=1)).isoformat(),
        }

        # Salvar no S3
        timestamp = datetime.now().strftime("%H%M%S")
        key = f"monitoring/model_quality/dt={dt.isoformat()}/quality_{timestamp}.json"
        content = json.dumps(quality_data, indent=2)

        s3.put_object(
            Bucket=bucket, Key=key, Body=content.encode("utf-8"), ContentType="application/json"
        )

        logger.info(f"Generated quality data for {dt}")


def generate_sample_ingestion_data(bucket: str, days: int = 7) -> None:
    """Gera dados de exemplo para monitoramento de ingestão"""

    end_date = datetime.now()

    # Gerar dados por hora para os últimos dias
    for day in range(days):
        for hour in range(24):
            timestamp = end_date - timedelta(days=day, hours=hour)

            # Simular dados de ingestão
            success_rate = random.uniform(0.85, 0.99)
            if success_rate > 0.90:
                status = "success"
            elif success_rate > 0.80:
                status = "warning"
            else:
                status = "error"

            if status == "success":
                records_ingested = random.randint(150, 250)
                execution_time_ms = random.randint(2000, 8000)
            else:
                records_ingested = random.randint(50, 150)
                execution_time_ms = random.randint(8000, 15000)

            if status == "success":
                error_message = ""
            elif random.random() > 0.5:
                error_message = "Timeout na API BRAPI"
            else:
                error_message = "Rate limit exceeded"

            ingestion_data = {
                "timestamp": timestamp.isoformat(),
                "status": status,
                "records_ingested": records_ingested,
                "execution_time_ms": execution_time_ms,
                "error_message": error_message,
                "source": "brapi_pro",
            }

            # Salvar no S3
            dt_str = timestamp.strftime("%Y-%m-%d")
            hour_str = timestamp.strftime("%H%M%S")
            key = f"monitoring/ingestion/dt={dt_str}/ingestion_{hour_str}.json"
            content = json.dumps(ingestion_data, indent=2)

            s3.put_object(
                Bucket=bucket, Key=key, Body=content.encode("utf-8"), ContentType="application/json"
            )

        logger.info(f"Generated ingestion data for day {day}")


def handler(event: dict[str, Any], context) -> dict[str, Any]:
    """Handler principal"""

    try:
        # Get bucket from environment variable
        bucket_name = os.environ["BUCKET"]

        logger.info("Generating sample data for web dashboard...")

        # Gerar dados de exemplo
        generate_sample_recommendations(bucket_name, days=30)
        generate_sample_quality_data(bucket_name, days=30)
        generate_sample_ingestion_data(bucket_name, days=7)

        logger.info("Sample data generation completed successfully")

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Sample data generated successfully",
                    "bucket": bucket_name,
                    "timestamp": datetime.now().isoformat(),
                }
            ),
        }

    except Exception as e:
        logger.error(f"Error generating sample data: {str(e)}")
        raise
