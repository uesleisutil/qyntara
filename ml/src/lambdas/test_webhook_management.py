"""
Unit tests for webhook management Lambda function
"""

import json
import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import hmac
import hashlib

# Mock AWS services before importing the module
with patch('boto3.resource'), patch('boto3.client'):
    from webhook_management import (
        WebhookManager,
        lambda_handler,
        SUPPORTED_EVENTS
    )


class TestWebhookManager:
    """Test WebhookManager class"""
    
    @pytest.fixture
    def manager(self):
        """Create WebhookManager instance with mocked dependencies"""
        with patch('webhook_management.dynamodb'), \
             patch('webhook_management.cloudwatch'):
            manager = WebhookManager()
            manager.webhooks_table = Mock()
            manager.logs_table = Mock()
            manager.session = Mock()
            return manager
    
    def test_create_webhook_success(self, manager):
        """Test successful webhook creation"""
        webhook_data = {
            'url': 'https://example.com/webhook',
            'events': ['drift.data_drift_detected'],
            'enabled': True
        }
        
        result = manager.create_webhook('user-123', webhook_data)
        
        assert 'webhook_id' in result
        assert result['url'] == webhook_data['url']
        assert result['events'] == webhook_data['events']
        assert 'secret' in result
        assert result['enabled'] is True
        
        # Verify DynamoDB put_item was called
        manager.webhooks_table.put_item.assert_called_once()
    
    def test_create_webhook_invalid_url(self, manager):
        """Test webhook creation with invalid URL"""
        webhook_data = {
            'url': 'invalid-url',
            'events': ['drift.data_drift_detected']
        }
        
        with pytest.raises(ValueError, match="must start with http"):
            manager.create_webhook('user-123', webhook_data)
    
    def test_create_webhook_no_events(self, manager):
        """Test webhook creation without events"""
        webhook_data = {
            'url': 'https://example.com/webhook',
            'events': []
        }
        
        with pytest.raises(ValueError, match="At least one event type is required"):
            manager.create_webhook('user-123', webhook_data)
    
    def test_create_webhook_invalid_event(self, manager):
        """Test webhook creation with invalid event type"""
        webhook_data = {
            'url': 'https://example.com/webhook',
            'events': ['invalid.event.type']
        }
        
        with pytest.raises(ValueError, match="Unsupported event type"):
            manager.create_webhook('user-123', webhook_data)
    
    def test_update_webhook_success(self, manager):
        """Test successful webhook update"""
        updates = {
            'url': 'https://example.com/new-webhook',
            'enabled': False
        }
        
        manager.webhooks_table.update_item.return_value = {
            'Attributes': {
                'webhook_id': 'webhook-123',
                'url': updates['url'],
                'enabled': updates['enabled']
            }
        }
        
        result = manager.update_webhook('user-123', 'webhook-123', updates)
        
        assert result['url'] == updates['url']
        assert result['enabled'] == updates['enabled']
        manager.webhooks_table.update_item.assert_called_once()
    
    def test_delete_webhook(self, manager):
        """Test webhook deletion"""
        manager.delete_webhook('user-123', 'webhook-123')
        
        manager.webhooks_table.delete_item.assert_called_once_with(
            Key={'PK': 'USER#user-123', 'SK': 'WEBHOOK#webhook-123'}
        )
    
    def test_get_webhook(self, manager):
        """Test getting a specific webhook"""
        mock_webhook = {
            'webhook_id': 'webhook-123',
            'url': 'https://example.com/webhook',
            'events': ['drift.data_drift_detected']
        }
        
        manager.webhooks_table.get_item.return_value = {'Item': mock_webhook}
        
        result = manager.get_webhook('user-123', 'webhook-123')
        
        assert result == mock_webhook
        manager.webhooks_table.get_item.assert_called_once()
    
    def test_list_webhooks(self, manager):
        """Test listing all webhooks for a user"""
        mock_webhooks = [
            {'webhook_id': 'webhook-1', 'url': 'https://example.com/1'},
            {'webhook_id': 'webhook-2', 'url': 'https://example.com/2'}
        ]
        
        manager.webhooks_table.query.return_value = {'Items': mock_webhooks}
        
        result = manager.list_webhooks('user-123')
        
        assert len(result) == 2
        assert result == mock_webhooks
        manager.webhooks_table.query.assert_called_once()
    
    def test_generate_signature(self, manager):
        """Test HMAC signature generation"""
        payload = {'event_type': 'test', 'data': {'key': 'value'}}
        secret = 'test-secret'
        
        signature = manager._generate_signature(payload, secret)
        
        assert signature.startswith('sha256=')
        
        # Verify signature is correct
        payload_bytes = json.dumps(payload, sort_keys=True).encode('utf-8')
        expected = hmac.new(
            secret.encode('utf-8'),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()
        
        assert signature == f'sha256={expected}'
    
    def test_deliver_webhook_success(self, manager):
        """Test successful webhook delivery"""
        webhook = {
            'webhook_id': 'webhook-123',
            'user_id': 'user-123',
            'url': 'https://example.com/webhook',
            'secret': 'test-secret',
            'enabled': True
        }
        
        payload = {
            'event_type': 'drift.data_drift_detected',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {'test': 'data'}
        }
        
        # Mock successful HTTP response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.text = 'OK'
        manager.session.post.return_value = mock_response
        
        result = manager._deliver_webhook(webhook, payload)
        
        assert result['success'] is True
        assert result['status_code'] == 200
        assert result['attempts'] == 1
        
        # Verify HTTP request was made
        manager.session.post.assert_called_once()
        call_args = manager.session.post.call_args
        assert call_args[0][0] == webhook['url']
        assert 'X-Webhook-Signature' in call_args[1]['headers']
    
    def test_deliver_webhook_retry_on_failure(self, manager):
        """Test webhook delivery retries on failure"""
        webhook = {
            'webhook_id': 'webhook-123',
            'user_id': 'user-123',
            'url': 'https://example.com/webhook',
            'secret': 'test-secret',
            'enabled': True
        }
        
        payload = {
            'event_type': 'drift.data_drift_detected',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {'test': 'data'}
        }
        
        # Mock failed HTTP responses
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = 'Internal Server Error'
        manager.session.post.return_value = mock_response
        
        with patch('time.sleep'):  # Skip actual sleep delays
            result = manager._deliver_webhook(webhook, payload)
        
        assert result['success'] is False
        assert result['attempts'] == 3  # Should retry 3 times
        assert 'error' in result
    
    def test_deliver_webhook_timeout(self, manager):
        """Test webhook delivery timeout handling"""
        webhook = {
            'webhook_id': 'webhook-123',
            'user_id': 'user-123',
            'url': 'https://example.com/webhook',
            'secret': 'test-secret',
            'enabled': True
        }
        
        payload = {
            'event_type': 'drift.data_drift_detected',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {'test': 'data'}
        }
        
        # Mock timeout exception
        import requests
        manager.session.post.side_effect = requests.exceptions.Timeout()
        
        with patch('time.sleep'):
            result = manager._deliver_webhook(webhook, payload)
        
        assert result['success'] is False
        assert result['error'] == 'Request timeout'
    
    def test_update_webhook_stats_success(self, manager):
        """Test updating webhook statistics on success"""
        webhook = {
            'webhook_id': 'webhook-123',
            'user_id': 'user-123'
        }
        
        manager._update_webhook_stats(webhook, success=True)
        
        manager.webhooks_table.update_item.assert_called_once()
        call_args = manager.webhooks_table.update_item.call_args
        assert 'consecutive_failures = :zero' in call_args[1]['UpdateExpression']
    
    def test_update_webhook_stats_failure(self, manager):
        """Test updating webhook statistics on failure"""
        webhook = {
            'webhook_id': 'webhook-123',
            'user_id': 'user-123'
        }
        
        manager.webhooks_table.update_item.return_value = {
            'Attributes': {
                'consecutive_failures': 5,
                'last_failure_at': datetime.utcnow().isoformat()
            }
        }
        
        manager._update_webhook_stats(webhook, success=False)
        
        assert manager.webhooks_table.update_item.call_count >= 1
    
    def test_test_webhook(self, manager):
        """Test webhook testing functionality"""
        webhook = {
            'webhook_id': 'webhook-123',
            'user_id': 'user-123',
            'url': 'https://example.com/webhook',
            'secret': 'test-secret',
            'enabled': True
        }
        
        manager.webhooks_table.get_item.return_value = {'Item': webhook}
        
        # Mock successful response
        mock_response = Mock()
        mock_response.status_code = 200
        manager.session.post.return_value = mock_response
        
        result = manager.test_webhook('user-123', 'webhook-123')
        
        assert result['success'] is True
        assert result['status_code'] == 200
        assert 'response_time_ms' in result
    
    def test_get_delivery_statistics(self, manager):
        """Test getting delivery statistics"""
        webhook = {
            'webhook_id': 'webhook-123',
            'total_deliveries': 100,
            'successful_deliveries': 95,
            'failed_deliveries': 5,
            'consecutive_failures': 0,
            'enabled': True
        }
        
        manager.webhooks_table.get_item.return_value = {'Item': webhook}
        manager.logs_table.query.return_value = {
            'Items': [
                {'success': True, 'response_time_ms': 100},
                {'success': True, 'response_time_ms': 150},
                {'success': False}
            ]
        }
        
        stats = manager.get_delivery_statistics('webhook-123', 'user-123')
        
        assert stats['total_deliveries'] == 100
        assert stats['success_rate'] == 95.0
        assert 'avg_response_time_ms' in stats
    
    def test_deliver_event_to_multiple_webhooks(self, manager):
        """Test delivering event to multiple webhooks"""
        webhooks = [
            {
                'webhook_id': 'webhook-1',
                'user_id': 'user-123',
                'url': 'https://example.com/1',
                'secret': 'secret-1',
                'enabled': True
            },
            {
                'webhook_id': 'webhook-2',
                'user_id': 'user-123',
                'url': 'https://example.com/2',
                'secret': 'secret-2',
                'enabled': True
            }
        ]
        
        manager.webhooks_table.scan.return_value = {'Items': webhooks}
        
        # Mock successful responses
        mock_response = Mock()
        mock_response.status_code = 200
        manager.session.post.return_value = mock_response
        
        with patch.object(manager, '_send_delivery_metrics'):
            result = manager.deliver_event(
                'drift.data_drift_detected',
                {'test': 'data'}
            )
        
        assert result['webhooks_notified'] == 2
        assert result['successful_deliveries'] == 2
        assert result['failed_deliveries'] == 0


class TestLambdaHandler:
    """Test Lambda handler function"""
    
    def test_create_webhook_endpoint(self):
        """Test POST /api/webhooks endpoint"""
        event = {
            'httpMethod': 'POST',
            'path': '/api/webhooks',
            'body': json.dumps({
                'url': 'https://example.com/webhook',
                'events': ['drift.data_drift_detected'],
                'enabled': True
            }),
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'sub': 'user-123'
                    }
                }
            }
        }
        
        with patch('webhook_management.WebhookManager') as MockManager:
            mock_manager = MockManager.return_value
            mock_manager.create_webhook.return_value = {
                'webhook_id': 'webhook-123',
                'url': 'https://example.com/webhook',
                'events': ['drift.data_drift_detected'],
                'secret': 'secret-key',
                'enabled': True
            }
            
            response = lambda_handler(event, None)
        
        assert response['statusCode'] == 201
        body = json.loads(response['body'])
        assert 'data' in body
        assert body['data']['webhook_id'] == 'webhook-123'
    
    def test_list_webhooks_endpoint(self):
        """Test GET /api/webhooks endpoint"""
        event = {
            'httpMethod': 'GET',
            'path': '/api/webhooks',
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'sub': 'user-123'
                    }
                }
            }
        }
        
        with patch('webhook_management.WebhookManager') as MockManager:
            mock_manager = MockManager.return_value
            mock_manager.list_webhooks.return_value = [
                {'webhook_id': 'webhook-1'},
                {'webhook_id': 'webhook-2'}
            ]
            
            response = lambda_handler(event, None)
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert len(body['data']['webhooks']) == 2
    
    def test_unauthorized_request(self):
        """Test request without authentication"""
        event = {
            'httpMethod': 'GET',
            'path': '/api/webhooks',
            'requestContext': {}
        }
        
        response = lambda_handler(event, None)
        
        assert response['statusCode'] == 401
        body = json.loads(response['body'])
        assert body['error']['code'] == 'UNAUTHORIZED'
    
    def test_invalid_endpoint(self):
        """Test request to invalid endpoint"""
        event = {
            'httpMethod': 'GET',
            'path': '/api/invalid',
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'sub': 'user-123'
                    }
                }
            }
        }
        
        response = lambda_handler(event, None)
        
        assert response['statusCode'] == 404
        body = json.loads(response['body'])
        assert body['error']['code'] == 'NOT_FOUND'
    
    def test_validation_error(self):
        """Test validation error handling"""
        event = {
            'httpMethod': 'POST',
            'path': '/api/webhooks',
            'body': json.dumps({
                'url': 'invalid-url',
                'events': []
            }),
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'sub': 'user-123'
                    }
                }
            }
        }
        
        with patch('webhook_management.WebhookManager') as MockManager:
            mock_manager = MockManager.return_value
            mock_manager.create_webhook.side_effect = ValueError('Invalid URL')
            
            response = lambda_handler(event, None)
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert body['error']['code'] == 'VALIDATION_ERROR'


class TestSupportedEvents:
    """Test supported events configuration"""
    
    def test_all_event_types_defined(self):
        """Test that all required event types are defined"""
        required_categories = [
            'drift',
            'performance',
            'cost',
            'data_quality'
        ]
        
        event_categories = set()
        for event in SUPPORTED_EVENTS:
            category = event.split('.')[0]
            event_categories.add(category)
        
        for category in required_categories:
            assert category in event_categories
    
    def test_event_naming_convention(self):
        """Test that events follow naming convention"""
        for event in SUPPORTED_EVENTS:
            parts = event.split('.')
            assert len(parts) == 2, f"Event {event} should have format 'category.event_name'"
            assert parts[0].islower(), f"Category in {event} should be lowercase"
            assert parts[1].replace('_', '').islower(), f"Event name in {event} should be lowercase"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
