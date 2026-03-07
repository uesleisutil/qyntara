"""
Isolation Forest Detector

This module implements multivariate outlier detection using Isolation Forest algorithm.
Isolation Forest isolates anomalies by randomly selecting features and split values.

**Validates: Requirements 6.1**
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Optional


class IsolationForestDetector:
    """
    Outlier detector using Isolation Forest algorithm.
    
    Isolation Forest is an unsupervised learning algorithm that isolates anomalies
    by randomly selecting a feature and then randomly selecting a split value
    between the maximum and minimum values of the selected feature.
    
    Anomalies are data points that have short average path lengths in the trees,
    as they are easier to isolate.
    """
    
    def __init__(self, contamination: float = 0.01, random_state: int = 42):
        """
        Initialize the Isolation Forest detector.
        
        Args:
            contamination: Expected proportion of outliers in the dataset (default: 0.01 = 1%)
            random_state: Random seed for reproducibility (default: 42)
        """
        self.contamination = contamination
        self.random_state = random_state
        self.model_: Optional[IsolationForest] = None
        self.is_fitted_: bool = False
    
    def fit(self, data: pd.DataFrame) -> None:
        """
        Fit the Isolation Forest model to the data.
        
        Trains the model to learn the normal data distribution so it can
        identify anomalies during detection.
        
        Args:
            data: DataFrame containing features for training
        """
        # Initialize Isolation Forest model
        self.model_ = IsolationForest(
            contamination=self.contamination,
            random_state=self.random_state,
            n_estimators=100,  # Number of trees
            max_samples='auto',  # Use all samples
            bootstrap=False,
            n_jobs=-1  # Use all CPU cores
        )
        
        # Fit the model
        self.model_.fit(data)
        
        # Mark as fitted
        self.is_fitted_ = True
    
    def detect(self, data: pd.DataFrame) -> np.ndarray:
        """
        Detect outliers in the data.
        
        Returns a boolean mask where True indicates an outlier.
        
        Args:
            data: DataFrame containing features to check for outliers
            
        Returns:
            Boolean numpy array where True indicates outlier
            
        Raises:
            ValueError: If detector has not been fitted
        """
        if not self.is_fitted_:
            raise ValueError("Detector must be fitted before detect. Call fit() first.")
        
        # Predict returns 1 for inliers and -1 for outliers
        predictions = self.model_.predict(data)
        
        # Convert to boolean mask (True for outliers)
        outlier_mask = predictions == -1
        
        return outlier_mask
    
    def get_anomaly_scores(self, data: pd.DataFrame) -> np.ndarray:
        """
        Get anomaly scores for each data point.
        
        The anomaly score is the negative of the average path length in the trees.
        Lower scores (more negative) indicate more anomalous points.
        
        Args:
            data: DataFrame containing features to score
            
        Returns:
            Numpy array of anomaly scores (lower = more anomalous)
            
        Raises:
            ValueError: If detector has not been fitted
        """
        if not self.is_fitted_:
            raise ValueError("Detector must be fitted before get_anomaly_scores. Call fit() first.")
        
        # Get anomaly scores (decision function)
        # Negative scores indicate outliers, positive scores indicate inliers
        anomaly_scores = self.model_.decision_function(data)
        
        return anomaly_scores
