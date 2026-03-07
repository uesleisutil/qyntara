"""
Unit tests for Outlier Treatment Module

Tests verify winsorization, interpolation, and audit logging functionality.
"""

import pytest
import pandas as pd
import numpy as np
import json
import tempfile
import os
from src.features.outlier_treatment import OutlierTreatment


@pytest.fixture
def treatment():
    """Fixture providing an OutlierTreatment instance."""
    return OutlierTreatment()


@pytest.fixture
def sample_data():
    """Fixture providing sample data with outliers."""
    np.random.seed(42)
    return pd.Series([50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 200, -100])


@pytest.fixture
def sample_dataframe():
    """Fixture providing sample DataFrame with outliers."""
    np.random.seed(42)
    return pd.DataFrame({
        'feature1': [50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 200],
        'feature2': [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, -50]
    })


class TestWinsorize:
    """Tests for winsorize method."""
    
    def test_winsorize_returns_series(self, treatment, sample_data):
        """Test that winsorize returns a pandas Series."""
        result = treatment.winsorize(sample_data)
        
        assert isinstance(result, pd.Series)
    
    def test_winsorize_length_matches_input(self, treatment, sample_data):
        """Test that output has same length as input."""
        result = treatment.winsorize(sample_data)
        
        assert len(result) == len(sample_data)
    
    def test_winsorize_caps_upper_outliers(self, treatment):
        """Test that winsorize caps upper outliers."""
        data = pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9, 100])
        
        result = treatment.winsorize(data, lower_percentile=0.1, upper_percentile=0.9)
        
        # Value 100 should be capped at 90th percentile
        assert result.iloc[-1] < 100
        assert result.iloc[-1] <= data.quantile(0.9)
    
    def test_winsorize_caps_lower_outliers(self, treatment):
        """Test that winsorize caps lower outliers."""
        data = pd.Series([-100, 1, 2, 3, 4, 5, 6, 7, 8, 9])
        
        result = treatment.winsorize(data, lower_percentile=0.1, upper_percentile=0.9)
        
        # Value -100 should be capped at 10th percentile
        assert result.iloc[0] > -100
        assert result.iloc[0] >= data.quantile(0.1)
    
    def test_winsorize_default_percentiles(self, treatment, sample_data):
        """Test winsorize with default percentiles (1st and 99th)."""
        result = treatment.winsorize(sample_data)
        
        # Check that extreme values are capped
        assert result.max() <= sample_data.quantile(0.99)
        assert result.min() >= sample_data.quantile(0.01)
    
    def test_winsorize_custom_percentiles(self, treatment, sample_data):
        """Test winsorize with custom percentiles."""
        result = treatment.winsorize(sample_data, lower_percentile=0.05, upper_percentile=0.95)
        
        # Check that values are capped at custom percentiles
        assert result.max() <= sample_data.quantile(0.95)
        assert result.min() >= sample_data.quantile(0.05)
    
    def test_winsorize_preserves_non_outliers(self, treatment):
        """Test that winsorize preserves non-outlier values."""
        data = pd.Series([1, 2, 3, 4, 5, 6, 7, 8, 9, 100])
        
        result = treatment.winsorize(data, lower_percentile=0.1, upper_percentile=0.9)
        
        # Middle values should be unchanged
        assert result.iloc[4] == data.iloc[4]  # Value 5
        assert result.iloc[5] == data.iloc[5]  # Value 6
    
    def test_winsorize_symmetric_outliers(self, treatment):
        """Test winsorize with outliers on both sides."""
        data = pd.Series([-100, 1, 2, 3, 4, 5, 6, 7, 8, 100])
        
        result = treatment.winsorize(data, lower_percentile=0.1, upper_percentile=0.9)
        
        # Both extremes should be capped
        assert result.iloc[0] > -100
        assert result.iloc[-1] < 100
    
    def test_winsorize_no_outliers(self, treatment):
        """Test winsorize with data that has no outliers."""
        data = pd.Series(range(1, 101), dtype=float)
        
        result = treatment.winsorize(data, lower_percentile=0.01, upper_percentile=0.99)
        
        # Winsorization will cap at 1st and 99th percentiles
        # First and last values will be capped
        assert result.iloc[0] >= data.quantile(0.01)
        assert result.iloc[-1] <= data.quantile(0.99)
        # Middle values should be unchanged
        assert result.iloc[50] == data.iloc[50]
    
    def test_winsorize_preserves_index(self, treatment):
        """Test that winsorize preserves series index."""
        data = pd.Series([1, 2, 3, 100], index=['a', 'b', 'c', 'd'])
        
        result = treatment.winsorize(data)
        
        assert result.index.equals(data.index)


class TestInterpolate:
    """Tests for interpolate method."""
    
    def test_interpolate_returns_series(self, treatment):
        """Test that interpolate returns a pandas Series."""
        data = pd.Series([1, 2, np.nan, 4, 5])
        
        result = treatment.interpolate(data)
        
        assert isinstance(result, pd.Series)
    
    def test_interpolate_length_matches_input(self, treatment):
        """Test that output has same length as input."""
        data = pd.Series([1, 2, np.nan, 4, 5])
        
        result = treatment.interpolate(data)
        
        assert len(result) == len(data)
    
    def test_interpolate_fills_nan(self, treatment):
        """Test that interpolate fills NaN values."""
        data = pd.Series([1, 2, np.nan, 4, 5])
        
        result = treatment.interpolate(data)
        
        # NaN should be filled
        assert not result.isna().any()
    
    def test_interpolate_linear_method(self, treatment):
        """Test linear interpolation."""
        data = pd.Series([1.0, 2.0, np.nan, 4.0, 5.0])
        
        result = treatment.interpolate(data, method='linear')
        
        # Linear interpolation: (2 + 4) / 2 = 3
        assert result.iloc[2] == 3.0
    
    def test_interpolate_multiple_nan(self, treatment):
        """Test interpolation with multiple NaN values."""
        data = pd.Series([1.0, np.nan, np.nan, 4.0])
        
        result = treatment.interpolate(data, method='linear')
        
        # Should interpolate all NaN values
        assert not result.isna().any()
        # Linear interpolation: 1, 2, 3, 4
        assert result.iloc[1] == 2.0
        assert result.iloc[2] == 3.0
    
    def test_interpolate_nan_at_start(self, treatment):
        """Test interpolation with NaN at start."""
        data = pd.Series([np.nan, 2.0, 3.0, 4.0])
        
        result = treatment.interpolate(data)
        
        # Should fill with backward fill
        assert not result.isna().any()
        assert result.iloc[0] == 2.0
    
    def test_interpolate_nan_at_end(self, treatment):
        """Test interpolation with NaN at end."""
        data = pd.Series([1.0, 2.0, 3.0, np.nan])
        
        result = treatment.interpolate(data)
        
        # Should fill with forward fill
        assert not result.isna().any()
        assert result.iloc[-1] == 3.0
    
    def test_interpolate_preserves_non_nan(self, treatment):
        """Test that interpolate preserves non-NaN values."""
        data = pd.Series([1.0, 2.0, np.nan, 4.0, 5.0])
        
        result = treatment.interpolate(data)
        
        # Non-NaN values should be unchanged
        assert result.iloc[0] == 1.0
        assert result.iloc[1] == 2.0
        assert result.iloc[3] == 4.0
        assert result.iloc[4] == 5.0
    
    def test_interpolate_all_nan(self, treatment):
        """Test interpolation with all NaN values."""
        data = pd.Series([np.nan, np.nan, np.nan])
        
        result = treatment.interpolate(data)
        
        # Cannot interpolate all NaN, should remain NaN
        assert result.isna().all()
    
    def test_interpolate_no_nan(self, treatment):
        """Test interpolation with no NaN values."""
        data = pd.Series([1.0, 2.0, 3.0, 4.0])
        
        result = treatment.interpolate(data)
        
        # Should be unchanged
        pd.testing.assert_series_equal(result, data)


class TestLogOutliers:
    """Tests for log_outliers method."""
    
    def test_log_outliers_creates_file(self, treatment):
        """Test that log_outliers creates a file."""
        outliers = pd.DataFrame({
            'timestamp': ['2024-01-01T00:00:00'],
            'stock': ['PETR4'],
            'feature': ['price'],
            'original_value': [1000.0],
            'treated_value': [100.0],
            'treatment_method': ['winsorize']
        })
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
            tmp_path = tmp.name
        
        try:
            treatment.log_outliers(outliers, tmp_path)
            assert os.path.exists(tmp_path)
        finally:
            os.unlink(tmp_path)
    
    def test_log_outliers_json_format(self, treatment):
        """Test that log is in valid JSON format."""
        outliers = pd.DataFrame({
            'timestamp': ['2024-01-01T00:00:00'],
            'stock': ['PETR4'],
            'feature': ['price'],
            'original_value': [1000.0],
            'treated_value': [100.0],
            'treatment_method': ['winsorize']
        })
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
            tmp_path = tmp.name
        
        try:
            treatment.log_outliers(outliers, tmp_path)
            
            # Read and parse JSON
            with open(tmp_path, 'r') as f:
                log_data = json.load(f)
            
            assert isinstance(log_data, dict)
            assert 'entries' in log_data
            assert 'log_created_at' in log_data
            assert 'total_outliers' in log_data
        finally:
            os.unlink(tmp_path)
    
    def test_log_outliers_contains_all_fields(self, treatment):
        """Test that log contains all required fields."""
        outliers = pd.DataFrame({
            'timestamp': ['2024-01-01T00:00:00'],
            'stock': ['PETR4'],
            'feature': ['price'],
            'original_value': [1000.0],
            'treated_value': [100.0],
            'treatment_method': ['winsorize']
        })
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
            tmp_path = tmp.name
        
        try:
            treatment.log_outliers(outliers, tmp_path)
            
            with open(tmp_path, 'r') as f:
                log_data = json.load(f)
            
            entry = log_data['entries'][0]
            assert 'timestamp' in entry
            assert 'stock' in entry
            assert 'feature' in entry
            assert 'original_value' in entry
            assert 'treated_value' in entry
            assert 'treatment_method' in entry
        finally:
            os.unlink(tmp_path)
    
    def test_log_outliers_multiple_entries(self, treatment):
        """Test logging multiple outliers."""
        outliers = pd.DataFrame({
            'timestamp': ['2024-01-01T00:00:00', '2024-01-01T00:01:00'],
            'stock': ['PETR4', 'VALE3'],
            'feature': ['price', 'volume'],
            'original_value': [1000.0, 5000.0],
            'treated_value': [100.0, 500.0],
            'treatment_method': ['winsorize', 'interpolate']
        })
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
            tmp_path = tmp.name
        
        try:
            treatment.log_outliers(outliers, tmp_path)
            
            with open(tmp_path, 'r') as f:
                log_data = json.load(f)
            
            assert log_data['total_outliers'] == 2
            assert len(log_data['entries']) == 2
        finally:
            os.unlink(tmp_path)
    
    def test_log_outliers_empty_dataframe(self, treatment):
        """Test logging with empty DataFrame."""
        outliers = pd.DataFrame(columns=[
            'timestamp', 'stock', 'feature', 'original_value', 
            'treated_value', 'treatment_method'
        ])
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
            tmp_path = tmp.name
        
        try:
            treatment.log_outliers(outliers, tmp_path)
            
            with open(tmp_path, 'r') as f:
                log_data = json.load(f)
            
            assert log_data['total_outliers'] == 0
            assert len(log_data['entries']) == 0
        finally:
            os.unlink(tmp_path)


class TestTreatOutliersForTraining:
    """Tests for treat_outliers_for_training method."""
    
    def test_treat_training_returns_tuple(self, treatment, sample_dataframe):
        """Test that method returns tuple of (data, log)."""
        outlier_mask = pd.DataFrame({
            'feature1': [False] * 10 + [True],
            'feature2': [False] * 10 + [True]
        })
        
        result = treatment.treat_outliers_for_training(
            sample_dataframe, outlier_mask, 'PETR4'
        )
        
        assert isinstance(result, tuple)
        assert len(result) == 2
    
    def test_treat_training_applies_winsorization(self, treatment, sample_dataframe):
        """Test that training treatment applies winsorization."""
        outlier_mask = pd.DataFrame({
            'feature1': [False] * 10 + [True],
            'feature2': [False] * 10 + [True]
        })
        
        treated_data, audit_log = treatment.treat_outliers_for_training(
            sample_dataframe, outlier_mask, 'PETR4'
        )
        
        # Outliers should be capped
        assert treated_data['feature1'].iloc[-1] < sample_dataframe['feature1'].iloc[-1]
        assert treated_data['feature2'].iloc[-1] > sample_dataframe['feature2'].iloc[-1]
    
    def test_treat_training_creates_audit_log(self, treatment, sample_dataframe):
        """Test that training treatment creates audit log."""
        outlier_mask = pd.DataFrame({
            'feature1': [False] * 10 + [True],
            'feature2': [False] * 10 + [True]
        })
        
        treated_data, audit_log = treatment.treat_outliers_for_training(
            sample_dataframe, outlier_mask, 'PETR4'
        )
        
        assert isinstance(audit_log, pd.DataFrame)
        assert len(audit_log) == 2  # Two outliers
        assert 'stock' in audit_log.columns
        assert 'feature' in audit_log.columns
        assert 'original_value' in audit_log.columns
        assert 'treated_value' in audit_log.columns
    
    def test_treat_training_no_outliers(self, treatment, sample_dataframe):
        """Test training treatment with no outliers."""
        outlier_mask = pd.DataFrame({
            'feature1': [False] * 11,
            'feature2': [False] * 11
        })
        
        treated_data, audit_log = treatment.treat_outliers_for_training(
            sample_dataframe, outlier_mask, 'PETR4'
        )
        
        # Data should be unchanged
        pd.testing.assert_frame_equal(treated_data, sample_dataframe)
        # Log should be empty
        assert len(audit_log) == 0


class TestTreatOutliersForPrediction:
    """Tests for treat_outliers_for_prediction method."""
    
    def test_treat_prediction_returns_tuple(self, treatment, sample_dataframe):
        """Test that method returns tuple of (data, log)."""
        outlier_mask = pd.DataFrame({
            'feature1': [False] * 10 + [True],
            'feature2': [False] * 10 + [True]
        })
        
        result = treatment.treat_outliers_for_prediction(
            sample_dataframe, outlier_mask, 'PETR4'
        )
        
        assert isinstance(result, tuple)
        assert len(result) == 2
    
    def test_treat_prediction_applies_interpolation(self, treatment):
        """Test that prediction treatment applies interpolation."""
        data = pd.DataFrame({
            'feature1': [1.0, 2.0, 3.0, 4.0, 100.0],  # Last value is outlier
            'feature2': [10.0, 20.0, 30.0, 40.0, 50.0]
        })
        outlier_mask = pd.DataFrame({
            'feature1': [False, False, False, False, True],
            'feature2': [False, False, False, False, False]
        })
        
        treated_data, audit_log = treatment.treat_outliers_for_prediction(
            data, outlier_mask, 'PETR4'
        )
        
        # Outlier should be interpolated (not 100)
        assert treated_data['feature1'].iloc[-1] != 100.0
        # Should be close to expected value (forward fill from 4.0)
        assert treated_data['feature1'].iloc[-1] == 4.0
    
    def test_treat_prediction_creates_audit_log(self, treatment, sample_dataframe):
        """Test that prediction treatment creates audit log."""
        outlier_mask = pd.DataFrame({
            'feature1': [False] * 10 + [True],
            'feature2': [False] * 10 + [True]
        })
        
        treated_data, audit_log = treatment.treat_outliers_for_prediction(
            sample_dataframe, outlier_mask, 'PETR4'
        )
        
        assert isinstance(audit_log, pd.DataFrame)
        assert len(audit_log) == 2  # Two outliers
        assert 'stock' in audit_log.columns
        assert 'treatment_method' in audit_log.columns
        assert all(audit_log['treatment_method'] == 'interpolate')
    
    def test_treat_prediction_no_outliers(self, treatment, sample_dataframe):
        """Test prediction treatment with no outliers."""
        outlier_mask = pd.DataFrame({
            'feature1': [False] * 11,
            'feature2': [False] * 11
        })
        
        treated_data, audit_log = treatment.treat_outliers_for_prediction(
            sample_dataframe, outlier_mask, 'PETR4'
        )
        
        # Data should be unchanged
        pd.testing.assert_frame_equal(treated_data, sample_dataframe)
        # Log should be empty
        assert len(audit_log) == 0


class TestEdgeCases:
    """Tests for edge cases."""
    
    def test_winsorize_single_value(self, treatment):
        """Test winsorize with single value."""
        data = pd.Series([100.0])
        
        result = treatment.winsorize(data)
        
        # Single value should be unchanged
        assert result.iloc[0] == 100.0
    
    def test_winsorize_all_same(self, treatment):
        """Test winsorize with all same values."""
        data = pd.Series([100.0] * 10)
        
        result = treatment.winsorize(data)
        
        # All values should be unchanged
        pd.testing.assert_series_equal(result, data)
    
    def test_interpolate_single_nan(self, treatment):
        """Test interpolate with single NaN."""
        data = pd.Series([np.nan])
        
        result = treatment.interpolate(data)
        
        # Cannot interpolate single NaN
        assert result.isna().all()
    
    def test_treat_training_empty_dataframe(self, treatment):
        """Test training treatment with empty DataFrame."""
        data = pd.DataFrame()
        outlier_mask = pd.DataFrame()
        
        treated_data, audit_log = treatment.treat_outliers_for_training(
            data, outlier_mask, 'PETR4'
        )
        
        assert len(treated_data) == 0
        assert len(audit_log) == 0
    
    def test_treat_prediction_empty_dataframe(self, treatment):
        """Test prediction treatment with empty DataFrame."""
        data = pd.DataFrame()
        outlier_mask = pd.DataFrame()
        
        treated_data, audit_log = treatment.treat_outliers_for_prediction(
            data, outlier_mask, 'PETR4'
        )
        
        assert len(treated_data) == 0
        assert len(audit_log) == 0
