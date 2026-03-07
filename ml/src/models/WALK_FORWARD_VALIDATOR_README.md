# Walk-Forward Validator

## Overview

The `WalkForwardValidator` provides time series validation functionality that simulates real production conditions by training on historical data and testing on future data, then rolling the window forward.

This implementation satisfies the following requirements:
- **Requirement 5.3**: Use walk-forward validation for objective function evaluation
- **Requirement 8.1**: Use 12-month training window
- **Requirement 8.2**: Use 1-month test window
- **Requirement 8.3**: Use 1-month step size (rolling forward)
- **Requirement 8.4**: Aggregate metrics across all validation folds
- **Requirement 8.5**: Report per-fold metrics for temporal performance analysis

## Key Features

- **Temporal Validation**: Respects time ordering to prevent data leakage
- **Configurable Windows**: Customizable train/test window sizes and step size
- **Multiple Metrics**: Calculates MAPE, MAE, RMSE, and optional coverage
- **Fold-by-Fold Analysis**: Provides detailed metrics for each validation fold
- **Aggregated Statistics**: Computes mean, std, min, max across all folds
- **Production Simulation**: Mimics real-world deployment conditions

## Installation

The walk-forward validator is part of the `ml.src.models` package:

```python
from ml.src.models.walk_forward_validator import WalkForwardValidator
```

## Basic Usage

### 1. Initialize Validator

```python
validator = WalkForwardValidator(
    train_window_months=12,  # 12-month training window (Requirement 8.1)
    test_window_months=1,    # 1-month test window (Requirement 8.2)
    step_months=1,           # 1-month step size (Requirement 8.3)
    date_column='date'       # Name of date column in data
)
```

### 2. Split Data into Folds

```python
# Data should have a date column and target column
folds = validator.split_data(data)

# Each fold is a tuple of (train_df, test_df)
for train_df, test_df in folds:
    print(f"Train: {len(train_df)} samples, Test: {len(test_df)} samples")
```

### 3. Run Validation

```python
def model_trainer(train_df, test_df):
    """
    Train model and generate predictions.
    
    Args:
        train_df: Training data
        test_df: Test data
        
    Returns:
        (trained_model, predictions) tuple
    """
    # Train your model
    model = YourModel()
    model.fit(train_df[features], train_df['target'])
    
    # Generate predictions
    predictions = model.predict(test_df[features])
    
    return model, predictions

# Run validation
fold_metrics = validator.validate(
    data=data,
    model_trainer=model_trainer,
    target_column='target'
)
```

### 4. Aggregate Metrics

```python
# Aggregate metrics across all folds (Requirement 8.4)
aggregated = validator.aggregate_metrics(fold_metrics)

print(f"Mean MAPE: {aggregated.mean_mape:.4f} ± {aggregated.std_mape:.4f}")
print(f"Mean MAE: {aggregated.mean_mae:.4f} ± {aggregated.std_mae:.4f}")
print(f"Mean RMSE: {aggregated.mean_rmse:.4f} ± {aggregated.std_rmse:.4f}")
```

## Advanced Usage

### With Prediction Intervals

```python
# Add prediction interval columns to your data
data['lower_bound'] = ...
data['upper_bound'] = ...

fold_metrics = validator.validate(
    data=data,
    model_trainer=model_trainer,
    target_column='target',
    calculate_coverage=True,
    lower_bound_column='lower_bound',
    upper_bound_column='upper_bound'
)

# Coverage will be included in metrics
aggregated = validator.aggregate_metrics(fold_metrics)
print(f"Mean Coverage: {aggregated.mean_coverage:.2f}%")
```

### With Hyperparameter Optimization

```python
from ml.src.models.hyperparameter_optimizer import OptunaOptimizer

def create_objective_func(data, validator):
    """Create objective function for Optuna."""
    def objective_func(hyperparameters):
        def model_trainer(train_df, test_df):
            # Train model with hyperparameters
            model = YourModel(**hyperparameters)
            model.fit(train_df[features], train_df['target'])
            predictions = model.predict(test_df[features])
            return model, predictions
        
        # Run walk-forward validation
        fold_metrics = validator.validate(
            data=data,
            model_trainer=model_trainer,
            target_column='target'
        )
        
        # Return mean MAPE to minimize
        aggregated = validator.aggregate_metrics(fold_metrics)
        return aggregated.mean_mape
    
    return objective_func

# Initialize optimizer
optimizer = OptunaOptimizer(
    model_type='xgboost',
    n_trials=50  # Requirement 5.1
)

# Run optimization with walk-forward validation
objective_func = create_objective_func(data, validator)
results = optimizer.optimize(objective_func, direction='minimize')

print(f"Best hyperparameters: {results['best_params']}")
print(f"Best MAPE: {results['best_value']:.4f}")
```

## Data Requirements

### Input Data Format

Your data must be a pandas DataFrame with:
- A date column (specified by `date_column` parameter)
- A target column (specified in `validate()` method)
- Feature columns (used by your model trainer)

Example:
```python
data = pd.DataFrame({
    'date': pd.date_range('2022-01-01', periods=730, freq='D'),
    'target': [...],  # Target values
    'feature_1': [...],
    'feature_2': [...],
    # ... more features
})
```

### Minimum Data Requirements

- Data must span at least `train_window_months + test_window_months`
- For default configuration (12-month train + 1-month test), need at least 13 months
- More data allows for more validation folds and better estimates

## Metrics

### Per-Fold Metrics (Requirement 8.5)

Each fold returns a `FoldMetrics` object with:
- `fold_number`: Fold index (1-based)
- `train_start`, `train_end`: Training period dates
- `test_start`, `test_end`: Test period dates
- `train_samples`, `test_samples`: Number of samples
- `mape`: Mean Absolute Percentage Error (%)
- `mae`: Mean Absolute Error
- `rmse`: Root Mean Squared Error
- `coverage`: Prediction interval coverage (optional)

### Aggregated Metrics (Requirement 8.4)

The `AggregatedMetrics` object provides:
- `mean_mape`, `std_mape`, `min_mape`, `max_mape`
- `mean_mae`, `std_mae`, `min_mae`, `max_mae`
- `mean_rmse`, `std_rmse`, `min_rmse`, `max_rmse`
- `mean_coverage`, `std_coverage`, `min_coverage`, `max_coverage` (if calculated)
- `n_folds`: Number of validation folds

## Examples

See the following example files:
- `ml/examples/walk_forward_validation_example.py`: Basic usage
- `ml/examples/walk_forward_with_optimization_example.py`: Integration with hyperparameter optimization

Run examples:
```bash
cd ml
python examples/walk_forward_validation_example.py
python examples/walk_forward_with_optimization_example.py
```

## Testing

Comprehensive unit tests are available in `ml/src/models/test_walk_forward_validator.py`:

```bash
pytest ml/src/models/test_walk_forward_validator.py -v
```

Test coverage includes:
- Initialization and configuration
- Data splitting with various window sizes
- Validation execution with different models
- Metrics calculation and aggregation
- Edge cases and error handling
- Integration workflows

## Design Decisions

### Why Walk-Forward Validation?

Traditional cross-validation (e.g., k-fold) randomly splits data, which can cause:
1. **Data Leakage**: Future data used to predict past
2. **Unrealistic Estimates**: Doesn't simulate production conditions
3. **Overfitting**: Models may learn patterns that don't generalize over time

Walk-forward validation addresses these issues by:
1. **Respecting Time Order**: Always train on past, test on future
2. **Simulating Production**: Mimics how models are deployed
3. **Temporal Generalization**: Ensures models work across different time periods

### Window Size Selection

Default configuration (12-month train, 1-month test, 1-month step):
- **12-month training**: Captures full year of seasonality
- **1-month test**: Reasonable forecast horizon for stock predictions
- **1-month step**: Provides multiple validation points while maintaining efficiency

These can be adjusted based on:
- Data availability
- Forecast horizon requirements
- Computational constraints
- Seasonality patterns

### Metric Aggregation

We report both per-fold and aggregated metrics because:
- **Per-fold**: Shows temporal performance variation (Requirement 8.5)
- **Aggregated**: Provides overall performance estimate (Requirement 8.4)
- **Standard deviation**: Indicates stability across time periods
- **Min/max**: Identifies best and worst case scenarios

## Performance Considerations

### Computational Cost

Walk-forward validation is computationally expensive because:
- Multiple models are trained (one per fold)
- Each fold uses substantial data
- Hyperparameter optimization multiplies this cost

Optimization strategies:
1. **Increase step size**: Fewer folds, faster validation
2. **Reduce window sizes**: Less data per fold
3. **Parallel processing**: Train folds in parallel (future enhancement)
4. **Early stopping**: Stop optimization if no improvement

### Memory Usage

Each fold loads train and test data into memory. For large datasets:
1. Use data generators instead of loading all data
2. Process folds sequentially to free memory
3. Consider downsampling for hyperparameter search

## Integration with Other Components

### Hyperparameter Optimizer

The walk-forward validator integrates seamlessly with `OptunaOptimizer`:
- Validator provides objective function for optimization
- Each trial evaluates hyperparameters using walk-forward validation
- Best hyperparameters generalize well across time periods

### Model Wrappers

Works with all model types:
- `DeepARModel`: AWS SageMaker DeepAR
- `LSTMModel`: PyTorch LSTM
- `ProphetModel`: Facebook Prophet
- `XGBoostModel`: XGBoost gradient boosting

### Ensemble Manager

Can be used to validate ensemble predictions:
- Train ensemble on each fold
- Evaluate combined predictions
- Optimize ensemble weights over time

## Troubleshooting

### "Insufficient data for walk-forward validation"

**Cause**: Data doesn't span enough months for the configured windows.

**Solution**: 
- Reduce `train_window_months` or `test_window_months`
- Collect more historical data
- Check for gaps in date column

### "Could not create any validation folds"

**Cause**: Data has gaps or insufficient samples in some periods.

**Solution**:
- Check for missing dates in data
- Ensure consistent sampling frequency
- Fill gaps with interpolation if appropriate

### "Predictions length does not match actuals length"

**Cause**: Model trainer returns wrong number of predictions.

**Solution**:
- Ensure predictions array has same length as test_df
- Check for filtering or dropping rows in model trainer
- Verify model generates one prediction per test sample

### High variance in fold metrics

**Cause**: Model performance varies significantly across time periods.

**Solution**:
- Investigate temporal patterns in data
- Check for regime changes or structural breaks
- Consider adaptive models or retraining strategies
- May indicate model is not robust to changing conditions

## Future Enhancements

Potential improvements:
1. **Parallel fold processing**: Train folds in parallel for speed
2. **Incremental training**: Reuse previous model as starting point
3. **Adaptive windows**: Adjust window sizes based on data characteristics
4. **Gap handling**: Better support for irregular time series
5. **Multi-step forecasting**: Validate multiple forecast horizons
6. **Confidence intervals**: Bootstrap confidence intervals for metrics

## References

- Requirement 5.3: Walk-forward validation for hyperparameter optimization
- Requirement 8.1-8.5: Walk-forward validation configuration and metrics
- Design Document: Section 4.2 "Walk-Forward Validator"
- Tasks: Task 10.2 "Create walk-forward validator"

## License

Part of the B3 Tactical Ranking model optimization project.
