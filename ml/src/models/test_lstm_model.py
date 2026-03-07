"""
Unit tests for LSTM Model

Tests cover:
- Model initialization and architecture
- Forward pass
- Training with early stopping
- Prediction generation
- Batch predictions
- Multi-step forecasting
- Uncertainty estimation
- Model save/load functionality
- Error handling
"""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from ml.src.models.lstm_model import (
    LSTMModel,
    LSTMPredictor,
    LSTMTrainer,
    TimeSeriesDataset,
    load_model,
    save_model,
)


@pytest.fixture
def sample_data():
    """Create sample time series data."""
    np.random.seed(42)
    num_samples = 200
    num_features = 10
    
    # Generate synthetic time series
    data = np.random.randn(num_samples, num_features).astype(np.float32)
    targets = np.random.randn(num_samples).astype(np.float32)
    
    return data, targets


@pytest.fixture
def sample_sequences():
    """Create sample sequences for prediction."""
    np.random.seed(42)
    num_samples = 10
    sequence_length = 30
    num_features = 10
    
    sequences = np.random.randn(num_samples, sequence_length, num_features).astype(np.float32)
    
    return sequences


@pytest.fixture
def lstm_model():
    """Create a simple LSTM model for testing."""
    return LSTMModel(
        input_size=10,
        hidden_size=32,
        num_layers=2,
        dropout=0.2,
        output_size=1
    )


class TestTimeSeriesDataset:
    """Test TimeSeriesDataset class."""
    
    def test_dataset_initialization(self, sample_data):
        """Test dataset initialization."""
        data, targets = sample_data
        sequence_length = 30
        
        dataset = TimeSeriesDataset(data, targets, sequence_length)
        
        assert len(dataset) == len(data) - sequence_length
        assert isinstance(dataset.data, torch.Tensor)
        assert isinstance(dataset.targets, torch.Tensor)
    
    def test_dataset_getitem(self, sample_data):
        """Test getting items from dataset."""
        data, targets = sample_data
        sequence_length = 30
        
        dataset = TimeSeriesDataset(data, targets, sequence_length)
        
        # Get first item
        sequence, target = dataset[0]
        
        assert sequence.shape == (sequence_length, data.shape[1])
        assert target.shape == ()
        assert isinstance(sequence, torch.Tensor)
        assert isinstance(target, torch.Tensor)
    
    def test_dataset_length(self, sample_data):
        """Test dataset length calculation."""
        data, targets = sample_data
        sequence_length = 30
        
        dataset = TimeSeriesDataset(data, targets, sequence_length)
        
        # Length should be total samples minus sequence length
        expected_length = len(data) - sequence_length
        assert len(dataset) == expected_length


class TestLSTMModelArchitecture:
    """Test LSTM model architecture."""
    
    def test_model_initialization(self):
        """Test model initialization with default parameters."""
        model = LSTMModel(
            input_size=10,
            hidden_size=64,
            num_layers=2,
            dropout=0.2,
            output_size=1
        )
        
        assert model.input_size == 10
        assert model.hidden_size == 64
        assert model.num_layers == 2
        assert model.output_size == 1
        
        # Check layers exist
        assert isinstance(model.lstm, nn.LSTM)
        assert isinstance(model.batch_norm, nn.BatchNorm1d)
        assert isinstance(model.dropout, nn.Dropout)
        assert isinstance(model.fc, nn.Linear)
    
    def test_model_forward_pass(self, lstm_model):
        """Test forward pass through the model."""
        batch_size = 16
        sequence_length = 30
        input_size = 10
        
        # Create random input
        x = torch.randn(batch_size, sequence_length, input_size)
        
        # Forward pass
        output = lstm_model(x)
        
        # Check output shape
        assert output.shape == (batch_size, 1)
    
    def test_model_forward_pass_different_batch_sizes(self, lstm_model):
        """Test forward pass with different batch sizes."""
        sequence_length = 30
        input_size = 10
        
        for batch_size in [1, 8, 32, 64]:
            x = torch.randn(batch_size, sequence_length, input_size)
            output = lstm_model(x)
            assert output.shape == (batch_size, 1)
    
    def test_model_init_hidden(self, lstm_model):
        """Test hidden state initialization."""
        batch_size = 16
        device = torch.device('cpu')
        
        hidden, cell = lstm_model.init_hidden(batch_size, device)
        
        assert hidden.shape == (lstm_model.num_layers, batch_size, lstm_model.hidden_size)
        assert cell.shape == (lstm_model.num_layers, batch_size, lstm_model.hidden_size)
        assert hidden.device.type == 'cpu'
        assert cell.device.type == 'cpu'
    
    def test_model_parameter_count(self, lstm_model):
        """Test that model has trainable parameters."""
        num_params = sum(p.numel() for p in lstm_model.parameters())
        assert num_params > 0
        
        # Check that parameters are trainable
        trainable_params = sum(p.numel() for p in lstm_model.parameters() if p.requires_grad)
        assert trainable_params == num_params
    
    def test_model_with_single_layer(self):
        """Test model with single LSTM layer."""
        model = LSTMModel(
            input_size=10,
            hidden_size=32,
            num_layers=1,
            dropout=0.2,
            output_size=1
        )
        
        x = torch.randn(8, 30, 10)
        output = model(x)
        
        assert output.shape == (8, 1)
    
    def test_model_with_multi_output(self):
        """Test model with multiple output values."""
        model = LSTMModel(
            input_size=10,
            hidden_size=32,
            num_layers=2,
            dropout=0.2,
            output_size=5  # 5-step ahead forecast
        )
        
        x = torch.randn(8, 30, 10)
        output = model(x)
        
        assert output.shape == (8, 5)


class TestLSTMTrainer:
    """Test LSTM trainer functionality."""
    
    def test_trainer_initialization(self, lstm_model):
        """Test trainer initialization."""
        trainer = LSTMTrainer(
            model=lstm_model,
            learning_rate=0.001,
            weight_decay=1e-5
        )
        
        assert trainer.model == lstm_model
        assert isinstance(trainer.optimizer, torch.optim.Adam)
        assert isinstance(trainer.criterion, nn.MSELoss)
        assert isinstance(trainer.scheduler, torch.optim.lr_scheduler.ReduceLROnPlateau)
        assert len(trainer.history['train_loss']) == 0
    
    def test_trainer_device_selection(self, lstm_model):
        """Test device selection (CPU/CUDA)."""
        trainer = LSTMTrainer(model=lstm_model)
        
        # Should select available device
        assert trainer.device.type in ['cpu', 'cuda']
        
        # Model should be on the same device
        assert next(lstm_model.parameters()).device.type == trainer.device.type
    
    def test_train_epoch(self, lstm_model, sample_data):
        """Test training for one epoch."""
        data, targets = sample_data
        sequence_length = 30
        
        # Create dataset and loader
        dataset = TimeSeriesDataset(data, targets, sequence_length)
        train_loader = DataLoader(dataset, batch_size=16, shuffle=True)
        
        # Create trainer
        trainer = LSTMTrainer(model=lstm_model, learning_rate=0.001)
        
        # Train one epoch
        loss = trainer.train_epoch(train_loader)
        
        # Loss should be a positive number
        assert isinstance(loss, float)
        assert loss > 0
    
    def test_validate(self, lstm_model, sample_data):
        """Test validation."""
        data, targets = sample_data
        sequence_length = 30
        
        # Create dataset and loader
        dataset = TimeSeriesDataset(data, targets, sequence_length)
        val_loader = DataLoader(dataset, batch_size=16, shuffle=False)
        
        # Create trainer
        trainer = LSTMTrainer(model=lstm_model, learning_rate=0.001)
        
        # Validate
        loss = trainer.validate(val_loader)
        
        # Loss should be a positive number
        assert isinstance(loss, float)
        assert loss > 0
    
    def test_train_model_with_early_stopping(self, lstm_model, sample_data):
        """Test full training with early stopping."""
        data, targets = sample_data
        sequence_length = 30
        
        # Split data
        split_idx = int(len(data) * 0.8)
        train_data = data[:split_idx]
        train_targets = targets[:split_idx]
        val_data = data[split_idx:]
        val_targets = targets[split_idx:]
        
        # Create datasets and loaders
        train_dataset = TimeSeriesDataset(train_data, train_targets, sequence_length)
        val_dataset = TimeSeriesDataset(val_data, val_targets, sequence_length)
        
        train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True)
        val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False)
        
        # Create trainer
        trainer = LSTMTrainer(model=lstm_model, learning_rate=0.001)
        
        # Train with early stopping
        result = trainer.train_model(
            train_loader=train_loader,
            val_loader=val_loader,
            epochs=20,
            early_stopping_patience=5,
            verbose=False
        )
        
        # Check result structure
        assert 'best_val_loss' in result
        assert 'best_epoch' in result
        assert 'final_epoch' in result
        assert 'history' in result
        
        # Check that training happened
        assert result['best_val_loss'] > 0
        assert result['best_epoch'] > 0
        assert result['final_epoch'] > 0
        
        # Check history
        assert len(result['history']['train_loss']) > 0
        assert len(result['history']['val_loss']) > 0
    
    def test_early_stopping_triggers(self, lstm_model, sample_data):
        """Test that early stopping triggers correctly."""
        data, targets = sample_data
        sequence_length = 30
        
        # Split data
        split_idx = int(len(data) * 0.8)
        train_data = data[:split_idx]
        train_targets = targets[:split_idx]
        val_data = data[split_idx:]
        val_targets = targets[split_idx:]
        
        # Create datasets and loaders
        train_dataset = TimeSeriesDataset(train_data, train_targets, sequence_length)
        val_dataset = TimeSeriesDataset(val_data, val_targets, sequence_length)
        
        train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True)
        val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False)
        
        # Create trainer
        trainer = LSTMTrainer(model=lstm_model, learning_rate=0.001)
        
        # Train with very short patience
        result = trainer.train_model(
            train_loader=train_loader,
            val_loader=val_loader,
            epochs=100,
            early_stopping_patience=3,
            verbose=False
        )
        
        # Should stop before 100 epochs
        assert result['final_epoch'] < 100
    
    def test_best_model_restoration(self, lstm_model, sample_data):
        """Test that best model weights are restored."""
        data, targets = sample_data
        sequence_length = 30
        
        # Split data
        split_idx = int(len(data) * 0.8)
        train_data = data[:split_idx]
        train_targets = targets[:split_idx]
        val_data = data[split_idx:]
        val_targets = targets[split_idx:]
        
        # Create datasets and loaders
        train_dataset = TimeSeriesDataset(train_data, train_targets, sequence_length)
        val_dataset = TimeSeriesDataset(val_data, val_targets, sequence_length)
        
        train_loader = DataLoader(train_dataset, batch_size=16, shuffle=True)
        val_loader = DataLoader(val_dataset, batch_size=16, shuffle=False)
        
        # Create trainer
        trainer = LSTMTrainer(model=lstm_model, learning_rate=0.001)
        
        # Train
        result = trainer.train_model(
            train_loader=train_loader,
            val_loader=val_loader,
            epochs=20,
            early_stopping_patience=5,
            verbose=False
        )
        
        # Validate with best model
        final_val_loss = trainer.validate(val_loader)
        
        # Final validation loss should be close to best validation loss
        assert abs(final_val_loss - result['best_val_loss']) < 0.1


class TestLSTMPredictor:
    """Test LSTM predictor functionality."""
    
    def test_predictor_initialization(self, lstm_model):
        """Test predictor initialization."""
        predictor = LSTMPredictor(model=lstm_model)
        
        assert predictor.model == lstm_model
        assert predictor.device.type in ['cpu', 'cuda']
    
    def test_predict_single_batch(self, lstm_model, sample_sequences):
        """Test prediction on single batch."""
        predictor = LSTMPredictor(model=lstm_model)
        
        predictions = predictor.predict(sample_sequences, batch_size=32)
        
        # Check output shape
        assert predictions.shape == (len(sample_sequences), 1)
        
        # Check that predictions are finite
        assert np.all(np.isfinite(predictions))
    
    def test_predict_multiple_batches(self, lstm_model):
        """Test prediction with multiple batches."""
        predictor = LSTMPredictor(model=lstm_model)
        
        # Create larger dataset
        num_samples = 100
        sequences = np.random.randn(num_samples, 30, 10).astype(np.float32)
        
        predictions = predictor.predict(sequences, batch_size=16)
        
        # Check output shape
        assert predictions.shape == (num_samples, 1)
        assert np.all(np.isfinite(predictions))
    
    def test_predict_different_batch_sizes(self, lstm_model, sample_sequences):
        """Test prediction with different batch sizes."""
        predictor = LSTMPredictor(model=lstm_model)
        
        for batch_size in [1, 4, 8, 16]:
            predictions = predictor.predict(sample_sequences, batch_size=batch_size)
            assert predictions.shape == (len(sample_sequences), 1)
    
    def test_predict_multi_step(self, lstm_model):
        """Test multi-step ahead prediction."""
        predictor = LSTMPredictor(model=lstm_model)
        
        # Create initial sequence
        initial_sequence = np.random.randn(30, 10).astype(np.float32)
        num_steps = 5
        
        predictions = predictor.predict_multi_step(initial_sequence, num_steps)
        
        # Check output shape
        assert predictions.shape == (num_steps,)
        assert np.all(np.isfinite(predictions))
    
    def test_predict_multi_step_different_horizons(self, lstm_model):
        """Test multi-step prediction with different horizons."""
        predictor = LSTMPredictor(model=lstm_model)
        
        initial_sequence = np.random.randn(30, 10).astype(np.float32)
        
        for num_steps in [1, 5, 10, 20]:
            predictions = predictor.predict_multi_step(initial_sequence, num_steps)
            assert predictions.shape == (num_steps,)
    
    def test_predict_with_uncertainty(self, lstm_model, sample_sequences):
        """Test prediction with uncertainty estimation."""
        predictor = LSTMPredictor(model=lstm_model)
        
        mean_pred, lower_bound, upper_bound = predictor.predict_with_uncertainty(
            sample_sequences,
            num_samples=50,
            dropout_rate=0.1
        )
        
        # Check shapes
        assert mean_pred.shape == (len(sample_sequences), 1)
        assert lower_bound.shape == (len(sample_sequences), 1)
        assert upper_bound.shape == (len(sample_sequences), 1)
        
        # Check that bounds are valid
        assert np.all(lower_bound <= mean_pred)
        assert np.all(mean_pred <= upper_bound)
        
        # Check that all values are finite
        assert np.all(np.isfinite(mean_pred))
        assert np.all(np.isfinite(lower_bound))
        assert np.all(np.isfinite(upper_bound))
    
    def test_predict_with_uncertainty_different_samples(self, lstm_model, sample_sequences):
        """Test uncertainty estimation with different sample counts."""
        predictor = LSTMPredictor(model=lstm_model)
        
        for num_samples in [10, 50, 100]:
            mean_pred, lower_bound, upper_bound = predictor.predict_with_uncertainty(
                sample_sequences,
                num_samples=num_samples
            )
            
            assert mean_pred.shape == (len(sample_sequences), 1)
            assert np.all(lower_bound <= upper_bound)


class TestModelSaveLoad:
    """Test model save and load functionality."""
    
    def test_save_model(self, lstm_model):
        """Test saving model to disk."""
        with tempfile.TemporaryDirectory() as tmpdir:
            model_path = Path(tmpdir) / "test_model.pt"
            
            metadata = {
                'training_date': '2024-01-01',
                'dataset': 'test_data',
                'mape': 5.5
            }
            
            save_model(lstm_model, str(model_path), metadata=metadata)
            
            # Check that file was created
            assert model_path.exists()
            
            # Check that file is not empty
            assert model_path.stat().st_size > 0
    
    def test_load_model(self, lstm_model):
        """Test loading model from disk."""
        with tempfile.TemporaryDirectory() as tmpdir:
            model_path = Path(tmpdir) / "test_model.pt"
            
            metadata = {
                'training_date': '2024-01-01',
                'mape': 5.5
            }
            
            # Save model
            save_model(lstm_model, str(model_path), metadata=metadata)
            
            # Load model
            loaded_model, loaded_metadata = load_model(str(model_path))
            
            # Check model architecture
            assert loaded_model.input_size == lstm_model.input_size
            assert loaded_model.hidden_size == lstm_model.hidden_size
            assert loaded_model.num_layers == lstm_model.num_layers
            assert loaded_model.output_size == lstm_model.output_size
            
            # Check metadata
            assert loaded_metadata['training_date'] == '2024-01-01'
            assert loaded_metadata['mape'] == 5.5
    
    def test_save_load_preserves_weights(self, lstm_model):
        """Test that save/load preserves model weights."""
        with tempfile.TemporaryDirectory() as tmpdir:
            model_path = Path(tmpdir) / "test_model.pt"
            
            # Get original weights
            original_weights = {name: param.clone() for name, param in lstm_model.named_parameters()}
            
            # Save and load
            save_model(lstm_model, str(model_path))
            loaded_model, _ = load_model(str(model_path))
            
            # Compare weights
            for name, param in loaded_model.named_parameters():
                original_param = original_weights[name]
                assert torch.allclose(param, original_param, rtol=1e-5)
    
    def test_save_load_predictions_match(self, lstm_model, sample_sequences):
        """Test that predictions match after save/load."""
        with tempfile.TemporaryDirectory() as tmpdir:
            model_path = Path(tmpdir) / "test_model.pt"
            
            # Get original predictions
            predictor = LSTMPredictor(model=lstm_model)
            original_predictions = predictor.predict(sample_sequences)
            
            # Save and load
            save_model(lstm_model, str(model_path))
            loaded_model, _ = load_model(str(model_path))
            
            # Get predictions from loaded model
            loaded_predictor = LSTMPredictor(model=loaded_model)
            loaded_predictions = loaded_predictor.predict(sample_sequences)
            
            # Compare predictions
            np.testing.assert_allclose(original_predictions, loaded_predictions, rtol=1e-5)
    
    def test_load_model_without_metadata(self, lstm_model):
        """Test loading model without metadata."""
        with tempfile.TemporaryDirectory() as tmpdir:
            model_path = Path(tmpdir) / "test_model.pt"
            
            # Save without metadata
            save_model(lstm_model, str(model_path))
            
            # Load model
            loaded_model, loaded_metadata = load_model(str(model_path))
            
            # Metadata should be empty dict
            assert loaded_metadata == {}


class TestEdgeCases:
    """Test edge cases and error handling."""
    
    def test_model_with_zero_dropout(self):
        """Test model with zero dropout."""
        model = LSTMModel(
            input_size=10,
            hidden_size=32,
            num_layers=2,
            dropout=0.0,
            output_size=1
        )
        
        x = torch.randn(8, 30, 10)
        output = model(x)
        
        assert output.shape == (8, 1)
    
    def test_model_with_large_hidden_size(self):
        """Test model with large hidden size."""
        model = LSTMModel(
            input_size=10,
            hidden_size=512,
            num_layers=2,
            dropout=0.2,
            output_size=1
        )
        
        x = torch.randn(8, 30, 10)
        output = model(x)
        
        assert output.shape == (8, 1)
    
    def test_predictor_with_single_sample(self, lstm_model):
        """Test prediction with single sample."""
        predictor = LSTMPredictor(model=lstm_model)
        
        # Single sample
        single_sequence = np.random.randn(1, 30, 10).astype(np.float32)
        predictions = predictor.predict(single_sequence)
        
        assert predictions.shape == (1, 1)
    
    def test_dataset_with_minimum_length(self):
        """Test dataset with minimum valid length."""
        sequence_length = 10
        data = np.random.randn(15, 5).astype(np.float32)
        targets = np.random.randn(15).astype(np.float32)
        
        dataset = TimeSeriesDataset(data, targets, sequence_length)
        
        # Should have 5 sequences (15 - 10)
        assert len(dataset) == 5
    
    def test_training_with_small_dataset(self, lstm_model):
        """Test training with small dataset."""
        # Very small dataset
        data = np.random.randn(50, 10).astype(np.float32)
        targets = np.random.randn(50).astype(np.float32)
        sequence_length = 10
        
        dataset = TimeSeriesDataset(data, targets, sequence_length)
        loader = DataLoader(dataset, batch_size=8, shuffle=True)
        
        trainer = LSTMTrainer(model=lstm_model, learning_rate=0.001)
        
        # Should not crash
        loss = trainer.train_epoch(loader)
        assert loss > 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
