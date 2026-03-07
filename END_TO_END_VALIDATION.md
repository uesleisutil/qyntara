# Model Optimization Pipeline - End-to-End Validation Guide

This guide provides comprehensive validation procedures for the Model Optimization Pipeline to ensure it meets all requirements.

## Validation Objectives

1. ✅ Verify complete pipeline execution with real B3 data
2. ✅ Validate MAPE < 7% requirement
3. ✅ Validate coverage > 90% requirement
4. ✅ Verify dashboard displays correctly
5. ✅ Confirm all integrations work properly

## Prerequisites

- Deployed infrastructure (see MODEL_OPTIMIZATION_DEPLOYMENT.md)
- Real B3 market data available in S3
- All Lambda functions deployed and configured
- SNS subscriptions confirmed
- CloudWatch dashboard accessible

## Validation Steps

### Step 1: Data Preparation

#### 1.1 Upload Historical Data

```bash
# Set variables
BUCKET_NAME="your-bucket-name"
START_DATE="2023-01-01"
END_DATE="2024-01-01"

# Upload raw market data for test stocks
aws s3 cp data/raw/PETR4.csv s3://$BUCKET_NAME/raw/PETR4.csv
aws s3 cp data/raw/VALE3.csv s3://$BUCKET_NAME/raw/VALE3.csv
aws s3 cp data/raw/ITUB4.csv s3://$BUCKET_NAME/raw/ITUB4.csv

# Verify upload
aws s3 ls s3://$BUCKET_NAME/raw/
```

**Expected Result:**
- Files uploaded successfully
- S3 event triggers feature engineering Lambda

#### 1.2 Verify Data Quality

```bash
# Download and inspect data
aws s3 cp s3://$BUCKET_NAME/raw/PETR4.csv /tmp/PETR4.csv

# Check data format
head -10 /tmp/PETR4.csv

# Verify columns: date, open, high, low, close, volume
# Verify date range covers at least 12 months
# Verify no missing values in critical columns
```

**Expected Result:**
- Data has required columns
- Date range is sufficient (≥ 12 months)
- Missing values < 20% per stock

### Step 2: Feature Engineering Validation

#### 2.1 Trigger Feature Engineering

```bash
# Invoke Lambda manually
aws lambda invoke \
    --function-name FeatureEngineering \
    --payload '{
        "stock_symbols": ["PETR4", "VALE3", "ITUB4"],
        "start_date": "'$START_DATE'",
        "end_date": "'$END_DATE'",
        "input_bucket": "'$BUCKET_NAME'",
        "input_prefix": "raw/",
        "output_bucket": "'$BUCKET_NAME'",
        "output_prefix": "features/"
    }' \
    /tmp/feature-result.json

# Check result
cat /tmp/feature-result.json | jq '.'
```

**Expected Result:**
```json
{
  "status": "success",
  "features_s3_path": "s3://bucket/features/2024-01-01/",
  "num_stocks": 3,
  "num_features": 52,
  "processing_time_seconds": 45.2
}
```

#### 2.2 Validate Features

```bash
# Download features
aws s3 cp s3://$BUCKET_NAME/features/2024-01-01/features.csv /tmp/features.csv

# Check feature count
head -1 /tmp/features.csv | tr ',' '\n' | wc -l

# Verify feature categories
head -1 /tmp/features.csv | tr ',' '\n' | grep -E '(rsi|macd|bb_|stoch|atr|rolling_|lag_|volume_)'
```

**Expected Result:**
- 52+ features generated
- All feature categories present:
  - Technical indicators (RSI, MACD, Bollinger Bands, Stochastic, ATR)
  - Rolling statistics (mean, std, min, max for windows 5, 10, 20, 60)
  - Lag features (lags 1, 2, 3, 5, 10)
  - Volume features (volume ratio, OBV, VWAP)
- Features normalized (values between -3 and 3)

### Step 3: Hyperparameter Optimization Validation

#### 3.1 Trigger Optimization

```bash
# Invoke optimization Lambda
aws lambda invoke \
    --function-name OptimizeHyperparameters \
    --payload '{
        "model_type": "lstm",
        "training_data_s3_path": "s3://'$BUCKET_NAME'/features/2024-01-01/features.csv",
        "output_bucket": "'$BUCKET_NAME'",
        "n_trials": 10,
        "timeout_hours": 1
    }' \
    /tmp/optimize-result.json

# Check result
cat /tmp/optimize-result.json | jq '.'
```

**Expected Result:**
```json
{
  "status": "success",
  "results": [
    {
      "model_type": "lstm",
      "best_params": {
        "hidden_size": 128,
        "num_layers": 2,
        "dropout": 0.2,
        "learning_rate": 0.001
      },
      "best_mape": 7.2,
      "n_trials_completed": 10,
      "optimization_time_hours": 0.8
    }
  ]
}
```

#### 3.2 Validate Hyperparameters

```bash
# Download best parameters
aws s3 cp s3://$BUCKET_NAME/hyperparameters/lstm/best_params.json /tmp/lstm_params.json

# Verify parameters
cat /tmp/lstm_params.json | jq '.best_params'
```

**Expected Result:**
- Parameters saved to S3
- Parameters within reasonable ranges
- MAPE from optimization < 10%

### Step 4: Model Training Validation

#### 4.1 Trigger Training

```bash
# Invoke training Lambda
aws lambda invoke \
    --function-name TrainModels \
    --payload '{
        "features_s3_path": "s3://'$BUCKET_NAME'/features/2024-01-01/features.csv",
        "output_bucket": "'$BUCKET_NAME'",
        "models_to_train": ["lstm", "prophet", "xgboost"],
        "target_column": "target",
        "parallel": false
    }' \
    /tmp/train-result.json

# Check result
cat /tmp/train-result.json | jq '.'
```

**Expected Result:**
```json
{
  "status": "success",
  "models_trained": 3,
  "model_artifacts": {
    "lstm": "s3://bucket/models/lstm/v1/",
    "prophet": "s3://bucket/models/prophet/v1/",
    "xgboost": "s3://bucket/models/xgboost/v1/"
  },
  "validation_metrics": {
    "lstm": {"mape": 7.8, "coverage": 92.1},
    "prophet": {"mape": 9.1, "coverage": 90.3},
    "xgboost": {"mape": 7.5, "coverage": 89.8}
  }
}
```

#### 4.2 Validate Models

```bash
# Check model artifacts
aws s3 ls s3://$BUCKET_NAME/models/ --recursive

# Download and inspect model metadata
aws s3 cp s3://$BUCKET_NAME/models/lstm/v1/metrics.json /tmp/lstm_metrics.json
cat /tmp/lstm_metrics.json | jq '.'
```

**Expected Result:**
- Model artifacts saved to S3
- Validation metrics calculated
- Individual model MAPE < 10%

### Step 5: Ensemble Prediction Validation

#### 5.1 Trigger Prediction

```bash
# Invoke prediction Lambda
aws lambda invoke \
    --function-name EnsemblePredict \
    --payload '{
        "features_bucket": "'$BUCKET_NAME'",
        "features_key": "features/2024-01-01/features.parquet",
        "model_bucket": "'$BUCKET_NAME'",
        "model_versions": {
            "lstm": "v1",
            "prophet": "v1",
            "xgboost": "v1"
        },
        "output_bucket": "'$BUCKET_NAME'",
        "stock_symbols": ["PETR4", "VALE3", "ITUB4"],
        "prediction_date": "2024-01-01"
    }' \
    /tmp/predict-result.json

# Check result
cat /tmp/predict-result.json | jq '.'
```

**Expected Result:**
```json
{
  "statusCode": 200,
  "body": {
    "status": "success",
    "output_path": "s3://bucket/predictions/2024-01-01/ensemble_predictions.json",
    "num_predictions": 3,
    "weights": {
      "lstm": 0.35,
      "prophet": 0.25,
      "xgboost": 0.40
    }
  }
}
```

#### 5.2 Validate Predictions

```bash
# Download predictions
aws s3 cp s3://$BUCKET_NAME/predictions/2024-01-01/ensemble_predictions.json /tmp/predictions.json

# Inspect predictions
cat /tmp/predictions.json | jq '.predictions'
```

**Expected Result:**
- Predictions generated for all stocks
- Ensemble weights sum to 1.0
- Prediction intervals (lower_bound < prediction < upper_bound)
- Individual model predictions included

### Step 6: Monitoring Validation

#### 6.1 Trigger Monitoring

```bash
# First, upload actual values for comparison
aws s3 cp data/actuals/2024-01-01.csv s3://$BUCKET_NAME/actuals/2024-01-01/actuals.csv

# Invoke monitoring Lambda
aws lambda invoke \
    --function-name Monitoring \
    --payload '{
        "prediction_date": "2024-01-01",
        "predictions_bucket": "'$BUCKET_NAME'",
        "actuals_bucket": "'$BUCKET_NAME'",
        "features_bucket": "'$BUCKET_NAME'",
        "metrics_bucket": "'$BUCKET_NAME'",
        "reference_date": "2023-12-01"
    }' \
    /tmp/monitor-result.json

# Check result
cat /tmp/monitor-result.json | jq '.'
```

**Expected Result:**
```json
{
  "statusCode": 200,
  "body": {
    "status": "success",
    "output_path": "s3://bucket/metrics/daily/2024-01-01.json",
    "metrics": {
      "overall_mape": 6.5,
      "overall_coverage": 91.2,
      "num_stocks": 3
    },
    "drift_detected": {
      "performance_drift": false,
      "feature_drift": false
    },
    "alerts_sent": {
      "performance_drift": false,
      "feature_drift": false,
      "retraining_triggered": false
    }
  }
}
```

#### 6.2 Validate Metrics

```bash
# Download metrics
aws s3 cp s3://$BUCKET_NAME/metrics/daily/2024-01-01.json /tmp/metrics.json

# Check MAPE
cat /tmp/metrics.json | jq '.overall_mape'

# Check coverage
cat /tmp/metrics.json | jq '.overall_coverage'

# Check per-stock metrics
cat /tmp/metrics.json | jq '.per_stock_metrics'
```

**Expected Result:**
- **MAPE < 7%** ✅ (Requirement 1.1)
- **Coverage > 90%** ✅ (Requirement 2.1)
- Per-stock metrics calculated
- Top performers identified

### Step 7: Dashboard Validation

#### 7.1 Access Dashboard

```bash
# Get dashboard URL
DASHBOARD_URL=$(aws cloudformation describe-stacks \
    --stack-name B3TacticalRankingStackV2 \
    --query "Stacks[0].Outputs[?OutputKey=='DashboardUrl'].OutputValue" \
    --output text)

echo "Dashboard URL: $DASHBOARD_URL"

# Open in browser
open $DASHBOARD_URL  # macOS
xdg-open $DASHBOARD_URL  # Linux
```

#### 7.2 Verify Dashboard Components

**Check the following panels:**

1. **Model Performance Panel**
   - [ ] MAPE time series chart displays
   - [ ] Model comparison radar chart displays
   - [ ] Metric cards show current values
   - [ ] Stock selector works
   - [ ] Date range picker works

2. **Ensemble Insights Panel**
   - [ ] Current weights displayed
   - [ ] Ensemble weights chart displays
   - [ ] Model contributions pie chart displays
   - [ ] Prediction breakdown table displays

3. **Feature Analysis Panel**
   - [ ] Feature importance chart displays
   - [ ] Top 20 features shown
   - [ ] Feature distributions display
   - [ ] Feature correlations heatmap displays

4. **Drift Monitoring Panel**
   - [ ] Drift summary badges display
   - [ ] Performance drift chart displays
   - [ ] Feature drift heatmap displays
   - [ ] Drift events timeline displays

5. **Explainability Panel**
   - [ ] Recent predictions selector works
   - [ ] SHAP waterfall chart displays
   - [ ] Feature values table displays
   - [ ] Feature contributions shown

6. **Hyperparameter Panel**
   - [ ] Hyperparameter history displays
   - [ ] Optimization progress shown
   - [ ] Best trials highlighted

**Expected Result:**
- All panels load without errors
- Charts display data correctly
- Filters work properly
- Data updates when filters change

### Step 8: Integration Validation

#### 8.1 Verify EventBridge Rules

```bash
# List all rules
aws events list-rules --name-prefix B3TR

# Check feature engineering schedule
aws events describe-rule --name FeatureEngineeringDaily

# Check training schedule
aws events describe-rule --name TrainModelsWeekly

# Check prediction schedule
aws events describe-rule --name EnsemblePredictDaily

# Check monitoring schedule
aws events describe-rule --name MonitoringDaily
```

**Expected Result:**
- All rules exist and are enabled
- Schedules match requirements
- Targets configured correctly

#### 8.2 Verify S3 Event Triggers

```bash
# Get bucket notification configuration
aws s3api get-bucket-notification-configuration \
    --bucket $BUCKET_NAME | jq '.'
```

**Expected Result:**
- Lambda function configurations exist for:
  - `raw/*.csv` → FeatureEngineering
  - `hyperparameters/*/best_params.json` → TrainModels
  - `features/*/features.csv` → EnsemblePredict
  - `predictions/*/ensemble_predictions.json` → Monitoring

#### 8.3 Verify SNS Subscriptions

```bash
# Get topic ARN
TOPIC_ARN=$(aws cloudformation describe-stacks \
    --stack-name B3TacticalRankingStackV2 \
    --query "Stacks[0].Outputs[?OutputKey=='AlertsTopicArn'].OutputValue" \
    --output text)

# List subscriptions
aws sns list-subscriptions-by-topic --topic-arn $TOPIC_ARN
```

**Expected Result:**
- Email subscription confirmed
- Subscription status: "Confirmed"

#### 8.4 Verify CloudWatch Alarms

```bash
# List all alarms
aws cloudwatch describe-alarms | jq '.MetricAlarms[] | {AlarmName, StateValue}'
```

**Expected Result:**
- All alarms in "OK" state
- Alarms configured for:
  - FeatureEngineeringFailedAlarm
  - TrainModelsFailedAlarm
  - EnsemblePredictFailedAlarm
  - MonitoringFailedAlarm

### Step 9: Performance Validation

#### 9.1 Check Lambda Execution Times

```bash
# Get metrics for each Lambda
for LAMBDA in FeatureEngineering TrainModels EnsemblePredict Monitoring; do
    echo "=== $LAMBDA ==="
    aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Duration \
        --dimensions Name=FunctionName,Value=$LAMBDA \
        --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 3600 \
        --statistics Average,Maximum \
        | jq '.Datapoints'
done
```

**Expected Result:**
- Feature Engineering: < 5 minutes
- Model Training: < 15 minutes
- Ensemble Prediction: < 2 minutes
- Monitoring: < 2 minutes

#### 9.2 Check Lambda Error Rates

```bash
# Get error metrics
for LAMBDA in FeatureEngineering TrainModels EnsemblePredict Monitoring; do
    echo "=== $LAMBDA ==="
    aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Errors \
        --dimensions Name=FunctionName,Value=$LAMBDA \
        --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
        --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
        --period 3600 \
        --statistics Sum \
        | jq '.Datapoints'
done
```

**Expected Result:**
- Error count = 0 for all Lambdas
- No throttling events

### Step 10: End-to-End Pipeline Test

#### 10.1 Run Complete Pipeline

```bash
# Upload new raw data
aws s3 cp data/raw/PETR4_new.csv s3://$BUCKET_NAME/raw/PETR4.csv

# Wait for pipeline to complete (check logs)
echo "Waiting for pipeline to complete..."
sleep 300  # 5 minutes

# Check each stage
echo "=== Feature Engineering ==="
aws s3 ls s3://$BUCKET_NAME/features/ --recursive | tail -1

echo "=== Model Training ==="
aws s3 ls s3://$BUCKET_NAME/models/ --recursive | tail -1

echo "=== Predictions ==="
aws s3 ls s3://$BUCKET_NAME/predictions/ --recursive | tail -1

echo "=== Metrics ==="
aws s3 ls s3://$BUCKET_NAME/metrics/daily/ --recursive | tail -1
```

**Expected Result:**
- New features generated
- Models retrained (if triggered)
- New predictions generated
- New metrics calculated
- All within expected timeframes

#### 10.2 Verify Final Metrics

```bash
# Get latest metrics
LATEST_METRICS=$(aws s3 ls s3://$BUCKET_NAME/metrics/daily/ | tail -1 | awk '{print $4}')
aws s3 cp s3://$BUCKET_NAME/metrics/daily/$LATEST_METRICS /tmp/final_metrics.json

# Check MAPE
MAPE=$(cat /tmp/final_metrics.json | jq '.overall_mape')
echo "Final MAPE: $MAPE%"

# Check coverage
COVERAGE=$(cat /tmp/final_metrics.json | jq '.overall_coverage')
echo "Final Coverage: $COVERAGE%"

# Verify requirements
if (( $(echo "$MAPE < 7" | bc -l) )); then
    echo "✅ MAPE < 7% requirement met"
else
    echo "❌ MAPE < 7% requirement NOT met"
fi

if (( $(echo "$COVERAGE > 90" | bc -l) )); then
    echo "✅ Coverage > 90% requirement met"
else
    echo "❌ Coverage > 90% requirement NOT met"
fi
```

**Expected Result:**
- **MAPE < 7%** ✅
- **Coverage > 90%** ✅

## Validation Checklist

### Infrastructure
- [ ] All Lambda functions deployed
- [ ] EventBridge rules configured
- [ ] S3 event triggers configured
- [ ] SNS topic created and subscribed
- [ ] CloudWatch alarms configured
- [ ] CloudWatch dashboard created

### Functionality
- [ ] Feature engineering generates 52+ features
- [ ] Hyperparameter optimization completes successfully
- [ ] Model training produces 4 models
- [ ] Ensemble prediction combines models correctly
- [ ] Monitoring calculates metrics accurately
- [ ] Drift detection works correctly
- [ ] Alerts sent when thresholds exceeded

### Requirements
- [ ] **MAPE < 7%** (Requirement 1.1)
- [ ] **Coverage > 90%** (Requirement 2.1)
- [ ] Feature engineering completes within 5 minutes (Requirement 3.6)
- [ ] Ensemble combines 4 models (Requirement 4.1)
- [ ] Hyperparameter optimization uses ≥ 50 trials (Requirement 5.1)
- [ ] Drift detection uses 30-day rolling window (Requirement 7.2)
- [ ] Walk-forward validation implemented (Requirement 8.1)

### Dashboard
- [ ] Dashboard accessible via URL
- [ ] All panels load correctly
- [ ] Charts display data
- [ ] Filters work properly
- [ ] Real-time updates work

## Troubleshooting

### MAPE > 7%

**Possible Causes:**
- Insufficient training data
- Poor hyperparameter tuning
- Data quality issues
- Model not converged

**Solutions:**
1. Increase training data (≥ 12 months)
2. Run hyperparameter optimization with more trials
3. Check data quality and handle outliers
4. Increase training epochs/iterations

### Coverage < 90%

**Possible Causes:**
- Prediction intervals too narrow
- High volatility in data
- Model uncertainty not captured

**Solutions:**
1. Recalibrate prediction intervals
2. Use conformal prediction methods
3. Increase interval width parameter
4. Check interval generation logic

### Pipeline Not Executing

**Possible Causes:**
- EventBridge rules disabled
- Lambda permissions missing
- S3 event triggers not configured

**Solutions:**
1. Enable EventBridge rules
2. Check Lambda IAM roles
3. Verify S3 bucket notification configuration
4. Check CloudWatch Logs for errors

### Dashboard Not Loading

**Possible Causes:**
- API Gateway not configured
- CORS issues
- Data not available in S3

**Solutions:**
1. Check API Gateway configuration
2. Configure CORS headers
3. Verify data exists in S3
4. Check browser console for errors

## Success Criteria

The validation is successful if:

1. ✅ Complete pipeline executes end-to-end
2. ✅ **MAPE < 7%** on validation set
3. ✅ **Coverage > 90%** on validation set
4. ✅ Dashboard displays all metrics correctly
5. ✅ All integrations work properly
6. ✅ Alerts sent when thresholds exceeded
7. ✅ No errors in CloudWatch Logs
8. ✅ All Lambda functions execute within timeout
9. ✅ S3 event triggers work correctly
10. ✅ EventBridge schedules execute on time

## Next Steps

After successful validation:

1. **Production Deployment**
   - Deploy to production environment
   - Configure production data sources
   - Set up production monitoring

2. **Continuous Monitoring**
   - Monitor MAPE and coverage daily
   - Review drift detection alerts
   - Adjust thresholds as needed

3. **Optimization**
   - Fine-tune hyperparameters monthly
   - Retrain models weekly
   - Update features as needed

4. **Documentation**
   - Document any issues encountered
   - Update runbooks
   - Train team on operations

## Conclusion

This validation guide ensures the Model Optimization Pipeline meets all requirements and is ready for production use. Follow each step carefully and document any deviations or issues encountered.

For questions or issues, refer to:
- [Deployment Guide](MODEL_OPTIMIZATION_DEPLOYMENT.md)
- [Monitoring Setup](MONITORING_SETUP.md)
- [Design Document](.kiro/specs/model-optimization/design.md)
- [Requirements Document](.kiro/specs/model-optimization/requirements.md)
