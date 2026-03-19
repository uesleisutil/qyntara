# Webhook System Documentation

## Overview

The webhook system allows external systems to receive real-time notifications when important events occur in the B3 Tactical Ranking Dashboard. This enables integration with alerting systems, workflow automation tools, and custom monitoring solutions.

## Architecture

### Components

1. **Webhook Management Lambda** (`webhook_management.py`)
   - Handles CRUD operations for webhook configurations
   - Manages webhook delivery with retry logic
   - Tracks delivery statistics and logs
   - Implements HMAC signature verification

2. **Webhook Trigger Utility** (`webhook_trigger.py`)
   - Helper functions for triggering webhooks from monitoring lambdas
   - Standardized event payload formats
   - Async invocation to avoid blocking

3. **Frontend Component** (`WebhookManagement.tsx`)
   - User interface for webhook configuration
   - Webhook testing functionality
   - Delivery statistics and logs viewer

4. **DynamoDB Tables**
   - `WebhookConfigurations`: Stores webhook configurations
   - `WebhookDeliveryLogs`: Stores delivery attempt logs (30-day TTL)

## Supported Events

### Drift Detection
- `drift.data_drift_detected` - Data distribution drift detected
- `drift.concept_drift_detected` - Feature-target relationship drift detected

### Performance
- `performance.degradation_detected` - Model performance degradation
- `performance.accuracy_below_threshold` - Accuracy below acceptable threshold

### Cost Alerts
- `cost.budget_exceeded` - Monthly budget exceeded
- `cost.spike_detected` - Unusual cost spike detected

### Data Quality
- `data_quality.completeness_below_threshold` - Data completeness below threshold
- `data_quality.anomaly_detected` - Data anomaly detected (gaps, outliers)
- `data_quality.freshness_warning` - Data age exceeds threshold

## Webhook Payload Format

All webhook deliveries use the following JSON format:

```json
{
  "event_type": "drift.data_drift_detected",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "drift_type": "data_drift",
    "detected_at": "2024-01-15T10:30:00Z",
    "affected_features": ["feature1", "feature2"],
    "severity": "high",
    "details": {
      // Event-specific details
    }
  }
}
```

## Security

### HMAC Signature Verification

Each webhook delivery includes an HMAC-SHA256 signature in the `X-Webhook-Signature` header:

```
X-Webhook-Signature: sha256=<hex_digest>
```

To verify the signature:

```python
import hmac
import hashlib
import json

def verify_webhook_signature(payload_bytes, signature_header, secret):
    """Verify webhook signature"""
    expected_signature = hmac.new(
        secret.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()
    
    received_signature = signature_header.replace('sha256=', '')
    
    return hmac.compare_digest(expected_signature, received_signature)

# Usage
payload_bytes = request.get_data()
signature = request.headers.get('X-Webhook-Signature')
secret = 'your-webhook-secret'

if verify_webhook_signature(payload_bytes, signature, secret):
    # Process webhook
    payload = json.loads(payload_bytes)
else:
    # Invalid signature
    return 401
```

### Additional Headers

- `X-Webhook-ID`: Unique webhook configuration ID
- `X-Webhook-Timestamp`: Event timestamp
- `User-Agent`: `B3-Dashboard-Webhook/1.0`

## Delivery Guarantees

### Retry Logic

- **Max Retries**: 3 attempts
- **Retry Delays**: 1s, 5s, 15s (exponential backoff)
- **Timeout**: 10 seconds per attempt
- **Success Criteria**: HTTP status code < 300

### Automatic Disabling

Webhooks are automatically disabled if:
- 10 consecutive failures occur
- Within a 24-hour window

This prevents excessive retry attempts to failing endpoints.

## API Endpoints

### Create Webhook

```http
POST /api/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com/webhook",
  "events": [
    "drift.data_drift_detected",
    "performance.degradation_detected"
  ],
  "enabled": true
}
```

Response:
```json
{
  "data": {
    "webhook_id": "uuid",
    "url": "https://example.com/webhook",
    "events": ["drift.data_drift_detected", "performance.degradation_detected"],
    "secret": "generated-secret-key",
    "enabled": true
  }
}
```

### List Webhooks

```http
GET /api/webhooks
Authorization: Bearer <token>
```

### Get Webhook

```http
GET /api/webhooks/{webhook_id}
Authorization: Bearer <token>
```

### Update Webhook

```http
PUT /api/webhooks/{webhook_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://example.com/new-webhook",
  "events": ["cost.budget_exceeded"],
  "enabled": false
}
```

### Delete Webhook

```http
DELETE /api/webhooks/{webhook_id}
Authorization: Bearer <token>
```

### Test Webhook

```http
POST /api/webhooks/{webhook_id}/test
Authorization: Bearer <token>
Content-Type: application/json

{
  "sample_event": {
    "event_type": "test.webhook_test",
    "timestamp": "2024-01-15T10:30:00Z",
    "data": {
      "message": "Test webhook"
    }
  }
}
```

Response:
```json
{
  "data": {
    "success": true,
    "status_code": 200,
    "response_time_ms": 150
  }
}
```

### Get Delivery Statistics

```http
GET /api/webhooks/{webhook_id}/statistics
Authorization: Bearer <token>
```

Response:
```json
{
  "data": {
    "webhook_id": "uuid",
    "total_deliveries": 100,
    "successful_deliveries": 95,
    "failed_deliveries": 5,
    "success_rate": 95.0,
    "consecutive_failures": 0,
    "last_failure_at": null,
    "recent_success_rate": 96.0,
    "avg_response_time_ms": 150,
    "enabled": true
  }
}
```

### Get Delivery Logs

```http
GET /api/webhooks/{webhook_id}/logs
Authorization: Bearer <token>
```

Response:
```json
{
  "data": {
    "logs": [
      {
        "webhook_id": "uuid",
        "event_type": "drift.data_drift_detected",
        "timestamp": "2024-01-15T10:30:00Z",
        "success": true,
        "attempts": 1,
        "status_code": 200,
        "response_time_ms": 150,
        "is_test": false
      }
    ]
  }
}
```

## Integration Examples

### Slack Integration

```python
from flask import Flask, request
import hmac
import hashlib
import json
import requests

app = Flask(__name__)

WEBHOOK_SECRET = 'your-webhook-secret'
SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    # Verify signature
    signature = request.headers.get('X-Webhook-Signature')
    payload_bytes = request.get_data()
    
    expected_sig = hmac.new(
        WEBHOOK_SECRET.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(f"sha256={expected_sig}", signature):
        return 'Invalid signature', 401
    
    # Parse payload
    payload = json.loads(payload_bytes)
    event_type = payload['event_type']
    event_data = payload['data']
    
    # Format Slack message
    severity_emoji = {
        'critical': ':rotating_light:',
        'high': ':warning:',
        'medium': ':information_source:',
        'low': ':white_check_mark:'
    }
    
    severity = event_data.get('severity', 'medium')
    emoji = severity_emoji.get(severity, ':bell:')
    
    slack_message = {
        'text': f"{emoji} *{event_type}*",
        'blocks': [
            {
                'type': 'section',
                'text': {
                    'type': 'mrkdwn',
                    'text': f"{emoji} *{event_type}*\n*Severity:* {severity}\n*Time:* {payload['timestamp']}"
                }
            },
            {
                'type': 'section',
                'fields': [
                    {'type': 'mrkdwn', 'text': f"*{k}:*\n{v}"}
                    for k, v in event_data.items()
                    if k not in ['details', 'severity']
                ]
            }
        ]
    }
    
    # Send to Slack
    requests.post(SLACK_WEBHOOK_URL, json=slack_message)
    
    return 'OK', 200
```

### PagerDuty Integration

```python
import requests

PAGERDUTY_ROUTING_KEY = 'your-routing-key'

def send_to_pagerduty(event_type, event_data):
    severity_map = {
        'critical': 'critical',
        'high': 'error',
        'medium': 'warning',
        'low': 'info'
    }
    
    severity = event_data.get('severity', 'medium')
    
    payload = {
        'routing_key': PAGERDUTY_ROUTING_KEY,
        'event_action': 'trigger',
        'payload': {
            'summary': f"{event_type}: {event_data.get('description', 'Alert triggered')}",
            'severity': severity_map.get(severity, 'warning'),
            'source': 'B3 Dashboard',
            'custom_details': event_data
        }
    }
    
    requests.post(
        'https://events.pagerduty.com/v2/enqueue',
        json=payload
    )
```

### Email Integration

```python
import boto3
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

ses = boto3.client('ses')

def send_email_alert(event_type, event_data):
    subject = f"Dashboard Alert: {event_type}"
    
    html_body = f"""
    <html>
    <body>
        <h2>{event_type}</h2>
        <p><strong>Severity:</strong> {event_data.get('severity', 'medium')}</p>
        <p><strong>Time:</strong> {event_data.get('detected_at')}</p>
        <h3>Details:</h3>
        <ul>
            {''.join(f'<li><strong>{k}:</strong> {v}</li>' for k, v in event_data.items())}
        </ul>
    </body>
    </html>
    """
    
    ses.send_email(
        Source='alerts@example.com',
        Destination={'ToAddresses': ['team@example.com']},
        Message={
            'Subject': {'Data': subject},
            'Body': {'Html': {'Data': html_body}}
        }
    )
```

## Monitoring

### CloudWatch Metrics

The webhook system publishes the following metrics to CloudWatch:

- `Dashboard/Webhooks/WebhooksNotified` - Number of webhooks notified per event
- `Dashboard/Webhooks/SuccessfulDeliveries` - Number of successful deliveries
- `Dashboard/Webhooks/FailedDeliveries` - Number of failed deliveries

### Recommended Alarms

1. **High Failure Rate**
   - Metric: `FailedDeliveries / (SuccessfulDeliveries + FailedDeliveries)`
   - Threshold: > 20%
   - Action: Investigate webhook endpoints

2. **No Deliveries**
   - Metric: `WebhooksNotified`
   - Threshold: = 0 for 24 hours
   - Action: Check event triggering logic

## Best Practices

### Webhook Endpoint Implementation

1. **Respond Quickly**: Return 200 OK within 10 seconds
2. **Process Async**: Queue webhook for background processing
3. **Verify Signature**: Always verify HMAC signature
4. **Handle Duplicates**: Use event timestamp/ID for idempotency
5. **Log Everything**: Log all webhook receipts for debugging

### Security

1. **Use HTTPS**: Only configure HTTPS webhook URLs
2. **Rotate Secrets**: Periodically regenerate webhook secrets
3. **Validate Payloads**: Validate event data structure
4. **Rate Limiting**: Implement rate limiting on webhook endpoints
5. **IP Whitelisting**: Consider whitelisting AWS Lambda IP ranges

### Reliability

1. **Monitor Delivery Stats**: Check success rates regularly
2. **Test Webhooks**: Use test functionality before going live
3. **Handle Failures**: Implement fallback alerting mechanisms
4. **Set Timeouts**: Configure appropriate timeouts on receiving end
5. **Retry Logic**: Implement your own retry logic if needed

## Troubleshooting

### Webhook Not Receiving Events

1. Check webhook is enabled
2. Verify correct events are selected
3. Check delivery logs for errors
4. Test webhook manually
5. Verify endpoint is accessible from AWS Lambda

### Signature Verification Failing

1. Ensure using correct secret
2. Verify payload is not modified before verification
3. Check byte encoding (UTF-8)
4. Use constant-time comparison (`hmac.compare_digest`)

### High Failure Rate

1. Check endpoint response time (< 10s)
2. Verify endpoint returns 2xx status codes
3. Check for network connectivity issues
4. Review endpoint logs for errors
5. Consider increasing timeout on receiving end

### Webhook Disabled Automatically

1. Check delivery logs for failure reasons
2. Fix endpoint issues
3. Re-enable webhook in UI
4. Monitor for continued failures

## DynamoDB Schema

### WebhookConfigurations Table

```
PK: USER#<user_id>
SK: WEBHOOK#<webhook_id>

Attributes:
- webhook_id: string
- user_id: string
- url: string
- events: list<string>
- secret: string
- enabled: boolean
- created_at: string (ISO 8601)
- updated_at: string (ISO 8601)
- consecutive_failures: number
- last_failure_at: string (ISO 8601)
- total_deliveries: number
- successful_deliveries: number
- failed_deliveries: number
```

### WebhookDeliveryLogs Table

```
PK: WEBHOOK#<webhook_id>
SK: LOG#<timestamp>#<uuid>

Attributes:
- webhook_id: string
- event_type: string
- timestamp: string (ISO 8601)
- success: boolean
- attempts: number
- status_code: number
- response_time_ms: number
- error: string
- is_test: boolean
- ttl: number (30 days)
```

## Future Enhancements

1. **Webhook Templates**: Pre-configured webhooks for popular services
2. **Batch Delivery**: Group multiple events into single delivery
3. **Custom Headers**: Allow custom HTTP headers
4. **Filtering**: Event-level filtering based on severity or other criteria
5. **Webhook Rotation**: Automatic secret rotation
6. **Delivery Scheduling**: Quiet hours and delivery windows
7. **Webhook Groups**: Deliver to multiple URLs for redundancy
8. **Transformation**: Custom payload transformation templates
