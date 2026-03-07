"""
Unit tests for Alert Manager
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import json

from src.monitoring.alert_manager import AlertManager


class TestAlertManager(unittest.TestCase):
    """Test cases for AlertManager"""
    
    def setUp(self):
        """Set up test fixtures"""
        # Create manager without actual SNS client
        self.manager = AlertManager(
            sns_topic_arn='arn:aws:sns:us-east-1:123456789:test-alerts',
            retraining_topic_arn='arn:aws:sns:us-east-1:123456789:test-retraining',
            region_name='us-east-1'
        )
        
        # Mock the SNS client
        self.manager.sns_client = Mock()
    
    def test_initialization(self):
        """Test alert manager initialization"""
        self.assertEqual(
            self.manager.sns_topic_arn,
            'arn:aws:sns:us-east-1:123456789:test-alerts'
        )
        self.assertEqual(
            self.manager.retraining_topic_arn,
            'arn:aws:sns:us-east-1:123456789:test-retraining'
        )
        self.assertEqual(self.manager.region_name, 'us-east-1')
    
    def test_initialization_without_boto3(self):
        """Test initialization when boto3 is not available"""
        with patch('src.monitoring.alert_manager.BOTO3_AVAILABLE', False):
            manager = AlertManager(
                sns_topic_arn='arn:aws:sns:us-east-1:123456789:test'
            )
            self.assertIsNone(manager.sns_client)
    
    def test_send_sns_message_success(self):
        """Test successful SNS message sending"""
        self.manager.sns_client.publish.return_value = {
            'MessageId': 'test-message-id-123'
        }
        
        result = self.manager._send_sns_message(
            topic_arn='arn:aws:sns:us-east-1:123456789:test',
            subject='Test Subject',
            message='Test Message'
        )
        
        self.assertTrue(result)
        self.manager.sns_client.publish.assert_called_once()
        
        # Check call arguments
        call_args = self.manager.sns_client.publish.call_args[1]
        self.assertEqual(call_args['TopicArn'], 'arn:aws:sns:us-east-1:123456789:test')
        self.assertEqual(call_args['Subject'], 'Test Subject')
        self.assertEqual(call_args['Message'], 'Test Message')
    
    def test_send_sns_message_with_attributes(self):
        """Test SNS message with attributes"""
        self.manager.sns_client.publish.return_value = {
            'MessageId': 'test-message-id-123'
        }
        
        attributes = {
            'alert_type': {
                'DataType': 'String',
                'StringValue': 'performance_drift'
            }
        }
        
        result = self.manager._send_sns_message(
            topic_arn='arn:aws:sns:us-east-1:123456789:test',
            subject='Test',
            message='Test',
            message_attributes=attributes
        )
        
        self.assertTrue(result)
        call_args = self.manager.sns_client.publish.call_args[1]
        self.assertEqual(call_args['MessageAttributes'], attributes)
    
    def test_send_sns_message_failure(self):
        """Test SNS message sending failure"""
        from botocore.exceptions import ClientError
        
        self.manager.sns_client.publish.side_effect = ClientError(
            {'Error': {'Code': 'InvalidParameter', 'Message': 'Invalid topic'}},
            'Publish'
        )
        
        result = self.manager._send_sns_message(
            topic_arn='arn:aws:sns:us-east-1:123456789:invalid',
            subject='Test',
            message='Test'
        )
        
        self.assertFalse(result)
    
    def test_send_sns_message_no_client(self):
        """Test SNS message when client is not available"""
        self.manager.sns_client = None
        
        result = self.manager._send_sns_message(
            topic_arn='arn:aws:sns:us-east-1:123456789:test',
            subject='Test',
            message='Test'
        )
        
        self.assertFalse(result)
    
    def test_send_performance_drift_alert(self):
        """Test sending performance drift alert"""
        self.manager.sns_client.publish.return_value = {
            'MessageId': 'test-message-id'
        }
        
        result = self.manager.send_performance_drift_alert(
            current_mape=7.5,
            baseline_mape=6.0,
            mape_change_percentage=0.25,
            detection_date=datetime(2024, 3, 15, 10, 30, 0)
        )
        
        self.assertTrue(result)
        self.manager.sns_client.publish.assert_called_once()
        
        # Check message content
        call_args = self.manager.sns_client.publish.call_args[1]
        subject = call_args['Subject']
        message = call_args['Message']
        
        self.assertIn('Performance Drift', subject)
        self.assertIn('25.0%', subject)
        self.assertIn('7.5', message)
        self.assertIn('6.0', message)
    
    def test_send_performance_drift_alert_with_additional_info(self):
        """Test performance drift alert with additional info"""
        self.manager.sns_client.publish.return_value = {
            'MessageId': 'test-message-id'
        }
        
        result = self.manager.send_performance_drift_alert(
            current_mape=7.5,
            baseline_mape=6.0,
            mape_change_percentage=0.25,
            detection_date=datetime(2024, 3, 15),
            additional_info={'stock_symbol': 'PETR4', 'model_version': 'v1.0'}
        )
        
        self.assertTrue(result)
        
        # Check that additional info is in message
        call_args = self.manager.sns_client.publish.call_args[1]
        message = call_args['Message']
        self.assertIn('PETR4', message)
        self.assertIn('v1.0', message)
    
    def test_send_performance_drift_alert_no_topic(self):
        """Test performance drift alert without topic ARN"""
        manager = AlertManager()  # No topic ARN
        
        result = manager.send_performance_drift_alert(
            current_mape=7.5,
            baseline_mape=6.0,
            mape_change_percentage=0.25,
            detection_date=datetime(2024, 3, 15)
        )
        
        self.assertFalse(result)
    
    def test_send_feature_drift_alert(self):
        """Test sending feature drift alert"""
        self.manager.sns_client.publish.return_value = {
            'MessageId': 'test-message-id'
        }
        
        drifted_features = ['rsi', 'macd', 'volume_ratio']
        
        result = self.manager.send_feature_drift_alert(
            drifted_features=drifted_features,
            total_features=10,
            drift_percentage=30.0,
            detection_date=datetime(2024, 3, 15, 10, 30, 0)
        )
        
        self.assertTrue(result)
        self.manager.sns_client.publish.assert_called_once()
        
        # Check message content
        call_args = self.manager.sns_client.publish.call_args[1]
        subject = call_args['Subject']
        message = call_args['Message']
        
        self.assertIn('Feature Drift', subject)
        self.assertIn('3/10', subject)
        self.assertIn('rsi', message)
        self.assertIn('macd', message)
        self.assertIn('volume_ratio', message)
    
    def test_send_feature_drift_alert_many_features(self):
        """Test feature drift alert with many drifted features"""
        self.manager.sns_client.publish.return_value = {
            'MessageId': 'test-message-id'
        }
        
        # Create 15 drifted features
        drifted_features = [f'feature_{i}' for i in range(15)]
        
        result = self.manager.send_feature_drift_alert(
            drifted_features=drifted_features,
            total_features=20,
            drift_percentage=75.0,
            detection_date=datetime(2024, 3, 15)
        )
        
        self.assertTrue(result)
        
        # Check that message shows "and X more"
        call_args = self.manager.sns_client.publish.call_args[1]
        message = call_args['Message']
        self.assertIn('and 5 more', message)
    
    def test_send_feature_drift_alert_with_details(self):
        """Test feature drift alert with detailed results"""
        self.manager.sns_client.publish.return_value = {
            'MessageId': 'test-message-id'
        }
        
        drift_details = {
            'rsi': {'ks_statistic': 0.15, 'p_value': 0.001, 'drift_detected': True},
            'macd': {'ks_statistic': 0.12, 'p_value': 0.003, 'drift_detected': True}
        }
        
        result = self.manager.send_feature_drift_alert(
            drifted_features=['rsi', 'macd'],
            total_features=10,
            drift_percentage=20.0,
            detection_date=datetime(2024, 3, 15),
            drift_details=drift_details
        )
        
        self.assertTrue(result)
        
        # Check that details are in message
        call_args = self.manager.sns_client.publish.call_args[1]
        message = call_args['Message']
        self.assertIn('drift_details', message)
    
    def test_trigger_retraining(self):
        """Test triggering retraining"""
        self.manager.sns_client.publish.return_value = {
            'MessageId': 'test-message-id'
        }
        
        result = self.manager.trigger_retraining(
            reason='Performance drift detected',
            drift_type='performance',
            metadata={'mape_increase': 0.25}
        )
        
        self.assertTrue(result)
        self.manager.sns_client.publish.assert_called_once()
        
        # Check message content
        call_args = self.manager.sns_client.publish.call_args[1]
        self.assertEqual(
            call_args['TopicArn'],
            'arn:aws:sns:us-east-1:123456789:test-retraining'
        )
        
        subject = call_args['Subject']
        message = call_args['Message']
        
        self.assertIn('Retraining Triggered', subject)
        self.assertIn('Performance drift detected', message)
        self.assertIn('performance', message)
    
    def test_trigger_retraining_no_topic(self):
        """Test triggering retraining without topic ARN"""
        manager = AlertManager(
            sns_topic_arn='arn:aws:sns:us-east-1:123456789:test-alerts'
            # No retraining topic
        )
        
        result = manager.trigger_retraining(
            reason='Test',
            drift_type='performance'
        )
        
        self.assertFalse(result)
    
    def test_handle_performance_drift(self):
        """Test handling performance drift"""
        self.manager.sns_client.publish.return_value = {
            'MessageId': 'test-message-id'
        }
        
        drift_result = {
            'drift_detected': True,
            'current_mape': 7.5,
            'baseline_mape': 6.0,
            'mape_change_percentage': 0.25,
            'detection_date': datetime(2024, 3, 15),
            'window_days': 30,
            'drift_threshold': 0.20
        }
        
        result = self.manager.handle_performance_drift(
            drift_result,
            trigger_retraining=True
        )
        
        # Should send both alert and retraining trigger
        self.assertTrue(result['alert_sent'])
        self.assertTrue(result['retraining_triggered'])
        self.assertEqual(self.manager.sns_client.publish.call_count, 2)
    
    def test_handle_performance_drift_no_retraining(self):
        """Test handling performance drift without retraining"""
        self.manager.sns_client.publish.return_value = {
            'MessageId': 'test-message-id'
        }
        
        drift_result = {
            'drift_detected': True,
            'current_mape': 7.5,
            'baseline_mape': 6.0,
            'mape_change_percentage': 0.25,
            'detection_date': datetime(2024, 3, 15)
        }
        
        result = self.manager.handle_performance_drift(
            drift_result,
            trigger_retraining=False
        )
        
        # Should only send alert
        self.assertTrue(result['alert_sent'])
        self.assertFalse(result['retraining_triggered'])
        self.assertEqual(self.manager.sns_client.publish.call_count, 1)
    
    def test_handle_feature_drift(self):
        """Test handling feature drift"""
        self.manager.sns_client.publish.return_value = {
            'MessageId': 'test-message-id'
        }
        
        drift_summary = {
            'total_features': 10,
            'drifted_features_count': 3,
            'drifted_features': ['rsi', 'macd', 'volume'],
            'drift_percentage': 30.0,
            'alpha': 0.05
        }
        
        drift_results = {
            'rsi': {'drift_detected': True, 'p_value': 0.001},
            'macd': {'drift_detected': True, 'p_value': 0.002},
            'volume': {'drift_detected': True, 'p_value': 0.003}
        }
        
        result = self.manager.handle_feature_drift(
            drift_summary,
            drift_results,
            datetime(2024, 3, 15),
            trigger_retraining=True
        )
        
        # Should send both alert and retraining trigger
        self.assertTrue(result['alert_sent'])
        self.assertTrue(result['retraining_triggered'])
        self.assertEqual(self.manager.sns_client.publish.call_count, 2)
    
    def test_handle_feature_drift_no_retraining(self):
        """Test handling feature drift without retraining"""
        self.manager.sns_client.publish.return_value = {
            'MessageId': 'test-message-id'
        }
        
        drift_summary = {
            'total_features': 10,
            'drifted_features_count': 2,
            'drifted_features': ['rsi', 'macd'],
            'drift_percentage': 20.0,
            'alpha': 0.05
        }
        
        result = self.manager.handle_feature_drift(
            drift_summary,
            {},
            datetime(2024, 3, 15),
            trigger_retraining=False
        )
        
        # Should only send alert
        self.assertTrue(result['alert_sent'])
        self.assertFalse(result['retraining_triggered'])
        self.assertEqual(self.manager.sns_client.publish.call_count, 1)


if __name__ == '__main__':
    unittest.main()
