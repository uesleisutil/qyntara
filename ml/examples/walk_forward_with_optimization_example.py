"""
Walk-Forward Validation with Hyperparameter Optimization Example

This example demonstrates how to integrate WalkForwardValidator with
OptunaOptimizer for hyperparameter optimization using walk-forward validation
as the objective function.

This approach:
1. Uses walk-forward validation to evaluate each hyperparameter configuration
2. Finds optimal hyperparameters that generalize well across time
3. Provides realistic performance estimates for production deployment
"""

import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.ensemble import RandomForestRegressor
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.models.walk_forward_validator import WalkForwardValidator
from src.models.hyperparameter_optimizer import OptunaOptimizer


def create_sample_time_series():
    """
    Create sample time series data for demonstration.
    
    Returns:
        DataFrame with 24 months of daily stock price data
    """
    np.random.seed(42)
    
    # Create 24 months of daily data
    start_date = datetime(2022, 1, 1)
    dates = pd.date_range(start=start_date, periods=730, freq='D')
    
    # Generate synthetic price data with trend, seasonality, and noise
    trend = np.linspace(100, 120, len(dates))
    seasonality = 5 * np.sin(2 * np.pi * np.arange(len(dates)) / 365)
    noise = np.random.randn(len(dates)) * 2
    prices = trend + seasonality + noise
    
    # Create features
    df = pd.DataFrame({
        'date': dates,
        'price': prices,
        'target': prices,
        'lag_1': np.roll(prices, 1),
        'lag_5': np.roll(prices, 5),
        'lag_10': np.roll(prices, 10),
        'rolling_mean_5': pd.Series(prices).rolling(5).mean(),
        'rolling_std_5': pd.Series(prices).rolling(5).std(),
        'rolling_mean_20': pd.Series(prices).rolling(20).mean(),
        'rolling_std_20': pd.Series(prices).rolling(20).std(),
    })
    
    # Remove NaN rows
    df = df.dropna().reset_index(drop=True)
    
    return df


def create_walk_forward_objective(data, validator):
    """
    Create objective function that uses walk-forward validation.
    
    This function will be called by Optuna for each trial to evaluate
    a set of hyperparameters.
    
    Args:
        data: Time series data
        validator: WalkForwardValidator instance
        
    Returns:
        Objective function for Optuna
    """
    feature_cols = [
        'lag_1', 'lag_5', 'lag_10',
        'rolling_mean_5', 'rolling_std_5',
        'rolling_mean_20', 'rolling_std_20'
    ]
    
    def objective_func(hyperparameters):
        """
        Objective function that evaluates hyperparameters using walk-forward validation.
        
        Args:
            hyperparameters: Dictionary of hyperparameters to evaluate
            
        Returns:
            Mean MAPE across all validation folds (to be minimized)
        """
        def model_trainer(train_df, test_df):
            """Train model with given hyperparameters."""
            # Extract features and target
            X_train = train_df[feature_cols].values
            y_train = train_df['target'].values
            X_test = test_df[feature_cols].values
            
            # Create model with hyperparameters
            # Note: For this example, we use RandomForest instead of XGBoost
            # to avoid the need for XGBoost-specific hyperparameters
            model = RandomForestRegressor(
                n_estimators=int(hyperparameters.get('n_estimators', 100)),
                max_depth=int(hyperparameters.get('max_depth', 10)),
                min_samples_split=int(hyperparameters.get('min_samples_split', 2)),
                min_samples_leaf=int(hyperparameters.get('min_samples_leaf', 1)),
                random_state=42
            )
            
            # Train model
            model.fit(X_train, y_train)
            
            # Generate predictions
            predictions = model.predict(X_test)
            
            return model, predictions
        
        # Run walk-forward validation
        fold_metrics = validator.validate(
            data=data,
            model_trainer=model_trainer,
            target_column='target'
        )
        
        # Aggregate metrics
        aggregated = validator.aggregate_metrics(fold_metrics)
        
        # Return mean MAPE (to be minimized)
        return aggregated.mean_mape
    
    return objective_func


def main():
    """Run walk-forward validation with hyperparameter optimization example."""
    print("=" * 80)
    print("Walk-Forward Validation with Hyperparameter Optimization Example")
    print("=" * 80)
    print()
    
    # Create sample data
    print("Creating sample time series data...")
    data = create_sample_time_series()
    print(f"Data shape: {data.shape}")
    print(f"Date range: {data['date'].min()} to {data['date'].max()}")
    print()
    
    # Initialize walk-forward validator
    print("Initializing WalkForwardValidator...")
    validator = WalkForwardValidator(
        train_window_months=12,
        test_window_months=1,
        step_months=2,  # Use 2-month step for faster optimization
        date_column='date'
    )
    print(f"Configuration: {validator.train_window_months}-month train, "
          f"{validator.test_window_months}-month test, "
          f"{validator.step_months}-month step")
    print()
    
    # Create objective function
    print("Creating walk-forward objective function...")
    objective_func = create_walk_forward_objective(data, validator)
    print()
    
    # Note: For demonstration, we'll use a simple custom optimizer instead of
    # the full OptunaOptimizer to avoid the complexity of defining search spaces
    # for RandomForest. In production, you would use OptunaOptimizer with
    # proper search space definitions.
    
    print("Running hyperparameter optimization...")
    print("(Testing 3 different configurations)")
    print()
    
    # Test a few hyperparameter configurations
    configs = [
        {'n_estimators': 50, 'max_depth': 5, 'min_samples_split': 2, 'min_samples_leaf': 1},
        {'n_estimators': 100, 'max_depth': 10, 'min_samples_split': 5, 'min_samples_leaf': 2},
        {'n_estimators': 150, 'max_depth': 15, 'min_samples_split': 10, 'min_samples_leaf': 4},
    ]
    
    results = []
    for i, config in enumerate(configs, 1):
        print(f"Configuration {i}: {config}")
        mape = objective_func(config)
        results.append((config, mape))
        print(f"  → Mean MAPE: {mape:.4f}%")
        print()
    
    # Find best configuration
    best_config, best_mape = min(results, key=lambda x: x[1])
    
    print("=" * 80)
    print("Optimization Results:")
    print("-" * 80)
    print(f"Best configuration: {best_config}")
    print(f"Best mean MAPE: {best_mape:.4f}%")
    print()
    
    # Interpretation
    print("Interpretation:")
    print("-" * 80)
    print("The walk-forward validation objective function evaluates each")
    print("hyperparameter configuration across multiple time periods, ensuring")
    print("that the selected hyperparameters generalize well over time.")
    print()
    print("This approach is crucial for time series models because:")
    print("1. It respects temporal ordering (no data leakage)")
    print("2. It simulates production conditions (train on past, test on future)")
    print("3. It provides realistic performance estimates")
    print("4. It helps avoid overfitting to specific time periods")
    print()
    
    if best_mape < 7.0:
        print(f"✓ Best MAPE ({best_mape:.2f}%) is below 7% target (Requirement 1.1)")
    else:
        print(f"✗ Best MAPE ({best_mape:.2f}%) is above 7% target")
    
    print()
    print("In production, you would use OptunaOptimizer with 50+ trials to")
    print("thoroughly explore the hyperparameter space (Requirement 5.1).")
    print()
    print("=" * 80)


if __name__ == '__main__':
    main()
