"""Feature data schema for model inputs."""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class FeatureData:
    """Schema for engineered features used in model training and prediction."""
    
    stock_symbol: str
    date: datetime
    
    # Price features
    close: float
    open: float
    high: float
    low: float
    volume: float
    
    # Technical indicators
    rsi_14: float
    macd: float
    macd_signal: float
    macd_hist: float
    bb_upper: float
    bb_middle: float
    bb_lower: float
    stochastic: float
    atr: float
    
    # Rolling statistics (5, 10, 20, 60 days)
    rolling_mean_5: float
    rolling_mean_10: float
    rolling_mean_20: float
    rolling_mean_60: float
    rolling_std_5: float
    rolling_std_10: float
    rolling_std_20: float
    rolling_std_60: float
    rolling_min_20: float
    rolling_max_20: float
    
    # Lag features
    lag_1: float
    lag_2: float
    lag_3: float
    lag_5: float
    lag_10: float
    
    # Volatility
    ewm_volatility: float
    
    # Volume features
    volume_ratio: float
    obv: float
    vwap: float
    
    # Normalized versions
    close_normalized: Optional[float] = None
    volume_normalized: Optional[float] = None
