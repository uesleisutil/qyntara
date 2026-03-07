"""
Monitoring Lambda Function

Orchestrates daily monitoring of model performance and drift detection.
Calculates metrics, detects performance and feature drift, sends alerts via SNS,
and saves metrics to S3.

Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 13.1
"""

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import boto3
import pandas as pd
import numpy as np

from src.monitoring.metrics_calculator import MetricsCalculator
from src.monitoring.performance_drift_detector import PerformanceDriftDetector
from src.monitoring.feature_drift_detector import FeatureDriftDetector
from src.monitoring.alert_manager import AlertManager

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')
sns_client = boto3.client('sns')


class MonitoringOrchestrator:
    """
    Orchestrates monitoring workflow.
    
    Requirements:
    - 7.1: Calculate daily metrics
    - 7.2: Compare current MAPE against baseline using 30-day rolling window
    - 7.3: Trigger drift alert when MAPE increases > 20%
    - 7.4: Monitor feature distributions using KS test
    - 7.5: Trigger data drift alert when p-value < 0.05
    - 13.1: Save metrics to S3
    """
    
    def __init__(
        self,
        s3_client=None,
        sns_topic_arn: Optional[str] = None,
        retraining_topic_arn: Optional[str] = None
    ):
        """
        Initialize orchestrator.
        
        Args:
            s3_client: Optional S3 client
            sns_topic_arn: SNS topic ARN for alerts
            retraining_topic_arn: SNS topic ARN for retraining triggers
        """
        self.s3_client = s3_client or boto3.client('s3')
        
        self.metrics_calculator = MetricsCalculator()
        self.performance_drift_detector = PerformanceDriftDetector(
            window_days=30,
            drift_threshold=0.20
        )
        self.feature_drift_detector = FeatureDriftDetector(alpha=0.05)
        self.alert_manager = AlertManager(
            sns_topic_arn=sns_topic_arn,
            retraining_topic_arn=retraining_topic_arn
        )
    
    def load_predictions(
        self,
        bucket: str,
        prediction_date: str
    ) -> pd.DataFrame:
        """
        Load predictions from S3.
        
        Args:
            bucket: S3 bucket containing predictions
            prediction_date: Date of predictions (YYYY-MM-DD)
            
        Returns:
            DataFrame with predictions
        """
        logger.info(f"Loading predictions for {prediction_date}")
        
        key = f"predictions/{prediction_date}/ensemble_predictions.json"
        
        try:
            obj = self.s3_client.get_object(Bucket=bucket, Key=key)
            data = json.loads(obj['Body'].read())
            
            # Extract predictions into DataFrame
            predictions_data = []
            
            stock_symbols = data.get('stock_symbols', [])
            ensemble_pred = data['predictions']['ensemble_prediction']
            lower_bounds = data['predictions']['lower_bounds']
            upper_bounds = data['predictions']['upper_bounds']
            
            for i, symbol in enumerate(stock_symbols):
                predictions_data.append({
                    'symbol': symbol,
                    'date': prediction_date,
                    'prediction': ensemble_pred[i],
                    'lower_bound': lower_bounds[i],
                    'upper_bound': upper_bounds[i]
                })
            
            df = pd.DataFrame(predictions_data)
            logger.info(f"Loaded {len(df)} predictions")
            
            return df
            
        except Exception as e:
            logger.error(f"Error loading predictions: {e}")
            raise
    
    def load_actuals(
        self,
        bucket: str,
        actual_date: str
    ) -> pd.DataFrame:
        """
        Load actual values from S3.
        
        Args:
            bucket: S3 bucket containing actuals
            actual_date: Date of actual values (YYYY-MM-DD)
            
        Returns:
            DataFrame with actual values
        """
        logger.info(f"Loading actuals for {actual_date}")
        
        key = f"actuals/{actual_date}/actuals.csv"
        
        try:
            obj = self.s3_client.get_object(Bucket=bucket, Key=key)
            df = pd.read_csv(obj['Body'])
            
            # Ensure date column
            if 'date' not in df.columns:
                df['date'] = actual_date
            
            logger.info(f"Loaded {len(df)} actual values")
            
            return df
            
        except Exception as e:
            logger.error(f"Error loading actuals: {e}")
            raise
    
    def load_historical_metrics(
        self,
        bucket: str,
        lookback_days: int = 30
    ) -> pd.DataFrame:
        """
        Load historical metrics for baseline calculation.
        
        Args:
            bucket: S3 bucket containing metrics
            lookback_days: Number of days to look back
            
        Returns:
            DataFrame with historical metrics
        """
        logger.info(f"Loading historical metrics (lookback: {lookback_days} days)")
        
        prefix = "metrics/daily/"
        
        try:
            # List recent metric files
            response = self.s3_client.list_objects_v2(
                Bucket=bucket,
                Prefix=prefix,
                MaxKeys=lookback_days * 2  # Buffer for missing days
            )
            
            if 'Contents' not in response:
                logger.warning("No historical metrics found")
                return pd.DataFrame()
            
            # Load and combine metrics
            metrics_list = []
            
            for obj in response['Contents'][-lookback_days:]:
                try:
                    key = obj['Key']
                    obj_data = self.s3_client.get_object(Bucket=bucket, Key=key)
                    daily_metrics = json.loads(obj_data['Body'].read())
                    
                    # Extract date from key (format: metrics/daily/YYYY-MM-DD.json)
                    date_str = key.split('/')[-1].replace('.json', '')
                    daily_metrics['date'] = date_str
                    
                    metrics_list.append(daily_metrics)
                    
                except Exception as e:
                    logger.warning(f"Error loading metrics from {obj['Key']}: {e}")
                    continue
            
            if metrics_list:
                df = pd.DataFrame(metrics_list)
                df['date'] = pd.to_datetime(df['date'])
                df = df.sort_values('date')
                
                logger.info(f"Loaded {len(df)} days of historical metrics")
                return df
            else:
                logger.warning("No valid historical metrics found")
                return pd.DataFrame()
                
        except Exception as e:
            logger.error(f"Error loading historical metrics: {e}")
            return pd.DataFrame()
    
    def load_features(
        self,
        bucket: str,
        date: str,
        feature_type: str = 'current'
    ) -> pd.DataFrame:
        """
        Load features from S3.
        
        Args:
            bucket: S3 bucket containing features
            date: Date of features (YYYY-MM-DD)
            feature_type: 'current' or 'reference'
            
        Returns:
            DataFrame with features
        """
        logger.info(f"Loading {feature_type} features for {date}")
        
        key = f"features/{date}/features.csv"
        
        try:
            obj = self.s3_client.get_object(Bucket=bucket, Key=key)
            df = pd.read_csv(obj['Body'])
            
            logger.info(f"Loaded {len(df)} rows with {len(df.columns)} features")
            
            return df
            
        except Exception as e:
            logger.error(f"Error loading features: {e}")
            raise
    
    def calculate_daily_metrics(
        self,
        predictions: pd.DataFrame,
        actuals: pd.DataFrame
    ) -> Dict[str, Any]:
        """
        Calculate daily performance metrics.
        
        Args:
            predictions: DataFrame with predictions
            actuals: DataFrame with actual values
            
        Returns:
            Dictionary with metrics at multiple levels
        """
        logger.info("Calculating daily metrics")
        
        # Calculate overall metrics
        overall_metrics = self.metrics_calculator.calculate_overall_metrics(
            predictions, actuals
        )
        
        # Calculate per-stock metrics
        per_stock_metrics = self.metrics_calculator.calculate_per_stock_metrics(
            predictions, actuals
        )
        
        # Identify top performers (lowest MAPE)
        top_performers = per_stock_metrics.nsmallest(50, 'mape')['symbol'].tolist()
        
        # Identify poor performers (highest MAPE)
        poor_performers = per_stock_metrics.nlargest(10, 'mape')['symbol'].tolist()
        
        result = {
            'overall': overall_metrics,
            'per_stock': per_stock_metrics.to_dict('records'),
            'top_performers': top_performers,
            'poor_performers': poor_performers,
            'num_stocks': len(per_stock_metrics)
        }
        
        logger.info(f"Overall MAPE: {overall_metrics['mape']:.4f}%")
        logger.info(f"Overall Coverage: {overall_metrics['coverage']:.2f}%")
        
        return result
    
    def detect_performance_drift(
        self,
        current_mape: float,
        historical_metrics: pd.DataFrame,
        current_date: datetime
    ) -> Dict[str, Any]:
        """
        Detect performance drift.
        
        Args:
            current_mape: Current MAPE value
            historical_metrics: DataFrame with historical metrics
            current_date: Current date
            
        Returns:
            Dictionary with drift detection results
        """
        logger.info("Detecting performance drift")
        
        if historical_metrics.empty:
            logger.warning("No historical metrics available for drift detection")
            return {
                'drift_detected': False,
                'reason': 'insufficient_history'
            }
        
        try:
            # Create MAPE series
            mape_series = historical_metrics.set_index('date')['overall_mape']
            
            # Detect drift
            drift_result = self.performance_drift_detector.detect_drift_from_history(
                mape_series,
                current_date,
                current_mape
            )
            
            if drift_result['drift_detected']:
                logger.warning(
                    f"Performance drift detected! "
                    f"MAPE increased by {drift_result['mape_change_percentage']*100:.1f}%"
                )
            else:
                logger.info("No performance drift detected")
            
            return drift_result
            
        except Exception as e:
            logger.error(f"Error detecting performance drift: {e}")
            return {
                'drift_detected': False,
                'error': str(e)
            }
    
    def detect_feature_drift(
        self,
        reference_features: pd.DataFrame,
        current_features: pd.DataFrame
    ) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Any]]:
        """
        Detect feature distribution drift.
        
        Args:
            reference_features: Reference (baseline) features
            current_features: Current features
            
        Returns:
            Tuple of (drift_results, summary)
        """
        logger.info("Detecting feature drift")
        
        try:
            # Get feature columns (exclude metadata columns)
            exclude_cols = ['symbol', 'date']
            feature_cols = [
                col for col in current_features.columns
                if col not in exclude_cols
            ]
            
            # Detect drift
            drift_results, summary = self.feature_drift_detector.detect_drift_with_summary(
                reference_features,
                current_features,
                feature_columns=feature_cols
            )
            
            if summary['drifted_features_count'] > 0:
                logger.warning(
                    f"Feature drift detected! "
                    f"{summary['drifted_features_count']}/{summary['total_features']} features drifting"
                )
            else:
                logger.info("No feature drift detected")
            
            return drift_results, summary
            
        except Exception as e:
            logger.error(f"Error detecting feature drift: {e}")
            return {}, {
                'total_features': 0,
                'drifted_features_count': 0,
                'drifted_features': [],
                'drift_percentage': 0.0,
                'error': str(e)
            }
    
    def send_alerts(
        self,
        performance_drift_result: Dict[str, Any],
        feature_drift_summary: Dict[str, Any],
        feature_drift_results: Dict[str, Dict[str, Any]],
        current_date: datetime
    ) -> Dict[str, Any]:
        """
        Send alerts for detected drift.
        
        Args:
            performance_drift_result: Performance drift detection result
            feature_drift_summary: Feature drift summary
            feature_drift_results: Detailed feature drift results
            current_date: Current date
            
        Returns:
            Dictionary with alert status
        """
        logger.info("Sending alerts")
        
        alerts_sent = {
            'performance_drift': False,
            'feature_drift': False,
            'retraining_triggered': False
        }
        
        # Handle performance drift
        if performance_drift_result.get('drift_detected', False):
            result = self.alert_manager.handle_performance_drift(
                performance_drift_result,
                trigger_retraining=True
            )
            alerts_sent['performance_drift'] = result['alert_sent']
            alerts_sent['retraining_triggered'] = result['retraining_triggered']
        
        # Handle feature drift
        if feature_drift_summary.get('drifted_features_count', 0) > 0:
            result = self.alert_manager.handle_feature_drift(
                feature_drift_summary,
                feature_drift_results,
                current_date,
                trigger_retraining=True
            )
            alerts_sent['feature_drift'] = result['alert_sent']
            
            # Update retraining trigger status
            if result['retraining_triggered']:
                alerts_sent['retraining_triggered'] = True
        
        return alerts_sent
    
    def save_metrics(
        self,
        metrics: Dict[str, Any],
        drift_results: Dict[str, Any],
        bucket: str,
        date: str
    ) -> str:
        """
        Save metrics to S3.
        
        Args:
            metrics: Calculated metrics
            drift_results: Drift detection results
            bucket: S3 bucket for output
            date: Date of metrics (YYYY-MM-DD)
            
        Returns:
            S3 path where metrics were saved
        """
        logger.info("Saving metrics to S3")
        
        # Combine metrics and drift results
        output = {
            'date': date,
            'generated_at': datetime.now().isoformat(),
            'overall_mape': metrics['overall']['mape'],
            'overall_mae': metrics['overall']['mae'],
            'overall_rmse': metrics['overall']['rmse'],
            'overall_coverage': metrics['overall']['coverage'],
            'overall_interval_width': metrics['overall']['interval_width'],
            'num_stocks': metrics['num_stocks'],
            'top_performers': metrics['top_performers'],
            'poor_performers': metrics['poor_performers'],
            'per_stock_metrics': metrics['per_stock'],
            'drift_detection': drift_results
        }
        
        # Save to S3
        key = f"metrics/daily/{date}.json"
        
        self.s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(output, indent=2),
            ContentType='application/json'
        )
        
        s3_path = f"s3://{bucket}/{key}"
        logger.info(f"Saved metrics to {s3_path}")
        
        return s3_path


def lambda_handler(event, context):
    """
    Lambda handler for monitoring.
    
    Event structure:
    {
        "prediction_date": "2024-01-01",
        "predictions_bucket": "my-bucket",
        "actuals_bucket": "my-bucket",
        "features_bucket": "my-bucket",
        "metrics_bucket": "my-bucket",
        "reference_date": "2023-12-01",  # For feature drift baseline
        "sns_topic_arn": "arn:aws:sns:...",
        "retraining_topic_arn": "arn:aws:sns:..."
    }
    """
    try:
        logger.info("Starting monitoring")
        logger.info(f"Event: {json.dumps(event)}")
        
        # Extract parameters
        prediction_date = event['prediction_date']
        predictions_bucket = event['predictions_bucket']
        actuals_bucket = event.get('actuals_bucket', predictions_bucket)
        features_bucket = event.get('features_bucket', predictions_bucket)
        metrics_bucket = event.get('metrics_bucket', predictions_bucket)
        reference_date = event.get('reference_date')
        sns_topic_arn = event.get('sns_topic_arn')
        retraining_topic_arn = event.get('retraining_topic_arn')
        
        # Initialize orchestrator
        orchestrator = MonitoringOrchestrator(
            sns_topic_arn=sns_topic_arn,
            retraining_topic_arn=retraining_topic_arn
        )
        
        # Load predictions and actuals
        predictions = orchestrator.load_predictions(predictions_bucket, prediction_date)
        actuals = orchestrator.load_actuals(actuals_bucket, prediction_date)
        
        # Calculate daily metrics
        metrics = orchestrator.calculate_daily_metrics(predictions, actuals)
        
        # Load historical metrics for drift detection
        historical_metrics = orchestrator.load_historical_metrics(metrics_bucket)
        
        # Detect performance drift
        current_date = datetime.strptime(prediction_date, '%Y-%m-%d')
        performance_drift_result = orchestrator.detect_performance_drift(
            metrics['overall']['mape'],
            historical_metrics,
            current_date
        )
        
        # Detect feature drift (if reference date provided)
        feature_drift_results = {}
        feature_drift_summary = {}
        
        if reference_date:
            try:
                reference_features = orchestrator.load_features(
                    features_bucket, reference_date, 'reference'
                )
                current_features = orchestrator.load_features(
                    features_bucket, prediction_date, 'current'
                )
                
                feature_drift_results, feature_drift_summary = orchestrator.detect_feature_drift(
                    reference_features, current_features
                )
            except Exception as e:
                logger.warning(f"Could not detect feature drift: {e}")
        
        # Send alerts
        alerts_sent = orchestrator.send_alerts(
            performance_drift_result,
            feature_drift_summary,
            feature_drift_results,
            current_date
        )
        
        # Save metrics
        drift_results = {
            'performance_drift': performance_drift_result,
            'feature_drift_summary': feature_drift_summary,
            'alerts_sent': alerts_sent
        }
        
        output_path = orchestrator.save_metrics(
            metrics,
            drift_results,
            metrics_bucket,
            prediction_date
        )
        
        # Return success
        return {
            'statusCode': 200,
            'body': json.dumps({
                'status': 'success',
                'output_path': output_path,
                'metrics': {
                    'overall_mape': metrics['overall']['mape'],
                    'overall_coverage': metrics['overall']['coverage'],
                    'num_stocks': metrics['num_stocks']
                },
                'drift_detected': {
                    'performance_drift': performance_drift_result.get('drift_detected', False),
                    'feature_drift': feature_drift_summary.get('drifted_features_count', 0) > 0
                },
                'alerts_sent': alerts_sent
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
        logger.error(f"Error in monitoring: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({
                'status': 'error',
                'error': str(e)
            })
        }
