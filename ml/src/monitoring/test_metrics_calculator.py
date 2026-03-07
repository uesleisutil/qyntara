"""
Tests for MetricsCalculator

Tests all metric calculations including MAPE, MAE, RMSE, coverage, and interval width.
"""

import pytest
import numpy as np
import pandas as pd
from src.monitoring.metrics_calculator import MetricsCalculator


class TestMetricsCalculator:
    """Test suite for MetricsCalculator."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.calculator = MetricsCalculator()
    
    def test_calculate_mape_perfect_predictions(self):
        """Test MAPE calculation with perfect predictions."""
        y_true = np.array([100, 200, 300])
        y_pred = np.array([100, 200, 300])
        
        mape = self.calculator.calculate_mape(y_true, y_pred)
        
        assert mape == 0.0
    
    def test_calculate_mape_with_errors(self):
        """Test MAPE calculation with prediction errors."""
        y_true = np.array([100, 200, 300])
        y_pred = np.array([110, 190, 310])
        
        # Expected MAPE: mean(|10/100|, |10/200|, |10/300|) * 100
        # = mean(0.1, 0.05, 0.0333) * 100 = 6.11%
        mape = self.calculator.calculate_mape(y_true, y_pred)
        
        assert 6.0 < mape < 6.2
    
    def test_calculate_mape_with_nan(self):
        """Test MAPE calculation with NaN values."""
        y_true = np.array([100, np.nan, 300])
        y_pred = np.array([110, 200, np.nan])
        
        # Should only use the first value
        mape = self.calculator.calculate_mape(y_true, y_pred)
        
        assert pytest.approx(mape, rel=0.01) == 10.0  # |110-100|/100 * 100
    
    def test_calculate_mape_empty_arrays(self):
        """Test MAPE calculation with empty arrays."""
        y_true = np.array([np.nan, np.nan])
        y_pred = np.array([np.nan, np.nan])
        
        mape = self.calculator.calculate_mape(y_true, y_pred)
        
        assert np.isnan(mape)
    
    def test_calculate_mae_perfect_predictions(self):
        """Test MAE calculation with perfect predictions."""
        y_true = np.array([100, 200, 300])
        y_pred = np.array([100, 200, 300])
        
        mae = self.calculator.calculate_mae(y_true, y_pred)
        
        assert mae == 0.0
    
    def test_calculate_mae_with_errors(self):
        """Test MAE calculation with prediction errors."""
        y_true = np.array([100, 200, 300])
        y_pred = np.array([110, 190, 310])
        
        # Expected MAE: mean(10, 10, 10) = 10
        mae = self.calculator.calculate_mae(y_true, y_pred)
        
        assert mae == 10.0
    
    def test_calculate_rmse_perfect_predictions(self):
        """Test RMSE calculation with perfect predictions."""
        y_true = np.array([100, 200, 300])
        y_pred = np.array([100, 200, 300])
        
        rmse = self.calculator.calculate_rmse(y_true, y_pred)
        
        assert rmse == 0.0
    
    def test_calculate_rmse_with_errors(self):
        """Test RMSE calculation with prediction errors."""
        y_true = np.array([100, 200, 300])
        y_pred = np.array([110, 190, 310])
        
        # Expected RMSE: sqrt(mean(100, 100, 100)) = 10
        rmse = self.calculator.calculate_rmse(y_true, y_pred)
        
        assert rmse == 10.0
    
    def test_calculate_coverage_perfect_intervals(self):
        """Test coverage calculation with perfect intervals."""
        y_true = np.array([100, 200, 300])
        lower = np.array([90, 190, 290])
        upper = np.array([110, 210, 310])
        
        coverage = self.calculator.calculate_coverage(y_true, lower, upper)
        
        assert coverage == 100.0
    
    def test_calculate_coverage_partial(self):
        """Test coverage calculation with partial coverage."""
        y_true = np.array([100, 200, 300])
        lower = np.array([90, 190, 290])
        upper = np.array([95, 210, 310])  # First value outside interval
        
        coverage = self.calculator.calculate_coverage(y_true, lower, upper)
        
        assert coverage == pytest.approx(66.67, rel=0.01)
    
    def test_calculate_coverage_no_coverage(self):
        """Test coverage calculation with no coverage."""
        y_true = np.array([100, 200, 300])
        lower = np.array([110, 210, 310])
        upper = np.array([120, 220, 320])
        
        coverage = self.calculator.calculate_coverage(y_true, lower, upper)
        
        assert coverage == 0.0
    
    def test_calculate_interval_width_absolute(self):
        """Test interval width calculation (absolute)."""
        lower = np.array([90, 190, 290])
        upper = np.array([110, 210, 310])
        
        width = self.calculator.calculate_interval_width(
            lower, upper, relative=False
        )
        
        assert width == 20.0
    
    def test_calculate_interval_width_relative(self):
        """Test interval width calculation (relative)."""
        lower = np.array([90, 190, 290])
        upper = np.array([110, 210, 310])
        y_pred = np.array([100, 200, 300])
        
        # Expected: mean(20/100, 20/200, 20/300) * 100 = mean(20, 10, 6.67) = 12.22%
        width = self.calculator.calculate_interval_width(
            lower, upper, y_pred, relative=True
        )
        
        assert 12.0 < width < 12.5
    
    def test_calculate_all_metrics(self):
        """Test calculating all metrics at once."""
        y_true = np.array([100, 200, 300])
        y_pred = np.array([110, 190, 310])
        lower = np.array([90, 180, 290])
        upper = np.array([120, 200, 320])
        
        metrics = self.calculator.calculate_all_metrics(
            y_true, y_pred, lower, upper
        )
        
        assert 'mape' in metrics
        assert 'mae' in metrics
        assert 'rmse' in metrics
        assert 'coverage' in metrics
        assert 'interval_width' in metrics
        assert 'interval_width_absolute' in metrics
        
        assert metrics['mae'] == 10.0
        assert metrics['rmse'] == 10.0
        assert metrics['coverage'] == 100.0
    
    def test_calculate_per_stock_metrics(self):
        """Test per-stock metrics calculation."""
        predictions = pd.DataFrame({
            'symbol': ['PETR4', 'PETR4', 'VALE3', 'VALE3'],
            'date': ['2024-01-01', '2024-01-02', '2024-01-01', '2024-01-02'],
            'prediction': [30.0, 31.0, 50.0, 51.0],
            'lower_bound': [29.0, 30.0, 49.0, 50.0],
            'upper_bound': [31.0, 32.0, 51.0, 52.0]
        })
        
        actuals = pd.DataFrame({
            'symbol': ['PETR4', 'PETR4', 'VALE3', 'VALE3'],
            'date': ['2024-01-01', '2024-01-02', '2024-01-01', '2024-01-02'],
            'actual': [30.5, 30.8, 50.2, 50.9]
        })
        
        per_stock = self.calculator.calculate_per_stock_metrics(
            predictions, actuals
        )
        
        assert len(per_stock) == 2
        assert set(per_stock['symbol']) == {'PETR4', 'VALE3'}
        assert 'mape' in per_stock.columns
        assert 'coverage' in per_stock.columns
        assert 'num_predictions' in per_stock.columns
    
    def test_calculate_per_sector_metrics(self):
        """Test per-sector metrics calculation."""
        per_stock = pd.DataFrame({
            'symbol': ['PETR4', 'VALE3', 'ITUB4'],
            'mape': [5.0, 6.0, 7.0],
            'mae': [1.5, 2.0, 2.5],
            'rmse': [2.0, 2.5, 3.0],
            'coverage': [92.0, 91.0, 90.0],
            'interval_width': [10.0, 11.0, 12.0],
            'num_predictions': [100, 100, 100]
        })
        
        stock_sector_mapping = {
            'PETR4': 'Energy',
            'VALE3': 'Materials',
            'ITUB4': 'Financials'
        }
        
        per_sector = self.calculator.calculate_per_sector_metrics(
            per_stock, stock_sector_mapping
        )
        
        assert len(per_sector) == 3
        assert set(per_sector['sector']) == {'Energy', 'Materials', 'Financials'}
        assert 'mape' in per_sector.columns
    
    def test_calculate_overall_metrics(self):
        """Test overall metrics calculation."""
        predictions = pd.DataFrame({
            'prediction': [30.0, 31.0, 50.0, 51.0],
            'lower_bound': [29.0, 30.0, 49.0, 50.0],
            'upper_bound': [31.0, 32.0, 51.0, 52.0]
        })
        
        actuals = pd.DataFrame({
            'actual': [30.5, 30.8, 50.2, 50.9]
        })
        
        overall = self.calculator.calculate_overall_metrics(
            predictions, actuals
        )
        
        assert 'mape' in overall
        assert 'mae' in overall
        assert 'rmse' in overall
        assert 'coverage' in overall
        assert 'num_predictions' in overall
        assert overall['num_predictions'] == 4
