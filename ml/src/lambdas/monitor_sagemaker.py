"""
Lambda: Monitor SageMaker Resources

Monitora recursos do SageMaker para detectar instâncias ativas:
- Training Jobs (em progresso)
- Endpoints (InService - ALERTA: custo 24/7)
- Transform Jobs (em progresso)

Salva status no S3 e envia alertas se endpoints estiverem ativos.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime

import boto3

from ml.src.runtime_config import load_runtime_config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
sagemaker = boto3.client("sagemaker")
sns = boto3.client("sns")


def list_training_jobs() -> list[dict]:
    """Lista training jobs recentes (últimos 7 dias)."""
    try:
        response = sagemaker.list_training_jobs(
            SortBy='CreationTime',
            SortOrder='Descending',
            MaxResults=50
        )
        
        jobs = []
        for job_summary in response.get('TrainingJobSummaries', []):
            job_name = job_summary['TrainingJobName']
            
            # Pegar detalhes do job
            try:
                details = sagemaker.describe_training_job(TrainingJobName=job_name)
                
                # Calcular duração
                creation_time = details['CreationTime']
                end_time = details.get('TrainingEndTime', datetime.now(UTC))
                duration = (end_time - creation_time).total_seconds()
                
                jobs.append({
                    'name': job_name,
                    'status': details['TrainingJobStatus'],
                    'instance_type': details['ResourceConfig']['InstanceType'],
                    'instance_count': details['ResourceConfig']['InstanceCount'],
                    'creation_time': creation_time.isoformat(),
                    'end_time': end_time.isoformat() if 'TrainingEndTime' in details else None,
                    'duration_seconds': int(duration),
                })
            except Exception as e:
                logger.error(f"Erro ao obter detalhes do job {job_name}: {e}")
        
        return jobs
    except Exception as e:
        logger.error(f"Erro ao listar training jobs: {e}")
        return []


def list_endpoints() -> list[dict]:
    """Lista endpoints ativos."""
    try:
        response = sagemaker.list_endpoints(
            SortBy='CreationTime',
            SortOrder='Descending',
            MaxResults=50
        )
        
        endpoints = []
        for endpoint_summary in response.get('Endpoints', []):
            endpoint_name = endpoint_summary['EndpointName']
            
            # Pegar detalhes do endpoint
            try:
                details = sagemaker.describe_endpoint(EndpointName=endpoint_name)
                
                # Pegar configuração
                config_name = details['EndpointConfigName']
                config = sagemaker.describe_endpoint_config(EndpointConfigName=config_name)
                
                # Primeira variante (assumindo single variant)
                variant = config['ProductionVariants'][0]
                
                endpoints.append({
                    'name': endpoint_name,
                    'status': details['EndpointStatus'],
                    'instance_type': variant['InstanceType'],
                    'instance_count': variant['InitialInstanceCount'],
                    'creation_time': details['CreationTime'].isoformat(),
                })
            except Exception as e:
                logger.error(f"Erro ao obter detalhes do endpoint {endpoint_name}: {e}")
        
        return endpoints
    except Exception as e:
        logger.error(f"Erro ao listar endpoints: {e}")
        return []


def list_transform_jobs() -> list[dict]:
    """Lista transform jobs recentes."""
    try:
        response = sagemaker.list_transform_jobs(
            SortBy='CreationTime',
            SortOrder='Descending',
            MaxResults=50
        )
        
        jobs = []
        for job_summary in response.get('TransformJobSummaries', []):
            job_name = job_summary['TransformJobName']
            
            # Pegar detalhes do job
            try:
                details = sagemaker.describe_transform_job(TransformJobName=job_name)
                
                # Calcular duração
                creation_time = details['CreationTime']
                end_time = details.get('TransformEndTime', datetime.now(UTC))
                duration = (end_time - creation_time).total_seconds()
                
                jobs.append({
                    'name': job_name,
                    'status': details['TransformJobStatus'],
                    'instance_type': details['TransformResources']['InstanceType'],
                    'instance_count': details['TransformResources']['InstanceCount'],
                    'creation_time': creation_time.isoformat(),
                    'end_time': end_time.isoformat() if 'TransformEndTime' in details else None,
                    'duration_seconds': int(duration),
                })
            except Exception as e:
                logger.error(f"Erro ao obter detalhes do transform job {job_name}: {e}")
        
        return jobs
    except Exception as e:
        logger.error(f"Erro ao listar transform jobs: {e}")
        return []


def calculate_estimated_cost(training_jobs: list, endpoints: list, transform_jobs: list) -> float:
    """Calcula custo estimado diário baseado em recursos ativos."""
    
    # Custos por hora (us-east-1)
    costs = {
        'ml.t2.medium': 0.065,
        'ml.t2.large': 0.13,
        'ml.m5.large': 0.134,
        'ml.m5.xlarge': 0.269,
        'ml.m5.2xlarge': 0.538,
        'ml.c5.xlarge': 0.238,
        'ml.c5.2xlarge': 0.476,
        'ml.c5.4xlarge': 0.952,
        'ml.p3.2xlarge': 3.825
    }
    
    total_cost = 0.0
    
    # Endpoints (custo 24h)
    for endpoint in endpoints:
        if endpoint['status'] == 'InService':
            instance_type = endpoint['instance_type']
            instance_count = endpoint['instance_count']
            cost_per_hour = costs.get(instance_type, 0.2)
            total_cost += cost_per_hour * instance_count * 24
    
    # Training jobs ativos (estimativa de 1h)
    for job in training_jobs:
        if job['status'] == 'InProgress':
            instance_type = job['instance_type']
            instance_count = job['instance_count']
            cost_per_hour = costs.get(instance_type, 0.2)
            total_cost += cost_per_hour * instance_count * 1  # Estimativa de 1h
    
    # Transform jobs ativos (estimativa de 1h)
    for job in transform_jobs:
        if job['status'] == 'InProgress':
            instance_type = job['instance_type']
            instance_count = job['instance_count']
            cost_per_hour = costs.get(instance_type, 0.2)
            total_cost += cost_per_hour * instance_count * 1  # Estimativa de 1h
    
    return total_cost


def save_status(bucket: str, status: dict):
    """Salva status no S3."""
    now = datetime.now(UTC)
    dt = now.date().isoformat()
    timestamp = now.strftime("%Y%m%d-%H%M%S")
    
    key = f"monitoring/sagemaker/dt={dt}/{timestamp}-status.json"
    
    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(status, indent=2).encode('utf-8'),
        ContentType='application/json'
    )
    
    logger.info(f"Status salvo em {key}")


def send_alert(topic_arn: str, endpoints: list):
    """Envia alerta sobre endpoints ativos."""
    active_endpoints = [e for e in endpoints if e['status'] == 'InService']
    
    if not active_endpoints:
        return
    
    message = f"""
B3 Tactical Ranking - Alerta de Endpoints SageMaker

⚠️ ENDPOINTS ATIVOS DETECTADOS ⚠️

O sistema detectou {len(active_endpoints)} endpoint(s) SageMaker ativo(s).
Endpoints geram custo 24/7 (~$47/mês por ml.t2.medium).

O sistema foi projetado para inferência in-memory (sem endpoints).

Endpoints Ativos:
"""
    
    for endpoint in active_endpoints:
        cost_per_month = 0.065 * 730 if endpoint['instance_type'] == 'ml.t2.medium' else 100
        message += f"""
- Nome: {endpoint['name']}
- Tipo: {endpoint['instance_type']}
- Instâncias: {endpoint['instance_count']}
- Custo estimado: ${cost_per_month:.2f}/mês
- Criado: {endpoint['creation_time']}

Comando para deletar:
aws sagemaker delete-endpoint --endpoint-name {endpoint['name']}
"""
    
    message += """
Ação Recomendada:
Deletar endpoints não utilizados imediatamente para evitar custos desnecessários.
"""
    
    try:
        sns.publish(
            TopicArn=topic_arn,
            Subject="B3TR: Endpoints SageMaker Ativos Detectados",
            Message=message
        )
        logger.info(f"Alerta enviado para {len(active_endpoints)} endpoints ativos")
    except Exception as e:
        logger.error(f"Erro ao enviar alerta: {e}")


def handler(event, context):
    """
    Handler principal.
    
    Monitora recursos do SageMaker e salva status no S3.
    """
    cfg = load_runtime_config()
    bucket = cfg.bucket
    
    now = datetime.now(UTC)
    
    logger.info("Iniciando monitoramento do SageMaker")
    
    # Listar recursos
    training_jobs = list_training_jobs()
    endpoints = list_endpoints()
    transform_jobs = list_transform_jobs()
    
    logger.info(f"Training jobs: {len(training_jobs)}")
    logger.info(f"Endpoints: {len(endpoints)}")
    logger.info(f"Transform jobs: {len(transform_jobs)}")
    
    # Calcular custo estimado
    estimated_cost = calculate_estimated_cost(training_jobs, endpoints, transform_jobs)
    
    # Contar recursos ativos
    active_training = len([j for j in training_jobs if j['status'] == 'InProgress'])
    active_endpoints = len([e for e in endpoints if e['status'] == 'InService'])
    active_transform = len([j for j in transform_jobs if j['status'] == 'InProgress'])
    
    # Preparar status
    status = {
        'timestamp': now.isoformat(),
        'training_jobs': training_jobs,
        'endpoints': endpoints,
        'transform_jobs': transform_jobs,
        'summary': {
            'total_training_jobs': len(training_jobs),
            'active_training_jobs': active_training,
            'total_endpoints': len(endpoints),
            'active_endpoints': active_endpoints,
            'total_transform_jobs': len(transform_jobs),
            'active_transform_jobs': active_transform,
        },
        'estimated_daily_cost': estimated_cost,
        'has_active_endpoints': active_endpoints > 0,
    }
    
    # Salvar status
    save_status(bucket, status)
    
    # Enviar alerta se houver endpoints ativos
    if active_endpoints > 0:
        logger.warning(f"⚠️ {active_endpoints} endpoint(s) ativo(s) detectado(s)")
        topic_arn = event.get('alerts_topic_arn')
        if topic_arn:
            send_alert(topic_arn, endpoints)
    
    return {
        "ok": True,
        "timestamp": now.isoformat(),
        "active_training_jobs": active_training,
        "active_endpoints": active_endpoints,
        "active_transform_jobs": active_transform,
        "estimated_daily_cost": estimated_cost,
        "alert_sent": active_endpoints > 0,
    }
