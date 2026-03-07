"""
Lambda: Calculate Stop Loss / Take Profit

Calculates optimal stop loss and take profit levels for recommended stocks.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict

import boto3
import pandas as pd

from src.risk_management.stop_loss_calculator import StopLossCalculator

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for stop loss calculation.
    
    Event parameters:
    - bucket: S3 bucket name (optional, uses env var)
    - ticker: Specific ticker to calculate (optional, calculates for all top 50)
    - account_balance: Account balance for position sizing (default: 10000)
    - risk_per_trade_pct: Risk per trade percentage (default: 0.02 = 2%)
    
    Returns:
        Dictionary with stop loss recommendations
    """
    try:
        # Get parameters
        bucket = event.get('bucket', os.environ.get('BUCKET_NAME'))
        ticker = event.get('ticker')
        account_balance = event.get('account_balance', 10000)
        risk_per_trade_pct = event.get('risk_per_trade_pct', 0.02)
        
        if not bucket:
            raise ValueError("Bucket name not provided")
        
        logger.info(f"Calculating stop loss for bucket: {bucket}")
        
        # Initialize calculator
        calculator = StopLossCalculator()
        
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
        
        # Filter by ticker if specified
        if ticker:
            recommendations = recommendations[recommendations['ticker'] == ticker]
            
            if len(recommendations) == 0:
                return {
                    'statusCode': 404,
                    'body': json.dumps({
                        'error': f'Ticker {ticker} not found in recommendations'
                    })
                }
        
        # Calculate stop loss for each ticker
        results = []
        
        for _, row in recommendations.iterrows():
            ticker_symbol = row['ticker']
            current_price = row.get('current_price', row.get('price', 0))
            
            if current_price == 0:
                logger.warning(f"No price data for {ticker_symbol}")
                continue
            
            # Load historical price data
            try:
                price_key = f"processed/quotes/{ticker_symbol}.parquet"
                response = s3.get_object(Bucket=bucket, Key=price_key)
                price_data = pd.read_parquet(response['Body'])
                
                # Get last 60 days for ATR calculation
                price_data = price_data.tail(60)
                
                # Generate recommendations
                stop_loss_rec = calculator.generate_recommendations(
                    ticker=ticker_symbol,
                    current_price=current_price,
                    price_data=price_data,
                    account_balance=account_balance,
                    risk_per_trade_pct=risk_per_trade_pct
                )
                
                results.append(stop_loss_rec)
                
            except Exception as e:
                logger.error(f"Error calculating stop loss for {ticker_symbol}: {e}")
                continue
        
        if not results:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'No stop loss calculations generated',
                    'total_tickers': len(recommendations)
                })
            }
        
        # Save to S3
        output_key = f"risk_management/dt={date_str}/stop_loss_recommendations.json"
        
        s3.put_object(
            Bucket=bucket,
            Key=output_key,
            Body=json.dumps({
                'date': date_str,
                'account_balance': account_balance,
                'risk_per_trade_pct': risk_per_trade_pct,
                'recommendations': results
            }),
            ContentType='application/json'
        )
        
        logger.info(f"Saved stop loss recommendations to s3://{bucket}/{output_key}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Stop loss calculations completed',
                'total_recommendations': len(results),
                's3_key': output_key,
                'recommendations': results
            })
        }
    
    except Exception as e:
        logger.error(f"Error in stop loss calculation: {e}", exc_info=True)
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Stop loss calculation failed'
            })
        }
