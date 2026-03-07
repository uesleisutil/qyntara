"""
Ensemble Prediction Lambda Function.

This Lambda orchestrates ensemble predictions by:
- Loading all trained models from S3
- Generating predictions from each model
- Calculating ensemble weights based on recent performance
- Combining predictions using weighted average
- Generating prediction intervals
- Saving predictions to S3
"""

import json
import logging
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
import boto3
import pandas as pd
import numpy as np

from ml.src.models.ensemble_manager import (
    EnsembleManager,
    DynamicWeightCalculator,
    PredictionIntervalGenerator
)
from ml.src.models.deepar_model import DeepARModel
from ml.src.models.lstm_model import LSTMModel, LSTMPredictor
from ml.src.models.prophet_model import ProphetModel
from ml.src.models.xgboost_model import XGBoostModel

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')


class EnsemblePredictionOrchestrator:
    """
    Orchestrates ensemble prediction workflow.
    
    Requirements:
    - 4.1: Load all models and calculate ensemble prediction
    - 4.2: Generate prediction intervals
    - 4.5: Save predictions to S3
    """
    
    def __init__(
        self,
        s3_client=None,
        sagemaker_client=None
    ):
        """
        Initialize orchestrator.
        
        Args:
            s3_client: Optional S3 client
            sagemaker_client: Optional SageMaker client
        """
        self.s3_client = s3_client or boto3.client('s3')
        self.sagemaker_client = sagemaker_client or boto3.client('sagemaker')
        
        self.ensemble_manager = EnsembleManager()
        self.interval_generator = PredictionIntervalGenerator()
        
    def load_models(
        self,
        model_bucket: str,
        model_versions: Dict[str, str]
    ) -> None:
        """
        Load all models from S3.
        
        Args:
            model_bucket: S3 bucket containing models
            model_versions: Dict mapping model types to versions
        """
        logger.info(f"Loading models from bucket: {model_bucket}")
        
        for model_type, version in model_versions.items():
            try:
                if model_type == 'deepar':
                    model = self._load_deepar_model(model_bucket, version)
                elif model_type == 'lstm':
                    model = self._load_lstm_model(model_bucket, version)
                elif model_type == 'prophet':
                    model = self._load_prophet_model(model_bucket, version)
                elif model_type == 'xgboost':
                    model = self._load_xgboost_model(model_bucket, version)
                else:
                    logger.warning(f"Unknown model type: {model_type}")
                    continue
                    
                self.ensemble_manager.add_model(model_type, model)
                logger.info(f"Loaded {model_type} model version {version}")
                
            except Exception as e:
                logger.error(f"Error loading {model_type} model: {e}")
                raise
    
    def _load_deepar_model(
        self,
        bucket: str,
        version: str
    ) -> DeepARModel:
        """Load DeepAR model from S3."""
        # DeepAR uses SageMaker endpoint
        model = DeepARModel(
            sagemaker_client=self.sagemaker_client,
            s3_client=self.s3_client
        )
        
        # Load endpoint name from S3
        key = f"models/deepar/{version}/endpoint.json"
        obj = self.s3_client.get_object(Bucket=bucket, Key=key)
        endpoint_info = json.loads(obj['Body'].read())
        model.endpoint_name = endpoint_info['endpoint_name']
        
        return model
    
    def _load_lstm_model(
        self,
        bucket: str,
        version: str
    ) -> LSTMPredictor:
        """Load LSTM model from S3."""
        # Download model file
        key = f"models/lstm/{version}/model.pth"
        local_path = f"/tmp/lstm_{version}.pth"
        
        self.s3_client.download_file(bucket, key, local_path)
        
        # Load model
        lstm_model = LSTMModel.load_model(local_path)
        predictor = LSTMPredictor(lstm_model)
        
        return predictor
    
    def _load_prophet_model(
        self,
        bucket: str,
        version: str
    ) -> ProphetModel:
        """Load Prophet model from S3."""
        # Download model file
        key = f"models/prophet/{version}/model.pkl"
        local_path = f"/tmp/prophet_{version}.pkl"
        
        self.s3_client.download_file(bucket, key, local_path)
        
        # Load model
        model = ProphetModel()
        model.load_model(local_path)
        
        return model
    
    def _load_xgboost_model(
        self,
        bucket: str,
        version: str
    ) -> XGBoostModel:
        """Load XGBoost model from S3."""
        # Download model file
        key = f"models/xgboost/{version}/model.pkl"
        local_path = f"/tmp/xgboost_{version}.pkl"
        
        self.s3_client.download_file(bucket, key, local_path)
        
        # Load model
        model = XGBoostModel()
        model.load_model(local_path)
        
        return model
    
    def load_performance_metrics(
        self,
        metrics_bucket: str,
        lookback_months: int = 3
    ) -> Dict[str, List[float]]:
        """
        Load recent performance metrics for weight calculation.
        
        Args:
            metrics_bucket: S3 bucket containing metrics
            lookback_months: Number of months to look back
            
        Returns:
            Dict mapping model names to MAPE lists
        """
        logger.info(f"Loading performance metrics (lookback: {lookback_months} months)")
        
        # List recent metric files
        prefix = "metrics/daily/"
        response = self.s3_client.list_objects_v2(
            Bucket=metrics_bucket,
            Prefix=prefix,
            MaxKeys=lookback_months * 30  # Approximate days
        )
        
        if 'Contents' not in response:
            logger.warning("No metrics found, using equal weights")
            return {}
        
        # Aggregate metrics
        metrics = {'deepar': [], 'lstm': [], 'prophet': [], 'xgboost': []}
        
        for obj in response['Contents'][-lookback_months * 30:]:
            try:
                key = obj['Key']
                obj_data = self.s3_client.get_object(Bucket=metrics_bucket, Key=key)
                daily_metrics = json.loads(obj_data['Body'].read())
                
                for model_name in metrics.keys():
                    if model_name in daily_metrics:
                        mape = daily_metrics[model_name].get('mape')
                        if mape is not None:
                            metrics[model_name].append(mape)
                            
            except Exception as e:
                logger.warning(f"Error loading metrics from {obj['Key']}: {e}")
                continue
        
        # Filter out models with no metrics
        metrics = {k: v for k, v in metrics.items() if v}
        
        logger.info(f"Loaded metrics for {len(metrics)} models")
        return metrics
    
    def generate_predictions(
        self,
        input_data: pd.DataFrame,
        performance_metrics: Optional[Dict[str, List[float]]] = None
    ) -> Dict[str, Any]:
        """
        Generate ensemble predictions.
        
        Args:
            input_data: Input features for prediction
            performance_metrics: Optional performance metrics for weighting
            
        Returns:
            Dict containing predictions, intervals, and weights
        """
        logger.info(f"Generating predictions for {len(input_data)} samples")
        
        # Generate predictions from all models
        predictions = self.ensemble_manager.predict_all(input_data)
        
        # Update weights if metrics provided
        if performance_metrics:
            weights = self.ensemble_manager.update_weights(performance_metrics)
        else:
            # Use equal weights
            weights = {
                name: 1.0 / len(predictions)
                for name in predictions.keys()
            }
            self.ensemble_manager.current_weights = weights
        
        # Calculate ensemble prediction
        ensemble_pred = self.ensemble_manager.weighted_average(predictions, weights)
        
        # Generate prediction intervals
        lower_bounds, upper_bounds = self.interval_generator.generate_intervals(
            predictions, weights
        )
        
        result = {
            'ensemble_prediction': ensemble_pred.tolist(),
            'lower_bounds': lower_bounds.tolist(),
            'upper_bounds': upper_bounds.tolist(),
            'weights': weights,
            'individual_predictions': {
                name: pred.tolist()
                for name, pred in predictions.items()
            }
        }
        
        logger.info(f"Generated {len(ensemble_pred)} ensemble predictions")
        logger.info(f"Weights: {weights}")
        
        return result
    
    def save_predictions(
        self,
        predictions: Dict[str, Any],
        output_bucket: str,
        stock_symbols: List[str],
        prediction_date: str
    ) -> str:
        """
        Save predictions to S3.
        
        Args:
            predictions: Prediction results
            output_bucket: S3 bucket for output
            stock_symbols: List of stock symbols
            prediction_date: Date of predictions
            
        Returns:
            S3 path where predictions were saved
        """
        # Create output structure
        output = {
            'prediction_date': prediction_date,
            'generated_at': datetime.now().isoformat(),
            'stock_symbols': stock_symbols,
            'predictions': predictions
        }
        
        # Save to S3
        key = f"predictions/{prediction_date}/ensemble_predictions.json"
        
        self.s3_client.put_object(
            Bucket=output_bucket,
            Key=key,
            Body=json.dumps(output, indent=2),
            ContentType='application/json'
        )
        
        s3_path = f"s3://{output_bucket}/{key}"
        logger.info(f"Saved predictions to {s3_path}")
        
        return s3_path


def load_input_data(
    s3_client,
    features_bucket: str,
    features_key: str
) -> pd.DataFrame:
    """
    Load input features from S3.
    
    Args:
        s3_client: S3 client
        features_bucket: S3 bucket containing features
        features_key: S3 key for features file
        
    Returns:
        DataFrame with input features
    """
    logger.info(f"Loading features from s3://{features_bucket}/{features_key}")
    
    # Download features file
    local_path = "/tmp/features.parquet"
    s3_client.download_file(features_bucket, features_key, local_path)
    
    # Load into DataFrame
    df = pd.read_parquet(local_path)
    
    logger.info(f"Loaded {len(df)} rows with {len(df.columns)} features")
    
    return df


def lambda_handler(event, context):
    """
    Lambda handler for ensemble prediction.
    
    Event structure:
    {
        "features_bucket": "my-bucket",
        "features_key": "features/2024-01-01/features.parquet",
        "model_bucket": "my-bucket",
        "model_versions": {
            "deepar": "v1.0",
            "lstm": "v1.0",
            "prophet": "v1.0",
            "xgboost": "v1.0"
        },
        "metrics_bucket": "my-bucket",
        "output_bucket": "my-bucket",
        "stock_symbols": ["PETR4", "VALE3", ...],
        "prediction_date": "2024-01-01"
    }
    """
    try:
        logger.info("Starting ensemble prediction")
        logger.info(f"Event: {json.dumps(event)}")
        
        # Extract parameters
        features_bucket = event['features_bucket']
        features_key = event['features_key']
        model_bucket = event['model_bucket']
        model_versions = event['model_versions']
        metrics_bucket = event.get('metrics_bucket', model_bucket)
        output_bucket = event['output_bucket']
        stock_symbols = event['stock_symbols']
        prediction_date = event['prediction_date']
        
        # Initialize orchestrator
        orchestrator = EnsemblePredictionOrchestrator()
        
        # Load models
        orchestrator.load_models(model_bucket, model_versions)
        
        # Load input data
        input_data = load_input_data(s3_client, features_bucket, features_key)
        
        # Load performance metrics
        performance_metrics = orchestrator.load_performance_metrics(metrics_bucket)
        
        # Generate predictions
        predictions = orchestrator.generate_predictions(
            input_data,
            performance_metrics
        )
        
        # Save predictions
        output_path = orchestrator.save_predictions(
            predictions,
            output_bucket,
            stock_symbols,
            prediction_date
        )
        
        # Return success
        return {
            'statusCode': 200,
            'body': json.dumps({
                'status': 'success',
                'output_path': output_path,
                'num_predictions': len(predictions['ensemble_prediction']),
                'weights': predictions['weights']
            })
        }
        
    except KeyError as e:
        logger.error(f"Missing required parameter: {e}")
        return {
            'statusCode': 400,
            'body': json.dumps({
                'status': 'error',
                'error': f'Missing required parameter: {e}'
            })
        }
        
    except Exception as e:
        logger.error(f"Error in ensemble prediction: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'status': 'error',
                'error': str(e)
            })
        }
