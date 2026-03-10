"""
Otimização de Hiperparâmetros para SageMaker

Usa SageMaker Hyperparameter Tuning Jobs para encontrar os melhores hiperparâmetros.
Otimiza para minimizar RMSE de validação.
"""

import argparse
import json
import logging
from datetime import datetime

import boto3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sagemaker = boto3.client('sagemaker')


def create_tuning_job(
    job_name: str,
    train_data_s3: str,
    output_s3: str,
    role_arn: str,
    instance_type: str = "ml.m5.xlarge",
    max_jobs: int = 20,
    max_parallel_jobs: int = 2
):
    """
    Cria Hyperparameter Tuning Job no SageMaker.
    
    Args:
        job_name: Nome do tuning job
        train_data_s3: S3 URI dos dados de treino
        output_s3: S3 URI para output
        role_arn: ARN da role do SageMaker
        instance_type: Tipo de instância
        max_jobs: Máximo de jobs de treino
        max_parallel_jobs: Jobs paralelos
    """
    
    region = boto3.Session().region_name
    image_uri = f"683313688378.dkr.ecr.{region}.amazonaws.com/sagemaker-xgboost:1.7-1"
    
    logger.info(f"Criando tuning job: {job_name}")
    logger.info(f"Max jobs: {max_jobs}, Parallel: {max_parallel_jobs}")
    
    response = sagemaker.create_hyper_parameter_tuning_job(
        HyperParameterTuningJobName=job_name,
        HyperParameterTuningJobConfig={
            'Strategy': 'Bayesian',
            'HyperParameterTuningJobObjective': {
                'Type': 'Minimize',
                'MetricName': 'validation:rmse'
            },
            'ResourceLimits': {
                'MaxNumberOfTrainingJobs': max_jobs,
                'MaxParallelTrainingJobs': max_parallel_jobs
            },
            'ParameterRanges': {
                'IntegerParameterRanges': [
                    {
                        'Name': 'max_depth',
                        'MinValue': '3',
                        'MaxValue': '10',
                        'ScalingType': 'Linear'
                    },
                    {
                        'Name': 'n_estimators',
                        'MinValue': '50',
                        'MaxValue': '300',
                        'ScalingType': 'Linear'
                    },
                    {
                        'Name': 'n_features',
                        'MinValue': '15',
                        'MaxValue': '50',
                        'ScalingType': 'Linear'
                    }
                ],
                'ContinuousParameterRanges': [
                    {
                        'Name': 'learning_rate',
                        'MinValue': '0.01',
                        'MaxValue': '0.3',
                        'ScalingType': 'Logarithmic'
                    },
                    {
                        'Name': 'subsample',
                        'MinValue': '0.5',
                        'MaxValue': '1.0',
                        'ScalingType': 'Linear'
                    },
                    {
                        'Name': 'colsample_bytree',
                        'MinValue': '0.5',
                        'MaxValue': '1.0',
                        'ScalingType': 'Linear'
                    }
                ]
            }
        },
        TrainingJobDefinition={
            'AlgorithmSpecification': {
                'TrainingImage': image_uri,
                'TrainingInputMode': 'File',
                'MetricDefinitions': [
                    {
                        'Name': 'validation:rmse',
                        'Regex': 'val-rmse:(\\S+)'
                    }
                ]
            },
            'RoleArn': role_arn,
            'InputDataConfig': [
                {
                    'ChannelName': 'train',
                    'DataSource': {
                        'S3DataSource': {
                            'S3DataType': 'S3Prefix',
                            'S3Uri': train_data_s3,
                            'S3DataDistributionType': 'FullyReplicated'
                        }
                    },
                    'ContentType': 'text/csv',
                    'CompressionType': 'None'
                }
            ],
            'OutputDataConfig': {
                'S3OutputPath': output_s3
            },
            'ResourceConfig': {
                'InstanceType': instance_type,
                'InstanceCount': 1,
                'VolumeSizeInGB': 30
            },
            'StoppingCondition': {
                'MaxRuntimeInSeconds': 3600
            },
            'StaticHyperParameters': {
                'cv_splits': '5'
            }
        }
    )
    
    logger.info(f"Tuning job criado: {response['HyperParameterTuningJobArn']}")
    
    return job_name


def get_best_hyperparameters(tuning_job_name: str) -> dict:
    """
    Obtém os melhores hiperparâmetros de um tuning job.
    
    Args:
        tuning_job_name: Nome do tuning job
        
    Returns:
        Dict com os melhores hiperparâmetros
    """
    
    response = sagemaker.describe_hyper_parameter_tuning_job(
        HyperParameterTuningJobName=tuning_job_name
    )
    
    status = response['HyperParameterTuningJobStatus']
    logger.info(f"Tuning job status: {status}")
    
    if status != 'Completed':
        logger.warning(f"Tuning job ainda não completou: {status}")
        return {}
    
    best_job = response.get('BestTrainingJob', {})
    
    if not best_job:
        logger.warning("Nenhum best training job encontrado")
        return {}
    
    best_params = best_job.get('TunedHyperParameters', {})
    best_metric = best_job.get('FinalHyperParameterTuningJobObjectiveMetric', {})
    
    logger.info(f"Best training job: {best_job['TrainingJobName']}")
    logger.info(f"Best metric: {best_metric.get('Value', 'N/A')}")
    logger.info(f"Best hyperparameters: {best_params}")
    
    return {
        'hyperparameters': best_params,
        'metric_value': best_metric.get('Value'),
        'training_job_name': best_job['TrainingJobName']
    }


def main():
    parser = argparse.ArgumentParser()
    
    parser.add_argument('--tuning-job-name', type=str, required=True)
    parser.add_argument('--train-data-s3', type=str, required=True)
    parser.add_argument('--output-s3', type=str, required=True)
    parser.add_argument('--role-arn', type=str, required=True)
    parser.add_argument('--instance-type', type=str, default='ml.m5.xlarge')
    parser.add_argument('--max-jobs', type=int, default=20)
    parser.add_argument('--max-parallel-jobs', type=int, default=2)
    parser.add_argument('--get-best', action='store_true', help='Get best hyperparameters from completed job')
    
    args = parser.parse_args()
    
    if args.get_best:
        # Obter melhores hiperparâmetros
        best = get_best_hyperparameters(args.tuning_job_name)
        print(json.dumps(best, indent=2))
    else:
        # Criar tuning job
        create_tuning_job(
            job_name=args.tuning_job_name,
            train_data_s3=args.train_data_s3,
            output_s3=args.output_s3,
            role_arn=args.role_arn,
            instance_type=args.instance_type,
            max_jobs=args.max_jobs,
            max_parallel_jobs=args.max_parallel_jobs
        )


if __name__ == '__main__':
    main()
