"""
Walk-Forward Validation for Time Series Models

This module provides walk-forward validation functionality for time series forecasting models.
Walk-forward validation simulates real production conditions by training on historical data
and testing on future data, then rolling the window forward.

Requirements:
- 5.3: Use walk-forward validation for objective function evaluation
- 8.1: Use 12-month training window
- 8.2: Use 1-month test window
- 8.3: Use 1-month step size (rolling forward)
- 8.4: Aggregate metrics across all validation folds
- 8.5: Report per-fold metrics for temporal performance analysis
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class FoldMetrics:
    """Metrics for a single validation fold."""
    fold_number: int
    train_start: datetime
    train_end: datetime
    test_start: datetime
    test_end: datetime
    train_samples: int
    test_samples: int
    mape: float
    mae: float
    rmse: float
    coverage: Optional[float] = None


@dataclass
class AggregatedMetrics:
    """Aggregated metrics across all validation folds."""
    mean_mape: float
    std_mape: float
    min_mape: float
    max_mape: float
    mean_mae: float
    std_mae: float
    min_mae: float
    max_mae: float
    mean_rmse: float
    std_rmse: float
    min_rmse: float
    max_rmse: float
    mean_coverage: Optional[float] = None
    std_coverage: Optional[float] = None
    min_coverage: Optional[float] = None
    max_coverage: Optional[float] = None
    n_folds: int = 0


class WalkForwardValidator:
    """
    Walk-forward validator for time series models.
    
    Implements walk-forward validation with configurable train/test windows and step size.
    Default configuration follows requirements:
    - 12-month training window (Requirement 8.1)
    - 1-month test window (Requirement 8.2)
    - 1-month step size (Requirement 8.3)
    
    The validator:
    1. Splits data into overlapping train/test folds
    2. Trains model on each training window
    3. Evaluates on corresponding test window
    4. Aggregates metrics across all folds
    """
    
    def __init__(
        self,
        train_window_months: int = 12,
        test_window_months: int = 1,
        step_months: int = 1,
        date_column: str = 'date'
    ):
        """
        Initialize walk-forward validator.
        
        Args:
            train_window_months: Size of training window in months (default: 12)
            test_window_months: Size of test window in months (default: 1)
            step_months: Step size for rolling window in months (default: 1)
            date_column: Name of the date column in the data
            
        Raises:
            ValueError: If window sizes or step size are invalid
        """
        if train_window_months < 1:
            raise ValueError(
                f"train_window_months must be at least 1. Got {train_window_months}"
            )
        
        if test_window_months < 1:
            raise ValueError(
                f"test_window_months must be at least 1. Got {test_window_months}"
            )
        
        if step_months < 1:
            raise ValueError(
                f"step_months must be at least 1. Got {step_months}"
            )
        
        self.train_window_months = train_window_months
        self.test_window_months = test_window_months
        self.step_months = step_months
        self.date_column = date_column
        
        logger.info(
            f"Initialized WalkForwardValidator: "
            f"train_window={train_window_months}m, "
            f"test_window={test_window_months}m, "
            f"step={step_months}m"
        )
    
    def split_data(
        self,
        data: pd.DataFrame
    ) -> List[Tuple[pd.DataFrame, pd.DataFrame]]:
        """
        Split time series data into train/test folds using walk-forward approach.
        
        The method creates overlapping folds where each fold consists of:
        - Training data: train_window_months of historical data
        - Test data: test_window_months of future data immediately after training window
        
        The window rolls forward by step_months for each subsequent fold.
        
        Args:
            data: DataFrame with time series data, must contain date_column
            
        Returns:
            List of (train_df, test_df) tuples, one for each fold
            
        Raises:
            ValueError: If data is empty, missing date column, or insufficient for validation
        """
        if data.empty:
            raise ValueError("Data cannot be empty")
        
        if self.date_column not in data.columns:
            raise ValueError(
                f"Date column '{self.date_column}' not found in data. "
                f"Available columns: {list(data.columns)}"
            )
        
        # Ensure data is sorted by date
        data = data.sort_values(self.date_column).reset_index(drop=True)
        
        # Convert date column to datetime if not already
        if not pd.api.types.is_datetime64_any_dtype(data[self.date_column]):
            data[self.date_column] = pd.to_datetime(data[self.date_column])
        
        # Get date range
        min_date = data[self.date_column].min()
        max_date = data[self.date_column].max()
        
        logger.info(f"Data date range: {min_date} to {max_date}")
        
        # Calculate minimum required data span
        min_required_months = self.train_window_months + self.test_window_months
        data_span_months = (max_date.year - min_date.year) * 12 + (max_date.month - min_date.month)
        
        if data_span_months < min_required_months:
            raise ValueError(
                f"Insufficient data for walk-forward validation. "
                f"Need at least {min_required_months} months, "
                f"but data spans only {data_span_months} months"
            )
        
        folds = []
        fold_number = 0
        
        # Start with first possible training window
        current_train_start = min_date
        
        while True:
            # Calculate train window end (train_window_months after start)
            train_end_month = current_train_start.month + self.train_window_months
            train_end_year = current_train_start.year + (train_end_month - 1) // 12
            train_end_month = ((train_end_month - 1) % 12) + 1
            
            # Create train_end date (last day of the month)
            import calendar
            last_day = calendar.monthrange(train_end_year, train_end_month)[1]
            current_train_end = pd.Timestamp(
                year=train_end_year,
                month=train_end_month,
                day=last_day
            )
            
            # Calculate test window start (day after train end)
            current_test_start = current_train_end + pd.Timedelta(days=1)
            
            # Calculate test window end (test_window_months after test start)
            test_end_month = current_test_start.month + self.test_window_months
            test_end_year = current_test_start.year + (test_end_month - 1) // 12
            test_end_month = ((test_end_month - 1) % 12) + 1
            
            # Create test_end date (last day of the month)
            last_day = calendar.monthrange(test_end_year, test_end_month)[1]
            current_test_end = pd.Timestamp(
                year=test_end_year,
                month=test_end_month,
                day=last_day
            )
            
            # Check if we have enough data for this fold
            if current_test_end > max_date:
                break
            
            # Extract train and test data for this fold
            train_mask = (
                (data[self.date_column] >= current_train_start) &
                (data[self.date_column] <= current_train_end)
            )
            test_mask = (
                (data[self.date_column] >= current_test_start) &
                (data[self.date_column] <= current_test_end)
            )
            
            train_df = data[train_mask].copy()
            test_df = data[test_mask].copy()
            
            # Only add fold if both train and test have data
            if not train_df.empty and not test_df.empty:
                folds.append((train_df, test_df))
                
                logger.debug(
                    f"Fold {fold_number}: "
                    f"Train [{current_train_start.date()} to {current_train_end.date()}] "
                    f"({len(train_df)} samples), "
                    f"Test [{current_test_start.date()} to {current_test_end.date()}] "
                    f"({len(test_df)} samples)"
                )
                
                fold_number += 1
            
            # Move to next fold (step forward by step_months)
            step_month = current_train_start.month + self.step_months
            step_year = current_train_start.year + (step_month - 1) // 12
            step_month = ((step_month - 1) % 12) + 1
            
            current_train_start = pd.Timestamp(
                year=step_year,
                month=step_month,
                day=current_train_start.day
            )
        
        if not folds:
            raise ValueError(
                "Could not create any validation folds. "
                "Data may be too short or have gaps."
            )
        
        logger.info(f"Created {len(folds)} validation folds")
        
        return folds
    
    def validate(
        self,
        data: pd.DataFrame,
        model_trainer: Callable[[pd.DataFrame, pd.DataFrame], Tuple[Any, np.ndarray]],
        target_column: str = 'target',
        calculate_coverage: bool = False,
        lower_bound_column: Optional[str] = None,
        upper_bound_column: Optional[str] = None
    ) -> List[FoldMetrics]:
        """
        Run walk-forward validation across all folds.
        
        For each fold:
        1. Train model on training window
        2. Generate predictions on test window
        3. Calculate metrics (MAPE, MAE, RMSE, optionally coverage)
        
        Args:
            data: DataFrame with time series data
            model_trainer: Function that takes (train_df, test_df) and returns
                          (trained_model, predictions). Predictions should be numpy array.
            target_column: Name of the target column
            calculate_coverage: Whether to calculate prediction interval coverage
            lower_bound_column: Column name for lower prediction bound (required if calculate_coverage=True)
            upper_bound_column: Column name for upper prediction bound (required if calculate_coverage=True)
            
        Returns:
            List of FoldMetrics, one for each validation fold
            
        Raises:
            ValueError: If target column is missing or coverage calculation is misconfigured
        """
        if target_column not in data.columns:
            raise ValueError(
                f"Target column '{target_column}' not found in data. "
                f"Available columns: {list(data.columns)}"
            )
        
        if calculate_coverage:
            if lower_bound_column is None or upper_bound_column is None:
                raise ValueError(
                    "lower_bound_column and upper_bound_column must be provided "
                    "when calculate_coverage=True"
                )
        
        # Split data into folds
        folds = self.split_data(data)
        
        logger.info(f"Starting validation across {len(folds)} folds")
        
        fold_metrics_list = []
        
        for fold_idx, (train_df, test_df) in enumerate(folds):
            logger.info(f"Processing fold {fold_idx + 1}/{len(folds)}")
            
            try:
                # Train model and get predictions
                trained_model, predictions = model_trainer(train_df, test_df)
                
                # Get actual values
                y_true = test_df[target_column].values
                
                # Ensure predictions and actuals have same length
                if len(predictions) != len(y_true):
                    raise ValueError(
                        f"Predictions length ({len(predictions)}) does not match "
                        f"actuals length ({len(y_true)})"
                    )
                
                # Calculate metrics
                mape = self._calculate_mape(y_true, predictions)
                mae = self._calculate_mae(y_true, predictions)
                rmse = self._calculate_rmse(y_true, predictions)
                
                coverage = None
                if calculate_coverage:
                    lower_bounds = test_df[lower_bound_column].values
                    upper_bounds = test_df[upper_bound_column].values
                    coverage = self._calculate_coverage(y_true, lower_bounds, upper_bounds)
                
                # Create fold metrics
                fold_metrics = FoldMetrics(
                    fold_number=fold_idx + 1,
                    train_start=train_df[self.date_column].min(),
                    train_end=train_df[self.date_column].max(),
                    test_start=test_df[self.date_column].min(),
                    test_end=test_df[self.date_column].max(),
                    train_samples=len(train_df),
                    test_samples=len(test_df),
                    mape=mape,
                    mae=mae,
                    rmse=rmse,
                    coverage=coverage
                )
                
                fold_metrics_list.append(fold_metrics)
                
                logger.info(
                    f"Fold {fold_idx + 1} metrics: "
                    f"MAPE={mape:.4f}, MAE={mae:.4f}, RMSE={rmse:.4f}"
                    + (f", Coverage={coverage:.4f}" if coverage is not None else "")
                )
                
            except Exception as e:
                logger.error(f"Fold {fold_idx + 1} failed: {e}")
                raise
        
        logger.info("Validation completed successfully")
        
        return fold_metrics_list
    
    def aggregate_metrics(
        self,
        fold_metrics: List[FoldMetrics]
    ) -> AggregatedMetrics:
        """
        Aggregate metrics across all validation folds.
        
        Calculates mean, std, min, and max for each metric across all folds.
        
        Args:
            fold_metrics: List of FoldMetrics from validate()
            
        Returns:
            AggregatedMetrics with summary statistics
            
        Raises:
            ValueError: If fold_metrics is empty
        """
        if not fold_metrics:
            raise ValueError("fold_metrics cannot be empty")
        
        # Extract metric arrays
        mape_values = np.array([fm.mape for fm in fold_metrics])
        mae_values = np.array([fm.mae for fm in fold_metrics])
        rmse_values = np.array([fm.rmse for fm in fold_metrics])
        
        # Calculate coverage if available
        coverage_values = [fm.coverage for fm in fold_metrics if fm.coverage is not None]
        has_coverage = len(coverage_values) > 0
        
        if has_coverage:
            coverage_array = np.array(coverage_values)
            mean_coverage = float(np.mean(coverage_array))
            std_coverage = float(np.std(coverage_array))
            min_coverage = float(np.min(coverage_array))
            max_coverage = float(np.max(coverage_array))
        else:
            mean_coverage = None
            std_coverage = None
            min_coverage = None
            max_coverage = None
        
        aggregated = AggregatedMetrics(
            mean_mape=float(np.mean(mape_values)),
            std_mape=float(np.std(mape_values)),
            min_mape=float(np.min(mape_values)),
            max_mape=float(np.max(mape_values)),
            mean_mae=float(np.mean(mae_values)),
            std_mae=float(np.std(mae_values)),
            min_mae=float(np.min(mae_values)),
            max_mae=float(np.max(mae_values)),
            mean_rmse=float(np.mean(rmse_values)),
            std_rmse=float(np.std(rmse_values)),
            min_rmse=float(np.min(rmse_values)),
            max_rmse=float(np.max(rmse_values)),
            mean_coverage=mean_coverage,
            std_coverage=std_coverage,
            min_coverage=min_coverage,
            max_coverage=max_coverage,
            n_folds=len(fold_metrics)
        )
        
        logger.info(
            f"Aggregated metrics across {aggregated.n_folds} folds: "
            f"MAPE={aggregated.mean_mape:.4f}±{aggregated.std_mape:.4f}, "
            f"MAE={aggregated.mean_mae:.4f}±{aggregated.std_mae:.4f}, "
            f"RMSE={aggregated.mean_rmse:.4f}±{aggregated.std_rmse:.4f}"
            + (f", Coverage={aggregated.mean_coverage:.4f}±{aggregated.std_coverage:.4f}"
               if aggregated.mean_coverage is not None else "")
        )
        
        return aggregated
    
    @staticmethod
    def _calculate_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
        """
        Calculate Mean Absolute Percentage Error.
        
        Args:
            y_true: Actual values
            y_pred: Predicted values
            
        Returns:
            MAPE as a percentage (0-100)
        """
        # Avoid division by zero
        mask = y_true != 0
        if not mask.any():
            return 0.0
        
        mape = np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100
        return float(mape)
    
    @staticmethod
    def _calculate_mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
        """
        Calculate Mean Absolute Error.
        
        Args:
            y_true: Actual values
            y_pred: Predicted values
            
        Returns:
            MAE
        """
        mae = np.mean(np.abs(y_true - y_pred))
        return float(mae)
    
    @staticmethod
    def _calculate_rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
        """
        Calculate Root Mean Squared Error.
        
        Args:
            y_true: Actual values
            y_pred: Predicted values
            
        Returns:
            RMSE
        """
        rmse = np.sqrt(np.mean((y_true - y_pred) ** 2))
        return float(rmse)
    
    @staticmethod
    def _calculate_coverage(
        y_true: np.ndarray,
        lower_bounds: np.ndarray,
        upper_bounds: np.ndarray
    ) -> float:
        """
        Calculate prediction interval coverage.
        
        Coverage is the percentage of actual values that fall within the
        prediction intervals [lower_bound, upper_bound].
        
        Args:
            y_true: Actual values
            lower_bounds: Lower prediction bounds
            upper_bounds: Upper prediction bounds
            
        Returns:
            Coverage as a percentage (0-100)
        """
        within_interval = (y_true >= lower_bounds) & (y_true <= upper_bounds)
        coverage = np.mean(within_interval) * 100
        return float(coverage)
