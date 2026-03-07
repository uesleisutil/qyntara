"""
Example: Hyperparameter Optimization with Optuna

This example demonstrates how to use the OptunaOptimizer to optimize
hyperparameters for different model types using walk-forward validation.

Requirements: 5.1, 5.3
"""

import logging

import numpy as np
import pandas as pd

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from models.hyperparameter_optimizer import OptunaOptimizer, create_walk_forward_objective

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def example_lstm_optimization():
    """
    Example: Optimize LSTM hyperparameters.
    
    This example shows how to:
    1. Create synthetic training/validation data
    2. Define a model trainer function
    3. Create an objective function with walk-forward validation
    4. Run optimization with Optuna
    5. Retrieve and save best hyperparameters
    """
    logger.info("=" * 80)
    logger.info("LSTM Hyperparameter Optimization Example")
    logger.info("=" * 80)
    
    # 1. Create synthetic data
    np.random.seed(42)
    n_samples = 1000
    
    train_data = pd.DataFrame({
        'feature1': np.random.randn(n_samples),
        'feature2': np.random.randn(n_samples),
        'feature3': np.random.randn(n_samples),
        'target': np.random.randn(n_samples)
    })
    
    val_data = pd.DataFrame({
        'feature1': np.random.randn(200),
        'feature2': np.random.randn(200),
        'feature3': np.random.randn(200),
        'target': np.random.randn(200)
    })
    
    logger.info(f"Training data: {len(train_data)} samples")
    logger.info(f"Validation data: {len(val_data)} samples")
    
    # 2. Define model trainer function
    # In practice, this would train an actual LSTM model
    # For this example, we simulate MAPE calculation
    def lstm_trainer(train, val, hyperparameters):
        """
        Train LSTM model and return validation MAPE.
        
        In a real implementation, this would:
        - Create LSTM model with hyperparameters
        - Train on train_data
        - Evaluate on val_data
        - Return MAPE metric
        """
        # Simulate MAPE based on hyperparameters
        # Better hyperparameters = lower MAPE
        base_mape = 0.08
        
        # Hidden size effect (optimal around 128)
        hidden_size = hyperparameters.get('hidden_size', 128)
        hidden_size_penalty = abs(hidden_size - 128) / 1000
        
        # Learning rate effect (optimal around 0.001)
        learning_rate = hyperparameters.get('learning_rate', 0.001)
        lr_penalty = abs(np.log10(learning_rate) + 3) * 0.01
        
        # Dropout effect (optimal around 0.2)
        dropout = hyperparameters.get('dropout', 0.2)
        dropout_penalty = abs(dropout - 0.2) * 0.05
        
        # Add some random noise
        noise = np.random.uniform(-0.005, 0.005)
        
        mape = base_mape + hidden_size_penalty + lr_penalty + dropout_penalty + noise
        
        return max(0.01, mape)  # Ensure positive MAPE
    
    # 3. Create objective function
    objective_func = create_walk_forward_objective(
        model_trainer=lstm_trainer,
        train_data=train_data,
        val_data=val_data
    )
    
    # 4. Create optimizer and run optimization
    optimizer = OptunaOptimizer(
        model_type='lstm',
        n_trials=50,  # Minimum required by specification
        n_jobs=1,  # Use 1 for reproducibility, -1 for parallel
        random_state=42
    )
    
    logger.info("\nStarting optimization...")
    result = optimizer.optimize(
        objective_func=objective_func,
        direction='minimize',  # Minimize MAPE
        study_name='lstm_optimization_example'
    )
    
    # 5. Display results
    logger.info("\n" + "=" * 80)
    logger.info("Optimization Results")
    logger.info("=" * 80)
    logger.info(f"Best MAPE: {result['best_value']:.6f}")
    logger.info(f"Trials completed: {result['n_completed']}")
    logger.info(f"Trials pruned: {result['n_pruned']}")
    logger.info(f"Trials failed: {result['n_failed']}")
    
    logger.info("\nBest Hyperparameters:")
    for param, value in result['best_params'].items():
        logger.info(f"  {param}: {value}")
    
    # Get optimization history
    history = optimizer.get_optimization_history()
    logger.info(f"\nOptimization history shape: {history.shape}")
    logger.info(f"Best trial number: {history.loc[history['value'].idxmin(), 'trial_number']}")
    
    # Get parameter importances
    importances = optimizer.get_param_importances()
    if len(importances) > 0:
        logger.info("\nParameter Importances:")
        for _, row in importances.head(5).iterrows():
            logger.info(f"  {row['param_name']}: {row['importance']:.4f}")
    
    # Save study for later analysis
    optimizer.save_study('lstm_optimization_study.pkl')
    logger.info("\nStudy saved to: lstm_optimization_study.pkl")
    
    return optimizer


def example_xgboost_optimization():
    """
    Example: Optimize XGBoost hyperparameters.
    
    Similar to LSTM example but for XGBoost model.
    """
    logger.info("\n" + "=" * 80)
    logger.info("XGBoost Hyperparameter Optimization Example")
    logger.info("=" * 80)
    
    # Create synthetic data
    np.random.seed(42)
    n_samples = 1000
    
    train_data = pd.DataFrame({
        'feature1': np.random.randn(n_samples),
        'feature2': np.random.randn(n_samples),
        'feature3': np.random.randn(n_samples),
        'feature4': np.random.randn(n_samples),
        'feature5': np.random.randn(n_samples),
        'target': np.random.randn(n_samples)
    })
    
    val_data = pd.DataFrame({
        'feature1': np.random.randn(200),
        'feature2': np.random.randn(200),
        'feature3': np.random.randn(200),
        'feature4': np.random.randn(200),
        'feature5': np.random.randn(200),
        'target': np.random.randn(200)
    })
    
    # Define trainer
    def xgboost_trainer(train, val, hyperparameters):
        """Simulate XGBoost training and return MAPE."""
        base_mape = 0.07
        
        # Learning rate effect
        learning_rate = hyperparameters.get('learning_rate', 0.1)
        lr_penalty = abs(np.log10(learning_rate) + 1) * 0.01
        
        # Max depth effect (optimal around 6)
        max_depth = hyperparameters.get('max_depth', 6)
        depth_penalty = abs(max_depth - 6) * 0.005
        
        # Add noise
        noise = np.random.uniform(-0.005, 0.005)
        
        mape = base_mape + lr_penalty + depth_penalty + noise
        return max(0.01, mape)
    
    # Create objective
    objective_func = create_walk_forward_objective(
        model_trainer=xgboost_trainer,
        train_data=train_data,
        val_data=val_data
    )
    
    # Create optimizer
    optimizer = OptunaOptimizer(
        model_type='xgboost',
        n_trials=50,
        random_state=42
    )
    
    # Run optimization
    result = optimizer.optimize(
        objective_func=objective_func,
        direction='minimize'
    )
    
    # Display results
    logger.info(f"\nBest MAPE: {result['best_value']:.6f}")
    logger.info("Best Hyperparameters:")
    for param, value in result['best_params'].items():
        logger.info(f"  {param}: {value}")
    
    return optimizer


def example_prophet_optimization():
    """
    Example: Optimize Prophet hyperparameters.
    
    Prophet has different hyperparameters focused on seasonality and changepoints.
    """
    logger.info("\n" + "=" * 80)
    logger.info("Prophet Hyperparameter Optimization Example")
    logger.info("=" * 80)
    
    # Create time series data
    np.random.seed(42)
    dates = pd.date_range('2020-01-01', periods=365, freq='D')
    
    train_data = pd.DataFrame({
        'ds': dates,
        'y': np.random.randn(365).cumsum() + 100
    })
    
    val_dates = pd.date_range('2021-01-01', periods=90, freq='D')
    val_data = pd.DataFrame({
        'ds': val_dates,
        'y': np.random.randn(90).cumsum() + 100
    })
    
    # Define trainer
    def prophet_trainer(train, val, hyperparameters):
        """Simulate Prophet training and return MAPE."""
        base_mape = 0.09
        
        # Changepoint prior scale effect
        cp_scale = hyperparameters.get('changepoint_prior_scale', 0.05)
        cp_penalty = abs(np.log10(cp_scale) + 1.3) * 0.01
        
        # Seasonality mode effect
        seasonality_mode = hyperparameters.get('seasonality_mode', 'additive')
        mode_penalty = 0.005 if seasonality_mode == 'multiplicative' else 0.0
        
        # Add noise
        noise = np.random.uniform(-0.005, 0.005)
        
        mape = base_mape + cp_penalty + mode_penalty + noise
        return max(0.01, mape)
    
    # Create objective
    objective_func = create_walk_forward_objective(
        model_trainer=prophet_trainer,
        train_data=train_data,
        val_data=val_data
    )
    
    # Create optimizer
    optimizer = OptunaOptimizer(
        model_type='prophet',
        n_trials=50,
        random_state=42
    )
    
    # Run optimization
    result = optimizer.optimize(
        objective_func=objective_func,
        direction='minimize'
    )
    
    # Display results
    logger.info(f"\nBest MAPE: {result['best_value']:.6f}")
    logger.info("Best Hyperparameters:")
    for param, value in result['best_params'].items():
        logger.info(f"  {param}: {value}")
    
    return optimizer


def main():
    """Run all optimization examples."""
    logger.info("Hyperparameter Optimization Examples")
    logger.info("=" * 80)
    logger.info("This example demonstrates Optuna-based hyperparameter optimization")
    logger.info("for different model types (LSTM, XGBoost, Prophet).")
    logger.info("=" * 80)
    
    # Run LSTM optimization
    lstm_optimizer = example_lstm_optimization()
    
    # Run XGBoost optimization
    xgboost_optimizer = example_xgboost_optimization()
    
    # Run Prophet optimization
    prophet_optimizer = example_prophet_optimization()
    
    logger.info("\n" + "=" * 80)
    logger.info("All optimization examples completed successfully!")
    logger.info("=" * 80)
    
    # Summary
    logger.info("\nSummary:")
    logger.info(f"LSTM best MAPE: {lstm_optimizer.best_value:.6f}")
    logger.info(f"XGBoost best MAPE: {xgboost_optimizer.best_value:.6f}")
    logger.info(f"Prophet best MAPE: {prophet_optimizer.best_value:.6f}")


if __name__ == '__main__':
    main()
