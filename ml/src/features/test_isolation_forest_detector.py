"""
Unit tests for Isolation Forest Detector

Tests verify that the Isolation Forest detector correctly identifies
multivariate outliers in data.
"""

import pytest
import pandas as pd
import numpy as np
from src.features.isolation_forest_detector import IsolationForestDetector


@pytest.fixture
def detector():
    """Fixture providing an IsolationForestDetector instance."""
    return IsolationForestDetector(contamination=0.1, random_state=42)


@pytest.fixture
def normal_data():
    """Fixture providing normal data without outliers."""
    np.random.seed(42)
    data = pd.DataFrame({
        'feature1': np.random.randn(100) * 10 + 50,
        'feature2': np.random.randn(100) * 5 + 20,
        'feature3': np.random.randn(100) * 2 + 100
    })
    return data


@pytest.fixture
def data_with_outliers():
    """Fixture providing data with clear outliers."""
    np.random.seed(42)
    # Normal data
    normal = pd.DataFrame({
        'feature1': np.random.randn(95) * 10 + 50,
        'feature2': np.random.randn(95) * 5 + 20
    })
    
    # Add 5 clear outliers
    outliers = pd.DataFrame({
        'feature1': [200, 250, -100, 300, -150],
        'feature2': [100, 120, -50, 150, -80]
    })
    
    data = pd.concat([normal, outliers], ignore_index=True)
    return data


class TestInitialization:
    """Tests for detector initialization."""
    
    def test_init_default_params(self):
        """Test initialization with default parameters."""
        detector = IsolationForestDetector()
        assert detector.contamination == 0.01
        assert detector.random_state == 42
        assert not detector.is_fitted_
        assert detector.model_ is None
    
    def test_init_custom_params(self):
        """Test initialization with custom parameters."""
        detector = IsolationForestDetector(contamination=0.05, random_state=123)
        assert detector.contamination == 0.05
        assert detector.random_state == 123
        assert not detector.is_fitted_


class TestFit:
    """Tests for fit method."""
    
    def test_fit_basic(self, detector, normal_data):
        """Test basic fit operation."""
        detector.fit(normal_data)
        
        assert detector.is_fitted_
        assert detector.model_ is not None
    
    def test_fit_single_feature(self, detector):
        """Test fit with single feature."""
        data = pd.DataFrame({'feature': np.random.randn(100)})
        detector.fit(data)
        
        assert detector.is_fitted_
    
    def test_fit_multiple_features(self, detector, normal_data):
        """Test fit with multiple features."""
        detector.fit(normal_data)
        
        assert detector.is_fitted_
        assert detector.model_ is not None
    
    def test_fit_small_dataset(self, detector):
        """Test fit with small dataset."""
        data = pd.DataFrame({
            'feature1': [1, 2, 3, 4, 5],
            'feature2': [10, 20, 30, 40, 50]
        })
        detector.fit(data)
        
        assert detector.is_fitted_
    
    def test_fit_updates_model(self, detector, normal_data):
        """Test that multiple fit calls update the model."""
        detector.fit(normal_data)
        first_model = detector.model_
        
        # Fit again with different data
        new_data = normal_data * 2
        detector.fit(new_data)
        
        # Model should be updated (different instance)
        assert detector.model_ is not first_model


class TestDetect:
    """Tests for detect method."""
    
    def test_detect_returns_boolean_array(self, detector, normal_data):
        """Test that detect returns boolean array."""
        detector.fit(normal_data)
        result = detector.detect(normal_data)
        
        assert isinstance(result, np.ndarray)
        assert result.dtype == bool
    
    def test_detect_length_matches_input(self, detector, normal_data):
        """Test that detect output has same length as input."""
        detector.fit(normal_data)
        result = detector.detect(normal_data)
        
        assert len(result) == len(normal_data)
    
    def test_detect_without_fit_raises_error(self, detector, normal_data):
        """Test that detect without fit raises error."""
        with pytest.raises(ValueError, match="must be fitted before detect"):
            detector.detect(normal_data)
    
    def test_detect_finds_outliers(self, detector, data_with_outliers):
        """Test that detect identifies outliers."""
        detector.fit(data_with_outliers)
        outliers = detector.detect(data_with_outliers)
        
        # Should detect some outliers
        assert outliers.sum() > 0
        # Should not flag everything as outlier
        assert outliers.sum() < len(data_with_outliers)
    
    def test_detect_normal_data_few_outliers(self, detector, normal_data):
        """Test that detect finds few outliers in normal data."""
        detector.fit(normal_data)
        outliers = detector.detect(normal_data)
        
        # With contamination=0.1, should flag around 10% as outliers
        outlier_ratio = outliers.sum() / len(normal_data)
        assert 0.05 <= outlier_ratio <= 0.15  # Allow some variance
    
    def test_detect_extreme_outliers(self, detector):
        """Test that detect identifies extreme outliers."""
        # Create data with extreme outliers
        np.random.seed(42)
        normal = np.random.randn(95, 2) * 10 + 50
        extreme = np.array([[1000, 1000], [2000, 2000], [-1000, -1000], [3000, 3000], [-2000, -2000]])
        
        data = pd.DataFrame(
            np.vstack([normal, extreme]),
            columns=['feature1', 'feature2']
        )
        
        detector.fit(data)
        outliers = detector.detect(data)
        
        # The last 5 extreme points should be flagged as outliers
        # (though not guaranteed 100% due to randomness in algorithm)
        extreme_outliers = outliers[-5:]
        assert extreme_outliers.sum() >= 3  # At least 3 out of 5 should be detected
    
    def test_detect_on_new_data(self, detector, normal_data):
        """Test detect on new data after fitting."""
        detector.fit(normal_data)
        
        # Create new data with similar distribution
        np.random.seed(123)
        new_data = pd.DataFrame({
            'feature1': np.random.randn(50) * 10 + 50,
            'feature2': np.random.randn(50) * 5 + 20,
            'feature3': np.random.randn(50) * 2 + 100
        })
        
        outliers = detector.detect(new_data)
        
        assert len(outliers) == len(new_data)
        assert isinstance(outliers, np.ndarray)
    
    def test_detect_reproducibility(self, normal_data):
        """Test that detect gives same results with same random_state."""
        detector1 = IsolationForestDetector(contamination=0.1, random_state=42)
        detector2 = IsolationForestDetector(contamination=0.1, random_state=42)
        
        detector1.fit(normal_data)
        detector2.fit(normal_data)
        
        result1 = detector1.detect(normal_data)
        result2 = detector2.detect(normal_data)
        
        np.testing.assert_array_equal(result1, result2)


class TestGetAnomalyScores:
    """Tests for get_anomaly_scores method."""
    
    def test_get_anomaly_scores_returns_array(self, detector, normal_data):
        """Test that get_anomaly_scores returns numpy array."""
        detector.fit(normal_data)
        scores = detector.get_anomaly_scores(normal_data)
        
        assert isinstance(scores, np.ndarray)
        assert scores.dtype in [np.float64, np.float32]
    
    def test_get_anomaly_scores_length_matches_input(self, detector, normal_data):
        """Test that scores output has same length as input."""
        detector.fit(normal_data)
        scores = detector.get_anomaly_scores(normal_data)
        
        assert len(scores) == len(normal_data)
    
    def test_get_anomaly_scores_without_fit_raises_error(self, detector, normal_data):
        """Test that get_anomaly_scores without fit raises error."""
        with pytest.raises(ValueError, match="must be fitted before get_anomaly_scores"):
            detector.get_anomaly_scores(normal_data)
    
    def test_get_anomaly_scores_outliers_have_lower_scores(self, detector, data_with_outliers):
        """Test that outliers have lower (more negative) scores."""
        detector.fit(data_with_outliers)
        scores = detector.get_anomaly_scores(data_with_outliers)
        
        # Last 5 points are outliers, they should have lower scores
        outlier_scores = scores[-5:]
        normal_scores = scores[:-5]
        
        # Mean outlier score should be lower than mean normal score
        assert outlier_scores.mean() < normal_scores.mean()
    
    def test_get_anomaly_scores_consistency_with_detect(self, detector, normal_data):
        """Test that anomaly scores are consistent with detect results."""
        detector.fit(normal_data)
        
        outliers = detector.detect(normal_data)
        scores = detector.get_anomaly_scores(normal_data)
        
        # Points flagged as outliers should have negative scores
        outlier_scores = scores[outliers]
        inlier_scores = scores[~outliers]
        
        # Outliers should have lower scores than inliers
        if len(outlier_scores) > 0 and len(inlier_scores) > 0:
            assert outlier_scores.mean() < inlier_scores.mean()
    
    def test_get_anomaly_scores_extreme_outliers(self, detector):
        """Test that extreme outliers get very low scores."""
        # Create data with extreme outliers
        np.random.seed(42)
        normal = np.random.randn(95, 2) * 10 + 50
        extreme = np.array([[1000, 1000], [2000, 2000], [-1000, -1000]])
        
        data = pd.DataFrame(
            np.vstack([normal, extreme]),
            columns=['feature1', 'feature2']
        )
        
        detector.fit(data)
        scores = detector.get_anomaly_scores(data)
        
        # Extreme outliers should have very low scores
        extreme_scores = scores[-3:]
        normal_scores = scores[:-3]
        
        # All extreme scores should be lower than the median normal score
        assert all(extreme_scores < np.median(normal_scores))
    
    def test_get_anomaly_scores_ranking(self, detector, data_with_outliers):
        """Test that scores can be used to rank anomalies."""
        detector.fit(data_with_outliers)
        scores = detector.get_anomaly_scores(data_with_outliers)
        
        # Sort by score (ascending = most anomalous first)
        sorted_indices = np.argsort(scores)
        
        # Top 5 most anomalous should include the actual outliers (last 5 points)
        top_5_anomalous = sorted_indices[:5]
        actual_outliers = list(range(95, 100))
        
        # At least 3 of the top 5 should be actual outliers
        overlap = len(set(top_5_anomalous) & set(actual_outliers))
        assert overlap >= 3


class TestEdgeCases:
    """Tests for edge cases and error handling."""
    
    def test_single_row(self, detector):
        """Test with single row."""
        data = pd.DataFrame({'feature1': [100], 'feature2': [200]})
        detector.fit(data)
        
        outliers = detector.detect(data)
        assert len(outliers) == 1
    
    def test_two_rows(self, detector):
        """Test with two rows."""
        data = pd.DataFrame({
            'feature1': [100, 101],
            'feature2': [200, 201]
        })
        detector.fit(data)
        
        outliers = detector.detect(data)
        assert len(outliers) == 2
    
    def test_constant_feature(self, detector):
        """Test with constant feature."""
        data = pd.DataFrame({
            'constant': [100.0] * 50,
            'variable': np.random.randn(50)
        })
        
        detector.fit(data)
        outliers = detector.detect(data)
        
        # Should handle constant feature gracefully
        assert len(outliers) == len(data)
    
    def test_all_same_values(self, detector):
        """Test with all identical values."""
        data = pd.DataFrame({
            'feature1': [100.0] * 50,
            'feature2': [200.0] * 50
        })
        
        detector.fit(data)
        outliers = detector.detect(data)
        
        # With all same values, none should be outliers
        # (or all should be, depending on implementation)
        assert len(outliers) == len(data)
    
    def test_negative_values(self, detector):
        """Test with negative values."""
        data = pd.DataFrame({
            'feature1': np.random.randn(100) * 10 - 50,
            'feature2': np.random.randn(100) * 5 - 20
        })
        
        detector.fit(data)
        outliers = detector.detect(data)
        
        assert len(outliers) == len(data)
        assert isinstance(outliers, np.ndarray)
    
    def test_mixed_scale_features(self, detector):
        """Test with features at different scales."""
        np.random.seed(42)
        data = pd.DataFrame({
            'small_scale': np.random.randn(100) * 0.1,
            'medium_scale': np.random.randn(100) * 10,
            'large_scale': np.random.randn(100) * 1000
        })
        
        detector.fit(data)
        outliers = detector.detect(data)
        
        # Should handle different scales
        assert len(outliers) == len(data)
    
    def test_nan_handling(self, detector):
        """Test behavior with NaN values."""
        data = pd.DataFrame({
            'feature1': [1, 2, np.nan, 4, 5],
            'feature2': [10, 20, 30, np.nan, 50]
        })
        
        # sklearn's IsolationForest may handle NaN in newer versions
        # If it doesn't raise an error, it should at least complete without crashing
        try:
            detector.fit(data)
            outliers = detector.detect(data)
            # If it works, verify output shape
            assert len(outliers) == len(data)
        except (ValueError, TypeError):
            # If it raises an error, that's also acceptable behavior
            pass
    
    def test_high_contamination(self):
        """Test with high contamination parameter."""
        detector = IsolationForestDetector(contamination=0.5, random_state=42)
        
        np.random.seed(42)
        data = pd.DataFrame({
            'feature1': np.random.randn(100),
            'feature2': np.random.randn(100)
        })
        
        detector.fit(data)
        outliers = detector.detect(data)
        
        # Should flag around 50% as outliers
        outlier_ratio = outliers.sum() / len(data)
        assert 0.4 <= outlier_ratio <= 0.6
    
    def test_low_contamination(self):
        """Test with low contamination parameter."""
        detector = IsolationForestDetector(contamination=0.01, random_state=42)
        
        np.random.seed(42)
        data = pd.DataFrame({
            'feature1': np.random.randn(100),
            'feature2': np.random.randn(100)
        })
        
        detector.fit(data)
        outliers = detector.detect(data)
        
        # Should flag around 1% as outliers
        outlier_ratio = outliers.sum() / len(data)
        assert 0.0 <= outlier_ratio <= 0.05
