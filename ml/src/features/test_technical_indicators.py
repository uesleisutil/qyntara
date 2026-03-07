"""
Unit tests for Technical Indicators Calculator

Tests verify that all technical indicators are calculated correctly
using industry-standard formulas.
"""

import pytest
import pandas as pd
import numpy as np
from src.features.technical_indicators import TechnicalIndicatorsCalculator


@pytest.fixture
def calculator():
    """Fixture providing a TechnicalIndicatorsCalculator instance."""
    return TechnicalIndicatorsCalculator()


@pytest.fixture
def sample_prices():
    """Fixture providing sample price data for testing."""
    # Create a simple uptrend with some volatility
    dates = pd.date_range('2024-01-01', periods=50, freq='D')
    prices = pd.Series(
        [100 + i + np.sin(i/3) * 5 for i in range(50)],
        index=dates
    )
    return prices


@pytest.fixture
def sample_ohlc():
    """Fixture providing sample OHLC data for testing."""
    dates = pd.date_range('2024-01-01', periods=50, freq='D')
    np.random.seed(42)
    
    close = pd.Series([100 + i + np.sin(i/3) * 5 for i in range(50)], index=dates)
    high = close + np.random.uniform(1, 3, 50)
    low = close - np.random.uniform(1, 3, 50)
    
    return high, low, close


class TestRSI:
    """Tests for RSI calculation."""
    
    def test_rsi_returns_series(self, calculator, sample_prices):
        """Test that RSI returns a pandas Series."""
        rsi = calculator.calculate_rsi(sample_prices)
        assert isinstance(rsi, pd.Series)
    
    def test_rsi_length_matches_input(self, calculator, sample_prices):
        """Test that RSI output has same length as input."""
        rsi = calculator.calculate_rsi(sample_prices)
        assert len(rsi) == len(sample_prices)
    
    def test_rsi_range(self, calculator, sample_prices):
        """Test that RSI values are between 0 and 100."""
        rsi = calculator.calculate_rsi(sample_prices)
        valid_rsi = rsi.dropna()
        assert (valid_rsi >= 0).all()
        assert (valid_rsi <= 100).all()
    
    def test_rsi_uptrend(self, calculator):
        """Test that RSI is high during strong uptrend."""
        # Create strong uptrend
        uptrend = pd.Series(range(100, 150))
        rsi = calculator.calculate_rsi(uptrend, period=14)
        # RSI should be above 70 (overbought) in strong uptrend
        assert rsi.iloc[-1] > 70
    
    def test_rsi_downtrend(self, calculator):
        """Test that RSI is low during strong downtrend."""
        # Create strong downtrend
        downtrend = pd.Series(range(150, 100, -1))
        rsi = calculator.calculate_rsi(downtrend, period=14)
        # RSI should be below 30 (oversold) in strong downtrend
        assert rsi.iloc[-1] < 30
    
    def test_rsi_custom_period(self, calculator, sample_prices):
        """Test RSI with custom period."""
        rsi_14 = calculator.calculate_rsi(sample_prices, period=14)
        rsi_7 = calculator.calculate_rsi(sample_prices, period=7)
        # Different periods should give different results
        assert not rsi_14.equals(rsi_7)


class TestMACD:
    """Tests for MACD calculation."""
    
    def test_macd_returns_three_series(self, calculator, sample_prices):
        """Test that MACD returns three Series."""
        macd_line, signal_line, histogram = calculator.calculate_macd(sample_prices)
        assert isinstance(macd_line, pd.Series)
        assert isinstance(signal_line, pd.Series)
        assert isinstance(histogram, pd.Series)
    
    def test_macd_length_matches_input(self, calculator, sample_prices):
        """Test that MACD outputs have same length as input."""
        macd_line, signal_line, histogram = calculator.calculate_macd(sample_prices)
        assert len(macd_line) == len(sample_prices)
        assert len(signal_line) == len(sample_prices)
        assert len(histogram) == len(sample_prices)
    
    def test_macd_histogram_calculation(self, calculator, sample_prices):
        """Test that histogram equals MACD line minus signal line."""
        macd_line, signal_line, histogram = calculator.calculate_macd(sample_prices)
        expected_histogram = macd_line - signal_line
        pd.testing.assert_series_equal(histogram, expected_histogram)
    
    def test_macd_uptrend(self, calculator):
        """Test that MACD is positive during uptrend."""
        uptrend = pd.Series(range(100, 150))
        macd_line, signal_line, histogram = calculator.calculate_macd(uptrend)
        # MACD should be positive in uptrend
        assert macd_line.iloc[-1] > 0
    
    def test_macd_custom_periods(self, calculator, sample_prices):
        """Test MACD with custom periods."""
        macd1, _, _ = calculator.calculate_macd(sample_prices, fast_period=12, slow_period=26)
        macd2, _, _ = calculator.calculate_macd(sample_prices, fast_period=8, slow_period=17)
        # Different periods should give different results
        assert not macd1.equals(macd2)


class TestBollingerBands:
    """Tests for Bollinger Bands calculation."""
    
    def test_bollinger_returns_three_series(self, calculator, sample_prices):
        """Test that Bollinger Bands returns three Series."""
        upper, middle, lower = calculator.calculate_bollinger_bands(sample_prices)
        assert isinstance(upper, pd.Series)
        assert isinstance(middle, pd.Series)
        assert isinstance(lower, pd.Series)
    
    def test_bollinger_length_matches_input(self, calculator, sample_prices):
        """Test that Bollinger Bands outputs have same length as input."""
        upper, middle, lower = calculator.calculate_bollinger_bands(sample_prices)
        assert len(upper) == len(sample_prices)
        assert len(middle) == len(sample_prices)
        assert len(lower) == len(sample_prices)
    
    def test_bollinger_band_ordering(self, calculator, sample_prices):
        """Test that upper > middle > lower."""
        upper, middle, lower = calculator.calculate_bollinger_bands(sample_prices)
        valid_data = ~(upper.isna() | middle.isna() | lower.isna())
        assert (upper[valid_data] >= middle[valid_data]).all()
        assert (middle[valid_data] >= lower[valid_data]).all()
    
    def test_bollinger_middle_is_sma(self, calculator, sample_prices):
        """Test that middle band equals simple moving average."""
        upper, middle, lower = calculator.calculate_bollinger_bands(sample_prices, period=20)
        expected_sma = sample_prices.rolling(window=20).mean()
        pd.testing.assert_series_equal(middle, expected_sma)
    
    def test_bollinger_custom_std(self, calculator, sample_prices):
        """Test Bollinger Bands with custom standard deviation."""
        upper1, middle1, lower1 = calculator.calculate_bollinger_bands(sample_prices, num_std=2.0)
        upper2, middle2, lower2 = calculator.calculate_bollinger_bands(sample_prices, num_std=3.0)
        # Wider bands with higher std
        assert (upper2.dropna() > upper1.dropna()).any()
        assert (lower2.dropna() < lower1.dropna()).any()


class TestStochastic:
    """Tests for Stochastic Oscillator calculation."""
    
    def test_stochastic_returns_two_series(self, calculator, sample_ohlc):
        """Test that Stochastic returns two Series."""
        high, low, close = sample_ohlc
        stoch_k, stoch_d = calculator.calculate_stochastic(high, low, close)
        assert isinstance(stoch_k, pd.Series)
        assert isinstance(stoch_d, pd.Series)
    
    def test_stochastic_length_matches_input(self, calculator, sample_ohlc):
        """Test that Stochastic outputs have same length as input."""
        high, low, close = sample_ohlc
        stoch_k, stoch_d = calculator.calculate_stochastic(high, low, close)
        assert len(stoch_k) == len(close)
        assert len(stoch_d) == len(close)
    
    def test_stochastic_range(self, calculator, sample_ohlc):
        """Test that Stochastic values are between 0 and 100."""
        high, low, close = sample_ohlc
        stoch_k, stoch_d = calculator.calculate_stochastic(high, low, close)
        valid_k = stoch_k.dropna()
        valid_d = stoch_d.dropna()
        assert (valid_k >= 0).all()
        assert (valid_k <= 100).all()
        assert (valid_d >= 0).all()
        assert (valid_d <= 100).all()
    
    def test_stochastic_at_high(self, calculator):
        """Test that Stochastic is near 100 when price is at period high."""
        # Create data where close equals high
        dates = pd.date_range('2024-01-01', periods=30, freq='D')
        high = pd.Series(range(100, 130), index=dates)
        low = pd.Series(range(90, 120), index=dates)
        close = high.copy()  # Close at high
        
        stoch_k, stoch_d = calculator.calculate_stochastic(high, low, close)
        # %K should be 100 when close equals highest high
        assert stoch_k.iloc[-1] == 100.0
    
    def test_stochastic_at_low(self, calculator):
        """Test that Stochastic is near 0 when price is at period low."""
        # Create data where close is consistently at the low of the range
        dates = pd.date_range('2024-01-01', periods=30, freq='D')
        # Use constant range so close at low means stochastic near 0
        high = pd.Series([110] * 30, index=dates)
        low = pd.Series([100] * 30, index=dates)
        close = low.copy()  # Close at low
        
        stoch_k, stoch_d = calculator.calculate_stochastic(high, low, close)
        # %K should be 0 when close equals lowest low
        assert stoch_k.iloc[-1] == 0.0


class TestATR:
    """Tests for ATR calculation."""
    
    def test_atr_returns_series(self, calculator, sample_ohlc):
        """Test that ATR returns a pandas Series."""
        high, low, close = sample_ohlc
        atr = calculator.calculate_atr(high, low, close)
        assert isinstance(atr, pd.Series)
    
    def test_atr_length_matches_input(self, calculator, sample_ohlc):
        """Test that ATR output has same length as input."""
        high, low, close = sample_ohlc
        atr = calculator.calculate_atr(high, low, close)
        assert len(atr) == len(close)
    
    def test_atr_positive_values(self, calculator, sample_ohlc):
        """Test that ATR values are positive."""
        high, low, close = sample_ohlc
        atr = calculator.calculate_atr(high, low, close)
        valid_atr = atr.dropna()
        assert (valid_atr > 0).all()
    
    def test_atr_high_volatility(self, calculator):
        """Test that ATR is higher during high volatility."""
        dates = pd.date_range('2024-01-01', periods=30, freq='D')
        
        # Low volatility data
        low_vol_close = pd.Series(range(100, 130), index=dates)
        low_vol_high = low_vol_close + 1
        low_vol_low = low_vol_close - 1
        
        # High volatility data
        high_vol_close = pd.Series(range(100, 130), index=dates)
        high_vol_high = high_vol_close + 10
        high_vol_low = high_vol_close - 10
        
        atr_low = calculator.calculate_atr(low_vol_high, low_vol_low, low_vol_close)
        atr_high = calculator.calculate_atr(high_vol_high, high_vol_low, high_vol_close)
        
        # High volatility should have higher ATR
        assert atr_high.iloc[-1] > atr_low.iloc[-1]
    
    def test_atr_custom_period(self, calculator, sample_ohlc):
        """Test ATR with custom period."""
        high, low, close = sample_ohlc
        atr_14 = calculator.calculate_atr(high, low, close, period=14)
        atr_7 = calculator.calculate_atr(high, low, close, period=7)
        # Different periods should give different results
        assert not atr_14.equals(atr_7)


class TestEdgeCases:
    """Tests for edge cases and error handling."""
    
    def test_empty_series(self, calculator):
        """Test handling of empty series."""
        empty = pd.Series([], dtype=float)
        rsi = calculator.calculate_rsi(empty)
        assert len(rsi) == 0
    
    def test_single_value(self, calculator):
        """Test handling of single value."""
        single = pd.Series([100.0])
        rsi = calculator.calculate_rsi(single)
        assert len(rsi) == 1
        assert pd.isna(rsi.iloc[0])
    
    def test_constant_prices(self, calculator):
        """Test handling of constant prices."""
        constant = pd.Series([100.0] * 30)
        rsi = calculator.calculate_rsi(constant)
        # RSI should be NaN or 50 for constant prices (no gains or losses)
        valid_rsi = rsi.dropna()
        if len(valid_rsi) > 0:
            # When there are no gains or losses, RSI approaches 50
            assert all((valid_rsi >= 49) & (valid_rsi <= 51))
    
    def test_nan_handling(self, calculator):
        """Test handling of NaN values in input."""
        prices_with_nan = pd.Series([100, 101, np.nan, 103, 104])
        rsi = calculator.calculate_rsi(prices_with_nan)
        # Should handle NaN gracefully
        assert isinstance(rsi, pd.Series)
        assert len(rsi) == len(prices_with_nan)
