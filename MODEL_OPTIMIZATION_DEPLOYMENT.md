# Model Optimization Pipeline - Deployment Guide

This guide explains how to deploy and configure the Model Optimization Pipeline for the B3 Tactical Ranking system.

## Overview

The Model Optimization Pipeline implements an ensemble forecasting system with:
- **4 Models**: DeepAR, LSTM, Prophet, XGBoost
- **Feature Engineering**: 50+ technical indicators and features
- **Hyperparameter Optimization**: Bayesian optimization with Optuna
- **Drift Monitoring**: Performance and feature drift detection
- **Automated Retraining**: Triggered by drift alerts
- **Interactive Dashboard**: Real-time metrics and visualizations

## Architecture

```
┌─────────────────┐
│  Raw Data (S3)  │
└────────┬────────┘
         │ S3 Event Trigger
         ▼
┌─────────────────────────┐
│ Feature Engineering     │
│ Lambda                  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Features (S3)           │
└────────┬────────────────┘
         │ S3 Event Trigger
         ▼
┌─────────────────────────┐
│ Model Training          │
│ Lambda                  │
│ (DeepAR, LSTM,          │
│  Prophet, XGBoost)      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Models (S3)             │
└────────┬────────────────┘
         │ S3 Event Trigger
         ▼
┌─────────────────────────┐
│ Ensemble Prediction     │
│ Lambda                  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Predictions (S3)        │
└────────┬────────────────┘
         │ S3 Event Trigger
         ▼
┌─────────────────────────┐
│ Monitoring Lambda       │
│ - Calculate Metrics     │
│ - Detect Drift          │
│ - Send Alerts           │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ SNS Alerts              │
│ CloudWatch Dashboard    │
└─────────────────────────┘
```

## Prerequisites

### Required Software
- **AWS CLI** v2.x or later
- **AWS CDK** v2.x or later
- **Node.js** v18.x or later
- **Python** 3.11 or later
- **jq** (for JSON parsing)

### AWS Requirements
- AWS Account with appropriate permissions
- AWS credentials configured (`~/.aws/credentials`)
- Sufficient service quotas for:
  - Lambda functions (10+)
  - S3 buckets
  - EventBridge rules
  - SNS topics
  - CloudWatch alarms

### Install Dependencies

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install AWS CDK
npm install -g aws-cdk

# Install jq
sudo apt-get install jq  # Ubuntu/Debian
brew install jq          # macOS
```

## Configuration

### 1. Environment Variables

Create `infra/.env` file with your configuration:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# S3 Bucket Configuration
B3TR_BUCKET_PREFIX=b3tr-model-optimization

# Model Configuration
B3TR_CONTEXT_LENGTH=60
B3TR_PREDICTION_LENGTH=20
B3TR_TEST_DAYS=60
B3TR_MIN_POINTS=252
B3TR_TOP_N=10

# DeepAR Configuration
DEEPAR_IMAGE_URI=382416733822.dkr.ecr.us-east-1.amazonaws.com/forecasting-deepar:1

# Secrets
BRAPI_SECRET_ID=brapi/pro/token

# Alert Configuration
ALERT_EMAIL=your-email@example.com

# SSM Parameter Store Prefix
B3TR_SSM_PREFIX=/b3tr
```

### 2. AWS Secrets

Create a secret in AWS Secrets Manager for the BRAPI token:

```bash
aws secretsmanager create-secret \
    --name brapi/pro/token \
    --secret-string '{"token":"YOUR_BRAPI_TOKEN"}' \
    --region us-east-1
```

## Deployment

### Quick Deployment

Use the automated deployment script:

```bash
./scripts/deploy-model-optimization.sh \
    --profile default \
    --region us-east-1
```

The script will:
1. ✅ Verify AWS credentials
2. ✅ Install Python dependencies
3. ✅ Install CDK dependencies
4. ✅ Bootstrap CDK (if needed)
5. ✅ Synthesize CDK stack
6. ✅ Deploy infrastructure
7. ✅ Upload configuration files
8. ✅ Create environment file

### Manual Deployment

If you prefer manual deployment:

```bash
# 1. Install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements.txt

cd infra
npm install

# 2. Bootstrap CDK
cdk bootstrap aws://ACCOUNT_ID/REGION

# 3. Deploy stack
cdk deploy --require-approval never

# 4. Upload config files
aws s3 cp config/universe.txt s3://YOUR_BUCKET/config/
aws s3 cp config/b3_holidays_2026.json s3://YOUR_BUCKET/config/
```

## Post-Deployment Configuration

### 1. Subscribe to SNS Alerts

```bash
# Get the SNS topic ARN from stack outputs
ALERTS_TOPIC_ARN=$(aws cloudformation describe-stacks \
    --stack-name B3TacticalRankingStackV2 \
    --query "Stacks[0].Outputs[?OutputKey=='AlertsTopicArn'].OutputValue" \
    --output text)

# Subscribe your email
aws sns subscribe \
    --topic-arn $ALERTS_TOPIC_ARN \
    --protocol email \
    --notification-endpoint your-email@example.com

# Confirm subscription via email
```

### 2. Configure EventBridge Rules

The deployment automatically creates the following schedules:

| Lambda Function | Schedule | Description |
|----------------|----------|-------------|
| Feature Engineering | Daily 19:00 BRT | Process raw data into features |
| Hyperparameter Optimization | Monthly 1st day | Optimize model hyperparameters |
| Model Training | Weekly Sunday | Train all models |
| Ensemble Prediction | Daily 19:30 BRT | Generate predictions |
| Monitoring | Daily 20:00 BRT | Calculate metrics and detect drift |

### 3. Configure S3 Event Triggers

The deployment automatically creates S3 event notifications:

| S3 Event | Trigger | Lambda Function |
|----------|---------|----------------|
| `raw/*.csv` created | New raw data uploaded | Feature Engineering |
| `hyperparameters/*/best_params.json` created | Hyperparameters updated | Model Training |
| `features/*/features.csv` created | Features generated | Ensemble Prediction |
| `predictions/*/ensemble_predictions.json` created | Predictions generated | Monitoring |

## Testing

### Run Automated Tests

```bash
./scripts/test-model-optimization.sh \
    --profile default \
    --region us-east-1
```

The test script will:
1. ✅ Invoke Feature Engineering Lambda
2. ✅ Invoke Model Training Lambda
3. ✅ Invoke Ensemble Prediction Lambda
4. ✅ Invoke Monitoring Lambda
5. ✅ Check S3 outputs
6. ✅ Check CloudWatch Logs

### Manual Testing

#### Test Feature Engineering

```bash
aws lambda invoke \
    --function-name FeatureEngineering \
    --payload '{
        "stock_symbols": ["PETR4", "VALE3"],
        "start_date": "2023-01-01",
        "end_date": "2024-01-01",
        "input_bucket": "YOUR_BUCKET",
        "input_prefix": "raw/",
        "output_bucket": "YOUR_BUCKET",
        "output_prefix": "features/"
    }' \
    response.json

cat response.json | jq '.'
```

#### Test Model Training

```bash
aws lambda invoke \
    --function-name TrainModels \
    --payload '{
        "features_s3_path": "s3://YOUR_BUCKET/features/2024-01-01/features.csv",
        "output_bucket": "YOUR_BUCKET",
        "models_to_train": ["lstm", "prophet", "xgboost"],
        "target_column": "target"
    }' \
    response.json

cat response.json | jq '.'
```

## Monitoring

### CloudWatch Dashboard

Access the Model Optimization Dashboard:

```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=B3TR-ModelOptimization
```

The dashboard displays:
- Lambda invocations
- Lambda errors
- Lambda duration
- Lambda throttles

### CloudWatch Logs

View logs for each Lambda function:

```bash
# Feature Engineering logs
aws logs tail /aws/lambda/FeatureEngineering --follow

# Model Training logs
aws logs tail /aws/lambda/TrainModels --follow

# Ensemble Prediction logs
aws logs tail /aws/lambda/EnsemblePredict --follow

# Monitoring logs
aws logs tail /aws/lambda/Monitoring --follow
```

### CloudWatch Alarms

The deployment creates alarms for:
- Feature Engineering failures
- Model Training failures
- Ensemble Prediction failures
- Monitoring failures

Alarms send notifications to the SNS topic.

## Troubleshooting

### Lambda Timeout Errors

If Lambda functions timeout, increase the timeout:

```typescript
// In infra/lib/infra-stack.ts
const trainModelsFn = new lambda.Function(this, "TrainModels", {
  timeout: cdk.Duration.minutes(15), // Increase this
  memorySize: 2048, // Or increase memory
  // ...
});
```

### S3 Event Trigger Not Working

Check S3 event notifications:

```bash
aws s3api get-bucket-notification-configuration \
    --bucket YOUR_BUCKET
```

Verify Lambda has permission to be invoked by S3:

```bash
aws lambda get-policy \
    --function-name FeatureEngineering
```

### Model Training Failures

Check SageMaker permissions:

```bash
# Verify SageMaker role
aws iam get-role --role-name B3TRSageMakerRole

# Check training jobs
aws sagemaker list-training-jobs --max-results 10
```

### Drift Detection Not Working

Verify historical metrics exist:

```bash
aws s3 ls s3://YOUR_BUCKET/metrics/daily/ --recursive
```

Check monitoring Lambda logs:

```bash
aws logs tail /aws/lambda/Monitoring --follow
```

## Cost Optimization

### Estimated Monthly Costs

| Service | Usage | Estimated Cost |
|---------|-------|----------------|
| Lambda | ~1000 invocations/month | $0.20 |
| S3 | 100 GB storage | $2.30 |
| SageMaker Training | 10 hours/month | $5.00 |
| CloudWatch | Logs + Metrics | $5.00 |
| SNS | 100 notifications | $0.50 |
| **Total** | | **~$13.00/month** |

### Cost Reduction Tips

1. **Reduce Lambda Memory**: Lower memory for non-intensive functions
2. **Optimize S3 Storage**: Use S3 Lifecycle policies to archive old data
3. **Reduce Training Frequency**: Train weekly instead of daily
4. **Use Spot Instances**: For SageMaker training jobs
5. **Compress S3 Objects**: Use Parquet instead of CSV

## Maintenance

### Update Lambda Code

```bash
# Make code changes
# ...

# Redeploy
cd infra
cdk deploy
```

### Update Hyperparameters

Hyperparameters are automatically optimized monthly. To trigger manual optimization:

```bash
aws lambda invoke \
    --function-name OptimizeHyperparameters \
    --payload '{
        "model_type": "all",
        "training_data_s3_path": "s3://YOUR_BUCKET/features/2024-01-01/features.csv",
        "output_bucket": "YOUR_BUCKET",
        "n_trials": 50,
        "timeout_hours": 24
    }' \
    response.json
```

### Retrain Models

Models are automatically retrained weekly. To trigger manual retraining:

```bash
aws lambda invoke \
    --function-name TrainModels \
    --payload '{
        "features_s3_path": "s3://YOUR_BUCKET/features/2024-01-01/features.csv",
        "output_bucket": "YOUR_BUCKET",
        "models_to_train": ["deepar", "lstm", "prophet", "xgboost"]
    }' \
    response.json
```

## Cleanup

To remove all resources:

```bash
# Delete CDK stack
cd infra
cdk destroy

# Delete S3 bucket (if not retained)
aws s3 rb s3://YOUR_BUCKET --force

# Delete CloudWatch log groups
aws logs delete-log-group --log-group-name /aws/lambda/FeatureEngineering
aws logs delete-log-group --log-group-name /aws/lambda/TrainModels
aws logs delete-log-group --log-group-name /aws/lambda/EnsemblePredict
aws logs delete-log-group --log-group-name /aws/lambda/Monitoring
```

## Support

For issues or questions:
1. Check CloudWatch Logs for error messages
2. Review the troubleshooting section above
3. Open an issue on GitHub
4. Contact the development team

## References

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS SageMaker Documentation](https://docs.aws.amazon.com/sagemaker/)
- [Model Optimization Design Document](.kiro/specs/model-optimization/design.md)
- [Model Optimization Requirements](.kiro/specs/model-optimization/requirements.md)
