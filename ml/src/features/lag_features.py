"""
Lag Features Calculator

This module implements lag and diff features for time series forecasting.
Lag features capture historical values at specific time offsets.

**Validates: Requirements 3.3**
"""

import pandas as pd
from typing import List


class LagFeaturesCalculator:
    """
    Calculator for lag and diff features.
    
    Implements:
    - Lag features: Historical values at specific time offsets
    - Diff features: First-order differences between time periods
    """
    
    def create_lags(self, series: pd.Series, lags: List[int]) -> pd.DataFrame:
        """
        Create lag features for specified lag periods.
        
        Lag features capture the value of the series at previous time steps.
        For example, lag_1 is the value from 1 period ago, lag_5 is from 5 periods ago.
        
        Args:
            series: Input time series data
            lags: List of lag periods (e.g., [1, 2, 3, 5, 10])
            
        Returns:
            DataFrame with columns for each lag period (e.g., lag_1, lag_2, lag_3)
        """
        result = pd.DataFrame(index=series.index)
        
        for lag in lags:
            col_name = f'lag_{lag}'
            result[col_name] = series.shift(lag)
        
        return result
    
    def create_diff_features(self, series: pd.Series, periods: List[int]) -> pd.DataFrame:
        """
        Create diff features for specified periods.
        
        Diff features calculate the first-order difference between the current value
        and the value from N periods ago: diff_N = value(t) - value(t-N)
        
        Args:
            series: Input time series data
            periods: List of periods for diff calculation (e.g., [1, 2, 3, 5, 10])
            
        Returns:
            DataFrame with columns for each period (e.g., diff_1, diff_2, diff_3)
        """
        result = pd.DataFrame(index=series.index)
        
        for period in periods:
            col_name = f'diff_{period}'
            result[col_name] = series.diff(period)
        
        return result
