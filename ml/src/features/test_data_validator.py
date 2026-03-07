"""
Unit tests for Data Validator

Tests verify completeness, schema, and logging functionality.
"""

import pytest
import pandas as pd
import numpy as np
import json
import tempfile
import os
from src.features.data_validator import DataValidator


@pytest.fixture
def validator():
    """Fixture providing a DataValidator instance."""
    return DataValidator()


@pytest.fixture
def sample_data():
    """Fixture providing sample data."""
    return pd.DataFrame({
        'price': [100.0, 101.0, 102.0, 103.0, 104.0],
        'volume': [1000, 1100, 1200, 1300, 1400],
        'returns': [0.01, 0.01, 0.01, 0.01, 0.01]
    })


@pytest.fixture
def sample_data_with_missing():
    """Fixture providing sample data with missing values."""
    return pd.DataFrame({
        'price': [100.0, 101.0, np.nan, 103.0, 104.0],  # 20% missing
        'volume': [1000, np.nan, np.nan, 1300, 1400],  # 40% missing
        'returns': [0.01, 0.01, 0.01, 0.01, 0.01]  # 0% missing
    })


class TestValidateCompleteness:
    """Tests for validate_completeness method."""
    
    def test_returns_tuple(self, validator, sample_data):
        """Test that method returns a tuple."""
        result = validator.validate_completeness(sample_data)
        
        assert isinstance(result, tuple)
        assert len(result) == 2
    
    def test_complete_data(self, validator, sample_data):
        """Test validation with complete data."""
        is_valid, invalid_cols = validator.validate_completeness(sample_data)
        
        assert is_valid
        assert len(invalid_cols) == 0
    
    def test_data_below_threshold(self, validator):
        """Test validation with missing data below threshold."""
        data = pd.DataFrame({
            'col1': [1, 2, np.nan, 4, 5, 6, 7, 8, 9, 10]  # 10% missing
        })
        
        is_valid, invalid_cols = validator.validate_completeness(data, threshold=0.20)
        
        assert is_valid
        assert len(invalid_cols) == 0
    
    def test_data_above_threshold(self, validator, sample_data_with_missing):
        """Test validation with missing data above threshold."""
        is_valid, invalid_cols = validator.validate_completeness(
            sample_data_with_missing, 
            threshold=0.20
        )
        
        assert not is_valid
        assert 'volume' in invalid_cols  # 40% missing
        assert 'price' not in invalid_cols  # 20% missing (not above threshold)
    
    def test_threshold_at_20_percent(self, validator):
        """Test validation at exactly 20% threshold."""
        data = pd.DataFrame({
            'col1': [1, 2, 3, 4, 5, 6, 7, 8, 9, np.nan] * 2  # Exactly 10% missing
        })
        
        is_valid, invalid_cols = validator.validate_completeness(data, threshold=0.20)
        
        assert is_valid
        assert len(invalid_cols) == 0
    
    def test_empty_dataframe(self, validator):
        """Test validation with empty DataFrame."""
        data = pd.DataFrame()
        
        is_valid, invalid_cols = validator.validate_completeness(data)
        
        assert is_valid
        assert len(invalid_cols) == 0
    
    def test_all_missing(self, validator):
        """Test validation with all missing data."""
        data = pd.DataFrame({
            'col1': [np.nan] * 10
        })
        
        is_valid, invalid_cols = validator.validate_completeness(data, threshold=0.20)
        
        assert not is_valid
        assert 'col1' in invalid_cols
    
    def test_custom_threshold(self, validator):
        """Test validation with custom threshold."""
        data = pd.DataFrame({
            'col1': [1, 2, np.nan, 4, 5]  # 20% missing
        })
        
        # With 10% threshold, should fail
        is_valid, invalid_cols = validator.validate_completeness(data, threshold=0.10)
        assert not is_valid
        assert 'col1' in invalid_cols
        
        # With 30% threshold, should pass
        is_valid, invalid_cols = validator.validate_completeness(data, threshold=0.30)
        assert is_valid
        assert len(invalid_cols) == 0


class TestValidateSchema:
    """Tests for validate_schema method."""
    
    def test_returns_bool(self, validator, sample_data):
        """Test that method returns a boolean."""
        result = validator.validate_schema(sample_data, ['price', 'volume'])
        
        assert isinstance(result, bool)
    
    def test_valid_schema_non_strict(self, validator, sample_data):
        """Test validation with valid schema (non-strict)."""
        is_valid = validator.validate_schema(
            sample_data, 
            ['price', 'volume'],
            strict=False
        )
        
        assert is_valid
    
    def test_valid_schema_strict(self, validator, sample_data):
        """Test validation with valid schema (strict)."""
        is_valid = validator.validate_schema(
            sample_data, 
            ['price', 'volume', 'returns'],
            strict=True
        )
        
        assert is_valid
    
    def test_missing_columns_non_strict(self, validator, sample_data):
        """Test validation with missing columns (non-strict)."""
        is_valid = validator.validate_schema(
            sample_data, 
            ['price', 'volume', 'missing_col'],
            strict=False
        )
        
        assert not is_valid
    
    def test_extra_columns_strict(self, validator, sample_data):
        """Test validation with extra columns (strict)."""
        is_valid = validator.validate_schema(
            sample_data, 
            ['price', 'volume'],  # Missing 'returns'
            strict=True
        )
        
        assert not is_valid
    
    def test_extra_columns_non_strict(self, validator, sample_data):
        """Test validation with extra columns (non-strict)."""
        is_valid = validator.validate_schema(
            sample_data, 
            ['price'],  # Has extra columns but non-strict
            strict=False
        )
        
        assert is_valid
    
    def test_empty_expected_columns(self, validator, sample_data):
        """Test validation with empty expected columns."""
        is_valid = validator.validate_schema(sample_data, [], strict=False)
        
        assert is_valid
    
    def test_empty_dataframe(self, validator):
        """Test validation with empty DataFrame."""
        data = pd.DataFrame()
        
        is_valid = validator.validate_schema(data, ['col1'], strict=False)
        
        assert not is_valid


class TestValidateDataTypes:
    """Tests for validate_data_types method."""
    
    def test_returns_tuple(self, validator, sample_data):
        """Test that method returns a tuple."""
        result = validator.validate_data_types(sample_data, {'price': float})
        
        assert isinstance(result, tuple)
        assert len(result) == 2
    
    def test_valid_types(self, validator, sample_data):
        """Test validation with valid types."""
        is_valid, invalid_cols = validator.validate_data_types(
            sample_data,
            {'price': float, 'volume': int}
        )
        
        assert is_valid
        assert len(invalid_cols) == 0
    
    def test_invalid_types(self, validator):
        """Test validation with invalid types."""
        data = pd.DataFrame({
            'col1': [1, 2, 3],
            'col2': ['a', 'b', 'c']
        })
        
        is_valid, invalid_cols = validator.validate_data_types(
            data,
            {'col1': str, 'col2': int}
        )
        
        assert not is_valid
        assert 'col1' in invalid_cols
        assert 'col2' in invalid_cols
    
    def test_float_accepts_int(self, validator):
        """Test that float type accepts integer data."""
        data = pd.DataFrame({
            'col1': [1, 2, 3]  # Integer data
        })
        
        is_valid, invalid_cols = validator.validate_data_types(
            data,
            {'col1': float}  # Expecting float
        )
        
        assert is_valid
        assert len(invalid_cols) == 0
    
    def test_missing_column(self, validator, sample_data):
        """Test validation with missing column."""
        is_valid, invalid_cols = validator.validate_data_types(
            sample_data,
            {'missing_col': float}
        )
        
        assert not is_valid
        assert 'missing_col' in invalid_cols
    
    def test_string_type(self, validator):
        """Test validation with string type."""
        data = pd.DataFrame({
            'col1': ['a', 'b', 'c']
        })
        
        is_valid, invalid_cols = validator.validate_data_types(
            data,
            {'col1': str}
        )
        
        assert is_valid
        assert len(invalid_cols) == 0


class TestValidateValueRanges:
    """Tests for validate_value_ranges method."""
    
    def test_returns_tuple(self, validator, sample_data):
        """Test that method returns a tuple."""
        result = validator.validate_value_ranges(sample_data, {'price': (0, 200)})
        
        assert isinstance(result, tuple)
        assert len(result) == 2
    
    def test_valid_ranges(self, validator, sample_data):
        """Test validation with valid ranges."""
        is_valid, invalid_rows = validator.validate_value_ranges(
            sample_data,
            {'price': (0, 200), 'volume': (0, 2000)}
        )
        
        assert is_valid
        assert len(invalid_rows) == 0
    
    def test_values_below_min(self, validator):
        """Test validation with values below minimum."""
        data = pd.DataFrame({
            'col1': [1, 2, -5, 4, 5]
        })
        
        is_valid, invalid_rows = validator.validate_value_ranges(
            data,
            {'col1': (0, 10)}
        )
        
        assert not is_valid
        assert 'col1' in invalid_rows
        assert len(invalid_rows['col1']) > 0
    
    def test_values_above_max(self, validator):
        """Test validation with values above maximum."""
        data = pd.DataFrame({
            'col1': [1, 2, 3, 4, 100]
        })
        
        is_valid, invalid_rows = validator.validate_value_ranges(
            data,
            {'col1': (0, 10)}
        )
        
        assert not is_valid
        assert 'col1' in invalid_rows
    
    def test_unbounded_min(self, validator):
        """Test validation with unbounded minimum."""
        data = pd.DataFrame({
            'col1': [-100, 1, 2, 3, 4]
        })
        
        is_valid, invalid_rows = validator.validate_value_ranges(
            data,
            {'col1': (None, 10)}
        )
        
        assert is_valid
        assert len(invalid_rows) == 0
    
    def test_unbounded_max(self, validator):
        """Test validation with unbounded maximum."""
        data = pd.DataFrame({
            'col1': [1, 2, 3, 4, 1000]
        })
        
        is_valid, invalid_rows = validator.validate_value_ranges(
            data,
            {'col1': (0, None)}
        )
        
        assert is_valid
        assert len(invalid_rows) == 0
    
    def test_ignores_nan(self, validator):
        """Test that validation ignores NaN values."""
        data = pd.DataFrame({
            'col1': [1, 2, np.nan, 4, 5]
        })
        
        is_valid, invalid_rows = validator.validate_value_ranges(
            data,
            {'col1': (0, 10)}
        )
        
        assert is_valid
        assert len(invalid_rows) == 0


class TestValidateNoDuplicates:
    """Tests for validate_no_duplicates method."""
    
    def test_returns_tuple(self, validator, sample_data):
        """Test that method returns a tuple."""
        result = validator.validate_no_duplicates(sample_data)
        
        assert isinstance(result, tuple)
        assert len(result) == 2
    
    def test_no_duplicates(self, validator, sample_data):
        """Test validation with no duplicates."""
        is_valid, duplicates = validator.validate_no_duplicates(sample_data)
        
        assert is_valid
        assert len(duplicates) == 0
    
    def test_with_duplicates(self, validator):
        """Test validation with duplicates."""
        data = pd.DataFrame({
            'col1': [1, 2, 3, 1, 2],
            'col2': ['a', 'b', 'c', 'a', 'b']
        })
        
        is_valid, duplicates = validator.validate_no_duplicates(data)
        
        assert not is_valid
        assert len(duplicates) > 0
    
    def test_subset_columns(self, validator):
        """Test validation with subset of columns."""
        data = pd.DataFrame({
            'col1': [1, 2, 3, 1],
            'col2': ['a', 'b', 'c', 'd']  # Different values
        })
        
        # Check duplicates only in col1
        is_valid, duplicates = validator.validate_no_duplicates(data, subset=['col1'])
        
        assert not is_valid
        assert len(duplicates) > 0
    
    def test_empty_dataframe(self, validator):
        """Test validation with empty DataFrame."""
        data = pd.DataFrame()
        
        is_valid, duplicates = validator.validate_no_duplicates(data)
        
        assert is_valid
        assert len(duplicates) == 0


class TestLogValidationResults:
    """Tests for log_validation_results method."""
    
    def test_creates_file(self, validator):
        """Test that log_validation_results creates a file."""
        results = {
            'timestamp': '2024-01-01T00:00:00',
            'completeness_valid': True
        }
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
            tmp_path = tmp.name
        
        try:
            validator.log_validation_results(results, tmp_path)
            assert os.path.exists(tmp_path)
        finally:
            os.unlink(tmp_path)
    
    def test_json_format(self, validator):
        """Test that log is in valid JSON format."""
        results = {
            'timestamp': '2024-01-01T00:00:00',
            'completeness_valid': True,
            'schema_valid': True
        }
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
            tmp_path = tmp.name
        
        try:
            validator.log_validation_results(results, tmp_path)
            
            with open(tmp_path, 'r') as f:
                log_data = json.load(f)
            
            assert isinstance(log_data, dict)
            assert 'log_created_at' in log_data
            assert 'validation_results' in log_data
        finally:
            os.unlink(tmp_path)
    
    def test_contains_all_results(self, validator):
        """Test that log contains all validation results."""
        results = {
            'timestamp': '2024-01-01T00:00:00',
            'completeness_valid': True,
            'schema_valid': False,
            'type_valid': True
        }
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
            tmp_path = tmp.name
        
        try:
            validator.log_validation_results(results, tmp_path)
            
            with open(tmp_path, 'r') as f:
                log_data = json.load(f)
            
            validation_results = log_data['validation_results']
            assert validation_results['completeness_valid'] == True
            assert validation_results['schema_valid'] == False
            assert validation_results['type_valid'] == True
        finally:
            os.unlink(tmp_path)


class TestValidateAll:
    """Tests for validate_all method."""
    
    def test_returns_tuple(self, validator, sample_data):
        """Test that method returns a tuple."""
        result = validator.validate_all(sample_data)
        
        assert isinstance(result, tuple)
        assert len(result) == 2
    
    def test_all_validations_pass(self, validator, sample_data):
        """Test when all validations pass."""
        all_valid, results = validator.validate_all(
            sample_data,
            expected_columns=['price', 'volume', 'returns'],
            expected_types={'price': float, 'volume': int},
            value_ranges={'price': (0, 200)},
            check_duplicates=True
        )
        
        assert all_valid
        assert results['completeness_valid']
        assert results['schema_valid']
        assert results['type_valid']
        assert results['range_valid']
        assert results['duplicates_valid']
    
    def test_some_validations_fail(self, validator, sample_data_with_missing):
        """Test when some validations fail."""
        all_valid, results = validator.validate_all(
            sample_data_with_missing,
            completeness_threshold=0.20
        )
        
        assert not all_valid
        assert not results['completeness_valid']
        assert 'volume' in results['completeness_invalid_columns']
    
    def test_minimal_validation(self, validator, sample_data):
        """Test with minimal validation (only completeness)."""
        all_valid, results = validator.validate_all(sample_data)
        
        assert all_valid
        assert results['completeness_valid']
        assert 'completeness' in results['validations_run']
    
    def test_logs_results(self, validator, sample_data):
        """Test that results are logged when path provided."""
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
            tmp_path = tmp.name
        
        try:
            all_valid, results = validator.validate_all(
                sample_data,
                log_path=tmp_path
            )
            
            assert os.path.exists(tmp_path)
            
            with open(tmp_path, 'r') as f:
                log_data = json.load(f)
            
            assert 'validation_results' in log_data
        finally:
            os.unlink(tmp_path)
    
    def test_results_structure(self, validator, sample_data):
        """Test structure of results dictionary."""
        all_valid, results = validator.validate_all(
            sample_data,
            expected_columns=['price'],
            expected_types={'price': float}
        )
        
        assert 'timestamp' in results
        assert 'data_shape' in results
        assert 'validations_run' in results
        assert 'all_validations_passed' in results
        assert results['data_shape'] == sample_data.shape
    
    def test_empty_dataframe(self, validator):
        """Test validate_all with empty DataFrame."""
        data = pd.DataFrame()
        
        all_valid, results = validator.validate_all(data)
        
        assert all_valid
        assert results['completeness_valid']


class TestEdgeCases:
    """Tests for edge cases."""
    
    def test_single_row(self, validator):
        """Test validation with single row."""
        data = pd.DataFrame({
            'col1': [1]
        })
        
        is_valid, invalid_cols = validator.validate_completeness(data)
        
        assert is_valid
    
    def test_single_column(self, validator):
        """Test validation with single column."""
        data = pd.DataFrame({
            'col1': [1, 2, 3, 4, 5]
        })
        
        is_valid = validator.validate_schema(data, ['col1'])
        
        assert is_valid
    
    def test_large_dataset(self, validator):
        """Test validation with large dataset."""
        data = pd.DataFrame({
            'col1': range(10000)
        })
        
        is_valid, invalid_cols = validator.validate_completeness(data)
        
        assert is_valid
    
    def test_mixed_types(self, validator):
        """Test validation with mixed types."""
        data = pd.DataFrame({
            'col1': [1, 2, 3],
            'col2': ['a', 'b', 'c'],
            'col3': [1.0, 2.0, 3.0]
        })
        
        is_valid, invalid_cols = validator.validate_data_types(
            data,
            {'col1': int, 'col2': str, 'col3': float}
        )
        
        assert is_valid
