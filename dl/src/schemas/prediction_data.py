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
    deepar_prediction: float
    lstm_prediction: float
    prophet_prediction: float
    transformer_prediction: float
    
    # Ensemble weights
    deepar_weight: float
    lstm_weight: float
    prophet_weight: float
    transformer_weight: float
    
    # Metadata
    model_version: str
    prediction_timestamp: datetime
