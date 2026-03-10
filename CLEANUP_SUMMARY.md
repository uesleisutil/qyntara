# Cleanup Summary - B3 Tactical Ranking

## Completed Deletions

### Example Files (ml/examples/)
- ✅ hyperparameter_optimization_example.py
- ✅ walk_forward_with_optimization_example.py
- ✅ stock_ranking_example.py
- ✅ walk_forward_validation_example.py

### Obsolete Lambda Functions (ml/src/lambdas/)
- ✅ generate_sample_data.py (user said never use mock data)
- ✅ feature_engineering.py (features now generated in train_sagemaker.py)
- ✅ optimize_hyperparameters.py (not used in current ensemble approach)
- ✅ monitoring.py (replaced by monitor_model_performance.py and monitor_model_quality.py)

### Obsolete Model Files (ml/src/models/)
- ✅ deepar_model.py (superseded by train_ensemble.py)
- ✅ lstm_model.py (superseded by train_ensemble.py)
- ✅ prophet_model.py (superseded by train_ensemble.py)
- ✅ xgboost_model.py (superseded by train_ensemble.py)
- ✅ ensemble_manager.py (superseded by train_ensemble.py)
- ✅ hyperparameter_optimizer.py (not used)
- ✅ walk_forward_validator.py (validation now inside train_ensemble.py)

### Obsolete Test Files (ml/src/models/)
- ✅ test_deepar_model.py
- ✅ test_lstm_model.py
- ✅ test_prophet_model.py
- ✅ test_xgboost_model.py
- ✅ test_ensemble_manager.py
- ✅ test_hyperparameter_optimizer.py
- ✅ test_walk_forward_validator.py

### Obsolete SageMaker Scripts (ml/src/sagemaker/)
- ✅ inference.py (inference now in rank_sagemaker.py)
- ✅ hyperparameter_tuning.py (not used)

## Infrastructure Cleanup Needed (infra/lib/infra-stack.ts)

The following Lambda references need to be removed from infrastructure:

### Lambda Definitions to Remove:
1. `generateSampleDataFn` - Line ~387
2. `featureEngineeringFn` - Line ~403
3. `optimizeHyperparametersFn` - Line ~408
4. `trainModelsFn` - Line ~424
5. `ensemblePredictFn` - Line ~444
6. `monitoringFn` - Line ~451
7. `backtestingFn` - Line ~468
8. `portfolioOptimizerFn` - Line ~482

### EventBridge Rules to Remove:
1. `trainModelsRule` - Line ~643
2. `ensemblePredictRule` - Line ~648
3. `monitoringRule` - Line ~652
4. `backtestingRule` - Line ~662
5. `portfolioOptimizerRule` - Line ~668

### S3 Event Notifications to Remove:
1. Trigger for featureEngineeringFn - Line ~688
2. Trigger for trainModelsFn - Line ~695
3. Trigger for ensemblePredictFn - Line ~702
4. Trigger for monitoringFn - Line ~707

### CloudWatch Alarms to Remove:
1. `trainModelsErrorMetric` - Line ~752
2. `ensemblePredictErrorMetric` - Line ~766
3. `monitoringErrorMetric` - Line ~779
4. `backtestingErrorMetric` - Line ~796
5. `portfolioOptimizerErrorMetric` - Line ~810

### Dashboard Metrics to Remove:
1. Remove from invocations widget - Lines ~861-865
2. Remove from duration widget - Lines ~888-892

### CloudFormation Outputs to Remove:
1. `TrainModelsLambda` - Line ~932
2. `EnsemblePredictLambda` - Line ~936
3. `MonitoringLambda` - Line ~940
4. `BacktestingLambda` - Line ~944
5. `PortfolioOptimizerLambda` - Line ~948

## Current Production Architecture

### Active Lambda Functions:
1. **ingest_quotes.py** - Ingests stock quotes from BRAPI
2. **bootstrap_history_daily.py** - Loads historical data
3. **train_sagemaker.py** - Trains ensemble model in SageMaker
4. **rank_sagemaker.py** - Generates daily rankings using trained model
5. **monitor_costs.py** - Monitors AWS costs
6. **monitor_sagemaker.py** - Monitors SageMaker jobs
7. **monitor_model_performance.py** - Monitors model performance
8. **monitor_model_quality.py** - Monitors model quality
9. **monitor_ingestion.py** - Monitors data ingestion
10. **public_recommendations_api.py** - API for dashboard
11. **prepare_training_data.py** - Prepares training data
12. **analyze_sentiment.py** - Sentiment analysis (optional feature)
13. **calculate_stop_loss.py** - Stop loss calculation (optional feature)
14. **run_backtest.py** - Backtesting (optional feature)
15. **optimize_portfolio.py** - Portfolio optimization (optional feature)

### Core Training/Inference Flow:
1. **Data Ingestion**: ingest_quotes.py → S3
2. **Training**: train_sagemaker.py → SageMaker → model.tar.gz → S3
3. **Inference**: rank_sagemaker.py → loads model from S3 → generates rankings
4. **Monitoring**: monitor_* Lambdas track performance and costs

### Key Files:
- **ml/src/sagemaker/train_ensemble.py** - Main training script (XGBoost + LSTM + Prophet)
- **ml/src/lambdas/train_sagemaker.py** - Orchestrates SageMaker training
- **ml/src/lambdas/rank_sagemaker.py** - Does inference with trained model
- **ml/docker/Dockerfile** - Docker image with all dependencies

## Recommendations

1. **Keep optional features** (sentiment, stop_loss, backtest, portfolio) for now - they may be useful later
2. **Remove all obsolete Lambda definitions** from infrastructure
3. **Update __init__.py files** to remove imports of deleted modules
4. **Test deployment** after infrastructure cleanup
5. **Update documentation** to reflect current architecture

## Files That Should Stay

### Useful Modules (ml/src/):
- features/ - Feature engineering (used by train_sagemaker.py)
- backtesting/ - Backtesting logic (used by run_backtest.py)
- portfolio/ - Portfolio optimization (used by optimize_portfolio.py)
- risk_management/ - Risk management (used by calculate_stop_loss.py)
- sentiment/ - Sentiment analysis (used by analyze_sentiment.py)
- monitoring/ - Monitoring logic (used by monitor_* Lambdas)
- retraining/ - Retraining logic
- explainability/ - Model explainability
- augmentation/ - Data augmentation
- schemas/ - Data schemas
- utils/ - Utility functions

These modules provide functionality that may be used by optional features or future enhancements.
