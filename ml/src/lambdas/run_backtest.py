"""
Lambda: Run Backtesting

Executes backtesting to validate model predictions against actual results.
Runs daily to check predictions made N days ago.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict

import boto3

from ml.src.backtesting.backtester import Backtester

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for backtesting.
    
    Event parameters:
    - bucket: S3 bucket name (optional, uses env var)
    - prediction_horizon_days: Days ahead predictions are for (default: 20)
    - backtest_date: Specific date to backtest (optional, uses N days ago)
    - rolling_days: Number of days to backtest (optional, for rolling backtest)
    
    Returns:
        Dictionary with backtest results
    """
    try:
        # Get parameters
        bucket = event.get('bucket', os.environ.get('BUCKET_NAME'))
        prediction_horizon_days = event.get('prediction_horizon_days', 20)
        backtest_date_str = event.get('backtest_date')
        rolling_days = event.get('rolling_days')
        
        if not bucket:
            raise ValueError("Bucket name not provided")
        
        logger.info(f"Starting backtesting for bucket: {bucket}")
        logger.info(f"Prediction horizon: {prediction_horizon_days} days")
        
        # Initialize backtester
        backtester = Backtester(
            bucket=bucket,
            prediction_horizon_days=prediction_horizon_days
        )
        
        # Determine backtest date(s)
        if rolling_days:
            # Rolling backtest
            end_date = datetime.now() - timedelta(days=prediction_horizon_days)
            start_date = end_date - timedelta(days=rolling_days)
            
            logger.info(f"Running rolling backtest from {start_date} to {end_date}")
            
            results = backtester.run_rolling_backtest(
                start_date=start_date,
                end_date=end_date,
                save_to_s3=True
            )
            
            # Calculate aggregate metrics
            if results:
                aggregate_metrics = calculate_aggregate_metrics(results)
                
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': 'Rolling backtest completed',
                        'total_backtests': len(results),
                        'aggregate_metrics': aggregate_metrics,
                        'results': results
                    })
                }
            else:
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': 'No backtest results generated',
                        'total_backtests': 0
                    })
                }
        
        else:
            # Single date backtest
            if backtest_date_str:
                backtest_date = datetime.fromisoformat(backtest_date_str)
            else:
                # Default: backtest predictions made N days ago
                backtest_date = datetime.now() - timedelta(days=prediction_horizon_days)
            
            logger.info(f"Backtesting predictions from {backtest_date}")
            
            result = backtester.backtest_predictions(backtest_date)
            
            if result:
                # Save to S3
                backtester.save_backtest_result(result)
                
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': 'Backtest completed successfully',
                        'result': result
                    })
                }
            else:
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': 'No data available for backtest',
                        'backtest_date': backtest_date.isoformat()
                    })
                }
    
    except Exception as e:
        logger.error(f"Error in backtesting: {e}", exc_info=True)
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Backtest failed'
            })
        }


def calculate_aggregate_metrics(results: list) -> Dict:
    """
    Calculate aggregate metrics across multiple backtest results.
    
    Args:
        results: List of backtest result dictionaries
        
    Returns:
        Dictionary with aggregate metrics
    """
    if not results:
        return {}
    
    # Extract metrics from all results
    hit_rates = []
    actual_returns = []
    top_10_returns = []
    sharpe_ratios = []
    correlations = []
    win_rates = []
    
    for result in results:
        metrics = result.get('metrics', {})
        
        if metrics:
            hit_rates.append(metrics.get('hit_rate', 0))
            actual_returns.append(metrics.get('avg_actual_return', 0))
            top_10_returns.append(metrics.get('top_10_return', 0))
            sharpe_ratios.append(metrics.get('sharpe_ratio', 0))
            correlations.append(metrics.get('correlation', 0))
            win_rates.append(metrics.get('win_rate', 0))
    
    import numpy as np
    
    return {
        'avg_hit_rate': float(np.mean(hit_rates)) if hit_rates else 0,
        'avg_actual_return': float(np.mean(actual_returns)) if actual_returns else 0,
        'avg_top_10_return': float(np.mean(top_10_returns)) if top_10_returns else 0,
        'avg_sharpe_ratio': float(np.mean(sharpe_ratios)) if sharpe_ratios else 0,
        'avg_correlation': float(np.mean(correlations)) if correlations else 0,
        'avg_win_rate': float(np.mean(win_rates)) if win_rates else 0,
        'total_backtests': len(results),
        'cumulative_return': float(np.sum(actual_returns)) if actual_returns else 0
    }
