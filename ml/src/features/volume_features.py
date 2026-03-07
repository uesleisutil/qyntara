"""
Volume Features Calculator

This module implements volume-based features for stock market analysis.
Volume features help identify trading activity patterns and price-volume relationships.

**Validates: Requirements 3.5**
"""

import pandas as pd
import numpy as np


class VolumeFeaturesCalculator:
    """
    Calculator for volume-based features.
    
    Implements:
    - Volume Ratio: Current volume relative to average volume
    - OBV (On-Balance Volume): Cumulative volume indicator
    - VWAP (Volume Weighted Average Price): Average price weighted by volume
    """
    
    def calculate_volume_ratio(self, volume: pd.Series, window: int = 20) -> pd.Series:
        """
        Calculate volume ratio (current volume / average volume).
        
        Volume ratio indicates whether current trading volume is above or below
        the average. Values > 1 indicate higher than average volume.
        
        Formula:
        Volume Ratio = Current Volume / Rolling Average Volume
        
        Args:
            volume: Series of trading volumes
            window: Window size for rolling average (default: 20)
            
        Returns:
            Series of volume ratio values
        """
        # Calculate rolling average volume
        avg_volume = volume.rolling(window=window, min_periods=1).mean()
        
        # Calculate ratio
        volume_ratio = volume / avg_volume
        
        return volume_ratio
    
    def calculate_obv(self, close: pd.Series, volume: pd.Series) -> pd.Series:
        """
        Calculate On-Balance Volume (OBV).
        
        OBV is a cumulative indicator that adds volume on up days and subtracts
        volume on down days. It helps identify buying and selling pressure.
        
        Formula:
        - If close > previous close: OBV = previous OBV + volume
        - If close < previous close: OBV = previous OBV - volume
        - If close = previous close: OBV = previous OBV
        
        Args:
            close: Series of closing prices
            volume: Series of trading volumes
            
        Returns:
            Series of OBV values
        """
        # Calculate price direction
        price_change = close.diff()
        
        # Create direction multiplier: +1 for up, -1 for down, 0 for unchanged
        direction = np.sign(price_change)
        
        # Replace NaN (first value) with 0
        direction = direction.fillna(0)
        
        # Calculate signed volume
        signed_volume = direction * volume
        
        # Calculate cumulative OBV
        obv = signed_volume.cumsum()
        
        return obv
    
    def calculate_vwap(
        self, 
        high: pd.Series, 
        low: pd.Series, 
        close: pd.Series, 
        volume: pd.Series
    ) -> pd.Series:
        """
        Calculate Volume Weighted Average Price (VWAP).
        
        VWAP is the average price weighted by volume. It represents the average
        price at which the security has traded throughout the day.
        
        Formula:
        Typical Price = (High + Low + Close) / 3
        VWAP = Cumulative(Typical Price * Volume) / Cumulative(Volume)
        
        Args:
            high: Series of high prices
            low: Series of low prices
            close: Series of closing prices
            volume: Series of trading volumes
            
        Returns:
            Series of VWAP values
        """
        # Calculate typical price
        typical_price = (high + low + close) / 3
        
        # Calculate price * volume
        pv = typical_price * volume
        
        # Calculate cumulative sums
        cumulative_pv = pv.cumsum()
        cumulative_volume = volume.cumsum()
        
        # Calculate VWAP
        vwap = cumulative_pv / cumulative_volume
        
        return vwap
