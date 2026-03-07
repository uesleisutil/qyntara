# Model Optimization System - B3 Tactical Ranking

## Overview

This system implements an advanced ensemble forecasting solution for B3 stock predictions, combining 4 models (DeepAR, LSTM, Prophet, XGBoost) with sophisticated feature engineering, hyperparameter optimization, and continuous monitoring.

**Goal**: Reduce MAPE from 10.5% to below 7% while maintaining coverage above 90%.

## Architecture

### Components

1. **Feature Engineering Pipeline** (`ml/src/features/`)
   - Technical indicators (RSI, MACD, Bollinger Bands, etc.)
   - Rolling statistics (5, 10, 20, 60 day windows)
   - Lag features (1, 2, 3, 5, 10 days)
   - Volume features (volume ratio, OBV, VWAP)
   - Robust normalization

2. **Model Ensemble** (`ml/src/models/`)
   - DeepAR (AWS SageMaker)
   - LSTM (PyTorch)
   - Prophet (Facebook)
   - XGBoost
   - Dynamic weight calculation
   - Prediction interval generation

3. **Hyperparameter Optimization** (`ml/src/optimization/`)
   - Bayesian optimization with Optuna
   - Walk-forward validation
   - Independent optimization per model
   - 50+ trials per model

4. **Performance Monitoring** (`ml/src/monitoring/`)
   - Daily MAPE, coverage, interval width tracking
   - Performance drift detection (20% threshold)
   - Feature drift detection (KS test, p < 0.05)
   - Stock ranking and stability analysis

5. **Dashboard** (`dashboard/`)
   - Real-time metrics visualization
   - Model comparison and insights
   - Feature importance analysis
   - Drift monitoring
   - Prediction explainability (SHAP)

## Directory Structure

```
.
├── ml/
│   ├── src/
│   │   ├── features/          # Feature engineering modules
│   │   ├── models/            # Model implementations
│   │   ├── optimization/      # Hyperparameter optimization
│   │   ├── monitoring/        # Performance monitoring
│   │   ├── schemas/           # Data schemas
│   │   ├── utils/             # Utility functions
│   │   └── lambdas/           # AWS Lambda functions
│   ├── requirements.txt       # Python dependencies
│   └── setup_env.sh          # Environment setup script
│
├── dashboard/
│   ├── src/
│   │   ├── components/
│   │   │   ├── charts/       # Chart components
│   │   │   ├── panels/       # Panel components
│   │   │   ├── filters/      # Filter components
│   │   │   └── shared/       # Shared components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── store/            # Zustand state management
│   │   ├── services/         # API services
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # Utility functions
│   ├── package.json          # npm dependencies
│   └── setup_dashboard.sh    # Dashboard setup script
│
└── infra/
    ├── lib/                  # CDK infrastructure code
    └── AWS_RESOURCES.md      # AWS resources documentation
```

## Setup Instructions

### Prerequisites

- Python 3.9+
- Node.js 18+
- AWS CLI configured
- AWS CDK installed

### 1. Setup ML Environment

```bash
cd ml
chmod +x setup_env.sh
./setup_env.sh
source ../.venv/bin/activate
```

### 2. Setup Dashboard

```bash
cd dashboard
chmod +x setup_dashboard.sh
./setup_dashboard.sh
```

### 3. Deploy Infrastructure

```bash
cd infra
npm install
cdk deploy
```

## Key Features

### Feature Engineering (52+ features)

- **Technical Indicators**: RSI, MACD, Bollinger Bands, Stochastic Oscillator, ATR
- **Rolling Statistics**: Mean, std, min, max for 5/10/20/60 day windows
- **Lag Features**: 1, 2, 3, 5, 10 day lags
- **Volatility**: EWMA volatility
- **Volume**: Volume ratio, OBV, VWAP
- **Normalization**: Robust scaling (median + IQR)

### Model Ensemble

- **DeepAR**: AWS SageMaker probabilistic forecasting
- **LSTM**: Custom PyTorch implementation
- **Prophet**: Facebook's time series model
- **XGBoost**: Gradient boosting for tabular data
- **Dynamic Weights**: Adjusted monthly based on 3-month rolling performance
- **Prediction Intervals**: 95% confidence intervals via quantile regression

### Hyperparameter Optimization

- **Method**: Bayesian optimization (Optuna)
- **Trials**: 50+ per model
- **Validation**: Walk-forward with 12-month train, 1-month test
- **Frequency**: Monthly or when MAPE degrades > 15%
- **Timeout**: 24 hours per model

### Monitoring & Drift Detection

- **Performance Drift**: 30-day rolling MAPE vs baseline (20% threshold)
- **Feature Drift**: KS test on all features (p < 0.05)
- **Alerts**: SNS notifications for drift events
- **Auto-Retraining**: Triggered on drift detection
- **Stock Ranking**: Daily ranking by MAPE with stability tracking

### Dashboard Features

- **Performance Metrics**: MAPE, coverage, interval width over time
- **Model Comparison**: Radar charts comparing all 4 models
- **Feature Importance**: SHAP values for top 20 features
- **Drift Monitoring**: Heatmaps showing feature drift over time
- **Prediction Intervals**: Fan charts with 50%, 80%, 95% confidence
- **Ensemble Weights**: Stacked area charts showing weight evolution
- **Stock Ranking**: Bump charts showing ranking changes
- **Explainability**: SHAP waterfall charts for individual predictions

## Data Schemas

### FeatureData
52+ engineered features per stock per day including price, technical indicators, rolling stats, lags, volatility, and volume features.

### PredictionData
Ensemble and individual model predictions with confidence intervals and weights.

### ModelMetadata
Model versioning, hyperparameters, training info, and performance metrics.

### PerformanceMetrics
MAPE, coverage, interval width at stock, sector, and portfolio levels.

## AWS Resources

### S3 Buckets
- Raw data
- Engineered features
- Model artifacts
- Predictions
- Performance metrics
- SHAP values

### Lambda Functions
- Feature engineering (daily)
- Model training (monthly)
- Hyperparameter optimization (monthly)
- Ensemble prediction (daily)
- Performance monitoring (daily)
- Dashboard API

### EventBridge Rules
- Daily feature engineering (2 AM)
- Daily prediction (6 AM)
- Daily monitoring (8 AM)
- Monthly retraining (1st of month)
- Monthly HPO (1st of month)

### SNS Topics
- Drift alerts
- Model quality alerts
- Retraining notifications

## Development Workflow

### 1. Feature Engineering
```bash
# Develop features locally
cd ml/src/features
python -m pytest tests/

# Deploy to Lambda
cd ../../../infra
cdk deploy FeatureEngineeringStack
```

### 2. Model Development
```bash
# Train models locally
cd ml/src/models
python train_lstm.py --data-path /path/to/features

# Deploy to production
cdk deploy ModelTrainingStack
```

### 3. Dashboard Development
```bash
# Start dev server
cd dashboard
npm start

# Build and deploy
npm run build
npm run deploy
```

## Testing

### Unit Tests
```bash
# Python tests
cd ml
pytest tests/

# JavaScript tests
cd dashboard
npm test
```

### Property-Based Tests
```bash
# Run property tests
cd ml
pytest tests/properties/ -v
```

### Integration Tests
```bash
# Test complete pipeline
cd ml
python tests/integration/test_pipeline.py
```

## Monitoring

### CloudWatch Dashboards
- Lambda execution metrics
- SageMaker training metrics
- API Gateway metrics
- Custom business metrics (MAPE, coverage)

### Alarms
- Lambda errors > 5 in 5 minutes
- MAPE > 7%
- Coverage < 90%
- Drift detected

## Performance Targets

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| MAPE | 10.5% | < 7% | 🔴 In Progress |
| Coverage | 94.1% | > 90% | ✅ Met |
| Top 30% MAPE | - | < 5% | 🔴 In Progress |
| Interval Width | - | < 15% | 🔴 In Progress |

## Troubleshooting

### Common Issues

1. **Lambda Timeout**: Increase memory or timeout in CDK stack
2. **SageMaker Training Failure**: Check CloudWatch logs, verify data format
3. **Feature Drift Alerts**: Review feature distributions, may need retraining
4. **Dashboard Not Loading**: Check CORS configuration, API Gateway logs

### Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/feature-engineering --follow

# View SageMaker logs
aws logs tail /aws/sagemaker/TrainingJobs --follow
```

## Cost Optimization

- Use Spot instances for SageMaker training
- Implement S3 lifecycle policies (Glacier after 90 days)
- Use Lambda reserved concurrency for predictable workloads
- Enable S3 Intelligent-Tiering

## Security

- All S3 buckets encrypted (SSE-S3)
- IAM roles follow least privilege
- API Gateway with API keys
- CloudTrail enabled for audit
- Secrets in AWS Secrets Manager

## Contributing

1. Create feature branch
2. Implement changes with tests
3. Run linting: `ruff check ml/`
4. Submit PR with description

## License

See LICENSE file.

## Support

For issues or questions, contact the ML team or create an issue in the repository.
