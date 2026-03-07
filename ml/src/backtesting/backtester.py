"""
Backtesting System - Validates model predictions against real results

Compares predictions made N days ago with actual market performance
to calculate accuracy metrics and validate the model.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import boto3
import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger(__name__)

s3 = boto3.client('s3')


class Backtester:
    """
    Backtesting system for validating model predictions.
    
    Features:
    - Compares predictions vs actual returns
    - Calculates hit rate, average return, Sharpe ratio
    - Tracks performance over time
    - Identifies best/worst predictions
    """
    
    def __init__(self, bucket: str, prediction_horizon_days: int = 20):
        """
        Initialize backtester.
        
        Args:
            bucket: S3 bucket name
            prediction_horizon_days: How many days ahead predictions are for
        """
        self.bucket = bucket
        self.prediction_horizon_days = prediction_horizon_days
        
    def load_historical_predictions(
        self,
        date: datetime,
        prefix: str = 'recommendations/'
    ) -> Optional[pd.DataFrame]:
        """
        Load predictions made on a specific date.
        
        Args:
            date: Date when predictions were made
            prefix: S3 prefix for predictions
            
        Returns:
            DataFrame with predictions or None if not found
        """
        try:
            date_str = date.strftime('%Y-%m-%d')
            key = f"{prefix}dt={date_str}/top50.json"
            
            response = s3.get_object(Bucket=self.bucket, Key=key)
            data = pd.read_json(response['Body'])
            
            if 'recommendations' in data.columns:
                df = pd.DataFrame(data['recommendations'].iloc[0])
            else:
                df = data
                
            df['prediction_date'] = date
            return df
            
        except Exception as e:
            logger.warning(f"Could not load predictions for {date_str}: {e}")
            return None
    
    def load_actual_prices(
        self,
        tickers: List[str],
        start_date: datetime,
        end_date: datetime
    ) -> pd.DataFrame:
        """
        Load actual price data from S3.
        
        Args:
            tickers: List of stock tickers
            start_date: Start date
            end_date: End date
            
        Returns:
            DataFrame with actual prices
        """
        try:
            # Load from processed data
            all_data = []
            
            for ticker in tickers:
                key = f"processed/quotes/{ticker}.parquet"
                
                try:
                    response = s3.get_object(Bucket=self.bucket, Key=key)
                    df = pd.read_parquet(response['Body'])
                    
                    df = df[
                        (df['date'] >= start_date) &
                        (df['date'] <= end_date)
                    ]
                    
                    df['ticker'] = ticker
                    all_data.append(df)
                    
                except Exception as e:
                    logger.warning(f"Could not load data for {ticker}: {e}")
                    continue
            
            if not all_data:
                return pd.DataFrame()
                
            return pd.concat(all_data, ignore_index=True)
            
        except Exception as e:
            logger.error(f"Error loading actual prices: {e}")
            return pd.DataFrame()
    
    def calculate_actual_returns(
        self,
        prices: pd.DataFrame,
        start_date: datetime,
        end_date: datetime
    ) -> pd.DataFrame:
        """
        Calculate actual returns for each ticker.
        
        Args:
            prices: DataFrame with price data
            start_date: Start date for return calculation
            end_date: End date for return calculation
            
        Returns:
            DataFrame with actual returns
        """
        returns = []
        
        for ticker in prices['ticker'].unique():
            ticker_data = prices[prices['ticker'] == ticker].sort_values('date')
            
            # Get price at start and end
            start_price = ticker_data[
                ticker_data['date'] >= start_date
            ]['close'].iloc[0] if len(ticker_data) > 0 else None
            
            end_price = ticker_data[
                ticker_data['date'] <= end_date
            ]['close'].iloc[-1] if len(ticker_data) > 0 else None
            
            if start_price and end_price:
                actual_return = (end_price - start_price) / start_price
                
                returns.append({
                    'ticker': ticker,
                    'start_price': start_price,
                    'end_price': end_price,
                    'actual_return': actual_return
                })
        
        return pd.DataFrame(returns)
    
    def backtest_predictions(
        self,
        prediction_date: datetime
    ) -> Optional[Dict]:
        """
        Backtest predictions made on a specific date.
        
        Args:
            prediction_date: Date when predictions were made
            
        Returns:
            Dictionary with backtest results
        """
        # Load predictions
        predictions = self.load_historical_predictions(prediction_date)
        
        if predictions is None or len(predictions) == 0:
            logger.warning(f"No predictions found for {prediction_date}")
            return None
        
        # Calculate actual return period
        start_date = prediction_date + timedelta(days=1)
        end_date = prediction_date + timedelta(days=self.prediction_horizon_days)
        
        # Load actual prices
        tickers = predictions['ticker'].tolist()
        prices = self.load_actual_prices(tickers, start_date, end_date)
        
        if len(prices) == 0:
            logger.warning(f"No price data found for backtest period")
            return None
        
        # Calculate actual returns
        actual_returns = self.calculate_actual_returns(prices, start_date, end_date)
        
        # Merge predictions with actual returns
        results = predictions.merge(
            actual_returns,
            on='ticker',
            how='inner'
        )
        
        if len(results) == 0:
            return None
        
        # Calculate metrics
        metrics = self.calculate_backtest_metrics(results)
        
        return {
            'prediction_date': prediction_date.isoformat(),
            'evaluation_date': datetime.now().isoformat(),
            'horizon_days': self.prediction_horizon_days,
            'total_predictions': len(predictions),
            'matched_predictions': len(results),
            'metrics': metrics,
            'top_predictions': results.nsmallest(10, 'rank')[
                ['ticker', 'rank', 'predicted_return', 'actual_return']
            ].to_dict('records'),
            'worst_predictions': results.nlargest(10, 'rank')[
                ['ticker', 'rank', 'predicted_return', 'actual_return']
            ].to_dict('records')
        }
    
    def calculate_backtest_metrics(self, results: pd.DataFrame) -> Dict:
        """
        Calculate comprehensive backtest metrics.
        
        Args:
            results: DataFrame with predictions and actual returns
            
        Returns:
            Dictionary with metrics
        """
        # Hit rate (% of correct direction predictions)
        correct_direction = (
            (results['predicted_return'] > 0) == (results['actual_return'] > 0)
        ).sum()
        hit_rate = correct_direction / len(results)
        
        # Average returns
        avg_predicted_return = results['predicted_return'].mean()
        avg_actual_return = results['actual_return'].mean()
        
        # Returns if following top 10
        top_10 = results.nsmallest(10, 'rank')
        top_10_return = top_10['actual_return'].mean()
        
        # Sharpe ratio (assuming daily returns)
        returns_std = results['actual_return'].std()
        sharpe_ratio = (avg_actual_return / returns_std) if returns_std > 0 else 0
        
        # Correlation between predicted and actual
        correlation, p_value = stats.pearsonr(
            results['predicted_return'],
            results['actual_return']
        )
        
        # Max drawdown
        cumulative_returns = (1 + results['actual_return']).cumprod()
        running_max = cumulative_returns.expanding().max()
        drawdown = (cumulative_returns - running_max) / running_max
        max_drawdown = drawdown.min()
        
        # Win rate (% of positive returns)
        win_rate = (results['actual_return'] > 0).sum() / len(results)
        
        # Average win vs average loss
        wins = results[results['actual_return'] > 0]['actual_return']
        losses = results[results['actual_return'] < 0]['actual_return']
        
        avg_win = wins.mean() if len(wins) > 0 else 0
        avg_loss = losses.mean() if len(losses) > 0 else 0
        
        # Profit factor
        total_wins = wins.sum() if len(wins) > 0 else 0
        total_losses = abs(losses.sum()) if len(losses) > 0 else 0
        profit_factor = total_wins / total_losses if total_losses > 0 else 0
        
        return {
            'hit_rate': float(hit_rate),
            'avg_predicted_return': float(avg_predicted_return),
            'avg_actual_return': float(avg_actual_return),
            'top_10_return': float(top_10_return),
            'sharpe_ratio': float(sharpe_ratio),
            'correlation': float(correlation),
            'correlation_p_value': float(p_value),
            'max_drawdown': float(max_drawdown),
            'win_rate': float(win_rate),
            'avg_win': float(avg_win),
            'avg_loss': float(avg_loss),
            'profit_factor': float(profit_factor),
            'total_predictions': len(results),
            'correct_direction': int(correct_direction)
        }
    
    def run_rolling_backtest(
        self,
        start_date: datetime,
        end_date: datetime,
        save_to_s3: bool = True
    ) -> List[Dict]:
        """
        Run backtest for multiple dates.
        
        Args:
            start_date: Start date for backtest period
            end_date: End date for backtest period
            save_to_s3: Whether to save results to S3
            
        Returns:
            List of backtest results
        """
        results = []
        current_date = start_date
        
        while current_date <= end_date:
            logger.info(f"Backtesting predictions from {current_date}")
            
            result = self.backtest_predictions(current_date)
            
            if result:
                results.append(result)
                
                if save_to_s3:
                    self.save_backtest_result(result)
            
            current_date += timedelta(days=1)
        
        return results
    
    def save_backtest_result(self, result: Dict) -> None:
        """
        Save backtest result to S3.
        
        Args:
            result: Backtest result dictionary
        """
        try:
            prediction_date = result['prediction_date'][:10]
            key = f"backtesting/dt={prediction_date}/results.json"
            
            s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=pd.Series(result).to_json(),
                ContentType='application/json'
            )
            
            logger.info(f"Saved backtest result to s3://{self.bucket}/{key}")
            
        except Exception as e:
            logger.error(f"Error saving backtest result: {e}")
