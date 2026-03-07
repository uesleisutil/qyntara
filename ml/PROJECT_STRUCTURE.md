# ML Project Structure

## Directory Organization

```
ml/
├── src/
│   ├── features/              # Feature engineering modules
│   │   ├── __init__.py
│   │   ├── technical_indicators.py    # RSI, MACD, Bollinger Bands, etc.
│   │   ├── rolling_stats.py           # Rolling mean, std, min, max
│   │   ├── lag_features.py            # Lag and diff features
│   │   ├── volume_features.py         # Volume ratio, OBV, VWAP
│   │   └── normalizer.py              # Robust scaling
│   │
│   ├── models/                # Model implementations
│   │   ├── __init__.py
│   │   ├── base_model.py              # Abstract base class
│   │   ├── deepar_wrapper.py          # SageMaker DeepAR wrapper
│   │   ├── lstm_model.py              # PyTorch LSTM
│   │   ├── prophet_wrapper.py         # Prophet wrapper
│   │   ├── xgboost_wrapper.py         # XGBoost wrapper
│   │   └── ensemble_manager.py        # Ensemble orchestration
│   │
│   ├── optimization/          # Hyperparameter optimization
│   │   ├── __init__.py
│   │   ├── optuna_optimizer.py        # Bayesian optimization
│   │   └── walk_forward_validator.py  # Walk-forward validation
│   │
│   ├── monitoring/            # Performance monitoring
│   │   ├── __init__.py
│   │   ├── metrics_calculator.py      # MAPE, coverage, interval width
│   │   ├── drift_detector.py          # Performance and feature drift
│   │   ├── alert_manager.py           # SNS alerts
│   │   └── stock_ranker.py            # Stock ranking and stability
│   │
│   ├── schemas/               # Data schemas
│   │   ├── __init__.py
│   │   ├── feature_data.py            # Feature data schema
│   │   ├── prediction_data.py         # Prediction schema
│   │   ├── model_metadata.py          # Model metadata schema
│   │   └── performance_metrics.py     # Metrics schema
│   │
│   ├── utils/                 # Utility functions
│   │   ├── __init__.py
│   │   ├── s3_utils.py                # S3 read/write helpers
│   │   ├── data_validation.py         # Data validation
│   │   ├── missing_data_handler.py    # Missing data treatment
│   │   └── outlier_detector.py        # Outlier detection
│   │
│   └── lambdas/               # AWS Lambda functions
│       ├── feature_engineering.py     # Feature engineering Lambda
│       ├── model_training.py          # Model training Lambda
│       ├── hyperparameter_opt.py      # HPO Lambda
│       ├── ensemble_prediction.py     # Prediction Lambda
│       ├── performance_monitoring.py  # Monitoring Lambda
│       └── dashboard_api.py           # Dashboard API Lambda
│
├── tests/                     # Test files
│   ├── unit/                  # Unit tests
│   ├── properties/            # Property-based tests
│   └── integration/           # Integration tests
│
├── requirements.txt           # Python dependencies
├── setup_env.sh              # Environment setup script
└── PROJECT_STRUCTURE.md      # This file
```

## Module Responsibilities

### Features (`src/features/`)
Responsible for calculating all engineered features from raw market data:
- Technical indicators (RSI, MACD, Bollinger Bands, Stochastic, ATR)
- Rolling statistics (mean, std, min, max for 5/10/20/60 day windows)
- Lag features (1, 2, 3, 5, 10 days)
- Volume features (volume ratio, OBV, VWAP)
- Robust normalization using median and IQR

### Models (`src/models/`)
Implements the 4-model ensemble:
- **DeepAR**: AWS SageMaker wrapper for probabilistic forecasting
- **LSTM**: Custom PyTorch implementation for sequence modeling
- **Prophet**: Facebook's time series model wrapper
- **XGBoost**: Gradient boosting for tabular features
- **Ensemble Manager**: Orchestrates predictions, calculates weights, generates intervals

### Optimization (`src/optimization/`)
Handles hyperparameter tuning:
- Bayesian optimization using Optuna (50+ trials per model)
- Walk-forward validation (12-month train, 1-month test, 1-month step)
- Independent optimization for each model type
- Parameter persistence to S3

### Monitoring (`src/monitoring/`)
Tracks performance and detects issues:
- Metrics calculation (MAPE, MAE, RMSE, coverage, interval width)
- Performance drift detection (30-day rolling window, 20% threshold)
- Feature drift detection (KS test, p < 0.05)
- Stock ranking and stability analysis (Spearman correlation)
- SNS alert management

### Schemas (`src/schemas/`)
Defines data structures:
- **FeatureData**: 52+ features per stock per day
- **PredictionData**: Ensemble and individual predictions with intervals
- **ModelMetadata**: Model versioning and performance tracking
- **PerformanceMetrics**: Multi-level metrics (stock, sector, portfolio)

### Utils (`src/utils/`)
Common utilities:
- S3 read/write operations
- Data validation and completeness checks
- Missing data handling (forward fill, interpolation, exclusion)
- Outlier detection (Isolation Forest, z-score) and treatment

### Lambdas (`src/lambdas/`)
AWS Lambda entry points:
- **feature_engineering**: Daily feature calculation (2 AM)
- **model_training**: Monthly model retraining (1st of month)
- **hyperparameter_opt**: Monthly HPO (1st of month)
- **ensemble_prediction**: Daily predictions (6 AM)
- **performance_monitoring**: Daily metrics and drift detection (8 AM)
- **dashboard_api**: REST API for dashboard

## Data Flow

1. **Raw Data** → S3 raw bucket
2. **Feature Engineering** → S3 features bucket (52+ features)
3. **Model Training** → S3 models bucket (4 model artifacts)
4. **Hyperparameter Optimization** → S3 models bucket (best params)
5. **Ensemble Prediction** → S3 predictions bucket + explainability bucket
6. **Performance Monitoring** → S3 metrics bucket + SNS alerts
7. **Dashboard API** → Reads from metrics, predictions, explainability buckets

## Testing Strategy

### Unit Tests (`tests/unit/`)
- Test individual functions and classes
- Mock external dependencies (S3, SageMaker, SNS)
- Fast execution (< 1 second per test)

### Property-Based Tests (`tests/properties/`)
- Test universal properties across all inputs
- 44 properties covering all requirements
- Use hypothesis or similar framework

### Integration Tests (`tests/integration/`)
- Test complete workflows end-to-end
- Use LocalStack for AWS services
- Slower execution (minutes)

## Development Guidelines

1. **Code Style**: Follow PEP 8, use ruff for linting
2. **Type Hints**: Use type hints for all functions
3. **Docstrings**: Google-style docstrings for all public functions
4. **Error Handling**: Explicit error handling with logging
5. **Testing**: Write tests before implementation (TDD)
6. **Commits**: Atomic commits with descriptive messages

## Dependencies

See `requirements.txt` for full list. Key dependencies:
- **torch**: LSTM implementation
- **prophet**: Time series forecasting
- **xgboost**: Gradient boosting
- **optuna**: Hyperparameter optimization
- **shap**: Model explainability
- **boto3**: AWS SDK
- **sagemaker**: SageMaker SDK
- **pandas/numpy**: Data manipulation
- **scikit-learn**: Preprocessing and metrics

## Environment Variables

Lambda functions expect these environment variables:
- `RAW_DATA_BUCKET`: S3 bucket for raw data
- `FEATURES_BUCKET`: S3 bucket for features
- `MODELS_BUCKET`: S3 bucket for models
- `PREDICTIONS_BUCKET`: S3 bucket for predictions
- `METRICS_BUCKET`: S3 bucket for metrics
- `EXPLAINABILITY_BUCKET`: S3 bucket for SHAP values
- `SNS_DRIFT_TOPIC_ARN`: SNS topic for drift alerts
- `SNS_QUALITY_TOPIC_ARN`: SNS topic for quality alerts
- `SAGEMAKER_ROLE_ARN`: IAM role for SageMaker

## Next Steps

1. Implement feature engineering modules (Task 2)
2. Implement outlier detection (Task 3)
3. Implement missing data handler (Task 4)
4. Implement individual models (Tasks 6-9)
5. Implement hyperparameter optimization (Task 10)
6. Implement ensemble manager (Task 13)
7. Implement monitoring (Tasks 15-18)
8. Implement dashboard (Tasks 23-29)
