# Monitoring Quick Start Guide

## For Backend Developers

### 1. Add Monitoring to Lambda Functions

```python
from observability_service import observability, track_performance

@track_performance("my_function")
def handler(event, context):
    """Your Lambda function with automatic monitoring."""
    
    try:
        # Your business logic here
        result = process_data()
        
        # Track business metrics
        observability.track_business_metrics(
            recommendations_generated=len(result)
        )
        
        return {
            "statusCode": 200,
            "body": json.dumps(result)
        }
        
    except Exception as e:
        # Log error
        observability.log_error(
            str(e),
            type(e).__name__,
            context={"function": "my_function"}
        )
        raise
```

### 2. Track Custom Metrics

```python
# Simple metric
observability.put_metric("CustomMetric", 100, "Count")

# Metric with dimensions
observability.put_metric(
    "ProcessingTime",
    250,
    "Milliseconds",
    dimensions={"Operation": "data_processing"}
)

# Batch metrics (more efficient)
metrics = [
    {"metric_name": "Metric1", "value": 100, "unit": "Count"},
    {"metric_name": "Metric2", "value": 200, "unit": "Count"},
]
observability.put_metrics_batch(metrics)
```

### 3. Send Alerts

```python
# Send alert when something critical happens
if error_rate > 0.05:
    observability.send_alert(
        "High Error Rate",
        f"Error rate is {error_rate:.2%}",
        severity="CRITICAL"
    )
```

## For Frontend Developers

### 1. Initialize Monitoring

In your main `App.js` or `index.js`:

```javascript
import { initializeSentry, trackPageView } from './services/monitoring';

// Initialize once on app load
useEffect(() => {
  initializeSentry();
  trackPageView('app_load');
}, []);
```

### 2. Track Page Views

```javascript
import { trackPageView } from './services/monitoring';

// Track when user navigates to a page
useEffect(() => {
  trackPageView('recommendations', {
    filters_applied: true,
    ticker_count: 50
  });
}, []);
```

### 3. Track Feature Usage

```javascript
import { trackFeatureUsage } from './services/monitoring';

const handleExport = () => {
  trackFeatureUsage('export', 'click', {
    format: 'csv',
    row_count: data.length
  });
  
  // Your export logic
};
```

### 4. Track Errors

```javascript
import { captureError } from './services/monitoring';

try {
  // Your code
} catch (error) {
  captureError(error, {
    component: 'RecommendationsTable',
    action: 'export'
  });
  
  // Show user-friendly error message
}
```

### 5. Add Breadcrumbs for Debugging

```javascript
import { addBreadcrumb } from './services/monitoring';

// Add breadcrumb before important operations
addBreadcrumb('Starting data export', 'user_action', {
  format: 'csv',
  rows: 100
});
```

## For DevOps Engineers

### 1. Deploy Monitoring Stack

```bash
# Deploy CloudWatch alarms and dashboards
cd infra
npm install
cdk deploy B3DashboardMonitoring \
  --parameters alertEmail=alerts@example.com
```

### 2. View CloudWatch Dashboard

1. Open AWS Console
2. Navigate to CloudWatch > Dashboards
3. Select: `B3-Dashboard-System-Health`

### 3. Configure Alarms

```bash
# List all alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix B3Dashboard

# Update alarm threshold
aws cloudwatch put-metric-alarm \
  --alarm-name B3Dashboard-HighAPIResponseTime \
  --threshold 2000

# Disable alarm temporarily
aws cloudwatch disable-alarm-actions \
  --alarm-names B3Dashboard-HighAPIResponseTime
```

### 4. View Logs

```bash
# Tail logs in real-time
aws logs tail /aws/lambda/b3-dashboard --follow

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/b3-dashboard \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

### 5. Generate Operational Report

```bash
# Trigger report generation
aws lambda invoke \
  --function-name operational-reports \
  --payload '{"days": 7}' \
  response.json

# View report
cat response.json | jq .
```

## Environment Variables

### Backend (Lambda)

```bash
CLOUDWATCH_NAMESPACE=B3Dashboard
LOG_GROUP=/aws/lambda/b3-dashboard
SNS_TOPIC_ARN=arn:aws:sns:region:account:b3-dashboard-alarms
BUCKET=b3tr-data-bucket
ANALYTICS_TABLE=UserAnalytics
REPORT_EMAIL=reports@example.com
```

### Frontend (React)

```bash
REACT_APP_SENTRY_DSN=https://your-dsn@sentry.io/project
REACT_APP_ENVIRONMENT=production
REACT_APP_SENTRY_SAMPLE_RATE=1.0
REACT_APP_VERSION=2.0.3
```

## Common Metrics

### Application Metrics
- `ActiveUsers` - Number of active users
- `APICallsTotal` - Total API calls
- `ErrorsTotal` - Total errors
- `RecommendationsGenerated` - Recommendations generated
- `PredictionsMade` - Predictions made

### Performance Metrics
- `APIResponseTime` - API response time (ms)
- `PageLoadTime` - Page load time (ms)
- `TimeToInteractive` - Time to interactive (ms)

### Model Metrics
- `ModelMAPE` - Model MAPE (%)
- `DirectionalAccuracy` - Directional accuracy (%)
- `SharpeRatio` - Sharpe Ratio

## Troubleshooting

### Metrics Not Showing Up

1. Check IAM permissions: `cloudwatch:PutMetricData`
2. Verify namespace: `B3Dashboard`
3. Check timestamp (must be within 2 weeks)

### Alarms Not Triggering

1. Verify alarm is enabled
2. Check evaluation periods
3. Review threshold values

### Sentry Not Working

1. Set `REACT_APP_SENTRY_DSN` environment variable
2. Check browser console for Sentry initialization
3. Verify sample rate is not 0

## Support

For issues or questions:
1. Check CloudWatch Logs for errors
2. Review Sentry dashboard for frontend errors
3. Check operational reports for system health
4. Contact DevOps team for infrastructure issues
