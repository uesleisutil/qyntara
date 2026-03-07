"""
Tests for Ensemble Manager and Dynamic Weight Calculator.
"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from unittest.mock import Mock, MagicMock

from ml.src.models.ensemble_manager import (
    DynamicWeightCalculator,
    EnsembleManager,
    PredictionIntervalGenerator
)


class TestDynamicWeightCalculator:
    """Tests for DynamicWeightCalculator."""
    
    def test_initialization(self):
        """Test calculator initialization with default parameters."""
        calc = DynamicWeightCalculator()
        
        assert calc.window_months == 3
        assert calc.adjustment_threshold == 0.20
        assert calc.min_weight == 0.05
        assert calc.weight_history == []
    
    def test_initialization_custom_params(self):
        """Test calculator initialization with custom parameters."""
        calc = DynamicWeightCalculator(
            window_months=6,
            adjustment_threshold=0.15,
            min_weight=0.10
        )
        
        assert calc.window_months == 6
        assert calc.adjustment_threshold == 0.15
        assert calc.min_weight == 0.10
    
    def test_calculate_weights_basic(self):
        """Test basic weight calculation with equal performance."""
        calc = DynamicWeightCalculator()
        
        metrics = {
            'model_a': [10.0, 10.0, 10.0],
            'model_b': [10.0, 10.0, 10.0]
        }
        
        weights = calc.calculate_weights(metrics)
        
        # Equal MAPE should give equal weights
        assert abs(weights['model_a'] - 0.5) < 0.01
        assert abs(weights['model_b'] - 0.5) < 0.01
        assert abs(sum(weights.values()) - 1.0) < 1e-10
    
    def test_calculate_weights_different_performance(self):
        """Test weight calculation with different performance."""
        calc = DynamicWeightCalculator()
        
        metrics = {
            'model_a': [5.0, 5.0, 5.0],  # Better performance
            'model_b': [10.0, 10.0, 10.0]  # Worse performance
        }
        
        weights = calc.calculate_weights(metrics)
        
        # Better model should get higher weight
        assert weights['model_a'] > weights['model_b']
        assert abs(sum(weights.values()) - 1.0) < 1e-10
        
        # Check inverse relationship (model_a MAPE is half, so weight should be ~2x)
        assert abs(weights['model_a'] / weights['model_b'] - 2.0) < 0.01
    
    def test_calculate_weights_four_models(self):
        """Test weight calculation with four models."""
        calc = DynamicWeightCalculator()
        
        metrics = {
            'deepar': [8.0, 8.2, 7.8],
            'lstm': [7.5, 7.8, 7.2],
            'prophet': [9.0, 9.1, 8.9],
            'xgboost': [7.0, 7.5, 6.5]
        }
        
        weights = calc.calculate_weights(metrics)
        
        # Check all models present
        assert set(weights.keys()) == {'deepar', 'lstm', 'prophet', 'xgboost'}
        
        # Check weights sum to 1
        assert abs(sum(weights.values()) - 1.0) < 1e-10
        
        # Check ordering (lower MAPE = higher weight)
        assert weights['xgboost'] > weights['lstm']
        assert weights['lstm'] > weights['deepar']
        assert weights['deepar'] > weights['prophet']
    
    def test_calculate_weights_empty_metrics(self):
        """Test that empty metrics raises error."""
        calc = DynamicWeightCalculator()
        
        with pytest.raises(ValueError, match="cannot be empty"):
            calc.calculate_weights({})
    
    def test_calculate_weights_empty_model_data(self):
        """Test that empty model data raises error."""
        calc = DynamicWeightCalculator()
        
        metrics = {
            'model_a': [],
            'model_b': [10.0]
        }
        
        with pytest.raises(ValueError, match="has no MAPE values"):
            calc.calculate_weights(metrics)
    
    def test_calculate_weights_nan_values(self):
        """Test that NaN values raise error."""
        calc = DynamicWeightCalculator()
        
        metrics = {
            'model_a': [10.0, np.nan, 10.0],
            'model_b': [10.0, 10.0, 10.0]
        }
        
        with pytest.raises(ValueError, match="invalid MAPE values"):
            calc.calculate_weights(metrics)
    
    def test_calculate_weights_inf_values(self):
        """Test that inf values raise error."""
        calc = DynamicWeightCalculator()
        
        metrics = {
            'model_a': [10.0, np.inf, 10.0],
            'model_b': [10.0, 10.0, 10.0]
        }
        
        with pytest.raises(ValueError, match="invalid MAPE values"):
            calc.calculate_weights(metrics)
    
    def test_min_weight_constraint(self):
        """Test minimum weight constraint is applied."""
        calc = DynamicWeightCalculator(min_weight=0.10)
        
        metrics = {
            'model_a': [5.0, 5.0, 5.0],  # Much better
            'model_b': [50.0, 50.0, 50.0]  # Much worse
        }
        
        weights = calc.calculate_weights(metrics)
        
        # Both models should have at least min_weight (with small tolerance for floating point)
        assert weights['model_a'] >= 0.10 - 1e-10
        assert weights['model_b'] >= 0.10 - 1e-10
        assert abs(sum(weights.values()) - 1.0) < 1e-10
    
    def test_weight_history_tracking(self):
        """Test that weight history is tracked."""
        calc = DynamicWeightCalculator()
        
        metrics1 = {'model_a': [10.0], 'model_b': [10.0]}
        metrics2 = {'model_a': [8.0], 'model_b': [12.0]}
        
        calc.calculate_weights(metrics1)
        calc.calculate_weights(metrics2)
        
        history = calc.get_weight_history()
        
        assert len(history) == 2
        assert 'timestamp' in history[0]
        assert 'weights' in history[0]
        assert 'avg_mapes' in history[0]
    
    def test_should_recalculate_no_history(self):
        """Test recalculation needed when no history."""
        calc = DynamicWeightCalculator()
        
        current_metrics = {'model_a': 10.0, 'model_b': 10.0}
        last_weights = {'model_a': 0.5, 'model_b': 0.5}
        
        assert calc.should_recalculate(current_metrics, last_weights) is True
    
    def test_should_recalculate_no_last_weights(self):
        """Test recalculation needed when no last weights."""
        calc = DynamicWeightCalculator()
        
        current_metrics = {'model_a': 10.0, 'model_b': 10.0}
        
        assert calc.should_recalculate(current_metrics, {}) is True
    
    def test_should_recalculate_small_change(self):
        """Test no recalculation needed for small MAPE change."""
        calc = DynamicWeightCalculator(adjustment_threshold=0.20)
        
        # Initialize history
        metrics = {'model_a': [10.0], 'model_b': [10.0]}
        last_weights = calc.calculate_weights(metrics)
        
        # Small change (10%)
        current_metrics = {'model_a': 11.0, 'model_b': 10.0}
        
        assert calc.should_recalculate(current_metrics, last_weights) is False
    
    def test_should_recalculate_large_change(self):
        """Test recalculation needed for large MAPE change."""
        calc = DynamicWeightCalculator(adjustment_threshold=0.20)
        
        # Initialize history
        metrics = {'model_a': [10.0], 'model_b': [10.0]}
        last_weights = calc.calculate_weights(metrics)
        
        # Large change (30%)
        current_metrics = {'model_a': 13.0, 'model_b': 10.0}
        
        assert calc.should_recalculate(current_metrics, last_weights) is True
    
    def test_should_recalculate_new_model(self):
        """Test recalculation needed when new model added."""
        calc = DynamicWeightCalculator()
        
        # Initialize history
        metrics = {'model_a': [10.0], 'model_b': [10.0]}
        last_weights = calc.calculate_weights(metrics)
        
        # Add new model
        current_metrics = {'model_a': 10.0, 'model_b': 10.0, 'model_c': 10.0}
        
        assert calc.should_recalculate(current_metrics, last_weights) is True


class TestEnsembleManager:
    """Tests for EnsembleManager."""
    
    def test_initialization_empty(self):
        """Test initialization with no models."""
        manager = EnsembleManager()
        
        assert manager.models == {}
        assert isinstance(manager.weight_calculator, DynamicWeightCalculator)
        assert manager.current_weights == {}
    
    def test_initialization_with_models(self):
        """Test initialization with models."""
        models = {
            'model_a': Mock(),
            'model_b': Mock()
        }
        
        manager = EnsembleManager(models=models)
        
        assert len(manager.models) == 2
        assert 'model_a' in manager.models
        assert 'model_b' in manager.models
    
    def test_initialization_with_custom_calculator(self):
        """Test initialization with custom weight calculator."""
        calc = DynamicWeightCalculator(window_months=6)
        manager = EnsembleManager(weight_calculator=calc)
        
        assert manager.weight_calculator.window_months == 6
    
    def test_add_model(self):
        """Test adding a model to ensemble."""
        manager = EnsembleManager()
        model = Mock()
        
        manager.add_model('test_model', model)
        
        assert 'test_model' in manager.models
        assert manager.models['test_model'] is model
    
    def test_remove_model(self):
        """Test removing a model from ensemble."""
        model = Mock()
        manager = EnsembleManager(models={'test_model': model})
        
        manager.remove_model('test_model')
        
        assert 'test_model' not in manager.models
    
    def test_remove_nonexistent_model(self):
        """Test removing nonexistent model doesn't raise error."""
        manager = EnsembleManager()
        
        # Should not raise error
        manager.remove_model('nonexistent')
    
    def test_predict_all_success(self):
        """Test predicting with all models."""
        model_a = Mock()
        model_a.predict.return_value = np.array([1.0, 2.0, 3.0])
        
        model_b = Mock()
        model_b.predict.return_value = np.array([1.5, 2.5, 3.5])
        
        manager = EnsembleManager(models={
            'model_a': model_a,
            'model_b': model_b
        })
        
        input_data = pd.DataFrame({'feature': [1, 2, 3]})
        predictions = manager.predict_all(input_data)
        
        assert 'model_a' in predictions
        assert 'model_b' in predictions
        assert len(predictions['model_a']) == 3
        assert len(predictions['model_b']) == 3
        
        model_a.predict.assert_called_once()
        model_b.predict.assert_called_once()
    
    def test_predict_all_no_models(self):
        """Test predicting with no models raises error."""
        manager = EnsembleManager()
        input_data = pd.DataFrame({'feature': [1, 2, 3]})
        
        with pytest.raises(ValueError, match="No models available"):
            manager.predict_all(input_data)
    
    def test_predict_all_with_error(self):
        """Test that prediction error is propagated."""
        model = Mock()
        model.predict.side_effect = RuntimeError("Prediction failed")
        
        manager = EnsembleManager(models={'model': model})
        input_data = pd.DataFrame({'feature': [1, 2, 3]})
        
        with pytest.raises(RuntimeError, match="Prediction failed"):
            manager.predict_all(input_data)
    
    def test_weighted_average_equal_weights(self):
        """Test weighted average with equal weights."""
        manager = EnsembleManager()
        
        predictions = {
            'model_a': np.array([1.0, 2.0, 3.0]),
            'model_b': np.array([3.0, 4.0, 5.0])
        }
        
        weights = {'model_a': 0.5, 'model_b': 0.5}
        
        result = manager.weighted_average(predictions, weights)
        
        expected = np.array([2.0, 3.0, 4.0])
        np.testing.assert_array_almost_equal(result, expected)
    
    def test_weighted_average_different_weights(self):
        """Test weighted average with different weights."""
        manager = EnsembleManager()
        
        predictions = {
            'model_a': np.array([1.0, 2.0, 3.0]),
            'model_b': np.array([3.0, 4.0, 5.0])
        }
        
        weights = {'model_a': 0.7, 'model_b': 0.3}
        
        result = manager.weighted_average(predictions, weights)
        
        expected = np.array([1.6, 2.6, 3.6])
        np.testing.assert_array_almost_equal(result, expected)
    
    def test_weighted_average_four_models(self):
        """Test weighted average with four models."""
        manager = EnsembleManager()
        
        predictions = {
            'deepar': np.array([10.0, 20.0]),
            'lstm': np.array([12.0, 22.0]),
            'prophet': np.array([11.0, 21.0]),
            'xgboost': np.array([13.0, 23.0])
        }
        
        weights = {
            'deepar': 0.25,
            'lstm': 0.30,
            'prophet': 0.20,
            'xgboost': 0.25
        }
        
        result = manager.weighted_average(predictions, weights)
        
        # Calculate expected: 0.25*10 + 0.30*12 + 0.20*11 + 0.25*13 = 11.55
        expected = np.array([11.55, 21.55])
        np.testing.assert_array_almost_equal(result, expected)
    
    def test_weighted_average_no_weights_uses_equal(self):
        """Test weighted average without weights uses equal weights."""
        manager = EnsembleManager()
        
        predictions = {
            'model_a': np.array([1.0, 2.0]),
            'model_b': np.array([3.0, 4.0])
        }
        
        result = manager.weighted_average(predictions)
        
        expected = np.array([2.0, 3.0])
        np.testing.assert_array_almost_equal(result, expected)
    
    def test_weighted_average_uses_current_weights(self):
        """Test weighted average uses current weights if available."""
        manager = EnsembleManager()
        manager.current_weights = {'model_a': 0.6, 'model_b': 0.4}
        
        predictions = {
            'model_a': np.array([1.0, 2.0]),
            'model_b': np.array([3.0, 4.0])
        }
        
        result = manager.weighted_average(predictions)
        
        expected = np.array([1.8, 2.8])
        np.testing.assert_array_almost_equal(result, expected)
    
    def test_weighted_average_empty_predictions(self):
        """Test weighted average with empty predictions raises error."""
        manager = EnsembleManager()
        
        with pytest.raises(ValueError, match="cannot be empty"):
            manager.weighted_average({})
    
    def test_weighted_average_mismatched_keys(self):
        """Test weighted average with mismatched keys raises error."""
        manager = EnsembleManager()
        
        predictions = {
            'model_a': np.array([1.0, 2.0]),
            'model_b': np.array([3.0, 4.0])
        }
        
        weights = {'model_a': 0.5, 'model_c': 0.5}
        
        with pytest.raises(ValueError, match="must match"):
            manager.weighted_average(predictions, weights)
    
    def test_weighted_average_different_lengths(self):
        """Test weighted average with different length predictions raises error."""
        manager = EnsembleManager()
        
        predictions = {
            'model_a': np.array([1.0, 2.0]),
            'model_b': np.array([3.0, 4.0, 5.0])
        }
        
        weights = {'model_a': 0.5, 'model_b': 0.5}
        
        with pytest.raises(ValueError, match="same length"):
            manager.weighted_average(predictions, weights)
    
    def test_update_weights(self):
        """Test updating ensemble weights."""
        manager = EnsembleManager()
        
        metrics = {
            'model_a': [8.0, 8.0, 8.0],
            'model_b': [10.0, 10.0, 10.0]
        }
        
        weights = manager.update_weights(metrics)
        
        assert 'model_a' in weights
        assert 'model_b' in weights
        assert weights['model_a'] > weights['model_b']
        assert manager.current_weights == weights
    
    def test_get_current_weights(self):
        """Test getting current weights."""
        manager = EnsembleManager()
        manager.current_weights = {'model_a': 0.6, 'model_b': 0.4}
        
        weights = manager.get_current_weights()
        
        assert weights == {'model_a': 0.6, 'model_b': 0.4}
        
        # Verify it's a copy
        weights['model_a'] = 0.5
        assert manager.current_weights['model_a'] == 0.6
    
    def test_get_current_weights_empty(self):
        """Test getting current weights when empty."""
        manager = EnsembleManager()
        
        weights = manager.get_current_weights()
        
        assert weights == {}


class TestEnsembleIntegration:
    """Integration tests for ensemble workflow."""
    
    def test_complete_ensemble_workflow(self):
        """Test complete workflow: add models, predict, calculate weights, combine."""
        # Create mock models
        model_a = Mock()
        model_a.predict.return_value = np.array([10.0, 20.0, 30.0])
        
        model_b = Mock()
        model_b.predict.return_value = np.array([12.0, 22.0, 32.0])
        
        # Create ensemble
        manager = EnsembleManager()
        manager.add_model('model_a', model_a)
        manager.add_model('model_b', model_b)
        
        # Generate predictions
        input_data = pd.DataFrame({'feature': [1, 2, 3]})
        predictions = manager.predict_all(input_data)
        
        # Update weights based on performance
        metrics = {
            'model_a': [8.0, 8.0, 8.0],
            'model_b': [10.0, 10.0, 10.0]
        }
        manager.update_weights(metrics)
        
        # Combine predictions
        ensemble_pred = manager.weighted_average(predictions)
        
        # Verify results
        assert len(ensemble_pred) == 3
        assert ensemble_pred[0] > 10.0  # Should be weighted toward model_a
        assert ensemble_pred[0] < 12.0



class TestPredictionIntervalGenerator:
    """Tests for PredictionIntervalGenerator."""
    
    def test_initialization(self):
        """Test generator initialization."""
        gen = PredictionIntervalGenerator()
        
        assert gen.target_coverage == 0.90
        assert gen.confidence_level == 0.95
        assert gen.calibration_scores == []
    
    def test_initialization_custom_params(self):
        """Test generator initialization with custom parameters."""
        gen = PredictionIntervalGenerator(
            target_coverage=0.85,
            confidence_level=0.99
        )
        
        assert gen.target_coverage == 0.85
        assert gen.confidence_level == 0.99
    
    def test_generate_intervals_from_variance(self):
        """Test interval generation from prediction variance."""
        gen = PredictionIntervalGenerator()
        
        predictions = {
            'model_a': np.array([10.0, 20.0, 30.0]),
            'model_b': np.array([12.0, 22.0, 32.0])
        }
        
        lower, upper = gen.generate_intervals(predictions)
        
        assert len(lower) == 3
        assert len(upper) == 3
        assert np.all(lower < upper)
        
        # Check intervals are centered around mean
        mean = np.array([11.0, 21.0, 31.0])
        center = (lower + upper) / 2
        np.testing.assert_array_almost_equal(center, mean)
    
    def test_generate_intervals_with_weights(self):
        """Test interval generation with custom weights."""
        gen = PredictionIntervalGenerator()
        
        predictions = {
            'model_a': np.array([10.0, 20.0]),
            'model_b': np.array([20.0, 30.0])
        }
        
        weights = {'model_a': 0.7, 'model_b': 0.3}
        
        lower, upper = gen.generate_intervals(predictions, weights)
        
        # Center should be weighted toward model_a
        center = (lower + upper) / 2
        assert center[0] < 15.0  # Closer to 10 than 20
    
    def test_generate_intervals_with_model_intervals(self):
        """Test interval generation by combining model intervals."""
        gen = PredictionIntervalGenerator()
        
        predictions = {
            'model_a': np.array([10.0, 20.0]),
            'model_b': np.array([12.0, 22.0])
        }
        
        model_intervals = {
            'model_a': (np.array([9.0, 19.0]), np.array([11.0, 21.0])),
            'model_b': (np.array([11.0, 21.0]), np.array([13.0, 23.0]))
        }
        
        weights = {'model_a': 0.5, 'model_b': 0.5}
        
        lower, upper = gen.generate_intervals(
            predictions, weights, model_intervals
        )
        
        # Should be average of model intervals
        expected_lower = np.array([10.0, 20.0])
        expected_upper = np.array([12.0, 22.0])
        
        np.testing.assert_array_almost_equal(lower, expected_lower)
        np.testing.assert_array_almost_equal(upper, expected_upper)
    
    def test_generate_intervals_empty_predictions(self):
        """Test that empty predictions raises error."""
        gen = PredictionIntervalGenerator()
        
        with pytest.raises(ValueError, match="cannot be empty"):
            gen.generate_intervals({})
    
    def test_generate_intervals_mismatched_weights(self):
        """Test that mismatched weights raises error."""
        gen = PredictionIntervalGenerator()
        
        predictions = {
            'model_a': np.array([10.0]),
            'model_b': np.array([12.0])
        }
        
        weights = {'model_a': 0.5, 'model_c': 0.5}
        
        with pytest.raises(ValueError, match="must match"):
            gen.generate_intervals(predictions, weights)
    
    def test_generate_intervals_mismatched_model_intervals(self):
        """Test that mismatched model intervals raises error."""
        gen = PredictionIntervalGenerator()
        
        predictions = {
            'model_a': np.array([10.0]),
            'model_b': np.array([12.0])
        }
        
        model_intervals = {
            'model_a': (np.array([9.0]), np.array([11.0]))
        }
        
        with pytest.raises(ValueError, match="must match"):
            gen.generate_intervals(predictions, model_intervals=model_intervals)
    
    def test_calibrate_basic(self):
        """Test basic calibration."""
        gen = PredictionIntervalGenerator()
        
        predictions = np.array([10.0, 20.0, 30.0])
        actuals = np.array([10.5, 19.5, 30.5])
        lower_bounds = np.array([9.0, 19.0, 29.0])
        upper_bounds = np.array([11.0, 21.0, 31.0])
        
        gen.calibrate(predictions, actuals, lower_bounds, upper_bounds)
        
        assert len(gen.calibration_scores) == 3
    
    def test_calibrate_mismatched_lengths(self):
        """Test that mismatched lengths raise error."""
        gen = PredictionIntervalGenerator()
        
        predictions = np.array([10.0, 20.0])
        actuals = np.array([10.5])
        lower_bounds = np.array([9.0, 19.0])
        upper_bounds = np.array([11.0, 21.0])
        
        with pytest.raises(ValueError, match="same length"):
            gen.calibrate(predictions, actuals, lower_bounds, upper_bounds)
    
    def test_calibrate_with_coverage_calculation(self):
        """Test calibration calculates coverage correctly."""
        gen = PredictionIntervalGenerator()
        
        predictions = np.array([10.0, 20.0, 30.0, 40.0])
        actuals = np.array([10.5, 19.5, 35.0, 40.5])  # One outside
        lower_bounds = np.array([9.0, 19.0, 29.0, 39.0])
        upper_bounds = np.array([11.0, 21.0, 31.0, 41.0])
        
        gen.calibrate(predictions, actuals, lower_bounds, upper_bounds)
        
        # Coverage should be 75% (3 out of 4 within bounds)
        assert len(gen.calibration_scores) == 4
    
    def test_calculate_interval_width(self):
        """Test interval width calculation."""
        gen = PredictionIntervalGenerator()
        
        predictions = np.array([10.0, 20.0, 30.0])
        lower_bounds = np.array([9.0, 18.0, 27.0])
        upper_bounds = np.array([11.0, 22.0, 33.0])
        
        width = gen.calculate_interval_width(lower_bounds, upper_bounds, predictions)
        
        # Width should be 20% for first, 20% for second, 20% for third
        assert abs(width - 0.20) < 0.01
    
    def test_calculate_interval_width_mismatched_lengths(self):
        """Test that mismatched lengths raise error."""
        gen = PredictionIntervalGenerator()
        
        lower_bounds = np.array([9.0, 18.0])
        upper_bounds = np.array([11.0, 22.0, 33.0])
        predictions = np.array([10.0, 20.0])
        
        with pytest.raises(ValueError, match="same length"):
            gen.calculate_interval_width(lower_bounds, upper_bounds, predictions)
    
    def test_get_calibration_scores(self):
        """Test getting calibration scores."""
        gen = PredictionIntervalGenerator()
        
        predictions = np.array([10.0, 20.0])
        actuals = np.array([10.5, 19.5])
        lower_bounds = np.array([9.0, 19.0])
        upper_bounds = np.array([11.0, 21.0])
        
        gen.calibrate(predictions, actuals, lower_bounds, upper_bounds)
        
        scores = gen.get_calibration_scores()
        
        assert len(scores) == 2
        
        # Verify it's a copy
        scores[0] = 999.0
        assert gen.calibration_scores[0] != 999.0
    
    def test_intervals_with_calibration(self):
        """Test that calibration affects interval generation."""
        gen = PredictionIntervalGenerator()
        
        # Generate intervals without calibration
        predictions = {
            'model_a': np.array([10.0, 20.0]),
            'model_b': np.array([12.0, 22.0])
        }
        
        lower1, upper1 = gen.generate_intervals(predictions)
        width1 = upper1[0] - lower1[0]
        
        # Calibrate
        pred_array = np.array([10.0, 20.0])
        actuals = np.array([10.5, 19.5])
        lower_bounds = np.array([9.0, 19.0])
        upper_bounds = np.array([11.0, 21.0])
        
        gen.calibrate(pred_array, actuals, lower_bounds, upper_bounds)
        
        # Generate intervals with calibration
        lower2, upper2 = gen.generate_intervals(predictions)
        width2 = upper2[0] - lower2[0]
        
        # Widths should be different after calibration
        assert width1 != width2


class TestEnsembleWithIntervals:
    """Integration tests for ensemble with interval generation."""
    
    def test_ensemble_with_interval_generation(self):
        """Test complete workflow with interval generation."""
        # Create mock models
        model_a = Mock()
        model_a.predict.return_value = np.array([10.0, 20.0, 30.0])
        
        model_b = Mock()
        model_b.predict.return_value = np.array([12.0, 22.0, 32.0])
        
        # Create ensemble
        manager = EnsembleManager()
        manager.add_model('model_a', model_a)
        manager.add_model('model_b', model_b)
        
        # Generate predictions
        input_data = pd.DataFrame({'feature': [1, 2, 3]})
        predictions = manager.predict_all(input_data)
        
        # Update weights
        metrics = {
            'model_a': [8.0, 8.0, 8.0],
            'model_b': [10.0, 10.0, 10.0]
        }
        weights = manager.update_weights(metrics)
        
        # Generate ensemble prediction
        ensemble_pred = manager.weighted_average(predictions, weights)
        
        # Generate intervals
        interval_gen = PredictionIntervalGenerator()
        lower, upper = interval_gen.generate_intervals(predictions, weights)
        
        # Verify results
        assert len(ensemble_pred) == 3
        assert len(lower) == 3
        assert len(upper) == 3
        assert np.all(lower < ensemble_pred)
        assert np.all(ensemble_pred < upper)
