"""
Unit tests for DeepAR Model Wrapper

Tests cover:
- Model initialization
- Training data preparation
- Training job creation
- Prediction generation
- Prediction interval generation
- Error handling
"""

import json
from datetime import datetime, timedelta
from unittest.mock import MagicMock, Mock, patch

import numpy as np
import pandas as pd
import pytest
from botocore.exceptions import ClientError

from ml.src.models.deepar_model import DeepARModel


@pytest.fixture
def mock_sagemaker_client():
    """Create mock SageMaker client."""
    client = MagicMock()
    client.create_training_job.return_value = {'TrainingJobArn': 'arn:aws:sagemaker:us-east-1:123456789012:training-job/test-job'}
    client.describe_training_job.return_value = {
        'TrainingJobStatus': 'Completed',
        'TrainingJobArn': 'arn:aws:sagemaker:us-east-1:123456789012:training-job/test-job'
    }
    return client


@pytest.fixture
def mock_s3_client():
    """Create mock S3 client."""
    client = MagicMock()
    client.put_object.return_value = {'ETag': '"abc123"'}
    return client


@pytest.fixture
def mock_runtime_client():
    """Create mock SageMaker Runtime client."""
    client = MagicMock()
    return client


@pytest.fixture
def sample_train_data():
    """Create sample training data."""
    dates = pd.date_range(start='2023-01-01', periods=100, freq='D')
    data = []
    
    for stock in ['PETR4', 'VALE3']:
        for date in dates:
            data.append({
                'stock_symbol': stock,
                'date': date,
                'target': 30.0 + np.random.randn() * 2,
                'feature1': np.random.randn(),
                'feature2': np.random.randn()
            })
    
    return pd.DataFrame(data)


@pytest.fixture
def sample_input_data():
    """Create sample input data for prediction."""
    dates = pd.date_range(start='2023-01-01', periods=30, freq='D')
    data = []
    
    for stock in ['PETR4', 'VALE3']:
        for date in dates:
            data.append({
                'stock_symbol': stock,
                'date': date,
                'target': 30.0 + np.random.randn() * 2,
                'feature1': np.random.randn(),
                'feature2': np.random.randn()
            })
    
    return pd.DataFrame(data)


class TestDeepARModelInitialization:
    """Test DeepAR model initialization."""
    
    def test_init_with_default_clients(self):
        """Test initialization with default clients."""
        with patch('ml.src.models.deepar_model.boto3.client') as mock_boto3:
            model = DeepARModel(region_name='us-east-1')
            
            assert model.region_name == 'us-east-1'
            assert model.algorithm_image is not None
            # Should create 3 clients: sagemaker, s3, sagemaker-runtime
            assert mock_boto3.call_count == 3
    
    def test_init_with_custom_clients(self, mock_sagemaker_client, mock_s3_client):
        """Test initialization with custom clients."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client,
            region_name='us-west-2'
        )
        
        assert model.sagemaker_client == mock_sagemaker_client
        assert model.s3_client == mock_s3_client
        assert model.region_name == 'us-west-2'
    
    def test_get_deepar_image_uri_us_east_1(self):
        """Test DeepAR image URI for us-east-1."""
        model = DeepARModel(
            sagemaker_client=MagicMock(),
            s3_client=MagicMock(),
            region_name='us-east-1'
        )
        
        assert 'us-east-1' in model.algorithm_image
        assert 'forecasting-deepar' in model.algorithm_image
    
    def test_get_deepar_image_uri_sa_east_1(self):
        """Test DeepAR image URI for sa-east-1 (Brazil)."""
        model = DeepARModel(
            sagemaker_client=MagicMock(),
            s3_client=MagicMock(),
            region_name='sa-east-1'
        )
        
        assert 'sa-east-1' in model.algorithm_image
        assert 'forecasting-deepar' in model.algorithm_image


class TestDeepARModelTraining:
    """Test DeepAR model training functionality."""
    
    def test_train_success(self, mock_sagemaker_client, mock_s3_client, sample_train_data):
        """Test successful training job creation."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        hyperparameters = {
            'epochs': '50',
            'learning_rate': '0.001'
        }
        
        job_name = model.train(
            train_data=sample_train_data,
            hyperparameters=hyperparameters,
            role_arn='arn:aws:iam::123456789012:role/SageMakerRole',
            s3_output_path='s3://test-bucket/models/'
        )
        
        # Verify job name format
        assert job_name.startswith('deepar-training-')
        
        # Verify SageMaker API was called
        mock_sagemaker_client.create_training_job.assert_called_once()
        
        # Verify training data was uploaded to S3
        mock_s3_client.put_object.assert_called_once()
        
        # Verify hyperparameters were merged
        call_args = mock_sagemaker_client.create_training_job.call_args
        hp = call_args[1]['HyperParameters']
        assert hp['epochs'] == '50'
        assert hp['learning_rate'] == '0.001'
        assert 'context_length' in hp  # Default parameter
    
    def test_train_with_custom_job_name(self, mock_sagemaker_client, mock_s3_client, sample_train_data):
        """Test training with custom job name."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        custom_job_name = 'my-custom-job-123'
        
        job_name = model.train(
            train_data=sample_train_data,
            hyperparameters={},
            role_arn='arn:aws:iam::123456789012:role/SageMakerRole',
            s3_output_path='s3://test-bucket/models/',
            job_name=custom_job_name
        )
        
        assert job_name == custom_job_name
    
    def test_train_empty_data_raises_error(self, mock_sagemaker_client, mock_s3_client):
        """Test that empty training data raises ValueError."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        empty_data = pd.DataFrame()
        
        with pytest.raises(ValueError, match="Training data cannot be empty"):
            model.train(
                train_data=empty_data,
                hyperparameters={},
                role_arn='arn:aws:iam::123456789012:role/SageMakerRole',
                s3_output_path='s3://test-bucket/models/'
            )
    
    def test_train_missing_columns_raises_error(self, mock_sagemaker_client, mock_s3_client):
        """Test that missing required columns raises ValueError."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        # Missing 'target' column
        invalid_data = pd.DataFrame({
            'stock_symbol': ['PETR4'],
            'date': [datetime.now()]
        })
        
        with pytest.raises(ValueError, match="missing required columns"):
            model.train(
                train_data=invalid_data,
                hyperparameters={},
                role_arn='arn:aws:iam::123456789012:role/SageMakerRole',
                s3_output_path='s3://test-bucket/models/'
            )
    
    def test_train_sagemaker_error_propagates(self, mock_sagemaker_client, mock_s3_client, sample_train_data):
        """Test that SageMaker errors are propagated."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        # Simulate SageMaker error
        mock_sagemaker_client.create_training_job.side_effect = ClientError(
            {'Error': {'Code': 'ValidationException', 'Message': 'Invalid role'}},
            'CreateTrainingJob'
        )
        
        with pytest.raises(ClientError):
            model.train(
                train_data=sample_train_data,
                hyperparameters={},
                role_arn='invalid-role',
                s3_output_path='s3://test-bucket/models/'
            )


class TestDeepARModelPrediction:
    """Test DeepAR model prediction functionality."""
    
    def test_predict_success(self, mock_sagemaker_client, mock_s3_client, sample_input_data):
        """Test successful prediction."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        # Mock runtime client
        mock_response = {
            'predictions': [
                {'mean': [31.0, 31.5, 32.0, 32.5, 33.0]},
                {'mean': [45.0, 45.5, 46.0, 46.5, 47.0]}
            ]
        }
        
        model.runtime_client = MagicMock()
        model.runtime_client.invoke_endpoint.return_value = {
            'Body': Mock(read=lambda: json.dumps(mock_response).encode())
        }
        
        predictions = model.predict(
            input_data=sample_input_data,
            model_endpoint='test-endpoint',
            num_samples=100
        )
        
        # Verify predictions shape
        assert predictions.shape == (2, 5)  # 2 stocks, 5 forecast horizons
        
        # Verify predictions values
        np.testing.assert_array_almost_equal(predictions[0], [31.0, 31.5, 32.0, 32.5, 33.0])
        np.testing.assert_array_almost_equal(predictions[1], [45.0, 45.5, 46.0, 46.5, 47.0])
        
        # Verify endpoint was invoked
        model.runtime_client.invoke_endpoint.assert_called_once()
    
    def test_predict_empty_data_raises_error(self, mock_sagemaker_client, mock_s3_client):
        """Test that empty input data raises ValueError."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        empty_data = pd.DataFrame()
        
        with pytest.raises(ValueError, match="Input data cannot be empty"):
            model.predict(
                input_data=empty_data,
                model_endpoint='test-endpoint'
            )
    
    def test_predict_missing_columns_raises_error(self, mock_sagemaker_client, mock_s3_client):
        """Test that missing required columns raises ValueError."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        # Missing 'target' column
        invalid_data = pd.DataFrame({
            'stock_symbol': ['PETR4'],
            'date': [datetime.now()]
        })
        
        with pytest.raises(ValueError, match="missing required columns"):
            model.predict(
                input_data=invalid_data,
                model_endpoint='test-endpoint'
            )


class TestDeepARModelPredictionIntervals:
    """Test DeepAR model prediction interval functionality."""
    
    def test_get_prediction_intervals_success(self, mock_sagemaker_client, mock_s3_client, sample_input_data):
        """Test successful prediction interval generation."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        # Mock runtime client
        mock_response = {
            'predictions': [
                {
                    'mean': [31.0, 31.5, 32.0],
                    'quantiles': {
                        '0.1': [29.0, 29.5, 30.0],
                        '0.5': [31.0, 31.5, 32.0],
                        '0.9': [33.0, 33.5, 34.0]
                    }
                },
                {
                    'mean': [45.0, 45.5, 46.0],
                    'quantiles': {
                        '0.1': [43.0, 43.5, 44.0],
                        '0.5': [45.0, 45.5, 46.0],
                        '0.9': [47.0, 47.5, 48.0]
                    }
                }
            ]
        }
        
        model.runtime_client = MagicMock()
        model.runtime_client.invoke_endpoint.return_value = {
            'Body': Mock(read=lambda: json.dumps(mock_response).encode())
        }
        
        intervals = model.get_prediction_intervals(
            input_data=sample_input_data,
            model_endpoint='test-endpoint',
            quantiles=[0.1, 0.5, 0.9]
        )
        
        # Verify DataFrame structure
        assert isinstance(intervals, pd.DataFrame)
        assert len(intervals) == 6  # 2 stocks * 3 horizons
        
        # Verify columns
        expected_columns = ['stock_symbol', 'horizon', 'mean', 'q_0.1', 'q_0.5', 'q_0.9']
        assert all(col in intervals.columns for col in expected_columns)
        
        # Verify stock symbols
        assert set(intervals['stock_symbol'].unique()) == {'PETR4', 'VALE3'}
        
        # Verify horizons
        assert set(intervals['horizon'].unique()) == {1, 2, 3}
        
        # Verify values for first stock, first horizon
        first_row = intervals[(intervals['stock_symbol'] == 'PETR4') & (intervals['horizon'] == 1)].iloc[0]
        assert first_row['mean'] == 31.0
        assert first_row['q_0.1'] == 29.0
        assert first_row['q_0.5'] == 31.0
        assert first_row['q_0.9'] == 33.0
    
    def test_get_prediction_intervals_default_quantiles(self, mock_sagemaker_client, mock_s3_client, sample_input_data):
        """Test prediction intervals with default quantiles."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        # Mock runtime client
        mock_response = {
            'predictions': [
                {
                    'mean': [31.0],
                    'quantiles': {
                        '0.025': [28.0],
                        '0.1': [29.0],
                        '0.5': [31.0],
                        '0.9': [33.0],
                        '0.975': [34.0]
                    }
                }
            ]
        }
        
        model.runtime_client = MagicMock()
        model.runtime_client.invoke_endpoint.return_value = {
            'Body': Mock(read=lambda: json.dumps(mock_response).encode())
        }
        
        # Call without specifying quantiles
        intervals = model.get_prediction_intervals(
            input_data=sample_input_data.head(30),  # Single stock
            model_endpoint='test-endpoint'
        )
        
        # Verify default quantiles are used
        assert 'q_0.025' in intervals.columns
        assert 'q_0.975' in intervals.columns
    
    def test_get_prediction_intervals_empty_data_raises_error(self, mock_sagemaker_client, mock_s3_client):
        """Test that empty input data raises ValueError."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        empty_data = pd.DataFrame()
        
        with pytest.raises(ValueError, match="Input data cannot be empty"):
            model.get_prediction_intervals(
                input_data=empty_data,
                model_endpoint='test-endpoint'
            )


class TestDeepARModelTrainingDataPreparation:
    """Test training data preparation."""
    
    def test_prepare_training_data_format(self, mock_sagemaker_client, mock_s3_client, sample_train_data):
        """Test that training data is formatted correctly."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        s3_path = model._prepare_training_data(
            train_data=sample_train_data,
            s3_output_path='s3://test-bucket/models/',
            job_name='test-job'
        )
        
        # Verify S3 path format
        assert s3_path == 's3://test-bucket/models/training-data/test-job/'
        
        # Verify S3 upload was called
        mock_s3_client.put_object.assert_called_once()
        
        # Verify uploaded data format
        call_args = mock_s3_client.put_object.call_args
        uploaded_data = call_args[1]['Body'].decode('utf-8')
        
        # Parse JSON Lines
        lines = uploaded_data.strip().split('\n')
        assert len(lines) == 2  # 2 stocks
        
        # Verify each line is valid JSON
        for line in lines:
            ts_entry = json.loads(line)
            assert 'start' in ts_entry
            assert 'target' in ts_entry
            assert isinstance(ts_entry['target'], list)
            assert len(ts_entry['target']) == 100  # 100 days per stock
    
    def test_prepare_training_data_with_features(self, mock_sagemaker_client, mock_s3_client, sample_train_data):
        """Test that dynamic features are included."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        model._prepare_training_data(
            train_data=sample_train_data,
            s3_output_path='s3://test-bucket/models/',
            job_name='test-job'
        )
        
        # Get uploaded data
        call_args = mock_s3_client.put_object.call_args
        uploaded_data = call_args[1]['Body'].decode('utf-8')
        
        # Parse first line
        first_line = uploaded_data.strip().split('\n')[0]
        ts_entry = json.loads(first_line)
        
        # Verify dynamic features are present
        assert 'dynamic_feat' in ts_entry
        assert len(ts_entry['dynamic_feat']) == 2  # feature1 and feature2


class TestDeepARModelWaitForTraining:
    """Test waiting for training job completion."""
    
    def test_wait_for_training_job_success(self, mock_sagemaker_client, mock_s3_client):
        """Test successful wait for training job."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        # Mock completed job
        mock_sagemaker_client.describe_training_job.return_value = {
            'TrainingJobStatus': 'Completed',
            'TrainingJobArn': 'arn:aws:sagemaker:us-east-1:123456789012:training-job/test-job'
        }
        
        result = model.wait_for_training_job('test-job', poll_interval=0)
        
        assert result['TrainingJobStatus'] == 'Completed'
    
    def test_wait_for_training_job_failure(self, mock_sagemaker_client, mock_s3_client):
        """Test handling of failed training job."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        # Mock failed job
        mock_sagemaker_client.describe_training_job.return_value = {
            'TrainingJobStatus': 'Failed',
            'FailureReason': 'Out of memory'
        }
        
        with pytest.raises(RuntimeError, match="Training job failed: Out of memory"):
            model.wait_for_training_job('test-job', poll_interval=0)
    
    def test_wait_for_training_job_stopped(self, mock_sagemaker_client, mock_s3_client):
        """Test handling of stopped training job."""
        model = DeepARModel(
            sagemaker_client=mock_sagemaker_client,
            s3_client=mock_s3_client
        )
        
        # Mock stopped job
        mock_sagemaker_client.describe_training_job.return_value = {
            'TrainingJobStatus': 'Stopped'
        }
        
        with pytest.raises(RuntimeError, match="Training job was stopped"):
            model.wait_for_training_job('test-job', poll_interval=0)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
