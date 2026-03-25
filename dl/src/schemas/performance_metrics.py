"""Performance metrics schema for monitoring."""
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional


@dataclass
class PerformanceMetrics:
    """Schema for model performance metrics."""
    
    metric_date: datetime
    stock_symbol: Optional[str]  # None for overall metrics
    
    # Accuracy metrics
    mape: float
    mae: float
    rmse: float
    
    # Interval metrics
    coverage: float
    avg_interval_width: float
    interval_width_percentage: float
    
    # Per-model metrics
    model_metrics: Dict[str, Dict[str, float]]
    
    # Ranking
    rank: Optional[int] = None
    rank_change: Optional[int] = None
