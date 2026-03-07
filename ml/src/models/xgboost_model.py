"""
XGBoost Model Wrapper for Time Series Forecasting

This module provides a wrapper for XGBoost gradient boosting model,
supporting time series features, early stopping, and feature importance analysis.

Requirements: 4.1 - Implement ensemble of 4 models (DeepAR, LSTM, Prophet, XGBoost)
"""

import json
import logging
import pickle
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import xgboost as xgb

logger = logging.getLogger(__name__)


class XGBoostModel:
    """
    Wrapper class for XGBoost model for time series forecasting.
    
    Provides methods for:
    - Training with configurable hyperparameters and early stopping
    - Making predictions on structured data
    - Feature importance analysis
    - Model persistence (save/load)
    
    XGBoost expects structured data with features as columns.
    For time series, features typically include:
    - Lagged values
    - Rolling statistics
    - Technical indicators
    - Time-based features (day of week, month, etc.)
    """
    
    def __init__(self):
        """Initialize XGBoost model wrapper."""
        self.model: Optional[xgb.Booster] = None
        self.feature_names: List[str] = []
        self.hyperparameters: Dict = {}
        self.training_metadata: Dict = {}
        self.best_iteration: int = 0
        
    def train(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: Optional[pd.DataFrame] = None,
        y_val: Optional[pd.Series] = None,
        hyperparameters: Optional[Dict] = None,
        early_stopping_rounds: int = 10,
        verbose: bool = True
    ) -> Dict:
        """
        Train XGBoost model with specified hyperparameters.
        
        Args:
            X_train: Training features DataFrame
            y_train: Training target Series
            X_val: Validation features DataFrame (optional, for early stopping)
            y_val: Validation target Series (optional, for early stopping)
            hyperparameters: Model hyperparameters including:
                - objective: 'reg:squarederror', 'reg:squaredlogerror', etc. (default: 'reg:squarederror')
                - max_depth: Maximum tree depth (default: 6)
                - learning_rate: Step size shrinkage (default: 0.1)
                - n_estimators: Number of boosting rounds (default: 100)
                - subsample: Subsample ratio of training instances (default: 0.8)
                - colsample_bytree: Subsample ratio of columns (default: 0.8)
                - min_child_weight: Minimum sum of instance weight in child (default: 1)
                - gamma: Minimum loss reduction for split (default: 0)
                - reg_alpha: L1 regularization (default: 0)
                - reg_lambda: L2 regularization (default: 1)
                - random_state: Random seed (default: 42)
            early_stopping_rounds: Stop if validation metric doesn't improve for N rounds
            verbose: Whether to print training progress
            
        Returns:
            Dictionary with training metadata including:
                - training_samples: Number of training samples
                - validation_samples: Number of validation samples
                - feature_names: List of feature names
                - hyperparameters: Hyperparameters used
                - best_iteration: Best iteration (if early stopping used)
                - training_time: Training time in seconds
                
        Raises:
            ValueError: If training data is invalid
        """
        # Validate inputs
        if X_train.empty or y_train.empty:
            raise ValueError("Training data cannot be empty")
        
        if len(X_train) != len(y_train):
            raise ValueError(
                f"X_train and y_train must have same length. "
                f"Got X_train: {len(X_train)}, y_train: {len(y_train)}"
            )
        
        # Check for validation data consistency
        if (X_val is not None) != (y_val is not None):
            raise ValueError("Both X_val and y_val must be provided together or both None")
        
        if X_val is not None and len(X_val) != len(y_val):
            raise ValueError(
                f"X_val and y_val must have same length. "
                f"Got X_val: {len(X_val)}, y_val: {len(y_val)}"
            )
        
        # Store feature names
        self.feature_names = list(X_train.columns)
        
        # Set default hyperparameters
        default_hyperparameters = {
            'objective': 'reg:squarederror',
            'max_depth': 6,
            'learning_rate': 0.1,
            'n_estimators': 100,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'min_child_weight': 1,
            'gamma': 0,
            'reg_alpha': 0,
            'reg_lambda': 1,
            'random_state': 42,
            'tree_method': 'auto',
            'eval_metric': 'rmse'
        }
        
        # Merge with provided hyperparameters
        if hyperparameters is None:
            hyperparameters = {}
        final_hyperparameters = {**default_hyperparameters, **hyperparameters}
        self.hyperparameters = final_hyperparameters
        
        # Extract n_estimators separately (not a booster param)
        n_estimators = final_hyperparameters.pop('n_estimators')
        
        # Log training configuration
        logger.info("Training XGBoost model with hyperparameters:")
        for key, value in final_hyperparameters.items():
            logger.info(f"  {key}: {value}")
        logger.info(f"  n_estimators: {n_estimators}")
        
        # Create DMatrix for training
        dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=self.feature_names)
        
        # Setup evaluation list
        evals = [(dtrain, 'train')]
        if X_val is not None:
            dval = xgb.DMatrix(X_val, label=y_val, feature_names=self.feature_names)
            evals.append((dval, 'validation'))
        
        # Setup callbacks
        callbacks = []
        if verbose:
            # Print evaluation results every 10 rounds
            callbacks.append(xgb.callback.EvaluationMonitor(period=10))
        
        # Train the model
        logger.info(f"Training XGBoost model on {len(X_train)} samples...")
        start_time = datetime.now()
        
        try:
            evals_result = {}
            self.model = xgb.train(
                params=final_hyperparameters,
                dtrain=dtrain,
                num_boost_round=n_estimators,
                evals=evals,
                early_stopping_rounds=early_stopping_rounds if X_val is not None else None,
                evals_result=evals_result,
                callbacks=callbacks,
                verbose_eval=False  # We handle verbosity with callbacks
            )
            
            training_time = (datetime.now() - start_time).total_seconds()
            
            # Get best iteration
            self.best_iteration = self.model.best_iteration if hasattr(self.model, 'best_iteration') else n_estimators
            
            logger.info(f"XGBoost model training completed successfully in {training_time:.2f}s")
            logger.info(f"Best iteration: {self.best_iteration}")
            
            # Get final metrics
            final_train_metric = evals_result['train'][final_hyperparameters['eval_metric']][-1]
            logger.info(f"Final training {final_hyperparameters['eval_metric']}: {final_train_metric:.6f}")
            
            if X_val is not None:
                final_val_metric = evals_result['validation'][final_hyperparameters['eval_metric']][-1]
                logger.info(f"Final validation {final_hyperparameters['eval_metric']}: {final_val_metric:.6f}")
            
        except Exception as e:
            logger.error(f"XGBoost model training failed: {e}")
            raise
        
        # Store training metadata
        self.training_metadata = {
            'training_samples': len(X_train),
            'validation_samples': len(X_val) if X_val is not None else 0,
            'feature_names': self.feature_names,
            'num_features': len(self.feature_names),
            'hyperparameters': {**final_hyperparameters, 'n_estimators': n_estimators},
            'best_iteration': self.best_iteration,
            'training_time_seconds': training_time,
            'training_date': datetime.now().isoformat(),
            'early_stopping_used': X_val is not None
        }
        
        return self.training_metadata
    
    def predict(
        self,
        X_test: pd.DataFrame,
        iteration_range: Optional[Tuple[int, int]] = None
    ) -> np.ndarray:
        """
        Generate predictions for input data.
        
        Args:
            X_test: Test features DataFrame
            iteration_range: Tuple of (start, end) iterations to use for prediction
                           If None, uses best_iteration from training
            
        Returns:
            Array of predictions with shape (num_samples,)
            
        Raises:
            RuntimeError: If model has not been trained
            ValueError: If feature names don't match training data
        """
        if self.model is None:
            raise RuntimeError("Model must be trained before making predictions")
        
        if X_test.empty:
            raise ValueError("Test data cannot be empty")
        
        # Validate feature names (check sets, not order)
        test_features = set(X_test.columns)
        training_features = set(self.feature_names)
        
        missing_features = training_features - test_features
        extra_features = test_features - training_features
        
        if missing_features or extra_features:
            error_msg = "Feature mismatch between training and test data."
            if missing_features:
                error_msg += f" Missing features: {missing_features}."
            if extra_features:
                error_msg += f" Extra features: {extra_features}."
            
            raise ValueError(error_msg)
        
        # Ensure column order matches training
        X_test = X_test[self.feature_names]
        
        # Create DMatrix
        dtest = xgb.DMatrix(X_test, feature_names=self.feature_names)
        
        # Generate predictions
        logger.info(f"Generating predictions for {len(X_test)} samples...")
        
        try:
            if iteration_range is not None:
                predictions = self.model.predict(
                    dtest,
                    iteration_range=iteration_range
                )
            else:
                # Use best iteration if available
                if self.best_iteration > 0:
                    predictions = self.model.predict(
                        dtest,
                        iteration_range=(0, self.best_iteration)
                    )
                else:
                    predictions = self.model.predict(dtest)
            
            logger.info(f"Generated {len(predictions)} predictions")
            return predictions
            
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            raise
    
    def get_feature_importance(
        self,
        importance_type: str = 'gain'
    ) -> pd.DataFrame:
        """
        Get feature importance scores.
        
        Args:
            importance_type: Type of importance to calculate:
                - 'weight': Number of times feature is used in splits
                - 'gain': Average gain of splits using the feature
                - 'cover': Average coverage of splits using the feature
                - 'total_gain': Total gain of splits using the feature
                - 'total_cover': Total coverage of splits using the feature
            
        Returns:
            DataFrame with columns ['feature', 'importance'] sorted by importance
            
        Raises:
            RuntimeError: If model has not been trained
            ValueError: If importance_type is invalid
        """
        if self.model is None:
            raise RuntimeError("Model must be trained before getting feature importance")
        
        valid_types = ['weight', 'gain', 'cover', 'total_gain', 'total_cover']
        if importance_type not in valid_types:
            raise ValueError(
                f"Invalid importance_type: {importance_type}. "
                f"Must be one of {valid_types}"
            )
        
        # Get importance scores
        importance_dict = self.model.get_score(importance_type=importance_type)
        
        # Convert to DataFrame
        importance_df = pd.DataFrame([
            {'feature': feature, 'importance': score}
            for feature, score in importance_dict.items()
        ])
        
        # Sort by importance
        importance_df = importance_df.sort_values('importance', ascending=False)
        importance_df = importance_df.reset_index(drop=True)
        
        # Add rank
        importance_df['rank'] = range(1, len(importance_df) + 1)
        
        # Calculate percentage
        total_importance = importance_df['importance'].sum()
        if total_importance > 0:
            importance_df['percentage'] = (
                importance_df['importance'] / total_importance * 100
            ).round(2)
        else:
            importance_df['percentage'] = 0.0
        
        logger.info(f"Feature importance calculated using '{importance_type}' method")
        logger.info(f"Top 5 features: {importance_df.head()['feature'].tolist()}")
        
        return importance_df[['rank', 'feature', 'importance', 'percentage']]
    
    def save_model(self, path: str) -> None:
        """
        Save XGBoost model to disk.
        
        Args:
            path: File path to save model (should end with .json or .pkl)
            
        Raises:
            RuntimeError: If model has not been trained
        """
        if self.model is None:
            raise RuntimeError("Cannot save model that has not been trained")
        
        # Determine format based on file extension
        if path.endswith('.json'):
            # Save as JSON (XGBoost native format)
            self.model.save_model(path)
            
            # Save metadata separately
            metadata_path = path.replace('.json', '_metadata.json')
            with open(metadata_path, 'w') as f:
                json.dump({
                    'feature_names': self.feature_names,
                    'hyperparameters': self.hyperparameters,
                    'training_metadata': self.training_metadata,
                    'best_iteration': self.best_iteration
                }, f, indent=2)
            
            logger.info(f"Model saved to {path}")
            logger.info(f"Metadata saved to {metadata_path}")
            
        else:
            # Save as pickle (includes everything)
            checkpoint = {
                'model': self.model,
                'feature_names': self.feature_names,
                'hyperparameters': self.hyperparameters,
                'training_metadata': self.training_metadata,
                'best_iteration': self.best_iteration
            }
            
            try:
                with open(path, 'wb') as f:
                    pickle.dump(checkpoint, f)
                logger.info(f"Model saved to {path}")
            except Exception as e:
                logger.error(f"Failed to save model: {e}")
                raise
    
    def load_model(self, path: str) -> None:
        """
        Load XGBoost model from disk.
        
        Args:
            path: File path to load model from
            
        Raises:
            FileNotFoundError: If model file does not exist
        """
        try:
            if path.endswith('.json'):
                # Load XGBoost model
                self.model = xgb.Booster()
                self.model.load_model(path)
                
                # Load metadata
                metadata_path = path.replace('.json', '_metadata.json')
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                
                self.feature_names = metadata.get('feature_names', [])
                self.hyperparameters = metadata.get('hyperparameters', {})
                self.training_metadata = metadata.get('training_metadata', {})
                self.best_iteration = metadata.get('best_iteration', 0)
                
                logger.info(f"Model loaded from {path}")
                logger.info(f"Metadata loaded from {metadata_path}")
                
            else:
                # Load from pickle
                with open(path, 'rb') as f:
                    checkpoint = pickle.load(f)
                
                self.model = checkpoint['model']
                self.feature_names = checkpoint.get('feature_names', [])
                self.hyperparameters = checkpoint.get('hyperparameters', {})
                self.training_metadata = checkpoint.get('training_metadata', {})
                self.best_iteration = checkpoint.get('best_iteration', 0)
                
                logger.info(f"Model loaded from {path}")
            
            logger.info(f"Training metadata: {self.training_metadata}")
            
        except FileNotFoundError:
            logger.error(f"Model file not found: {path}")
            raise
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    def get_model_dump(
        self,
        dump_format: str = 'text',
        with_stats: bool = False
    ) -> List[str]:
        """
        Get a text dump of the model trees.
        
        Args:
            dump_format: Format of the dump ('text' or 'json')
            with_stats: Whether to include statistics
            
        Returns:
            List of strings, one per tree
            
        Raises:
            RuntimeError: If model has not been trained
        """
        if self.model is None:
            raise RuntimeError("Model must be trained before dumping")
        
        return self.model.get_dump(dump_format=dump_format, with_stats=with_stats)
    
    def predict_with_contributions(
        self,
        X_test: pd.DataFrame
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generate predictions along with feature contributions (SHAP values).
        
        Args:
            X_test: Test features DataFrame
            
        Returns:
            Tuple of (predictions, contributions)
            - predictions: Array of predictions with shape (num_samples,)
            - contributions: Array of SHAP values with shape (num_samples, num_features + 1)
                           Last column is the bias term
            
        Raises:
            RuntimeError: If model has not been trained
        """
        if self.model is None:
            raise RuntimeError("Model must be trained before making predictions")
        
        if X_test.empty:
            raise ValueError("Test data cannot be empty")
        
        # Ensure column order matches training
        X_test = X_test[self.feature_names]
        
        # Create DMatrix
        dtest = xgb.DMatrix(X_test, feature_names=self.feature_names)
        
        # Generate predictions
        predictions = self.model.predict(dtest)
        
        # Get SHAP contributions
        contributions = self.model.predict(dtest, pred_contribs=True)
        
        logger.info(f"Generated predictions with contributions for {len(X_test)} samples")
        
        return predictions, contributions
