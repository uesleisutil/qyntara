"""
Tests for Model Training Orchestrator Lambda

Tests cover:
- Loading hyperparameters from S3
- Training individual models (DeepAR, LSTM, Prophet, XGBoost)
- Model versioning
- Metrics calculation and saving
- Sequential and parallel training
- Error handling
"""

import json
import tempfile
from datetime import datetime, timedelta
from unittest.mock import MagicMock, Mock, patch, call

import numpy as np
import pandas as pd
import pytest

from src.lambdas.train_models import (
    ModelTrainingOrchestrator,
    load_training_data,
    lambda_handler
)


@pytest.fixture
def sample_training_data():
    """Create sample training data."""
    dates = pd.date_range(start='2023-01-01', end='2024-01-01', freq='D')
    n_samples = len(dates)
    
    data = pd.DataFrame({
        'date': dates,
        'stock_symbol': ['PETR4'] * n_samples,
        'target': np.random.randn(n_samples).cumsum() + 100,
        'feature_1': np.random.randn(n_samples),
        'feature_2': np.random.randn(n_samples),
        'feature_3': np.random.randn(n_samples)
    })
    
    return data


@pytest.fixture
def mock_s3_client():
    """Create mock S3 client."""
    with patch('src.lambdas.train_models.s3') as mock_s3:
        yield mock_s3


@pytest.fixture
def orchestrator(mock_s3_client):
    """Create orchestrator instance."""
    return ModelTrainingOrchestrator(
        output_bucket='test-bucket',
        random_state=42
    )


class TestModelTrainingOrchestrator:
    """Tests for ModelTrainingOrchestrator class."""
    
    def test_initialization(self, orchestrator):
        """Test orchestrator initialization."""
        assert orchestrator.output_bucket == 'test-bucket'
        assert orchestrator.random_state == 42
        assert orchestrator.validator is not None
        assert orchestrator.validator.train_window_months == 12
        assert orchestrator.validator.test_window_months == 1
        assert orchestrator.validator.step_months == 1
    
    def test_load_hyperparameters_success(self, orchestrator, mock_s3_client):
        """Test loading hyperparameters from S3."""
        # Mock S3 response
        hyperparams = {
            'best_params': {
                'learning_rate': 0.001,
                'hidden_size': 128
            }
        }
        
        mock_s3_client.get_object.return_value = {
            'Body': Mock(read=lambda: json.dumps(hyperparams).encode('utf-8'))
        }
        
        # Load hyperparameters
        result = orchestrator.load_hyperparameters('lstm')
        
        # Verify
        assert result == {'learning_rate': 0.001, 'hidden_size': 128}
        mock_s3_client.get_object.assert_called_once_with(
            Bucket='test-bucket',
            Key='hyperparameters/lstm/best_params.json'
        )
    
    def test_load_hyperparameters_failure(self, orchestrator, mock_s3_client):
        """Test loading hyperparameters when file doesn't exist."""
        # Mock S3 error
        mock_s3_client.get_object.side_effect = Exception("File not found")
        
        # Load hyperparameters (should return empty dict)
        result = orchestrator.load_hyperparameters('lstm')
        
        # Verify
        assert result == {}
    
    def test_get_next_version_no_existing(self, orchestrator, mock_s3_client):
        """Test getting next version when no versions exist."""
        # Mock S3 response with no versions
        mock_s3_client.list_objects_v2.return_value = {
            'CommonPrefixes': []
        }
        
        # Get next version
        version = orchestrator.get_next_version('lstm')
        
        # Verify
        assert version == 'v1'
    
    def test_get_next_version_with_existing(self, orchestrator, mock_s3_client):
        """Test getting next version when versions exist."""
        # Mock S3 response with existing versions
        mock_s3_client.list_objects_v2.return_value = {
            'CommonPrefixes': [
                {'Prefix': 'models/lstm/v1/'},
                {'Prefix': 'models/lstm/v2/'},
                {'Prefix': 'models/lstm/v3/'}
            ]
        }
        
        # Get next version
        version = orchestrator.get_next_version('lstm')
        
        # Verify
        assert version == 'v4'
    
    def test_get_next_version_error(self, orchestrator, mock_s3_client):
        """Test getting next version when S3 error occurs."""
        # Mock S3 error
        mock_s3_client.list_objects_v2.side_effect = Exception("S3 error")
        
        # Get next version (should return default)
        version = orchestrator.get_next_version('lstm')
        
        # Verify
        assert version == 'v1'
    
    def test_calculate_metrics_basic(self, orchestrator):
        """Test basic metrics calculation."""
        y_true = np.array([100, 110, 120, 130, 140])
        y_pred = np.array([98, 112, 118, 132, 138])
        
        metrics = orchestrator.calculate_metrics(y_true, y_pred)
        
        # Verify metrics exist
        assert 'mape' in metrics
        assert 'mae' in metrics
        assert 'rmse' in metrics
        assert metrics['mape'] > 0
        assert metrics['mae'] > 0
        assert metrics['rmse'] > 0
    
    def test_calculate_metrics_with_coverage(self, orchestrator):
        """Test metrics calculation with prediction intervals."""
        y_true = np.array([100, 110, 120, 130, 140])
        y_pred = np.array([98, 112, 118, 132, 138])
        lower_bound = np.array([95, 105, 115, 125, 135])
        upper_bound = np.array([105, 115, 125, 135, 145])
        
        metrics = orchestrator.calculate_metrics(
            y_true, y_pred, lower_bound, upper_bound
        )
        
        # Verify coverage is calculated
        assert 'coverage' in metrics
        assert 0 <= metrics['coverage'] <= 100
    
    def test_calculate_metrics_with_nan(self, orchestrator):
        """Test metrics calculation with NaN values."""
        y_true = np.array([100, np.nan, 120, 130, 140])
        y_pred = np.array([98, 112, 118, np.nan, 138])
        
        metrics = orchestrator.calculate_metrics(y_true, y_pred)
        
        # Verify metrics are calculated (NaN values should be filtered)
        assert 'mape' in metrics
        assert np.isfinite(metrics['mape'])
    
    def test_calculate_metrics_all_nan(self, orchestrator):
        """Test metrics calculation when all values are NaN."""
        y_true = np.array([np.nan, np.nan, np.nan])
        y_pred = np.array([np.nan, np.nan, np.nan])
        
        metrics = orchestrator.calculate_metrics(y_true, y_pred)
        
        # Verify metrics handle empty case
        assert metrics['mape'] == float('inf')
        assert metrics['mae'] == float('inf')
        assert metrics['rmse'] == float('inf')
    
    def test_save_metrics(self, orchestrator, mock_s3_client):
        """Test saving metrics to S3."""
        metrics = {
            'mape': 7.5,
            'mae': 0.4,
            'rmse': 0.6,
            'coverage': 91.2
        }
        
        # Save metrics
        s3_path = orchestrator.save_metrics('lstm', 'v1', metrics)
        
        # Verify
        assert s3_path == 's3://test-bucket/models/lstm/v1/metrics.json'
        mock_s3_client.put_object.assert_called_once()
        
        # Verify call arguments
        call_args = mock_s3_client.put_object.call_args
        assert call_args[1]['Bucket'] == 'test-bucket'
        assert call_args[1]['Key'] == 'models/lstm/v1/metrics.json'
        assert call_args[1]['ContentType'] == 'application/json'
        
        # Verify JSON content
        body = call_args[1]['Body']
        data = json.loads(body)
        assert data['model_type'] == 'lstm'
        assert data['version'] == 'v1'
        assert data['metrics'] == metrics
    
    def test_train_deepar(self, orchestrator, sample_training_data, mock_s3_client):
        """Test DeepAR training."""
        # Mock version
        mock_s3_client.list_objects_v2.return_value = {'CommonPrefixes': []}
        
        # Train DeepAR
        model_path, metrics = orchestrator.train_deepar(
            sample_training_data,
            hyperparameters={}
        )
        
        # Verify
        assert 's3://test-bucket/models/deepar/v1/' in model_path
        assert 'mape' in metrics
        assert 'mae' in metrics
        assert 'rmse' in metrics
        assert 'coverage' in metrics
    
    def test_train_lstm(self, orchestrator, sample_training_data, mock_s3_client):
        """Test LSTM training."""
        # Mock version and S3 upload
        mock_s3_client.list_objects_v2.return_value = {'CommonPrefixes': []}
        mock_s3_client.upload_file.return_value = None
        
        # Train LSTM
        hyperparameters = {
            'hidden_size': 64,
            'num_layers': 2,
            'dropout': 0.2,
            'sequence_length': 10
        }
        
        model_path, metrics = orchestrator.train_lstm(
            sample_training_data,
            hyperparameters=hyperparameters
        )
        
        # Verify
        assert 's3://test-bucket/models/lstm/v1/' in model_path
        assert 'mape' in metrics
        assert 'mae' in metrics
        assert 'rmse' in metrics
        mock_s3_client.upload_file.assert_called_once()
    
    def test_train_prophet(self, orchestrator, sample_training_data, mock_s3_client):
        """Test Prophet training."""
        # Mock version and S3 upload
        mock_s3_client.list_objects_v2.return_value = {'CommonPrefixes': []}
        mock_s3_client.upload_file.return_value = None
        
        # Train Prophet
        hyperparameters = {
            'changepoint_prior_scale': 0.05,
            'seasonality_prior_scale': 10.0
        }
        
        model_path, metrics = orchestrator.train_prophet(
            sample_training_data,
            hyperparameters=hyperparameters
        )
        
        # Verify
        assert 's3://test-bucket/models/prophet/v1/' in model_path
        assert 'mape' in metrics
        assert 'mae' in metrics
        assert 'rmse' in metrics
        mock_s3_client.upload_file.assert_called_once()
    
    def test_train_xgboost(self, orchestrator, sample_training_data, mock_s3_client):
        """Test XGBoost training."""
        # Mock version and S3 upload
        mock_s3_client.list_objects_v2.return_value = {'CommonPrefixes': []}
        mock_s3_client.upload_file.return_value = None
        
        # Train XGBoost
        hyperparameters = {
            'max_depth': 6,
            'learning_rate': 0.1,
            'n_estimators': 50
        }
        
        model_path, metrics = orchestrator.train_xgboost(
            sample_training_data,
            hyperparameters=hyperparameters
        )
        
        # Verify
        assert 's3://test-bucket/models/xgboost/v1/' in model_path
        assert 'mape' in metrics
        assert 'mae' in metrics
        assert 'rmse' in metrics
        mock_s3_client.upload_file.assert_called_once()
    
    def test_train_model_invalid_type(self, orchestrator, sample_training_data):
        """Test training with invalid model type."""
        with pytest.raises(ValueError, match="Invalid model_type"):
            orchestrator.train_model('invalid_model', sample_training_data)
    
    def test_train_model_lstm(self, orchestrator, sample_training_data, mock_s3_client):
        """Test train_model method for LSTM."""
        # Mock S3 operations
        mock_s3_client.get_object.return_value = {
            'Body': Mock(read=lambda: json.dumps({'best_params': {}}).encode('utf-8'))
        }
        mock_s3_client.list_objects_v2.return_value = {'CommonPrefixes': []}
        mock_s3_client.upload_file.return_value = None
        mock_s3_client.put_object.return_value = None
        
        # Train model
        result = orchestrator.train_model('lstm', sample_training_data)
        
        # Verify
        assert result['model_type'] == 'lstm'
        assert 'model_path' in result
        assert 'metrics' in result
        assert 'metrics_path' in result
        assert 'version' in result
        assert 'training_time_seconds' in result
        assert result['metrics']['mape'] > 0
    
    def test_train_all_models_sequential(self, orchestrator, sample_training_data, mock_s3_client):
        """Test training all models sequentially."""
        # Mock S3 operations
        mock_s3_client.get_object.return_value = {
            'Body': Mock(read=lambda: json.dumps({'best_params': {}}).encode('utf-8'))
        }
        mock_s3_client.list_objects_v2.return_value = {'CommonPrefixes': []}
        mock_s3_client.upload_file.return_value = None
        mock_s3_client.put_object.return_value = None
        
        # Train all models
        models_to_train = ['lstm', 'prophet', 'xgboost']
        results = orchestrator.train_all_models(
            sample_training_data,
            models_to_train,
            parallel=False
        )
        
        # Verify
        assert results['models_trained'] == 3
        assert len(results['results']) == 3
        
        # Check each model
        model_types = [r['model_type'] for r in results['results']]
        assert 'lstm' in model_types
        assert 'prophet' in model_types
        assert 'xgboost' in model_types
    
    def test_train_all_models_parallel(self, orchestrator, sample_training_data, mock_s3_client):
        """Test training all models in parallel."""
        # Mock S3 operations
        mock_s3_client.get_object.return_value = {
            'Body': Mock(read=lambda: json.dumps({'best_params': {}}).encode('utf-8'))
        }
        mock_s3_client.list_objects_v2.return_value = {'CommonPrefixes': []}
        mock_s3_client.upload_file.return_value = None
        mock_s3_client.put_object.return_value = None
        
        # Train all models in parallel
        models_to_train = ['lstm', 'prophet']
        results = orchestrator.train_all_models(
            sample_training_data,
            models_to_train,
            parallel=True
        )
        
        # Verify
        assert results['models_trained'] == 2
        assert len(results['results']) == 2
    
    def test_train_all_models_with_error(self, orchestrator, sample_training_data, mock_s3_client):
        """Test training all models when one fails."""
        # Mock S3 operations
        mock_s3_client.get_object.return_value = {
            'Body': Mock(read=lambda: json.dumps({'best_params': {}}).encode('utf-8'))
        }
        mock_s3_client.list_objects_v2.return_value = {'CommonPrefixes': []}
        mock_s3_client.upload_file.side_effect = Exception("Upload failed")
        mock_s3_client.put_object.return_value = None
        
        # Train all models (some will fail)
        models_to_train = ['lstm', 'prophet']
        results = orchestrator.train_all_models(
            sample_training_data,
            models_to_train,
            parallel=False
        )
        
        # Verify (some models may have errors)
        assert len(results['results']) == 2
        # At least one should have an error
        errors = [r for r in results['results'] if 'error' in r]
        assert len(errors) > 0


class TestLoadTrainingData:
    """Tests for load_training_data function."""
    
    def test_load_training_data(self, mock_s3_client):
        """Test loading training data from S3."""
        # Create sample CSV data
        csv_data = "date,target,feature_1\n2023-01-01,100,1.5\n2023-01-02,110,2.0"
        
        # Mock S3 response with proper file-like object
        import io
        mock_body = io.BytesIO(csv_data.encode('utf-8'))
        mock_s3_client.get_object.return_value = {
            'Body': mock_body
        }
        
        # Load data
        data = load_training_data('test-bucket', 'features/data.csv')
        
        # Verify
        assert len(data) == 2
        assert 'date' in data.columns
        assert 'target' in data.columns
        assert 'feature_1' in data.columns
        assert pd.api.types.is_datetime64_any_dtype(data['date'])
        
        mock_s3_client.get_object.assert_called_once_with(
            Bucket='test-bucket',
            Key='features/data.csv'
        )


class TestLambdaHandler:
    """Tests for lambda_handler function."""
    
    def test_lambda_handler_success(self, mock_s3_client):
        """Test successful Lambda execution."""
        # Create sample CSV data with valid dates
        csv_data = "date,target,feature_1,feature_2\n"
        for i in range(30):  # Use 30 days instead of 100
            csv_data += f"2023-01-{i+1:02d},100,1.5,2.0\n"
        
        # Mock S3 operations with proper file-like object
        import io
        mock_body = io.BytesIO(csv_data.encode('utf-8'))
        mock_s3_client.get_object.return_value = {
            'Body': mock_body
        }
        mock_s3_client.list_objects_v2.return_value = {'CommonPrefixes': []}
        mock_s3_client.upload_file.return_value = None
        mock_s3_client.put_object.return_value = None
        
        # Create event
        event = {
            'features_s3_path': 's3://test-bucket/features/data.csv',
            'output_bucket': 'output-bucket',
            'models_to_train': ['lstm', 'prophet'],
            'target_column': 'target',
            'parallel': False
        }
        
        # Execute Lambda
        response = lambda_handler(event, None)
        
        # Verify
        assert response['status'] == 'success'
        assert response['models_trained'] >= 0
        assert 'model_artifacts' in response
        assert 'validation_metrics' in response
        assert 'total_time_seconds' in response
    
    def test_lambda_handler_missing_features_path(self):
        """Test Lambda with missing features_s3_path."""
        event = {
            'output_bucket': 'output-bucket'
        }
        
        response = lambda_handler(event, None)
        
        assert response['status'] == 'error'
        assert 'features_s3_path is required' in response['message']
    
    def test_lambda_handler_missing_output_bucket(self):
        """Test Lambda with missing output_bucket."""
        event = {
            'features_s3_path': 's3://test-bucket/features/data.csv'
        }
        
        response = lambda_handler(event, None)
        
        assert response['status'] == 'error'
        assert 'output_bucket is required' in response['message']
    
    def test_lambda_handler_with_error(self, mock_s3_client):
        """Test Lambda execution with error."""
        # Mock S3 error
        mock_s3_client.get_object.side_effect = Exception("S3 error")
        
        # Create event
        event = {
            'features_s3_path': 's3://test-bucket/features/data.csv',
            'output_bucket': 'output-bucket',
            'models_to_train': ['lstm']
        }
        
        # Execute Lambda
        response = lambda_handler(event, None)
        
        # Verify
        assert response['status'] == 'error'
        assert 'message' in response
    
    def test_lambda_handler_default_models(self, mock_s3_client):
        """Test Lambda with default models_to_train."""
        # Create sample CSV data
        csv_data = "date,target,feature_1\n2023-01-01,100,1.5\n2023-01-02,110,2.0"
        
        # Mock S3 operations with proper file-like object
        import io
        mock_body = io.BytesIO(csv_data.encode('utf-8'))
        mock_s3_client.get_object.return_value = {
            'Body': mock_body
        }
        mock_s3_client.list_objects_v2.return_value = {'CommonPrefixes': []}
        mock_s3_client.upload_file.return_value = None
        mock_s3_client.put_object.return_value = None
        
        # Create event without models_to_train
        event = {
            'features_s3_path': 's3://test-bucket/features/data.csv',
            'output_bucket': 'output-bucket'
        }
        
        # Execute Lambda
        response = lambda_handler(event, None)
        
        # Verify (should use default: all 4 models)
        assert response['status'] == 'success'
    
    def test_lambda_handler_parallel_training(self, mock_s3_client):
        """Test Lambda with parallel training enabled."""
        # Create sample CSV data with valid dates
        csv_data = "date,target,feature_1\n"
        for i in range(30):  # Use 30 days instead of 50
            csv_data += f"2023-01-{i+1:02d},100,1.5\n"
        
        # Mock S3 operations with proper file-like object
        import io
        mock_body = io.BytesIO(csv_data.encode('utf-8'))
        mock_s3_client.get_object.return_value = {
            'Body': mock_body
        }
        mock_s3_client.list_objects_v2.return_value = {'CommonPrefixes': []}
        mock_s3_client.upload_file.return_value = None
        mock_s3_client.put_object.return_value = None
        
        # Create event with parallel=True
        event = {
            'features_s3_path': 's3://test-bucket/features/data.csv',
            'output_bucket': 'output-bucket',
            'models_to_train': ['lstm', 'prophet'],
            'parallel': True
        }
        
        # Execute Lambda
        response = lambda_handler(event, None)
        
        # Verify
        assert response['status'] == 'success'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
