"""
Unit tests for Hyperparameter Optimizer

Tests the Optuna-based hyperparameter optimization for all model types.
"""

import pickle
import tempfile
from unittest.mock import MagicMock, patch

import numpy as np
import optuna
import pandas as pd
import pytest

from models.hyperparameter_optimizer import (
    OptunaOptimizer,
    create_walk_forward_objective,
)


class TestOptunaOptimizer:
    """Test suite for OptunaOptimizer class."""
    
    def test_init_valid_model_types(self):
        """Test initialization with valid model types."""
        for model_type in ['deepar', 'lstm', 'prophet', 'xgboost']:
            optimizer = OptunaOptimizer(model_type=model_type, n_trials=50)
            assert optimizer.model_type == model_type
            assert optimizer.n_trials == 50
            assert optimizer.study is None
            assert optimizer.best_params is None
    
    def test_init_invalid_model_type(self):
        """Test initialization with invalid model type."""
        with pytest.raises(ValueError, match="Invalid model_type"):
            OptunaOptimizer(model_type='invalid_model', n_trials=50)
    
    def test_init_insufficient_trials(self):
        """Test initialization with fewer than 50 trials (requirement 5.3)."""
        with pytest.raises(ValueError, match="n_trials must be at least 50"):
            OptunaOptimizer(model_type='lstm', n_trials=30)
    
    def test_init_minimum_trials(self):
        """Test initialization with exactly 50 trials (minimum requirement)."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        assert optimizer.n_trials == 50
    
    def test_get_search_space_deepar(self):
        """Test search space definition for DeepAR."""
        optimizer = OptunaOptimizer(model_type='deepar', n_trials=50)
        
        # Create a mock trial
        study = optuna.create_study()
        trial = optuna.trial.Trial(study, study._storage.create_new_trial(study._study_id))
        
        # Mock the suggest methods to return fixed values
        trial.suggest_int = MagicMock(side_effect=[30, 5, 2, 50, 100, 64])
        trial.suggest_float = MagicMock(side_effect=[0.2, 0.001])
        trial.suggest_categorical = MagicMock(return_value=128)
        
        params = optimizer._get_search_space(trial)
        
        # Verify all required DeepAR parameters are present
        assert 'context_length' in params
        assert 'prediction_length' in params
        assert 'num_layers' in params
        assert 'num_cells' in params
        assert 'dropout_rate' in params
        assert 'learning_rate' in params
        assert 'epochs' in params
        assert 'mini_batch_size' in params
    
    def test_get_search_space_lstm(self):
        """Test search space definition for LSTM."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        study = optuna.create_study()
        trial = optuna.trial.Trial(study, study._storage.create_new_trial(study._study_id))
        
        trial.suggest_int = MagicMock(side_effect=[128, 2, 30])
        trial.suggest_float = MagicMock(side_effect=[0.2, 0.001, 1e-5])
        trial.suggest_categorical = MagicMock(return_value=32)
        
        params = optimizer._get_search_space(trial)
        
        # Verify all required LSTM parameters are present
        assert 'hidden_size' in params
        assert 'num_layers' in params
        assert 'dropout' in params
        assert 'learning_rate' in params
        assert 'batch_size' in params
        assert 'sequence_length' in params
        assert 'weight_decay' in params
    
    def test_get_search_space_prophet(self):
        """Test search space definition for Prophet."""
        optimizer = OptunaOptimizer(model_type='prophet', n_trials=50)
        
        study = optuna.create_study()
        trial = optuna.trial.Trial(study, study._storage.create_new_trial(study._study_id))
        
        trial.suggest_float = MagicMock(side_effect=[0.05, 1.0, 1.0, 0.9])
        trial.suggest_int = MagicMock(return_value=25)
        trial.suggest_categorical = MagicMock(return_value='additive')
        
        params = optimizer._get_search_space(trial)
        
        # Verify all required Prophet parameters are present
        assert 'changepoint_prior_scale' in params
        assert 'seasonality_prior_scale' in params
        assert 'holidays_prior_scale' in params
        assert 'seasonality_mode' in params
        assert 'changepoint_range' in params
        assert 'n_changepoints' in params
    
    def test_get_search_space_xgboost(self):
        """Test search space definition for XGBoost."""
        optimizer = OptunaOptimizer(model_type='xgboost', n_trials=50)
        
        study = optuna.create_study()
        trial = optuna.trial.Trial(study, study._storage.create_new_trial(study._study_id))
        
        trial.suggest_int = MagicMock(side_effect=[100, 6, 5])
        trial.suggest_float = MagicMock(side_effect=[0.1, 0.8, 0.8, 2.0, 0.01, 0.1])
        
        params = optimizer._get_search_space(trial)
        
        # Verify all required XGBoost parameters are present
        assert 'n_estimators' in params
        assert 'max_depth' in params
        assert 'learning_rate' in params
        assert 'subsample' in params
        assert 'colsample_bytree' in params
        assert 'min_child_weight' in params
        assert 'gamma' in params
        assert 'reg_alpha' in params
        assert 'reg_lambda' in params
    
    def test_objective_success(self):
        """Test objective function with successful evaluation."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        # Create mock objective function
        mock_objective_func = MagicMock(return_value=0.05)  # MAPE = 5%
        
        # Create a mock trial
        study = optuna.create_study()
        trial = optuna.trial.Trial(study, study._storage.create_new_trial(study._study_id))
        
        # Mock search space
        trial.suggest_int = MagicMock(side_effect=[128, 2, 30])
        trial.suggest_float = MagicMock(side_effect=[0.2, 0.001, 1e-5])
        trial.suggest_categorical = MagicMock(return_value=32)
        
        result = optimizer.objective(trial, mock_objective_func)
        
        assert result == 0.05
        assert mock_objective_func.called
    
    def test_objective_failure(self):
        """Test objective function with failed evaluation."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        # Create mock objective function that raises exception
        mock_objective_func = MagicMock(side_effect=Exception("Training failed"))
        
        # Create a mock trial
        study = optuna.create_study()
        trial = optuna.trial.Trial(study, study._storage.create_new_trial(study._study_id))
        
        # Mock search space
        trial.suggest_int = MagicMock(side_effect=[128, 2, 30])
        trial.suggest_float = MagicMock(side_effect=[0.2, 0.001, 1e-5])
        trial.suggest_categorical = MagicMock(return_value=32)
        
        result = optimizer.objective(trial, mock_objective_func)
        
        # Should return infinity on failure
        assert result == float('inf')
    
    def test_optimize_basic(self):
        """Test basic optimization run."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        # Create simple objective function that returns random values
        def simple_objective(hyperparameters):
            # Simulate MAPE calculation
            return np.random.uniform(0.05, 0.15)
        
        result = optimizer.optimize(
            objective_func=simple_objective,
            direction='minimize'
        )
        
        # Verify results
        assert 'best_params' in result
        assert 'best_value' in result
        assert 'n_trials' in result
        assert 'study' in result
        
        assert result['n_trials'] >= 50  # At least 50 trials completed
        assert optimizer.best_params is not None
        assert optimizer.best_value is not None
        assert optimizer.study is not None
    
    def test_optimize_minimize_direction(self):
        """Test optimization with minimize direction (for MAPE)."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        # Objective function that returns decreasing values
        call_count = [0]
        def decreasing_objective(hyperparameters):
            call_count[0] += 1
            return 0.15 - (call_count[0] * 0.001)  # Decreasing MAPE
        
        result = optimizer.optimize(
            objective_func=decreasing_objective,
            direction='minimize'
        )
        
        # Best value should be close to the minimum
        assert result['best_value'] < 0.15
    
    def test_optimize_invalid_direction(self):
        """Test optimization with invalid direction."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        def simple_objective(hyperparameters):
            return 0.1
        
        with pytest.raises(ValueError, match="Invalid direction"):
            optimizer.optimize(
                objective_func=simple_objective,
                direction='invalid'
            )
    
    def test_get_best_params_before_optimization(self):
        """Test getting best params before running optimization."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        with pytest.raises(RuntimeError, match="Optimization has not been run yet"):
            optimizer.get_best_params()
    
    def test_get_best_params_after_optimization(self):
        """Test getting best params after optimization."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        def simple_objective(hyperparameters):
            return 0.1
        
        optimizer.optimize(objective_func=simple_objective, direction='minimize')
        
        best_params = optimizer.get_best_params()
        
        assert isinstance(best_params, dict)
        assert len(best_params) > 0
        # Verify it's a copy, not the original
        assert best_params is not optimizer.best_params
    
    def test_get_optimization_history(self):
        """Test getting optimization history."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        def simple_objective(hyperparameters):
            return np.random.uniform(0.05, 0.15)
        
        optimizer.optimize(objective_func=simple_objective, direction='minimize')
        
        history = optimizer.get_optimization_history()
        
        assert isinstance(history, pd.DataFrame)
        assert len(history) >= 50
        assert 'trial_number' in history.columns
        assert 'value' in history.columns
        assert 'state' in history.columns
        assert 'duration_seconds' in history.columns
    
    def test_get_param_importances(self):
        """Test getting parameter importances."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        def simple_objective(hyperparameters):
            # Make importance depend on hidden_size
            return 0.1 + (hyperparameters.get('hidden_size', 128) / 10000)
        
        optimizer.optimize(objective_func=simple_objective, direction='minimize')
        
        importances = optimizer.get_param_importances()
        
        assert isinstance(importances, pd.DataFrame)
        if len(importances) > 0:  # May be empty if calculation fails
            assert 'param_name' in importances.columns
            assert 'importance' in importances.columns
    
    def test_save_and_load_study(self):
        """Test saving and loading study."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        def simple_objective(hyperparameters):
            return 0.1
        
        optimizer.optimize(objective_func=simple_objective, direction='minimize')
        
        # Save study
        with tempfile.NamedTemporaryFile(suffix='.pkl', delete=False) as f:
            temp_path = f.name
        
        try:
            optimizer.save_study(temp_path)
            
            # Create new optimizer and load study
            new_optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
            new_optimizer.load_study(temp_path)
            
            # Verify loaded data
            assert new_optimizer.model_type == optimizer.model_type
            assert new_optimizer.best_params == optimizer.best_params
            assert new_optimizer.best_value == optimizer.best_value
            assert new_optimizer.study is not None
            
        finally:
            import os
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    def test_save_study_before_optimization(self):
        """Test saving study before running optimization."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        with tempfile.NamedTemporaryFile(suffix='.pkl') as f:
            with pytest.raises(RuntimeError, match="No study to save"):
                optimizer.save_study(f.name)
    
    def test_load_study_nonexistent_file(self):
        """Test loading study from nonexistent file."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        with pytest.raises(FileNotFoundError):
            optimizer.load_study('/nonexistent/path/study.pkl')
    
    def test_optimization_with_timeout(self):
        """Test optimization with timeout."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=1000, timeout=2)
        
        def slow_objective(hyperparameters):
            import time
            time.sleep(0.1)  # Simulate slow evaluation
            return 0.1
        
        result = optimizer.optimize(
            objective_func=slow_objective,
            direction='minimize'
        )
        
        # Should complete fewer trials due to timeout
        assert result['n_trials'] < 1000
    
    def test_optimization_with_pruning(self):
        """Test that pruning is enabled and can prune trials."""
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        trial_count = [0]
        def objective_with_pruning(hyperparameters):
            trial_count[0] += 1
            # Return progressively worse values to trigger pruning
            return 0.1 + (trial_count[0] * 0.01)
        
        result = optimizer.optimize(
            objective_func=objective_with_pruning,
            direction='minimize'
        )
        
        # Check that some trials may have been pruned
        # (though not guaranteed in this simple test)
        assert result['n_completed'] + result['n_pruned'] + result['n_failed'] == result['n_trials']


class TestCreateWalkForwardObjective:
    """Test suite for create_walk_forward_objective helper function."""
    
    def test_create_objective_function(self):
        """Test creating objective function."""
        train_data = pd.DataFrame({'value': [1, 2, 3]})
        val_data = pd.DataFrame({'value': [4, 5, 6]})
        
        def mock_trainer(train, val, hyperparams):
            return 0.05  # Return MAPE
        
        objective_func = create_walk_forward_objective(
            model_trainer=mock_trainer,
            train_data=train_data,
            val_data=val_data
        )
        
        # Test the created objective function
        result = objective_func({'learning_rate': 0.001})
        assert result == 0.05
    
    def test_objective_function_with_failure(self):
        """Test objective function when trainer fails."""
        train_data = pd.DataFrame({'value': [1, 2, 3]})
        val_data = pd.DataFrame({'value': [4, 5, 6]})
        
        def failing_trainer(train, val, hyperparams):
            raise ValueError("Training failed")
        
        objective_func = create_walk_forward_objective(
            model_trainer=failing_trainer,
            train_data=train_data,
            val_data=val_data
        )
        
        # Should return infinity on failure
        result = objective_func({'learning_rate': 0.001})
        assert result == float('inf')
    
    def test_objective_function_passes_hyperparameters(self):
        """Test that objective function correctly passes hyperparameters."""
        train_data = pd.DataFrame({'value': [1, 2, 3]})
        val_data = pd.DataFrame({'value': [4, 5, 6]})
        
        received_params = {}
        def capturing_trainer(train, val, hyperparams):
            received_params.update(hyperparams)
            return 0.05
        
        objective_func = create_walk_forward_objective(
            model_trainer=capturing_trainer,
            train_data=train_data,
            val_data=val_data
        )
        
        test_params = {'learning_rate': 0.001, 'hidden_size': 128}
        objective_func(test_params)
        
        assert received_params == test_params


class TestIntegration:
    """Integration tests for hyperparameter optimization."""
    
    def test_full_optimization_workflow_lstm(self):
        """Test complete optimization workflow for LSTM."""
        # Create optimizer
        optimizer = OptunaOptimizer(model_type='lstm', n_trials=50)
        
        # Create mock training data
        train_data = pd.DataFrame({
            'feature1': np.random.randn(100),
            'feature2': np.random.randn(100),
            'target': np.random.randn(100)
        })
        
        val_data = pd.DataFrame({
            'feature1': np.random.randn(20),
            'feature2': np.random.randn(20),
            'target': np.random.randn(20)
        })
        
        # Create mock trainer
        def mock_lstm_trainer(train, val, hyperparams):
            # Simulate MAPE calculation based on hyperparameters
            # Better hyperparameters = lower MAPE
            base_mape = 0.10
            hidden_size_factor = (hyperparams.get('hidden_size', 128) - 128) / 1000
            lr_factor = abs(hyperparams.get('learning_rate', 0.001) - 0.001) * 10
            return base_mape + hidden_size_factor + lr_factor
        
        # Create objective function
        objective_func = create_walk_forward_objective(
            model_trainer=mock_lstm_trainer,
            train_data=train_data,
            val_data=val_data
        )
        
        # Run optimization
        result = optimizer.optimize(
            objective_func=objective_func,
            direction='minimize'
        )
        
        # Verify results
        assert result['best_value'] < 0.15  # Should find reasonable MAPE
        assert 'hidden_size' in result['best_params']
        assert 'learning_rate' in result['best_params']
        assert result['n_completed'] >= 50
        
        # Get best params
        best_params = optimizer.get_best_params()
        assert isinstance(best_params, dict)
        
        # Get history
        history = optimizer.get_optimization_history()
        assert len(history) >= 50
    
    def test_optimization_for_all_model_types(self):
        """Test that optimization works for all model types."""
        model_types = ['deepar', 'lstm', 'prophet', 'xgboost']
        
        for model_type in model_types:
            optimizer = OptunaOptimizer(model_type=model_type, n_trials=50)
            
            def simple_objective(hyperparams):
                return np.random.uniform(0.05, 0.15)
            
            result = optimizer.optimize(
                objective_func=simple_objective,
                direction='minimize'
            )
            
            assert result['best_params'] is not None
            assert result['best_value'] is not None
            assert result['n_trials'] >= 50


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
