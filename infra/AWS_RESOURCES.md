# AWS Resources Configuration for Model Optimization

This document outlines the AWS resources required for the model optimization system.

## S3 Buckets

### 1. Raw Data Bucket
- **Purpose**: Store raw market data from B3
- **Path Pattern**: `s3://{bucket}/raw/{date}/`
- **Lifecycle**: Transition to Glacier after 90 days

### 2. Features Bucket
- **Purpose**: Store engineered features
- **Path Pattern**: `s3://{bucket}/features/{date}/`
- **Lifecycle**: Transition to Glacier after 180 days

### 3. Models Bucket
- **Purpose**: Store model artifacts and scalers
- **Path Pattern**: `s3://{bucket}/models/{model_type}/{version}/`
- **Versioning**: Enabled
- **Lifecycle**: Keep all versions for 1 year

### 4. Predictions Bucket
- **Purpose**: Store model predictions
- **Path Pattern**: `s3://{bucket}/predictions/{date}/`
- **Lifecycle**: Transition to Glacier after 90 days

### 5. Metrics Bucket
- **Purpose**: Store performance metrics and monitoring data
- **Path Pattern**: `s3://{bucket}/metrics/{date}/`
- **Lifecycle**: Keep for 2 years

### 6. Explainability Bucket
- **Purpose**: Store SHAP values and feature importance
- **Path Pattern**: `s3://{bucket}/explainability/{date}/`
- **Lifecycle**: Transition to Glacier after 90 days

## SNS Topics

### 1. Drift Alerts Topic
- **Purpose**: Send alerts for performance and feature drift
- **Subscribers**: Email, Lambda (retraining trigger)

### 2. Model Quality Alerts Topic
- **Purpose**: Send alerts for model quality issues
- **Subscribers**: Email, Lambda

### 3. Retraining Notifications Topic
- **Purpose**: Notify when retraining starts/completes
- **Subscribers**: Email

## IAM Roles

### 1. Lambda Execution Role
- **Permissions**:
  - S3: Read/Write to all buckets
  - SNS: Publish to all topics
  - CloudWatch: Write logs
  - SageMaker: Create training jobs, deploy endpoints

### 2. SageMaker Execution Role
- **Permissions**:
  - S3: Read training data, write model artifacts
  - CloudWatch: Write logs
  - ECR: Pull container images

### 3. Dashboard API Role
- **Permissions**:
  - S3: Read from metrics, predictions, explainability buckets
  - CloudWatch: Write logs

## Lambda Functions

### Feature Engineering Lambda
- **Memory**: 3008 MB
- **Timeout**: 15 minutes
- **Trigger**: EventBridge (daily at 2 AM)
- **Environment Variables**:
  - RAW_DATA_BUCKET
  - FEATURES_BUCKET
  - SNS_TOPIC_ARN

### Model Training Lambda
- **Memory**: 512 MB (orchestration only)
- **Timeout**: 5 minutes
- **Trigger**: EventBridge (monthly), SNS (drift alerts)
- **Environment Variables**:
  - FEATURES_BUCKET
  - MODELS_BUCKET
  - SAGEMAKER_ROLE_ARN

### Hyperparameter Optimization Lambda
- **Memory**: 1024 MB
- **Timeout**: 15 minutes (triggers long-running jobs)
- **Trigger**: Manual, EventBridge (monthly)
- **Environment Variables**:
  - FEATURES_BUCKET
  - MODELS_BUCKET

### Ensemble Prediction Lambda
- **Memory**: 3008 MB
- **Timeout**: 15 minutes
- **Trigger**: EventBridge (daily at 6 AM)
- **Environment Variables**:
  - FEATURES_BUCKET
  - MODELS_BUCKET
  - PREDICTIONS_BUCKET
  - EXPLAINABILITY_BUCKET

### Performance Monitoring Lambda
- **Memory**: 2048 MB
- **Timeout**: 10 minutes
- **Trigger**: EventBridge (daily at 8 AM)
- **Environment Variables**:
  - PREDICTIONS_BUCKET
  - METRICS_BUCKET
  - SNS_DRIFT_TOPIC_ARN
  - SNS_QUALITY_TOPIC_ARN

### Dashboard API Lambda
- **Memory**: 1024 MB
- **Timeout**: 30 seconds
- **Trigger**: API Gateway
- **Environment Variables**:
  - METRICS_BUCKET
  - PREDICTIONS_BUCKET
  - EXPLAINABILITY_BUCKET
  - MODELS_BUCKET

## EventBridge Rules

### 1. Daily Feature Engineering
- **Schedule**: cron(0 2 * * ? *)
- **Target**: Feature Engineering Lambda

### 2. Daily Prediction
- **Schedule**: cron(0 6 * * ? *)
- **Target**: Ensemble Prediction Lambda

### 3. Daily Monitoring
- **Schedule**: cron(0 8 * * ? *)
- **Target**: Performance Monitoring Lambda

### 4. Monthly Retraining
- **Schedule**: cron(0 0 1 * ? *)
- **Target**: Model Training Lambda

### 5. Monthly Hyperparameter Optimization
- **Schedule**: cron(0 0 1 * ? *)
- **Target**: Hyperparameter Optimization Lambda

## SageMaker Resources

### DeepAR Training Job
- **Instance Type**: ml.m5.2xlarge
- **Instance Count**: 1
- **Max Runtime**: 24 hours

### LSTM Training (Lambda-based)
- **Compute**: Lambda with 3008 MB
- **GPU**: Not required (CPU training)

## API Gateway

### Dashboard API
- **Type**: REST API
- **CORS**: Enabled
- **Endpoints**:
  - GET /metrics
  - GET /drift
  - GET /explainability
  - GET /ensemble-insights
  - GET /model-comparison
  - GET /hyperparameters

## CloudWatch

### Log Groups
- `/aws/lambda/feature-engineering`
- `/aws/lambda/model-training`
- `/aws/lambda/hyperparameter-optimization`
- `/aws/lambda/ensemble-prediction`
- `/aws/lambda/performance-monitoring`
- `/aws/lambda/dashboard-api`
- `/aws/sagemaker/TrainingJobs`

### Alarms
- Lambda errors > 5 in 5 minutes
- Lambda duration > 80% of timeout
- SageMaker training job failures
- API Gateway 5xx errors > 10 in 5 minutes

## Estimated Costs (Monthly)

- **S3 Storage**: ~$50 (assuming 500 GB)
- **Lambda Executions**: ~$100 (daily + monthly jobs)
- **SageMaker Training**: ~$200 (monthly retraining)
- **Data Transfer**: ~$20
- **CloudWatch**: ~$10
- **Total**: ~$380/month

## Security Considerations

1. **Encryption**: All S3 buckets use SSE-S3 encryption
2. **Access Control**: IAM roles follow least privilege principle
3. **VPC**: Lambda functions can be deployed in VPC if needed
4. **Secrets**: Use AWS Secrets Manager for sensitive data
5. **Logging**: All API calls logged to CloudTrail
