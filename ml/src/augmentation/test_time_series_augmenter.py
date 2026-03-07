"""
Tests for TimeSeriesAugmenter
"""

import pytest
import numpy as np
import pandas as pd

from src.augmentation.time_series_augmenter import TimeSeriesAugmenter


class TestTimeSeriesAugmenter:
    """Test suite for TimeSeriesAugmenter."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.augmenter = TimeSeriesAugmenter(
            min_observations=500,
            jitter_noise_level=0.05,
            window_overlap=0.80,
            max_augmentation_factor=2.0
        )
        
        # Create sample time series data
        np.random.seed(42)
        self.small_data = pd.DataFrame({
            'value': np.random.randn(300) * 10 + 100,
            'feature1': np.random.randn(300) * 5 + 50,
            'feature2': np.random.randn(300) * 2 + 20
        })
        
        self.large_data = pd.DataFrame({
            'value': np.random.randn(600) * 10 + 100
        })
    
    def test_initialization(self):
        """Test augmenter initialization."""
        assert self.augmenter.min_observations == 500
        assert self.augmenter.jitter_noise_level == 0.05
        assert self.augmenter.window_overlap == 0.80
        assert self.augmenter.max_augmentation_factor == 2.0
    
    def test_should_augment_small_dataset(self):
        """Test augmentation trigger for small dataset."""
        should_augment = self.augmenter.should_augment(self.small_data)
        assert should_augment is True
    
    def test_should_augment_large_dataset(self):
        """Test augmentation not triggered for large dataset."""
        should_augment = self.augmenter.should_augment(self.large_data)
        assert should_augment is False
    
    def test_apply_jittering(self):
        """Test jittering application."""
        jittered = self.augmenter.apply_jittering(self.small_data)
        
        assert len(jittered) == len(self.small_data)
        assert list(jittered.columns) == list(self.small_data.columns)
        
        # Values should be different but close
        assert not np.array_equal(jittered['value'].values, self.small_data['value'].values)
        
        # Mean should be similar
        assert abs(jittered['value'].mean() - self.small_data['value'].mean()) < 5
    
    def test_apply_window_slicing(self):
        """Test window slicing."""
        windows = self.augmenter.apply_window_slicing(self.small_data, window_size=100)
        
        assert len(windows) > 1
        assert all(len(w) == 100 for w in windows)
    
    def test_calculate_statistical_properties(self):
        """Test statistical properties calculation."""
        properties = self.augmenter.calculate_statistical_properties(self.small_data)
        
        assert 'value' in properties
        assert 'mean' in properties['value']
        assert 'std' in properties['value']
        assert 'median' in properties['value']
        assert 'skewness' in properties['value']
        assert 'kurtosis' in properties['value']
    
    def test_validate_statistical_preservation_valid(self):
        """Test validation with preserved properties."""
        original_props = {
            'value': {'mean': 100.0, 'std': 10.0, 'median': 100.0}
        }
        augmented_props = {
            'value': {'mean': 101.0, 'std': 10.5, 'median': 100.5}
        }
        
        is_valid, diffs = self.augmenter.validate_statistical_preservation(
            original_props,
            augmented_props,
            tolerance=0.15
        )
        
        assert is_valid is True
    
    def test_validate_statistical_preservation_invalid(self):
        """Test validation with non-preserved properties."""
        original_props = {
            'value': {'mean': 100.0, 'std': 10.0, 'median': 100.0}
        }
        augmented_props = {
            'value': {'mean': 120.0, 'std': 15.0, 'median': 120.0}
        }
        
        is_valid, diffs = self.augmenter.validate_statistical_preservation(
            original_props,
            augmented_props,
            tolerance=0.15
        )
        
        assert is_valid is False
    
    def test_augment_small_dataset(self):
        """Test augmentation of small dataset."""
        augmented, info = self.augmenter.augment(self.small_data)
        
        assert info['augmented'] is True
        assert info['augmented_size'] > info['original_size']
        assert info['augmentation_factor'] <= 2.0
        assert len(augmented) <= len(self.small_data) * 2
    
    def test_augment_large_dataset(self):
        """Test augmentation skipped for large dataset."""
        augmented, info = self.augmenter.augment(self.large_data)
        
        assert info['augmented'] is False
        assert info['reason'] == 'sufficient_observations'
        assert len(augmented) == len(self.large_data)
    
    def test_augment_respects_max_factor(self):
        """Test that augmentation respects max factor."""
        augmented, info = self.augmenter.augment(self.small_data)
        
        assert info['augmentation_factor'] <= self.augmenter.max_augmentation_factor
    
    def test_augment_preserves_columns(self):
        """Test that augmentation preserves column structure."""
        augmented, info = self.augmenter.augment(self.small_data)
        
        assert list(augmented.columns) == list(self.small_data.columns)
