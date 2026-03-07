"""
Tests for Feature Engineering Lambda

Unit tests for the feature engineering pipeline orchestration.
"""

import pytest
import pandas as pd
import numpy as np
from src.lambdas.feature_engineering import FeatureEngineeringPipeline


class TestFeatureEngineeringPipeline:
    """Test suite for FeatureEngineeringPipeline"""
    
    @pytest.fixture
    def pipeline(self):
        """Create pipeline instance"""
        return FeatureEngineeringPipeline()
    
    @pytest.fixture
    def sample_market_data(self):
        """Create sample market data"""
        np.random.seed(42)
        dates = pd.date_range('2024-01-01', periods=100, freq='D')
        
        # Generate realistic price data
        prices = 100 + np.random.randn(100).cumsum()
        high = prices + np.random.uniform(0, 2, 100)
        low = prices - np.random.uniform(0, 2, 100)
        close = prices + np.random.uniform(-1, 1, 100)
        volume = np.random.uniform(1000000, 5000000, 100)
        
        data = pd.DataFrame({
            'high': high,
            'low': low,
            'close': close,
            'volume': volume
        }, index=dates)
        
        return data
    
    # Pipeline Initialization Tests
    
    def test_pipeline_initialization(self, pipeline):
        """Test that pipeline initializes all calculators"""
        assert pipeline.technical_calc is not None
        assert pipeline.rolling_calc is not None
        assert pipeline.lag_calc is not None
        assert pipeline.volume_calc is not None
        assert pipeline.normalizer is not None
    
    def test_pipeline_configuration(self, pipeline):
        """Test that pipeline has correct configuration"""
        assert pipeline.rolling_windows == [5, 10, 20, 60]
        assert pipeline.lag_periods == [1, 2, 3, 5, 10]
    
    # Feature Calculation Tests
    
    def test_calculate_features_basic(self, pipeline, sample_market_data):
        """Test basic feature calculation"""
        features = pipeline.calculate_features(sample_market_data)
        
        assert len(features) == len(sample_market_data)
        assert features.index.equals(sample_market_data.index)
    
    def test_calculate_features_includes_technical_indicators(self, pipeline, sample_market_data):
        """Test that technical indicators are included"""
        features = pipeline.calculate_features(sample_market_data)
        
        # Check for technical indicator columns
        assert 'rsi' in features.columns
        assert 'macd_line' in features.columns
        assert 'macd_signal' in features.columns
        assert 'macd_histogram' in features.columns
        assert 'bb_upper' in features.columns
        assert 'bb_middle' in features.columns
        assert 'bb_lower' in features.columns
        assert 'stoch_k' in features.columns
        assert 'stoch_d' in features.columns
        assert 'atr' in features.columns
    
    def test_calculate_features_includes_rolling_stats(self, pipeline, sample_market_data):
        """Test that rolling statistics are included"""
        features = pipeline.calculate_features(sample_market_data)
        
        # Check for rolling statistics columns
        for window in [5, 10, 20, 60]:
            assert f'rolling_mean_{window}' in features.columns
            assert f'rolling_std_{window}' in features.columns
            assert f'rolling_min_{window}' in features.columns
            assert f'rolling_max_{window}' in features.columns
        
        assert 'ewm_volatility' in features.columns
    
    def test_calculate_features_includes_lag_features(self, pipeline, sample_market_data):
        """Test that lag features are included"""
        features = pipeline.calculate_features(sample_market_data)
        
        # Check for lag and diff columns
        for period in [1, 2, 3, 5, 10]:
            assert f'lag_{period}' in features.columns
            assert f'diff_{period}' in features.columns
    
    def test_calculate_features_includes_volume_features(self, pipeline, sample_market_data):
        """Test that volume features are included"""
        features = pipeline.calculate_features(sample_market_data)
        
        # Check for volume feature columns
        assert 'volume_ratio' in features.columns
        assert 'obv' in features.columns
        assert 'vwap' in features.columns
    
    def test_calculate_features_count(self, pipeline, sample_market_data):
        """Test that correct number of features are generated"""
        features = pipeline.calculate_features(sample_market_data)
        
        # Count expected features:
        # Technical: 10 (rsi, macd_line, macd_signal, macd_histogram, bb_upper, bb_middle, bb_lower, stoch_k, stoch_d, atr)
        # Rolling: 17 (4 windows * 4 stats + ewm_volatility)
        # Lag: 10 (5 lags + 5 diffs)
        # Volume: 3 (volume_ratio, obv, vwap)
        # Total: 40 features
        
        assert len(features.columns) >= 40
    
    def test_calculate_features_no_nan_in_later_rows(self, pipeline, sample_market_data):
        """Test that later rows have valid feature values"""
        features = pipeline.calculate_features(sample_market_data)
        
        # After 60 days (max window), most features should be valid
        later_features = features.iloc[60:]
        
        # Check that most columns have valid values
        for col in features.columns:
            valid_ratio = later_features[col].notna().sum() / len(later_features)
            assert valid_ratio > 0.5  # At least 50% valid values
    
    # Normalization Tests
    
    def test_normalize_features_with_fit(self, pipeline, sample_market_data):
        """Test feature normalization with fitting"""
        features = pipeline.calculate_features(sample_market_data)
        normalized = pipeline.normalize_features(features, fit=True)
        
        assert len(normalized) == len(features)
        assert normalized.columns.equals(features.columns)
        assert pipeline.normalizer.is_fitted_
    
    def test_normalize_features_without_fit(self, pipeline, sample_market_data):
        """Test feature normalization without fitting"""
        features = pipeline.calculate_features(sample_market_data)
        
        # First fit
        pipeline.normalize_features(features, fit=True)
        
        # Then transform without fitting
        normalized = pipeline.normalize_features(features, fit=False)
        
        assert len(normalized) == len(features)
    
    def test_normalize_features_centers_values(self, pipeline, sample_market_data):
        """Test that normalization centers feature values"""
        features = pipeline.calculate_features(sample_market_data)
        normalized = pipeline.normalize_features(features, fit=True)
        
        # Check that medians are close to 0
        for col in normalized.columns:
            if normalized[col].notna().sum() > 10:  # Only check columns with enough data
                median = normalized[col].median()
                assert abs(median) < 1.0  # Should be centered around 0
    
    # Process Stock Tests
    
    def test_process_stock_basic(self, pipeline, sample_market_data):
        """Test processing a single stock"""
        result = pipeline.process_stock('PETR4', sample_market_data, fit_normalizer=True)
        
        assert len(result) == len(sample_market_data)
        assert 'symbol' in result.columns
        assert (result['symbol'] == 'PETR4').all()
    
    def test_process_stock_includes_all_features(self, pipeline, sample_market_data):
        """Test that process_stock includes all features"""
        result = pipeline.process_stock('PETR4', sample_market_data, fit_normalizer=True)
        
        # Should have all features plus symbol column
        assert len(result.columns) >= 41  # 40 features + symbol
    
    def test_process_stock_normalizes_features(self, pipeline, sample_market_data):
        """Test that process_stock normalizes features"""
        result = pipeline.process_stock('PETR4', sample_market_data, fit_normalizer=True)
        
        # Check that features are normalized (centered around 0)
        numeric_cols = result.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            if result[col].notna().sum() > 10:
                assert result[col].abs().max() < 20  # Normalized values should be in reasonable range
    
    def test_process_stock_preserves_index(self, pipeline, sample_market_data):
        """Test that process_stock preserves the index"""
        result = pipeline.process_stock('PETR4', sample_market_data, fit_normalizer=True)
        
        assert result.index.equals(sample_market_data.index)
    
    def test_process_multiple_stocks(self, pipeline, sample_market_data):
        """Test processing multiple stocks"""
        # Process first stock with fit
        result1 = pipeline.process_stock('PETR4', sample_market_data, fit_normalizer=True)
        
        # Process second stock without fit (using same normalizer)
        result2 = pipeline.process_stock('VALE3', sample_market_data, fit_normalizer=False)
        
        assert (result1['symbol'] == 'PETR4').all()
        assert (result2['symbol'] == 'VALE3').all()
        assert result1.columns.equals(result2.columns)
    
    # Edge Cases
    
    def test_process_stock_with_minimal_data(self, pipeline):
        """Test processing stock with minimal data"""
        # Create minimal data (just enough for calculations)
        dates = pd.date_range('2024-01-01', periods=70, freq='D')
        data = pd.DataFrame({
            'high': np.random.uniform(100, 110, 70),
            'low': np.random.uniform(90, 100, 70),
            'close': np.random.uniform(95, 105, 70),
            'volume': np.random.uniform(1000000, 2000000, 70)
        }, index=dates)
        
        result = pipeline.process_stock('TEST', data, fit_normalizer=True)
        
        assert len(result) == 70
        assert 'symbol' in result.columns
    
    def test_calculate_features_preserves_datetime_index(self, pipeline, sample_market_data):
        """Test that datetime index is preserved"""
        features = pipeline.calculate_features(sample_market_data)
        
        assert isinstance(features.index, pd.DatetimeIndex)
        assert features.index.equals(sample_market_data.index)
    
    def test_pipeline_handles_different_date_ranges(self, pipeline):
        """Test pipeline with different date ranges"""
        # Create data for different periods
        dates1 = pd.date_range('2024-01-01', periods=100, freq='D')
        dates2 = pd.date_range('2024-06-01', periods=100, freq='D')
        
        data1 = pd.DataFrame({
            'high': np.random.uniform(100, 110, 100),
            'low': np.random.uniform(90, 100, 100),
            'close': np.random.uniform(95, 105, 100),
            'volume': np.random.uniform(1000000, 2000000, 100)
        }, index=dates1)
        
        data2 = pd.DataFrame({
            'high': np.random.uniform(100, 110, 100),
            'low': np.random.uniform(90, 100, 100),
            'close': np.random.uniform(95, 105, 100),
            'volume': np.random.uniform(1000000, 2000000, 100)
        }, index=dates2)
        
        result1 = pipeline.process_stock('STOCK1', data1, fit_normalizer=True)
        result2 = pipeline.process_stock('STOCK2', data2, fit_normalizer=False)
        
        assert len(result1) == 100
        assert len(result2) == 100
        assert result1.index.equals(dates1)
        assert result2.index.equals(dates2)
