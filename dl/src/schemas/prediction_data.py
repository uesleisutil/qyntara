"""Prediction data schema for model outputs."""
from dataclasses import dataclass
from datetime import datetime


@dataclass
class PredictionData:
    """Schema for ensemble model predictions."""
    
    stock_symbol: str
    prediction_date: datetime
    forecast_horizon: int  # Days ahead
    
    # Ensemble predictions
    point_forecast: float
    lower_bound_95: float
    upper_bound_95: float
    
    # Individual model predictions
    transformer_bilstm_prediction: float
    tab_transformer_prediction: float
    ft_transformer_prediction: float
    
    # Ensemble weights
    transformer_bilstm_weight: float
    tab_transformer_weight: float
    ft_transformer_weight: float
    
    # Metadata
    model_version: str
    prediction_timestamp: datetime
