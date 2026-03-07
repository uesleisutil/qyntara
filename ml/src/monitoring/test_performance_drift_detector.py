"""
Unit tests for Performance Drift Detector
"""

import unittest
from datetime import datetime, timedelta
import numpy as np
import pandas as pd

from src.monitoring.performance_drift_detector import PerformanceDriftDetector


class TestPerformanceDriftDetector(unittest.TestCase):
    """Test cases for PerformanceDriftDetector"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.detector = PerformanceDriftDetector(window_days=30, drift_threshold=0.20)
        
        # Create sample historical MAPE data
        dates = pd.date_range(start='2024-01-01', end='2024-03-31', freq='D')
        # Baseline MAPE around 6.0%
        baseline_mape = np.random.normal(6.0, 0.5, len(dates))
        self.historical_mape = pd.Series(baseline_mape, index=dates)
    
    def test_initialization(self):
        """Test detector initialization"""
        self.assertEqual(self.detector.window_days, 30)
        self.assertEqual(self.detector.drift_threshold, 0.20)
        
        # Test custom parameters
        custom_detector = PerformanceDriftDetector(window_days=60, drift_threshold=0.15)
        self.assertEqual(custom_detector.window_days, 60)
        self.assertEqual(custom_detector.drift_threshold, 0.15)
    
    def test_calculate_baseline_mape(self):
        """Test baseline MAPE calculation"""
        current_date = datetime(2024, 2, 15)
        
        baseline = self.detector.calculate_baseline_mape(
            self.historical_mape,
            current_date
        )
        
        # Baseline should be close to 6.0 (mean of normal distribution)
        self.assertIsInstance(baseline, float)
        self.assertGreater(baseline, 5.0)
        self.assertLess(baseline, 7.0)
    
    def test_calculate_baseline_mape_insufficient_data(self):
        """Test baseline calculation with insufficient data"""
        # Try to calculate baseline at the very start (no prior data)
        early_date = datetime(2024, 1, 1)
        
        with self.assertRaises(ValueError) as context:
            self.detector.calculate_baseline_mape(
                self.historical_mape,
                early_date
            )
        
        self.assertIn("Insufficient data", str(context.exception))
    
    def test_detect_drift_no_drift(self):
        """Test drift detection when no drift exists"""
        current_mape = 6.5  # Within 20% of baseline ~6.0
        baseline_mape = 6.0
        
        drift_detected, change_pct = self.detector.detect_drift(
            current_mape,
            baseline_mape
        )
        
        self.assertFalse(drift_detected)
        self.assertAlmostEqual(change_pct, (6.5 - 6.0) / 6.0, places=4)
    
    def test_detect_drift_with_drift(self):
        """Test drift detection when drift exists"""
        current_mape = 7.5  # 25% increase from baseline
        baseline_mape = 6.0
        
        drift_detected, change_pct = self.detector.detect_drift(
            current_mape,
            baseline_mape
        )
        
        self.assertTrue(drift_detected)
        self.assertAlmostEqual(change_pct, 0.25, places=4)
    
    def test_detect_drift_exactly_at_threshold(self):
        """Test drift detection at exact threshold"""
        baseline_mape = 6.0
        current_mape = baseline_mape * 1.20  # Exactly 20% increase
        
        drift_detected, change_pct = self.detector.detect_drift(
            current_mape,
            baseline_mape
        )
        
        # Should not detect drift at exactly threshold (> not >=)
        self.assertFalse(drift_detected)
        self.assertAlmostEqual(change_pct, 0.20, places=4)
    
    def test_detect_drift_zero_baseline(self):
        """Test drift detection with zero baseline"""
        current_mape = 5.0
        baseline_mape = 0.0
        
        drift_detected, change_pct = self.detector.detect_drift(
            current_mape,
            baseline_mape
        )
        
        # Should detect drift with infinite change
        self.assertTrue(drift_detected)
        self.assertEqual(change_pct, float('inf'))
    
    def test_detect_drift_from_history(self):
        """Test drift detection from historical data"""
        current_date = datetime(2024, 3, 1)
        current_mape = 7.8  # Significant increase
        
        result = self.detector.detect_drift_from_history(
            self.historical_mape,
            current_date,
            current_mape
        )
        
        # Check result structure
        self.assertIn('drift_detected', result)
        self.assertIn('current_mape', result)
        self.assertIn('baseline_mape', result)
        self.assertIn('mape_change_percentage', result)
        self.assertIn('detection_date', result)
        
        # Check values
        self.assertEqual(result['current_mape'], current_mape)
        self.assertEqual(result['detection_date'], current_date)
        self.assertTrue(result['drift_detected'])
    
    def test_detect_drift_batch(self):
        """Test batch drift detection"""
        # Create test data with drift
        dates = pd.date_range(start='2024-02-01', end='2024-03-31', freq='D')
        mape_values = []
        
        for i, date in enumerate(dates):
            if i < 30:
                # First 30 days: baseline around 6.0
                mape_values.append(np.random.normal(6.0, 0.3))
            else:
                # After 30 days: drift to 7.5
                mape_values.append(np.random.normal(7.5, 0.3))
        
        mape_data = pd.DataFrame({
            'date': dates,
            'mape': mape_values
        })
        
        results = self.detector.detect_drift_batch(mape_data)
        
        # Should have results for dates with sufficient history
        self.assertGreater(len(results), 0)
        
        # Check that drift is detected in later dates
        drift_detected_count = results['drift_detected'].sum()
        self.assertGreater(drift_detected_count, 0)
    
    def test_detect_drift_batch_empty_data(self):
        """Test batch drift detection with empty data"""
        empty_data = pd.DataFrame(columns=['date', 'mape'])
        
        results = self.detector.detect_drift_batch(empty_data)
        
        # Should return empty DataFrame
        self.assertEqual(len(results), 0)
    
    def test_detect_drift_negative_change(self):
        """Test drift detection with performance improvement"""
        current_mape = 5.0  # Improvement from baseline
        baseline_mape = 6.0
        
        drift_detected, change_pct = self.detector.detect_drift(
            current_mape,
            baseline_mape
        )
        
        # Should not detect drift for improvement
        self.assertFalse(drift_detected)
        self.assertAlmostEqual(change_pct, -1/6, places=4)
    
    def test_rolling_window_calculation(self):
        """Test that rolling window uses correct date range"""
        current_date = datetime(2024, 3, 1)
        
        baseline = self.detector.calculate_baseline_mape(
            self.historical_mape,
            current_date
        )
        
        # Manually calculate expected baseline
        start_date = current_date - timedelta(days=30)
        expected_data = self.historical_mape[
            (self.historical_mape.index >= start_date) & 
            (self.historical_mape.index < current_date)
        ]
        expected_baseline = expected_data.mean()
        
        self.assertAlmostEqual(baseline, expected_baseline, places=6)
    
    def test_custom_window_size(self):
        """Test detector with custom window size"""
        detector_60 = PerformanceDriftDetector(window_days=60, drift_threshold=0.20)
        
        current_date = datetime(2024, 3, 15)
        
        baseline_30 = self.detector.calculate_baseline_mape(
            self.historical_mape,
            current_date
        )
        
        baseline_60 = detector_60.calculate_baseline_mape(
            self.historical_mape,
            current_date
        )
        
        # Baselines should be different due to different window sizes
        # (unless data is perfectly uniform, which is unlikely with random data)
        self.assertIsInstance(baseline_30, float)
        self.assertIsInstance(baseline_60, float)
    
    def test_custom_drift_threshold(self):
        """Test detector with custom drift threshold"""
        detector_strict = PerformanceDriftDetector(window_days=30, drift_threshold=0.10)
        
        current_mape = 6.7  # 11.67% increase (above 10% threshold)
        baseline_mape = 6.0
        
        # Standard detector (20% threshold) should not detect drift
        drift_standard, _ = self.detector.detect_drift(current_mape, baseline_mape)
        self.assertFalse(drift_standard)
        
        # Strict detector (10% threshold) should detect drift
        drift_strict, _ = detector_strict.detect_drift(current_mape, baseline_mape)
        self.assertTrue(drift_strict)


if __name__ == '__main__':
    unittest.main()
