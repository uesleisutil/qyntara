"""
Lambda: Monitor de Custos e Performance

Monitora TODOS os gastos do sistema:
- SageMaker (training jobs, endpoints, batch transforms)
- Lambda (invocações, duração, memória)
- S3 (storage, requests)
- CloudWatch (logs, métricas)
- API Gateway (requests)

Envia alertas se custos ultrapassarem limites.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

ce = boto3.client("ce")  # Cost Explorer
cloudwatch = boto3.client("cloudwatch")
sns = boto3.client("sns")
s3 = boto3.client("s3")


def get_cost_and_usage(start_date: str, end_date: str, granularity: str = "DAILY") -> dict:
    """
    Obtém custos do Cost Explorer.
    """
    logger.info(f"Obtendo custos de {start_date} a {end_date}")
    
    response = ce.get_cost_and_usage(
        TimePeriod={
            'Start': start_date,
            'End': end_date
        },
        Granularity=granularity,
        Metrics=['UnblendedCost', 'UsageQuantity'],
        GroupBy=[
            {'Type': 'DIMENSION', 'Key': 'SERVICE'},
        ]
    )
    
    return response


def parse_costs(response: dict) -> dict[str, float]:
    """
    Parseia resposta do Cost Explorer.
    """
    costs_by_service = {}
    
    for result in response['ResultsByTime']:
        for group in result['Groups']:
            service = group['Keys'][0]
            cost = float(group['Metrics']['UnblendedCost']['Amount'])
            
            if service not in costs_by_service:
                costs_by_service[service] = 0.0
            costs_by_service[service] += cost
    
    return costs_by_service


def get_sagemaker_costs() -> dict:
    """
    Obtém custos detalhados do SageMaker.
    """
    logger.info("Obtendo custos do SageMaker...")
    
    sagemaker = boto3.client("sagemaker")
    
    # Training jobs (últimos 7 dias)
    end_time = datetime.now(UTC)
    start_time = end_time - timedelta(days=7)
    
    training_jobs = sagemaker.list_training_jobs(
        CreationTimeAfter=start_time,
        CreationTimeBefore=end_time,
        SortBy='CreationTime',
        SortOrder='Descending'
    )
    
    training_costs = []
    for job in training_jobs['TrainingJobSummaries']:
        job_name = job['TrainingJobName']
        
        # Obter detalhes
        details = sagemaker.describe_training_job(TrainingJobName=job_name)
        
        instance_type = details['ResourceConfig']['InstanceType']
        instance_count = details['ResourceConfig']['InstanceCount']
        
        # Calcular duração
        if 'TrainingEndTime' in details:
            duration = (details['TrainingEndTime'] - details['TrainingStartTime']).total_seconds() / 3600
        else:
            duration = 0
        
        # Estimar custo (preços aproximados)
        instance_prices = {
            'ml.m5.xlarge': 0.23,
            'ml.m5.2xlarge': 0.46,
            'ml.c5.2xlarge': 0.38,
            'ml.c5.4xlarge': 0.77,
            'ml.p3.2xlarge': 3.82
        }
        
        price_per_hour = instance_prices.get(instance_type, 0.5)
        estimated_cost = duration * price_per_hour * instance_count
        
        training_costs.append({
            'job_name': job_name,
            'instance_type': instance_type,
            'duration_hours': round(duration, 2),
            'estimated_cost': round(estimated_cost, 2),
            'status': details['TrainingJobStatus']
        })
    
    # Endpoints ativos
    endpoints = sagemaker.list_endpoints()
    
    endpoint_costs = []
    for endpoint in endpoints['Endpoints']:
        endpoint_name = endpoint['EndpointName']
        
        # Obter detalhes
        details = sagemaker.describe_endpoint(EndpointName=endpoint_name)
        config = sagemaker.describe_endpoint_config(
            EndpointConfigName=details['EndpointConfigName']
        )
        
        for variant in config['ProductionVariants']:
            instance_type = variant['InstanceType']
            instance_count = variant['InitialInstanceCount']
            
            # Calcular tempo ativo (desde criação)
            creation_time = endpoint['CreationTime']
            hours_active = (datetime.now(UTC) - creation_time).total_seconds() / 3600
            
            # Estimar custo
            instance_prices = {
                'ml.t2.medium': 0.065,
                'ml.t2.small': 0.032,
                'ml.m5.large': 0.115,
                'ml.m5.xlarge': 0.23
            }
            
            price_per_hour = instance_prices.get(instance_type, 0.1)
            estimated_cost = hours_active * price_per_hour * instance_count
            
            endpoint_costs.append({
                'endpoint_name': endpoint_name,
                'instance_type': instance_type,
                'instance_count': instance_count,
                'hours_active': round(hours_active, 2),
                'estimated_cost': round(estimated_cost, 2),
                'status': endpoint['EndpointStatus']
            })
    
    return {
        'training_jobs': training_costs,
        'endpoints': endpoint_costs,
        'total_training': sum(j['estimated_cost'] for j in training_costs),
        'total_endpoints': sum(e['estimated_cost'] for e in endpoint_costs)
    }


def get_lambda_costs() -> dict:
    """
    Obtém métricas de Lambda (invocações, duração, erros).
    """
    logger.info("Obtendo métricas do Lambda...")
    
    lambda_client = boto3.client("lambda")
    
    # Listar todas as funções
    functions = lambda_client.list_functions()
    
    lambda_metrics = []
    
    for func in functions['Functions']:
        func_name = func['FunctionName']
        
        # Pular se não for do projeto
        if 'B3TacticalRanking' not in func_name:
            continue
        
        # Obter métricas do CloudWatch (últimos 7 dias)
        end_time = datetime.now(UTC)
        start_time = end_time - timedelta(days=7)
        
        # Invocações
        invocations = cloudwatch.get_metric_statistics(
            Namespace='AWS/Lambda',
            MetricName='Invocations',
            Dimensions=[{'Name': 'FunctionName', 'Value': func_name}],
            StartTime=start_time,
            EndTime=end_time,
            Period=86400,  # 1 dia
            Statistics=['Sum']
        )
        
        # Duração
        duration = cloudwatch.get_metric_statistics(
            Namespace='AWS/Lambda',
            MetricName='Duration',
            Dimensions=[{'Name': 'FunctionName', 'Value': func_name}],
            StartTime=start_time,
            EndTime=end_time,
            Period=86400,
            Statistics=['Average', 'Maximum']
        )
        
        # Erros
        errors = cloudwatch.get_metric_statistics(
            Namespace='AWS/Lambda',
            MetricName='Errors',
            Dimensions=[{'Name': 'FunctionName', 'Value': func_name}],
            StartTime=start_time,
            EndTime=end_time,
            Period=86400,
            Statistics=['Sum']
        )
        
        total_invocations = sum(p['Sum'] for p in invocations['Datapoints'])
        avg_duration = sum(p['Average'] for p in duration['Datapoints']) / len(duration['Datapoints']) if duration['Datapoints'] else 0
        total_errors = sum(p['Sum'] for p in errors['Datapoints'])
        
        # Estimar custo
        # $0.20 por 1M requests + $0.0000166667 por GB-segundo
        memory_gb = func['MemorySize'] / 1024
        gb_seconds = (total_invocations * avg_duration / 1000) * memory_gb
        
        request_cost = (total_invocations / 1_000_000) * 0.20
        compute_cost = gb_seconds * 0.0000166667
        estimated_cost = request_cost + compute_cost
        
        lambda_metrics.append({
            'function_name': func_name.split('-')[-1],  # Nome curto
            'invocations': int(total_invocations),
            'avg_duration_ms': round(avg_duration, 2),
            'errors': int(total_errors),
            'memory_mb': func['MemorySize'],
            'estimated_cost': round(estimated_cost, 4)
        })
    
    return {
        'functions': lambda_metrics,
        'total_cost': sum(f['estimated_cost'] for f in lambda_metrics),
        'total_invocations': sum(f['invocations'] for f in lambda_metrics),
        'total_errors': sum(f['errors'] for f in lambda_metrics)
    }


def get_s3_metrics(bucket: str) -> dict:
    """
    Obtém métricas de S3 (storage, requests).
    """
    logger.info(f"Obtendo métricas do S3: {bucket}")
    
    # Tamanho do bucket
    try:
        response = cloudwatch.get_metric_statistics(
            Namespace='AWS/S3',
            MetricName='BucketSizeBytes',
            Dimensions=[
                {'Name': 'BucketName', 'Value': bucket},
                {'Name': 'StorageType', 'Value': 'StandardStorage'}
            ],
            StartTime=datetime.now(UTC) - timedelta(days=1),
            EndTime=datetime.now(UTC),
            Period=86400,
            Statistics=['Average']
        )
        
        size_bytes = response['Datapoints'][0]['Average'] if response['Datapoints'] else 0
        size_gb = size_bytes / (1024 ** 3)
        
        # Custo de storage: $0.023 por GB/mês
        storage_cost = size_gb * 0.023
        
    except Exception as e:
        logger.warning(f"Erro ao obter tamanho do bucket: {e}")
        size_gb = 0
        storage_cost = 0
    
    # Número de objetos
    try:
        response = cloudwatch.get_metric_statistics(
            Namespace='AWS/S3',
            MetricName='NumberOfObjects',
            Dimensions=[
                {'Name': 'BucketName', 'Value': bucket},
                {'Name': 'StorageType', 'Value': 'AllStorageTypes'}
            ],
            StartTime=datetime.now(UTC) - timedelta(days=1),
            EndTime=datetime.now(UTC),
            Period=86400,
            Statistics=['Average']
        )
        
        num_objects = int(response['Datapoints'][0]['Average']) if response['Datapoints'] else 0
        
    except Exception as e:
        logger.warning(f"Erro ao obter número de objetos: {e}")
        num_objects = 0
    
    return {
        'bucket': bucket,
        'size_gb': round(size_gb, 2),
        'num_objects': num_objects,
        'estimated_monthly_cost': round(storage_cost, 2)
    }


def check_cost_thresholds(costs: dict, thresholds: dict) -> list[str]:
    """
    Verifica se custos ultrapassaram limites.
    """
    alerts = []
    
    # SageMaker
    if costs['sagemaker']['total_endpoints'] > thresholds.get('sagemaker_endpoints', 50):
        alerts.append(
            f"⚠️ ALERTA: Custos de endpoints SageMaker: ${costs['sagemaker']['total_endpoints']:.2f} "
            f"(limite: ${thresholds['sagemaker_endpoints']})"
        )
    
    # Lambda
    if costs['lambda']['total_cost'] > thresholds.get('lambda', 5):
        alerts.append(
            f"⚠️ ALERTA: Custos de Lambda: ${costs['lambda']['total_cost']:.2f} "
            f"(limite: ${thresholds['lambda']})"
        )
    
    # S3
    if costs['s3']['estimated_monthly_cost'] > thresholds.get('s3', 10):
        alerts.append(
            f"⚠️ ALERTA: Custos de S3: ${costs['s3']['estimated_monthly_cost']:.2f} "
            f"(limite: ${thresholds['s3']})"
        )
    
    # Total
    total_cost = (
        costs['sagemaker']['total_training'] +
        costs['sagemaker']['total_endpoints'] +
        costs['lambda']['total_cost'] +
        costs['s3']['estimated_monthly_cost']
    )
    
    if total_cost > thresholds.get('total', 100):
        alerts.append(
            f"🚨 ALERTA CRÍTICO: Custo total estimado: ${total_cost:.2f} "
            f"(limite: ${thresholds['total']})"
        )
    
    return alerts


def send_alert(topic_arn: str, subject: str, message: str):
    """
    Envia alerta via SNS.
    """
    logger.info(f"Enviando alerta: {subject}")
    
    sns.publish(
        TopicArn=topic_arn,
        Subject=subject,
        Message=message
    )


def save_report(bucket: str, report: dict):
    """
    Salva relatório de custos no S3.
    """
    dt = datetime.now(UTC).date().isoformat()
    key = f"cost-reports/{dt}/cost_report.json"
    
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(report, indent=2).encode('utf-8'),
        ContentType='application/json'
    )
    
    logger.info(f"Relatório salvo em s3://{bucket}/{key}")


def handler(event, context):
    """
    Handler principal.
    
    Event pode conter:
    - bucket: Bucket S3 para análise
    - alert_topic_arn: ARN do tópico SNS para alertas
    - thresholds: Limites de custo
    """
    bucket = event.get('bucket', 'b3tr-200093399689-us-east-1')
    alert_topic_arn = event.get('alert_topic_arn')
    
    # Limites de custo (USD)
    thresholds = event.get('thresholds', {
        'sagemaker_endpoints': 50,  # $50/mês
        'sagemaker_training': 10,   # $10/mês
        'lambda': 5,                # $5/mês
        's3': 10,                   # $10/mês
        'total': 100                # $100/mês
    })
    
    logger.info("Iniciando monitoramento de custos...")
    
    # Coletar métricas
    sagemaker_costs = get_sagemaker_costs()
    lambda_costs = get_lambda_costs()
    s3_metrics = get_s3_metrics(bucket)
    
    # Montar relatório
    report = {
        'timestamp': datetime.now(UTC).isoformat(),
        'sagemaker': sagemaker_costs,
        'lambda': lambda_costs,
        's3': s3_metrics,
        'total_estimated_cost': (
            sagemaker_costs['total_training'] +
            sagemaker_costs['total_endpoints'] +
            lambda_costs['total_cost'] +
            s3_metrics['estimated_monthly_cost']
        ),
        'thresholds': thresholds
    }
    
    # Verificar limites
    alerts = check_cost_thresholds(report, thresholds)
    
    if alerts:
        report['alerts'] = alerts
        
        # Enviar alerta
        if alert_topic_arn:
            alert_message = "\n".join(alerts)
            alert_message += f"\n\nRelatório completo salvo em S3"
            
            send_alert(
                alert_topic_arn,
                "🚨 Alerta de Custos - B3 Tactical Ranking",
                alert_message
            )
    
    # Salvar relatório
    save_report(bucket, report)
    
    # Publicar métricas customizadas
    cloudwatch.put_metric_data(
        Namespace='B3TR/Costs',
        MetricData=[
            {
                'MetricName': 'TotalCost',
                'Value': report['total_estimated_cost'],
                'Unit': 'None',
                'Timestamp': datetime.now(UTC)
            },
            {
                'MetricName': 'SageMakerEndpointCost',
                'Value': sagemaker_costs['total_endpoints'],
                'Unit': 'None',
                'Timestamp': datetime.now(UTC)
            },
            {
                'MetricName': 'LambdaCost',
                'Value': lambda_costs['total_cost'],
                'Unit': 'None',
                'Timestamp': datetime.now(UTC)
            }
        ]
    )
    
    logger.info(f"Custo total estimado: ${report['total_estimated_cost']:.2f}")
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'total_cost': report['total_estimated_cost'],
            'alerts': alerts if alerts else [],
            'report_s3_key': f"cost-reports/{datetime.now(UTC).date().isoformat()}/cost_report.json"
        })
    }
