"""
Technical Indicators Calculator

This module implements industry-standard technical indicators for stock market analysis.
All calculations use pandas Series as input and follow standard financial formulas.

**Validates: Requirements 3.1**
"""

import pandas as pd
import numpy as np
from typing import Tuple


class TechnicalIndicatorsCalculator:
    """
    Calculator for technical indicators used in stock market analysis.
    
    Implements:
    - RSI (Relative Strength Index)
    - MACD (Moving Average Convergence Divergence)
    - Bollinger Bands
    - Stochastic Oscillator
    - ATR (Average True Range)
    """
    
    def calculate_rsi(self, prices: pd.Series, period: int = 14) -> pd.Series:
        """
        Calculate Relative Strength Index (RSI).
        
        RSI measures the magnitude of recent price changes to evaluate
        overbought or oversold conditions. Values range from 0 to 100.
        
        Formula:
        RSI = 100 - (100 / (1 + RS))
        where RS = Average Gain / Average Loss over period
        
        Args:
            prices: Series of closing prices
            period: Lookback period for RSI calculation (default: 14)
            
        Returns:
            Series of RSI values (0-100)
        """
        # Calculate price changes
        delta = prices.diff()
        
        # Separate gains and losses
        gains = delta.where(delta > 0, 0.0)
        losses = -delta.where(delta < 0, 0.0)
        
        # Calculate average gains and losses using Wilder's smoothing
        avg_gains = gains.ewm(com=period - 1, min_periods=period, adjust=False).mean()
        avg_losses = losses.ewm(com=period - 1, min_periods=period, adjust=False).mean()
        
        # Calculate RS and RSI
        rs = avg_gains / avg_losses
        rsi = 100 - (100 / (1 + rs))
        
        return rsi
    
    def calculate_macd(
        self, 
        prices: pd.Series,
        fast_period: int = 12,
        slow_period: int = 26,
        signal_period: int = 9
    ) -> Tuple[pd.Series, pd.Series, pd.Series]:
        """
        Calculate MACD (Moving Average Convergence Divergence).
        
        MACD is a trend-following momentum indicator that shows the relationship
        between two moving averages of prices.
        
        Formula:
        MACD Line = EMA(fast) - EMA(slow)
        Signal Line = EMA(MACD Line, signal_period)
        Histogram = MACD Line - Signal Line
        
        Args:
            prices: Series of closing prices
            fast_period: Fast EMA period (default: 12)
            slow_period: Slow EMA period (default: 26)
            signal_period: Signal line EMA period (default: 9)
            
        Returns:
            Tuple of (macd_line, signal_line, histogram)
        """
        # Calculate fast and slow EMAs
        ema_fast = prices.ewm(span=fast_period, adjust=False).mean()
        ema_slow = prices.ewm(span=slow_period, adjust=False).mean()
        
        # Calculate MACD line
        macd_line = ema_fast - ema_slow
        
        # Calculate signal line
        signal_line = macd_line.ewm(span=signal_period, adjust=False).mean()
        
        # Calculate histogram
        histogram = macd_line - signal_line
        
        return macd_line, signal_line, histogram
    
    def calculate_bollinger_bands(
        self, 
        prices: pd.Series, 
        period: int = 20,
        num_std: float = 2.0
    ) -> Tuple[pd.Series, pd.Series, pd.Series]:
        """
        Calculate Bollinger Bands.
        
        Bollinger Bands consist of a middle band (SMA) and two outer bands
        that are standard deviations away from the middle band.
        
        Formula:
        Middle Band = SMA(period)
        Upper Band = Middle Band + (num_std * std_dev)
        Lower Band = Middle Band - (num_std * std_dev)
        
        Args:
            prices: Series of closing prices
            period: Period for moving average (default: 20)
            num_std: Number of standard deviations (default: 2.0)
            
        Returns:
            Tuple of (upper_band, middle_band, lower_band)
        """
        # Calculate middle band (SMA)
        middle_band = prices.rolling(window=period).mean()
        
        # Calculate standard deviation
        std_dev = prices.rolling(window=period).std()
        
        # Calculate upper and lower bands
        upper_band = middle_band + (num_std * std_dev)
        lower_band = middle_band - (num_std * std_dev)
        
        return upper_band, middle_band, lower_band
    
    def calculate_stochastic(
        self, 
        high: pd.Series, 
        low: pd.Series, 
        close: pd.Series,
        period: int = 14,
        smooth_k: int = 3,
        smooth_d: int = 3
    ) -> Tuple[pd.Series, pd.Series]:
        """
        Calculate Stochastic Oscillator.
        
        The Stochastic Oscillator compares a closing price to its price range
        over a given time period. Values range from 0 to 100.
        
        Formula:
        %K = 100 * (Close - Lowest Low) / (Highest High - Lowest Low)
        %D = SMA(%K, smooth_d)
        
        Args:
            high: Series of high prices
            low: Series of low prices
            close: Series of closing prices
            period: Lookback period (default: 14)
            smooth_k: Smoothing period for %K (default: 3)
            smooth_d: Smoothing period for %D (default: 3)
            
        Returns:
            Tuple of (%K, %D)
        """
        # Calculate lowest low and highest high over period
        lowest_low = low.rolling(window=period).min()
        highest_high = high.rolling(window=period).max()
        
        # Calculate raw %K
        stoch_k_raw = 100 * (close - lowest_low) / (highest_high - lowest_low)
        
        # Smooth %K
        stoch_k = stoch_k_raw.rolling(window=smooth_k).mean()
        
        # Calculate %D (signal line)
        stoch_d = stoch_k.rolling(window=smooth_d).mean()
        
        return stoch_k, stoch_d
    
    def calculate_atr(
        self, 
        high: pd.Series, 
        low: pd.Series, 
        close: pd.Series,
        period: int = 14
    ) -> pd.Series:
        """
        Calculate Average True Range (ATR).
        
        ATR measures market volatility by decomposing the entire range of an asset
        price for that period. Higher ATR indicates higher volatility.
        
        Formula:
        True Range = max(high - low, abs(high - prev_close), abs(low - prev_close))
        ATR = EMA(True Range, period)
        
        Args:
            high: Series of high prices
            low: Series of low prices
            close: Series of closing prices
            period: Lookback period (default: 14)
            
        Returns:
            Series of ATR values
        """
        # Calculate previous close
        prev_close = close.shift(1)
        
        # Calculate three components of true range
        tr1 = high - low
        tr2 = (high - prev_close).abs()
        tr3 = (low - prev_close).abs()
        
        # True range is the maximum of the three
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        
        # Calculate ATR using Wilder's smoothing (EMA)
        atr = true_range.ewm(com=period - 1, min_periods=period, adjust=False).mean()
        
        return atr
