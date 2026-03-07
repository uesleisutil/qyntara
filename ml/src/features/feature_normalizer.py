"""
Feature Normalizer

This module implements robust feature normalization using median and IQR.
Robust scaling is less sensitive to outliers compared to standard scaling.

**Validates: Requirements 3.7**
"""

import pandas as pd
import numpy as np
import pickle
from typing import Optional


class FeatureNormalizer:
    """
    Feature normalizer using robust scaling.
    
    Robust scaling uses median and interquartile range (IQR) instead of
    mean and standard deviation, making it more resistant to outliers.
    
    Formula:
    scaled_value = (value - median) / IQR
    where IQR = Q3 - Q1 (75th percentile - 25th percentile)
    """
    
    def __init__(self):
        """Initialize the normalizer."""
        self.medians_: Optional[pd.Series] = None
        self.iqrs_: Optional[pd.Series] = None
        self.feature_names_: Optional[list] = None
        self.is_fitted_: bool = False
    
    def fit(self, features: pd.DataFrame) -> None:
        """
        Fit the normalizer to the feature data.
        
        Calculates and stores the median and IQR for each feature column.
        
        Args:
            features: DataFrame containing features to normalize
        """
        # Calculate median for each column
        self.medians_ = features.median()
        
        # Calculate IQR (Q3 - Q1) for each column
        q1 = features.quantile(0.25)
        q3 = features.quantile(0.75)
        self.iqrs_ = q3 - q1
        
        # Replace zero IQR with 1 to avoid division by zero
        # (happens when all values in a column are the same)
        self.iqrs_ = self.iqrs_.replace(0, 1)
        
        # Store feature names
        self.feature_names_ = features.columns.tolist()
        
        # Mark as fitted
        self.is_fitted_ = True
    
    def transform(self, features: pd.DataFrame) -> pd.DataFrame:
        """
        Transform features using the fitted parameters.
        
        Applies robust scaling: (value - median) / IQR
        
        Args:
            features: DataFrame containing features to transform
            
        Returns:
            DataFrame with normalized features
            
        Raises:
            ValueError: If normalizer has not been fitted
        """
        if not self.is_fitted_:
            raise ValueError("Normalizer must be fitted before transform. Call fit() first.")
        
        # Apply robust scaling
        normalized = (features - self.medians_) / self.iqrs_
        
        return normalized
    
    def inverse_transform(self, features: pd.DataFrame) -> pd.DataFrame:
        """
        Inverse transform normalized features back to original scale.
        
        Applies inverse robust scaling: value * IQR + median
        
        Args:
            features: DataFrame containing normalized features
            
        Returns:
            DataFrame with features in original scale
            
        Raises:
            ValueError: If normalizer has not been fitted
        """
        if not self.is_fitted_:
            raise ValueError("Normalizer must be fitted before inverse_transform. Call fit() first.")
        
        # Apply inverse scaling
        original = (features * self.iqrs_) + self.medians_
        
        return original
    
    def save_scaler(self, path: str) -> None:
        """
        Save the fitted scaler parameters to a file.
        
        Args:
            path: File path to save the scaler (e.g., 'scaler.pkl')
            
        Raises:
            ValueError: If normalizer has not been fitted
        """
        if not self.is_fitted_:
            raise ValueError("Normalizer must be fitted before saving. Call fit() first.")
        
        scaler_params = {
            'medians': self.medians_,
            'iqrs': self.iqrs_,
            'feature_names': self.feature_names_,
            'is_fitted': self.is_fitted_
        }
        
        with open(path, 'wb') as f:
            pickle.dump(scaler_params, f)
    
    def load_scaler(self, path: str) -> None:
        """
        Load fitted scaler parameters from a file.
        
        Args:
            path: File path to load the scaler from (e.g., 'scaler.pkl')
            
        Raises:
            FileNotFoundError: If the file does not exist
        """
        with open(path, 'rb') as f:
            scaler_params = pickle.load(f)
        
        self.medians_ = scaler_params['medians']
        self.iqrs_ = scaler_params['iqrs']
        self.feature_names_ = scaler_params['feature_names']
        self.is_fitted_ = scaler_params['is_fitted']
