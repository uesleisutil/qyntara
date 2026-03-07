"""
LSTM Model for Time Series Forecasting

This module provides a PyTorch-based LSTM model for stock price forecasting,
supporting configurable architecture, training with early stopping, and batch predictions.

Requirements: 4.1 - Implement ensemble of 4 models (DeepAR, LSTM, Prophet, XGBoost)
"""

import logging
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

logger = logging.getLogger(__name__)


class TimeSeriesDataset(Dataset):
    """
    PyTorch Dataset for time series data.
    
    Handles windowing and feature preparation for LSTM training.
    """
    
    def __init__(
        self,
        data: np.ndarray,
        targets: np.ndarray,
        sequence_length: int
    ):
        """
        Initialize time series dataset.
        
        Args:
            data: Input features with shape (num_samples, num_features)
            targets: Target values with shape (num_samples,)
            sequence_length: Length of input sequences
        """
        self.data = torch.FloatTensor(data)
        self.targets = torch.FloatTensor(targets)
        self.sequence_length = sequence_length
        
    def __len__(self) -> int:
        """Return number of sequences."""
        return len(self.data) - self.sequence_length
    
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Get a single sequence and target.
        
        Args:
            idx: Index of the sequence
            
        Returns:
            Tuple of (sequence, target)
        """
        sequence = self.data[idx:idx + self.sequence_length]
        target = self.targets[idx + self.sequence_length]
        return sequence, target


class LSTMModel(nn.Module):
    """
    LSTM neural network for time series forecasting.
    
    Features:
    - Configurable number of layers and hidden units
    - Dropout for regularization
    - Batch normalization
    - Supports multi-step forecasting
    """
    
    def __init__(
        self,
        input_size: int,
        hidden_size: int = 128,
        num_layers: int = 2,
        dropout: float = 0.2,
        output_size: int = 1
    ):
        """
        Initialize LSTM model.
        
        Args:
            input_size: Number of input features
            hidden_size: Number of hidden units in LSTM layers
            num_layers: Number of LSTM layers
            dropout: Dropout rate for regularization
            output_size: Number of output values (forecast horizon)
        """
        super(LSTMModel, self).__init__()
        
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.output_size = output_size
        
        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0,
            batch_first=True
        )
        
        # Batch normalization
        self.batch_norm = nn.BatchNorm1d(hidden_size)
        
        # Dropout layer
        self.dropout = nn.Dropout(dropout)
        
        # Fully connected output layer
        self.fc = nn.Linear(hidden_size, output_size)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass through the network.
        
        Args:
            x: Input tensor with shape (batch_size, sequence_length, input_size)
            
        Returns:
            Output tensor with shape (batch_size, output_size)
        """
        # LSTM forward pass
        # lstm_out shape: (batch_size, sequence_length, hidden_size)
        lstm_out, (hidden, cell) = self.lstm(x)
        
        # Take the output from the last time step
        # last_output shape: (batch_size, hidden_size)
        last_output = lstm_out[:, -1, :]
        
        # Apply batch normalization (skip if batch size is 1 during training)
        # Note: batch_norm expects (batch_size, features)
        if self.training and last_output.size(0) == 1:
            # Skip batch norm for single sample during training
            normalized = last_output
        else:
            normalized = self.batch_norm(last_output)
        
        # Apply dropout
        dropped = self.dropout(normalized)
        
        # Fully connected layer
        output = self.fc(dropped)
        
        return output
    
    def init_hidden(self, batch_size: int, device: torch.device) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Initialize hidden and cell states.
        
        Args:
            batch_size: Batch size
            device: Device to create tensors on
            
        Returns:
            Tuple of (hidden_state, cell_state)
        """
        hidden = torch.zeros(self.num_layers, batch_size, self.hidden_size).to(device)
        cell = torch.zeros(self.num_layers, batch_size, self.hidden_size).to(device)
        return hidden, cell


class LSTMTrainer:
    """
    Trainer class for LSTM model with early stopping support.
    
    Handles:
    - Training loop with validation
    - Early stopping to prevent overfitting
    - Model checkpointing
    - Learning rate scheduling
    """
    
    def __init__(
        self,
        model: LSTMModel,
        device: Optional[torch.device] = None,
        learning_rate: float = 0.001,
        weight_decay: float = 1e-5
    ):
        """
        Initialize LSTM trainer.
        
        Args:
            model: LSTM model to train
            device: Device to train on (CPU or CUDA)
            learning_rate: Learning rate for optimizer
            weight_decay: L2 regularization weight
        """
        self.model = model
        self.device = device or torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model.to(self.device)
        
        # Optimizer
        self.optimizer = torch.optim.Adam(
            model.parameters(),
            lr=learning_rate,
            weight_decay=weight_decay
        )
        
        # Loss function
        self.criterion = nn.MSELoss()
        
        # Learning rate scheduler
        self.scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer,
            mode='min',
            factor=0.5,
            patience=5,
            verbose=True
        )
        
        # Training history
        self.history = {
            'train_loss': [],
            'val_loss': [],
            'learning_rate': []
        }
        
    def train_epoch(self, train_loader: DataLoader) -> float:
        """
        Train for one epoch.
        
        Args:
            train_loader: DataLoader for training data
            
        Returns:
            Average training loss
        """
        self.model.train()
        total_loss = 0.0
        num_batches = 0
        
        for sequences, targets in train_loader:
            # Move to device
            sequences = sequences.to(self.device)
            targets = targets.to(self.device)
            
            # Zero gradients
            self.optimizer.zero_grad()
            
            # Forward pass
            outputs = self.model(sequences)
            
            # Calculate loss
            loss = self.criterion(outputs.squeeze(), targets)
            
            # Backward pass
            loss.backward()
            
            # Gradient clipping to prevent exploding gradients
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            
            # Update weights
            self.optimizer.step()
            
            total_loss += loss.item()
            num_batches += 1
        
        return total_loss / num_batches
    
    def validate(self, val_loader: DataLoader) -> float:
        """
        Validate the model.
        
        Args:
            val_loader: DataLoader for validation data
            
        Returns:
            Average validation loss
        """
        self.model.eval()
        total_loss = 0.0
        num_batches = 0
        
        with torch.no_grad():
            for sequences, targets in val_loader:
                # Move to device
                sequences = sequences.to(self.device)
                targets = targets.to(self.device)
                
                # Forward pass
                outputs = self.model(sequences)
                
                # Calculate loss
                loss = self.criterion(outputs.squeeze(), targets)
                
                total_loss += loss.item()
                num_batches += 1
        
        return total_loss / num_batches
    
    def train_model(
        self,
        train_loader: DataLoader,
        val_loader: DataLoader,
        epochs: int = 100,
        early_stopping_patience: int = 10,
        verbose: bool = True
    ) -> Dict:
        """
        Train the model with early stopping.
        
        Args:
            train_loader: DataLoader for training data
            val_loader: DataLoader for validation data
            epochs: Maximum number of epochs
            early_stopping_patience: Number of epochs to wait before early stopping
            verbose: Whether to print training progress
            
        Returns:
            Dictionary with training history and best metrics
        """
        best_val_loss = float('inf')
        patience_counter = 0
        best_epoch = 0
        
        logger.info(f"Starting training on device: {self.device}")
        logger.info(f"Model parameters: {sum(p.numel() for p in self.model.parameters()):,}")
        
        for epoch in range(epochs):
            # Train
            train_loss = self.train_epoch(train_loader)
            
            # Validate
            val_loss = self.validate(val_loader)
            
            # Update learning rate
            self.scheduler.step(val_loss)
            current_lr = self.optimizer.param_groups[0]['lr']
            
            # Record history
            self.history['train_loss'].append(train_loss)
            self.history['val_loss'].append(val_loss)
            self.history['learning_rate'].append(current_lr)
            
            # Print progress
            if verbose:
                logger.info(
                    f"Epoch {epoch + 1}/{epochs} - "
                    f"Train Loss: {train_loss:.6f}, "
                    f"Val Loss: {val_loss:.6f}, "
                    f"LR: {current_lr:.6f}"
                )
            
            # Early stopping check
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                best_epoch = epoch + 1
                patience_counter = 0
                
                # Save best model state
                self.best_model_state = self.model.state_dict().copy()
                
                if verbose:
                    logger.info(f"New best validation loss: {best_val_loss:.6f}")
            else:
                patience_counter += 1
                
                if patience_counter >= early_stopping_patience:
                    logger.info(f"Early stopping triggered at epoch {epoch + 1}")
                    logger.info(f"Best validation loss: {best_val_loss:.6f} at epoch {best_epoch}")
                    break
        
        # Restore best model
        if hasattr(self, 'best_model_state'):
            self.model.load_state_dict(self.best_model_state)
            logger.info("Restored best model weights")
        
        return {
            'best_val_loss': best_val_loss,
            'best_epoch': best_epoch,
            'final_epoch': epoch + 1,
            'history': self.history
        }


class LSTMPredictor:
    """
    Predictor class for LSTM model.
    
    Handles:
    - Single and batch predictions
    - Multi-step forecasting
    - Prediction intervals (via quantile regression or ensemble)
    """
    
    def __init__(
        self,
        model: LSTMModel,
        device: Optional[torch.device] = None
    ):
        """
        Initialize LSTM predictor.
        
        Args:
            model: Trained LSTM model
            device: Device to run predictions on
        """
        self.model = model
        self.device = device or torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model.to(self.device)
        self.model.eval()
    
    def predict(
        self,
        input_data: np.ndarray,
        batch_size: int = 32
    ) -> np.ndarray:
        """
        Generate predictions for input data.
        
        Args:
            input_data: Input sequences with shape (num_samples, sequence_length, num_features)
            batch_size: Batch size for prediction
            
        Returns:
            Predictions with shape (num_samples, output_size)
        """
        # Convert to tensor
        input_tensor = torch.FloatTensor(input_data).to(self.device)
        
        # Create DataLoader for batch processing
        dataset = torch.utils.data.TensorDataset(input_tensor)
        loader = DataLoader(dataset, batch_size=batch_size, shuffle=False)
        
        predictions = []
        
        with torch.no_grad():
            for batch in loader:
                sequences = batch[0]
                outputs = self.model(sequences)
                predictions.append(outputs.cpu().numpy())
        
        # Concatenate all predictions
        return np.concatenate(predictions, axis=0)
    
    def predict_multi_step(
        self,
        initial_sequence: np.ndarray,
        num_steps: int
    ) -> np.ndarray:
        """
        Generate multi-step ahead predictions using recursive forecasting.
        
        Args:
            initial_sequence: Initial sequence with shape (sequence_length, num_features)
            num_steps: Number of steps to forecast
            
        Returns:
            Predictions with shape (num_steps,)
        """
        self.model.eval()
        
        # Convert to tensor
        sequence = torch.FloatTensor(initial_sequence).unsqueeze(0).to(self.device)
        
        predictions = []
        
        with torch.no_grad():
            for _ in range(num_steps):
                # Predict next step
                output = self.model(sequence)
                pred_value = output.item()
                predictions.append(pred_value)
                
                # Update sequence for next prediction
                # Remove first time step and append prediction
                # Note: This assumes the first feature is the target variable
                new_step = sequence[:, -1:, :].clone()
                new_step[:, :, 0] = output
                
                sequence = torch.cat([sequence[:, 1:, :], new_step], dim=1)
        
        return np.array(predictions)
    
    def predict_with_uncertainty(
        self,
        input_data: np.ndarray,
        num_samples: int = 100,
        dropout_rate: float = 0.1
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Generate predictions with uncertainty estimates using Monte Carlo Dropout.
        
        Args:
            input_data: Input sequences with shape (num_samples, sequence_length, num_features)
            num_samples: Number of Monte Carlo samples
            dropout_rate: Dropout rate for uncertainty estimation
            
        Returns:
            Tuple of (mean_predictions, lower_bound, upper_bound)
        """
        # Enable dropout during inference
        self.model.train()
        
        # Convert to tensor
        input_tensor = torch.FloatTensor(input_data).to(self.device)
        
        # Generate multiple predictions
        predictions = []
        
        with torch.no_grad():
            for _ in range(num_samples):
                outputs = self.model(input_tensor)
                predictions.append(outputs.cpu().numpy())
        
        # Stack predictions
        predictions = np.stack(predictions, axis=0)  # Shape: (num_samples, batch_size, output_size)
        
        # Calculate statistics
        mean_pred = np.mean(predictions, axis=0)
        std_pred = np.std(predictions, axis=0)
        
        # 95% confidence interval (assuming normal distribution)
        lower_bound = mean_pred - 1.96 * std_pred
        upper_bound = mean_pred + 1.96 * std_pred
        
        # Restore eval mode
        self.model.eval()
        
        return mean_pred, lower_bound, upper_bound


def save_model(model: LSTMModel, path: str, metadata: Optional[Dict] = None) -> None:
    """
    Save LSTM model to disk.
    
    Args:
        model: LSTM model to save
        path: File path to save model
        metadata: Optional metadata to save with model
    """
    checkpoint = {
        'model_state_dict': model.state_dict(),
        'model_config': {
            'input_size': model.input_size,
            'hidden_size': model.hidden_size,
            'num_layers': model.num_layers,
            'output_size': model.output_size
        }
    }
    
    if metadata:
        checkpoint['metadata'] = metadata
    
    torch.save(checkpoint, path)
    logger.info(f"Model saved to {path}")


def load_model(path: str, device: Optional[torch.device] = None) -> Tuple[LSTMModel, Dict]:
    """
    Load LSTM model from disk.
    
    Args:
        path: File path to load model from
        device: Device to load model on
        
    Returns:
        Tuple of (model, metadata)
    """
    device = device or torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    
    checkpoint = torch.load(path, map_location=device)
    
    # Recreate model
    config = checkpoint['model_config']
    model = LSTMModel(
        input_size=config['input_size'],
        hidden_size=config['hidden_size'],
        num_layers=config['num_layers'],
        output_size=config['output_size']
    )
    
    # Load weights
    model.load_state_dict(checkpoint['model_state_dict'])
    model.to(device)
    model.eval()
    
    metadata = checkpoint.get('metadata', {})
    
    logger.info(f"Model loaded from {path}")
    
    return model, metadata
