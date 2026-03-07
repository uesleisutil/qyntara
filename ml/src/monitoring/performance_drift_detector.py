"""
Performance Drift Detector

Detects performance drift by comparing current MAPE against baseline using a 30-day rolling window.
Triggers drift alert when MAPE increases by more than 20% relative to baseline.

Requirements: 7.2, 7.3
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import numpy as np
import pandas as pd


class PerformanceDriftDetector:
    """
    Detects performance drift by comparing current MAPE against baseline.
    
    Uses a 30-day rolling window to calculate baseline MAPE and compares it
    against current MAPE. Drift is detected when MAPE increases by more than 20%.
    """
    
    def __init__(self, window_days: int = 30, drift_threshold: float = 0.20):
        """
        Initialize the performance drift detector.
        
        Args:
            window_days: Number of days for rolling window baseline (default: 30)
            drift_threshold: Threshold for drift detection as percentage increase (default: 0.20 = 20%)
        """
        self.window_days = window_days
        self.drift_threshold = drift_threshold
    
    def calculate_baseline_mape(
        self,
        historical_mape: pd.Series,
        current_date: datetime
    ) -> float:
        """
        Calculate baseline MAPE using 30-day rolling window.
        
        Args:
            historical_mape: Series with datetime index and MAPE values
            current_date: Current date for which to calculate baseline
            
        Returns:
            Baseline MAPE as mean of rolling window
            
        Raises:
            ValueError: If insufficient data for baseline calculation
        """
        # Calculate start date for rolling window
        start_date = current_date - timedelta(days=self.window_days)
        
        # Filter data within rolling window
        window_data = historical_mape[
            (historical_mape.index >= start_date) & 
            (historical_mape.index < current_date)
        ]
        
        if len(window_data) == 0:
            raise ValueError(
                f"Insufficient data for baseline calculation. "
                f"Need data between {start_date} and {current_date}"
            )
        
        # Calculate mean MAPE as baseline
        baseline_mape = window_data.mean()
        
        return float(baseline_mape)
    
    def detect_drift(
        self,
        current_mape: float,
        baseline_mape: float
    ) -> Tuple[bool, float]:
        """
        Detect performance drift by comparing current MAPE against baseline.
        
        Args:
            current_mape: Current MAPE value
            baseline_mape: Baseline MAPE from rolling window
            
        Returns:
            Tuple of (drift_detected, mape_change_percentage)
            - drift_detected: True if MAPE increase exceeds threshold
            - mape_change_percentage: Percentage change in MAPE
        """
        # Calculate percentage change
        if baseline_mape == 0:
            # Handle edge case where baseline is zero
            mape_change_percentage = float('inf') if current_mape > 0 else 0.0
        else:
            mape_change_percentage = (current_mape - baseline_mape) / baseline_mape
        
        # Detect drift if increase exceeds threshold
        drift_detected = mape_change_percentage > self.drift_threshold
        
        return drift_detected, mape_change_percentage
    
    def detect_drift_from_history(
        self,
        historical_mape: pd.Series,
        current_date: datetime,
        current_mape: float
    ) -> Dict[str, any]:
        """
        Detect drift using historical MAPE data.
        
        Args:
            historical_mape: Series with datetime index and MAPE values
            current_date: Current date for drift detection
            current_mape: Current MAPE value to compare
            
        Returns:
            Dictionary containing:
            - drift_detected: bool
            - current_mape: float
            - baseline_mape: float
            - mape_change_percentage: float
            - detection_date: datetime
        """
        # Calculate baseline
        baseline_mape = self.calculate_baseline_mape(historical_mape, current_date)
        
        # Detect drift
        drift_detected, mape_change_percentage = self.detect_drift(
            current_mape, baseline_mape
        )
        
        return {
            'drift_detected': drift_detected,
            'current_mape': current_mape,
            'baseline_mape': baseline_mape,
            'mape_change_percentage': mape_change_percentage,
            'detection_date': current_date,
            'window_days': self.window_days,
            'drift_threshold': self.drift_threshold
        }
    
    def detect_drift_batch(
        self,
        mape_data: pd.DataFrame,
        date_column: str = 'date',
        mape_column: str = 'mape'
    ) -> pd.DataFrame:
        """
        Detect drift for multiple dates in batch.
        
        Args:
            mape_data: DataFrame with date and MAPE columns
            date_column: Name of date column
            mape_column: Name of MAPE column
            
        Returns:
            DataFrame with drift detection results for each date
        """
        # Ensure date column is datetime
        mape_data = mape_data.copy()
        mape_data[date_column] = pd.to_datetime(mape_data[date_column])
        
        # Sort by date
        mape_data = mape_data.sort_values(date_column)
        
        # Create series for rolling calculation
        mape_series = mape_data.set_index(date_column)[mape_column]
        
        results = []
        
        # Process each date
        for date, current_mape in mape_series.items():
            try:
                result = self.detect_drift_from_history(
                    mape_series,
                    date,
                    current_mape
                )
                results.append(result)
            except ValueError:
                # Skip dates with insufficient history
                continue
        
        return pd.DataFrame(results)
