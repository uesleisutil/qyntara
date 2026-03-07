"""
Walk-Forward Validation Example

This example demonstrates how to use the WalkForwardValidator for time series
model evaluation with proper temporal validation.

The walk-forward validator:
1. Splits data into train/test folds with 12-month train, 1-month test, 1-month step
2. Trains model on each training window
3. Evaluates on corresponding test window
4. Aggregates metrics across all folds

This simulates real production conditions where models are trained on historical
data and tested on future data.
"""

import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.linear_model import LinearRegression
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.models.walk_forward_validator import WalkForwardValidator


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
        'target': prices,  # Target is current price
        'lag_1': np.roll(prices, 1),
        'lag_5': np.roll(prices, 5),
        'lag_10': np.roll(prices, 10),
        'rolling_mean_5': pd.Series(prices).rolling(5).mean(),
        'rolling_std_5': pd.Series(prices).rolling(5).std(),
        'rolling_mean_20': pd.Series(prices).rolling(20).mean(),
        'rolling_std_20': pd.Series(prices).rolling(20).std(),
    })
    
    # Remove NaN rows from rolling calculations
    df = df.dropna().reset_index(drop=True)
    
    return df


def create_model_trainer():
    """
    Create a model trainer function for walk-forward validation.
    
    The trainer function should:
    1. Take train_df and test_df as inputs
    2. Train a model on train_df
    3. Generate predictions on test_df
    4. Return (trained_model, predictions) tuple
    
    Returns:
        Model trainer function
    """
    def trainer(train_df, test_df):
        """
        Train linear regression model and generate predictions.
        
        Args:
            train_df: Training data
            test_df: Test data
            
        Returns:
            (model, predictions) tuple
        """
        # Define feature columns
        feature_cols = [
            'lag_1', 'lag_5', 'lag_10',
            'rolling_mean_5', 'rolling_std_5',
            'rolling_mean_20', 'rolling_std_20'
        ]
        
        # Extract features and target
        X_train = train_df[feature_cols].values
        y_train = train_df['target'].values
        X_test = test_df[feature_cols].values
        
        # Train model
        model = LinearRegression()
        model.fit(X_train, y_train)
        
        # Generate predictions
        predictions = model.predict(X_test)
        
        return model, predictions
    
    return trainer


def main():
    """Run walk-forward validation example."""
    print("=" * 80)
    print("Walk-Forward Validation Example")
    print("=" * 80)
    print()
    
    # Create sample data
    print("Creating sample time series data...")
    data = create_sample_time_series()
    print(f"Data shape: {data.shape}")
    print(f"Date range: {data['date'].min()} to {data['date'].max()}")
    print()
    
    # Initialize validator with default configuration
    # - 12-month training window (Requirement 8.1)
    # - 1-month test window (Requirement 8.2)
    # - 1-month step size (Requirement 8.3)
    print("Initializing WalkForwardValidator...")
    validator = WalkForwardValidator(
        train_window_months=12,
        test_window_months=1,
        step_months=1,
        date_column='date'
    )
    print(f"Configuration: {validator.train_window_months}-month train, "
          f"{validator.test_window_months}-month test, "
          f"{validator.step_months}-month step")
    print()
    
    # Split data into folds
    print("Splitting data into train/test folds...")
    folds = validator.split_data(data)
    print(f"Created {len(folds)} validation folds")
    print()
    
    # Display fold information
    print("Fold Information:")
    print("-" * 80)
    for i, (train_df, test_df) in enumerate(folds[:3], 1):  # Show first 3 folds
        print(f"Fold {i}:")
        print(f"  Train: {train_df['date'].min().date()} to {train_df['date'].max().date()} "
              f"({len(train_df)} samples)")
        print(f"  Test:  {test_df['date'].min().date()} to {test_df['date'].max().date()} "
              f"({len(test_df)} samples)")
    if len(folds) > 3:
        print(f"  ... and {len(folds) - 3} more folds")
    print()
    
    # Create model trainer
    print("Creating model trainer...")
    model_trainer = create_model_trainer()
    print()
    
    # Run validation
    print("Running walk-forward validation...")
    print("(This may take a moment as we train and evaluate on each fold)")
    print()
    
    fold_metrics = validator.validate(
        data=data,
        model_trainer=model_trainer,
        target_column='target'
    )
    
    print(f"Validation completed! Evaluated {len(fold_metrics)} folds")
    print()
    
    # Display per-fold metrics
    print("Per-Fold Metrics:")
    print("-" * 80)
    print(f"{'Fold':<6} {'Train Period':<30} {'Test Period':<30} {'MAPE':<8} {'MAE':<8} {'RMSE':<8}")
    print("-" * 80)
    
    for fm in fold_metrics[:5]:  # Show first 5 folds
        train_period = f"{fm.train_start.date()} to {fm.train_end.date()}"
        test_period = f"{fm.test_start.date()} to {fm.test_end.date()}"
        print(f"{fm.fold_number:<6} {train_period:<30} {test_period:<30} "
              f"{fm.mape:<8.2f} {fm.mae:<8.2f} {fm.rmse:<8.2f}")
    
    if len(fold_metrics) > 5:
        print(f"  ... and {len(fold_metrics) - 5} more folds")
    print()
    
    # Aggregate metrics
    print("Aggregating metrics across all folds...")
    aggregated = validator.aggregate_metrics(fold_metrics)
    print()
    
    # Display aggregated metrics
    print("Aggregated Metrics (Requirement 8.4):")
    print("-" * 80)
    print(f"Number of folds: {aggregated.n_folds}")
    print()
    print(f"MAPE:  {aggregated.mean_mape:.4f} ± {aggregated.std_mape:.4f} "
          f"(min: {aggregated.min_mape:.4f}, max: {aggregated.max_mape:.4f})")
    print(f"MAE:   {aggregated.mean_mae:.4f} ± {aggregated.std_mae:.4f} "
          f"(min: {aggregated.min_mae:.4f}, max: {aggregated.max_mae:.4f})")
    print(f"RMSE:  {aggregated.mean_rmse:.4f} ± {aggregated.std_rmse:.4f} "
          f"(min: {aggregated.min_rmse:.4f}, max: {aggregated.max_rmse:.4f})")
    print()
    
    # Interpretation
    print("Interpretation:")
    print("-" * 80)
    if aggregated.mean_mape < 7.0:
        print(f"✓ Mean MAPE ({aggregated.mean_mape:.2f}%) is below 7% target (Requirement 1.1)")
    else:
        print(f"✗ Mean MAPE ({aggregated.mean_mape:.2f}%) is above 7% target")
    
    print()
    print("Walk-forward validation provides a realistic estimate of model performance")
    print("by simulating production conditions where models are trained on historical")
    print("data and tested on future data.")
    print()
    print("=" * 80)


if __name__ == '__main__':
    main()
