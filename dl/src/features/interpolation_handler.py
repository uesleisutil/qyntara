"""
Interpolation Handler

This module handles missing data interpolation based on missing percentage:
- Forward fill for < 5% missing data
- Linear interpolation for 5-20% missing data
- Exclusion logic for > 20% missing data

**Validates: Requirements 11.1, 11.2, 11.3**
"""

import pandas as pd
import numpy as np
from typing import Tuple, List
import logging


class InterpolationHandler:
    """
    Handler for missing data interpolation with strategy selection.
    
    Implements three strategies based on missing data percentage:
    1. Forward fill: < 5% missing
    2. Linear interpolation: 5-20% missing
    3. Exclusion: > 20% missing
    """
    
    def __init__(self, logger: logging.Logger = None):
        """
        Initialize the interpolation handler.
        
        Args:
            logger: Optional logger instance for logging operations
        """
        self.logger = logger or logging.getLogger(__name__)
    
    def forward_fill(self, series: pd.Series) -> pd.Series:
        """
        Apply forward fill interpolation.
        
        Forward fill propagates the last valid observation forward to fill gaps.
        This is appropriate for small amounts of missing data where the most
        recent value is a reasonable estimate.
        
        Args:
            series: Pandas Series with missing values
            
        Returns:
            Series with missing values filled using forward fill
        """
        # Forward fill
        filled = series.ffill()
        
        # If there are still NaN at the beginning, use backward fill
        filled = filled.bfill()
        
        return filled
    
    def linear_interpolate(self, series: pd.Series) -> pd.Series:
        """
        Apply linear interpolation.
        
        Linear interpolation estimates missing values by drawing a straight line
        between known values. This is appropriate for moderate amounts of missing
        data where a linear trend can be assumed.
        
        Args:
            series: Pandas Series with missing values
            
        Returns:
            Series with missing values filled using linear interpolation
        """
        # Linear interpolation
        interpolated = series.interpolate(method='linear', limit_direction='both')
        
        # Fill any remaining NaN at edges with forward/backward fill
        interpolated = interpolated.ffill().bfill()
        
        return interpolated
    
    def spline_interpolate(self, series: pd.Series, order: int = 3) -> pd.Series:
        """
        Apply spline interpolation.
        
        Spline interpolation uses polynomial functions to estimate missing values.
        This provides smoother interpolation than linear for time series data.
        
        Args:
            series: Pandas Series with missing values
            order: Order of the spline (default: 3 for cubic spline)
            
        Returns:
            Series with missing values filled using spline interpolation
        """
        # Need at least order+1 non-NaN values for spline interpolation
        non_nan_count = series.notna().sum()
        
        if non_nan_count < order + 1:
            # Fall back to linear interpolation
            return self.linear_interpolate(series)
        
        try:
            # Spline interpolation
            interpolated = series.interpolate(method='spline', order=order, limit_direction='both')
            
            # Fill any remaining NaN at edges
            interpolated = interpolated.ffill().bfill()
            
            return interpolated
        except Exception as e:
            # If spline fails, fall back to linear
            self.logger.warning(f"Spline interpolation failed, using linear: {e}")
            return self.linear_interpolate(series)
    
    def handle_missing_data(
        self, 
        data: pd.DataFrame,
        missing_percentages: pd.Series
    ) -> Tuple[pd.DataFrame, List[str], pd.DataFrame]:
        """
        Handle missing data based on percentage thresholds.
        
        Strategy:
        - < 5% missing: Forward fill
        - 5-20% missing: Linear interpolation
        - > 20% missing: Exclude column
        
        Args:
            data: DataFrame with missing values
            missing_percentages: Series with missing percentage per column
            
        Returns:
            Tuple of:
            - Treated DataFrame (excluded columns removed)
            - List of excluded column names
            - Treatment log DataFrame
        """
        treated_data = data.copy()
        excluded_columns = []
        treatment_log = []
        
        for col in data.columns:
            missing_pct = missing_percentages[col]
            
            if missing_pct > 20.0:
                # Exclude column
                excluded_columns.append(col)
                treatment_log.append({
                    'column': col,
                    'missing_percentage': missing_pct,
                    'strategy': 'exclude',
                    'reason': 'missing_percentage > 20%'
                })
                self.logger.info(f"Excluding column '{col}' with {missing_pct:.2f}% missing data")
                
            elif missing_pct >= 5.0:
                # Linear interpolation
                treated_data[col] = self.linear_interpolate(data[col])
                treatment_log.append({
                    'column': col,
                    'missing_percentage': missing_pct,
                    'strategy': 'linear_interpolation',
                    'reason': '5% <= missing_percentage <= 20%'
                })
                self.logger.info(f"Applied linear interpolation to column '{col}' with {missing_pct:.2f}% missing data")
                
            elif missing_pct > 0.0:
                # Forward fill
                treated_data[col] = self.forward_fill(data[col])
                treatment_log.append({
                    'column': col,
                    'missing_percentage': missing_pct,
                    'strategy': 'forward_fill',
                    'reason': 'missing_percentage < 5%'
                })
                self.logger.info(f"Applied forward fill to column '{col}' with {missing_pct:.2f}% missing data")
            
            else:
                # No missing data
                treatment_log.append({
                    'column': col,
                    'missing_percentage': 0.0,
                    'strategy': 'none',
                    'reason': 'no_missing_data'
                })
        
        # Remove excluded columns
        if excluded_columns:
            treated_data = treated_data.drop(columns=excluded_columns)
        
        # Create treatment log DataFrame
        log_df = pd.DataFrame(treatment_log)
        
        return treated_data, excluded_columns, log_df
    
    def handle_stock_data(
        self,
        stock_data: pd.DataFrame,
        stock_symbol: str
    ) -> Tuple[pd.DataFrame, bool, str, float]:
        """
        Handle missing data for a single stock's time series.
        
        This is a convenience method for processing individual stock data
        where the DataFrame represents features over time for one stock.
        
        Args:
            stock_data: DataFrame with time series data for one stock
            stock_symbol: Stock symbol for logging
            
        Returns:
            Tuple of:
            - Treated DataFrame
            - Boolean indicating if stock should be excluded
            - Treatment strategy used
            - Missing percentage
        """
        # Calculate overall missing percentage for the stock
        total_values = stock_data.size
        missing_values = stock_data.isna().sum().sum()
        missing_pct = (missing_values / total_values * 100) if total_values > 0 else 0.0
        
        # Determine strategy
        if missing_pct > 20.0:
            self.logger.warning(
                f"Stock {stock_symbol} has {missing_pct:.2f}% missing data - EXCLUDING"
            )
            return stock_data, True, 'exclude', missing_pct
        
        elif missing_pct >= 5.0:
            # Apply linear interpolation to all columns
            treated_data = stock_data.copy()
            for col in stock_data.columns:
                if stock_data[col].isna().any():
                    treated_data[col] = self.linear_interpolate(stock_data[col])
            
            self.logger.info(
                f"Stock {stock_symbol} has {missing_pct:.2f}% missing data - LINEAR INTERPOLATION"
            )
            return treated_data, False, 'linear_interpolation', missing_pct
        
        elif missing_pct > 0.0:
            # Apply forward fill to all columns
            treated_data = stock_data.copy()
            for col in stock_data.columns:
                if stock_data[col].isna().any():
                    treated_data[col] = self.forward_fill(stock_data[col])
            
            self.logger.info(
                f"Stock {stock_symbol} has {missing_pct:.2f}% missing data - FORWARD FILL"
            )
            return treated_data, False, 'forward_fill', missing_pct
        
        else:
            self.logger.info(f"Stock {stock_symbol} has no missing data")
            return stock_data, False, 'none', 0.0
    
    def get_strategy_for_percentage(self, missing_percentage: float) -> str:
        """
        Get the interpolation strategy for a given missing percentage.
        
        Args:
            missing_percentage: Missing data percentage (0-100)
            
        Returns:
            Strategy name: 'forward_fill', 'linear_interpolation', or 'exclude'
        """
        if missing_percentage > 20.0:
            return 'exclude'
        elif missing_percentage >= 5.0:
            return 'linear_interpolation'
        elif missing_percentage > 0.0:
            return 'forward_fill'
        else:
            return 'none'
