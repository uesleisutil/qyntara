"""
Hyperparameter Optimization using Optuna

This module provides Bayesian hyperparameter optimization for all model types
(DeepAR, LSTM, Prophet, XGBoost) using Optuna with walk-forward validation.

Requirements:
- 5.1: Use Optuna for hyperparameter optimization with Bayesian optimization
- 5.3: Run minimum 50 trials per model with walk-forward validation
"""

import logging
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
import optuna
import pandas as pd
from optuna.pruners import MedianPruner
from optuna.samplers import TPESampler

logger = logging.getLogger(__name__)


class OptunaOptimizer:
    """
    Hyperparameter optimizer using Optuna for Bayesian optimization.
    
    Supports optimization for:
    - DeepAR: context_length, prediction_length, num_layers, num_cells, dropout, learning_rate
    - LSTM: hidden_size, num_layers, dropout, learning_rate, batch_size
    - Prophet: changepoint_prior_scale, seasonality_prior_scale, holidays_prior_scale, seasonality_mode
    - XGBoost: n_estimators, max_depth, learning_rate, subsample, colsample_bytree, min_child_weight
    
    Uses walk-forward validation as the objective function to evaluate hyperparameters.
    """
    
    def __init__(
        self,
        model_type: str,
        n_trials: int = 50,
        timeout: Optional[int] = None,
        n_jobs: int = 1,
        random_state: int = 42
    ):
        """
        Initialize Optuna optimizer.
        
        Args:
            model_type: Type of model to optimize ('deepar', 'lstm', 'prophet', 'xgboost')
            n_trials: Number of optimization trials (minimum 50 per requirement 5.3)
            timeout: Timeout in seconds for optimization (None for no timeout)
            n_jobs: Number of parallel jobs (-1 for all CPUs)
            random_state: Random seed for reproducibility
            
        Raises:
            ValueError: If model_type is invalid or n_trials < 50
        """
        valid_model_types = ['deepar', 'lstm', 'prophet', 'xgboost']
        if model_type not in valid_model_types:
            raise ValueError(
                f"Invalid model_type: {model_type}. "
                f"Must be one of {valid_model_types}"
            )
        
        if n_trials < 50:
            raise ValueError(
                f"n_trials must be at least 50 (requirement 5.3). Got {n_trials}"
            )
        
        self.model_type = model_type
        self.n_trials = n_trials
        self.timeout = timeout
        self.n_jobs = n_jobs
        self.random_state = random_state
        
        # Study will be created during optimization
        self.study: Optional[optuna.Study] = None
        self.best_params: Optional[Dict[str, Any]] = None
        self.best_value: Optional[float] = None
        
        logger.info(
            f"Initialized OptunaOptimizer for {model_type} with {n_trials} trials"
        )
    
    def _get_search_space(self, trial: optuna.Trial) -> Dict[str, Any]:
        """
        Define hyperparameter search space for the model type.
        
        Args:
            trial: Optuna trial object
            
        Returns:
            Dictionary of hyperparameters sampled from the search space
        """
        if self.model_type == 'deepar':
            return {
                'context_length': trial.suggest_int('context_length', 10, 60),
                'prediction_length': trial.suggest_int('prediction_length', 1, 10),
                'num_layers': trial.suggest_int('num_layers', 1, 4),
                'num_cells': trial.suggest_int('num_cells', 20, 100),
                'dropout_rate': trial.suggest_float('dropout_rate', 0.0, 0.5),
                'learning_rate': trial.suggest_float('learning_rate', 1e-5, 1e-2, log=True),
                'epochs': trial.suggest_int('epochs', 50, 200),
                'mini_batch_size': trial.suggest_categorical('mini_batch_size', [32, 64, 128, 256])
            }
        
        elif self.model_type == 'lstm':
            return {
                'hidden_size': trial.suggest_int('hidden_size', 32, 256),
                'num_layers': trial.suggest_int('num_layers', 1, 4),
                'dropout': trial.suggest_float('dropout', 0.0, 0.5),
                'learning_rate': trial.suggest_float('learning_rate', 1e-5, 1e-2, log=True),
                'batch_size': trial.suggest_categorical('batch_size', [16, 32, 64, 128]),
                'sequence_length': trial.suggest_int('sequence_length', 10, 60),
                'weight_decay': trial.suggest_float('weight_decay', 1e-6, 1e-3, log=True)
            }
        
        elif self.model_type == 'prophet':
            return {
                'changepoint_prior_scale': trial.suggest_float('changepoint_prior_scale', 0.001, 0.5, log=True),
                'seasonality_prior_scale': trial.suggest_float('seasonality_prior_scale', 0.01, 10.0, log=True),
                'holidays_prior_scale': trial.suggest_float('holidays_prior_scale', 0.01, 10.0, log=True),
                'seasonality_mode': trial.suggest_categorical('seasonality_mode', ['additive', 'multiplicative']),
                'changepoint_range': trial.suggest_float('changepoint_range', 0.8, 0.95),
                'n_changepoints': trial.suggest_int('n_changepoints', 10, 50)
            }
        
        elif self.model_type == 'xgboost':
            return {
                'n_estimators': trial.suggest_int('n_estimators', 50, 500),
                'max_depth': trial.suggest_int('max_depth', 3, 10),
                'learning_rate': trial.suggest_float('learning_rate', 1e-3, 0.3, log=True),
                'subsample': trial.suggest_float('subsample', 0.5, 1.0),
                'colsample_bytree': trial.suggest_float('colsample_bytree', 0.5, 1.0),
                'min_child_weight': trial.suggest_int('min_child_weight', 1, 10),
                'gamma': trial.suggest_float('gamma', 0.0, 5.0),
                'reg_alpha': trial.suggest_float('reg_alpha', 1e-8, 1.0, log=True),
                'reg_lambda': trial.suggest_float('reg_lambda', 1e-8, 1.0, log=True)
            }
        
        else:
            raise ValueError(f"Unknown model_type: {self.model_type}")
    
    def objective(
        self,
        trial: optuna.Trial,
        objective_func: Callable[[Dict[str, Any]], float]
    ) -> float:
        """
        Objective function for Optuna optimization.
        
        Args:
            trial: Optuna trial object
            objective_func: Function that takes hyperparameters and returns metric to minimize
                          (e.g., MAPE from walk-forward validation)
            
        Returns:
            Metric value to minimize (e.g., MAPE)
        """
        # Sample hyperparameters from search space
        hyperparameters = self._get_search_space(trial)
        
        logger.info(f"Trial {trial.number}: Testing hyperparameters: {hyperparameters}")
        
        try:
            # Evaluate hyperparameters using the provided objective function
            # The objective function should perform walk-forward validation
            metric_value = objective_func(hyperparameters)
            
            logger.info(f"Trial {trial.number}: Metric value = {metric_value:.6f}")
            
            return metric_value
            
        except Exception as e:
            logger.error(f"Trial {trial.number} failed: {e}")
            # Return a large value to indicate failure
            return float('inf')
    
    def optimize(
        self,
        objective_func: Callable[[Dict[str, Any]], float],
        direction: str = 'minimize',
        study_name: Optional[str] = None,
        storage: Optional[str] = None,
        load_if_exists: bool = False
    ) -> Dict[str, Any]:
        """
        Run hyperparameter optimization.
        
        Args:
            objective_func: Function that takes hyperparameters and returns metric
                          Should perform walk-forward validation internally
            direction: 'minimize' or 'maximize' (default: 'minimize' for MAPE)
            study_name: Name for the Optuna study (optional)
            storage: Database URL for study persistence (optional)
            load_if_exists: Whether to load existing study if it exists
            
        Returns:
            Dictionary containing:
                - best_params: Best hyperparameters found
                - best_value: Best metric value achieved
                - n_trials: Number of trials completed
                - study: Optuna study object
                
        Raises:
            ValueError: If direction is invalid
        """
        if direction not in ['minimize', 'maximize']:
            raise ValueError(f"Invalid direction: {direction}. Must be 'minimize' or 'maximize'")
        
        # Create study name if not provided
        if study_name is None:
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            study_name = f"{self.model_type}_optimization_{timestamp}"
        
        logger.info(f"Starting optimization study: {study_name}")
        logger.info(f"Direction: {direction}, Trials: {self.n_trials}, Timeout: {self.timeout}s")
        
        # Create sampler and pruner
        sampler = TPESampler(seed=self.random_state)
        pruner = MedianPruner(n_startup_trials=10, n_warmup_steps=5)
        
        # Create study
        self.study = optuna.create_study(
            study_name=study_name,
            direction=direction,
            sampler=sampler,
            pruner=pruner,
            storage=storage,
            load_if_exists=load_if_exists
        )
        
        # Run optimization
        logger.info("Starting optimization trials...")
        
        try:
            self.study.optimize(
                lambda trial: self.objective(trial, objective_func),
                n_trials=self.n_trials,
                timeout=self.timeout,
                n_jobs=self.n_jobs,
                show_progress_bar=True
            )
        except KeyboardInterrupt:
            logger.warning("Optimization interrupted by user")
        except Exception as e:
            logger.error(f"Optimization failed: {e}")
            raise
        
        # Extract best results
        self.best_params = self.study.best_params
        self.best_value = self.study.best_value
        
        logger.info(f"Optimization completed!")
        logger.info(f"Best value: {self.best_value:.6f}")
        logger.info(f"Best parameters: {self.best_params}")
        logger.info(f"Number of finished trials: {len(self.study.trials)}")
        
        # Log trial statistics
        completed_trials = [t for t in self.study.trials if t.state == optuna.trial.TrialState.COMPLETE]
        pruned_trials = [t for t in self.study.trials if t.state == optuna.trial.TrialState.PRUNED]
        failed_trials = [t for t in self.study.trials if t.state == optuna.trial.TrialState.FAIL]
        
        logger.info(f"Completed trials: {len(completed_trials)}")
        logger.info(f"Pruned trials: {len(pruned_trials)}")
        logger.info(f"Failed trials: {len(failed_trials)}")
        
        return {
            'best_params': self.best_params,
            'best_value': self.best_value,
            'n_trials': len(self.study.trials),
            'n_completed': len(completed_trials),
            'n_pruned': len(pruned_trials),
            'n_failed': len(failed_trials),
            'study': self.study
        }
    
    def get_best_params(self) -> Dict[str, Any]:
        """
        Get the best hyperparameters found during optimization.
        
        Returns:
            Dictionary of best hyperparameters
            
        Raises:
            RuntimeError: If optimization has not been run yet
        """
        if self.best_params is None:
            raise RuntimeError("Optimization has not been run yet. Call optimize() first.")
        
        return self.best_params.copy()
    
    def get_optimization_history(self) -> pd.DataFrame:
        """
        Get the optimization history as a DataFrame.
        
        Returns:
            DataFrame with columns: trial_number, value, params, state, duration
            
        Raises:
            RuntimeError: If optimization has not been run yet
        """
        if self.study is None:
            raise RuntimeError("Optimization has not been run yet. Call optimize() first.")
        
        trials_data = []
        for trial in self.study.trials:
            trial_data = {
                'trial_number': trial.number,
                'value': trial.value,
                'state': trial.state.name,
                'duration_seconds': trial.duration.total_seconds() if trial.duration else None,
                **trial.params
            }
            trials_data.append(trial_data)
        
        return pd.DataFrame(trials_data)
    
    def get_param_importances(self) -> pd.DataFrame:
        """
        Get parameter importance scores.
        
        Returns:
            DataFrame with columns: param_name, importance
            
        Raises:
            RuntimeError: If optimization has not been run yet
        """
        if self.study is None:
            raise RuntimeError("Optimization has not been run yet. Call optimize() first.")
        
        try:
            importances = optuna.importance.get_param_importances(self.study)
            
            importance_df = pd.DataFrame([
                {'param_name': param, 'importance': importance}
                for param, importance in importances.items()
            ])
            
            importance_df = importance_df.sort_values('importance', ascending=False)
            importance_df = importance_df.reset_index(drop=True)
            
            return importance_df
            
        except Exception as e:
            logger.warning(f"Could not calculate parameter importances: {e}")
            return pd.DataFrame(columns=['param_name', 'importance'])
    
    def save_study(self, path: str) -> None:
        """
        Save Optuna study to disk.
        
        Args:
            path: File path to save study (should end with .pkl)
            
        Raises:
            RuntimeError: If optimization has not been run yet
        """
        if self.study is None:
            raise RuntimeError("No study to save. Run optimize() first.")
        
        import pickle
        
        study_data = {
            'study': self.study,
            'model_type': self.model_type,
            'best_params': self.best_params,
            'best_value': self.best_value,
            'n_trials': self.n_trials
        }
        
        try:
            with open(path, 'wb') as f:
                pickle.dump(study_data, f)
            logger.info(f"Study saved to {path}")
        except Exception as e:
            logger.error(f"Failed to save study: {e}")
            raise
    
    def load_study(self, path: str) -> None:
        """
        Load Optuna study from disk.
        
        Args:
            path: File path to load study from
            
        Raises:
            FileNotFoundError: If study file does not exist
        """
        import pickle
        
        try:
            with open(path, 'rb') as f:
                study_data = pickle.load(f)
            
            self.study = study_data['study']
            self.model_type = study_data['model_type']
            self.best_params = study_data['best_params']
            self.best_value = study_data['best_value']
            self.n_trials = study_data['n_trials']
            
            logger.info(f"Study loaded from {path}")
            logger.info(f"Model type: {self.model_type}")
            logger.info(f"Best value: {self.best_value}")
            
        except FileNotFoundError:
            logger.error(f"Study file not found: {path}")
            raise
        except Exception as e:
            logger.error(f"Failed to load study: {e}")
            raise


def create_walk_forward_objective(
    model_trainer: Callable[[pd.DataFrame, pd.DataFrame, Dict[str, Any]], float],
    train_data: pd.DataFrame,
    val_data: pd.DataFrame
) -> Callable[[Dict[str, Any]], float]:
    """
    Create an objective function that uses walk-forward validation.
    
    This is a helper function to create objective functions for the optimizer.
    The actual walk-forward validation logic should be implemented in the
    WalkForwardValidator class (Task 10.2).
    
    Args:
        model_trainer: Function that trains a model and returns validation metric
                      Signature: (train_data, val_data, hyperparameters) -> metric
        train_data: Training data
        val_data: Validation data
        
    Returns:
        Objective function that takes hyperparameters and returns metric
    """
    def objective_func(hyperparameters: Dict[str, Any]) -> float:
        """
        Objective function for optimization.
        
        Args:
            hyperparameters: Hyperparameters to evaluate
            
        Returns:
            Validation metric (e.g., MAPE)
        """
        try:
            # Train model with given hyperparameters and evaluate
            metric = model_trainer(train_data, val_data, hyperparameters)
            return metric
        except Exception as e:
            logger.error(f"Model training failed with hyperparameters {hyperparameters}: {e}")
            # Return a large value to indicate failure
            return float('inf')
    
    return objective_func
