"""
Unit tests for Interpolation Handler

Tests verify forward fill, linear interpolation, and exclusion logic.
"""

import pytest
import pandas as pd
import numpy as np
import logging
from src.features.interpolation_handler import InterpolationHandler


@pytest.fixture
def handler():
    """Fixture providing an InterpolationHandler instance."""
    return InterpolationHandler()


@pytest.fixture
def handler_with_logger():
    """Fixture providing an InterpolationHandler with logger."""
    logger = logging.getLogger('test')
    return InterpolationHandler(logger=logger)


class TestForwardFill:
    """Tests for forward_fill method."""
    
    def test_returns_series(self, handler):
        """Test that forward_fill returns a pandas Series."""
        data = pd.Series([1, 2, np.nan, 4, 5])
        
        result = handler.forward_fill(data)
        
        assert isinstance(result, pd.Series)
    
    def test_fills_single_nan(self, handler):
        """Test forward fill with single NaN."""
        data = pd.Series([1.0, 2.0, np.nan, 4.0, 5.0])
        
        result = handler.forward_fill(data)
        
        assert result.iloc[2] == 2.0  # Forward filled from previous value
    
    def test_fills_multiple_consecutive_nan(self, handler):
        """Test forward fill with multiple consecutive NaN."""
        data = pd.Series([1.0, 2.0, np.nan, np.nan, 5.0])
        
        result = handler.forward_fill(data)
        
        assert result.iloc[2] == 2.0
        assert result.iloc[3] == 2.0
    
    def test_fills_nan_at_start(self, handler):
        """Test forward fill with NaN at start."""
        data = pd.Series([np.nan, 2.0, 3.0, 4.0])
        
        result = handler.forward_fill(data)
        
        # Should use backward fill for start
        assert result.iloc[0] == 2.0
    
    def test_fills_nan_at_end(self, handler):
        """Test forward fill with NaN at end."""
        data = pd.Series([1.0, 2.0, 3.0, np.nan])
        
        result = handler.forward_fill(data)
        
        assert result.iloc[-1] == 3.0
    
    def test_no_nan(self, handler):
        """Test forward fill with no NaN."""
        data = pd.Series([1.0, 2.0, 3.0, 4.0])
        
        result = handler.forward_fill(data)
        
        pd.testing.assert_series_equal(result, data)
    
    def test_preserves_non_nan_values(self, handler):
        """Test that forward fill preserves non-NaN values."""
        data = pd.Series([1.0, 2.0, np.nan, 4.0, 5.0])
        
        result = handler.forward_fill(data)
        
        assert result.iloc[0] == 1.0
        assert result.iloc[1] == 2.0
        assert result.iloc[3] == 4.0
        assert result.iloc[4] == 5.0


class TestLinearInterpolate:
    """Tests for linear_interpolate method."""
    
    def test_returns_series(self, handler):
        """Test that linear_interpolate returns a pandas Series."""
        data = pd.Series([1, 2, np.nan, 4, 5])
        
        result = handler.linear_interpolate(data)
        
        assert isinstance(result, pd.Series)
    
    def test_interpolates_single_nan(self, handler):
        """Test linear interpolation with single NaN."""
        data = pd.Series([1.0, 2.0, np.nan, 4.0, 5.0])
        
        result = handler.linear_interpolate(data)
        
        # Linear interpolation: (2 + 4) / 2 = 3
        assert result.iloc[2] == 3.0
    
    def test_interpolates_multiple_nan(self, handler):
        """Test linear interpolation with multiple NaN."""
        data = pd.Series([1.0, np.nan, np.nan, 4.0])
        
        result = handler.linear_interpolate(data)
        
        # Linear interpolation: 1, 2, 3, 4
        assert result.iloc[1] == 2.0
        assert result.iloc[2] == 3.0
    
    def test_interpolates_nan_at_start(self, handler):
        """Test linear interpolation with NaN at start."""
        data = pd.Series([np.nan, 2.0, 3.0, 4.0])
        
        result = handler.linear_interpolate(data)
        
        # Should use backward fill
        assert result.iloc[0] == 2.0
    
    def test_interpolates_nan_at_end(self, handler):
        """Test linear interpolation with NaN at end."""
        data = pd.Series([1.0, 2.0, 3.0, np.nan])
        
        result = handler.linear_interpolate(data)
        
        # Should use forward fill
        assert result.iloc[-1] == 3.0
    
    def test_no_nan(self, handler):
        """Test linear interpolation with no NaN."""
        data = pd.Series([1.0, 2.0, 3.0, 4.0])
        
        result = handler.linear_interpolate(data)
        
        pd.testing.assert_series_equal(result, data)
    
    def test_preserves_non_nan_values(self, handler):
        """Test that linear interpolation preserves non-NaN values."""
        data = pd.Series([1.0, 2.0, np.nan, 4.0, 5.0])
        
        result = handler.linear_interpolate(data)
        
        assert result.iloc[0] == 1.0
        assert result.iloc[1] == 2.0
        assert result.iloc[3] == 4.0
        assert result.iloc[4] == 5.0


class TestSplineInterpolate:
    """Tests for spline_interpolate method."""
    
    def test_returns_series(self, handler):
        """Test that spline_interpolate returns a pandas Series."""
        data = pd.Series([1, 2, np.nan, 4, 5, 6, 7])
        
        result = handler.spline_interpolate(data)
        
        assert isinstance(result, pd.Series)
    
    def test_interpolates_with_sufficient_data(self, handler):
        """Test spline interpolation with sufficient data points."""
        data = pd.Series([1.0, 2.0, np.nan, 4.0, 5.0, 6.0])
        
        result = handler.spline_interpolate(data)
        
        # Should fill the NaN
        assert not result.isna().any()
    
    def test_falls_back_to_linear_insufficient_data(self, handler):
        """Test spline falls back to linear with insufficient data."""
        data = pd.Series([1.0, np.nan, 3.0])  # Only 2 non-NaN values
        
        result = handler.spline_interpolate(data, order=3)
        
        # Should fall back to linear and fill
        assert not result.isna().any()
        assert result.iloc[1] == 2.0  # Linear interpolation
    
    def test_custom_order(self, handler):
        """Test spline interpolation with custom order."""
        data = pd.Series([1.0, 2.0, np.nan, 4.0, 5.0, 6.0, 7.0])
        
        result = handler.spline_interpolate(data, order=2)
        
        assert not result.isna().any()


class TestHandleMissingData:
    """Tests for handle_missing_data method."""
    
    def test_returns_tuple(self, handler):
        """Test that method returns a tuple of 3 elements."""
        data = pd.DataFrame({
            'col1': [1, 2, 3, 4, 5],
            'col2': [1, np.nan, 3, 4, 5]
        })
        missing_pct = pd.Series({'col1': 0.0, 'col2': 20.0})
        
        result = handler.handle_missing_data(data, missing_pct)
        
        assert isinstance(result, tuple)
        assert len(result) == 3
    
    def test_forward_fill_below_5_percent(self, handler):
        """Test forward fill strategy for < 5% missing."""
        data = pd.DataFrame({
            'col1': [1.0, 2.0, np.nan, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]  # 10% missing
        })
        missing_pct = pd.Series({'col1': 4.0})  # < 5%
        
        treated_data, excluded, log = handler.handle_missing_data(data, missing_pct)
        
        assert not treated_data['col1'].isna().any()
        assert len(excluded) == 0
        assert log[log['column'] == 'col1']['strategy'].iloc[0] == 'forward_fill'
    
    def test_linear_interpolation_5_to_20_percent(self, handler):
        """Test linear interpolation strategy for 5-20% missing."""
        data = pd.DataFrame({
            'col1': [1.0, np.nan, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]  # 10% missing
        })
        missing_pct = pd.Series({'col1': 10.0})  # 5-20%
        
        treated_data, excluded, log = handler.handle_missing_data(data, missing_pct)
        
        assert not treated_data['col1'].isna().any()
        assert len(excluded) == 0
        assert log[log['column'] == 'col1']['strategy'].iloc[0] == 'linear_interpolation'
    
    def test_exclude_above_20_percent(self, handler):
        """Test exclusion strategy for > 20% missing."""
        data = pd.DataFrame({
            'col1': [1.0, 2.0, 3.0, 4.0, 5.0],
            'col2': [np.nan, np.nan, np.nan, 4.0, 5.0]  # 60% missing
        })
        missing_pct = pd.Series({'col1': 0.0, 'col2': 60.0})
        
        treated_data, excluded, log = handler.handle_missing_data(data, missing_pct)
        
        assert 'col2' in excluded
        assert 'col2' not in treated_data.columns
        assert log[log['column'] == 'col2']['strategy'].iloc[0] == 'exclude'
    
    def test_mixed_strategies(self, handler):
        """Test handling multiple columns with different strategies."""
        data = pd.DataFrame({
            'col1': [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0],  # 0% missing
            'col2': [1.0, np.nan, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0],  # 10% missing
            'col3': [1.0, np.nan, np.nan, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0],  # 20% missing
            'col4': [np.nan] * 10  # 100% missing
        })
        missing_pct = pd.Series({'col1': 0.0, 'col2': 3.0, 'col3': 15.0, 'col4': 100.0})
        
        treated_data, excluded, log = handler.handle_missing_data(data, missing_pct)
        
        # col1: no treatment needed
        assert log[log['column'] == 'col1']['strategy'].iloc[0] == 'none'
        
        # col2: forward fill (< 5%)
        assert log[log['column'] == 'col2']['strategy'].iloc[0] == 'forward_fill'
        
        # col3: linear interpolation (5-20%)
        assert log[log['column'] == 'col3']['strategy'].iloc[0] == 'linear_interpolation'
        
        # col4: exclude (> 20%)
        assert 'col4' in excluded
        assert 'col4' not in treated_data.columns
    
    def test_boundary_at_5_percent(self, handler):
        """Test boundary condition at exactly 5%."""
        data = pd.DataFrame({
            'col1': [1.0] * 19 + [np.nan]  # Exactly 5% missing
        })
        missing_pct = pd.Series({'col1': 5.0})
        
        treated_data, excluded, log = handler.handle_missing_data(data, missing_pct)
        
        # At 5%, should use linear interpolation
        assert log[log['column'] == 'col1']['strategy'].iloc[0] == 'linear_interpolation'
    
    def test_boundary_at_20_percent(self, handler):
        """Test boundary condition at exactly 20%."""
        data = pd.DataFrame({
            'col1': [1.0] * 8 + [np.nan] * 2  # Exactly 20% missing
        })
        missing_pct = pd.Series({'col1': 20.0})
        
        treated_data, excluded, log = handler.handle_missing_data(data, missing_pct)
        
        # At 20%, should use linear interpolation (not exclude)
        assert log[log['column'] == 'col1']['strategy'].iloc[0] == 'linear_interpolation'
        assert 'col1' not in excluded


class TestHandleStockData:
    """Tests for handle_stock_data method."""
    
    def test_returns_tuple(self, handler):
        """Test that method returns a tuple of 4 elements."""
        data = pd.DataFrame({
            'price': [1, 2, 3, 4, 5],
            'volume': [100, 200, 300, 400, 500]
        })
        
        result = handler.handle_stock_data(data, 'PETR4')
        
        assert isinstance(result, tuple)
        assert len(result) == 4
    
    def test_no_missing_data(self, handler):
        """Test handling stock with no missing data."""
        data = pd.DataFrame({
            'price': [1, 2, 3, 4, 5],
            'volume': [100, 200, 300, 400, 500]
        })
        
        treated_data, should_exclude, strategy, missing_pct = handler.handle_stock_data(data, 'PETR4')
        
        assert not should_exclude
        assert strategy == 'none'
        assert missing_pct == 0.0
        pd.testing.assert_frame_equal(treated_data, data)
    
    def test_below_5_percent_missing(self, handler):
        """Test handling stock with < 5% missing data."""
        # Create data with < 5% missing (1 out of 25 = 4%)
        data = pd.DataFrame({
            'price': [1.0, 2.0, np.nan, 4.0, 5.0] + [6.0] * 20,  # 4% missing (1/25)
            'volume': [100.0] * 25
        })
        
        treated_data, should_exclude, strategy, missing_pct = handler.handle_stock_data(data, 'PETR4')
        
        assert not should_exclude
        assert strategy == 'forward_fill'
        assert missing_pct < 5.0
        assert not treated_data.isna().any().any()
    
    def test_5_to_20_percent_missing(self, handler):
        """Test handling stock with 5-20% missing data."""
        data = pd.DataFrame({
            'price': [1.0, np.nan, 3.0, 4.0, 5.0] * 2,  # 20% missing
            'volume': [100.0] * 10
        })
        
        treated_data, should_exclude, strategy, missing_pct = handler.handle_stock_data(data, 'PETR4')
        
        assert not should_exclude
        assert strategy == 'linear_interpolation'
        assert 5.0 <= missing_pct <= 20.0
        assert not treated_data.isna().any().any()
    
    def test_above_20_percent_missing(self, handler):
        """Test handling stock with > 20% missing data."""
        data = pd.DataFrame({
            'price': [np.nan] * 5 + [1.0] * 5,  # 50% missing
            'volume': [100.0] * 10
        })
        
        treated_data, should_exclude, strategy, missing_pct = handler.handle_stock_data(data, 'PETR4')
        
        assert should_exclude
        assert strategy == 'exclude'
        assert missing_pct > 20.0
    
    def test_calculates_overall_missing_percentage(self, handler):
        """Test that overall missing percentage is calculated correctly."""
        data = pd.DataFrame({
            'price': [1.0, np.nan, 3.0, 4.0, 5.0],  # 20% missing
            'volume': [100.0, 200.0, 300.0, 400.0, 500.0]  # 0% missing
        })
        # Overall: 1 missing out of 10 values = 10%
        
        treated_data, should_exclude, strategy, missing_pct = handler.handle_stock_data(data, 'PETR4')
        
        assert missing_pct == 10.0
        assert strategy == 'linear_interpolation'


class TestGetStrategyForPercentage:
    """Tests for get_strategy_for_percentage method."""
    
    def test_none_strategy(self, handler):
        """Test strategy for 0% missing."""
        strategy = handler.get_strategy_for_percentage(0.0)
        
        assert strategy == 'none'
    
    def test_forward_fill_strategy(self, handler):
        """Test strategy for < 5% missing."""
        assert handler.get_strategy_for_percentage(1.0) == 'forward_fill'
        assert handler.get_strategy_for_percentage(4.9) == 'forward_fill'
    
    def test_linear_interpolation_strategy(self, handler):
        """Test strategy for 5-20% missing."""
        assert handler.get_strategy_for_percentage(5.0) == 'linear_interpolation'
        assert handler.get_strategy_for_percentage(10.0) == 'linear_interpolation'
        assert handler.get_strategy_for_percentage(20.0) == 'linear_interpolation'
    
    def test_exclude_strategy(self, handler):
        """Test strategy for > 20% missing."""
        assert handler.get_strategy_for_percentage(20.1) == 'exclude'
        assert handler.get_strategy_for_percentage(50.0) == 'exclude'
        assert handler.get_strategy_for_percentage(100.0) == 'exclude'
    
    def test_boundary_conditions(self, handler):
        """Test boundary conditions."""
        # Exactly 5% should be linear interpolation
        assert handler.get_strategy_for_percentage(5.0) == 'linear_interpolation'
        
        # Exactly 20% should be linear interpolation
        assert handler.get_strategy_for_percentage(20.0) == 'linear_interpolation'
        
        # Just above 20% should be exclude
        assert handler.get_strategy_for_percentage(20.01) == 'exclude'


class TestEdgeCases:
    """Tests for edge cases."""
    
    def test_empty_dataframe(self, handler):
        """Test with empty DataFrame."""
        data = pd.DataFrame()
        missing_pct = pd.Series(dtype=float)
        
        treated_data, excluded, log = handler.handle_missing_data(data, missing_pct)
        
        assert len(treated_data) == 0
        assert len(excluded) == 0
        assert len(log) == 0
    
    def test_single_value(self, handler):
        """Test with single value."""
        data = pd.Series([1.0])
        
        result = handler.forward_fill(data)
        
        assert result.iloc[0] == 1.0
    
    def test_all_nan(self, handler):
        """Test with all NaN values."""
        data = pd.Series([np.nan] * 5)
        
        result = handler.forward_fill(data)
        
        # Cannot fill all NaN
        assert result.isna().all()
    
    def test_alternating_nan(self, handler):
        """Test with alternating NaN pattern."""
        data = pd.Series([1.0, np.nan, 3.0, np.nan, 5.0])
        
        result = handler.linear_interpolate(data)
        
        assert result.iloc[1] == 2.0
        assert result.iloc[3] == 4.0
    
    def test_stock_data_empty(self, handler):
        """Test handle_stock_data with empty DataFrame."""
        data = pd.DataFrame()
        
        treated_data, should_exclude, strategy, missing_pct = handler.handle_stock_data(data, 'PETR4')
        
        assert missing_pct == 0.0
        assert strategy == 'none'
        assert not should_exclude
