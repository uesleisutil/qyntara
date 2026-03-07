"""
Dashboard API Lambda

Provides REST API endpoints for the dashboard frontend.
Aggregates data from S3 for visualization and analysis.

Requirements: 13.1, 13.3, 13.4, 13.5
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')


class DashboardAPI:
    """
    Dashboard API for serving metrics and model data.
    
    Provides endpoints for:
    - Performance metrics
    - Model comparison
    - Feature importance
    - Drift status
    - Ensemble weights
    - Prediction details
    - Hyperparameter history
    """
    
    def __init__(self, s3_client=None, default_bucket: Optional[str] = None):
        """
        Initialize Dashboard API.
        
        Args:
            s3_client: Optional S3 client
            default_bucket: Default S3 bucket for data
        """
        self.s3_client = s3_client or boto3.client('s3')
        self.default_bucket = default_bucket
    
    def get_performance_metrics(
        self,
        bucket: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        stock_symbol: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get performance metrics for specified date range.
        
        Args:
            bucket: S3 bucket containing metrics
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            stock_symbol: Optional stock symbol filter
            
        Returns:
            Dictionary with performance metrics
        """
        logger.info(f"Getting performance metrics: {start_date} to {end_date}")
        
        # Default to last 30 days if not specified
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        
        # List metric files in date range
        prefix = "metrics/daily/"
        response = self.s3_client.list_objects_v2(
            Bucket=bucket,
            Prefix=prefix
        )
        
        if 'Contents' not in response:
            return {'metrics': [], 'summary': {}}
        
        # Load metrics within date range
        metrics_list = []
        
        for obj in response['Contents']:
            key = obj['Key']
            # Extract date from key
            date_str = key.split('/')[-1].replace('.json', '')
            
            if start_date <= date_str <= end_date:
                try:
                    obj_data = self.s3_client.get_object(Bucket=bucket, Key=key)
                    metrics = json.loads(obj_data['Body'].read())
                    metrics['date'] = date_str
                    
                    # Filter by stock if specified
                    if stock_symbol:
                        # Filter per-stock metrics
                        metrics['per_stock_metrics'] = [
                            m for m in metrics.get('per_stock_metrics', [])
                            if m.get('symbol') == stock_symbol
                        ]
                    
                    metrics_list.append(metrics)
                except Exception as e:
                    logger.warning(f"Error loading metrics from {key}: {e}")
                    continue
        
        # Calculate summary statistics
        if metrics_list:
            summary = {
                'avg_mape': sum(m['overall_mape'] for m in metrics_list) / len(metrics_list),
                'avg_coverage': sum(m['overall_coverage'] for m in metrics_list) / len(metrics_list),
                'min_mape': min(m['overall_mape'] for m in metrics_list),
                'max_mape': max(m['overall_mape'] for m in metrics_list),
                'num_days': len(metrics_list)
            }
        else:
            summary = {}
        
        return {
            'metrics': metrics_list,
            'summary': summary,
            'date_range': {'start': start_date, 'end': end_date}
        }
    
    def get_model_comparison(
        self,
        bucket: str,
        date: str,
        stock_symbol: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get model comparison data for a specific date.
        
        Args:
            bucket: S3 bucket containing predictions
            date: Date (YYYY-MM-DD)
            stock_symbol: Optional stock symbol filter
            
        Returns:
            Dictionary with model comparison data
        """
        logger.info(f"Getting model comparison for {date}")
        
        # Load predictions for the date
        key = f"predictions/{date}/ensemble_predictions.json"
        
        try:
            obj = self.s3_client.get_object(Bucket=bucket, Key=key)
            predictions = json.loads(obj['Body'].read())
            
            # Extract individual model predictions
            individual_preds = predictions['predictions'].get('individual_predictions', {})
            weights = predictions['predictions'].get('weights', {})
            
            # Filter by stock if specified
            if stock_symbol:
                stock_idx = predictions['stock_symbols'].index(stock_symbol)
                
                comparison = {
                    'stock_symbol': stock_symbol,
                    'date': date,
                    'ensemble_prediction': predictions['predictions']['ensemble_prediction'][stock_idx],
                    'models': {}
                }
                
                for model_name, preds in individual_preds.items():
                    comparison['models'][model_name] = {
                        'prediction': preds[stock_idx],
                        'weight': weights.get(model_name, 0.0)
                    }
            else:
                # Return aggregated comparison
                comparison = {
                    'date': date,
                    'num_stocks': len(predictions['stock_symbols']),
                    'models': {}
                }
                
                for model_name, preds in individual_preds.items():
                    comparison['models'][model_name] = {
                        'avg_prediction': sum(preds) / len(preds),
                        'weight': weights.get(model_name, 0.0)
                    }
            
            return comparison
            
        except Exception as e:
            logger.error(f"Error loading model comparison: {e}")
            return {'error': str(e)}
    
    def get_feature_importance(
        self,
        bucket: str,
        stock_symbol: Optional[str] = None,
        top_n: int = 20
    ) -> Dict[str, Any]:
        """
        Get feature importance data.
        
        Args:
            bucket: S3 bucket containing explainability data
            stock_symbol: Optional stock symbol filter
            top_n: Number of top features to return
            
        Returns:
            Dictionary with feature importance
        """
        logger.info(f"Getting feature importance (top {top_n})")
        
        # Load latest SHAP values
        prefix = "explainability/shap/"
        
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=bucket,
                Prefix=prefix,
                MaxKeys=1
            )
            
            if 'Contents' not in response:
                return {'feature_importance': [], 'message': 'No explainability data available'}
            
            # Load most recent file
            latest_key = response['Contents'][0]['Key']
            obj = self.s3_client.get_object(Bucket=bucket, Key=latest_key)
            shap_data = json.loads(obj['Body'].read())
            
            # Extract feature importance
            if stock_symbol and stock_symbol in shap_data:
                importance = shap_data[stock_symbol]['feature_importance'][:top_n]
            else:
                # Aggregate across all stocks
                importance = shap_data.get('aggregated', {}).get('feature_importance', [])[:top_n]
            
            return {
                'feature_importance': importance,
                'stock_symbol': stock_symbol,
                'top_n': top_n
            }
            
        except Exception as e:
            logger.error(f"Error loading feature importance: {e}")
            return {'error': str(e)}
    
    def get_drift_status(
        self,
        bucket: str,
        lookback_days: int = 30
    ) -> Dict[str, Any]:
        """
        Get drift detection status.
        
        Args:
            bucket: S3 bucket containing metrics
            lookback_days: Number of days to look back
            
        Returns:
            Dictionary with drift status
        """
        logger.info(f"Getting drift status (lookback: {lookback_days} days)")
        
        # Load recent metrics with drift information
        end_date = datetime.now()
        start_date = end_date - timedelta(days=lookback_days)
        
        prefix = "metrics/daily/"
        response = self.s3_client.list_objects_v2(
            Bucket=bucket,
            Prefix=prefix
        )
        
        if 'Contents' not in response:
            return {'drift_events': [], 'current_status': 'unknown'}
        
        drift_events = []
        current_drift = {'performance': False, 'feature': False}
        
        for obj in response['Contents'][-lookback_days:]:
            try:
                key = obj['Key']
                date_str = key.split('/')[-1].replace('.json', '')
                
                obj_data = self.s3_client.get_object(Bucket=bucket, Key=key)
                metrics = json.loads(obj_data['Body'].read())
                
                drift_info = metrics.get('drift_detection', {})
                
                # Check for drift events
                if drift_info.get('performance_drift', {}).get('drift_detected'):
                    drift_events.append({
                        'date': date_str,
                        'type': 'performance',
                        'details': drift_info['performance_drift']
                    })
                    current_drift['performance'] = True
                
                if drift_info.get('feature_drift_summary', {}).get('drifted_features_count', 0) > 0:
                    drift_events.append({
                        'date': date_str,
                        'type': 'feature',
                        'details': drift_info['feature_drift_summary']
                    })
                    current_drift['feature'] = True
                    
            except Exception as e:
                logger.warning(f"Error processing drift data from {obj['Key']}: {e}")
                continue
        
        return {
            'drift_events': drift_events,
            'current_status': current_drift,
            'lookback_days': lookback_days,
            'num_events': len(drift_events)
        }
    
    def get_ensemble_weights(
        self,
        bucket: str,
        stock_symbol: Optional[str] = None,
        lookback_days: int = 90
    ) -> Dict[str, Any]:
        """
        Get ensemble weight history.
        
        Args:
            bucket: S3 bucket containing predictions
            stock_symbol: Optional stock symbol filter
            lookback_days: Number of days of history
            
        Returns:
            Dictionary with weight history
        """
        logger.info(f"Getting ensemble weights (lookback: {lookback_days} days)")
        
        # Load recent predictions
        prefix = "predictions/"
        response = self.s3_client.list_objects_v2(
            Bucket=bucket,
            Prefix=prefix
        )
        
        if 'Contents' not in response:
            return {'weight_history': [], 'current_weights': {}}
        
        weight_history = []
        
        for obj in response['Contents'][-lookback_days:]:
            try:
                key = obj['Key']
                if not key.endswith('ensemble_predictions.json'):
                    continue
                
                date_str = key.split('/')[1]
                
                obj_data = self.s3_client.get_object(Bucket=bucket, Key=key)
                predictions = json.loads(obj_data['Body'].read())
                
                weights = predictions['predictions'].get('weights', {})
                
                weight_history.append({
                    'date': date_str,
                    'weights': weights
                })
                
            except Exception as e:
                logger.warning(f"Error loading weights from {obj['Key']}: {e}")
                continue
        
        # Get current weights (most recent)
        current_weights = weight_history[-1]['weights'] if weight_history else {}
        
        return {
            'weight_history': weight_history,
            'current_weights': current_weights,
            'lookback_days': lookback_days
        }
    
    def get_prediction_details(
        self,
        bucket: str,
        stock_symbol: str,
        date: str
    ) -> Dict[str, Any]:
        """
        Get detailed prediction information for a stock.
        
        Args:
            bucket: S3 bucket containing predictions
            stock_symbol: Stock symbol
            date: Date (YYYY-MM-DD)
            
        Returns:
            Dictionary with prediction details
        """
        logger.info(f"Getting prediction details for {stock_symbol} on {date}")
        
        # Load predictions
        key = f"predictions/{date}/ensemble_predictions.json"
        
        try:
            obj = self.s3_client.get_object(Bucket=bucket, Key=key)
            predictions = json.loads(obj['Body'].read())
            
            # Find stock index
            stock_idx = predictions['stock_symbols'].index(stock_symbol)
            
            # Extract details
            details = {
                'stock_symbol': stock_symbol,
                'date': date,
                'ensemble_prediction': predictions['predictions']['ensemble_prediction'][stock_idx],
                'lower_bound': predictions['predictions']['lower_bounds'][stock_idx],
                'upper_bound': predictions['predictions']['upper_bounds'][stock_idx],
                'weights': predictions['predictions']['weights'],
                'individual_predictions': {}
            }
            
            # Add individual model predictions
            for model_name, preds in predictions['predictions']['individual_predictions'].items():
                details['individual_predictions'][model_name] = preds[stock_idx]
            
            return details
            
        except Exception as e:
            logger.error(f"Error loading prediction details: {e}")
            return {'error': str(e)}
    
    def get_hyperparameter_history(
        self,
        bucket: str,
        model_type: str
    ) -> Dict[str, Any]:
        """
        Get hyperparameter optimization history.
        
        Args:
            bucket: S3 bucket containing hyperparameter data
            model_type: Type of model (deepar, lstm, prophet, xgboost)
            
        Returns:
            Dictionary with hyperparameter history
        """
        logger.info(f"Getting hyperparameter history for {model_type}")
        
        # Load hyperparameter optimization results
        prefix = f"hyperparameters/{model_type}/"
        
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=bucket,
                Prefix=prefix
            )
            
            if 'Contents' not in response:
                return {'history': [], 'message': 'No hyperparameter data available'}
            
            history = []
            
            for obj in response['Contents']:
                try:
                    key = obj['Key']
                    obj_data = self.s3_client.get_object(Bucket=bucket, Key=key)
                    hp_data = json.loads(obj_data['Body'].read())
                    
                    history.append(hp_data)
                    
                except Exception as e:
                    logger.warning(f"Error loading hyperparameters from {obj['Key']}: {e}")
                    continue
            
            # Sort by date
            history.sort(key=lambda x: x.get('optimization_date', ''), reverse=True)
            
            return {
                'model_type': model_type,
                'history': history,
                'current_params': history[0] if history else {}
            }
            
        except Exception as e:
            logger.error(f"Error loading hyperparameter history: {e}")
            return {'error': str(e)}


def lambda_handler(event, context):
    """
    Lambda handler for dashboard API.
    
    Routes requests to appropriate API methods based on path and method.
    """
    try:
        logger.info(f"Dashboard API request: {json.dumps(event)}")
        
        # Extract request details
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '')
        query_params = event.get('queryStringParameters') or {}
        
        # Get bucket from environment or query params
        bucket = query_params.get('bucket') or 'default-bucket'
        
        # Initialize API
        api = DashboardAPI(default_bucket=bucket)
        
        # Route to appropriate endpoint
        if path == '/api/metrics':
            result = api.get_performance_metrics(
                bucket=bucket,
                start_date=query_params.get('start_date'),
                end_date=query_params.get('end_date'),
                stock_symbol=query_params.get('stock_symbol')
            )
        
        elif path == '/api/model-comparison':
            result = api.get_model_comparison(
                bucket=bucket,
                date=query_params.get('date', datetime.now().strftime('%Y-%m-%d')),
                stock_symbol=query_params.get('stock_symbol')
            )
        
        elif path == '/api/feature-importance':
            result = api.get_feature_importance(
                bucket=bucket,
                stock_symbol=query_params.get('stock_symbol'),
                top_n=int(query_params.get('top_n', 20))
            )
        
        elif path == '/api/drift-status':
            result = api.get_drift_status(
                bucket=bucket,
                lookback_days=int(query_params.get('lookback_days', 30))
            )
        
        elif path == '/api/ensemble-weights':
            result = api.get_ensemble_weights(
                bucket=bucket,
                stock_symbol=query_params.get('stock_symbol'),
                lookback_days=int(query_params.get('lookback_days', 90))
            )
        
        elif path == '/api/prediction-details':
            result = api.get_prediction_details(
                bucket=bucket,
                stock_symbol=query_params.get('stock_symbol'),
                date=query_params.get('date', datetime.now().strftime('%Y-%m-%d'))
            )
        
        elif path == '/api/hyperparameter-history':
            result = api.get_hyperparameter_history(
                bucket=bucket,
                model_type=query_params.get('model_type', 'lstm')
            )
        
        else:
            result = {
                'error': 'Unknown endpoint',
                'available_endpoints': [
                    '/api/metrics',
                    '/api/model-comparison',
                    '/api/feature-importance',
                    '/api/drift-status',
                    '/api/ensemble-weights',
                    '/api/prediction-details',
                    '/api/hyperparameter-history'
                ]
            }
        
        # Return response with CORS headers
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': json.dumps(result)
        }
        
    except Exception as e:
        logger.error(f"Error in dashboard API: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': str(e)
            })
        }
