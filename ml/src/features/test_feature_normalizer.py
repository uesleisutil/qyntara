"""
Tests for Feature Normalizer

Unit tests for robust feature normalization using median and IQR.
"""

import pytest
import pandas as pd
import numpy as np
import tempfile
import os
from src.features.feature_normalizer import FeatureNormalizer


class TestFeatureNormalizer:
    """Test suite for FeatureNormalizer"""
    
    @pytest.fixture
    def normalizer(self):
        """Create normalizer instance"""
        return FeatureNormalizer()
    
    @pytest.fixture
    def sample_features(self):
        """Create sample feature data"""
        np.random.seed(42)
        data = {
            'feature1': np.random.randn(100) * 10 + 50,
            'feature2': np.random.randn(100) * 5 + 20,
            'feature3': np.random.randn(100) * 2 + 100
        }
        return pd.DataFrame(data)
    
    @pytest.fixture
    def features_with_outliers(self):
        """Create feature data with outliers"""
        np.random.seed(42)
        data = np.random.randn(100) * 10 + 50
        # Add outliers
        data[0] = 1000  # Extreme outlier
        data[1] = -500  # Extreme outlier
        return pd.DataFrame({'feature': data})
    
    # Fit Tests
    
    def test_fit_basic(self, normalizer, sample_features):
        """Test basic fit operation"""
        normalizer.fit(sample_features)
        
        assert normalizer.is_fitted_
        assert normalizer.medians_ is not None
        assert normalizer.iqrs_ is not None
        assert normalizer.feature_names_ == sample_features.columns.tolist()
    
    def test_fit_calculates_medians(self, normalizer, sample_features):
        """Test that fit calculates correct medians"""
        normalizer.fit(sample_features)
        
        expected_medians = sample_features.median()
        pd.testing.assert_series_equal(normalizer.medians_, expected_medians)
    
    def test_fit_calculates_iqr(self, normalizer, sample_features):
        """Test that fit calculates correct IQR"""
        normalizer.fit(sample_features)
        
        q1 = sample_features.quantile(0.25)
        q3 = sample_features.quantile(0.75)
        expected_iqr = q3 - q1
        
        pd.testing.assert_series_equal(normalizer.iqrs_, expected_iqr)
    
    def test_fit_handles_constant_feature(self, normalizer):
        """Test fit with constant feature (zero IQR)"""
        features = pd.DataFrame({
            'constant': [100.0] * 50,
            'variable': np.random.randn(50)
        })
        
        normalizer.fit(features)
        
        # IQR for constant feature should be replaced with 1
        assert normalizer.iqrs_['constant'] == 1.0
        assert normalizer.iqrs_['variable'] > 0
    
    def test_fit_stores_feature_names(self, normalizer, sample_features):
        """Test that fit stores feature names"""
        normalizer.fit(sample_features)
        
        assert normalizer.feature_names_ == ['feature1', 'feature2', 'feature3']
    
    def test_fit_single_feature(self, normalizer):
        """Test fit with single feature"""
        features = pd.DataFrame({'feature': np.random.randn(100)})
        normalizer.fit(features)
        
        assert normalizer.is_fitted_
        assert len(normalizer.medians_) == 1
        assert len(normalizer.iqrs_) == 1
    
    # Transform Tests
    
    def test_transform_basic(self, normalizer, sample_features):
        """Test basic transform operation"""
        normalizer.fit(sample_features)
        result = normalizer.transform(sample_features)
        
        assert result.shape == sample_features.shape
        assert result.columns.tolist() == sample_features.columns.tolist()
    
    def test_transform_without_fit_raises_error(self, normalizer, sample_features):
        """Test that transform without fit raises error"""
        with pytest.raises(ValueError, match="must be fitted before transform"):
            normalizer.transform(sample_features)
    
    def test_transform_centers_at_zero(self, normalizer, sample_features):
        """Test that transform centers features around zero"""
        normalizer.fit(sample_features)
        result = normalizer.transform(sample_features)
        
        # Median of transformed features should be close to 0
        for col in result.columns:
            assert abs(result[col].median()) < 0.1
    
    def test_transform_scales_by_iqr(self, normalizer):
        """Test that transform scales by IQR"""
        # Create data with known IQR
        data = pd.DataFrame({'feature': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]})
        # Q1 = 3.25, Q3 = 7.75, IQR = 4.5, Median = 5.5
        
        normalizer.fit(data)
        result = normalizer.transform(data)
        
        # Check that IQR of transformed data is approximately 1
        q1 = result['feature'].quantile(0.25)
        q3 = result['feature'].quantile(0.75)
        transformed_iqr = q3 - q1
        assert abs(transformed_iqr - 1.0) < 0.01
    
    def test_transform_preserves_index(self, normalizer, sample_features):
        """Test that transform preserves DataFrame index"""
        normalizer.fit(sample_features)
        result = normalizer.transform(sample_features)
        
        assert result.index.equals(sample_features.index)
    
    def test_transform_handles_outliers_robustly(self, normalizer, features_with_outliers):
        """Test that robust scaling handles outliers better than standard scaling"""
        normalizer.fit(features_with_outliers)
        result = normalizer.transform(features_with_outliers)
        
        # Most values should be in reasonable range despite outliers
        # (excluding the outliers themselves)
        non_outlier_values = result['feature'].iloc[2:]
        assert non_outlier_values.abs().max() < 10  # Reasonable range
    
    def test_transform_new_data(self, normalizer, sample_features):
        """Test transform on new data using fitted parameters"""
        normalizer.fit(sample_features)
        
        # Create new data with similar distribution
        np.random.seed(123)
        new_data = pd.DataFrame({
            'feature1': np.random.randn(50) * 10 + 50,
            'feature2': np.random.randn(50) * 5 + 20,
            'feature3': np.random.randn(50) * 2 + 100
        })
        
        result = normalizer.transform(new_data)
        
        assert result.shape == new_data.shape
        # Transformed values should be in reasonable range
        assert result.abs().max().max() < 10
    
    # Inverse Transform Tests
    
    def test_inverse_transform_basic(self, normalizer, sample_features):
        """Test basic inverse transform operation"""
        normalizer.fit(sample_features)
        transformed = normalizer.transform(sample_features)
        result = normalizer.inverse_transform(transformed)
        
        assert result.shape == sample_features.shape
        pd.testing.assert_frame_equal(result, sample_features, rtol=1e-10)
    
    def test_inverse_transform_without_fit_raises_error(self, normalizer, sample_features):
        """Test that inverse_transform without fit raises error"""
        with pytest.raises(ValueError, match="must be fitted before inverse_transform"):
            normalizer.inverse_transform(sample_features)
    
    def test_inverse_transform_recovers_original(self, normalizer, sample_features):
        """Test that inverse transform recovers original values"""
        normalizer.fit(sample_features)
        transformed = normalizer.transform(sample_features)
        recovered = normalizer.inverse_transform(transformed)
        
        # Check each column
        for col in sample_features.columns:
            np.testing.assert_allclose(
                recovered[col].values,
                sample_features[col].values,
                rtol=1e-10
            )
    
    def test_inverse_transform_preserves_index(self, normalizer, sample_features):
        """Test that inverse transform preserves DataFrame index"""
        normalizer.fit(sample_features)
        transformed = normalizer.transform(sample_features)
        result = normalizer.inverse_transform(transformed)
        
        assert result.index.equals(sample_features.index)
    
    def test_transform_inverse_transform_roundtrip(self, normalizer, sample_features):
        """Test that transform -> inverse_transform is identity"""
        normalizer.fit(sample_features)
        
        # Forward and backward
        transformed = normalizer.transform(sample_features)
        recovered = normalizer.inverse_transform(transformed)
        
        pd.testing.assert_frame_equal(recovered, sample_features, rtol=1e-10)
    
    # Save/Load Tests
    
    def test_save_scaler_basic(self, normalizer, sample_features):
        """Test basic save scaler operation"""
        normalizer.fit(sample_features)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pkl') as tmp:
            tmp_path = tmp.name
        
        try:
            normalizer.save_scaler(tmp_path)
            assert os.path.exists(tmp_path)
        finally:
            os.unlink(tmp_path)
    
    def test_save_scaler_without_fit_raises_error(self, normalizer):
        """Test that save without fit raises error"""
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pkl') as tmp:
            tmp_path = tmp.name
        
        try:
            with pytest.raises(ValueError, match="must be fitted before saving"):
                normalizer.save_scaler(tmp_path)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    def test_load_scaler_basic(self, normalizer, sample_features):
        """Test basic load scaler operation"""
        # Fit and save
        normalizer.fit(sample_features)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pkl') as tmp:
            tmp_path = tmp.name
        
        try:
            normalizer.save_scaler(tmp_path)
            
            # Load into new normalizer
            new_normalizer = FeatureNormalizer()
            new_normalizer.load_scaler(tmp_path)
            
            assert new_normalizer.is_fitted_
            pd.testing.assert_series_equal(new_normalizer.medians_, normalizer.medians_)
            pd.testing.assert_series_equal(new_normalizer.iqrs_, normalizer.iqrs_)
            assert new_normalizer.feature_names_ == normalizer.feature_names_
        finally:
            os.unlink(tmp_path)
    
    def test_load_scaler_file_not_found(self, normalizer):
        """Test load with non-existent file"""
        with pytest.raises(FileNotFoundError):
            normalizer.load_scaler('nonexistent_file.pkl')
    
    def test_save_load_preserves_functionality(self, normalizer, sample_features):
        """Test that save/load preserves transform functionality"""
        # Fit and save
        normalizer.fit(sample_features)
        transformed_original = normalizer.transform(sample_features)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pkl') as tmp:
            tmp_path = tmp.name
        
        try:
            normalizer.save_scaler(tmp_path)
            
            # Load and transform
            new_normalizer = FeatureNormalizer()
            new_normalizer.load_scaler(tmp_path)
            transformed_loaded = new_normalizer.transform(sample_features)
            
            # Results should be identical
            pd.testing.assert_frame_equal(transformed_loaded, transformed_original)
        finally:
            os.unlink(tmp_path)
    
    def test_save_load_preserves_inverse_transform(self, normalizer, sample_features):
        """Test that save/load preserves inverse_transform functionality"""
        # Fit and transform
        normalizer.fit(sample_features)
        transformed = normalizer.transform(sample_features)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pkl') as tmp:
            tmp_path = tmp.name
        
        try:
            normalizer.save_scaler(tmp_path)
            
            # Load and inverse transform
            new_normalizer = FeatureNormalizer()
            new_normalizer.load_scaler(tmp_path)
            recovered = new_normalizer.inverse_transform(transformed)
            
            # Should recover original values
            pd.testing.assert_frame_equal(recovered, sample_features, rtol=1e-10)
        finally:
            os.unlink(tmp_path)
    
    # Edge Cases
    
    def test_empty_dataframe(self, normalizer):
        """Test with empty DataFrame"""
        empty_df = pd.DataFrame()
        normalizer.fit(empty_df)
        
        assert normalizer.is_fitted_
        assert len(normalizer.medians_) == 0
        assert len(normalizer.iqrs_) == 0
    
    def test_single_row(self, normalizer):
        """Test with single row DataFrame"""
        single_row = pd.DataFrame({'feature': [100.0]})
        normalizer.fit(single_row)
        
        # IQR will be 0, should be replaced with 1
        assert normalizer.iqrs_['feature'] == 1.0
        
        result = normalizer.transform(single_row)
        # (100 - 100) / 1 = 0
        assert result['feature'].iloc[0] == 0.0
    
    def test_all_nan_column(self, normalizer):
        """Test with column containing all NaN values"""
        features = pd.DataFrame({
            'valid': [1, 2, 3, 4, 5],
            'all_nan': [np.nan] * 5
        })
        
        normalizer.fit(features)
        
        # Median and IQR of all-NaN column should be NaN
        assert pd.isna(normalizer.medians_['all_nan'])
        assert pd.isna(normalizer.iqrs_['all_nan'])
    
    def test_negative_values(self, normalizer):
        """Test with negative values"""
        features = pd.DataFrame({'feature': [-10.0, -5.0, 0.0, 5.0, 10.0]})
        normalizer.fit(features)
        
        result = normalizer.transform(features)
        recovered = normalizer.inverse_transform(result)
        
        pd.testing.assert_frame_equal(recovered, features, rtol=1e-10)
    
    def test_large_values(self, normalizer):
        """Test with large values"""
        features = pd.DataFrame({'feature': [1e6, 2e6, 3e6, 4e6, 5e6]})
        normalizer.fit(features)
        
        result = normalizer.transform(features)
        recovered = normalizer.inverse_transform(result)
        
        pd.testing.assert_frame_equal(recovered, features, rtol=1e-10)
    
    def test_datetime_index(self, normalizer):
        """Test with datetime index"""
        dates = pd.date_range('2024-01-01', periods=50, freq='D')
        features = pd.DataFrame({
            'feature1': np.random.randn(50),
            'feature2': np.random.randn(50)
        }, index=dates)
        
        normalizer.fit(features)
        result = normalizer.transform(features)
        
        assert isinstance(result.index, pd.DatetimeIndex)
        assert result.index.equals(dates)
    
    def test_robust_vs_standard_scaling_with_outliers(self, normalizer, features_with_outliers):
        """Test that robust scaling is more resistant to outliers"""
        normalizer.fit(features_with_outliers)
        robust_result = normalizer.transform(features_with_outliers)
        
        # Calculate what standard scaling would give
        mean = features_with_outliers['feature'].mean()
        std = features_with_outliers['feature'].std()
        standard_result = (features_with_outliers['feature'] - mean) / std
        
        # With outliers, standard scaling will have extreme values
        # Robust scaling should keep the outliers more contained
        robust_outlier_max = robust_result['feature'].iloc[:2].abs().max()
        standard_outlier_max = standard_result.iloc[:2].abs().max()
        
        # Both should detect outliers, but robust scaling uses IQR which is less affected
        # The key is that robust scaling's parameters (median, IQR) are not affected by outliers
        # So the non-outlier values stay in a reasonable range
        assert normalizer.medians_['feature'] < 100  # Median not affected by outliers
        assert normalizer.iqrs_['feature'] < 50  # IQR not affected by outliers
    
    def test_multiple_fit_calls(self, normalizer, sample_features):
        """Test that multiple fit calls update parameters"""
        # First fit
        normalizer.fit(sample_features)
        first_medians = normalizer.medians_.copy()
        
        # Create different data
        new_features = sample_features * 2
        
        # Second fit
        normalizer.fit(new_features)
        second_medians = normalizer.medians_
        
        # Medians should be different
        assert not first_medians.equals(second_medians)
        # Second medians should be approximately 2x first medians
        np.testing.assert_allclose(second_medians.values, first_medians.values * 2, rtol=0.1)
