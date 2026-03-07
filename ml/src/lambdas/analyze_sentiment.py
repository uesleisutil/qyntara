"""
Lambda: Analyze Sentiment

Analyzes sentiment from news and social media for all stocks in universe.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict

import boto3

from src.sentiment.sentiment_analyzer import SentimentAnalyzer

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
secrets = boto3.client('secretsmanager')


# Company name mapping (ticker -> company name)
COMPANY_NAMES = {
    'MGLU3': 'Magazine Luiza',
    'PETR4': 'Petrobras',
    'VALE3': 'Vale',
    'ITUB4': 'Itaú Unibanco',
    'BBDC4': 'Bradesco',
    'ABEV3': 'Ambev',
    'B3SA3': 'B3',
    'WEGE3': 'WEG',
    'RENT3': 'Localiza',
    'SUZB3': 'Suzano'
    # Add more as needed
}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for sentiment analysis.
    
    Event parameters:
    - bucket: S3 bucket name (optional, uses env var)
    - ticker: Specific ticker to analyze (optional, analyzes all in universe)
    - news_api_key: News API key (optional, uses env var or secret)
    
    Returns:
        Dictionary with sentiment analysis results
    """
    try:
        # Get parameters
        bucket = event.get('bucket', os.environ.get('BUCKET_NAME'))
        ticker = event.get('ticker')
        news_api_key = event.get('news_api_key', os.environ.get('NEWS_API_KEY'))
        
        if not bucket:
            raise ValueError("Bucket name not provided")
        
        # Try to get News API key from Secrets Manager if not provided
        if not news_api_key:
            try:
                secret_response = secrets.get_secret_value(SecretId='news-api/key')
                news_api_key = json.loads(secret_response['SecretString']).get('api_key')
            except Exception as e:
                logger.warning(f"Could not load News API key from Secrets Manager: {e}")
        
        logger.info(f"Starting sentiment analysis for bucket: {bucket}")
        
        # Initialize analyzer
        analyzer = SentimentAnalyzer(news_api_key=news_api_key)
        
        # Load universe
        universe_key = os.environ.get('B3TR_UNIVERSE_S3_KEY', 'config/universe.txt')
        
        try:
            response = s3.get_object(Bucket=bucket, Key=universe_key)
            universe = response['Body'].read().decode('utf-8').strip().split('\n')
            universe = [t.strip() for t in universe if t.strip()]
        except Exception as e:
            logger.error(f"Could not load universe: {e}")
            return {
                'statusCode': 404,
                'body': json.dumps({
                    'error': 'Universe file not found',
                    'message': str(e)
                })
            }
        
        # Filter by ticker if specified
        if ticker:
            if ticker not in universe:
                return {
                    'statusCode': 404,
                    'body': json.dumps({
                        'error': f'Ticker {ticker} not in universe'
                    })
                }
            universe = [ticker]
        
        # Analyze sentiment for each ticker
        results = []
        
        for ticker_symbol in universe:
            company_name = COMPANY_NAMES.get(ticker_symbol, ticker_symbol)
            
            logger.info(f"Analyzing sentiment for {ticker_symbol} ({company_name})")
            
            try:
                sentiment = analyzer.calculate_composite_sentiment(
                    ticker=ticker_symbol,
                    company_name=company_name
                )
                
                results.append(sentiment)
                
                # Save individual result to S3
                analyzer.save_sentiment_to_s3(sentiment, bucket)
                
            except Exception as e:
                logger.error(f"Error analyzing sentiment for {ticker_symbol}: {e}")
                continue
        
        if not results:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'No sentiment analysis generated',
                    'total_tickers': len(universe)
                })
            }
        
        # Save aggregate results
        date_str = datetime.now().strftime('%Y-%m-%d')
        output_key = f"sentiment/dt={date_str}/aggregate_sentiment.json"
        
        s3.put_object(
            Bucket=bucket,
            Key=output_key,
            Body=json.dumps({
                'date': date_str,
                'total_analyzed': len(results),
                'sentiments': results
            }),
            ContentType='application/json'
        )
        
        logger.info(f"Saved aggregate sentiment to s3://{bucket}/{output_key}")
        
        # Calculate summary statistics
        positive_count = sum(1 for r in results if r['sentiment_label'] == 'positive')
        negative_count = sum(1 for r in results if r['sentiment_label'] == 'negative')
        neutral_count = sum(1 for r in results if r['sentiment_label'] == 'neutral')
        
        avg_sentiment = sum(r['composite_score'] for r in results) / len(results)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Sentiment analysis completed',
                'total_analyzed': len(results),
                'summary': {
                    'positive': positive_count,
                    'negative': negative_count,
                    'neutral': neutral_count,
                    'avg_sentiment': float(avg_sentiment)
                },
                's3_key': output_key,
                'sentiments': results
            })
        }
    
    except Exception as e:
        logger.error(f"Error in sentiment analysis: {e}", exc_info=True)
        
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Sentiment analysis failed'
            })
        }
