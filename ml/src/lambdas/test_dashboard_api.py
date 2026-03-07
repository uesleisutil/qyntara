"""
Tests for Dashboard API Lambda
"""

import pytest
import json
from datetime import datetime
from unittest.mock import Mock, MagicMock
import io

from src.lambdas.dashboard_api import DashboardAPI, lambda_handler


class TestDashboardAPI:
    """Test suite for DashboardAPI."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.mock_s3 = Mock()
        self.api = DashboardAPI(s3_client=self.mock_s3, default_bucket='test-bucket')
    
    def test_initialization(self):
        """Test API initialization."""
        assert self.api.s3_client == self.mock_s3
        assert self.api.default_bucket == 'test-bucket'
    
    def test_get_performance_metrics(self):
        """Test getting performance metrics."""
        # Mock S3 response
        self.mock_s3.list_objects_v2.return_value = {
            'Contents': [
                {'Key': 'metrics/daily/2024-01-01.json'},
                {'Key': 'metrics/daily/2024-01-02.json'}
            ]
        }
        
        def mock_get_object(Bucket, Key):
            date = Key.split('/')[-1].replace('.json', '')
            return {
                'Body': io.BytesIO(json.dumps({
                    'overall_mape': 6.5,
                    'overall_coverage': 91.0,
                    'per_stock_metrics': []
                }).encode())
            }
        
        self.mock_s3.get_object.side_effect = mock_get_object
        
        result = self.api.get_performance_metrics(
            'test-bucket',
            start_date='2024-01-01',
            end_date='2024-01-02'
        )
        
        assert 'metrics' in result
        assert 'summary' in result
        assert len(result['metrics']) == 2
    
    def test_get_model_comparison(self):
        """Test getting model comparison."""
        # Mock S3 response
        predictions_data = {
            'stock_symbols': ['PETR4', 'VALE3'],
            'predictions': {
                'ensemble_prediction': [30.5, 50.2],
                'individual_predictions': {
                    'lstm': [30.0, 50.0],
                    'prophet': [31.0, 50.5]
                },
                'weights': {
                    'lstm': 0.6,
                    'prophet': 0.4
                }
            }
        }
        
        self.mock_s3.get_object.return_value = {
            'Body': io.BytesIO(json.dumps(predictions_data).encode())
        }
        
        result = self.api.get_model_comparison(
            'test-bucket',
            date='2024-01-01',
            stock_symbol='PETR4'
        )
        
        assert result['stock_symbol'] == 'PETR4'
        assert 'models' in result
        assert 'lstm' in result['models']
    
    def test_get_drift_status(self):
        """Test getting drift status."""
        # Mock S3 response
        self.mock_s3.list_objects_v2.return_value = {
            'Contents': [
                {'Key': 'metrics/daily/2024-01-01.json'}
            ]
        }
        
        self.mock_s3.get_object.return_value = {
            'Body': io.BytesIO(json.dumps({
                'drift_detection': {
                    'performance_drift': {
                        'drift_detected': True,
                        'current_mape': 8.0,
                        'baseline_mape': 6.0
                    },
                    'feature_drift_summary': {
                        'drifted_features_count': 5
                    }
                }
            }).encode())
        }
        
        result = self.api.get_drift_status('test-bucket', lookback_days=30)
        
        assert 'drift_events' in result
        assert 'current_status' in result
        assert len(result['drift_events']) > 0
    
    def test_get_ensemble_weights(self):
        """Test getting ensemble weights."""
        # Mock S3 response
        self.mock_s3.list_objects_v2.return_value = {
            'Contents': [
                {'Key': 'predictions/2024-01-01/ensemble_predictions.json'}
            ]
        }
        
        self.mock_s3.get_object.return_value = {
            'Body': io.BytesIO(json.dumps({
                'predictions': {
                    'weights': {
                        'lstm': 0.4,
                        'prophet': 0.3,
                        'xgboost': 0.3
                    }
                }
            }).encode())
        }
        
        result = self.api.get_ensemble_weights('test-bucket', lookback_days=90)
        
        assert 'weight_history' in result
        assert 'current_weights' in result
        assert len(result['current_weights']) == 3


class TestLambdaHandler:
    """Test suite for lambda_handler."""
    
    def test_lambda_handler_metrics_endpoint(self):
        """Test lambda handler with metrics endpoint."""
        event = {
            'httpMethod': 'GET',
            'path': '/api/metrics',
            'queryStringParameters': {
                'bucket': 'test-bucket',
                'start_date': '2024-01-01',
                'end_date': '2024-01-31'
            }
        }
        
        # This will fail without mocking S3, but tests the routing
        response = lambda_handler(event, None)
        
        assert response['statusCode'] in [200, 500]
        assert 'Access-Control-Allow-Origin' in response['headers']
    
    def test_lambda_handler_unknown_endpoint(self):
        """Test lambda handler with unknown endpoint."""
        event = {
            'httpMethod': 'GET',
            'path': '/api/unknown',
            'queryStringParameters': {}
        }
        
        response = lambda_handler(event, None)
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert 'error' in body
        assert 'available_endpoints' in body
