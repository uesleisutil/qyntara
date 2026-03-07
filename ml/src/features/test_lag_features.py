"""
Tests for Lag Features Calculator

Unit tests for lag and diff feature calculations.
"""

import pytest
import pandas as pd
import numpy as np
from src.features.lag_features import LagFeaturesCalculator


class TestLagFeaturesCalculator:
    """Test suite for LagFeaturesCalculator"""
    
    @pytest.fixture
    def calculator(self):
        """Create calculator instance"""
        return LagFeaturesCalculator()
    
    @pytest.fixture
    def sample_series(self):
        """Create sample time series data"""
        dates = pd.date_range('2024-01-01', periods=100, freq='D')
        values = np.random.randn(100).cumsum() + 100
        return pd.Series(values, index=dates)
    
    # Lag Features Tests
    
    def test_create_lags_single_lag(self, calculator, sample_series):
        """Test creating lag features with single lag period"""
        result = calculator.create_lags(sample_series, [1])
        
        assert 'lag_1' in result.columns
        assert len(result) == len(sample_series)
        # First value should be NaN (no previous value)
        assert pd.isna(result['lag_1'].iloc[0])
        # Second value should equal first value of original series
        assert result['lag_1'].iloc[1] == sample_series.iloc[0]
    
    def test_create_lags_multiple_lags(self, calculator, sample_series):
        """Test creating lag features with multiple lag periods"""
        lags = [1, 2, 3, 5, 10]
        result = calculator.create_lags(sample_series, lags)
        
        assert len(result.columns) == len(lags)
        for lag in lags:
            assert f'lag_{lag}' in result.columns
    
    def test_create_lags_values_correct(self, calculator):
        """Test lag features calculate correct values"""
        series = pd.Series([10, 20, 30, 40, 50])
        result = calculator.create_lags(series, [1, 2, 3])
        
        # lag_1 values
        assert pd.isna(result['lag_1'].iloc[0])
        assert result['lag_1'].iloc[1] == 10
        assert result['lag_1'].iloc[2] == 20
        assert result['lag_1'].iloc[3] == 30
        assert result['lag_1'].iloc[4] == 40
        
        # lag_2 values
        assert pd.isna(result['lag_2'].iloc[0])
        assert pd.isna(result['lag_2'].iloc[1])
        assert result['lag_2'].iloc[2] == 10
        assert result['lag_2'].iloc[3] == 20
        assert result['lag_2'].iloc[4] == 30
        
        # lag_3 values
        assert pd.isna(result['lag_3'].iloc[0])
        assert pd.isna(result['lag_3'].iloc[1])
        assert pd.isna(result['lag_3'].iloc[2])
        assert result['lag_3'].iloc[3] == 10
        assert result['lag_3'].iloc[4] == 20
    
    def test_create_lags_required_periods(self, calculator, sample_series):
        """Test that required lag periods [1, 2, 3, 5, 10] work correctly"""
        required_lags = [1, 2, 3, 5, 10]
        result = calculator.create_lags(sample_series, required_lags)
        
        # Verify all required columns exist
        for lag in required_lags:
            assert f'lag_{lag}' in result.columns
        
        # Verify correct number of NaN values at start
        assert result['lag_1'].isna().sum() == 1
        assert result['lag_2'].isna().sum() == 2
        assert result['lag_3'].isna().sum() == 3
        assert result['lag_5'].isna().sum() == 5
        assert result['lag_10'].isna().sum() == 10
    
    def test_create_lags_preserves_index(self, calculator, sample_series):
        """Test that lag features preserve the original index"""
        result = calculator.create_lags(sample_series, [1, 5])
        
        assert result.index.equals(sample_series.index)
    
    def test_create_lags_empty_series(self, calculator):
        """Test creating lag features with empty series"""
        empty_series = pd.Series([], dtype=float)
        result = calculator.create_lags(empty_series, [1, 2])
        
        assert len(result) == 0
        assert 'lag_1' in result.columns
        assert 'lag_2' in result.columns
    
    def test_create_lags_single_value(self, calculator):
        """Test creating lag features with single value series"""
        series = pd.Series([100.0])
        result = calculator.create_lags(series, [1, 2, 3])
        
        assert len(result) == 1
        # All lag values should be NaN for single value
        assert result['lag_1'].isna().all()
        assert result['lag_2'].isna().all()
        assert result['lag_3'].isna().all()
    
    def test_create_lags_large_lag(self, calculator):
        """Test creating lag features with lag larger than series length"""
        series = pd.Series([1, 2, 3, 4, 5])
        result = calculator.create_lags(series, [10])
        
        # All values should be NaN when lag exceeds series length
        assert result['lag_10'].isna().all()
    
    # Diff Features Tests
    
    def test_create_diff_single_period(self, calculator, sample_series):
        """Test creating diff features with single period"""
        result = calculator.create_diff_features(sample_series, [1])
        
        assert 'diff_1' in result.columns
        assert len(result) == len(sample_series)
        # First value should be NaN (no previous value to diff)
        assert pd.isna(result['diff_1'].iloc[0])
    
    def test_create_diff_multiple_periods(self, calculator, sample_series):
        """Test creating diff features with multiple periods"""
        periods = [1, 2, 3, 5, 10]
        result = calculator.create_diff_features(sample_series, periods)
        
        assert len(result.columns) == len(periods)
        for period in periods:
            assert f'diff_{period}' in result.columns
    
    def test_create_diff_values_correct(self, calculator):
        """Test diff features calculate correct values"""
        series = pd.Series([10, 20, 30, 40, 50])
        result = calculator.create_diff_features(series, [1, 2])
        
        # diff_1 values (current - previous)
        assert pd.isna(result['diff_1'].iloc[0])
        assert result['diff_1'].iloc[1] == 10  # 20 - 10
        assert result['diff_1'].iloc[2] == 10  # 30 - 20
        assert result['diff_1'].iloc[3] == 10  # 40 - 30
        assert result['diff_1'].iloc[4] == 10  # 50 - 40
        
        # diff_2 values (current - 2 periods ago)
        assert pd.isna(result['diff_2'].iloc[0])
        assert pd.isna(result['diff_2'].iloc[1])
        assert result['diff_2'].iloc[2] == 20  # 30 - 10
        assert result['diff_2'].iloc[3] == 20  # 40 - 20
        assert result['diff_2'].iloc[4] == 20  # 50 - 30
    
    def test_create_diff_required_periods(self, calculator, sample_series):
        """Test that required diff periods [1, 2, 3, 5, 10] work correctly"""
        required_periods = [1, 2, 3, 5, 10]
        result = calculator.create_diff_features(sample_series, required_periods)
        
        # Verify all required columns exist
        for period in required_periods:
            assert f'diff_{period}' in result.columns
        
        # Verify correct number of NaN values at start
        assert result['diff_1'].isna().sum() == 1
        assert result['diff_2'].isna().sum() == 2
        assert result['diff_3'].isna().sum() == 3
        assert result['diff_5'].isna().sum() == 5
        assert result['diff_10'].isna().sum() == 10
    
    def test_create_diff_preserves_index(self, calculator, sample_series):
        """Test that diff features preserve the original index"""
        result = calculator.create_diff_features(sample_series, [1, 5])
        
        assert result.index.equals(sample_series.index)
    
    def test_create_diff_constant_series(self, calculator):
        """Test diff features with constant series"""
        series = pd.Series([100.0] * 10)
        result = calculator.create_diff_features(series, [1, 2, 3])
        
        # All diffs should be 0 (except NaN values)
        assert (result['diff_1'].dropna() == 0).all()
        assert (result['diff_2'].dropna() == 0).all()
        assert (result['diff_3'].dropna() == 0).all()
    
    def test_create_diff_linear_series(self, calculator):
        """Test diff features with linear series"""
        series = pd.Series([10, 20, 30, 40, 50, 60])
        result = calculator.create_diff_features(series, [1])
        
        # All diff_1 values should be 10 (constant increment)
        assert (result['diff_1'].dropna() == 10).all()
    
    def test_create_diff_negative_changes(self, calculator):
        """Test diff features with decreasing series"""
        series = pd.Series([50, 40, 30, 20, 10])
        result = calculator.create_diff_features(series, [1])
        
        # All diff_1 values should be -10 (constant decrement)
        assert (result['diff_1'].dropna() == -10).all()
    
    def test_create_diff_empty_series(self, calculator):
        """Test creating diff features with empty series"""
        empty_series = pd.Series([], dtype=float)
        result = calculator.create_diff_features(empty_series, [1, 2])
        
        assert len(result) == 0
        assert 'diff_1' in result.columns
        assert 'diff_2' in result.columns
    
    def test_create_diff_single_value(self, calculator):
        """Test creating diff features with single value series"""
        series = pd.Series([100.0])
        result = calculator.create_diff_features(series, [1, 2, 3])
        
        assert len(result) == 1
        # All diff values should be NaN for single value
        assert result['diff_1'].isna().all()
        assert result['diff_2'].isna().all()
        assert result['diff_3'].isna().all()
    
    # Combined Tests
    
    def test_lags_and_diffs_same_periods(self, calculator, sample_series):
        """Test that lags and diffs can use the same period list"""
        periods = [1, 2, 3, 5, 10]
        
        lag_result = calculator.create_lags(sample_series, periods)
        diff_result = calculator.create_diff_features(sample_series, periods)
        
        # Both should have same number of columns
        assert len(lag_result.columns) == len(diff_result.columns)
        # Both should have same index
        assert lag_result.index.equals(diff_result.index)
    
    def test_relationship_between_lag_and_diff(self, calculator):
        """Test mathematical relationship: diff_n = value - lag_n"""
        series = pd.Series([10, 20, 30, 40, 50])
        
        lag_result = calculator.create_lags(series, [1, 2])
        diff_result = calculator.create_diff_features(series, [1, 2])
        
        # diff_1 should equal series - lag_1
        expected_diff_1 = series - lag_result['lag_1']
        assert diff_result['diff_1'].equals(expected_diff_1)
        
        # diff_2 should equal series - lag_2
        expected_diff_2 = series - lag_result['lag_2']
        assert diff_result['diff_2'].equals(expected_diff_2)
    
    def test_combined_features_dataframe(self, calculator, sample_series):
        """Test combining lag and diff features into single DataFrame"""
        periods = [1, 2, 3, 5, 10]
        
        lag_result = calculator.create_lags(sample_series, periods)
        diff_result = calculator.create_diff_features(sample_series, periods)
        
        # Combine into single DataFrame
        combined = pd.concat([lag_result, diff_result], axis=1)
        
        # Should have 10 columns (5 lags + 5 diffs)
        assert len(combined.columns) == 10
        # Should have same length as original series
        assert len(combined) == len(sample_series)
        # Should have all expected columns
        for period in periods:
            assert f'lag_{period}' in combined.columns
            assert f'diff_{period}' in combined.columns
    
    # Edge Cases
    
    def test_zero_lag_period(self, calculator, sample_series):
        """Test lag with period 0 (should return original series)"""
        result = calculator.create_lags(sample_series, [0])
        
        # lag_0 should equal original series (no shift)
        assert result['lag_0'].equals(sample_series)
    
    def test_zero_diff_period(self, calculator, sample_series):
        """Test diff with period 0 (should return zeros)"""
        result = calculator.create_diff_features(sample_series, [0])
        
        # diff_0 should be all zeros (value - value = 0)
        assert (result['diff_0'] == 0).all()
    
    def test_large_periods(self, calculator):
        """Test with periods larger than series length"""
        series = pd.Series([1, 2, 3, 4, 5])
        
        lag_result = calculator.create_lags(series, [10, 20])
        diff_result = calculator.create_diff_features(series, [10, 20])
        
        # All values should be NaN when period exceeds series length
        assert lag_result['lag_10'].isna().all()
        assert lag_result['lag_20'].isna().all()
        assert diff_result['diff_10'].isna().all()
        assert diff_result['diff_20'].isna().all()
    
    def test_datetime_index_preserved(self, calculator):
        """Test that datetime index is preserved correctly"""
        dates = pd.date_range('2024-01-01', periods=20, freq='D')
        series = pd.Series(range(20), index=dates)
        
        lag_result = calculator.create_lags(series, [1, 5])
        diff_result = calculator.create_diff_features(series, [1, 5])
        
        # Index should be datetime
        assert isinstance(lag_result.index, pd.DatetimeIndex)
        assert isinstance(diff_result.index, pd.DatetimeIndex)
        # Index should match original
        assert lag_result.index.equals(dates)
        assert diff_result.index.equals(dates)
