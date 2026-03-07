"""Model metadata schema for tracking model versions and performance."""
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional


@dataclass
class ModelMetadata:
    """Schema for model metadata and versioning."""
    
    model_id: str
    model_type: str  # "deepar", "lstm", "prophet", "xgboost"
    version: str
    
    # Training info
    training_date: datetime
    training_data_start: datetime
    training_data_end: datetime
    num_training_samples: int
    
    # Hyperparameters
    hyperparameters: Dict[str, Any]
    
    # Performance metrics
    validation_mape: float
    validation_coverage: float
    validation_interval_width: float
    
    # Artifacts
    model_s3_path: str
    scaler_s3_path: str
    
    # Status
    status: str  # "active", "deprecated", "testing"
    deployed_date: Optional[datetime] = None
