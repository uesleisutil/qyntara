# Model Optimization Pipeline - Monitoring and Logging Setup

This document describes the monitoring and logging infrastructure for the Model Optimization Pipeline.

## Overview

The monitoring setup includes:
- **CloudWatch Logs**: Centralized logging for all Lambda functions
- **CloudWatch Alarms**: Automated alerts for failures and anomalies
- **CloudWatch Dashboard**: Real-time visualization of pipeline metrics
- **SNS Notifications**: Email/SMS alerts for critical events
- **Custom Metrics**: Business metrics tracked in CloudWatch

## CloudWatch Logs

### Log Groups

Each Lambda function has its own log group with 1-week retention:

| Lambda Function | Log Group | Retention |
|----------------|-----------|-----------|
| Feature Engineering | `/aws/lambda/FeatureEngineering` | 7 days |
| Optimize Hyperparameters | `/aws/lambda/OptimizeHyperparameters` | 7 days |
| Train Models | `/aws/lambda/TrainModels` | 7 days |
| Ensemble Predict | `/aws/lambda/EnsemblePredict` | 7 days |
| Monitoring | `/aws/lambda/Monitoring` | 7 days |
| Dashboard API | `/aws/lambda/DashboardAPI` | 7 days |

### Log Format

All Lambda functions use structured logging with the following format:

```python
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Example log messages
logger.info(f"Processing {len(stocks)} stocks")
logger.warning(f"Missing data for {symbol}: {missing_pct}%")
logger.error(f"Failed to train {model_type}: {error}")
```

### Viewing Logs

#### AWS Console

1. Navigate to CloudWatch Console
2. Select "Log groups" from the left menu
3. Click on the desired log group
4. View log streams and search logs

#### AWS CLI

```bash
# Tail logs in real-time
aws logs tail /aws/lambda/FeatureEngineering --follow

# Get recent logs
aws logs tail /aws/lambda/FeatureEngineering --since 1h

# Search logs
aws logs filter-log-events \
    --log-group-name /aws/lambda/FeatureEngineering \
    --filter-pattern "ERROR"

# Get logs for specific time range
aws logs filter-log-events \
    --log-group-name /aws/lambda/FeatureEngineering \
    --start-time $(date -d '1 hour ago' +%s)000 \
    --end-time $(date +%s)000
```

## CloudWatch Alarms

### Lambda Function Alarms

Each Lambda function has an alarm that triggers on errors:

| Alarm | Metric | Threshold | Action |
|-------|--------|-----------|--------|
| FeatureEngineeringFailedAlarm | Errors | ≥ 1 in 5 min | SNS Alert |
| TrainModelsFailedAlarm | Errors | ≥ 1 in 5 min | SNS Alert |
| EnsemblePredictFailedAlarm | Errors | ≥ 1 in 5 min | SNS Alert |
| MonitoringFailedAlarm | Errors | ≥ 1 in 5 min | SNS Alert |

### Custom Alarms

Additional alarms for business metrics:

| Alarm | Metric | Threshold | Action |
|-------|--------|-----------|--------|
| IngestionFailedAlarm | IngestionOK | < 1 | SNS Alert |
| HighMAPEAlarm | MAPE | > 7% | SNS Alert (via Monitoring Lambda) |
| LowCoverageAlarm | Coverage | < 90% | SNS Alert (via Monitoring Lambda) |
| DriftDetectedAlarm | DriftDetected | = 1 | SNS Alert + Trigger Retraining |

### Alarm States

- **OK**: Metric is within threshold
- **ALARM**: Metric breached threshold
- **INSUFFICIENT_DATA**: Not enough data to evaluate

### Managing Alarms

```bash
# List all alarms
aws cloudwatch describe-alarms

# Get alarm details
aws cloudwatch describe-alarms \
    --alarm-names FeatureEngineeringFailedAlarm

# Disable alarm
aws cloudwatch disable-alarm-actions \
    --alarm-names FeatureEngineeringFailedAlarm

# Enable alarm
aws cloudwatch enable-alarm-actions \
    --alarm-names FeatureEngineeringFailedAlarm

# Delete alarm
aws cloudwatch delete-alarms \
    --alarm-names FeatureEngineeringFailedAlarm
```

## CloudWatch Dashboard

### Dashboard Overview

The **B3TR-ModelOptimization** dashboard provides real-time visibility into:

1. **Lambda Invocations**: Number of executions per function
2. **Lambda Errors**: Error count per function
3. **Lambda Duration**: Execution time per function
4. **Lambda Throttles**: Throttling events per function

### Accessing the Dashboard

**AWS Console:**
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=B3TR-ModelOptimization
```

**AWS CLI:**
```bash
# Get dashboard definition
aws cloudwatch get-dashboard \
    --dashboard-name B3TR-ModelOptimization

# Update dashboard
aws cloudwatch put-dashboard \
    --dashboard-name B3TR-ModelOptimization \
    --dashboard-body file://dashboard.json
```

### Dashboard Widgets

#### Lambda Invocations Widget

Shows the number of invocations for each Lambda function over time.

**Metrics:**
- `AWS/Lambda` → `Invocations` → `FeatureEngineering`
- `AWS/Lambda` → `Invocations` → `TrainModels`
- `AWS/Lambda` → `Invocations` → `EnsemblePredict`
- `AWS/Lambda` → `Invocations` → `Monitoring`

#### Lambda Errors Widget

Shows the number of errors for each Lambda function over time.

**Metrics:**
- `AWS/Lambda` → `Errors` → `FeatureEngineering`
- `AWS/Lambda` → `Errors` → `TrainModels`
- `AWS/Lambda` → `Errors` → `EnsemblePredict`
- `AWS/Lambda` → `Errors` → `Monitoring`

#### Lambda Duration Widget

Shows the execution duration for each Lambda function over time.

**Metrics:**
- `AWS/Lambda` → `Duration` → `FeatureEngineering`
- `AWS/Lambda` → `Duration` → `TrainModels`
- `AWS/Lambda` → `Duration` → `EnsemblePredict`
- `AWS/Lambda` → `Duration` → `Monitoring`

#### Lambda Throttles Widget

Shows throttling events for each Lambda function over time.

**Metrics:**
- `AWS/Lambda` → `Throttles` → `FeatureEngineering`
- `AWS/Lambda` → `Throttles` → `TrainModels`
- `AWS/Lambda` → `Throttles` → `EnsemblePredict`
- `AWS/Lambda` → `Throttles` → `Monitoring`

## SNS Notifications

### Alert Topic

All alarms send notifications to the **b3tr-alerts** SNS topic.

**Topic ARN:**
```
arn:aws:sns:us-east-1:ACCOUNT_ID:b3tr-alerts
```

### Subscribing to Alerts

#### Email Subscription

```bash
aws sns subscribe \
    --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:b3tr-alerts \
    --protocol email \
    --notification-endpoint your-email@example.com
```

Confirm subscription via email.

#### SMS Subscription

```bash
aws sns subscribe \
    --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:b3tr-alerts \
    --protocol sms \
    --notification-endpoint +1234567890
```

#### Lambda Subscription

```bash
aws sns subscribe \
    --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:b3tr-alerts \
    --protocol lambda \
    --notification-endpoint arn:aws:lambda:us-east-1:ACCOUNT_ID:function:AlertHandler
```

### Alert Message Format

```json
{
  "AlarmName": "FeatureEngineeringFailedAlarm",
  "AlarmDescription": "Feature engineering Lambda failed",
  "AWSAccountId": "123456789012",
  "NewStateValue": "ALARM",
  "NewStateReason": "Threshold Crossed: 1 datapoint [1.0 (01/01/24 12:00:00)] was greater than or equal to the threshold (1.0).",
  "StateChangeTime": "2024-01-01T12:00:00.000+0000",
  "Region": "us-east-1",
  "AlarmArn": "arn:aws:cloudwatch:us-east-1:123456789012:alarm:FeatureEngineeringFailedAlarm",
  "OldStateValue": "OK",
  "Trigger": {
    "MetricName": "Errors",
    "Namespace": "AWS/Lambda",
    "StatisticType": "Statistic",
    "Statistic": "SUM",
    "Unit": null,
    "Dimensions": [
      {
        "value": "FeatureEngineering",
        "name": "FunctionName"
      }
    ],
    "Period": 300,
    "EvaluationPeriods": 1,
    "ComparisonOperator": "GreaterThanOrEqualToThreshold",
    "Threshold": 1.0,
    "TreatMissingData": "notBreaching",
    "EvaluateLowSampleCountPercentile": ""
  }
}
```

## Custom Metrics

### Publishing Custom Metrics

The Monitoring Lambda publishes custom metrics to CloudWatch:

```python
import boto3

cloudwatch = boto3.client('cloudwatch')

# Publish MAPE metric
cloudwatch.put_metric_data(
    Namespace='B3TR/ModelOptimization',
    MetricData=[
        {
            'MetricName': 'MAPE',
            'Value': 6.5,
            'Unit': 'Percent',
            'Timestamp': datetime.now(),
            'Dimensions': [
                {'Name': 'Model', 'Value': 'Ensemble'},
                {'Name': 'Stock', 'Value': 'PETR4'}
            ]
        }
    ]
)
```

### Available Custom Metrics

| Metric | Namespace | Dimensions | Description |
|--------|-----------|------------|-------------|
| MAPE | B3TR/ModelOptimization | Model, Stock | Mean Absolute Percentage Error |
| Coverage | B3TR/ModelOptimization | Model, Stock | Prediction interval coverage |
| IntervalWidth | B3TR/ModelOptimization | Model, Stock | Average interval width |
| DriftDetected | B3TR/ModelOptimization | Type | Drift detection flag (0 or 1) |
| IngestionOK | B3TR | - | Data ingestion success flag |

### Querying Custom Metrics

```bash
# Get MAPE metric
aws cloudwatch get-metric-statistics \
    --namespace B3TR/ModelOptimization \
    --metric-name MAPE \
    --dimensions Name=Model,Value=Ensemble \
    --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 3600 \
    --statistics Average

# Get drift detection metric
aws cloudwatch get-metric-statistics \
    --namespace B3TR/ModelOptimization \
    --metric-name DriftDetected \
    --dimensions Name=Type,Value=Performance \
    --start-time $(date -u -d '1 day ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 3600 \
    --statistics Sum
```

## Log Insights Queries

### Useful Queries

#### Find All Errors

```sql
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

#### Lambda Execution Duration

```sql
fields @timestamp, @duration
| stats avg(@duration), max(@duration), min(@duration) by bin(5m)
```

#### Feature Engineering Performance

```sql
fields @timestamp, @message
| filter @message like /Processing.*stocks/
| parse @message "Processing * stocks" as num_stocks
| stats avg(num_stocks) by bin(1h)
```

#### Model Training Metrics

```sql
fields @timestamp, @message
| filter @message like /MAPE/
| parse @message "*MAPE: *" as model, mape
| stats avg(mape) by model
```

#### Drift Detection Events

```sql
fields @timestamp, @message
| filter @message like /drift detected/
| sort @timestamp desc
```

### Running Queries

```bash
# Start query
QUERY_ID=$(aws logs start-query \
    --log-group-name /aws/lambda/FeatureEngineering \
    --start-time $(date -d '1 hour ago' +%s) \
    --end-time $(date +%s) \
    --query-string 'fields @timestamp, @message | filter @message like /ERROR/' \
    --query 'queryId' \
    --output text)

# Get query results
aws logs get-query-results --query-id $QUERY_ID
```

## Monitoring Best Practices

### 1. Set Appropriate Alarm Thresholds

- **Too Sensitive**: Generates false positives, alert fatigue
- **Too Lenient**: Misses real issues
- **Recommendation**: Start conservative, adjust based on historical data

### 2. Use Composite Alarms

Combine multiple alarms to reduce noise:

```bash
aws cloudwatch put-composite-alarm \
    --alarm-name PipelineFailure \
    --alarm-rule "ALARM(FeatureEngineeringFailedAlarm) OR ALARM(TrainModelsFailedAlarm)" \
    --actions-enabled
```

### 3. Implement Runbooks

Document response procedures for each alarm:

- **What**: Description of the alarm
- **Why**: Why it matters
- **How**: Steps to investigate and resolve

### 4. Regular Review

- Review alarm history monthly
- Adjust thresholds based on trends
- Remove obsolete alarms
- Add new alarms for emerging issues

### 5. Cost Optimization

- Use log retention policies (7 days default)
- Archive old logs to S3 for long-term storage
- Use metric filters instead of storing all logs
- Disable verbose logging in production

## Troubleshooting

### High Lambda Errors

1. Check CloudWatch Logs for error messages
2. Review recent code changes
3. Check Lambda configuration (timeout, memory)
4. Verify IAM permissions
5. Check external dependencies (S3, SageMaker)

### Missing Metrics

1. Verify metric publishing code
2. Check CloudWatch PutMetricData permissions
3. Verify metric namespace and dimensions
4. Check for throttling errors

### Alarm Not Triggering

1. Verify alarm configuration
2. Check alarm state (OK, ALARM, INSUFFICIENT_DATA)
3. Verify SNS topic subscription
4. Check SNS delivery logs

### Dashboard Not Updating

1. Refresh browser
2. Check metric data availability
3. Verify dashboard permissions
4. Check time range selection

## Additional Resources

- [CloudWatch Logs Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/)
- [CloudWatch Alarms Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)
- [CloudWatch Dashboards Documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Dashboards.html)
- [SNS Documentation](https://docs.aws.amazon.com/sns/)
- [Log Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
