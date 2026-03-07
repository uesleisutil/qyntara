"""
Lambda: Feature Engineering Pipeline

Orchestrates all feature calculators to generate engineered features for model training.
Reads raw market data from S3 and writes normalized features back to S3.

**Validates: Requirements 3.6**
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, List

import boto3
import pandas as pd

from src.features.technical_indicators import TechnicalIndicatorsCalculator
from src.features.rolling_stats import RollingStatsCalculator
from src.features.lag_features import LagFeaturesCalculator
from src.features.volume_features import VolumeFeaturesCalculator
from src.features.feature_normalizer import FeatureNormalizer

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")


class FeatureEngineeringPipeline:
    """
    Orchestrates feature engineering for stock market data.
    
    Generates 50+ features including:
    - Technical indicators (RSI, MACD, Bollinger Bands, Stochastic, ATR)
    - Rolling statistics (mean, std, min, max for windows 5, 10, 20, 60)
    - Lag features (lags 1, 2, 3, 5, 10)
    - Diff features (diffs 1, 2, 3, 5, 10)
    - Volume features (volume ratio, OBV, VWAP)
    - Normalized features using robust scaling
    """
    
    def __init__(self):
        """Initialize all feature calculators."""
        self.technical_calc = TechnicalIndicatorsCalculator()
        self.rolling_calc = RollingStatsCalculator()
        self.lag_calc = LagFeaturesCalculator()
        self.volume_calc = VolumeFeaturesCalculator()
        self.normalizer = FeatureNormalizer()
        
        # Feature configuration
        self.rolling_windows = [5, 10, 20, 60]
        self.lag_periods = [1, 2, 3, 5, 10]
    
    def calculate_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Calculate all features for a single stock.
        
        Args:
            data: DataFrame with columns: high, low, close, volume
            
        Returns:
            DataFrame with all engineered features
        """
        features = pd.DataFrame(index=data.index)
        
        # Technical Indicators
        logger.info("Calculating technical indicators...")
        features['rsi'] = self.technical_calc.calculate_rsi(data['close'])
        
        macd_line, signal_line, histogram = self.technical_calc.calculate_macd(data['close'])
        features['macd_line'] = macd_line
        features['macd_signal'] = signal_line
        features['macd_histogram'] = histogram
        
        upper_band, middle_band, lower_band = self.technical_calc.calculate_bollinger_bands(data['close'])
        features['bb_upper'] = upper_band
        features['bb_middle'] = middle_band
        features['bb_lower'] = lower_band
        
        stoch_k, stoch_d = self.technical_calc.calculate_stochastic(
            data['high'], data['low'], data['close']
        )
        features['stoch_k'] = stoch_k
        features['stoch_d'] = stoch_d
        
        features['atr'] = self.technical_calc.calculate_atr(
            data['high'], data['low'], data['close']
        )
        
        # Rolling Statistics
        logger.info("Calculating rolling statistics...")
        rolling_mean = self.rolling_calc.calculate_rolling_mean(data['close'], self.rolling_windows)
        rolling_std = self.rolling_calc.calculate_rolling_std(data['close'], self.rolling_windows)
        rolling_minmax = self.rolling_calc.calculate_rolling_min_max(data['close'], self.rolling_windows)
        
        features = pd.concat([features, rolling_mean, rolling_std, rolling_minmax], axis=1)
        
        # Calculate returns for volatility
        returns = data['close'].pct_change()
        features['ewm_volatility'] = self.rolling_calc.calculate_ewm_volatility(returns)
        
        # Lag Features
        logger.info("Calculating lag features...")
        lag_features = self.lag_calc.create_lags(data['close'], self.lag_periods)
        diff_features = self.lag_calc.create_diff_features(data['close'], self.lag_periods)
        
        features = pd.concat([features, lag_features, diff_features], axis=1)
        
        # Volume Features
        logger.info("Calculating volume features...")
        features['volume_ratio'] = self.volume_calc.calculate_volume_ratio(data['volume'])
        features['obv'] = self.volume_calc.calculate_obv(data['close'], data['volume'])
        features['vwap'] = self.volume_calc.calculate_vwap(
            data['high'], data['low'], data['close'], data['volume']
        )
        
        return features
    
    def normalize_features(self, features: pd.DataFrame, fit: bool = True) -> pd.DataFrame:
        """
        Normalize features using robust scaling.
        
        Args:
            features: DataFrame with raw features
            fit: Whether to fit the normalizer (True for training data)
            
        Returns:
            DataFrame with normalized features
        """
        if fit:
            logger.info("Fitting normalizer...")
            self.normalizer.fit(features)
        
        logger.info("Transforming features...")
        normalized = self.normalizer.transform(features)
        
        return normalized
    
    def process_stock(
        self, 
        stock_symbol: str, 
        data: pd.DataFrame,
        fit_normalizer: bool = True
    ) -> pd.DataFrame:
        """
        Process a single stock: calculate and normalize features.
        
        Args:
            stock_symbol: Stock ticker symbol
            data: Raw market data
            fit_normalizer: Whether to fit normalizer
            
        Returns:
            DataFrame with normalized features
        """
        logger.info(f"Processing {stock_symbol}...")
        
        # Calculate features
        features = self.calculate_features(data)
        
        # Normalize features
        normalized_features = self.normalize_features(features, fit=fit_normalizer)
        
        # Add stock symbol column
        normalized_features['symbol'] = stock_symbol
        
        return normalized_features


def load_market_data(bucket: str, key: str) -> pd.DataFrame:
    """
    Load market data from S3.
    
    Args:
        bucket: S3 bucket name
        key: S3 object key
        
    Returns:
        DataFrame with market data
    """
    obj = s3.get_object(Bucket=bucket, Key=key)
    data = pd.read_csv(obj['Body'])
    
    # Convert date column to datetime and set as index
    if 'date' in data.columns:
        data['date'] = pd.to_datetime(data['date'])
        data.set_index('date', inplace=True)
    
    return data


def save_features(bucket: str, key: str, features: pd.DataFrame) -> None:
    """
    Save features to S3.
    
    Args:
        bucket: S3 bucket name
        key: S3 object key
        features: DataFrame with features
    """
    csv_buffer = features.to_csv()
    s3.put_object(Bucket=bucket, Key=key, Body=csv_buffer)


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for feature engineering.
    
    Event structure:
    {
        "stock_symbols": ["PETR4", "VALE3", ...],
        "start_date": "2023-01-01",
        "end_date": "2024-01-01",
        "input_bucket": "bucket-name",
        "input_prefix": "raw/",
        "output_bucket": "bucket-name",
        "output_prefix": "features/"
    }
    
    Returns:
    {
        "status": "success",
        "features_s3_path": "s3://bucket/features/2024-01-01/",
        "num_stocks": 100,
        "num_features": 52,
        "processing_time_seconds": 120.5
    }
    """
    start_time = datetime.now()
    
    try:
        # Extract parameters
        stock_symbols = event.get('stock_symbols', [])
        start_date = event.get('start_date')
        end_date = event.get('end_date')
        input_bucket = event.get('input_bucket')
        input_prefix = event.get('input_prefix', 'raw/')
        output_bucket = event.get('output_bucket')
        output_prefix = event.get('output_prefix', 'features/')
        
        logger.info(f"Processing {len(stock_symbols)} stocks from {start_date} to {end_date}")
        
        # Initialize pipeline
        pipeline = FeatureEngineeringPipeline()
        
        # Process each stock
        all_features = []
        processed_stocks = 0
        
        for symbol in stock_symbols:
            try:
                # Load market data
                input_key = f"{input_prefix}{symbol}.csv"
                data = load_market_data(input_bucket, input_key)
                
                # Filter by date range
                if start_date:
                    data = data[data.index >= start_date]
                if end_date:
                    data = data[data.index <= end_date]
                
                # Process stock
                # Fit normalizer only on first stock, then transform others
                fit_normalizer = (processed_stocks == 0)
                features = pipeline.process_stock(symbol, data, fit_normalizer=fit_normalizer)
                
                all_features.append(features)
                processed_stocks += 1
                
                logger.info(f"Processed {symbol}: {len(features)} rows, {len(features.columns)} features")
                
            except Exception as e:
                logger.error(f"Error processing {symbol}: {str(e)}")
                continue
        
        # Combine all features
        if all_features:
            combined_features = pd.concat(all_features, axis=0)
            
            # Save to S3
            output_key = f"{output_prefix}{end_date}/features.csv"
            save_features(output_bucket, output_key, combined_features)
            
            # Save normalizer
            scaler_key = f"{output_prefix}{end_date}/scaler.pkl"
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pkl') as tmp:
                pipeline.normalizer.save_scaler(tmp.name)
                with open(tmp.name, 'rb') as f:
                    s3.put_object(Bucket=output_bucket, Key=scaler_key, Body=f.read())
            
            # Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds()
            
            # Return success response
            return {
                'status': 'success',
                'features_s3_path': f"s3://{output_bucket}/{output_prefix}{end_date}/",
                'num_stocks': processed_stocks,
                'num_features': len(combined_features.columns),
                'processing_time_seconds': processing_time,
                'message': f"Successfully processed {processed_stocks} stocks"
            }
        else:
            return {
                'status': 'error',
                'message': 'No stocks were successfully processed'
            }
            
    except Exception as e:
        logger.error(f"Feature engineering failed: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }
