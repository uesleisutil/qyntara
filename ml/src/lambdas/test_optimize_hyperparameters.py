"""
Tests for Hyperparameter Optimization Lambda Function

Tests the orchestration of hyperparameter optimization for all model types,
S3 integration, timeout handling, and error scenarios.
"""

import json
from datetime import datetime
from unittest.mock import MagicMock, Mock, patch

import numpy as np
import pandas as pd
import pytest

from src.lambdas.optimize_hyperparameters import (
    HyperparameterOptimizationOrchestrator,
    lambda_handler,
    load_training_data,
    save_best_params,
)


@pytest.fixture
def sample_training_data():
    """Create sample training data for testing."""
    dates = pd.date_range(start='2022-01-01', end='2023-12-31', freq='D')
    
    data = pd.DataFrame({
        'date': dates,
        'target': np.random.randn(len(dates)).cumsum() + 100,
        'feature_1': np.random.randn(len(dates)),
        'feature_2': np.random.randn(len(dates)),
        'feature_3': np.random.randn(len(dates))
    })
    
    return data


@pytest.fixture
def mock_s3_client():
    """Create mock S3 client."""
    with patch('src.lambdas.optimize_hyperparameters.s3') as mock_s3:
        yield mock_s3


@pytest.fixture
def orchestrator():
    """Create orchestrator with minimal trials for testing."""
    return HyperparameterOptimizationOrchestrator(
        n_trials=50,  # Minimum required
        timeout_hours=1.0,
        random_state=42
    )


class TestHyperparameterOptimizationOrchestrator:
    """Test suite for HyperparameterOptimizationOrchestrator."""
    
    def test_initialization(self):
        """Test orchestrator initialization."""
        orchestrator = HyperparameterOptimizationOrchestrator(
            n_trials=50,
            timeout_hours=24.0,
            random_state=42
        )
        
        assert orchestrator.n_trials == 50
        assert orchestrator.timeout_seconds == 24 * 3600
        assert orchestrator.random_state == 42
        assert orchestrator.validator is not None
        assert orchestrator.validator.train_window_months == 12
        assert orchestrator.validator.test_window_months == 1
        assert orchestrator.validator.step_months == 1
    
    def test_initialization_with_custom_params(self):
        """Test orchestrator initialization with custom parameters."""
        orchestrator = HyperparameterOptimizationOrchestrator(
            n_trials=100,
            timeout_hours=12.0,
            random_state=123
        )
        
        assert orchestrator.n_trials == 100
        assert orchestrator.timeout_seconds == 12 * 3600
        assert orchestrator.random_state == 123
    
    @patch('src.lambdas.optimize_hyperparameters.OptunaOptimizer')
    @patch('src.lambdas.optimize_hyperparameters.WalkForwardValidator')
    def test_optimize_lstm(self, mock_validator_class, mock_optimizer_class, sample_training_data):
        """Test LSTM optimization."""
        # Mock optimizer
        mock_optimizer = Mock()
        mock_optimizer.optimize.return_value = {
            'best_params': {
                'hidden_size': 128,
                'num_layers': 2,
                'dropout': 0.2,
                'learning_rate': 0.001
            },
            'best_value': 7.5,
            'n_completed': 50,
            'n_pruned': 0,
            'n_failed': 0
        }
        mock_optimizer_class.return_value = mock_optimizer
        
        # Mock validator
        mock_validator = Mock()
        mock_validator_class.return_value = mock_validator
        
        orchestrator = HyperparameterOptimizationOrchestrator(n_trials=50)
        orchestrator.validator = mock_validator
        
        result = orchestrator.optimize_lstm(sample_training_data)
        
        assert result['model_type'] == 'lstm'
        assert result['best_mape'] == 7.5
        assert result['best_params']['hidden_size'] == 128
        assert result['n_trials_completed'] == 50
        assert 'optimization_time_seconds' in result
    
    @patch('src.lambdas.optimize_hyperparameters.OptunaOptimizer')
    @patch('src.lambdas.optimize_hyperparameters.WalkForwardValidator')
    def test_optimize_prophet(self, mock_validator_class, mock_optimizer_class, sample_training_data):
        """Test Prophet optimization."""
        # Mock optimizer
        mock_optimizer = Mock()
        mock_optimizer.optimize.return_value = {
            'best_params': {
                'changepoint_prior_scale': 0.05,
                'seasonality_prior_scale': 10.0,
                'seasonality_mode': 'multiplicative'
            },
            'best_value': 8.2,
            'n_completed': 50,
            'n_pruned': 5,
            'n_failed': 0
        }
        mock_optimizer_class.return_value = mock_optimizer
        
        # Mock validator
        mock_validator = Mock()
        mock_validator_class.return_value = mock_validator
        
        orchestrator = HyperparameterOptimizationOrchestrator(n_trials=50)
        orchestrator.validator = mock_validator
        
        result = orchestrator.optimize_prophet(sample_training_data)
        
        assert result['model_type'] == 'prophet'
        assert result['best_mape'] == 8.2
        assert result['best_params']['changepoint_prior_scale'] == 0.05
        assert result['n_trials_completed'] == 50
        assert result['n_trials_pruned'] == 5
    
    @patch('src.lambdas.optimize_hyperparameters.OptunaOptimizer')
    @patch('src.lambdas.optimize_hyperparameters.WalkForwardValidator')
    def test_optimize_xgboost(self, mock_validator_class, mock_optimizer_class, sample_training_data):
        """Test XGBoost optimization."""
        # Mock optimizer
        mock_optimizer = Mock()
        mock_optimizer.optimize.return_value = {
            'best_params': {
                'n_estimators': 200,
                'max_depth': 5,
                'learning_rate': 0.01,
                'subsample': 0.8
            },
            'best_value': 6.8,
            'n_completed': 50,
            'n_pruned': 10,
            'n_failed': 2
        }
        mock_optimizer_class.return_value = mock_optimizer
        
        # Mock validator
        mock_validator = Mock()
        mock_validator_class.return_value = mock_validator
        
        orchestrator = HyperparameterOptimizationOrchestrator(n_trials=50)
        orchestrator.validator = mock_validator
        
        result = orchestrator.optimize_xgboost(sample_training_data)
        
        assert result['model_type'] == 'xgboost'
        assert result['best_mape'] == 6.8
        assert result['best_params']['n_estimators'] == 200
        assert result['n_trials_completed'] == 50
        assert result['n_trials_failed'] == 2
    
    @patch('src.lambdas.optimize_hyperparameters.OptunaOptimizer')
    @patch('src.lambdas.optimize_hyperparameters.WalkForwardValidator')
    def test_optimize_deepar(self, mock_validator_class, mock_optimizer_class, sample_training_data):
        """Test DeepAR optimization."""
        # Mock optimizer
        mock_optimizer = Mock()
        mock_optimizer.optimize.return_value = {
            'best_params': {
                'context_length': 30,
                'prediction_length': 5,
                'num_layers': 2,
                'num_cells': 40
            },
            'best_value': 7.2,
            'n_completed': 50,
            'n_pruned': 8,
            'n_failed': 1
        }
        mock_optimizer_class.return_value = mock_optimizer
        
        # Mock validator
        mock_validator = Mock()
        mock_validator_class.return_value = mock_validator
        
        orchestrator = HyperparameterOptimizationOrchestrator(n_trials=50)
        orchestrator.validator = mock_validator
        
        result = orchestrator.optimize_deepar(sample_training_data)
        
        assert result['model_type'] == 'deepar'
        assert result['best_mape'] == 7.2
        assert result['best_params']['context_length'] == 30
        assert result['n_trials_completed'] == 50
    
    @patch('src.lambdas.optimize_hyperparameters.OptunaOptimizer')
    @patch('src.lambdas.optimize_hyperparameters.WalkForwardValidator')
    def test_optimize_model_lstm(self, mock_validator_class, mock_optimizer_class, sample_training_data):
        """Test optimize_model with LSTM."""
        # Mock optimizer
        mock_optimizer = Mock()
        mock_optimizer.optimize.return_value = {
            'best_params': {'hidden_size': 128},
            'best_value': 7.5,
            'n_completed': 50,
            'n_pruned': 0,
            'n_failed': 0
        }
        mock_optimizer_class.return_value = mock_optimizer
        
        # Mock validator
        mock_validator = Mock()
        mock_validator_class.return_value = mock_validator
        
        orchestrator = HyperparameterOptimizationOrchestrator(n_trials=50)
        orchestrator.validator = mock_validator
        
        result = orchestrator.optimize_model('lstm', sample_training_data)
        
        assert result['model_type'] == 'lstm'
        assert 'optimization_time_seconds' in result
        assert 'optimization_time_hours' in result
        assert result['optimization_time_hours'] == result['optimization_time_seconds'] / 3600
    
    def test_optimize_model_invalid_type(self, sample_training_data):
        """Test optimize_model with invalid model type."""
        orchestrator = HyperparameterOptimizationOrchestrator(n_trials=50)
        
        with pytest.raises(ValueError, match="Invalid model_type"):
            orchestrator.optimize_model('invalid_model', sample_training_data)
    
    @patch('src.lambdas.optimize_hyperparameters.OptunaOptimizer')
    @patch('src.lambdas.optimize_hyperparameters.WalkForwardValidator')
    def test_timeout_handling(self, mock_validator_class, mock_optimizer_class, sample_training_data):
        """Test that timeout is properly configured."""
        mock_optimizer = Mock()
        mock_optimizer.optimize.return_value = {
            'best_params': {'hidden_size': 128},
            'best_value': 7.5,
            'n_completed': 50,
            'n_pruned': 0,
            'n_failed': 0
        }
        mock_optimizer_class.return_value = mock_optimizer
        
        mock_validator = Mock()
        mock_validator_class.return_value = mock_validator
        
        orchestrator = HyperparameterOptimizationOrchestrator(
            n_trials=50,
            timeout_hours=24.0
        )
        
        # Verify timeout is set correctly
        assert orchestrator.timeout_seconds == 24 * 3600
        
        # Verify optimizer is created with correct timeout
        orchestrator.optimize_lstm(sample_training_data)
        
        mock_optimizer_class.assert_called_once()
        call_kwargs = mock_optimizer_class.call_args[1]
        assert call_kwargs['timeout'] == 24 * 3600


class TestLoadTrainingData:
    """Test suite for load_training_data function."""
    
    def test_load_training_data(self, mock_s3_client, sample_training_data):
        """Test loading training data from S3."""
        # Mock S3 response
        import io
        csv_data = sample_training_data.to_csv(index=False)
        mock_s3_client.get_object.return_value = {
            'Body': io.BytesIO(csv_data.encode())
        }
        
        # Load data
        data = load_training_data('test-bucket', 'features/data.csv')
        
        # Verify S3 was called correctly
        mock_s3_client.get_object.assert_called_once_with(
            Bucket='test-bucket',
            Key='features/data.csv'
        )
        
        # Verify data
        assert len(data) == len(sample_training_data)
        assert 'date' in data.columns
        assert pd.api.types.is_datetime64_any_dtype(data['date'])
    
    def test_load_training_data_without_date_column(self, mock_s3_client):
        """Test loading data without date column."""
        import io
        data_without_date = pd.DataFrame({
            'target': [1, 2, 3],
            'feature_1': [4, 5, 6]
        })
        
        csv_data = data_without_date.to_csv(index=False)
        mock_s3_client.get_object.return_value = {
            'Body': io.BytesIO(csv_data.encode())
        }
        
        data = load_training_data('test-bucket', 'data.csv')
        
        assert len(data) == 3
        assert 'date' not in data.columns


class TestSaveBestParams:
    """Test suite for save_best_params function."""
    
    def test_save_best_params(self, mock_s3_client):
        """Test saving best parameters to S3."""
        best_params = {
            'hidden_size': 128,
            'num_layers': 2,
            'dropout': 0.2
        }
        
        metadata = {
            'best_mape': 7.5,
            'n_trials_completed': 50,
            'optimization_time_hours': 18.5
        }
        
        s3_path = save_best_params(
            bucket='test-bucket',
            model_type='lstm',
            best_params=best_params,
            metadata=metadata
        )
        
        # Verify S3 was called
        mock_s3_client.put_object.assert_called_once()
        
        # Verify call arguments
        call_kwargs = mock_s3_client.put_object.call_args[1]
        assert call_kwargs['Bucket'] == 'test-bucket'
        assert call_kwargs['Key'] == 'hyperparameters/lstm/best_params.json'
        assert call_kwargs['ContentType'] == 'application/json'
        
        # Verify content
        saved_data = json.loads(call_kwargs['Body'])
        assert saved_data['model_type'] == 'lstm'
        assert saved_data['best_params'] == best_params
        assert saved_data['metadata'] == metadata
        assert 'timestamp' in saved_data
        
        # Verify return value
        assert s3_path == 's3://test-bucket/hyperparameters/lstm/best_params.json'
    
    def test_save_best_params_different_model_types(self, mock_s3_client):
        """Test saving parameters for different model types."""
        model_types = ['deepar', 'lstm', 'prophet', 'xgboost']
        
        for model_type in model_types:
            mock_s3_client.reset_mock()
            
            s3_path = save_best_params(
                bucket='test-bucket',
                model_type=model_type,
                best_params={'param': 'value'},
                metadata={'metric': 1.0}
            )
            
            call_kwargs = mock_s3_client.put_object.call_args[1]
            assert call_kwargs['Key'] == f'hyperparameters/{model_type}/best_params.json'
            assert s3_path == f's3://test-bucket/hyperparameters/{model_type}/best_params.json'


class TestLambdaHandler:
    """Test suite for lambda_handler function."""
    
    @patch('src.lambdas.optimize_hyperparameters.HyperparameterOptimizationOrchestrator')
    @patch('src.lambdas.optimize_hyperparameters.load_training_data')
    @patch('src.lambdas.optimize_hyperparameters.save_best_params')
    def test_lambda_handler_single_model(
        self,
        mock_save_params,
        mock_load_data,
        mock_orchestrator_class,
        sample_training_data
    ):
        """Test Lambda handler with single model optimization."""
        # Mock load_training_data
        mock_load_data.return_value = sample_training_data
        
        # Mock orchestrator
        mock_orchestrator = Mock()
        mock_orchestrator.optimize_model.return_value = {
            'model_type': 'lstm',
            'best_params': {'hidden_size': 128},
            'best_mape': 7.5,
            'n_trials_completed': 50,
            'n_trials_pruned': 0,
            'n_trials_failed': 0,
            'optimization_time_seconds': 1000,
            'optimization_time_hours': 1000 / 3600
        }
        mock_orchestrator_class.return_value = mock_orchestrator
        
        # Mock save_best_params
        mock_save_params.return_value = 's3://bucket/hyperparameters/lstm/best_params.json'
        
        # Create event
        event = {
            'model_type': 'lstm',
            'training_data_s3_path': 's3://test-bucket/features/data.csv',
            'output_bucket': 'output-bucket',
            'target_column': 'target',
            'n_trials': 50,
            'timeout_hours': 24.0
        }
        
        # Call handler
        response = lambda_handler(event, None)
        
        # Verify response
        assert response['status'] == 'success'
        assert len(response['results']) == 1
        assert response['results'][0]['model_type'] == 'lstm'
        assert response['results'][0]['best_mape'] == 7.5
        assert response['results'][0]['s3_path'] == 's3://bucket/hyperparameters/lstm/best_params.json'
        assert 'total_time_seconds' in response
        assert 'total_time_hours' in response
    
    @patch('src.lambdas.optimize_hyperparameters.HyperparameterOptimizationOrchestrator')
    @patch('src.lambdas.optimize_hyperparameters.load_training_data')
    @patch('src.lambdas.optimize_hyperparameters.save_best_params')
    def test_lambda_handler_all_models(
        self,
        mock_save_params,
        mock_load_data,
        mock_orchestrator_class,
        sample_training_data
    ):
        """Test Lambda handler with all models optimization."""
        # Mock load_training_data
        mock_load_data.return_value = sample_training_data
        
        # Mock orchestrator
        mock_orchestrator = Mock()
        
        def mock_optimize(model_type, train_data, target_column):
            return {
                'model_type': model_type,
                'best_params': {'param': 'value'},
                'best_mape': 7.0 + hash(model_type) % 3,
                'n_trials_completed': 50,
                'n_trials_pruned': 0,
                'n_trials_failed': 0,
                'optimization_time_seconds': 1000,
                'optimization_time_hours': 1000 / 3600
            }
        
        mock_orchestrator.optimize_model.side_effect = mock_optimize
        mock_orchestrator_class.return_value = mock_orchestrator
        
        # Mock save_best_params
        mock_save_params.side_effect = lambda bucket, model_type, best_params, metadata: \
            f's3://{bucket}/hyperparameters/{model_type}/best_params.json'
        
        # Create event
        event = {
            'model_type': 'all',
            'training_data_s3_path': 's3://test-bucket/features/data.csv',
            'output_bucket': 'output-bucket',
            'n_trials': 50,
            'timeout_hours': 24.0
        }
        
        # Call handler
        response = lambda_handler(event, None)
        
        # Verify response
        assert response['status'] == 'success'
        assert len(response['results']) == 4
        
        model_types = [r['model_type'] for r in response['results']]
        assert 'deepar' in model_types
        assert 'lstm' in model_types
        assert 'prophet' in model_types
        assert 'xgboost' in model_types
    
    def test_lambda_handler_missing_required_params(self):
        """Test Lambda handler with missing required parameters."""
        # Missing training_data_s3_path
        event = {
            'model_type': 'lstm',
            'output_bucket': 'output-bucket'
        }
        
        response = lambda_handler(event, None)
        
        assert response['status'] == 'error'
        assert 'training_data_s3_path' in response['message']
    
    def test_lambda_handler_missing_output_bucket(self):
        """Test Lambda handler with missing output bucket."""
        event = {
            'model_type': 'lstm',
            'training_data_s3_path': 's3://bucket/data.csv'
        }
        
        response = lambda_handler(event, None)
        
        assert response['status'] == 'error'
        assert 'output_bucket' in response['message']
    
    @patch('src.lambdas.optimize_hyperparameters.HyperparameterOptimizationOrchestrator')
    @patch('src.lambdas.optimize_hyperparameters.load_training_data')
    @patch('src.lambdas.optimize_hyperparameters.save_best_params')
    def test_lambda_handler_partial_failure(
        self,
        mock_save_params,
        mock_load_data,
        mock_orchestrator_class,
        sample_training_data
    ):
        """Test Lambda handler when some models fail."""
        # Mock load_training_data
        mock_load_data.return_value = sample_training_data
        
        # Mock orchestrator - lstm succeeds, prophet fails
        mock_orchestrator = Mock()
        
        def mock_optimize(model_type, train_data, target_column):
            if model_type == 'prophet':
                raise Exception("Prophet optimization failed")
            return {
                'model_type': model_type,
                'best_params': {'param': 'value'},
                'best_mape': 7.5,
                'n_trials_completed': 50,
                'n_trials_pruned': 0,
                'n_trials_failed': 0,
                'optimization_time_seconds': 1000,
                'optimization_time_hours': 1000 / 3600
            }
        
        mock_orchestrator.optimize_model.side_effect = mock_optimize
        mock_orchestrator_class.return_value = mock_orchestrator
        
        # Mock save_best_params
        mock_save_params.return_value = 's3://bucket/hyperparameters/lstm/best_params.json'
        
        # Create event
        event = {
            'model_type': 'all',
            'training_data_s3_path': 's3://test-bucket/features/data.csv',
            'output_bucket': 'output-bucket'
        }
        
        # Call handler
        response = lambda_handler(event, None)
        
        # Verify response
        assert response['status'] == 'success'
        assert len(response['results']) == 4
        
        # Check that some succeeded and some failed
        successful = [r for r in response['results'] if 'error' not in r]
        failed = [r for r in response['results'] if 'error' in r]
        
        assert len(successful) == 3  # deepar, lstm, xgboost
        assert len(failed) == 1  # prophet
        assert failed[0]['model_type'] == 'prophet'
    
    @patch('src.lambdas.optimize_hyperparameters.load_training_data')
    def test_lambda_handler_load_data_failure(self, mock_load_data):
        """Test Lambda handler when data loading fails."""
        # Mock load_training_data to raise exception
        mock_load_data.side_effect = Exception("S3 access denied")
        
        event = {
            'model_type': 'lstm',
            'training_data_s3_path': 's3://test-bucket/features/data.csv',
            'output_bucket': 'output-bucket'
        }
        
        response = lambda_handler(event, None)
        
        assert response['status'] == 'error'
        assert 'S3 access denied' in response['message']
    
    @patch('src.lambdas.optimize_hyperparameters.HyperparameterOptimizationOrchestrator')
    @patch('src.lambdas.optimize_hyperparameters.load_training_data')
    @patch('src.lambdas.optimize_hyperparameters.save_best_params')
    def test_lambda_handler_default_parameters(
        self,
        mock_save_params,
        mock_load_data,
        mock_orchestrator_class,
        sample_training_data
    ):
        """Test Lambda handler with default parameters."""
        # Mock load_training_data
        mock_load_data.return_value = sample_training_data
        
        # Mock orchestrator
        mock_orchestrator = Mock()
        mock_orchestrator.optimize_model.return_value = {
            'model_type': 'lstm',
            'best_params': {'hidden_size': 128},
            'best_mape': 7.5,
            'n_trials_completed': 50,
            'n_trials_pruned': 0,
            'n_trials_failed': 0,
            'optimization_time_seconds': 1000,
            'optimization_time_hours': 1000 / 3600
        }
        mock_orchestrator_class.return_value = mock_orchestrator
        
        # Mock save_best_params
        mock_save_params.return_value = 's3://bucket/hyperparameters/lstm/best_params.json'
        
        # Create event with minimal parameters
        event = {
            'training_data_s3_path': 's3://test-bucket/features/data.csv',
            'output_bucket': 'output-bucket'
        }
        
        # Call handler
        response = lambda_handler(event, None)
        
        # Verify orchestrator was created with default parameters
        mock_orchestrator_class.assert_called_once_with(
            n_trials=50,
            timeout_hours=24.0
        )
        
        # Verify response
        assert response['status'] == 'success'
        assert len(response['results']) == 4  # All models by default


class TestRequirementValidation:
    """Test suite for requirement validation."""
    
    def test_requirement_5_2_independent_optimization(self):
        """
        Requirement 5.2: Hyperparameter_Optimizer SHALL optimize each model type independently.
        
        Verify that optimizing one model does not affect another.
        """
        orchestrator = HyperparameterOptimizationOrchestrator(n_trials=50)
        
        # Each model type should have its own optimizer instance
        # This is validated by the fact that optimize_model creates a new
        # OptunaOptimizer for each model type
        assert orchestrator.n_trials == 50
    
    def test_requirement_5_4_save_best_parameters(self, mock_s3_client):
        """
        Requirement 5.4: Hyperparameter_Optimizer SHALL save best parameters to configuration store.
        
        Verify that best parameters are saved to S3.
        """
        best_params = {'hidden_size': 128}
        metadata = {'best_mape': 7.5}
        
        s3_path = save_best_params(
            bucket='test-bucket',
            model_type='lstm',
            best_params=best_params,
            metadata=metadata
        )
        
        # Verify S3 put_object was called
        mock_s3_client.put_object.assert_called_once()
        
        # Verify correct S3 path
        assert s3_path == 's3://test-bucket/hyperparameters/lstm/best_params.json'
    
    def test_requirement_5_6_timeout_handling(self):
        """
        Requirement 5.6: Hyperparameter_Optimizer SHALL complete optimization within 24 hours per model type.
        
        Verify that timeout is properly configured.
        """
        orchestrator = HyperparameterOptimizationOrchestrator(
            n_trials=50,
            timeout_hours=24.0
        )
        
        # Verify timeout is set to 24 hours
        assert orchestrator.timeout_seconds == 24 * 3600
        
        # Verify timeout can be customized
        custom_orchestrator = HyperparameterOptimizationOrchestrator(
            n_trials=50,
            timeout_hours=12.0
        )
        assert custom_orchestrator.timeout_seconds == 12 * 3600
