"""
Tests for Monitoring Lambda Function

Tests the monitoring orchestrator including metrics calculation,
drift detection, alerting, and S3 integration.
"""

import pytest
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, MagicMock, patch
import pandas as pd
import numpy as np

from src.lambdas.monitoring import (
    MonitoringOrchestrator,
    lambda_handler
)


class TestMonitoringOrchestrator:
    """Test suite for MonitoringOrchestrator."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.mock_s3 = Mock()
        self.orchestrator = MonitoringOrchestrator(
            s3_client=self.mock_s3,
            sns_topic_arn='arn:aws:sns:us-east-1:123456789012:alerts',
            retraining_topic_arn='arn:aws:sns:us-east-1:123456789012:retraining'
        )
    
    def test_load_predictions(self):
        """Test loading predictions from S3."""
        # Mock S3 response
        predictions_data = {
            'stock_symbols': ['PETR4', 'VALE3'],
            'predictions': {
                'ensemble_prediction': [30.5, 50.2],
                'lower_bounds': [29.0, 49.0],
                'upper_bounds': [32.0, 51.5]
            }
        }
        
        self.mock_s3.get_object.return_value = {
            'Body': Mock(read=lambda: json.dumps(predictions_data).encode())
        }
        
        df = self.orchestrator.load_predictions('test-bucket', '2024-01-01')
        
        assert len(df) == 2
        assert list(df['symbol']) == ['PETR4', 'VALE3']
        assert 'prediction' in df.columns
        assert 'lower_bound' in df.columns
        assert 'upper_bound' in df.columns
    
    def test_load_actuals(self):
        """Test loading actual values from S3."""
        # Mock S3 response
        import io
        actuals_csv = "symbol,actual\nPETR4,30.8\nVALE3,50.5"
        
        self.mock_s3.get_object.return_value = {
            'Body': io.BytesIO(actuals_csv.encode())
        }
        
        df = self.orchestrator.load_actuals('test-bucket', '2024-01-01')
        
        assert len(df) == 2
        assert 'symbol' in df.columns
        assert 'actual' in df.columns
        assert 'date' in df.columns
    
    def test_load_historical_metrics(self):
        """Test loading historical metrics from S3."""
        # Mock S3 list response
        self.mock_s3.list_objects_v2.return_value = {
            'Contents': [
                {'Key': 'metrics/daily/2024-01-01.json'},
                {'Key': 'metrics/daily/2024-01-02.json'}
            ]
        }
        
        # Mock S3 get_object responses
        def mock_get_object(Bucket, Key):
            date = Key.split('/')[-1].replace('.json', '')
            return {
                'Body': Mock(read=lambda: json.dumps({
                    'overall_mape': 6.5,
                    'overall_coverage': 91.0
                }).encode())
            }
        
        self.mock_s3.get_object.side_effect = mock_get_object
        
        df = self.orchestrator.load_historical_metrics('test-bucket', lookback_days=30)
        
        assert len(df) == 2
        assert 'date' in df.columns
        assert 'overall_mape' in df.columns
    
    def test_calculate_daily_metrics(self):
        """Test daily metrics calculation."""
        predictions = pd.DataFrame({
            'symbol': ['PETR4', 'VALE3'],
            'date': ['2024-01-01', '2024-01-01'],
            'prediction': [30.0, 50.0],
            'lower_bound': [29.0, 49.0],
            'upper_bound': [31.0, 51.0]
        })
        
        actuals = pd.DataFrame({
            'symbol': ['PETR4', 'VALE3'],
            'date': ['2024-01-01', '2024-01-01'],
            'actual': [30.5, 50.2]
        })
        
        metrics = self.orchestrator.calculate_daily_metrics(predictions, actuals)
        
        assert 'overall' in metrics
        assert 'per_stock' in metrics
        assert 'top_performers' in metrics
        assert 'poor_performers' in metrics
        assert 'num_stocks' in metrics
        
        assert 'mape' in metrics['overall']
        assert 'coverage' in metrics['overall']
        assert metrics['num_stocks'] == 2
    
    def test_detect_performance_drift_no_drift(self):
        """Test performance drift detection with no drift."""
        historical_metrics = pd.DataFrame({
            'date': pd.date_range('2024-01-01', periods=30),
            'overall_mape': [6.5] * 30
        })
        
        current_date = datetime(2024, 1, 31)
        current_mape = 6.8  # Only 4.6% increase
        
        result = self.orchestrator.detect_performance_drift(
            current_mape,
            historical_metrics,
            current_date
        )
        
        assert result['drift_detected'] is False
    
    def test_detect_performance_drift_with_drift(self):
        """Test performance drift detection with drift."""
        historical_metrics = pd.DataFrame({
            'date': pd.date_range('2024-01-01', periods=30),
            'overall_mape': [6.0] * 30
        })
        
        current_date = datetime(2024, 1, 31)
        current_mape = 8.0  # 33% increase - exceeds 20% threshold
        
        result = self.orchestrator.detect_performance_drift(
            current_mape,
            historical_metrics,
            current_date
        )
        
        assert result['drift_detected'] is True
        assert result['mape_change_percentage'] > 0.20
    
    def test_detect_feature_drift(self):
        """Test feature drift detection."""
        # Create reference and current features
        np.random.seed(42)
        
        reference_features = pd.DataFrame({
            'feature1': np.random.normal(0, 1, 100),
            'feature2': np.random.normal(0, 1, 100),
            'symbol': ['PETR4'] * 100
        })
        
        # Current features with drift in feature1
        current_features = pd.DataFrame({
            'feature1': np.random.normal(2, 1, 100),  # Mean shifted
            'feature2': np.random.normal(0, 1, 100),  # No drift
            'symbol': ['PETR4'] * 100
        })
        
        drift_results, summary = self.orchestrator.detect_feature_drift(
            reference_features,
            current_features
        )
        
        assert 'feature1' in drift_results
        assert 'feature2' in drift_results
        assert summary['total_features'] == 2
        # feature1 should show drift
        assert drift_results['feature1']['drift_detected'] is True
    
    @patch('src.lambdas.monitoring.AlertManager')
    def test_send_alerts_performance_drift(self, mock_alert_manager_class):
        """Test sending alerts for performance drift."""
        mock_alert_manager = Mock()
        mock_alert_manager.handle_performance_drift.return_value = {
            'alert_sent': True,
            'retraining_triggered': True
        }
        self.orchestrator.alert_manager = mock_alert_manager
        
        performance_drift_result = {
            'drift_detected': True,
            'current_mape': 8.0,
            'baseline_mape': 6.0,
            'mape_change_percentage': 0.33,
            'detection_date': datetime(2024, 1, 31)
        }
        
        feature_drift_summary = {
            'drifted_features_count': 0
        }
        
        alerts = self.orchestrator.send_alerts(
            performance_drift_result,
            feature_drift_summary,
            {},
            datetime(2024, 1, 31)
        )
        
        assert alerts['performance_drift'] is True
        assert alerts['retraining_triggered'] is True
        mock_alert_manager.handle_performance_drift.assert_called_once()
    
    @patch('src.lambdas.monitoring.AlertManager')
    def test_send_alerts_feature_drift(self, mock_alert_manager_class):
        """Test sending alerts for feature drift."""
        mock_alert_manager = Mock()
        mock_alert_manager.handle_feature_drift.return_value = {
            'alert_sent': True,
            'retraining_triggered': True
        }
        self.orchestrator.alert_manager = mock_alert_manager
        
        performance_drift_result = {
            'drift_detected': False
        }
        
        feature_drift_summary = {
            'drifted_features_count': 5,
            'drifted_features': ['feature1', 'feature2', 'feature3', 'feature4', 'feature5'],
            'total_features': 50,
            'drift_percentage': 10.0
        }
        
        feature_drift_results = {}
        
        alerts = self.orchestrator.send_alerts(
            performance_drift_result,
            feature_drift_summary,
            feature_drift_results,
            datetime(2024, 1, 31)
        )
        
        assert alerts['feature_drift'] is True
        assert alerts['retraining_triggered'] is True
        mock_alert_manager.handle_feature_drift.assert_called_once()
    
    def test_save_metrics(self):
        """Test saving metrics to S3."""
        metrics = {
            'overall': {
                'mape': 6.5,
                'mae': 1.5,
                'rmse': 2.0,
                'coverage': 91.0,
                'interval_width': 12.0
            },
            'per_stock': [],
            'top_performers': ['PETR4', 'VALE3'],
            'poor_performers': ['STOCK1', 'STOCK2'],
            'num_stocks': 100
        }
        
        drift_results = {
            'performance_drift': {'drift_detected': False},
            'feature_drift_summary': {},
            'alerts_sent': {}
        }
        
        s3_path = self.orchestrator.save_metrics(
            metrics,
            drift_results,
            'test-bucket',
            '2024-01-01'
        )
        
        assert s3_path == 's3://test-bucket/metrics/daily/2024-01-01.json'
        self.mock_s3.put_object.assert_called_once()
        
        # Verify the saved data structure
        call_args = self.mock_s3.put_object.call_args
        saved_data = json.loads(call_args[1]['Body'])
        
        assert saved_data['date'] == '2024-01-01'
        assert saved_data['overall_mape'] == 6.5
        assert saved_data['overall_coverage'] == 91.0
        assert saved_data['num_stocks'] == 100


class TestLambdaHandler:
    """Test suite for lambda_handler."""
    
    @patch('src.lambdas.monitoring.MonitoringOrchestrator')
    def test_lambda_handler_success(self, mock_orchestrator_class):
        """Test successful lambda execution."""
        # Setup mock orchestrator
        mock_orchestrator = Mock()
        mock_orchestrator_class.return_value = mock_orchestrator
        
        # Mock orchestrator methods
        mock_orchestrator.load_predictions.return_value = pd.DataFrame({
            'symbol': ['PETR4'],
            'prediction': [30.0]
        })
        
        mock_orchestrator.load_actuals.return_value = pd.DataFrame({
            'symbol': ['PETR4'],
            'actual': [30.5]
        })
        
        mock_orchestrator.calculate_daily_metrics.return_value = {
            'overall': {'mape': 6.5, 'coverage': 91.0},
            'per_stock': [],
            'top_performers': [],
            'poor_performers': [],
            'num_stocks': 1
        }
        
        mock_orchestrator.load_historical_metrics.return_value = pd.DataFrame()
        
        mock_orchestrator.detect_performance_drift.return_value = {
            'drift_detected': False
        }
        
        mock_orchestrator.send_alerts.return_value = {
            'performance_drift': False,
            'feature_drift': False,
            'retraining_triggered': False
        }
        
        mock_orchestrator.save_metrics.return_value = 's3://bucket/metrics/daily/2024-01-01.json'
        
        # Create event
        event = {
            'prediction_date': '2024-01-01',
            'predictions_bucket': 'test-bucket',
            'sns_topic_arn': 'arn:aws:sns:us-east-1:123456789012:alerts'
        }
        
        # Execute lambda
        response = lambda_handler(event, None)
        
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['status'] == 'success'
        assert 'metrics' in body
        assert 'drift_detected' in body
    
    def test_lambda_handler_missing_parameter(self):
        """Test lambda execution with missing parameter."""
        event = {
            # Missing prediction_date
            'predictions_bucket': 'test-bucket'
        }
        
        response = lambda_handler(event, None)
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert body['status'] == 'error'
        assert 'Missing required parameter' in body['error']
    
    @patch('src.lambdas.monitoring.MonitoringOrchestrator')
    def test_lambda_handler_exception(self, mock_orchestrator_class):
        """Test lambda execution with exception."""
        # Setup mock to raise exception
        mock_orchestrator = Mock()
        mock_orchestrator_class.return_value = mock_orchestrator
        mock_orchestrator.load_predictions.side_effect = Exception("S3 error")
        
        event = {
            'prediction_date': '2024-01-01',
            'predictions_bucket': 'test-bucket'
        }
        
        response = lambda_handler(event, None)
        
        assert response['statusCode'] == 500
        body = json.loads(response['body'])
        assert body['status'] == 'error'
