# Model Implementations

This directory contains model wrapper implementations for the ensemble forecasting system.

## DeepAR Model

The `DeepARModel` class provides a wrapper for AWS SageMaker's DeepAR forecasting algorithm.

### Features

- **Training**: Train models via SageMaker with customizable hyperparameters
- **Prediction**: Generate point forecasts using deployed endpoints
- **Prediction Intervals**: Generate quantile-based prediction intervals for uncertainty estimation
- **S3 Integration**: Automatic data preparation and upload to S3
- **Error Handling**: Comprehensive error handling and logging

### Usage Example

```python
from ml.src.models import DeepARModel
import pandas as pd

# Initialize model
model = DeepARModel(region_name='sa-east-1')

# Prepare training data
train_data = pd.DataFrame({
    'stock_symbol': ['PETR4', 'PETR4', 'VALE3', 'VALE3'],
    'date': ['2023-01-01', '2023-01-02', '2023-01-01', '2023-01-02'],
    'target': [30.5, 31.0, 45.0, 45.5],
    'feature1': [0.1, 0.2, 0.3, 0.4],
    'feature2': [0.5, 0.6, 0.7, 0.8]
})

# Train model
job_name = model.train(
    train_data=train_data,
    hyperparameters={
        'epochs': '100',
        'learning_rate': '0.001',
        'context_length': '30',
        'prediction_length': '5'
    },
    role_arn='arn:aws:iam::123456789012:role/SageMakerRole',
    s3_output_path='s3://my-bucket/models/'
)

# Wait for training to complete
result = model.wait_for_training_job(job_name)

# Make predictions (after deploying endpoint)
predictions = model.predict(
    input_data=train_data,
    model_endpoint='my-deepar-endpoint',
    num_samples=100
)

# Get prediction intervals
intervals = model.get_prediction_intervals(
    input_data=train_data,
    model_endpoint='my-deepar-endpoint',
    quantiles=[0.1, 0.5, 0.9]
)
```

### Hyperparameters

Default hyperparameters:
- `time_freq`: "D" (daily frequency)
- `epochs`: "100"
- `early_stopping_patience`: "10"
- `mini_batch_size`: "128"
- `learning_rate`: "0.001"
- `context_length`: "30" (number of time points the model looks at before making predictions)
- `prediction_length`: "5" (number of time points to predict)
- `num_cells`: "40" (number of LSTM cells)
- `num_layers`: "2" (number of LSTM layers)
- `likelihood`: "gaussian"
- `dropout_rate`: "0.1"

### Data Format

Training data must include:
- `stock_symbol`: Stock identifier
- `date`: Date of observation
- `target`: Target value to predict
- Additional feature columns (optional)

### Testing

Run tests with:
```bash
python -m pytest ml/src/models/test_deepar_model.py -v
```

All 20 unit tests cover:
- Model initialization
- Training job creation
- Data preparation and S3 upload
- Prediction generation
- Prediction interval generation
- Error handling

### Requirements

Validates Requirement 4.1: Implement ensemble of 4 models (DeepAR, LSTM, Prophet, XGBoost)

### Next Steps

1. Implement LSTM model wrapper (Task 7)
2. Implement Prophet model wrapper (Task 8)
3. Implement XGBoost model wrapper (Task 9)
4. Create ensemble manager to combine all models (Task 13)
