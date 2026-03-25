"""
Metrics Calculator

Calculates performance metrics including MAPE, MAE, RMSE, coverage, and interval width.
Supports per-stock, per-sector, and overall aggregation.

Requirements: 1.3, 2.2, 7.1, 10.3, 13.2
"""

from typing import Dict, List, Optional, Tuple
import numpy as np
import pandas as pd


class MetricsCalculator:
    """
    Calculates performance metrics for model evaluation.
    
    Supports:
    - MAPE (Mean Absolute Percentage Error)
    - MAE (Mean Absolute Error)
    - RMSE (Root Mean Squared Error)
    - Coverage (percentage of actuals within prediction intervals)
    - Interval Width (average width of prediction intervals)
    """
    
    def calculate_mape(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        epsilon: float = 1e-10
    ) -> float:
        """
        Calculate Mean Absolute Percentage Error.
        
        Args:
            y_true: Actual values
            y_pred: Predicted values
            epsilon: Small value to avoid division by zero
            
        Returns:
            MAPE as percentage (0-100)
        """
        # Remove NaN values
        mask = ~(np.isnan(y_true) | np.isnan(y_pred))
        y_true_clean = y_true[mask]
        y_pred_clean = y_pred[mask]
        
        if len(y_true_clean) == 0:
            return np.nan
        
        # Calculate MAPE
        mape = np.mean(
            np.abs((y_true_clean - y_pred_clean) / (y_true_clean + epsilon))
        ) * 100
        
        return float(mape)
    
    def calculate_mae(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray
    ) -> float:
        """
        Calculate Mean Absolute Error.
        
        Args:
            y_true: Actual values
            y_pred: Predicted values
            
        Returns:
            MAE value
        """
        # Remove NaN values
        mask = ~(np.isnan(y_true) | np.isnan(y_pred))
        y_true_clean = y_true[mask]
        y_pred_clean = y_pred[mask]
        
        if len(y_true_clean) == 0:
            return np.nan
        
        mae = np.mean(np.abs(y_true_clean - y_pred_clean))
        
        return float(mae)
    
    def calculate_rmse(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray
    ) -> float:
        """
        Calculate Root Mean Squared Error.
        
        Args:
            y_true: Actual values
            y_pred: Predicted values
            
        Returns:
            RMSE value
        """
        # Remove NaN values
        mask = ~(np.isnan(y_true) | np.isnan(y_pred))
        y_true_clean = y_true[mask]
        y_pred_clean = y_pred[mask]
        
        if len(y_true_clean) == 0:
            return np.nan
        
        rmse = np.sqrt(np.mean((y_true_clean - y_pred_clean) ** 2))
        
        return float(rmse)
    
    def calculate_coverage(
        self,
        y_true: np.ndarray,
        lower: np.ndarray,
        upper: np.ndarray
    ) -> float:
        """
        Calculate coverage (percentage of actuals within prediction intervals).
        
        Args:
            y_true: Actual values
            lower: Lower bounds of prediction intervals
            upper: Upper bounds of prediction intervals
            
        Returns:
            Coverage as percentage (0-100)
        """
        # Remove NaN values
        mask = ~(np.isnan(y_true) | np.isnan(lower) | np.isnan(upper))
        y_true_clean = y_true[mask]
        lower_clean = lower[mask]
        upper_clean = upper[mask]
        
        if len(y_true_clean) == 0:
            return np.nan
        
        # Check if actual values are within intervals
        within_interval = (y_true_clean >= lower_clean) & (y_true_clean <= upper_clean)
        
        coverage = np.mean(within_interval) * 100
        
        return float(coverage)
    
    def calculate_interval_width(
        self,
        lower: np.ndarray,
        upper: np.ndarray,
        y_pred: Optional[np.ndarray] = None,
        relative: bool = True
    ) -> float:
        """
        Calculate average interval width.
        
        Args:
            lower: Lower bounds of prediction intervals
            upper: Upper bounds of prediction intervals
            y_pred: Predicted values (for relative width calculation)
            relative: If True, return width as percentage of predicted value
            
        Returns:
            Average interval width (absolute or relative percentage)
        """
        # Remove NaN values
        if y_pred is not None:
            mask = ~(np.isnan(lower) | np.isnan(upper) | np.isnan(y_pred))
            lower_clean = lower[mask]
            upper_clean = upper[mask]
            y_pred_clean = y_pred[mask]
        else:
            mask = ~(np.isnan(lower) | np.isnan(upper))
            lower_clean = lower[mask]
            upper_clean = upper[mask]
            y_pred_clean = None
        
        if len(lower_clean) == 0:
            return np.nan
        
        # Calculate absolute width
        width = upper_clean - lower_clean
        
        if relative and y_pred_clean is not None:
            # Calculate relative width as percentage of predicted value
            epsilon = 1e-10
            relative_width = (width / (y_pred_clean + epsilon)) * 100
            return float(np.mean(relative_width))
        else:
            # Return absolute width
            return float(np.mean(width))
    
    def calculate_all_metrics(
        self,
        y_true: np.ndarray,
        y_pred: np.ndarray,
        lower: Optional[np.ndarray] = None,
        upper: Optional[np.ndarray] = None
    ) -> Dict[str, float]:
        """
        Calculate all metrics at once.
        
        Args:
            y_true: Actual values
            y_pred: Predicted values
            lower: Optional lower bounds of prediction intervals
            upper: Optional upper bounds of prediction intervals
            
        Returns:
            Dictionary with all metrics
        """
        metrics = {
            'mape': self.calculate_mape(y_true, y_pred),
            'mae': self.calculate_mae(y_true, y_pred),
            'rmse': self.calculate_rmse(y_true, y_pred)
        }
        
        if lower is not None and upper is not None:
            metrics['coverage'] = self.calculate_coverage(y_true, lower, upper)
            metrics['interval_width'] = self.calculate_interval_width(
                lower, upper, y_pred, relative=True
            )
            metrics['interval_width_absolute'] = self.calculate_interval_width(
                lower, upper, y_pred, relative=False
            )
        
        return metrics
    
    def calculate_per_stock_metrics(
        self,
        predictions: pd.DataFrame,
        actuals: pd.DataFrame,
        stock_column: str = 'symbol',
        date_column: str = 'date',
        pred_column: str = 'prediction',
        actual_column: str = 'actual',
        lower_column: Optional[str] = 'lower_bound',
        upper_column: Optional[str] = 'upper_bound'
    ) -> pd.DataFrame:
        """
        Calculate metrics for each stock.
        
        Args:
            predictions: DataFrame with predictions
            actuals: DataFrame with actual values
            stock_column: Name of stock symbol column
            date_column: Name of date column
            pred_column: Name of prediction column
            actual_column: Name of actual value column
            lower_column: Name of lower bound column (optional)
            upper_column: Name of upper bound column (optional)
            
        Returns:
            DataFrame with metrics per stock
        """
        # Merge predictions and actuals
        merged = pd.merge(
            predictions,
            actuals,
            on=[stock_column, date_column],
            how='inner',
            suffixes=('_pred', '_actual')
        )
        
        # Calculate metrics for each stock
        results = []
        
        for stock in merged[stock_column].unique():
            stock_data = merged[merged[stock_column] == stock]
            
            y_true = stock_data[actual_column].values
            y_pred = stock_data[pred_column].values
            
            lower = stock_data[lower_column].values if lower_column in stock_data.columns else None
            upper = stock_data[upper_column].values if upper_column in stock_data.columns else None
            
            metrics = self.calculate_all_metrics(y_true, y_pred, lower, upper)
            metrics[stock_column] = stock
            metrics['num_predictions'] = len(stock_data)
            
            results.append(metrics)
        
        return pd.DataFrame(results)
    
    def calculate_per_sector_metrics(
        self,
        per_stock_metrics: pd.DataFrame,
        stock_sector_mapping: Dict[str, str],
        stock_column: str = 'symbol'
    ) -> pd.DataFrame:
        """
        Calculate metrics aggregated by sector.
        
        Args:
            per_stock_metrics: DataFrame with per-stock metrics
            stock_sector_mapping: Dict mapping stock symbols to sectors
            stock_column: Name of stock symbol column
            
        Returns:
            DataFrame with metrics per sector
        """
        # Add sector column
        metrics_with_sector = per_stock_metrics.copy()
        metrics_with_sector['sector'] = metrics_with_sector[stock_column].map(
            stock_sector_mapping
        )
        
        # Group by sector and calculate mean
        sector_metrics = metrics_with_sector.groupby('sector').agg({
            'mape': 'mean',
            'mae': 'mean',
            'rmse': 'mean',
            'coverage': 'mean',
            'interval_width': 'mean',
            'num_predictions': 'sum'
        }).reset_index()
        
        return sector_metrics
    
    def calculate_overall_metrics(
        self,
        predictions: pd.DataFrame,
        actuals: pd.DataFrame,
        pred_column: str = 'prediction',
        actual_column: str = 'actual',
        lower_column: Optional[str] = 'lower_bound',
        upper_column: Optional[str] = 'upper_bound'
    ) -> Dict[str, float]:
        """
        Calculate overall metrics across all stocks.
        
        Args:
            predictions: DataFrame with predictions
            actuals: DataFrame with actual values
            pred_column: Name of prediction column
            actual_column: Name of actual value column
            lower_column: Name of lower bound column (optional)
            upper_column: Name of upper bound column (optional)
            
        Returns:
            Dictionary with overall metrics
        """
        y_true = actuals[actual_column].values
        y_pred = predictions[pred_column].values
        
        lower = predictions[lower_column].values if lower_column in predictions.columns else None
        upper = predictions[upper_column].values if upper_column in predictions.columns else None
        
        metrics = self.calculate_all_metrics(y_true, y_pred, lower, upper)
        metrics['num_predictions'] = len(predictions)
        
        return metrics
