"""
Unit tests for Missing Data Analyzer

Tests verify missing percentage calculation and pattern identification.
"""

import pytest
import pandas as pd
import numpy as np
from src.features.missing_data_analyzer import MissingDataAnalyzer


@pytest.fixture
def analyzer():
    """Fixture providing a MissingDataAnalyzer instance."""
    return MissingDataAnalyzer()


@pytest.fixture
def sample_data_no_missing():
    """Fixture providing sample data with no missing values."""
    return pd.DataFrame({
        'stock1': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        'stock2': [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    })


@pytest.fixture
def sample_data_with_missing():
    """Fixture providing sample data with missing values."""
    return pd.DataFrame({
        'stock1': [1, 2, np.nan, 4, 5, 6, 7, 8, 9, 10],  # 10% missing
        'stock2': [10, np.nan, np.nan, 40, 50, 60, 70, 80, 90, 100],  # 20% missing
        'stock3': [np.nan] * 10  # 100% missing
    })


class TestCalculateMissingPercentage:
    """Tests for calculate_missing_percentage method."""
    
    def test_returns_series(self, analyzer, sample_data_no_missing):
        """Test that method returns a pandas Series."""
        result = analyzer.calculate_missing_percentage(sample_data_no_missing)
        
        assert isinstance(result, pd.Series)
    
    def test_no_missing_data(self, analyzer, sample_data_no_missing):
        """Test with data that has no missing values."""
        result = analyzer.calculate_missing_percentage(sample_data_no_missing)
        
        assert all(result == 0.0)
    
    def test_some_missing_data(self, analyzer, sample_data_with_missing):
        """Test with data that has some missing values."""
        result = analyzer.calculate_missing_percentage(sample_data_with_missing)
        
        assert result['stock1'] == 10.0
        assert result['stock2'] == 20.0
        assert result['stock3'] == 100.0
    
    def test_all_missing_data(self, analyzer):
        """Test with data that is completely missing."""
        data = pd.DataFrame({
            'stock1': [np.nan] * 10,
            'stock2': [np.nan] * 10
        })
        
        result = analyzer.calculate_missing_percentage(data)
        
        assert all(result == 100.0)
    
    def test_empty_dataframe(self, analyzer):
        """Test with empty DataFrame."""
        data = pd.DataFrame()
        
        result = analyzer.calculate_missing_percentage(data)
        
        assert len(result) == 0
    
    def test_single_row(self, analyzer):
        """Test with single row DataFrame."""
        data = pd.DataFrame({
            'stock1': [1],
            'stock2': [np.nan]
        })
        
        result = analyzer.calculate_missing_percentage(data)
        
        assert result['stock1'] == 0.0
        assert result['stock2'] == 100.0
    
    def test_percentage_calculation_accuracy(self, analyzer):
        """Test accuracy of percentage calculation."""
        data = pd.DataFrame({
            'stock1': [1, 2, np.nan, 4, 5]  # 1 out of 5 = 20%
        })
        
        result = analyzer.calculate_missing_percentage(data)
        
        assert result['stock1'] == 20.0
    
    def test_multiple_columns_different_percentages(self, analyzer):
        """Test with multiple columns having different missing percentages."""
        data = pd.DataFrame({
            'stock1': [1, np.nan, 3, 4, 5, 6, 7, 8, 9, 10],  # 10%
            'stock2': [1, np.nan, np.nan, 4, 5, 6, 7, 8, 9, 10],  # 20%
            'stock3': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]  # 0%
        })
        
        result = analyzer.calculate_missing_percentage(data)
        
        assert result['stock1'] == 10.0
        assert result['stock2'] == 20.0
        assert result['stock3'] == 0.0


class TestIdentifyMissingPatterns:
    """Tests for identify_missing_patterns method."""
    
    def test_returns_dict(self, analyzer, sample_data_no_missing):
        """Test that method returns a dictionary."""
        result = analyzer.identify_missing_patterns(sample_data_no_missing)
        
        assert isinstance(result, dict)
    
    def test_no_missing_pattern(self, analyzer, sample_data_no_missing):
        """Test pattern identification with no missing data."""
        result = analyzer.identify_missing_patterns(sample_data_no_missing)
        
        assert result['stock1'] == 'none'
        assert result['stock2'] == 'none'
    
    def test_all_missing_pattern(self, analyzer):
        """Test pattern identification with all missing data."""
        data = pd.DataFrame({
            'stock1': [np.nan] * 10
        })
        
        result = analyzer.identify_missing_patterns(data)
        
        assert result['stock1'] == 'all_missing'
    
    def test_random_missing_pattern(self, analyzer):
        """Test pattern identification with random missing data."""
        data = pd.DataFrame({
            'stock1': [1, np.nan, 3, np.nan, 5, 6, np.nan, 8, 9, np.nan, 11, 12, 13, np.nan, 15]
        })
        
        result = analyzer.identify_missing_patterns(data)
        
        assert result['stock1'] == 'random'
    
    def test_consecutive_missing_pattern(self, analyzer):
        """Test pattern identification with consecutive missing data."""
        data = pd.DataFrame({
            'stock1': [1, 2, 3, np.nan, np.nan, np.nan, np.nan, 8, 9, 10]
        })
        
        result = analyzer.identify_missing_patterns(data)
        
        assert result['stock1'] == 'consecutive'
    
    def test_start_missing_pattern(self, analyzer):
        """Test pattern identification with missing data at start."""
        data = pd.DataFrame({
            'stock1': [np.nan, np.nan, np.nan, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        })
        
        result = analyzer.identify_missing_patterns(data)
        
        assert result['stock1'] == 'start'
    
    def test_end_missing_pattern(self, analyzer):
        """Test pattern identification with missing data at end."""
        data = pd.DataFrame({
            'stock1': [1, 2, 3, 4, 5, 6, 7, 8, np.nan, np.nan, np.nan, np.nan]
        })
        
        result = analyzer.identify_missing_patterns(data)
        
        assert result['stock1'] == 'end'
    
    def test_periodic_missing_pattern(self, analyzer):
        """Test pattern identification with periodic missing data."""
        # Every 3rd value is missing
        data = pd.DataFrame({
            'stock1': [1, 2, np.nan, 4, 5, np.nan, 7, 8, np.nan, 10, 11, np.nan]
        })
        
        result = analyzer.identify_missing_patterns(data)
        
        assert result['stock1'] == 'periodic'
    
    def test_multiple_columns_different_patterns(self, analyzer):
        """Test pattern identification with multiple columns."""
        data = pd.DataFrame({
            'stock1': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],  # none
            'stock2': [1, np.nan, 3, np.nan, 5, 6, np.nan, 8, 9, np.nan, 11, 12, 13, np.nan, 15],  # random
            'stock3': [1, 2, 3, np.nan, np.nan, np.nan, np.nan, 8, 9, 10, 11, 12, 13, 14, 15]  # consecutive
        })
        
        result = analyzer.identify_missing_patterns(data)
        
        assert result['stock1'] == 'none'
        assert result['stock2'] == 'random'
        assert result['stock3'] == 'consecutive'


class TestGetMissingSummary:
    """Tests for get_missing_summary method."""
    
    def test_returns_dataframe(self, analyzer, sample_data_with_missing):
        """Test that method returns a DataFrame."""
        result = analyzer.get_missing_summary(sample_data_with_missing)
        
        assert isinstance(result, pd.DataFrame)
    
    def test_summary_has_required_columns(self, analyzer, sample_data_with_missing):
        """Test that summary has all required columns."""
        result = analyzer.get_missing_summary(sample_data_with_missing)
        
        expected_columns = ['column_name', 'missing_count', 'missing_percentage', 'pattern']
        assert all(col in result.columns for col in expected_columns)
    
    def test_summary_row_count(self, analyzer, sample_data_with_missing):
        """Test that summary has one row per column."""
        result = analyzer.get_missing_summary(sample_data_with_missing)
        
        assert len(result) == len(sample_data_with_missing.columns)
    
    def test_summary_values_accuracy(self, analyzer):
        """Test accuracy of summary values."""
        data = pd.DataFrame({
            'stock1': [1, 2, np.nan, 4, 5, 6, 7, 8, 9, 10],  # 1 missing, 10%
            'stock2': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]  # 0 missing, 0%
        })
        
        result = analyzer.get_missing_summary(data)
        
        stock1_row = result[result['column_name'] == 'stock1'].iloc[0]
        assert stock1_row['missing_count'] == 1
        assert stock1_row['missing_percentage'] == 10.0
        assert stock1_row['pattern'] == 'random'
        
        stock2_row = result[result['column_name'] == 'stock2'].iloc[0]
        assert stock2_row['missing_count'] == 0
        assert stock2_row['missing_percentage'] == 0.0
        assert stock2_row['pattern'] == 'none'
    
    def test_summary_empty_dataframe(self, analyzer):
        """Test summary with empty DataFrame."""
        data = pd.DataFrame()
        
        result = analyzer.get_missing_summary(data)
        
        assert len(result) == 0


class TestGetStocksByMissingThreshold:
    """Tests for get_stocks_by_missing_threshold method."""
    
    def test_returns_tuple(self, analyzer, sample_data_with_missing):
        """Test that method returns a tuple."""
        result = analyzer.get_stocks_by_missing_threshold(sample_data_with_missing, 15.0)
        
        assert isinstance(result, tuple)
        assert len(result) == 2
    
    def test_threshold_categorization(self, analyzer, sample_data_with_missing):
        """Test correct categorization based on threshold."""
        below, above = analyzer.get_stocks_by_missing_threshold(sample_data_with_missing, 15.0)
        
        # stock1 has 10% missing (below threshold)
        assert 'stock1' in below
        # stock2 has 20% missing (above threshold)
        assert 'stock2' in above
        # stock3 has 100% missing (above threshold)
        assert 'stock3' in above
    
    def test_threshold_at_5_percent(self, analyzer):
        """Test threshold at 5% (requirement boundary)."""
        # Create data with exactly 5% missing (1 out of 20)
        stock3_data = [1.0] * 19 + [np.nan]
        
        data = pd.DataFrame({
            'stock1': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] + [0] * 10,  # 0% missing, padded to 20
            'stock2': [1, np.nan, 3, 4, 5, 6, 7, 8, 9, 10] + [0] * 10,  # 5% missing (1/20), padded to 20
            'stock3': stock3_data  # 5% missing (1/20)
        })
        
        below, above = analyzer.get_stocks_by_missing_threshold(data, 5.0)
        
        assert 'stock1' in below
        # At exactly 5%, should be included (<=)
        assert 'stock2' in below
        assert 'stock3' in below
    
    def test_threshold_at_20_percent(self, analyzer):
        """Test threshold at 20% (requirement boundary)."""
        data = pd.DataFrame({
            'stock1': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],  # 0% missing
            'stock2': [1, np.nan, 3, 4, 5, 6, 7, 8, 9, 10],  # 10% missing
            'stock3': [1, np.nan, np.nan, 4, 5, 6, 7, 8, 9, 10],  # 20% missing
            'stock4': [1, np.nan, np.nan, np.nan, 5, 6, 7, 8, 9, 10]  # 30% missing
        })
        
        below, above = analyzer.get_stocks_by_missing_threshold(data, 20.0)
        
        assert 'stock1' in below
        assert 'stock2' in below
        assert 'stock3' in below
        assert 'stock4' in above
    
    def test_all_below_threshold(self, analyzer, sample_data_no_missing):
        """Test when all stocks are below threshold."""
        below, above = analyzer.get_stocks_by_missing_threshold(sample_data_no_missing, 50.0)
        
        assert len(below) == 2
        assert len(above) == 0
    
    def test_all_above_threshold(self, analyzer):
        """Test when all stocks are above threshold."""
        data = pd.DataFrame({
            'stock1': [np.nan] * 10,
            'stock2': [np.nan] * 10
        })
        
        below, above = analyzer.get_stocks_by_missing_threshold(data, 50.0)
        
        assert len(below) == 0
        assert len(above) == 2
    
    def test_empty_dataframe(self, analyzer):
        """Test with empty DataFrame."""
        data = pd.DataFrame()
        
        below, above = analyzer.get_stocks_by_missing_threshold(data, 20.0)
        
        assert len(below) == 0
        assert len(above) == 0


class TestEdgeCases:
    """Tests for edge cases."""
    
    def test_single_column(self, analyzer):
        """Test with single column DataFrame."""
        data = pd.DataFrame({
            'stock1': [1, np.nan, 3, 4, 5]
        })
        
        result = analyzer.calculate_missing_percentage(data)
        
        assert result['stock1'] == 20.0
    
    def test_large_dataset(self, analyzer):
        """Test with large dataset."""
        # Create 1000 rows with 10% missing
        data = pd.DataFrame({
            'stock1': [1.0] * 900 + [np.nan] * 100
        })
        
        result = analyzer.calculate_missing_percentage(data)
        
        assert result['stock1'] == 10.0
    
    def test_mixed_data_types(self, analyzer):
        """Test with mixed data types."""
        data = pd.DataFrame({
            'stock1': [1, 2, np.nan, 4, 5],
            'stock2': ['a', 'b', np.nan, 'd', 'e']
        })
        
        result = analyzer.calculate_missing_percentage(data)
        
        assert result['stock1'] == 20.0
        assert result['stock2'] == 20.0
    
    def test_pattern_with_two_values(self, analyzer):
        """Test pattern identification with minimal data."""
        data = pd.DataFrame({
            'stock1': [1, np.nan]
        })
        
        result = analyzer.identify_missing_patterns(data)
        
        # Should identify some pattern (not crash)
        assert result['stock1'] in ['none', 'random', 'consecutive', 'start', 'end', 'periodic', 'all_missing']
