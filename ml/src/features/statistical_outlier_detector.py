"""
Statistical Outlier Detector

This module implements univariate outlier detection using statistical methods:
- Z-score method (threshold 3.5)
- IQR (Interquartile Range) method

**Validates: Requirements 6.2**
"""

import pandas as pd
import numpy as np


class StatisticalOutlierDetector:
    """
    Statistical outlier detector using z-score and IQR methods.
    
    Implements two univariate outlier detection methods:
    1. Z-score: Flags points with |z-score| > threshold (default 3.5)
    2. IQR: Flags points outside [Q1 - multiplier*IQR, Q3 + multiplier*IQR]
    
    These methods work on individual features independently.
    """
    
    def detect_zscore(self, series: pd.Series, threshold: float = 3.5) -> np.ndarray:
        """
        Detect outliers using z-score method.
        
        Z-score measures how many standard deviations a point is from the mean.
        Points with |z-score| > threshold are flagged as outliers.
        
        Formula:
        z-score = (x - mean) / std
        outlier if |z-score| > threshold
        
        Args:
            series: Pandas Series containing data to check
            threshold: Z-score threshold for outlier detection (default: 3.5)
            
        Returns:
            Boolean numpy array where True indicates outlier
        """
        # Calculate mean and standard deviation
        mean = series.mean()
        std = series.std()
        
        # Handle case where std is 0 (all values are the same)
        if std == 0:
            # No outliers if all values are identical
            return np.zeros(len(series), dtype=bool)
        
        # Calculate z-scores
        z_scores = np.abs((series - mean) / std)
        
        # Flag outliers
        outliers = z_scores > threshold
        
        return outliers.values
    
    def detect_iqr(self, series: pd.Series, multiplier: float = 1.5) -> np.ndarray:
        """
        Detect outliers using IQR (Interquartile Range) method.
        
        IQR is the range between the 25th and 75th percentiles (Q3 - Q1).
        Points outside [Q1 - multiplier*IQR, Q3 + multiplier*IQR] are flagged.
        
        The standard multiplier is 1.5 for outliers and 3.0 for extreme outliers.
        
        Formula:
        IQR = Q3 - Q1
        lower_bound = Q1 - multiplier * IQR
        upper_bound = Q3 + multiplier * IQR
        outlier if x < lower_bound or x > upper_bound
        
        Args:
            series: Pandas Series containing data to check
            multiplier: IQR multiplier for bounds (default: 1.5)
            
        Returns:
            Boolean numpy array where True indicates outlier
        """
        # Calculate quartiles
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        
        # Calculate IQR
        iqr = q3 - q1
        
        # Handle case where IQR is 0 (all values in middle 50% are the same)
        if iqr == 0:
            # No outliers if IQR is 0
            return np.zeros(len(series), dtype=bool)
        
        # Calculate bounds
        lower_bound = q1 - multiplier * iqr
        upper_bound = q3 + multiplier * iqr
        
        # Flag outliers
        outliers = (series < lower_bound) | (series > upper_bound)
        
        return outliers.values
