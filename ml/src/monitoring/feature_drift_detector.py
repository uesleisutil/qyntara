"""
Feature Drift Detector

Detects feature distribution drift using Kolmogorov-Smirnov test.
Triggers drift alert when p-value is below 0.05.

Requirements: 7.4, 7.5
"""

from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from scipy import stats


class FeatureDriftDetector:
    """
    Detects feature distribution drift using Kolmogorov-Smirnov test.
    
    Compares reference (baseline) feature distributions against current distributions.
    Drift is detected when KS test p-value is below the significance threshold (0.05).
    """
    
    def __init__(self, alpha: float = 0.05):
        """
        Initialize the feature drift detector.
        
        Args:
            alpha: Significance level for KS test (default: 0.05)
        """
        self.alpha = alpha
    
    def ks_test(
        self,
        reference_data: np.ndarray,
        current_data: np.ndarray
    ) -> Tuple[float, float]:
        """
        Perform Kolmogorov-Smirnov test on two distributions.
        
        Args:
            reference_data: Reference (baseline) distribution
            current_data: Current distribution to compare
            
        Returns:
            Tuple of (ks_statistic, p_value)
        """
        # Remove NaN values
        reference_clean = reference_data[~np.isnan(reference_data)]
        current_clean = current_data[~np.isnan(current_data)]
        
        if len(reference_clean) == 0 or len(current_clean) == 0:
            raise ValueError("Cannot perform KS test on empty arrays")
        
        # Perform two-sample KS test
        ks_statistic, p_value = stats.ks_2samp(reference_clean, current_clean)
        
        return float(ks_statistic), float(p_value)
    
    def detect_drift_single_feature(
        self,
        reference_data: np.ndarray,
        current_data: np.ndarray,
        feature_name: str
    ) -> Dict[str, any]:
        """
        Detect drift for a single feature.
        
        Args:
            reference_data: Reference (baseline) feature values
            current_data: Current feature values
            feature_name: Name of the feature
            
        Returns:
            Dictionary containing:
            - feature_name: str
            - ks_statistic: float
            - p_value: float
            - drift_detected: bool
            - alpha: float
        """
        # Perform KS test
        ks_statistic, p_value = self.ks_test(reference_data, current_data)
        
        # Detect drift if p-value is below alpha
        drift_detected = p_value < self.alpha
        
        return {
            'feature_name': feature_name,
            'ks_statistic': ks_statistic,
            'p_value': p_value,
            'drift_detected': drift_detected,
            'alpha': self.alpha
        }
    
    def detect_drift(
        self,
        reference_data: pd.DataFrame,
        current_data: pd.DataFrame,
        feature_columns: Optional[List[str]] = None
    ) -> Dict[str, Dict[str, any]]:
        """
        Detect drift for multiple features.
        
        Args:
            reference_data: Reference (baseline) DataFrame
            current_data: Current DataFrame
            feature_columns: List of feature columns to test (default: all common columns)
            
        Returns:
            Dictionary mapping feature names to drift detection results
        """
        # Determine features to test
        if feature_columns is None:
            # Use all common columns
            feature_columns = list(
                set(reference_data.columns) & set(current_data.columns)
            )
        
        results = {}
        
        # Test each feature
        for feature in feature_columns:
            try:
                result = self.detect_drift_single_feature(
                    reference_data[feature].values,
                    current_data[feature].values,
                    feature
                )
                results[feature] = result
            except (ValueError, KeyError) as e:
                # Skip features that cannot be tested
                results[feature] = {
                    'feature_name': feature,
                    'ks_statistic': None,
                    'p_value': None,
                    'drift_detected': False,
                    'alpha': self.alpha,
                    'error': str(e)
                }
        
        return results
    
    def get_drifted_features(
        self,
        drift_results: Dict[str, Dict[str, any]]
    ) -> List[str]:
        """
        Get list of features with detected drift.
        
        Args:
            drift_results: Results from detect_drift method
            
        Returns:
            List of feature names with drift detected
        """
        drifted_features = [
            feature_name
            for feature_name, result in drift_results.items()
            if result.get('drift_detected', False)
        ]
        
        return drifted_features
    
    def summarize_drift(
        self,
        drift_results: Dict[str, Dict[str, any]]
    ) -> Dict[str, any]:
        """
        Summarize drift detection results.
        
        Args:
            drift_results: Results from detect_drift method
            
        Returns:
            Dictionary containing:
            - total_features: int
            - drifted_features_count: int
            - drifted_features: List[str]
            - drift_percentage: float
        """
        total_features = len(drift_results)
        drifted_features = self.get_drifted_features(drift_results)
        drifted_features_count = len(drifted_features)
        
        drift_percentage = (
            drifted_features_count / total_features * 100
            if total_features > 0 else 0.0
        )
        
        return {
            'total_features': total_features,
            'drifted_features_count': drifted_features_count,
            'drifted_features': drifted_features,
            'drift_percentage': drift_percentage,
            'alpha': self.alpha
        }
    
    def detect_drift_with_summary(
        self,
        reference_data: pd.DataFrame,
        current_data: pd.DataFrame,
        feature_columns: Optional[List[str]] = None
    ) -> Tuple[Dict[str, Dict[str, any]], Dict[str, any]]:
        """
        Detect drift and return both detailed results and summary.
        
        Args:
            reference_data: Reference (baseline) DataFrame
            current_data: Current DataFrame
            feature_columns: List of feature columns to test
            
        Returns:
            Tuple of (drift_results, summary)
        """
        drift_results = self.detect_drift(
            reference_data, current_data, feature_columns
        )
        
        summary = self.summarize_drift(drift_results)
        
        return drift_results, summary
