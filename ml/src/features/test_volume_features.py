"""
Tests for Volume Features Calculator

Unit tests for volume ratio, OBV, and VWAP calculations.
"""

import pytest
import pandas as pd
import numpy as np
from src.features.volume_features import VolumeFeaturesCalculator


class TestVolumeFeaturesCalculator:
    """Test suite for VolumeFeaturesCalculator"""
    
    @pytest.fixture
    def calculator(self):
        """Create calculator instance"""
        return VolumeFeaturesCalculator()
    
    @pytest.fixture
    def sample_data(self):
        """Create sample price and volume data"""
        dates = pd.date_range('2024-01-01', periods=100, freq='D')
        np.random.seed(42)
        
        # Generate realistic price data
        prices = 100 + np.random.randn(100).cumsum()
        high = prices + np.random.uniform(0, 2, 100)
        low = prices - np.random.uniform(0, 2, 100)
        close = prices + np.random.uniform(-1, 1, 100)
        
        # Generate volume data
        volume = np.random.uniform(1000000, 5000000, 100)
        
        return {
            'high': pd.Series(high, index=dates),
            'low': pd.Series(low, index=dates),
            'close': pd.Series(close, index=dates),
            'volume': pd.Series(volume, index=dates)
        }
    
    # Volume Ratio Tests
    
    def test_volume_ratio_basic(self, calculator, sample_data):
        """Test basic volume ratio calculation"""
        result = calculator.calculate_volume_ratio(sample_data['volume'], window=20)
        
        assert len(result) == len(sample_data['volume'])
        assert not result.isna().all()
    
    def test_volume_ratio_values_positive(self, calculator, sample_data):
        """Test that volume ratio values are positive"""
        result = calculator.calculate_volume_ratio(sample_data['volume'], window=20)
        
        # All values should be positive (volume is always positive)
        assert (result > 0).all()
    
    def test_volume_ratio_constant_volume(self, calculator):
        """Test volume ratio with constant volume"""
        volume = pd.Series([1000000.0] * 50)
        result = calculator.calculate_volume_ratio(volume, window=20)
        
        # Ratio should be 1.0 for constant volume (after initial period)
        assert np.allclose(result.iloc[20:], 1.0)
    
    def test_volume_ratio_spike_detection(self, calculator):
        """Test volume ratio detects volume spikes"""
        # Create volume with a spike
        volume = pd.Series([1000000.0] * 30)
        volume.iloc[20] = 5000000.0  # 5x spike
        
        result = calculator.calculate_volume_ratio(volume, window=10)
        
        # Ratio at spike should be significantly > 1
        assert result.iloc[20] > 3.0
    
    def test_volume_ratio_different_windows(self, calculator, sample_data):
        """Test volume ratio with different window sizes"""
        result_10 = calculator.calculate_volume_ratio(sample_data['volume'], window=10)
        result_20 = calculator.calculate_volume_ratio(sample_data['volume'], window=20)
        result_50 = calculator.calculate_volume_ratio(sample_data['volume'], window=50)
        
        # All should have same length
        assert len(result_10) == len(result_20) == len(result_50)
        # All should be positive
        assert (result_10 > 0).all()
        assert (result_20 > 0).all()
        assert (result_50 > 0).all()
    
    def test_volume_ratio_default_window(self, calculator, sample_data):
        """Test volume ratio with default window (20)"""
        result = calculator.calculate_volume_ratio(sample_data['volume'])
        
        assert len(result) == len(sample_data['volume'])
        assert not result.isna().all()
    
    def test_volume_ratio_preserves_index(self, calculator, sample_data):
        """Test that volume ratio preserves the original index"""
        result = calculator.calculate_volume_ratio(sample_data['volume'], window=20)
        
        assert result.index.equals(sample_data['volume'].index)
    
    # OBV Tests
    
    def test_obv_basic(self, calculator, sample_data):
        """Test basic OBV calculation"""
        result = calculator.calculate_obv(sample_data['close'], sample_data['volume'])
        
        assert len(result) == len(sample_data['close'])
        assert not result.isna().all()
    
    def test_obv_increasing_prices(self, calculator):
        """Test OBV with consistently increasing prices"""
        close = pd.Series([100, 101, 102, 103, 104])
        volume = pd.Series([1000, 1000, 1000, 1000, 1000])
        
        result = calculator.calculate_obv(close, volume)
        
        # OBV should be increasing (cumulative positive volume)
        assert result.is_monotonic_increasing
    
    def test_obv_decreasing_prices(self, calculator):
        """Test OBV with consistently decreasing prices"""
        close = pd.Series([104, 103, 102, 101, 100])
        volume = pd.Series([1000, 1000, 1000, 1000, 1000])
        
        result = calculator.calculate_obv(close, volume)
        
        # OBV should be decreasing (cumulative negative volume)
        assert result.is_monotonic_decreasing
    
    def test_obv_unchanged_price(self, calculator):
        """Test OBV when price doesn't change"""
        close = pd.Series([100, 100, 100, 100, 100])
        volume = pd.Series([1000, 1000, 1000, 1000, 1000])
        
        result = calculator.calculate_obv(close, volume)
        
        # OBV should remain constant when price doesn't change
        # First value is 0 (no previous price), rest should be 0
        assert (result.iloc[1:] == 0).all()
    
    def test_obv_alternating_prices(self, calculator):
        """Test OBV with alternating up/down prices"""
        close = pd.Series([100, 101, 100, 101, 100])
        volume = pd.Series([1000, 1000, 1000, 1000, 1000])
        
        result = calculator.calculate_obv(close, volume)
        
        # OBV should oscillate
        assert result.iloc[1] == 1000   # Up day
        assert result.iloc[2] == 0      # Down day (1000 - 1000)
        assert result.iloc[3] == 1000   # Up day (0 + 1000)
        assert result.iloc[4] == 0      # Down day (1000 - 1000)
    
    def test_obv_cumulative_property(self, calculator):
        """Test that OBV is cumulative"""
        close = pd.Series([100, 102, 101, 103, 102])
        volume = pd.Series([1000, 2000, 1500, 2500, 1000])
        
        result = calculator.calculate_obv(close, volume)
        
        # Manually calculate expected OBV
        # Day 0: 0 (no previous price)
        # Day 1: 0 + 2000 = 2000 (price up)
        # Day 2: 2000 - 1500 = 500 (price down)
        # Day 3: 500 + 2500 = 3000 (price up)
        # Day 4: 3000 - 1000 = 2000 (price down)
        
        assert result.iloc[0] == 0
        assert result.iloc[1] == 2000
        assert result.iloc[2] == 500
        assert result.iloc[3] == 3000
        assert result.iloc[4] == 2000
    
    def test_obv_preserves_index(self, calculator, sample_data):
        """Test that OBV preserves the original index"""
        result = calculator.calculate_obv(sample_data['close'], sample_data['volume'])
        
        assert result.index.equals(sample_data['close'].index)
    
    def test_obv_different_volume_magnitudes(self, calculator):
        """Test OBV with different volume magnitudes"""
        close = pd.Series([100, 101, 102])
        volume_small = pd.Series([100, 100, 100])
        volume_large = pd.Series([1000000, 1000000, 1000000])
        
        result_small = calculator.calculate_obv(close, volume_small)
        result_large = calculator.calculate_obv(close, volume_large)
        
        # Large volume should produce proportionally larger OBV
        assert result_large.iloc[-1] / result_small.iloc[-1] == 10000
    
    # VWAP Tests
    
    def test_vwap_basic(self, calculator, sample_data):
        """Test basic VWAP calculation"""
        result = calculator.calculate_vwap(
            sample_data['high'],
            sample_data['low'],
            sample_data['close'],
            sample_data['volume']
        )
        
        assert len(result) == len(sample_data['close'])
        assert not result.isna().all()
    
    def test_vwap_values_within_range(self, calculator, sample_data):
        """Test that VWAP values are within high-low range"""
        result = calculator.calculate_vwap(
            sample_data['high'],
            sample_data['low'],
            sample_data['close'],
            sample_data['volume']
        )
        
        # VWAP should generally be between min(low) and max(high)
        # (cumulative, so it's an average over time)
        assert result.min() >= sample_data['low'].min() * 0.9  # Allow small margin
        assert result.max() <= sample_data['high'].max() * 1.1
    
    def test_vwap_constant_prices(self, calculator):
        """Test VWAP with constant prices"""
        high = pd.Series([101.0] * 10)
        low = pd.Series([99.0] * 10)
        close = pd.Series([100.0] * 10)
        volume = pd.Series([1000.0] * 10)
        
        result = calculator.calculate_vwap(high, low, close, volume)
        
        # VWAP should equal typical price (100) for constant prices
        expected_typical_price = (101 + 99 + 100) / 3
        assert np.allclose(result, expected_typical_price)
    
    def test_vwap_typical_price_calculation(self, calculator):
        """Test VWAP typical price component"""
        high = pd.Series([105.0])
        low = pd.Series([95.0])
        close = pd.Series([100.0])
        volume = pd.Series([1000.0])
        
        result = calculator.calculate_vwap(high, low, close, volume)
        
        # Typical price = (105 + 95 + 100) / 3 = 100
        assert result.iloc[0] == 100.0
    
    def test_vwap_weighted_by_volume(self, calculator):
        """Test that VWAP is properly weighted by volume"""
        # Day 1: price 100, volume 1000
        # Day 2: price 110, volume 9000
        # VWAP should be closer to 110 due to higher volume
        
        high = pd.Series([101, 111])
        low = pd.Series([99, 109])
        close = pd.Series([100, 110])
        volume = pd.Series([1000, 9000])
        
        result = calculator.calculate_vwap(high, low, close, volume)
        
        # Day 1 VWAP = 100
        assert result.iloc[0] == 100.0
        
        # Day 2 VWAP = (100*1000 + 110*9000) / (1000 + 9000) = 109
        expected_vwap = (100 * 1000 + 110 * 9000) / 10000
        assert np.isclose(result.iloc[1], expected_vwap)
    
    def test_vwap_cumulative_property(self, calculator):
        """Test that VWAP is cumulative"""
        high = pd.Series([102, 104, 106])
        low = pd.Series([98, 96, 94])
        close = pd.Series([100, 100, 100])
        volume = pd.Series([1000, 1000, 1000])
        
        result = calculator.calculate_vwap(high, low, close, volume)
        
        # Each day has same typical price (100) and volume
        # So VWAP should remain constant at 100
        assert np.allclose(result, 100.0)
    
    def test_vwap_preserves_index(self, calculator, sample_data):
        """Test that VWAP preserves the original index"""
        result = calculator.calculate_vwap(
            sample_data['high'],
            sample_data['low'],
            sample_data['close'],
            sample_data['volume']
        )
        
        assert result.index.equals(sample_data['close'].index)
    
    def test_vwap_increasing_trend(self, calculator):
        """Test VWAP with increasing price trend"""
        high = pd.Series([101, 102, 103, 104, 105])
        low = pd.Series([99, 100, 101, 102, 103])
        close = pd.Series([100, 101, 102, 103, 104])
        volume = pd.Series([1000, 1000, 1000, 1000, 1000])
        
        result = calculator.calculate_vwap(high, low, close, volume)
        
        # VWAP should be increasing with price trend
        assert result.is_monotonic_increasing
    
    # Edge Cases
    
    def test_empty_series(self, calculator):
        """Test with empty series"""
        empty = pd.Series([], dtype=float)
        
        volume_ratio = calculator.calculate_volume_ratio(empty, window=20)
        assert len(volume_ratio) == 0
        
        obv = calculator.calculate_obv(empty, empty)
        assert len(obv) == 0
        
        vwap = calculator.calculate_vwap(empty, empty, empty, empty)
        assert len(vwap) == 0
    
    def test_single_value(self, calculator):
        """Test with single value series"""
        single = pd.Series([100.0])
        volume = pd.Series([1000.0])
        
        volume_ratio = calculator.calculate_volume_ratio(volume, window=20)
        assert len(volume_ratio) == 1
        assert volume_ratio.iloc[0] == 1.0  # Single value / itself = 1
        
        obv = calculator.calculate_obv(single, volume)
        assert len(obv) == 1
        assert obv.iloc[0] == 0  # No previous price to compare
        
        vwap = calculator.calculate_vwap(single, single, single, volume)
        assert len(vwap) == 1
        assert vwap.iloc[0] == 100.0
    
    def test_zero_volume_handling(self, calculator):
        """Test handling of zero volume"""
        close = pd.Series([100, 101, 102])
        volume = pd.Series([1000, 0, 1000])
        
        # Volume ratio with zero volume
        volume_ratio = calculator.calculate_volume_ratio(volume, window=2)
        # Should handle division by zero gracefully (inf or nan)
        assert len(volume_ratio) == 3
        
        # OBV with zero volume
        obv = calculator.calculate_obv(close, volume)
        assert len(obv) == 3
        # Zero volume day should not change OBV
        assert obv.iloc[2] == obv.iloc[1] + 1000
    
    def test_datetime_index_preserved(self, calculator):
        """Test that datetime index is preserved"""
        dates = pd.date_range('2024-01-01', periods=20, freq='D')
        high = pd.Series(range(101, 121), index=dates)
        low = pd.Series(range(99, 119), index=dates)
        close = pd.Series(range(100, 120), index=dates)
        volume = pd.Series([1000] * 20, index=dates)
        
        volume_ratio = calculator.calculate_volume_ratio(volume, window=5)
        obv = calculator.calculate_obv(close, volume)
        vwap = calculator.calculate_vwap(high, low, close, volume)
        
        assert isinstance(volume_ratio.index, pd.DatetimeIndex)
        assert isinstance(obv.index, pd.DatetimeIndex)
        assert isinstance(vwap.index, pd.DatetimeIndex)
        assert volume_ratio.index.equals(dates)
        assert obv.index.equals(dates)
        assert vwap.index.equals(dates)
