"""
DeepAR Model Wrapper for AWS SageMaker

This module provides a wrapper for AWS SageMaker's DeepAR forecasting model,
supporting training, prediction, and quantile-based prediction intervals.

Requirements: 4.1 - Implement ensemble of 4 models (DeepAR, LSTM, Prophet, XGBoost)
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import boto3
import numpy as np
import pandas as pd
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class DeepARModel:
    """
    Wrapper class for AWS SageMaker DeepAR model.
    
    Provides methods for:
    - Training via SageMaker
    - Making predictions
    - Generating prediction intervals with quantiles
    """
    
    def __init__(self, sagemaker_client=None, s3_client=None, region_name: str = "us-east-1"):
        """
        Initialize DeepAR model wrapper.
        
        Args:
            sagemaker_client: Boto3 SageMaker client (optional, will create if None)
            s3_client: Boto3 S3 client (optional, will create if None)
            region_name: AWS region name
        """
        self.region_name = region_name
        self.sagemaker_client = sagemaker_client or boto3.client('sagemaker', region_name=region_name)
        self.s3_client = s3_client or boto3.client('s3', region_name=region_name)
        self.runtime_client = boto3.client('sagemaker-runtime', region_name=region_name)
        
        # DeepAR algorithm image URI
        self.algorithm_image = self._get_deepar_image_uri()
        
    def _get_deepar_image_uri(self) -> str:
        """Get the DeepAR algorithm image URI for the region."""
        # DeepAR image URIs by region
        image_uris = {
            "us-east-1": "522234722520.dkr.ecr.us-east-1.amazonaws.com/forecasting-deepar:latest",
            "us-west-2": "156387875391.dkr.ecr.us-west-2.amazonaws.com/forecasting-deepar:latest",
            "eu-west-1": "224300973850.dkr.ecr.eu-west-1.amazonaws.com/forecasting-deepar:latest",
            "sa-east-1": "855470959533.dkr.ecr.sa-east-1.amazonaws.com/forecasting-deepar:latest",
        }
        return image_uris.get(self.region_name, image_uris["us-east-1"])
    
    def train(
        self,
        train_data: pd.DataFrame,
        hyperparameters: Dict,
        role_arn: str,
        s3_output_path: str,
        job_name: Optional[str] = None
    ) -> str:
        """
        Train DeepAR model using SageMaker.
        
        Args:
            train_data: Training data with columns [stock_symbol, date, target, features...]
            hyperparameters: Model hyperparameters
            role_arn: IAM role ARN for SageMaker
            s3_output_path: S3 path for model artifacts (e.g., s3://bucket/models/)
            job_name: Optional training job name (auto-generated if None)
            
        Returns:
            Training job name
            
        Raises:
            ValueError: If training data is invalid
            ClientError: If SageMaker API call fails
        """
        # Validate inputs
        if train_data.empty:
            raise ValueError("Training data cannot be empty")
        
        required_columns = ['stock_symbol', 'date', 'target']
        missing_cols = [col for col in required_columns if col not in train_data.columns]
        if missing_cols:
            raise ValueError(f"Training data missing required columns: {missing_cols}")
        
        # Generate job name if not provided
        if job_name is None:
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            job_name = f"deepar-training-{timestamp}"
        
        # Prepare data in DeepAR format
        train_s3_path = self._prepare_training_data(train_data, s3_output_path, job_name)
        
        # Set default hyperparameters
        default_hyperparameters = {
            "time_freq": "D",  # Daily frequency
            "epochs": "100",
            "early_stopping_patience": "10",
            "mini_batch_size": "128",
            "learning_rate": "0.001",
            "context_length": "30",
            "prediction_length": "5",
            "num_cells": "40",
            "num_layers": "2",
            "likelihood": "gaussian",
            "dropout_rate": "0.1",
        }
        
        # Merge with provided hyperparameters
        final_hyperparameters = {**default_hyperparameters, **hyperparameters}
        
        # Configure training job
        training_config = {
            "TrainingJobName": job_name,
            "RoleArn": role_arn,
            "AlgorithmSpecification": {
                "TrainingImage": self.algorithm_image,
                "TrainingInputMode": "File"
            },
            "InputDataConfig": [
                {
                    "ChannelName": "train",
                    "DataSource": {
                        "S3DataSource": {
                            "S3DataType": "S3Prefix",
                            "S3Uri": train_s3_path,
                            "S3DataDistributionType": "FullyReplicated"
                        }
                    },
                    "ContentType": "application/json",
                    "CompressionType": "None"
                }
            ],
            "OutputDataConfig": {
                "S3OutputPath": s3_output_path
            },
            "ResourceConfig": {
                "InstanceType": "ml.c5.2xlarge",
                "InstanceCount": 1,
                "VolumeSizeInGB": 30
            },
            "HyperParameters": final_hyperparameters,
            "StoppingCondition": {
                "MaxRuntimeInSeconds": 86400  # 24 hours
            }
        }
        
        # Start training job
        try:
            logger.info(f"Starting DeepAR training job: {job_name}")
            self.sagemaker_client.create_training_job(**training_config)
            logger.info(f"Training job started successfully: {job_name}")
            return job_name
        except ClientError as e:
            logger.error(f"Failed to start training job: {e}")
            raise
    
    def _prepare_training_data(
        self,
        train_data: pd.DataFrame,
        s3_output_path: str,
        job_name: str
    ) -> str:
        """
        Prepare training data in DeepAR JSON format and upload to S3.
        
        Args:
            train_data: Training data
            s3_output_path: Base S3 path
            job_name: Training job name
            
        Returns:
            S3 path to training data
        """
        # Parse S3 path
        s3_path_parts = s3_output_path.replace("s3://", "").split("/", 1)
        bucket = s3_path_parts[0]
        prefix = s3_path_parts[1].rstrip('/') if len(s3_path_parts) > 1 else ""
        
        # Group by stock symbol
        time_series = []
        for stock_symbol, group in train_data.groupby('stock_symbol'):
            # Sort by date
            group = group.sort_values('date')
            
            # Extract target values
            target = group['target'].tolist()
            
            # Get start date
            start_date = pd.to_datetime(group['date'].iloc[0])
            
            # Create time series entry
            ts_entry = {
                "start": start_date.strftime("%Y-%m-%d"),
                "target": target
            }
            
            # Add dynamic features if present
            feature_cols = [col for col in group.columns 
                          if col not in ['stock_symbol', 'date', 'target']]
            if feature_cols:
                ts_entry["dynamic_feat"] = [group[col].tolist() for col in feature_cols]
            
            time_series.append(ts_entry)
        
        # Write to JSON Lines format
        if prefix:
            train_file_key = f"{prefix}/training-data/{job_name}/train.json"
        else:
            train_file_key = f"training-data/{job_name}/train.json"
        
        # Create JSON Lines content
        json_lines = "\n".join([json.dumps(ts) for ts in time_series])
        
        # Upload to S3
        try:
            self.s3_client.put_object(
                Bucket=bucket,
                Key=train_file_key,
                Body=json_lines.encode('utf-8')
            )
            logger.info(f"Training data uploaded to s3://{bucket}/{train_file_key}")
        except ClientError as e:
            logger.error(f"Failed to upload training data: {e}")
            raise
        
        if prefix:
            return f"s3://{bucket}/{prefix}/training-data/{job_name}/"
        else:
            return f"s3://{bucket}/training-data/{job_name}/"
    
    def predict(
        self,
        input_data: pd.DataFrame,
        model_endpoint: str,
        num_samples: int = 100
    ) -> np.ndarray:
        """
        Generate predictions using deployed DeepAR model.
        
        Args:
            input_data: Input data with columns [stock_symbol, date, target, features...]
            model_endpoint: SageMaker endpoint name
            num_samples: Number of sample paths to generate
            
        Returns:
            Array of predictions (mean of samples) with shape (num_stocks, prediction_length)
            
        Raises:
            ValueError: If input data is invalid
            ClientError: If prediction fails
        """
        # Validate inputs
        if input_data.empty:
            raise ValueError("Input data cannot be empty")
        
        required_columns = ['stock_symbol', 'date', 'target']
        missing_cols = [col for col in required_columns if col not in input_data.columns]
        if missing_cols:
            raise ValueError(f"Input data missing required columns: {missing_cols}")
        
        # Prepare input in DeepAR format
        instances = []
        for stock_symbol, group in input_data.groupby('stock_symbol'):
            group = group.sort_values('date')
            
            instance = {
                "start": pd.to_datetime(group['date'].iloc[0]).strftime("%Y-%m-%d"),
                "target": group['target'].tolist()
            }
            
            # Add dynamic features if present
            feature_cols = [col for col in group.columns 
                          if col not in ['stock_symbol', 'date', 'target']]
            if feature_cols:
                instance["dynamic_feat"] = [group[col].tolist() for col in feature_cols]
            
            instances.append(instance)
        
        # Prepare request payload
        configuration = {
            "num_samples": num_samples,
            "output_types": ["mean", "quantiles"],
            "quantiles": ["0.1", "0.5", "0.9"]
        }
        
        payload = {
            "instances": instances,
            "configuration": configuration
        }
        
        # Invoke endpoint
        try:
            logger.info(f"Invoking endpoint: {model_endpoint}")
            response = self.runtime_client.invoke_endpoint(
                EndpointName=model_endpoint,
                ContentType='application/json',
                Body=json.dumps(payload)
            )
            
            # Parse response
            result = json.loads(response['Body'].read().decode())
            
            # Extract mean predictions
            predictions = []
            for pred in result['predictions']:
                predictions.append(pred['mean'])
            
            return np.array(predictions)
            
        except ClientError as e:
            logger.error(f"Prediction failed: {e}")
            raise
    
    def get_prediction_intervals(
        self,
        input_data: pd.DataFrame,
        model_endpoint: str,
        quantiles: Optional[List[float]] = None,
        num_samples: int = 100
    ) -> pd.DataFrame:
        """
        Generate prediction intervals using quantiles.
        
        Args:
            input_data: Input data with columns [stock_symbol, date, target, features...]
            model_endpoint: SageMaker endpoint name
            quantiles: List of quantiles (e.g., [0.1, 0.5, 0.9])
            num_samples: Number of sample paths to generate
            
        Returns:
            DataFrame with columns [stock_symbol, horizon, mean, q_0.1, q_0.5, q_0.9, ...]
            
        Raises:
            ValueError: If input data is invalid
            ClientError: If prediction fails
        """
        # Default quantiles for 95% confidence interval
        if quantiles is None:
            quantiles = [0.025, 0.1, 0.5, 0.9, 0.975]
        
        # Validate inputs
        if input_data.empty:
            raise ValueError("Input data cannot be empty")
        
        required_columns = ['stock_symbol', 'date', 'target']
        missing_cols = [col for col in required_columns if col not in input_data.columns]
        if missing_cols:
            raise ValueError(f"Input data missing required columns: {missing_cols}")
        
        # Prepare input in DeepAR format
        instances = []
        stock_symbols = []
        for stock_symbol, group in input_data.groupby('stock_symbol'):
            group = group.sort_values('date')
            stock_symbols.append(stock_symbol)
            
            instance = {
                "start": pd.to_datetime(group['date'].iloc[0]).strftime("%Y-%m-%d"),
                "target": group['target'].tolist()
            }
            
            # Add dynamic features if present
            feature_cols = [col for col in group.columns 
                          if col not in ['stock_symbol', 'date', 'target']]
            if feature_cols:
                instance["dynamic_feat"] = [group[col].tolist() for col in feature_cols]
            
            instances.append(instance)
        
        # Prepare request payload
        quantile_strings = [str(q) for q in quantiles]
        configuration = {
            "num_samples": num_samples,
            "output_types": ["mean", "quantiles"],
            "quantiles": quantile_strings
        }
        
        payload = {
            "instances": instances,
            "configuration": configuration
        }
        
        # Invoke endpoint
        try:
            logger.info(f"Invoking endpoint for prediction intervals: {model_endpoint}")
            response = self.runtime_client.invoke_endpoint(
                EndpointName=model_endpoint,
                ContentType='application/json',
                Body=json.dumps(payload)
            )
            
            # Parse response
            result = json.loads(response['Body'].read().decode())
            
            # Build results DataFrame
            results = []
            for i, pred in enumerate(result['predictions']):
                stock_symbol = stock_symbols[i]
                mean_values = pred['mean']
                quantile_values = pred['quantiles']
                
                # Create row for each forecast horizon
                for horizon_idx in range(len(mean_values)):
                    row = {
                        'stock_symbol': stock_symbol,
                        'horizon': horizon_idx + 1,
                        'mean': mean_values[horizon_idx]
                    }
                    
                    # Add quantile columns
                    for q_str in quantile_strings:
                        q_float = float(q_str)
                        row[f'q_{q_str}'] = quantile_values[q_str][horizon_idx]
                    
                    results.append(row)
            
            return pd.DataFrame(results)
            
        except ClientError as e:
            logger.error(f"Prediction interval generation failed: {e}")
            raise
    
    def wait_for_training_job(self, job_name: str, poll_interval: int = 60) -> Dict:
        """
        Wait for training job to complete.
        
        Args:
            job_name: Training job name
            poll_interval: Polling interval in seconds
            
        Returns:
            Training job description
            
        Raises:
            RuntimeError: If training job fails
        """
        import time
        
        logger.info(f"Waiting for training job to complete: {job_name}")
        
        while True:
            try:
                response = self.sagemaker_client.describe_training_job(
                    TrainingJobName=job_name
                )
                
                status = response['TrainingJobStatus']
                logger.info(f"Training job status: {status}")
                
                if status == 'Completed':
                    logger.info(f"Training job completed successfully: {job_name}")
                    return response
                elif status == 'Failed':
                    failure_reason = response.get('FailureReason', 'Unknown')
                    raise RuntimeError(f"Training job failed: {failure_reason}")
                elif status == 'Stopped':
                    raise RuntimeError("Training job was stopped")
                
                # Continue polling
                time.sleep(poll_interval)
                
            except ClientError as e:
                logger.error(f"Error checking training job status: {e}")
                raise
