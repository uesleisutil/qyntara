"""
Missing Data Analyzer

This module analyzes missing data patterns in stock market data.
Calculates missing percentage per stock and identifies missing patterns.

**Validates: Requirements 11.4**
"""

import pandas as pd
import numpy as np
from typing import Dict, Tuple


class MissingDataAnalyzer:
    """
    Analyzer for missing data patterns in time series data.
    
    Provides functionality to:
    - Calculate missing data percentage per stock
    - Identify missing data patterns (random, consecutive, periodic)
    """
    
    def calculate_missing_percentage(self, data: pd.DataFrame) -> pd.Series:
        """
        Calculate the percentage of missing values for each column.
        
        Args:
            data: DataFrame containing stock data (columns are features/stocks)
            
        Returns:
            Series with missing percentage for each column (0-100)
        """
        # Calculate missing count per column
        missing_count = data.isna().sum()
        
        # Calculate total rows
        total_rows = len(data)
        
        # Calculate percentage
        if total_rows == 0:
            return pd.Series(dtype=float)
        
        missing_percentage = (missing_count / total_rows) * 100
        
        return missing_percentage
    
    def identify_missing_patterns(self, data: pd.DataFrame) -> Dict[str, str]:
        """
        Identify the pattern of missing data for each column.
        
        Patterns:
        - 'none': No missing data
        - 'random': Missing data appears randomly scattered
        - 'consecutive': Missing data appears in consecutive blocks
        - 'start': Missing data at the beginning
        - 'end': Missing data at the end
        - 'periodic': Missing data appears in periodic intervals
        
        Args:
            data: DataFrame containing stock data
            
        Returns:
            Dictionary mapping column names to pattern types
        """
        patterns = {}
        
        for col in data.columns:
            pattern = self._identify_column_pattern(data[col])
            patterns[col] = pattern
        
        return patterns
    
    def _identify_column_pattern(self, series: pd.Series) -> str:
        """
        Identify missing data pattern for a single column.
        
        Args:
            series: Pandas Series to analyze
            
        Returns:
            Pattern type as string
        """
        # Check if no missing data
        if not series.isna().any():
            return 'none'
        
        # Check if all missing
        if series.isna().all():
            return 'all_missing'
        
        # Get boolean mask of missing values
        is_missing = series.isna()
        
        # Check for missing at start
        if is_missing.iloc[:len(series)//4].all() and not is_missing.iloc[-1]:
            return 'start'
        
        # Check for missing at end
        if is_missing.iloc[-len(series)//4:].all() and not is_missing.iloc[0]:
            return 'end'
        
        # Check for consecutive blocks
        # Find runs of missing values
        missing_diff = is_missing.astype(int).diff()
        starts = (missing_diff == 1).sum()
        
        # If few starts but many missing values, likely consecutive
        missing_count = is_missing.sum()
        if starts > 0 and starts <= 2 and missing_count / starts >= 3:
            return 'consecutive'
        
        # Check for periodic pattern
        # If missing values are evenly spaced
        missing_indices = np.where(is_missing)[0]
        if len(missing_indices) > 2:
            gaps = np.diff(missing_indices)
            # If gaps have low variance and consistent spacing, likely periodic
            if len(gaps) > 0 and np.std(gaps) < 0.5 and np.mean(gaps) > 1:
                return 'periodic'
        
        # Default to random
        return 'random'
    
    def get_missing_summary(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Get comprehensive summary of missing data.
        
        Args:
            data: DataFrame containing stock data
            
        Returns:
            DataFrame with columns: column_name, missing_count, missing_percentage, pattern
        """
        missing_percentages = self.calculate_missing_percentage(data)
        missing_patterns = self.identify_missing_patterns(data)
        missing_counts = data.isna().sum()
        
        summary = pd.DataFrame({
            'column_name': data.columns,
            'missing_count': missing_counts.values,
            'missing_percentage': missing_percentages.values,
            'pattern': [missing_patterns[col] for col in data.columns]
        })
        
        return summary
    
    def get_stocks_by_missing_threshold(
        self, 
        data: pd.DataFrame, 
        threshold: float
    ) -> Tuple[list, list]:
        """
        Categorize stocks based on missing data threshold.
        
        Args:
            data: DataFrame where each column represents a stock
            threshold: Missing percentage threshold (0-100)
            
        Returns:
            Tuple of (stocks_below_threshold, stocks_above_threshold)
        """
        missing_percentages = self.calculate_missing_percentage(data)
        
        stocks_below = missing_percentages[missing_percentages <= threshold].index.tolist()
        stocks_above = missing_percentages[missing_percentages > threshold].index.tolist()
        
        return stocks_below, stocks_above
