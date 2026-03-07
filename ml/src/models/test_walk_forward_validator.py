"""
Unit tests for Walk-Forward Validator

Tests cover:
- Validator initialization
- Data splitting into train/test folds
- Walk-forward validation execution
- Metrics aggregation
- Edge cases and error handling
- Integration with different model types
"""

import numpy as np
import pandas as pd
import pytest
from datetime import datetime, timedelta

from ml.src.models.walk_forward_validator import (
    WalkForwardValidator,
    FoldMetrics,
    AggregatedMetrics
)


@pytest.fixture
def sample_time_series_data():
    """Create sample time series data for testing."""
    np.random.seed(42)
    
    # Create 24 months of daily data
    start_date = datetime(2022, 1, 1)
    dates = pd.date_range(start=start_date, periods=730, freq='D')
    
    # Generate synthetic price data with trend and noise
    trend = np.linspace(100, 120, len(dates))
    noise = np.random.randn(len(dates)) * 2
    prices = trend + noise
    
    df = pd.DataFrame({
        'date': dates,
        'price': prices,
        'target': prices,  # For simplicity, target is same as price
        'feature_1': np.random.randn(len(dates)),
        'feature_2': np.random.randn(len(dates))
    })
    
    return df


@pytest.fixture
def sample_monthly_data():
    """Create sample monthly aggregated data."""
    np.random.seed(42)
    
    # Create 24 months of monthly data
    start_date = datetime(2022, 1, 1)
    dates = pd.date_range(start=start_date, periods=24, freq='MS')
    
    prices = 100 + np.cumsum(np.random.randn(len(dates)))
    
    df = pd.DataFrame({
        'date': dates,
        'price': prices,
        'target': prices,
        'feature_1': np.random.randn(len(dates)),
        'feature_2': np.random.randn(len(dates))
    })
    
    return df


@pytest.fixture
def simple_model_trainer():
    """Create a simple model trainer for testing."""
    def trainer(train_df, test_df):
        """
        Simple trainer that predicts using mean of training data.
        
        Returns:
            (model, predictions) tuple
        """
        # Simple model: predict mean of training target
        train_mean = train_df['target'].mean()
        predictions = np.full(len(test_df), train_mean)
        
        return {'mean': train_mean}, predictions
    
    return trainer


@pytest.fixture
def linear_model_trainer():
    """Create a linear regression model trainer for testing."""
    def trainer(train_df, test_df):
        """
        Linear regression trainer.
        
        Returns:
            (model, predictions) tuple
        """
        from sklearn.linear_model import LinearRegression
        
        feature_cols = ['feature_1', 'feature_2']
        
        X_train = train_df[feature_cols].values
        y_train = train_df['target'].values
        X_test = test_df[feature_cols].values
        
        model = LinearRegression()
        model.fit(X_train, y_train)
        predictions = model.predict(X_test)
        
        return model, predictions
    
    return trainer


class TestWalkForwardValidatorInitialization:
    """Test walk-forward validator initialization."""
    
    def test_default_initialization(self):
        """Test initialization with default parameters."""
        validator = WalkForwardValidator()
        
        assert validator.train_window_months == 12
        assert validator.test_window_months == 1
        assert validator.step_months == 1
        assert validator.date_column == 'date'
    
    def test_custom_initialization(self):
        """Test initialization with custom parameters."""
        validator = WalkForwardValidator(
            train_window_months=6,
            test_window_months=2,
            step_months=2,
            date_column='timestamp'
        )
        
        assert validator.train_window_months == 6
        assert validator.test_window_months == 2
        assert validator.step_months == 2
        assert validator.date_column == 'timestamp'
    
    def test_invalid_train_window(self):
        """Test that invalid train window raises error."""
        with pytest.raises(ValueError, match="train_window_months must be at least 1"):
            WalkForwardValidator(train_window_months=0)
        
        with pytest.raises(ValueError, match="train_window_months must be at least 1"):
            WalkForwardValidator(train_window_months=-1)
    
    def test_invalid_test_window(self):
        """Test that invalid test window raises error."""
        with pytest.raises(ValueError, match="test_window_months must be at least 1"):
            WalkForwardValidator(test_window_months=0)
    
    def test_invalid_step_size(self):
        """Test that invalid step size raises error."""
        with pytest.raises(ValueError, match="step_months must be at least 1"):
            WalkForwardValidator(step_months=0)


class TestWalkForwardValidatorSplitData:
    """Test data splitting functionality."""
    
    def test_split_data_basic(self, sample_time_series_data):
        """Test basic data splitting."""
        validator = WalkForwardValidator(
            train_window_months=12,
            test_window_months=1,
            step_months=1
        )
        
        folds = validator.split_data(sample_time_series_data)
        
        # Should create multiple folds
        assert len(folds) > 0
        
        # Each fold should be a tuple of (train_df, test_df)
        for train_df, test_df in folds:
            assert isinstance(train_df, pd.DataFrame)
            assert isinstance(test_df, pd.DataFrame)
            assert not train_df.empty
            assert not test_df.empty
            
            # Test data should come after train data
            assert train_df['date'].max() < test_df['date'].min()
    
    def test_split_data_fold_count(self, sample_monthly_data):
        """Test that correct number of folds are created."""
        # With 24 months of data, 12-month train, 1-month test, 1-month step
        # We should get approximately 11 folds (depends on exact date boundaries)
        validator = WalkForwardValidator(
            train_window_months=12,
            test_window_months=1,
            step_months=1
        )
        
        folds = validator.split_data(sample_monthly_data)
        
        # Should create approximately 9-11 folds
        assert len(folds) >= 8  # Allow some flexibility for date boundaries
    
    def test_split_data_no_overlap_in_time(self, sample_time_series_data):
        """Test that train and test periods don't overlap."""
        validator = WalkForwardValidator(
            train_window_months=6,
            test_window_months=1,
            step_months=1
        )
        
        folds = validator.split_data(sample_time_series_data)
        
        for train_df, test_df in folds:
            train_dates = set(train_df['date'])
            test_dates = set(test_df['date'])
            
            # No overlap between train and test dates
            assert len(train_dates.intersection(test_dates)) == 0
    
    def test_split_data_window_sizes(self, sample_time_series_data):
        """Test that window sizes are approximately correct."""
        validator = WalkForwardValidator(
            train_window_months=12,
            test_window_months=1,
            step_months=1
        )
        
        folds = validator.split_data(sample_time_series_data)
        
        for train_df, test_df in folds:
            # Training window should be approximately 12 months
            train_span_days = (train_df['date'].max() - train_df['date'].min()).days
            # Allow for full month boundaries (can be up to ~395 days for 12 full months)
            assert 350 <= train_span_days <= 400  # ~12 months with full month boundaries
            
            # Test window should be approximately 1 month
            test_span_days = (test_df['date'].max() - test_df['date'].min()).days
            # Allow for full month boundaries (can be up to ~60 days for 1 full month)
            assert 25 <= test_span_days <= 65  # ~1 month with full month boundaries
    
    def test_split_data_empty_dataframe(self):
        """Test that empty dataframe raises error."""
        validator = WalkForwardValidator()
        empty_df = pd.DataFrame()
        
        with pytest.raises(ValueError, match="Data cannot be empty"):
            validator.split_data(empty_df)
    
    def test_split_data_missing_date_column(self, sample_time_series_data):
        """Test that missing date column raises error."""
        validator = WalkForwardValidator(date_column='missing_column')
        
        with pytest.raises(ValueError, match="Date column 'missing_column' not found"):
            validator.split_data(sample_time_series_data)
    
    def test_split_data_insufficient_data(self):
        """Test that insufficient data raises error."""
        # Create data with only 6 months
        dates = pd.date_range(start='2022-01-01', periods=180, freq='D')
        df = pd.DataFrame({
            'date': dates,
            'target': np.random.randn(len(dates))
        })
        
        # Try to create folds with 12-month train + 1-month test (need 13 months)
        validator = WalkForwardValidator(
            train_window_months=12,
            test_window_months=1
        )
        
        with pytest.raises(ValueError, match="Insufficient data"):
            validator.split_data(df)
    
    def test_split_data_custom_step_size(self, sample_time_series_data):
        """Test splitting with custom step size."""
        # Step by 3 months instead of 1
        validator = WalkForwardValidator(
            train_window_months=12,
            test_window_months=1,
            step_months=3
        )
        
        folds = validator.split_data(sample_time_series_data)
        
        # Should create fewer folds with larger step
        assert len(folds) > 0
        assert len(folds) < 12  # Fewer than monthly steps
    
    def test_split_data_string_dates(self):
        """Test that string dates are converted to datetime."""
        df = pd.DataFrame({
            'date': ['2022-01-01', '2022-02-01', '2022-03-01', '2022-04-01',
                     '2022-05-01', '2022-06-01', '2022-07-01', '2022-08-01',
                     '2022-09-01', '2022-10-01', '2022-11-01', '2022-12-01',
                     '2023-01-01', '2023-02-01', '2023-03-01'],
            'target': np.random.randn(15)
        })
        
        validator = WalkForwardValidator(
            train_window_months=6,
            test_window_months=1,
            step_months=1
        )
        
        folds = validator.split_data(df)
        
        # Should successfully create folds
        assert len(folds) > 0


class TestWalkForwardValidatorValidate:
    """Test validation execution."""
    
    def test_validate_basic(self, sample_time_series_data, simple_model_trainer):
        """Test basic validation execution."""
        validator = WalkForwardValidator(
            train_window_months=12,
            test_window_months=1,
            step_months=3  # Use larger step for faster test
        )
        
        fold_metrics = validator.validate(
            data=sample_time_series_data,
            model_trainer=simple_model_trainer,
            target_column='target'
        )
        
        # Should return list of FoldMetrics
        assert len(fold_metrics) > 0
        assert all(isinstance(fm, FoldMetrics) for fm in fold_metrics)
        
        # Each fold should have metrics
        for fm in fold_metrics:
            assert fm.fold_number > 0
            assert fm.train_samples > 0
            assert fm.test_samples > 0
            assert fm.mape >= 0
            assert fm.mae >= 0
            assert fm.rmse >= 0
            assert fm.train_start < fm.train_end
            assert fm.test_start < fm.test_end
            assert fm.train_end < fm.test_start
    
    def test_validate_with_linear_model(self, sample_time_series_data, linear_model_trainer):
        """Test validation with linear regression model."""
        validator = WalkForwardValidator(
            train_window_months=12,
            test_window_months=1,
            step_months=3
        )
        
        fold_metrics = validator.validate(
            data=sample_time_series_data,
            model_trainer=linear_model_trainer,
            target_column='target'
        )
        
        assert len(fold_metrics) > 0
        
        # Metrics should be reasonable
        for fm in fold_metrics:
            assert 0 <= fm.mape <= 100  # MAPE should be percentage
            assert fm.mae >= 0
            assert fm.rmse >= 0
            assert fm.rmse >= fm.mae  # RMSE >= MAE always
    
    def test_validate_missing_target_column(self, sample_time_series_data, simple_model_trainer):
        """Test that missing target column raises error."""
        validator = WalkForwardValidator()
        
        with pytest.raises(ValueError, match="Target column 'missing' not found"):
            validator.validate(
                data=sample_time_series_data,
                model_trainer=simple_model_trainer,
                target_column='missing'
            )
    
    def test_validate_with_coverage(self, sample_time_series_data):
        """Test validation with coverage calculation."""
        # Add prediction interval columns
        data = sample_time_series_data.copy()
        data['lower_bound'] = data['target'] - 2
        data['upper_bound'] = data['target'] + 2
        
        def trainer_with_intervals(train_df, test_df):
            """Trainer that returns predictions within intervals."""
            predictions = test_df['target'].values + np.random.randn(len(test_df)) * 0.5
            return {}, predictions
        
        validator = WalkForwardValidator(
            train_window_months=12,
            test_window_months=1,
            step_months=3
        )
        
        fold_metrics = validator.validate(
            data=data,
            model_trainer=trainer_with_intervals,
            target_column='target',
            calculate_coverage=True,
            lower_bound_column='lower_bound',
            upper_bound_column='upper_bound'
        )
        
        # Coverage should be calculated
        for fm in fold_metrics:
            assert fm.coverage is not None
            assert 0 <= fm.coverage <= 100
    
    def test_validate_coverage_missing_bounds(self, sample_time_series_data, simple_model_trainer):
        """Test that coverage calculation without bounds raises error."""
        validator = WalkForwardValidator()
        
        with pytest.raises(ValueError, match="lower_bound_column and upper_bound_column must be provided"):
            validator.validate(
                data=sample_time_series_data,
                model_trainer=simple_model_trainer,
                target_column='target',
                calculate_coverage=True
            )
    
    def test_validate_prediction_length_mismatch(self, sample_time_series_data):
        """Test that prediction length mismatch raises error."""
        def bad_trainer(train_df, test_df):
            """Trainer that returns wrong number of predictions."""
            predictions = np.array([1.0, 2.0, 3.0])  # Fixed length
            return {}, predictions
        
        validator = WalkForwardValidator(
            train_window_months=12,
            test_window_months=1,
            step_months=3
        )
        
        with pytest.raises(ValueError, match="Predictions length .* does not match actuals length"):
            validator.validate(
                data=sample_time_series_data,
                model_trainer=bad_trainer,
                target_column='target'
            )


class TestWalkForwardValidatorAggregateMetrics:
    """Test metrics aggregation."""
    
    def test_aggregate_metrics_basic(self):
        """Test basic metrics aggregation."""
        fold_metrics = [
            FoldMetrics(
                fold_number=1,
                train_start=datetime(2022, 1, 1),
                train_end=datetime(2022, 12, 31),
                test_start=datetime(2023, 1, 1),
                test_end=datetime(2023, 1, 31),
                train_samples=365,
                test_samples=31,
                mape=5.0,
                mae=2.0,
                rmse=3.0
            ),
            FoldMetrics(
                fold_number=2,
                train_start=datetime(2022, 2, 1),
                train_end=datetime(2023, 1, 31),
                test_start=datetime(2023, 2, 1),
                test_end=datetime(2023, 2, 28),
                train_samples=365,
                test_samples=28,
                mape=7.0,
                mae=3.0,
                rmse=4.0
            ),
            FoldMetrics(
                fold_number=3,
                train_start=datetime(2022, 3, 1),
                train_end=datetime(2023, 2, 28),
                test_start=datetime(2023, 3, 1),
                test_end=datetime(2023, 3, 31),
                train_samples=365,
                test_samples=31,
                mape=6.0,
                mae=2.5,
                rmse=3.5
            )
        ]
        
        validator = WalkForwardValidator()
        aggregated = validator.aggregate_metrics(fold_metrics)
        
        assert isinstance(aggregated, AggregatedMetrics)
        assert aggregated.n_folds == 3
        
        # Check mean values
        assert aggregated.mean_mape == pytest.approx(6.0, abs=0.01)
        assert aggregated.mean_mae == pytest.approx(2.5, abs=0.01)
        assert aggregated.mean_rmse == pytest.approx(3.5, abs=0.01)
        
        # Check min/max values
        assert aggregated.min_mape == 5.0
        assert aggregated.max_mape == 7.0
        assert aggregated.min_mae == 2.0
        assert aggregated.max_mae == 3.0
        
        # Check std values
        assert aggregated.std_mape > 0
        assert aggregated.std_mae > 0
        assert aggregated.std_rmse > 0
    
    def test_aggregate_metrics_with_coverage(self):
        """Test aggregation with coverage metrics."""
        fold_metrics = [
            FoldMetrics(
                fold_number=1,
                train_start=datetime(2022, 1, 1),
                train_end=datetime(2022, 12, 31),
                test_start=datetime(2023, 1, 1),
                test_end=datetime(2023, 1, 31),
                train_samples=365,
                test_samples=31,
                mape=5.0,
                mae=2.0,
                rmse=3.0,
                coverage=92.0
            ),
            FoldMetrics(
                fold_number=2,
                train_start=datetime(2022, 2, 1),
                train_end=datetime(2023, 1, 31),
                test_start=datetime(2023, 2, 1),
                test_end=datetime(2023, 2, 28),
                train_samples=365,
                test_samples=28,
                mape=7.0,
                mae=3.0,
                rmse=4.0,
                coverage=88.0
            )
        ]
        
        validator = WalkForwardValidator()
        aggregated = validator.aggregate_metrics(fold_metrics)
        
        # Coverage should be aggregated
        assert aggregated.mean_coverage == pytest.approx(90.0, abs=0.01)
        assert aggregated.min_coverage == 88.0
        assert aggregated.max_coverage == 92.0
        assert aggregated.std_coverage > 0
    
    def test_aggregate_metrics_empty_list(self):
        """Test that empty fold metrics list raises error."""
        validator = WalkForwardValidator()
        
        with pytest.raises(ValueError, match="fold_metrics cannot be empty"):
            validator.aggregate_metrics([])
    
    def test_aggregate_metrics_single_fold(self):
        """Test aggregation with single fold."""
        fold_metrics = [
            FoldMetrics(
                fold_number=1,
                train_start=datetime(2022, 1, 1),
                train_end=datetime(2022, 12, 31),
                test_start=datetime(2023, 1, 1),
                test_end=datetime(2023, 1, 31),
                train_samples=365,
                test_samples=31,
                mape=5.0,
                mae=2.0,
                rmse=3.0
            )
        ]
        
        validator = WalkForwardValidator()
        aggregated = validator.aggregate_metrics(fold_metrics)
        
        assert aggregated.n_folds == 1
        assert aggregated.mean_mape == 5.0
        assert aggregated.min_mape == 5.0
        assert aggregated.max_mape == 5.0
        assert aggregated.std_mape == 0.0


class TestWalkForwardValidatorMetricCalculations:
    """Test individual metric calculation methods."""
    
    def test_calculate_mape(self):
        """Test MAPE calculation."""
        y_true = np.array([100, 200, 300, 400])
        y_pred = np.array([110, 190, 310, 390])
        
        mape = WalkForwardValidator._calculate_mape(y_true, y_pred)
        
        # MAPE = mean(|100-110|/100, |200-190|/200, |300-310|/300, |400-390|/400) * 100
        # = mean(0.1, 0.05, 0.033, 0.025) * 100 = 5.2%
        assert mape == pytest.approx(5.2, abs=0.1)
    
    def test_calculate_mape_with_zeros(self):
        """Test MAPE calculation with zero values."""
        y_true = np.array([0, 100, 200])
        y_pred = np.array([10, 110, 190])
        
        # Should skip zero values
        mape = WalkForwardValidator._calculate_mape(y_true, y_pred)
        
        # Only calculate for non-zero values: mean(|100-110|/100, |200-190|/200) * 100
        assert mape == pytest.approx(7.5, abs=0.1)
    
    def test_calculate_mape_all_zeros(self):
        """Test MAPE calculation when all true values are zero."""
        y_true = np.array([0, 0, 0])
        y_pred = np.array([10, 20, 30])
        
        mape = WalkForwardValidator._calculate_mape(y_true, y_pred)
        
        # Should return 0 when all true values are zero
        assert mape == 0.0
    
    def test_calculate_mae(self):
        """Test MAE calculation."""
        y_true = np.array([100, 200, 300])
        y_pred = np.array([110, 190, 310])
        
        mae = WalkForwardValidator._calculate_mae(y_true, y_pred)
        
        # MAE = mean(|100-110|, |200-190|, |300-310|) = mean(10, 10, 10) = 10
        assert mae == pytest.approx(10.0, abs=0.01)
    
    def test_calculate_rmse(self):
        """Test RMSE calculation."""
        y_true = np.array([100, 200, 300])
        y_pred = np.array([110, 190, 310])
        
        rmse = WalkForwardValidator._calculate_rmse(y_true, y_pred)
        
        # RMSE = sqrt(mean((100-110)^2, (200-190)^2, (300-310)^2))
        # = sqrt(mean(100, 100, 100)) = sqrt(100) = 10
        assert rmse == pytest.approx(10.0, abs=0.01)
    
    def test_calculate_coverage(self):
        """Test coverage calculation."""
        y_true = np.array([100, 200, 300, 400, 500])
        lower_bounds = np.array([90, 190, 290, 390, 490])
        upper_bounds = np.array([110, 210, 310, 410, 510])
        
        coverage = WalkForwardValidator._calculate_coverage(
            y_true, lower_bounds, upper_bounds
        )
        
        # All values are within bounds, so coverage = 100%
        assert coverage == 100.0
    
    def test_calculate_coverage_partial(self):
        """Test coverage calculation with partial coverage."""
        y_true = np.array([100, 200, 300, 400, 500])
        lower_bounds = np.array([90, 190, 290, 390, 490])
        upper_bounds = np.array([105, 210, 310, 410, 495])  # 500 is outside [490, 495]
        
        coverage = WalkForwardValidator._calculate_coverage(
            y_true, lower_bounds, upper_bounds
        )
        
        # 4 out of 5 values are within bounds (500 is outside [490, 495])
        # Coverage = 4/5 * 100 = 80%
        assert coverage == 80.0


class TestWalkForwardValidatorIntegration:
    """Integration tests for complete workflows."""
    
    def test_complete_workflow(self, sample_time_series_data, linear_model_trainer):
        """Test complete workflow: split, validate, aggregate."""
        validator = WalkForwardValidator(
            train_window_months=12,
            test_window_months=1,
            step_months=3
        )
        
        # Split data
        folds = validator.split_data(sample_time_series_data)
        assert len(folds) > 0
        
        # Validate
        fold_metrics = validator.validate(
            data=sample_time_series_data,
            model_trainer=linear_model_trainer,
            target_column='target'
        )
        assert len(fold_metrics) == len(folds)
        
        # Aggregate
        aggregated = validator.aggregate_metrics(fold_metrics)
        assert aggregated.n_folds == len(folds)
        assert aggregated.mean_mape >= 0
        assert aggregated.mean_mae >= 0
        assert aggregated.mean_rmse >= 0
    
    def test_workflow_with_different_configurations(self, sample_time_series_data, simple_model_trainer):
        """Test workflow with different validator configurations."""
        configurations = [
            (6, 1, 1),   # 6-month train, 1-month test, 1-month step
            (12, 1, 1),  # 12-month train, 1-month test, 1-month step
            (12, 2, 2),  # 12-month train, 2-month test, 2-month step
        ]
        
        for train_months, test_months, step_months in configurations:
            validator = WalkForwardValidator(
                train_window_months=train_months,
                test_window_months=test_months,
                step_months=step_months
            )
            
            fold_metrics = validator.validate(
                data=sample_time_series_data,
                model_trainer=simple_model_trainer,
                target_column='target'
            )
            
            assert len(fold_metrics) > 0
            
            aggregated = validator.aggregate_metrics(fold_metrics)
            assert aggregated.n_folds > 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
