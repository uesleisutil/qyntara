"""
Unit tests for Feature Drift Detector
"""

import unittest
import numpy as np
import pandas as pd
from scipy import stats

from src.monitoring.feature_drift_detector import FeatureDriftDetector


class TestFeatureDriftDetector(unittest.TestCase):
    """Test cases for FeatureDriftDetector"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.detector = FeatureDriftDetector(alpha=0.05)
        
        # Create sample reference data (baseline)
        np.random.seed(42)
        self.reference_data = pd.DataFrame({
            'feature1': np.random.normal(10, 2, 1000),
            'feature2': np.random.normal(50, 10, 1000),
            'feature3': np.random.exponential(5, 1000),
            'feature4': np.random.uniform(0, 100, 1000)
        })
    
    def test_initialization(self):
        """Test detector initialization"""
        self.assertEqual(self.detector.alpha, 0.05)
        
        # Test custom alpha
        custom_detector = FeatureDriftDetector(alpha=0.01)
        self.assertEqual(custom_detector.alpha, 0.01)
    
    def test_ks_test_no_drift(self):
        """Test KS test when distributions are the same"""
        # Create current data from same distribution
        np.random.seed(43)
        current_data = np.random.normal(10, 2, 1000)
        reference_data = self.reference_data['feature1'].values
        
        ks_stat, p_value = self.detector.ks_test(reference_data, current_data)
        
        # p-value should be high (no significant difference)
        self.assertIsInstance(ks_stat, float)
        self.assertIsInstance(p_value, float)
        self.assertGreater(p_value, 0.05)
    
    def test_ks_test_with_drift(self):
        """Test KS test when distributions differ"""
        # Create current data from different distribution
        current_data = np.random.normal(15, 2, 1000)  # Different mean
        reference_data = self.reference_data['feature1'].values
        
        ks_stat, p_value = self.detector.ks_test(reference_data, current_data)
        
        # p-value should be low (significant difference)
        self.assertIsInstance(ks_stat, float)
        self.assertIsInstance(p_value, float)
        self.assertLess(p_value, 0.05)
    
    def test_ks_test_with_nan_values(self):
        """Test KS test handles NaN values"""
        reference_data = np.array([1, 2, 3, np.nan, 5, 6])
        current_data = np.array([1.1, 2.1, np.nan, 4.1, 5.1, 6.1])
        
        ks_stat, p_value = self.detector.ks_test(reference_data, current_data)
        
        # Should successfully compute test after removing NaNs
        self.assertIsInstance(ks_stat, float)
        self.assertIsInstance(p_value, float)
    
    def test_ks_test_empty_arrays(self):
        """Test KS test with empty arrays"""
        reference_data = np.array([])
        current_data = np.array([1, 2, 3])
        
        with self.assertRaises(ValueError) as context:
            self.detector.ks_test(reference_data, current_data)
        
        self.assertIn("empty arrays", str(context.exception))
    
    def test_detect_drift_single_feature_no_drift(self):
        """Test single feature drift detection without drift"""
        np.random.seed(44)
        current_data = np.random.normal(10, 2, 1000)
        reference_data = self.reference_data['feature1'].values
        
        result = self.detector.detect_drift_single_feature(
            reference_data,
            current_data,
            'feature1'
        )
        
        # Check result structure
        self.assertEqual(result['feature_name'], 'feature1')
        self.assertIn('ks_statistic', result)
        self.assertIn('p_value', result)
        self.assertIn('drift_detected', result)
        self.assertEqual(result['alpha'], 0.05)
        
        # Should not detect drift
        self.assertFalse(result['drift_detected'])
    
    def test_detect_drift_single_feature_with_drift(self):
        """Test single feature drift detection with drift"""
        # Create drifted data
        current_data = np.random.normal(15, 2, 1000)  # Different mean
        reference_data = self.reference_data['feature1'].values
        
        result = self.detector.detect_drift_single_feature(
            reference_data,
            current_data,
            'feature1'
        )
        
        # Should detect drift
        self.assertTrue(result['drift_detected'])
        self.assertLess(result['p_value'], 0.05)
    
    def test_detect_drift_multiple_features(self):
        """Test drift detection for multiple features"""
        # Create current data with some features drifted
        np.random.seed(45)
        current_data = pd.DataFrame({
            'feature1': np.random.normal(10, 2, 1000),  # No drift
            'feature2': np.random.normal(70, 10, 1000),  # Drift (mean changed)
            'feature3': np.random.exponential(5, 1000),  # No drift
            'feature4': np.random.uniform(50, 150, 1000)  # Drift (range changed)
        })
        
        results = self.detector.detect_drift(
            self.reference_data,
            current_data
        )
        
        # Check results structure
        self.assertEqual(len(results), 4)
        self.assertIn('feature1', results)
        self.assertIn('feature2', results)
        self.assertIn('feature3', results)
        self.assertIn('feature4', results)
        
        # feature2 and feature4 should show drift
        self.assertTrue(results['feature2']['drift_detected'])
        self.assertTrue(results['feature4']['drift_detected'])
    
    def test_detect_drift_specific_features(self):
        """Test drift detection for specific feature subset"""
        current_data = self.reference_data.copy()
        
        # Only test feature1 and feature2
        results = self.detector.detect_drift(
            self.reference_data,
            current_data,
            feature_columns=['feature1', 'feature2']
        )
        
        # Should only have results for specified features
        self.assertEqual(len(results), 2)
        self.assertIn('feature1', results)
        self.assertIn('feature2', results)
        self.assertNotIn('feature3', results)
    
    def test_detect_drift_missing_feature(self):
        """Test drift detection with missing feature in current data"""
        current_data = self.reference_data[['feature1', 'feature2']].copy()
        
        results = self.detector.detect_drift(
            self.reference_data,
            current_data,
            feature_columns=['feature1', 'feature3']  # feature3 missing in current
        )
        
        # Should have results for both, but feature3 should have error
        self.assertEqual(len(results), 2)
        self.assertFalse(results['feature1']['drift_detected'])
        self.assertIn('error', results['feature3'])
    
    def test_get_drifted_features(self):
        """Test getting list of drifted features"""
        # Create mock results
        drift_results = {
            'feature1': {'drift_detected': False},
            'feature2': {'drift_detected': True},
            'feature3': {'drift_detected': False},
            'feature4': {'drift_detected': True}
        }
        
        drifted = self.detector.get_drifted_features(drift_results)
        
        self.assertEqual(len(drifted), 2)
        self.assertIn('feature2', drifted)
        self.assertIn('feature4', drifted)
    
    def test_summarize_drift(self):
        """Test drift summary generation"""
        # Create mock results
        drift_results = {
            'feature1': {'drift_detected': False},
            'feature2': {'drift_detected': True},
            'feature3': {'drift_detected': False},
            'feature4': {'drift_detected': True},
            'feature5': {'drift_detected': True}
        }
        
        summary = self.detector.summarize_drift(drift_results)
        
        # Check summary structure
        self.assertEqual(summary['total_features'], 5)
        self.assertEqual(summary['drifted_features_count'], 3)
        self.assertEqual(len(summary['drifted_features']), 3)
        self.assertAlmostEqual(summary['drift_percentage'], 60.0, places=1)
        self.assertEqual(summary['alpha'], 0.05)
    
    def test_summarize_drift_no_drift(self):
        """Test drift summary with no drift detected"""
        drift_results = {
            'feature1': {'drift_detected': False},
            'feature2': {'drift_detected': False}
        }
        
        summary = self.detector.summarize_drift(drift_results)
        
        self.assertEqual(summary['drifted_features_count'], 0)
        self.assertEqual(summary['drift_percentage'], 0.0)
        self.assertEqual(len(summary['drifted_features']), 0)
    
    def test_summarize_drift_empty_results(self):
        """Test drift summary with empty results"""
        summary = self.detector.summarize_drift({})
        
        self.assertEqual(summary['total_features'], 0)
        self.assertEqual(summary['drifted_features_count'], 0)
        self.assertEqual(summary['drift_percentage'], 0.0)
    
    def test_detect_drift_with_summary(self):
        """Test combined drift detection and summary"""
        # Create current data with drift
        np.random.seed(46)
        current_data = pd.DataFrame({
            'feature1': np.random.normal(10, 2, 1000),  # No drift
            'feature2': np.random.normal(70, 10, 1000),  # Drift
            'feature3': np.random.exponential(5, 1000),  # No drift
            'feature4': np.random.uniform(50, 150, 1000)  # Drift
        })
        
        drift_results, summary = self.detector.detect_drift_with_summary(
            self.reference_data,
            current_data
        )
        
        # Check both results and summary
        self.assertEqual(len(drift_results), 4)
        self.assertGreater(summary['drifted_features_count'], 0)
        self.assertEqual(
            summary['drifted_features_count'],
            len(summary['drifted_features'])
        )
    
    def test_custom_alpha_threshold(self):
        """Test detector with custom alpha threshold"""
        # Strict detector (alpha=0.01)
        strict_detector = FeatureDriftDetector(alpha=0.01)
        
        # Create data with marginal difference
        np.random.seed(47)
        reference_data = np.random.normal(10, 2, 500)
        current_data = np.random.normal(10.5, 2, 500)  # Slight shift
        
        # Standard detector (alpha=0.05)
        result_standard = self.detector.detect_drift_single_feature(
            reference_data,
            current_data,
            'test_feature'
        )
        
        # Strict detector (alpha=0.01)
        result_strict = strict_detector.detect_drift_single_feature(
            reference_data,
            current_data,
            'test_feature'
        )
        
        # Strict detector should be less likely to detect drift
        # (though this depends on the actual p-value)
        self.assertEqual(result_standard['alpha'], 0.05)
        self.assertEqual(result_strict['alpha'], 0.01)
    
    def test_drift_detection_different_distributions(self):
        """Test drift detection with different distribution types"""
        # Normal to uniform
        reference_normal = np.random.normal(50, 10, 1000)
        current_uniform = np.random.uniform(30, 70, 1000)
        
        result = self.detector.detect_drift_single_feature(
            reference_normal,
            current_uniform,
            'distribution_change'
        )
        
        # Should detect drift due to distribution shape change
        self.assertTrue(result['drift_detected'])
    
    def test_drift_detection_scale_change(self):
        """Test drift detection with scale change"""
        # Same mean, different variance
        reference_data = np.random.normal(10, 2, 1000)
        current_data = np.random.normal(10, 5, 1000)  # Same mean, higher variance
        
        result = self.detector.detect_drift_single_feature(
            reference_data,
            current_data,
            'scale_change'
        )
        
        # Should detect drift due to scale change
        self.assertTrue(result['drift_detected'])


if __name__ == '__main__':
    unittest.main()
