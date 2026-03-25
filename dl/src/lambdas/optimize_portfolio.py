"""
Lambda: Optimize Portfolio

Calculates optimal portfolio allocation using Modern Portfolio Theory.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict

import boto3
import pandas as pd

from dl.src.portfolio.portfolio_optimizer import PortfolioOptimizer

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for portfolio optimization.
    
    Event parameters:
    - bucket: S3 bucket name (optional, uses env var)
    - capital: Total capital to invest (default: 10000)
    - strategy: Optimization strategy ('max_sharpe', 'min_variance', 'risk_parity')
    - risk_free_rate: Risk-free rate (default: 0.1075 = Selic)
    - max_weight: Maximum weight per stock (default: 0.20 = 20%)
    
    Returns:
        Dictionary with portfolio allocation
    """
    try:
        # Get parameters
        bucket = event.get('bucket', os.environ.get('BUCKET_NAME'))
        capital = event.get('capital', 10000)
        strategy = event.get('strategy', 'max_sharpe')
        risk_free_rate = event.get('risk_free_rate', 0.1075)
        max_weight = event.get('max_weight', 0.20)
        
        if not bucket:
            raise ValueError("Bucket name not provided")
        
        logger.info(f"Optimizing portfolio for bucket: {bucket}")
        logger.info(f"Strategy: {strategy}, Capital: R$ {capital}")
        
        # Initialize optimizer
        optimizer = PortfolioOptimizer(
            risk_free_rate=risk_free_rate,
            max_weight=max_weight
        )
        
        # Load latest recommendations
        date_str = datetime.now().strftime('%Y-%m-%d')
        recommendations_key = f"recommendations/dt={date_str}/top50.json"
        
        try:
            response = s3.get_object(Bucket=bucket, Key=recommendations_key)
            recommendations_data = pd.read_json(response['Body'])
            
            if 'recommendations' in recommendations_data.columns:
                recommendations = pd.DataFrame(recommendations_data['recommendations'].iloc[0])
            else:
                recommendations = recommendations_data
        except Exception as e:
            logger.error(f"Could not load recommendations: {e}")
            return {
                'statusCode': 404,
                'body': json.dumps({
                    'error': 'Recommendations not found',
                    'message': str(e)
                })
            }
        
        # Ensure required columns exist
        if 'predicted_return' not in recommendations.columns:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'Recommendations missing predicted_return column'
                })
            }
        
        # Calculate allocation
        allocation = optimizer.calculate_allocation(
            recommendations=recommendations,
            capital=capital,
            strategy=strategy
        )
        
        # Save to S3
        output_key = f"portfolio/dt={date_str}/allocation_{strategy}.json"
        
        s3.put_object(
            Bucket=bucket,
            Key=output_key,
            Body=json.dumps({
                'date': date_str,
                'capital': capital,
                'strategy': strategy,
                'risk_free_rate': risk_free_rate,
                'max_weight': max_weight,
                'allocation': allocation
            }),
            ContentType='application/json'
        )
        
        logger.info(f"Saved portfolio allocation to s3://{bucket}/{output_key}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Portfolio optimization completed',
                'strategy': strategy,
                'total_capital': capital,
                'n_stocks': len(allocation['allocations']),
                's3_key': output_key,
                'allocation': allocation
            })
        }
    
    except Exception as e:
        logger.error(f"Error in portfolio optimization: {e}", exc_info=True)
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Portfolio optimization failed'
            })
        }
