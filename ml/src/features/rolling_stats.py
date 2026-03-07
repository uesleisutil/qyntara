"""
Rolling Statistics Calculator

This module implements rolling statistics calculations for feature engineering.
Provides rolling mean, std, min/max, and EWMA volatility calculations.
"""

import pandas as pd
from typing import List


class RollingStatsCalculator:
    """
    Calculator for rolling statistics features.
    
    Implements rolling window operations for mean, standard deviation,
    min/max, and exponentially weighted moving average volatility.
    """
    
    def calculate_rolling_mean(self, series: pd.Series, windows: List[int]) -> pd.DataFrame:
        """
        Calculate rolling mean for multiple window sizes.
        
        Args:
            series: Input time series data
            windows: List of window sizes (e.g., [5, 10, 20, 60])
            
        Returns:
            DataFrame with columns for each window size (e.g., rolling_mean_5, rolling_mean_10)
        """
        result = pd.DataFrame(index=series.index)
        
        for window in windows:
            col_name = f'rolling_mean_{window}'
            result[col_name] = series.rolling(window=window, min_periods=1).mean()
        
        return result
    
    def calculate_rolling_std(self, series: pd.Series, windows: List[int]) -> pd.DataFrame:
        """
        Calculate rolling standard deviation for multiple window sizes.
        
        Args:
            series: Input time series data
            windows: List of window sizes (e.g., [5, 10, 20, 60])
            
        Returns:
            DataFrame with columns for each window size (e.g., rolling_std_5, rolling_std_10)
        """
        result = pd.DataFrame(index=series.index)
        
        for window in windows:
            col_name = f'rolling_std_{window}'
            result[col_name] = series.rolling(window=window, min_periods=1).std()
        
        return result
    
    def calculate_rolling_min_max(self, series: pd.Series, windows: List[int]) -> pd.DataFrame:
        """
        Calculate rolling min and max for multiple window sizes.
        
        Args:
            series: Input time series data
            windows: List of window sizes (e.g., [5, 10, 20, 60])
            
        Returns:
            DataFrame with min and max columns for each window size
            (e.g., rolling_min_5, rolling_max_5)
        """
        result = pd.DataFrame(index=series.index)
        
        for window in windows:
            min_col = f'rolling_min_{window}'
            max_col = f'rolling_max_{window}'
            result[min_col] = series.rolling(window=window, min_periods=1).min()
            result[max_col] = series.rolling(window=window, min_periods=1).max()
        
        return result
    
    def calculate_ewm_volatility(self, returns: pd.Series, span: int = 20) -> pd.Series:
        """
        Calculate exponentially weighted moving average (EWMA) volatility.
        
        Args:
            returns: Return series (typically log returns or percentage returns)
            span: Span for EWMA calculation (default: 20)
            
        Returns:
            Series containing EWMA volatility values
        """
        # Calculate EWMA of squared returns (variance)
        ewm_variance = returns.pow(2).ewm(span=span, min_periods=1).mean()
        
        # Take square root to get volatility (standard deviation)
        ewm_volatility = ewm_variance.pow(0.5)
        
        return ewm_volatility
