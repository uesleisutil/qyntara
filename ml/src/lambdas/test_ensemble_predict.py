"""
Tests for Ensemble Prediction Lambda Function.
"""

import json
import pytest
import pandas as pd
import numpy as np
from unittest.mock import Mock, MagicMock, patch, call
from datetime import datetime

from ml.src.lambdas.ensemble_predict import (
    EnsemblePredictionOrchestrator,
    load_input_data,
    lambda_handler
)


class TestEnsemblePredictionOrchestrator:
    """Tests for EnsemblePredictionOrchestrator."""
    
    def test_initialization(self):
        """Test orchestrator initialization."""
        orchestrator = EnsemblePredictionOrchestrator()
        
        assert orchestrator.s3_client is not None
        assert orchestrator.sagemaker_client is not None
        assert orchestrator.ensemble_manager is not None
        assert orchestrator.interval_generator is not None
    
    def test_initialization_with_clients(self):
        """Test orchestrator initialization with custom clients."""
        s3_mock = Mock()
        sagemaker_mock = Mock()
        
        orchestrator = EnsemblePredictionOrchestrator(
            s3_client=s3_mock,
            sagemaker_client=sagemaker_mock
        )
        
        assert orchestrator.s3_client is s3_mock
        assert orchestrator.sagemaker_client is sagemaker_mock
    
    @patch('ml.src.lambdas.ensemble_predict.LSTMModel')
    @patch('ml.src.lambdas.ensemble_predict.LSTMPredictor')
    def test_load_lstm_model(self, mock_predictor, mock_lstm_model):
        """Test loading LSTM model from S3."""
        s3_mock = Mock()
        orchestrator = EnsemblePredictionOrchestrator(s3_client=s3_mock)
        
        # Mock model loading
        mock_model_instance = Mock()
        mock_lstm_model.load_model.return_value = mock_model_instance
        mock_predictor_instance = Mock()
        mock_predictor.return_value = mock_predictor_instance
        
        # Load model
        model = orchestrator._load_lstm_model('test-bucket', 'v1.0')
        
        # Verify S3 download was called
        s3_mock.download_file.assert_called_once()
        assert 'test-bucket' in str(s3_mock.download_file.call_args)
        assert 'models/lstm/v1.0/model.pth' in str(s3_mock.download_file.call_args)
        
        # Verify model was loaded
        mock_lstm_model.load_model.assert_called_once()
        assert model is mock_predictor_instance
    
    @patch('ml.src.lambdas.ensemble_predict.ProphetModel')
    def test_load_prophet_model(self, mock_prophet):
        """Test loading Prophet model from S3."""
        s3_mock = Mock()
        orchestrator = EnsemblePredictionOrchestrator(s3_client=s3_mock)
        
        # Mock model
        mock_model_instance = Mock()
        mock_prophet.return_value = mock_model_instance
        
        # Load model
        model = orchestrator._load_prophet_model('test-bucket', 'v1.0')
        
        # Verify S3 download was called
        s3_mock.download_file.assert_called_once()
        assert 'models/prophet/v1.0/model.pkl' in str(s3_mock.download_file.call_args)
        
        # Verify model was loaded
        mock_model_instance.load_model.assert_called_once()
        assert model is mock_model_instance
    
    @patch('ml.src.lambdas.ensemble_predict.XGBoostModel')
    def test_load_xgboost_model(self, mock_xgboost):
        """Test loading XGBoost model from S3."""
        s3_mock = Mock()
        orchestrator = EnsemblePredictionOrchestrator(s3_client=s3_mock)
        
        # Mock model
        mock_model_instance = Mock()
        mock_xgboost.return_value = mock_model_instance
        
        # Load model
        model = orchestrator._load_xgboost_model('test-bucket', 'v1.0')
        
        # Verify S3 download was called
        s3_mock.download_file.assert_called_once()
        assert 'models/xgboost/v1.0/model.pkl' in str(s3_mock.download_file.call_args)
        
        # Verify model was loaded
        mock_model_instance.load_model.assert_called_once()
        assert model is mock_model_instance
    
    def test_load_performance_metrics_success(self):
        """Test loading performance metrics from S3."""
        s3_mock = Mock()
        orchestrator = EnsemblePredictionOrchestrator(s3_client=s3_mock)
        
        # Mock S3 list response
        s3_mock.list_objects_v2.return_value = {
            'Contents': [
                {'Key': 'metrics/daily/2024-01-01.json'},
                {'Key': 'metrics/daily/2024-01-02.json'}
            ]
        }
        
        # Mock S3 get_object responses
        metrics_data = [
            {'deepar': {'mape': 8.0}, 'lstm': {'mape': 7.5}},
            {'deepar': {'mape': 8.2}, 'lstm': {'mape': 7.8}}
        ]
        
        def get_object_side_effect(Bucket, Key):
            idx = 0 if '01-01' in Key else 1
            return {
                'Body': Mock(read=lambda: json.dumps(metrics_data[idx]).encode())
            }
        
        s3_mock.get_object.side_effect = get_object_side_effect
        
        # Load metrics
        metrics = orchestrator.load_performance_metrics('test-bucket', lookback_months=1)
        
        # Verify results
        assert 'deepar' in metrics
        assert 'lstm' in metrics
        assert len(metrics['deepar']) == 2
        assert len(metrics['lstm']) == 2
    
    def test_load_performance_metrics_no_data(self):
        """Test loading metrics when no data available."""
        s3_mock = Mock()
        orchestrator = EnsemblePredictionOrchestrator(s3_client=s3_mock)
        
        # Mock empty S3 response
        s3_mock.list_objects_v2.return_value = {}
        
        # Load metrics
        metrics = orchestrator.load_performance_metrics('test-bucket')
        
        # Should return empty dict
        assert metrics == {}
    
    def test_generate_predictions_with_metrics(self):
        """Test generating predictions with performance metrics."""
        orchestrator = EnsemblePredictionOrchestrator()
        
        # Add mock models
        model_a = Mock()
        model_a.predict.return_value = np.array([10.0, 20.0, 30.0])
        
        model_b = Mock()
        model_b.predict.return_value = np.array([12.0, 22.0, 32.0])
        
        orchestrator.ensemble_manager.add_model('model_a', model_a)
        orchestrator.ensemble_manager.add_model('model_b', model_b)
        
        # Create input data
        input_data = pd.DataFrame({'feature': [1, 2, 3]})
        
        # Performance metrics
        metrics = {
            'model_a': [8.0, 8.0, 8.0],
            'model_b': [10.0, 10.0, 10.0]
        }
        
        # Generate predictions
        result = orchestrator.generate_predictions(input_data, metrics)
        
        # Verify structure
        assert 'ensemble_prediction' in result
        assert 'lower_bounds' in result
        assert 'upper_bounds' in result
        assert 'weights' in result
        assert 'individual_predictions' in result
        
        # Verify predictions
        assert len(result['ensemble_prediction']) == 3
        assert len(result['lower_bounds']) == 3
        assert len(result['upper_bounds']) == 3
        
        # Verify weights favor model_a (better MAPE)
        assert result['weights']['model_a'] > result['weights']['model_b']
    
    def test_generate_predictions_without_metrics(self):
        """Test generating predictions without performance metrics."""
        orchestrator = EnsemblePredictionOrchestrator()
        
        # Add mock models
        model_a = Mock()
        model_a.predict.return_value = np.array([10.0, 20.0])
        
        model_b = Mock()
        model_b.predict.return_value = np.array([12.0, 22.0])
        
        orchestrator.ensemble_manager.add_model('model_a', model_a)
        orchestrator.ensemble_manager.add_model('model_b', model_b)
        
        # Create input data
        input_data = pd.DataFrame({'feature': [1, 2]})
        
        # Generate predictions without metrics
        result = orchestrator.generate_predictions(input_data)
        
        # Verify equal weights
        assert result['weights']['model_a'] == 0.5
        assert result['weights']['model_b'] == 0.5
    
    def test_save_predictions(self):
        """Test saving predictions to S3."""
        s3_mock = Mock()
        orchestrator = EnsemblePredictionOrchestrator(s3_client=s3_mock)
        
        predictions = {
            'ensemble_prediction': [10.0, 20.0],
            'lower_bounds': [9.0, 19.0],
            'upper_bounds': [11.0, 21.0],
            'weights': {'model_a': 0.6, 'model_b': 0.4}
        }
        
        stock_symbols = ['PETR4', 'VALE3']
        prediction_date = '2024-01-01'
        
        # Save predictions
        output_path = orchestrator.save_predictions(
            predictions,
            'test-bucket',
            stock_symbols,
            prediction_date
        )
        
        # Verify S3 put_object was called
        s3_mock.put_object.assert_called_once()
        call_args = s3_mock.put_object.call_args
        
        assert call_args[1]['Bucket'] == 'test-bucket'
        assert 'predictions/2024-01-01' in call_args[1]['Key']
        assert 'ensemble_predictions.json' in call_args[1]['Key']
        
        # Verify output path
        assert output_path.startswith('s3://test-bucket/')
        assert 'predictions/2024-01-01' in output_path


class TestLoadInputData:
    """Tests for load_input_data function."""
    
    @patch('ml.src.lambdas.ensemble_predict.pd.read_parquet')
    def test_load_input_data_success(self, mock_read_parquet):
        """Test loading input data from S3."""
        s3_mock = Mock()
        
        # Mock DataFrame
        mock_df = pd.DataFrame({
            'feature1': [1, 2, 3],
            'feature2': [4, 5, 6]
        })
        mock_read_parquet.return_value = mock_df
        
        # Load data
        df = load_input_data(
            s3_mock,
            'test-bucket',
            'features/2024-01-01/features.parquet'
        )
        
        # Verify S3 download was called
        s3_mock.download_file.assert_called_once()
        assert 'test-bucket' in str(s3_mock.download_file.call_args)
        assert 'features/2024-01-01/features.parquet' in str(s3_mock.download_file.call_args)
        
        # Verify DataFrame
        assert len(df) == 3
        assert len(df.columns) == 2


class TestLambdaHandler:
    """Tests for lambda_handler function."""
    
    @patch('ml.src.lambdas.ensemble_predict.load_input_data')
    @patch('ml.src.lambdas.ensemble_predict.EnsemblePredictionOrchestrator')
    def test_lambda_handler_success(self, mock_orchestrator_class, mock_load_data):
        """Test successful lambda execution."""
        # Mock orchestrator
        mock_orchestrator = Mock()
        mock_orchestrator_class.return_value = mock_orchestrator
        
        mock_orchestrator.load_performance_metrics.return_value = {
            'deepar': [8.0], 'lstm': [7.5]
        }
        
        mock_orchestrator.generate_predictions.return_value = {
            'ensemble_prediction': [10.0, 20.0],
            'lower_bounds': [9.0, 19.0],
            'upper_bounds': [11.0, 21.0],
            'weights': {'deepar': 0.5, 'lstm': 0.5}
        }
        
        mock_orchestrator.save_predictions.return_value = 's3://bucket/predictions/file.json'
        
        # Mock input data
        mock_load_data.return_value = pd.DataFrame({'feature': [1, 2]})
        
        # Create event
        event = {
            'features_bucket': 'test-bucket',
            'features_key': 'features/2024-01-01/features.parquet',
            'model_bucket': 'test-bucket',
            'model_versions': {
                'deepar': 'v1.0',
                'lstm': 'v1.0',
                'prophet': 'v1.0',
                'xgboost': 'v1.0'
            },
            'output_bucket': 'test-bucket',
            'stock_symbols': ['PETR4', 'VALE3'],
            'prediction_date': '2024-01-01'
        }
        
        # Execute lambda
        response = lambda_handler(event, None)
        
        # Verify response
        assert response['statusCode'] == 200
        body = json.loads(response['body'])
        assert body['status'] == 'success'
        assert 'output_path' in body
        assert body['num_predictions'] == 2
    
    def test_lambda_handler_missing_parameter(self):
        """Test lambda with missing required parameter."""
        event = {
            'features_bucket': 'test-bucket'
            # Missing other required parameters
        }
        
        response = lambda_handler(event, None)
        
        assert response['statusCode'] == 400
        body = json.loads(response['body'])
        assert body['status'] == 'error'
        assert 'Missing required parameter' in body['error']
    
    @patch('ml.src.lambdas.ensemble_predict.EnsemblePredictionOrchestrator')
    def test_lambda_handler_error(self, mock_orchestrator_class):
        """Test lambda with execution error."""
        # Mock orchestrator to raise error
        mock_orchestrator = Mock()
        mock_orchestrator_class.return_value = mock_orchestrator
        mock_orchestrator.load_models.side_effect = RuntimeError("Model load failed")
        
        event = {
            'features_bucket': 'test-bucket',
            'features_key': 'features/file.parquet',
            'model_bucket': 'test-bucket',
            'model_versions': {'deepar': 'v1.0'},
            'output_bucket': 'test-bucket',
            'stock_symbols': ['PETR4'],
            'prediction_date': '2024-01-01'
        }
        
        response = lambda_handler(event, None)
        
        assert response['statusCode'] == 500
        body = json.loads(response['body'])
        assert body['status'] == 'error'
