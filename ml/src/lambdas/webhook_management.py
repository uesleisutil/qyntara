"""
Webhook Management Lambda Function

Handles webhook configuration, delivery, and monitoring for the B3 Tactical Ranking Dashboard.
Supports events: drift detection, performance degradation, cost alerts, data quality issues.
"""

import json
import os
import time
import hmac
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import boto3
from botocore.exceptions import ClientError
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# AWS clients
dynamodb = boto3.resource('dynamodb')
cloudwatch = boto3.client('cloudwatch')

# Environment variables
WEBHOOKS_TABLE = os.environ.get('WEBHOOKS_TABLE', 'WebhookConfigurations')
WEBHOOK_LOGS_TABLE = os.environ.get('WEBHOOK_LOGS_TABLE', 'WebhookDeliveryLogs')
MAX_RETRIES = 3
RETRY_DELAYS = [1, 5, 15]  # seconds
FAILURE_THRESHOLD = 10  # consecutive failures before disabling
FAILURE_WINDOW = 24 * 60 * 60  # 24 hours in seconds

# Supported event types
SUPPORTED_EVENTS = [
    'drift.data_drift_detected',
    'drift.concept_drift_detected',
    'performance.degradation_detected',
    'performance.accuracy_below_threshold',
    'cost.budget_exceeded',
    'cost.spike_detected',
    'data_quality.completeness_below_threshold',
    'data_quality.anomaly_detected',
    'data_quality.freshness_warning'
]


class WebhookManager:
    """Manages webhook configurations and deliveries"""
    
    def __init__(self):
        self.webhooks_table = dynamodb.Table(WEBHOOKS_TABLE)
        self.logs_table = dynamodb.Table(WEBHOOK_LOGS_TABLE)
        self.session = self._create_session()
    
    def _create_session(self) -> requests.Session:
        """Create requests session with retry logic"""
        session = requests.Session()
        retry_strategy = Retry(
            total=0,  # We handle retries manually
            backoff_factor=0
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        return session
    
    def create_webhook(self, user_id: str, webhook_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new webhook configuration"""
        webhook_id = str(uuid.uuid4())
        
        # Validate webhook data
        self._validate_webhook_data(webhook_data)
        
        # Generate secret for HMAC signature
        secret = self._generate_secret()
        
        webhook = {
            'PK': f'USER#{user_id}',
            'SK': f'WEBHOOK#{webhook_id}',
            'webhook_id': webhook_id,
            'user_id': user_id,
            'url': webhook_data['url'],
            'events': webhook_data['events'],
            'secret': secret,
            'enabled': webhook_data.get('enabled', True),
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
            'consecutive_failures': 0,
            'last_failure_at': None,
            'total_deliveries': 0,
            'successful_deliveries': 0,
            'failed_deliveries': 0
        }
        
        self.webhooks_table.put_item(Item=webhook)
        
        return {
            'webhook_id': webhook_id,
            'url': webhook['url'],
            'events': webhook['events'],
            'secret': secret,
            'enabled': webhook['enabled']
        }
    
    def update_webhook(self, user_id: str, webhook_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing webhook configuration"""
        # Validate updates
        if 'events' in updates:
            for event in updates['events']:
                if event not in SUPPORTED_EVENTS:
                    raise ValueError(f"Unsupported event type: {event}")
        
        update_expression = "SET updated_at = :updated_at"
        expression_values = {':updated_at': datetime.utcnow().isoformat()}
        
        if 'url' in updates:
            update_expression += ", #url = :url"
            expression_values[':url'] = updates['url']
        
        if 'events' in updates:
            update_expression += ", events = :events"
            expression_values[':events'] = updates['events']
        
        if 'enabled' in updates:
            update_expression += ", enabled = :enabled"
            expression_values[':enabled'] = updates['enabled']
        
        response = self.webhooks_table.update_item(
            Key={'PK': f'USER#{user_id}', 'SK': f'WEBHOOK#{webhook_id}'},
            UpdateExpression=update_expression,
            ExpressionAttributeNames={'#url': 'url'} if 'url' in updates else None,
            ExpressionAttributeValues=expression_values,
            ReturnValues='ALL_NEW'
        )
        
        return response['Attributes']
    
    def delete_webhook(self, user_id: str, webhook_id: str) -> None:
        """Delete a webhook configuration"""
        self.webhooks_table.delete_item(
            Key={'PK': f'USER#{user_id}', 'SK': f'WEBHOOK#{webhook_id}'}
        )
    
    def get_webhook(self, user_id: str, webhook_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific webhook configuration"""
        response = self.webhooks_table.get_item(
            Key={'PK': f'USER#{user_id}', 'SK': f'WEBHOOK#{webhook_id}'}
        )
        return response.get('Item')
    
    def list_webhooks(self, user_id: str) -> List[Dict[str, Any]]:
        """List all webhooks for a user"""
        response = self.webhooks_table.query(
            KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues={
                ':pk': f'USER#{user_id}',
                ':sk': 'WEBHOOK#'
            }
        )
        return response.get('Items', [])
    
    def test_webhook(self, user_id: str, webhook_id: str, sample_event: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Test a webhook with a sample payload"""
        webhook = self.get_webhook(user_id, webhook_id)
        if not webhook:
            raise ValueError(f"Webhook {webhook_id} not found")
        
        # Create sample event if not provided
        if not sample_event:
            sample_event = {
                'event_type': 'test.webhook_test',
                'timestamp': datetime.utcnow().isoformat(),
                'data': {
                    'message': 'This is a test webhook delivery',
                    'webhook_id': webhook_id
                }
            }
        
        # Deliver the test event
        result = self._deliver_webhook(webhook, sample_event, is_test=True)
        
        return {
            'success': result['success'],
            'status_code': result.get('status_code'),
            'response_time_ms': result.get('response_time_ms'),
            'error': result.get('error')
        }
    
    def deliver_event(self, event_type: str, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """Deliver an event to all registered webhooks"""
        # Get all webhooks subscribed to this event type
        webhooks = self._get_webhooks_for_event(event_type)
        
        results = {
            'event_type': event_type,
            'timestamp': datetime.utcnow().isoformat(),
            'webhooks_notified': len(webhooks),
            'successful_deliveries': 0,
            'failed_deliveries': 0,
            'delivery_results': []
        }
        
        # Prepare event payload
        payload = {
            'event_type': event_type,
            'timestamp': datetime.utcnow().isoformat(),
            'data': event_data
        }
        
        # Deliver to each webhook
        for webhook in webhooks:
            if not webhook.get('enabled', True):
                continue
            
            result = self._deliver_webhook(webhook, payload)
            
            if result['success']:
                results['successful_deliveries'] += 1
            else:
                results['failed_deliveries'] += 1
            
            results['delivery_results'].append({
                'webhook_id': webhook['webhook_id'],
                'url': webhook['url'],
                'success': result['success'],
                'attempts': result['attempts'],
                'error': result.get('error')
            })
        
        # Send metrics to CloudWatch
        self._send_delivery_metrics(results)
        
        return results
    
    def _deliver_webhook(self, webhook: Dict[str, Any], payload: Dict[str, Any], is_test: bool = False) -> Dict[str, Any]:
        """Deliver a webhook with retry logic"""
        webhook_id = webhook['webhook_id']
        url = webhook['url']
        secret = webhook['secret']
        
        # Generate HMAC signature
        signature = self._generate_signature(payload, secret)
        
        headers = {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-ID': webhook_id,
            'X-Webhook-Timestamp': payload['timestamp'],
            'User-Agent': 'B3-Dashboard-Webhook/1.0'
        }
        
        result = {
            'success': False,
            'attempts': 0,
            'webhook_id': webhook_id,
            'url': url
        }
        
        # Try delivery with retries
        for attempt in range(MAX_RETRIES):
            result['attempts'] = attempt + 1
            
            try:
                start_time = time.time()
                response = self.session.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=10
                )
                response_time_ms = int((time.time() - start_time) * 1000)
                
                result['status_code'] = response.status_code
                result['response_time_ms'] = response_time_ms
                
                if response.status_code < 300:
                    result['success'] = True
                    
                    # Log successful delivery
                    self._log_delivery(webhook_id, payload, result, is_test)
                    
                    # Update webhook statistics
                    if not is_test:
                        self._update_webhook_stats(webhook, success=True)
                    
                    break
                else:
                    result['error'] = f"HTTP {response.status_code}: {response.text[:200]}"
            
            except requests.exceptions.Timeout:
                result['error'] = "Request timeout"
            except requests.exceptions.ConnectionError:
                result['error'] = "Connection error"
            except Exception as e:
                result['error'] = str(e)
            
            # Wait before retry (except on last attempt)
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAYS[attempt])
        
        # If all retries failed
        if not result['success']:
            self._log_delivery(webhook_id, payload, result, is_test)
            
            if not is_test:
                self._update_webhook_stats(webhook, success=False)
        
        return result
    
    def _update_webhook_stats(self, webhook: Dict[str, Any], success: bool) -> None:
        """Update webhook delivery statistics"""
        user_id = webhook['user_id']
        webhook_id = webhook['webhook_id']
        
        if success:
            self.webhooks_table.update_item(
                Key={'PK': f'USER#{user_id}', 'SK': f'WEBHOOK#{webhook_id}'},
                UpdateExpression='SET total_deliveries = total_deliveries + :inc, '
                                'successful_deliveries = successful_deliveries + :inc, '
                                'consecutive_failures = :zero',
                ExpressionAttributeValues={':inc': 1, ':zero': 0}
            )
        else:
            # Increment failure counters
            response = self.webhooks_table.update_item(
                Key={'PK': f'USER#{user_id}', 'SK': f'WEBHOOK#{webhook_id}'},
                UpdateExpression='SET total_deliveries = total_deliveries + :inc, '
                                'failed_deliveries = failed_deliveries + :inc, '
                                'consecutive_failures = consecutive_failures + :inc, '
                                'last_failure_at = :timestamp',
                ExpressionAttributeValues={
                    ':inc': 1,
                    ':timestamp': datetime.utcnow().isoformat()
                },
                ReturnValues='ALL_NEW'
            )
            
            # Check if webhook should be disabled
            updated_webhook = response['Attributes']
            if updated_webhook['consecutive_failures'] >= FAILURE_THRESHOLD:
                last_failure = datetime.fromisoformat(updated_webhook['last_failure_at'])
                if (datetime.utcnow() - last_failure).total_seconds() <= FAILURE_WINDOW:
                    # Disable webhook
                    self.webhooks_table.update_item(
                        Key={'PK': f'USER#{user_id}', 'SK': f'WEBHOOK#{webhook_id}'},
                        UpdateExpression='SET enabled = :false',
                        ExpressionAttributeValues={':false': False}
                    )
    
    def _log_delivery(self, webhook_id: str, payload: Dict[str, Any], result: Dict[str, Any], is_test: bool) -> None:
        """Log webhook delivery attempt"""
        log_entry = {
            'PK': f'WEBHOOK#{webhook_id}',
            'SK': f'LOG#{datetime.utcnow().isoformat()}#{uuid.uuid4()}',
            'webhook_id': webhook_id,
            'event_type': payload['event_type'],
            'timestamp': datetime.utcnow().isoformat(),
            'success': result['success'],
            'attempts': result['attempts'],
            'status_code': result.get('status_code'),
            'response_time_ms': result.get('response_time_ms'),
            'error': result.get('error'),
            'is_test': is_test,
            'ttl': int((datetime.utcnow() + timedelta(days=30)).timestamp())
        }
        
        self.logs_table.put_item(Item=log_entry)
    
    def get_delivery_logs(self, webhook_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get delivery logs for a webhook"""
        response = self.logs_table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'WEBHOOK#{webhook_id}'},
            ScanIndexForward=False,
            Limit=limit
        )
        return response.get('Items', [])
    
    def get_delivery_statistics(self, webhook_id: str, user_id: str) -> Dict[str, Any]:
        """Get delivery statistics for a webhook"""
        webhook = self.get_webhook(user_id, webhook_id)
        if not webhook:
            raise ValueError(f"Webhook {webhook_id} not found")
        
        # Get recent logs
        logs = self.get_delivery_logs(webhook_id, limit=100)
        
        # Calculate statistics
        recent_success_rate = 0
        if logs:
            recent_successes = sum(1 for log in logs if log['success'])
            recent_success_rate = (recent_successes / len(logs)) * 100
        
        avg_response_time = 0
        if logs:
            response_times = [log.get('response_time_ms', 0) for log in logs if log.get('response_time_ms')]
            if response_times:
                avg_response_time = sum(response_times) / len(response_times)
        
        return {
            'webhook_id': webhook_id,
            'total_deliveries': webhook.get('total_deliveries', 0),
            'successful_deliveries': webhook.get('successful_deliveries', 0),
            'failed_deliveries': webhook.get('failed_deliveries', 0),
            'success_rate': (webhook.get('successful_deliveries', 0) / webhook.get('total_deliveries', 1)) * 100,
            'consecutive_failures': webhook.get('consecutive_failures', 0),
            'last_failure_at': webhook.get('last_failure_at'),
            'recent_success_rate': recent_success_rate,
            'avg_response_time_ms': int(avg_response_time),
            'enabled': webhook.get('enabled', True)
        }
    
    def _get_webhooks_for_event(self, event_type: str) -> List[Dict[str, Any]]:
        """Get all webhooks subscribed to an event type"""
        # Scan all webhooks (in production, use GSI for better performance)
        response = self.webhooks_table.scan(
            FilterExpression='contains(events, :event_type) AND enabled = :true',
            ExpressionAttributeValues={
                ':event_type': event_type,
                ':true': True
            }
        )
        return response.get('Items', [])
    
    def _validate_webhook_data(self, webhook_data: Dict[str, Any]) -> None:
        """Validate webhook configuration data"""
        if 'url' not in webhook_data:
            raise ValueError("Webhook URL is required")
        
        if not webhook_data['url'].startswith(('http://', 'https://')):
            raise ValueError("Webhook URL must start with http:// or https://")
        
        if 'events' not in webhook_data or not webhook_data['events']:
            raise ValueError("At least one event type is required")
        
        for event in webhook_data['events']:
            if event not in SUPPORTED_EVENTS:
                raise ValueError(f"Unsupported event type: {event}")
    
    def _generate_secret(self) -> str:
        """Generate a random secret for HMAC signatures"""
        return hashlib.sha256(uuid.uuid4().bytes).hexdigest()
    
    def _generate_signature(self, payload: Dict[str, Any], secret: str) -> str:
        """Generate HMAC signature for webhook payload"""
        payload_bytes = json.dumps(payload, sort_keys=True).encode('utf-8')
        signature = hmac.new(
            secret.encode('utf-8'),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        return f"sha256={signature}"
    
    def _send_delivery_metrics(self, results: Dict[str, Any]) -> None:
        """Send delivery metrics to CloudWatch"""
        try:
            cloudwatch.put_metric_data(
                Namespace='Dashboard/Webhooks',
                MetricData=[
                    {
                        'MetricName': 'WebhooksNotified',
                        'Value': results['webhooks_notified'],
                        'Unit': 'Count',
                        'Timestamp': datetime.utcnow()
                    },
                    {
                        'MetricName': 'SuccessfulDeliveries',
                        'Value': results['successful_deliveries'],
                        'Unit': 'Count',
                        'Timestamp': datetime.utcnow()
                    },
                    {
                        'MetricName': 'FailedDeliveries',
                        'Value': results['failed_deliveries'],
                        'Unit': 'Count',
                        'Timestamp': datetime.utcnow()
                    }
                ]
            )
        except Exception as e:
            print(f"Error sending CloudWatch metrics: {e}")


def lambda_handler(event, context):
    """Lambda handler for webhook management"""
    try:
        manager = WebhookManager()
        
        # Parse request
        http_method = event.get('httpMethod', event.get('requestContext', {}).get('http', {}).get('method'))
        path = event.get('path', event.get('rawPath', ''))
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        
        # Get user ID from authorizer
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
        if not user_id:
            return error_response(401, 'UNAUTHORIZED', 'User not authenticated')
        
        # Route request
        if path == '/api/webhooks' and http_method == 'POST':
            # Create webhook
            result = manager.create_webhook(user_id, body)
            return success_response(result, 201)
        
        elif path == '/api/webhooks' and http_method == 'GET':
            # List webhooks
            webhooks = manager.list_webhooks(user_id)
            return success_response({'webhooks': webhooks})
        
        elif path.startswith('/api/webhooks/') and http_method == 'GET':
            # Get specific webhook
            webhook_id = path.split('/')[-1]
            
            if path.endswith('/logs'):
                # Get delivery logs
                webhook_id = path.split('/')[-2]
                logs = manager.get_delivery_logs(webhook_id)
                return success_response({'logs': logs})
            
            elif path.endswith('/statistics'):
                # Get delivery statistics
                webhook_id = path.split('/')[-2]
                stats = manager.get_delivery_statistics(webhook_id, user_id)
                return success_response(stats)
            
            else:
                webhook = manager.get_webhook(user_id, webhook_id)
                if not webhook:
                    return error_response(404, 'NOT_FOUND', 'Webhook not found')
                return success_response(webhook)
        
        elif path.startswith('/api/webhooks/') and http_method == 'PUT':
            # Update webhook
            webhook_id = path.split('/')[-1]
            result = manager.update_webhook(user_id, webhook_id, body)
            return success_response(result)
        
        elif path.startswith('/api/webhooks/') and http_method == 'DELETE':
            # Delete webhook
            webhook_id = path.split('/')[-1]
            manager.delete_webhook(user_id, webhook_id)
            return success_response({'message': 'Webhook deleted successfully'})
        
        elif path.endswith('/test') and http_method == 'POST':
            # Test webhook
            webhook_id = path.split('/')[-2]
            result = manager.test_webhook(user_id, webhook_id, body.get('sample_event'))
            return success_response(result)
        
        else:
            return error_response(404, 'NOT_FOUND', 'Endpoint not found')
    
    except ValueError as e:
        return error_response(400, 'VALIDATION_ERROR', str(e))
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return error_response(500, 'INTERNAL_ERROR', 'An unexpected error occurred')


def success_response(data: Any, status_code: int = 200) -> Dict[str, Any]:
    """Generate success response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps({
            'data': data,
            'metadata': {
                'timestamp': datetime.utcnow().isoformat(),
                'version': '1.0'
            }
        })
    }


def error_response(status_code: int, error_code: str, message: str) -> Dict[str, Any]:
    """Generate error response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps({
            'error': {
                'code': error_code,
                'message': message
            },
            'metadata': {
                'timestamp': datetime.utcnow().isoformat()
            }
        })
    }
