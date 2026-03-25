"""
Outlier Treatment Module

This module implements outlier treatment methods:
- Winsorization at 1st and 99th percentiles for training data
- Interpolation for prediction inputs
- Audit logging of all treatments

**Validates: Requirements 6.3, 6.4, 6.5**
"""

import pandas as pd
import numpy as np
import json
from datetime import datetime
from typing import Optional, Dict, List


class OutlierTreatment:
    """
    Outlier treatment using winsorization and interpolation.
    
    Implements two treatment strategies:
    1. Winsorization: Caps outliers at percentile thresholds (for training data)
    2. Interpolation: Replaces outliers with interpolated values (for prediction inputs)
    
    All treatments are logged for audit purposes.
    """
    
    def winsorize(
        self, 
        series: pd.Series, 
        lower_percentile: float = 0.01, 
        upper_percentile: float = 0.99
    ) -> pd.Series:
        """
        Apply winsorization to cap outliers at specified percentiles.
        
        Winsorization replaces extreme values with the values at the specified
        percentiles. This is useful for training data to reduce the impact of
        outliers without removing data points.
        
        Formula:
        - Values below lower_percentile are set to lower_percentile value
        - Values above upper_percentile are set to upper_percentile value
        
        Args:
            series: Pandas Series containing data to winsorize
            lower_percentile: Lower percentile threshold (default: 0.01 = 1st percentile)
            upper_percentile: Upper percentile threshold (default: 0.99 = 99th percentile)
            
        Returns:
            Winsorized series with outliers capped at percentile values
        """
        # Calculate percentile values
        lower_value = series.quantile(lower_percentile)
        upper_value = series.quantile(upper_percentile)
        
        # Apply winsorization
        winsorized = series.clip(lower=lower_value, upper=upper_value)
        
        return winsorized
    
    def interpolate(
        self, 
        series: pd.Series, 
        method: str = 'linear'
    ) -> pd.Series:
        """
        Interpolate values in the series.
        
        This method is used for prediction inputs to avoid data loss.
        It replaces outliers (marked as NaN) with interpolated values.
        
        Args:
            series: Pandas Series containing data with NaN values to interpolate
            method: Interpolation method ('linear', 'polynomial', 'spline', etc.)
                   Default: 'linear'
            
        Returns:
            Series with NaN values replaced by interpolated values
        """
        # Interpolate NaN values
        interpolated = series.interpolate(method=method, limit_direction='both')
        
        # Fill any remaining NaN at edges with forward/backward fill
        interpolated = interpolated.ffill().bfill()
        
        return interpolated
    
    def log_outliers(
        self, 
        outliers: pd.DataFrame, 
        log_path: str
    ) -> None:
        """
        Log outlier detections and treatments to a file.
        
        Creates an audit log with timestamp, stock, feature, original value,
        and treated value for each outlier.
        
        Args:
            outliers: DataFrame with columns:
                     - timestamp: When the outlier was detected
                     - stock: Stock symbol
                     - feature: Feature name
                     - original_value: Original outlier value
                     - treated_value: Value after treatment
                     - treatment_method: Method used (winsorize/interpolate)
            log_path: Path to save the log file (JSON format)
        """
        # Convert DataFrame to list of dictionaries
        log_entries = outliers.to_dict('records')
        
        # Add logging metadata
        log_data = {
            'log_created_at': datetime.now().isoformat(),
            'total_outliers': len(log_entries),
            'entries': log_entries
        }
        
        # Write to JSON file
        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2, default=str)
    
    def treat_outliers_for_training(
        self,
        data: pd.DataFrame,
        outlier_mask: pd.DataFrame,
        stock_symbol: str,
        lower_percentile: float = 0.01,
        upper_percentile: float = 0.99
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        """
        Treat outliers in training data using winsorization.
        
        Args:
            data: DataFrame containing features
            outlier_mask: Boolean DataFrame indicating outliers (True = outlier)
            stock_symbol: Stock symbol for logging
            lower_percentile: Lower percentile for winsorization
            upper_percentile: Upper percentile for winsorization
            
        Returns:
            Tuple of (treated_data, audit_log_df)
        """
        treated_data = data.copy()
        audit_entries = []
        
        # Process each column
        for col in data.columns:
            if col in outlier_mask.columns:
                # Get outlier indices for this column
                outlier_indices = outlier_mask[col][outlier_mask[col]].index
                
                if len(outlier_indices) > 0:
                    # Winsorize the entire column
                    treated_column = self.winsorize(
                        data[col], 
                        lower_percentile=lower_percentile,
                        upper_percentile=upper_percentile
                    )
                    
                    # Log each outlier treatment
                    for idx in outlier_indices:
                        audit_entries.append({
                            'timestamp': datetime.now().isoformat(),
                            'stock': stock_symbol,
                            'feature': col,
                            'original_value': float(data.loc[idx, col]),
                            'treated_value': float(treated_column.loc[idx]),
                            'treatment_method': 'winsorize',
                            'lower_percentile': lower_percentile,
                            'upper_percentile': upper_percentile
                        })
                    
                    # Update treated data
                    treated_data[col] = treated_column
        
        # Create audit log DataFrame
        audit_log = pd.DataFrame(audit_entries)
        
        return treated_data, audit_log
    
    def treat_outliers_for_prediction(
        self,
        data: pd.DataFrame,
        outlier_mask: pd.DataFrame,
        stock_symbol: str,
        method: str = 'linear'
    ) -> tuple[pd.DataFrame, pd.DataFrame]:
        """
        Treat outliers in prediction input using interpolation.
        
        Args:
            data: DataFrame containing features
            outlier_mask: Boolean DataFrame indicating outliers (True = outlier)
            stock_symbol: Stock symbol for logging
            method: Interpolation method
            
        Returns:
            Tuple of (treated_data, audit_log_df)
        """
        treated_data = data.copy()
        audit_entries = []
        
        # Process each column
        for col in data.columns:
            if col in outlier_mask.columns:
                # Get outlier indices for this column
                outlier_indices = outlier_mask[col][outlier_mask[col]].index
                
                if len(outlier_indices) > 0:
                    # Mark outliers as NaN for interpolation
                    column_with_nan = data[col].copy()
                    column_with_nan.loc[outlier_indices] = np.nan
                    
                    # Interpolate
                    treated_column = self.interpolate(column_with_nan, method=method)
                    
                    # Log each outlier treatment
                    for idx in outlier_indices:
                        audit_entries.append({
                            'timestamp': datetime.now().isoformat(),
                            'stock': stock_symbol,
                            'feature': col,
                            'original_value': float(data.loc[idx, col]),
                            'treated_value': float(treated_column.loc[idx]),
                            'treatment_method': 'interpolate',
                            'interpolation_method': method
                        })
                    
                    # Update treated data
                    treated_data[col] = treated_column
        
        # Create audit log DataFrame
        audit_log = pd.DataFrame(audit_entries)
        
        return treated_data, audit_log
