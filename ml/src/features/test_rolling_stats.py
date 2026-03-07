"""
Tests for Rolling Statistics Calculator

Unit tests for rolling mean, std, min/max, and EWMA volatility calculations.
"""

import pytest
import pandas as pd
import numpy as np
from src.features.rolling_stats import RollingStatsCalculator


class TestRollingStatsCalculator:
    """Test suite for RollingStatsCalculator"""
    
    @pytest.fixture
    def calculator(self):
        """Create calculator instance"""
        return RollingStatsCalculator()
    
    @pytest.fixture
    def sample_series(self):
        """Create sample time series data"""
        dates = pd.date_range('2024-01-01', periods=100, freq='D')
        values = np.random.randn(100).cumsum() + 100
        return pd.Series(values, index=dates)
    
    # Rolling Mean Tests
    
    def test_rolling_mean_single_window(self, calculator, sample_series):
        """Test rolling mean with single window size"""
        result = calculator.calculate_rolling_mean(sample_series, [5])
        
        assert 'rolling_mean_5' in result.columns
        assert len(result) == len(sample_series)
        assert not result['rolling_mean_5'].isna().all()
    
    def test_rolling_mean_multiple_windows(self, calculator, sample_series):
        """Test rolling mean with multiple window sizes"""
        windows = [5, 10, 20, 60]
        result = calculator.calculate_rolling_mean(sample_series, windows)
        
        assert len(result.columns) == len(windows)
        for window in windows:
            assert f'rolling_mean_{window}' in result.columns
    
    def test_rolling_mean_values_correct(self, calculator):
        """Test rolling mean calculates correct values"""
        series = pd.Series([1, 2, 3, 4, 5])
        result = calculator.calculate_rolling_mean(series, [3])
        
        # First value should be 1 (min_periods=1)
        assert result['rolling_mean_3'].iloc[0] == 1.0
        # Second value should be (1+2)/2 = 1.5
        assert result['rolling_mean_3'].iloc[1] == 1.5
        # Third value should be (1+2+3)/3 = 2.0
        assert result['rolling_mean_3'].iloc[2] == 2.0
        # Fourth value should be (2+3+4)/3 = 3.0
        assert result['rolling_mean_3'].iloc[3] == 3.0
    
    def test_rolling_mean_empty_series(self, calculator):
        """Test rolling mean with empty series"""
        empty_series = pd.Series([], dtype=float)
        result = calculator.calculate_rolling_mean(empty_series, [5])
        
        assert len(result) == 0
        assert 'rolling_mean_5' in result.columns
    
    # Rolling Std Tests
    
    def test_rolling_std_single_window(self, calculator, sample_series):
        """Test rolling std with single window size"""
        result = calculator.calculate_rolling_std(sample_series, [5])
        
        assert 'rolling_std_5' in result.columns
        assert len(result) == len(sample_series)
    
    def test_rolling_std_multiple_windows(self, calculator, sample_series):
        """Test rolling std with multiple window sizes"""
        windows = [5, 10, 20, 60]
        result = calculator.calculate_rolling_std(sample_series, windows)
        
        assert len(result.columns) == len(windows)
        for window in windows:
            assert f'rolling_std_{window}' in result.columns
    
    def test_rolling_std_values_correct(self, calculator):
        """Test rolling std calculates correct values"""
        series = pd.Series([1, 2, 3, 4, 5])
        result = calculator.calculate_rolling_std(series, [3])
        
        # First value should be NaN (only 1 value, std undefined)
        assert pd.isna(result['rolling_std_3'].iloc[0])
        # Third value should be std of [1, 2, 3]
        expected_std = np.std([1, 2, 3], ddof=1)
        assert np.isclose(result['rolling_std_3'].iloc[2], expected_std)
    
    def test_rolling_std_non_negative(self, calculator, sample_series):
        """Test rolling std values are non-negative"""
        result = calculator.calculate_rolling_std(sample_series, [5, 10])
        
        for col in result.columns:
            assert (result[col].dropna() >= 0).all()
    
    # Rolling Min/Max Tests
    
    def test_rolling_min_max_single_window(self, calculator, sample_series):
        """Test rolling min/max with single window size"""
        result = calculator.calculate_rolling_min_max(sample_series, [5])
        
        assert 'rolling_min_5' in result.columns
        assert 'rolling_max_5' in result.columns
        assert len(result) == len(sample_series)
    
    def test_rolling_min_max_multiple_windows(self, calculator, sample_series):
        """Test rolling min/max with multiple window sizes"""
        windows = [5, 10, 20, 60]
        result = calculator.calculate_rolling_min_max(sample_series, windows)
        
        assert len(result.columns) == len(windows) * 2  # min and max for each window
        for window in windows:
            assert f'rolling_min_{window}' in result.columns
            assert f'rolling_max_{window}' in result.columns
    
    def test_rolling_min_max_values_correct(self, calculator):
        """Test rolling min/max calculate correct values"""
        series = pd.Series([3, 1, 4, 1, 5])
        result = calculator.calculate_rolling_min_max(series, [3])
        
        # Third value should be min/max of [3, 1, 4]
        assert result['rolling_min_3'].iloc[2] == 1
        assert result['rolling_max_3'].iloc[2] == 4
        # Fourth value should be min/max of [1, 4, 1]
        assert result['rolling_min_3'].iloc[3] == 1
        assert result['rolling_max_3'].iloc[3] == 4
    
    def test_rolling_min_less_than_max(self, calculator, sample_series):
        """Test rolling min is always less than or equal to rolling max"""
        result = calculator.calculate_rolling_min_max(sample_series, [5, 10])
        
        assert (result['rolling_min_5'] <= result['rolling_max_5']).all()
        assert (result['rolling_min_10'] <= result['rolling_max_10']).all()
    
    # EWMA Volatility Tests
    
    def test_ewm_volatility_basic(self, calculator):
        """Test EWMA volatility basic calculation"""
        returns = pd.Series(np.random.randn(100) * 0.02)
        result = calculator.calculate_ewm_volatility(returns, span=20)
        
        assert len(result) == len(returns)
        assert not result.isna().all()
    
    def test_ewm_volatility_non_negative(self, calculator):
        """Test EWMA volatility values are non-negative"""
        returns = pd.Series(np.random.randn(100) * 0.02)
        result = calculator.calculate_ewm_volatility(returns, span=20)
        
        assert (result >= 0).all()
    
    def test_ewm_volatility_zero_returns(self, calculator):
        """Test EWMA volatility with zero returns"""
        returns = pd.Series([0.0] * 50)
        result = calculator.calculate_ewm_volatility(returns, span=20)
        
        assert (result == 0).all()
    
    def test_ewm_volatility_constant_returns(self, calculator):
        """Test EWMA volatility with constant non-zero returns"""
        returns = pd.Series([0.01] * 50)
        result = calculator.calculate_ewm_volatility(returns, span=20)
        
        # Volatility should converge to the absolute value of constant return
        assert result.iloc[-1] > 0
    
    def test_ewm_volatility_different_spans(self, calculator):
        """Test EWMA volatility with different span values"""
        returns = pd.Series(np.random.randn(100) * 0.02)
        
        result_10 = calculator.calculate_ewm_volatility(returns, span=10)
        result_20 = calculator.calculate_ewm_volatility(returns, span=20)
        result_30 = calculator.calculate_ewm_volatility(returns, span=30)
        
        # All should have same length
        assert len(result_10) == len(result_20) == len(result_30)
        # Shorter spans should be more reactive (higher variance in volatility)
        assert result_10.std() >= result_30.std()
    
    def test_ewm_volatility_high_volatility_period(self, calculator):
        """Test EWMA volatility detects high volatility periods"""
        # Create returns with low then high volatility
        low_vol = np.random.randn(50) * 0.01
        high_vol = np.random.randn(50) * 0.05
        returns = pd.Series(np.concatenate([low_vol, high_vol]))
        
        result = calculator.calculate_ewm_volatility(returns, span=10)
        
        # Volatility in second half should be higher on average
        first_half_vol = result.iloc[25:50].mean()
        second_half_vol = result.iloc[75:100].mean()
        assert second_half_vol > first_half_vol
    
    # Edge Cases
    
    def test_single_value_series(self, calculator):
        """Test with single value series"""
        series = pd.Series([100.0])
        
        mean_result = calculator.calculate_rolling_mean(series, [5])
        assert mean_result['rolling_mean_5'].iloc[0] == 100.0
        
        minmax_result = calculator.calculate_rolling_min_max(series, [5])
        assert minmax_result['rolling_min_5'].iloc[0] == 100.0
        assert minmax_result['rolling_max_5'].iloc[0] == 100.0
    
    def test_window_larger_than_series(self, calculator):
        """Test with window size larger than series length"""
        series = pd.Series([1, 2, 3, 4, 5])
        result = calculator.calculate_rolling_mean(series, [10])
        
        # Should still calculate with available data
        assert len(result) == 5
        assert not result['rolling_mean_10'].isna().all()
    
    def test_required_windows_specification(self, calculator, sample_series):
        """Test that required windows [5, 10, 20, 60] work correctly"""
        required_windows = [5, 10, 20, 60]
        
        mean_result = calculator.calculate_rolling_mean(sample_series, required_windows)
        std_result = calculator.calculate_rolling_std(sample_series, required_windows)
        minmax_result = calculator.calculate_rolling_min_max(sample_series, required_windows)
        
        # Verify all required columns exist
        for window in required_windows:
            assert f'rolling_mean_{window}' in mean_result.columns
            assert f'rolling_std_{window}' in std_result.columns
            assert f'rolling_min_{window}' in minmax_result.columns
            assert f'rolling_max_{window}' in minmax_result.columns
