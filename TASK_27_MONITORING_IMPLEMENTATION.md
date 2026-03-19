# Task 27: Monitoring and Observability Implementation

## Overview

This document describes the implementation of comprehensive monitoring and observability for the B3 Dashboard, including CloudWatch monitoring, Sentry error tracking, performance metrics, user analytics, and operational reporting.

## Requirements Addressed

### Subtask 27.1: CloudWatch Monitoring
- ✅ **Req 83.1**: Send application metrics to CloudWatch
- ✅ **Req 83.2**: Send custom business metrics (active users, API calls, errors)
- ✅ **Req 83.3**: Create CloudWatch alarms for critical metrics
- ✅ **Req 83.4**: Send error logs to CloudWatch Logs
- ✅ **Req 83.5**: Implement distributed tracing for API requests
- ✅ **Req 83.6**: Track frontend performance (page load, time to interactive)
- ✅ **Req 83.7**: Track API performance (response time, error rate)
- ✅ **Req 83.8**: Create CloudWatch dashboards for system health
- ✅ **Req 83.9**: Send alerts to SNS when thresholds exceeded
- ✅ **Req 83.10**: Implement health check endpoints
- ✅ **Req 83.11**: Track user behavior analytics
- ✅ **Req 83.12**: Generate weekly operational reports

### Subtask 27.3: Sentry Error Tracking
- ✅ **Req 76.5**: Integrate Sentry for frontend and backend error tracking

## Implementation Details

### 1. Backend Observability Service

**File**: `ml/src/lambdas/observability_service.py`

A centralized observability service that provides:

#### Core Features:
- **Metrics Tracking**: Send metrics to CloudWatch with dimensions
- **Batch Metrics**: Efficient batch sending of multiple metrics
- **Business Metrics**: Track active users, API calls, errors, recommendations, predictions
- **API Performance**: Track response time, status codes, error rates per endpoint
- **Frontend Performance**: Track page load time, time to interactive, first contentful paint
- **Error Logging**: Structured error logging to CloudWatch Logs
- **Alerting**: Send alerts to SNS topics with severity levels
- **Distributed Tracing**: Generate and track trace IDs across requests
- **Health Checks**: Check connectivity to CloudWatch, S3, DynamoDB

#### Key Classes and Functions:

```python
class ObservabilityService:
    def put_metric(metric_name, value, unit, dimensions, timestamp)
    def put_metrics_batch(metrics)
    def track_business_metrics(active_users, api_calls, errors, ...)
    def track_api_performance(endpoint, response_time, status_code, error)
    def track_frontend_performance(page_load_time, time_to_interactive, ...)
    def log_error(error_message, error_type, stack_trace, context)
    def send_alert(subject, message, severity)
    def create_trace_id()
    def trace_request(trace_id, operation, metadata)

@track_performance(operation_name)  # Decorator for automatic performance tracking
def health_check_handler(event, context)  # Health check endpoint
```

#### Usage Example:

```python
from observability_service import observability, track_performance

# Track a metric
observability.put_metric("RecommendationsGenerated", 50, "Count")

# Track business metrics
observability.track_business_metrics(
    active_users=100,
    api_calls=500,
    errors=5
)

# Track API performance
observability.track_api_performance(
    endpoint="/api/recommendations",
    response_time=250,  # ms
    status_code=200,
    error=False
)

# Log an error
observability.log_error(
    "Database connection failed",
    "ConnectionError",
    stack_trace="...",
    context={"database": "recommendations"}
)

# Send an alert
observability.send_alert(
    "High Error Rate Detected",
    "Error rate exceeded 5% threshold",
    severity="WARNING"
)

# Use decorator for automatic tracking
@track_performance("generate_recommendations")
def handler(event, context):
    # Function automatically tracked
    pass
```

### 2. Analytics Tracker

**File**: `ml/src/lambdas/analytics_tracker.py`

Tracks user behavior analytics including feature usage and navigation patterns.

#### Features:
- Track page views
- Track feature usage
- Track navigation patterns
- Track user interactions
- Store events in DynamoDB and S3
- Generate analytics summaries
- CloudWatch metrics for popular pages and features

#### API Endpoints:

**POST /api/analytics/track**
```json
{
  "user_id": "user123",
  "session_id": "session456",
  "event_type": "page_view",
  "event_data": {
    "page": "recommendations",
    "metadata": {}
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**GET /api/analytics/summary?user_id=user123&days=7**
```json
{
  "total_events": 150,
  "unique_users": 25,
  "unique_sessions": 40,
  "event_types": {
    "page_view": 80,
    "feature_usage": 50,
    "navigation": 20
  },
  "popular_pages": {
    "recommendations": 30,
    "performance": 25,
    "validation": 15
  },
  "popular_features": {
    "filter": 20,
    "export": 15,
    "comparison": 10
  }
}
```

### 3. Operational Reports Generator

**File**: `ml/src/lambdas/operational_reports.py`

Generates weekly operational reports with system metrics and insights.

#### Features:
- Collect metrics from CloudWatch for the past 7 days
- Calculate summary statistics (total, average, max, min, trend)
- Generate insights based on metrics
- Generate recommendations for improvements
- Format reports as HTML emails
- Send reports via SES
- Save reports to S3

#### Metrics Tracked:
- Active Users
- API Calls
- Errors
- API Response Time
- Page Load Time
- Time to Interactive
- Recommendations Generated
- Predictions Made
- Model MAPE
- Directional Accuracy
- Sharpe Ratio
- Hit Rate
- Health Check Status

#### Report Sections:
1. **Key Metrics Table**: Shows total, average, max, min, and trend for each metric
2. **Insights**: Automatically generated insights (e.g., "High error rate detected")
3. **Recommendations**: Actionable recommendations (e.g., "Consider implementing caching")

#### Scheduled Execution:
Configure EventBridge to run weekly:
```yaml
Schedule: rate(7 days)
Target: operational_reports Lambda function
```

### 4. Frontend Monitoring Service

**File**: `dashboard/src/services/monitoring.ts`

Frontend monitoring service with Sentry integration and performance tracking.

#### Features:
- **Sentry Integration**: Error tracking, session replay, performance monitoring
- **Performance Metrics**: Page load time, time to interactive, Web Vitals (LCP, CLS, FID)
- **User Analytics**: Track page views, feature usage, navigation, interactions
- **Error Filtering**: Filter out expected errors and browser quirks
- **User Context**: Associate errors with user information
- **Breadcrumbs**: Add debugging breadcrumbs
- **Transactions**: Track performance transactions
- **Component Profiling**: Profile React component performance

#### Key Functions:

```typescript
// Initialize Sentry
initializeSentry()

// Track performance
trackPerformanceMetrics(page)

// Track analytics
trackPageView(page, metadata)
trackFeatureUsage(feature, action, metadata)
trackNavigation(from, to, metadata)
trackInteraction(element, action, metadata)

// Error tracking
setUserContext(userId, email, username)
captureError(error, context)
captureMessage(message, level)
addBreadcrumb(message, category, data)

// Performance monitoring
const transaction = startTransaction(name, op)
const ProfiledComponent = withProfiler(Component, componentName)
```

#### Usage in React:

```typescript
import { 
  initializeSentry, 
  trackPageView, 
  trackFeatureUsage,
  captureError 
} from './services/monitoring';

// Initialize on app load
useEffect(() => {
  initializeSentry();
  trackPageView('app_load');
}, []);

// Track page views
useEffect(() => {
  trackPageView(activeTab);
}, [activeTab]);

// Track feature usage
const handleExport = () => {
  trackFeatureUsage('export', 'click', { format: 'csv' });
  // ... export logic
};

// Capture errors
try {
  // ... some operation
} catch (error) {
  captureError(error, { operation: 'export' });
}
```

### 5. CloudWatch Monitoring Stack

**File**: `infra/lib/monitoring-stack.ts`

CDK stack for CloudWatch alarms, dashboards, and SNS topics.

#### Components:

**SNS Topic for Alerts**:
- Topic name: `b3-dashboard-alarms`
- Email subscription for alert notifications
- Used by all CloudWatch alarms

**CloudWatch Alarms**:

1. **Performance Alarms**:
   - `APIResponseTimeAlarm`: Triggers when API response time > 1 second
   - `PageLoadTimeAlarm`: Triggers when page load time > 3 seconds
   - `TimeToInteractiveAlarm`: Triggers when TTI > 5 seconds

2. **Error Alarms**:
   - `ErrorRateAlarm`: Triggers when error rate > 5%
   - `CriticalErrorsAlarm`: Triggers on any critical error

3. **Business Metric Alarms**:
   - `NoActiveUsersAlarm`: Triggers when no active users in 1 hour
   - `HighAPICallsAlarm`: Triggers when API calls exceed threshold

4. **Model Performance Alarms**:
   - `HighMAPEAlarm`: Triggers when MAPE > 15%
   - `LowDirectionalAccuracyAlarm`: Triggers when accuracy < 50%
   - `LowSharpeRatioAlarm`: Triggers when Sharpe Ratio < 0.5

**CloudWatch Dashboard**:
- Dashboard name: `B3-Dashboard-System-Health`
- Widgets:
  - API Performance (response time)
  - Frontend Performance (page load, TTI)
  - Error Rate
  - Total Errors (24h)
  - Active Users (1h)
  - Business Metrics (recommendations, predictions, API calls)
  - Model Performance (MAPE, accuracy, Sharpe Ratio)

#### Deployment:

```typescript
import { MonitoringStack } from './lib/monitoring-stack';

new MonitoringStack(app, 'B3DashboardMonitoring', {
  alertEmail: 'alerts@example.com',
  namespace: 'B3Dashboard',
  logGroupName: '/aws/lambda/b3-dashboard',
});
```

### 6. Environment Configuration

**Frontend** (`.env.example`):
```bash
# Sentry Configuration
REACT_APP_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
REACT_APP_ENVIRONMENT=production
REACT_APP_SENTRY_SAMPLE_RATE=1.0
REACT_APP_VERSION=2.0.3
```

**Backend** (Lambda environment variables):
```yaml
CLOUDWATCH_NAMESPACE: B3Dashboard
LOG_GROUP: /aws/lambda/b3-dashboard
SNS_TOPIC_ARN: arn:aws:sns:region:account:b3-dashboard-alarms
BUCKET: b3tr-data-bucket
ANALYTICS_TABLE: UserAnalytics
REPORT_EMAIL: reports@example.com
FROM_EMAIL: noreply@b3dashboard.com
```

## Integration Points

### 1. Lambda Functions

All Lambda functions should import and use the observability service:

```python
from observability_service import observability, track_performance

@track_performance("function_name")
def handler(event, context):
    # Automatic performance tracking
    
    # Track business metrics
    observability.track_business_metrics(
        recommendations_generated=50
    )
    
    # Log errors
    try:
        # ... logic
    except Exception as e:
        observability.log_error(str(e), type(e).__name__)
        raise
```

### 2. API Gateway

Configure API Gateway to:
- Enable CloudWatch Logs
- Enable detailed metrics
- Set up custom access logging
- Add X-Ray tracing

### 3. Frontend Application

Initialize monitoring in `App.js`:

```javascript
import { initializeSentry, trackPageView } from './services/monitoring';

useEffect(() => {
  initializeSentry();
  trackPageView('app_load');
}, []);

useEffect(() => {
  if (activeTab) {
    trackPageView(activeTab);
  }
}, [activeTab]);
```

### 4. DynamoDB Table for Analytics

Create table:
```yaml
TableName: UserAnalytics
PartitionKey: user_id (String)
SortKey: timestamp (String)
Attributes:
  - session_id (String)
  - event_type (String)
  - event_data (String)
TTL: 90 days
```

## Monitoring Metrics Reference

### Application Metrics
- `ActiveUsers`: Number of active users
- `APICallsTotal`: Total API calls
- `ErrorsTotal`: Total errors
- `RecommendationsGenerated`: Recommendations generated
- `PredictionsMade`: Predictions made
- `ErrorsLogged`: Errors logged (by ErrorType dimension)
- `AlertsSent`: Alerts sent (by Severity dimension)
- `ReportsGenerated`: Reports generated
- `HealthCheckStatus`: Health check status (1=healthy, 0=unhealthy)

### Performance Metrics
- `APIResponseTime`: API response time in milliseconds (by Endpoint dimension)
- `APIRequests`: API request count (by Endpoint and StatusCode dimensions)
- `APIErrors`: API error count (by Endpoint dimension)
- `PageLoadTime`: Page load time in milliseconds (by Page dimension)
- `TimeToInteractive`: Time to interactive in milliseconds (by Page dimension)
- `FirstContentfulPaint`: First contentful paint in milliseconds (by Page dimension)

### Analytics Metrics
- `PageViews`: Page view count (by Page dimension)
- `FeatureUsage`: Feature usage count (by Feature dimension)
- `NavigationEvents`: Navigation event count (by From and To dimensions)

### Model Performance Metrics
- `ModelMAPE`: Model MAPE percentage
- `DirectionalAccuracy`: Directional accuracy percentage
- `ModelMAE`: Model MAE
- `SharpeRatio`: Sharpe Ratio
- `HitRate`: Hit rate percentage

## Testing

### 1. Test Observability Service

```python
# Test metric sending
observability.put_metric("TestMetric", 100, "Count")

# Test business metrics
observability.track_business_metrics(active_users=10, api_calls=50)

# Test error logging
observability.log_error("Test error", "TestError")

# Test alerting
observability.send_alert("Test Alert", "This is a test", "INFO")
```

### 2. Test Analytics Tracking

```bash
# Track a page view
curl -X POST https://api.example.com/api/analytics/track \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user",
    "event_type": "page_view",
    "event_data": {"page": "recommendations"}
  }'

# Get analytics summary
curl https://api.example.com/api/analytics/summary?days=7
```

### 3. Test Health Check

```bash
curl https://api.example.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "service": "b3-dashboard",
  "checks": {
    "cloudwatch": true,
    "s3": true,
    "dynamodb": true
  }
}
```

### 4. Test Frontend Monitoring

Open browser console and verify:
- Sentry is initialized
- Performance metrics are tracked
- Page views are tracked
- Errors are captured

### 5. Test CloudWatch Dashboard

1. Navigate to CloudWatch console
2. Open dashboard: `B3-Dashboard-System-Health`
3. Verify all widgets display data
4. Check for any missing metrics

### 6. Test Alarms

Trigger an alarm condition:
```python
# Send high error rate
for i in range(100):
    observability.put_metric("APIErrors", 1, "Count")
    observability.put_metric("APIRequests", 1, "Count")
```

Verify:
1. Alarm state changes to ALARM
2. SNS notification is sent
3. Email is received

## Operational Procedures

### 1. Viewing Metrics

**CloudWatch Console**:
1. Navigate to CloudWatch > Metrics
2. Select namespace: `B3Dashboard`
3. Browse metrics by category

**CLI**:
```bash
# List metrics
aws cloudwatch list-metrics --namespace B3Dashboard

# Get metric statistics
aws cloudwatch get-metric-statistics \
  --namespace B3Dashboard \
  --metric-name APIResponseTime \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-01T23:59:59Z \
  --period 3600 \
  --statistics Average
```

### 2. Viewing Logs

**CloudWatch Logs Console**:
1. Navigate to CloudWatch > Log groups
2. Select log group: `/aws/lambda/b3-dashboard`
3. View log streams

**CLI**:
```bash
# Tail logs
aws logs tail /aws/lambda/b3-dashboard --follow

# Search logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/b3-dashboard \
  --filter-pattern "ERROR"
```

### 3. Viewing Analytics

**Query DynamoDB**:
```bash
aws dynamodb query \
  --table-name UserAnalytics \
  --key-condition-expression "user_id = :uid" \
  --expression-attribute-values '{":uid":{"S":"user123"}}'
```

**Query S3**:
```bash
# List analytics files
aws s3 ls s3://bucket/analytics/dt=2024-01-01/ --recursive

# Download analytics file
aws s3 cp s3://bucket/analytics/dt=2024-01-01/file.json -
```

### 4. Generating Reports

**Manual Trigger**:
```bash
aws lambda invoke \
  --function-name operational-reports \
  --payload '{"days": 7}' \
  response.json
```

**View Reports**:
```bash
# List reports
aws s3 ls s3://bucket/reports/operational/ --recursive

# Download report
aws s3 cp s3://bucket/reports/operational/dt=2024-01-01/report.json -
```

### 5. Managing Alarms

**Update Alarm Threshold**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name B3Dashboard-HighAPIResponseTime \
  --threshold 2000 \
  --evaluation-periods 3
```

**Disable Alarm**:
```bash
aws cloudwatch disable-alarm-actions \
  --alarm-names B3Dashboard-HighAPIResponseTime
```

**Enable Alarm**:
```bash
aws cloudwatch enable-alarm-actions \
  --alarm-names B3Dashboard-HighAPIResponseTime
```

## Troubleshooting

### Issue: Metrics Not Appearing in CloudWatch

**Possible Causes**:
1. IAM permissions missing
2. Incorrect namespace
3. Metric data outside retention period

**Solutions**:
1. Verify Lambda has `cloudwatch:PutMetricData` permission
2. Check namespace matches: `B3Dashboard`
3. Ensure timestamps are within 2 weeks

### Issue: Alarms Not Triggering

**Possible Causes**:
1. Alarm actions disabled
2. Insufficient data points
3. Incorrect threshold

**Solutions**:
1. Enable alarm actions
2. Wait for more data points
3. Review alarm configuration

### Issue: Sentry Not Capturing Errors

**Possible Causes**:
1. DSN not configured
2. Error filtering too aggressive
3. Sample rate too low

**Solutions**:
1. Set `REACT_APP_SENTRY_DSN` environment variable
2. Review `beforeSend` filter
3. Increase `REACT_APP_SENTRY_SAMPLE_RATE`

### Issue: Analytics Not Being Tracked

**Possible Causes**:
1. DynamoDB table doesn't exist
2. Lambda permissions missing
3. API endpoint not configured

**Solutions**:
1. Create `UserAnalytics` table
2. Add DynamoDB permissions to Lambda
3. Configure API Gateway route

## Performance Considerations

### 1. Metric Batching

Send metrics in batches to reduce API calls:
```python
metrics = [
    {"metric_name": "Metric1", "value": 100},
    {"metric_name": "Metric2", "value": 200},
]
observability.put_metrics_batch(metrics)
```

### 2. Async Analytics

Track analytics asynchronously to avoid blocking:
```typescript
// Fire and forget
trackPageView(page).catch(console.error);
```

### 3. Sampling

Use sampling for high-volume metrics:
```typescript
// Sample 10% of page views
if (Math.random() < 0.1) {
  trackPageView(page);
}
```

### 4. Caching

Cache CloudWatch queries in operational reports:
```python
# Cache metric data for 5 minutes
@cache(ttl=300)
def get_cloudwatch_metrics(metric_name, days):
    # ... query CloudWatch
```

## Security Considerations

### 1. Sensitive Data

- Never log sensitive data (passwords, tokens, PII)
- Mask sensitive fields in error logs
- Use Sentry's data scrubbing features

### 2. Access Control

- Restrict CloudWatch access with IAM policies
- Use separate SNS topics for different severity levels
- Encrypt analytics data at rest in S3

### 3. Rate Limiting

- Implement rate limiting for analytics endpoints
- Use CloudWatch API throttling limits
- Monitor for abuse patterns

## Cost Optimization

### 1. Metric Costs

- CloudWatch: $0.30 per custom metric per month
- Estimated: 50 metrics × $0.30 = $15/month

### 2. Log Costs

- CloudWatch Logs: $0.50 per GB ingested
- Estimated: 10 GB/month × $0.50 = $5/month

### 3. Alarm Costs

- CloudWatch Alarms: $0.10 per alarm per month
- Estimated: 15 alarms × $0.10 = $1.50/month

### 4. Total Estimated Cost

- **Monthly**: ~$22/month
- **Annual**: ~$264/year

### 5. Cost Reduction Strategies

- Use metric filters instead of custom metrics where possible
- Aggregate metrics before sending
- Set appropriate log retention periods
- Use composite alarms to reduce alarm count

## Future Enhancements

### 1. Advanced Analytics

- User cohort analysis
- Funnel analysis
- A/B testing framework
- Predictive analytics

### 2. Enhanced Monitoring

- Custom CloudWatch Insights queries
- Automated anomaly detection
- Predictive alerting
- SLA monitoring

### 3. Observability Improvements

- OpenTelemetry integration
- Distributed tracing across services
- Service mesh observability
- Real-time dashboards

### 4. Reporting Enhancements

- Interactive reports
- Custom report templates
- Scheduled report delivery
- Report API for programmatic access

## Conclusion

The monitoring and observability implementation provides comprehensive visibility into the B3 Dashboard system, including:

- ✅ Real-time metrics tracking
- ✅ Automated alerting
- ✅ Error tracking and debugging
- ✅ Performance monitoring
- ✅ User behavior analytics
- ✅ Operational reporting
- ✅ Health checks

This implementation satisfies all requirements for task 27 and provides a solid foundation for maintaining and improving system reliability and performance.
