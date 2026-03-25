"""
Sentiment Analysis for Stock Market

Analyzes sentiment from:
- News articles
- Social media (Twitter/X)
- Google Trends

Provides sentiment score as additional feature for DL models.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Dict, Optional

import boto3
import pandas as pd
import requests

logger = logging.getLogger(__name__)

s3 = boto3.client('s3')


class SentimentAnalyzer:
    """
    Multi-source sentiment analysis for stocks.
    
    Sources:
    - News API (financial news)
    - Twitter/X API (social sentiment)
    - Google Trends (search interest)
    """
    
    def __init__(
        self,
        news_api_key: Optional[str] = None,
        twitter_bearer_token: Optional[str] = None
    ):
        """
        Initialize sentiment analyzer.
        
        Args:
            news_api_key: News API key
            twitter_bearer_token: Twitter API bearer token
        """
        self.news_api_key = news_api_key
        self.twitter_bearer_token = twitter_bearer_token
        
        # Sentiment keywords (Portuguese)
        self.positive_keywords = [
            'alta', 'subiu', 'crescimento', 'lucro', 'positivo', 'otimista',
            'valorização', 'ganho', 'recuperação', 'forte', 'bom', 'excelente'
        ]
        
        self.negative_keywords = [
            'queda', 'caiu', 'prejuízo', 'negativo', 'pessimista', 'crise',
            'desvalorização', 'perda', 'fraco', 'ruim', 'péssimo', 'risco'
        ]
    
    def analyze_text_sentiment(self, text: str) -> Dict:
        """
        Analyze sentiment of a text using keywords.
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary with sentiment scores
        """
        # Clean text
        text_clean = text.lower()
        text_clean = re.sub(r'[^\w\s]', ' ', text_clean)
        
        # Keyword-based sentiment (Portuguese)
        positive_count = sum(1 for word in self.positive_keywords if word in text_clean)
        negative_count = sum(1 for word in self.negative_keywords if word in text_clean)
        
        # Combined score
        total = max(positive_count + negative_count, 1)
        keyword_score = (positive_count - negative_count) / total
        
        return {
            'keyword_score': float(keyword_score),
            'positive_keywords': int(positive_count),
            'negative_keywords': int(negative_count)
        }
    
    def fetch_news_sentiment(
        self,
        ticker: str,
        company_name: str,
        days_back: int = 7
    ) -> Dict:
        """
        Fetch and analyze news sentiment.
        
        Args:
            ticker: Stock ticker
            company_name: Company name for search
            days_back: Days to look back
            
        Returns:
            Dictionary with news sentiment
        """
        if not self.news_api_key:
            logger.warning("News API key not provided")
            return {'error': 'No API key', 'sentiment_score': 0}
        
        try:
            # News API endpoint
            url = 'https://newsapi.org/v2/everything'
            
            # Calculate date range
            to_date = datetime.now()
            from_date = to_date - timedelta(days=days_back)
            
            params = {
                'q': f'{company_name} OR {ticker}',
                'from': from_date.strftime('%Y-%m-%d'),
                'to': to_date.strftime('%Y-%m-%d'),
                'language': 'pt',
                'sortBy': 'relevancy',
                'apiKey': self.news_api_key
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            articles = data.get('articles', [])
            
            if not articles:
                return {
                    'sentiment_score': 0,
                    'article_count': 0,
                    'message': 'No articles found'
                }
            
            # Analyze each article
            sentiments = []
            for article in articles[:20]:  # Limit to 20 articles
                title = article.get('title', '')
                description = article.get('description', '')
                content = f"{title} {description}"
                
                sentiment = self.analyze_text_sentiment(content)
                sentiments.append(sentiment['keyword_score'])
            
            # Calculate aggregate sentiment
            avg_sentiment = sum(sentiments) / len(sentiments)
            
            return {
                'sentiment_score': float(avg_sentiment),
                'article_count': len(articles),
                'analyzed_count': len(sentiments),
                'positive_articles': sum(1 for s in sentiments if s > 0.1),
                'negative_articles': sum(1 for s in sentiments if s < -0.1),
                'neutral_articles': sum(1 for s in sentiments if -0.1 <= s <= 0.1)
            }
            
        except Exception as e:
            logger.error(f"Error fetching news sentiment: {e}")
            return {'error': str(e), 'sentiment_score': 0}
    
    def calculate_composite_sentiment(
        self,
        ticker: str,
        company_name: str
    ) -> Dict:
        """
        Calculate composite sentiment from all sources.
        
        Args:
            ticker: Stock ticker
            company_name: Company name
            
        Returns:
            Dictionary with composite sentiment
        """
        # Fetch from news
        news_sentiment = self.fetch_news_sentiment(ticker, company_name)
        
        # Extract scores
        news_score = news_sentiment.get('sentiment_score', 0)
        
        # For now, just use news sentiment
        # Can add Twitter and Google Trends later
        composite_score = news_score
        
        # Classify sentiment
        if composite_score > 0.2:
            sentiment_label = 'positive'
        elif composite_score < -0.2:
            sentiment_label = 'negative'
        else:
            sentiment_label = 'neutral'
        
        return {
            'ticker': ticker,
            'company_name': company_name,
            'timestamp': datetime.now().isoformat(),
            'composite_score': float(composite_score),
            'sentiment_label': sentiment_label,
            'sources': {
                'news': news_sentiment
            },
            'confidence': self._calculate_confidence(news_sentiment)
        }
    
    def _calculate_confidence(self, news_sentiment: Dict) -> float:
        """
        Calculate confidence score based on data availability.
        
        Args:
            news_sentiment: News sentiment data
            
        Returns:
            Confidence score (0-1)
        """
        confidence = 0.0
        
        # News confidence
        if 'error' not in news_sentiment and news_sentiment.get('article_count', 0) > 0:
            confidence += min(news_sentiment.get('article_count', 0) / 10, 1.0)
        
        return float(confidence)
    
    def save_sentiment_to_s3(
        self,
        sentiment_data: Dict,
        bucket: str
    ) -> None:
        """
        Save sentiment data to S3.
        
        Args:
            sentiment_data: Sentiment data dictionary
            bucket: S3 bucket name
        """
        try:
            ticker = sentiment_data['ticker']
            date = datetime.now().strftime('%Y-%m-%d')
            
            key = f"sentiment/dt={date}/{ticker}.json"
            
            s3.put_object(
                Bucket=bucket,
                Key=key,
                Body=pd.Series(sentiment_data).to_json(),
                ContentType='application/json'
            )
            
            logger.info(f"Saved sentiment data to s3://{bucket}/{key}")
            
        except Exception as e:
            logger.error(f"Error saving sentiment to S3: {e}")
