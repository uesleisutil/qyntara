"""
Prophet Model Wrapper for Time Series Forecasting

This module provides a wrapper for Facebook's Prophet forecasting model,
supporting seasonality configuration, external regressors, and uncertainty intervals.

Requirements: 4.1 - Implement ensemble of 4 models (DeepAR, LSTM, Prophet, XGBoost)
"""

import json
import logging
import pickle
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

try:
    from prophet import Prophet
except ImportError:
    try:
        from fbprophet import Prophet
    except ImportError:
        raise ImportError(
            "Prophet library not found. Install with: pip install prophet or pip install fbprophet"
        )

logger = logging.getLogger(__name__)


class ProphetModel:
    """
    Wrapper class for Facebook Prophet model.
    
    Provides methods for:
    - Training with configurable seasonality and hyperparameters
    - Making predictions with uncertainty intervals
    - Handling external regressors (additional features)
    - Model persistence (save/load)
    - Holiday and special event support
    
    Prophet expects data in specific format:
    - 'ds': datetime column
    - 'y': target variable
    - Additional columns for regressors
    """
    
    def __init__(self):
        """Initialize Prophet model wrapper."""
        self.model: Optional[Prophet] = None
        self.regressors: List[str] = []
        self.hyperparameters: Dict = {}
        self.training_metadata: Dict = {}
        
    def train(
        self,
        train_data: pd.DataFrame,
        hyperparameters: Optional[Dict] = None,
        regressors: Optional[List[str]] = None,
        holidays: Optional[pd.DataFrame] = None
    ) -> Dict:
        """
        Train Prophet model with specified hyperparameters.
        
        Args:
            train_data: Training data with columns ['ds', 'y'] and optional regressors
                       'ds' should be datetime, 'y' should be the target variable
            hyperparameters: Model hyperparameters including:
                - growth: 'linear' or 'logistic' (default: 'linear')
                - changepoint_prior_scale: Flexibility of trend (default: 0.05)
                - seasonality_prior_scale: Flexibility of seasonality (default: 10.0)
                - holidays_prior_scale: Flexibility of holidays (default: 10.0)
                - seasonality_mode: 'additive' or 'multiplicative' (default: 'additive')
                - yearly_seasonality: True/False/'auto' (default: 'auto')
                - weekly_seasonality: True/False/'auto' (default: 'auto')
                - daily_seasonality: True/False/'auto' (default: 'auto')
                - interval_width: Width of uncertainty intervals (default: 0.95)
                - mcmc_samples: Number of MCMC samples for uncertainty (default: 0)
            regressors: List of column names to use as external regressors
            holidays: DataFrame with columns ['ds', 'holiday'] for special events
            
        Returns:
            Dictionary with training metadata including:
                - training_samples: Number of training samples
                - training_start: Start date of training data
                - training_end: End date of training data
                - regressors: List of regressors used
                - hyperparameters: Hyperparameters used
                
        Raises:
            ValueError: If training data is invalid
        """
        # Validate inputs
        if train_data.empty:
            raise ValueError("Training data cannot be empty")
        
        if 'ds' not in train_data.columns or 'y' not in train_data.columns:
            raise ValueError("Training data must contain 'ds' and 'y' columns")
        
        # Ensure 'ds' is datetime
        if not pd.api.types.is_datetime64_any_dtype(train_data['ds']):
            train_data = train_data.copy()
            train_data['ds'] = pd.to_datetime(train_data['ds'])
        
        # Set default hyperparameters
        default_hyperparameters = {
            'growth': 'linear',
            'changepoint_prior_scale': 0.05,
            'seasonality_prior_scale': 10.0,
            'holidays_prior_scale': 10.0,
            'seasonality_mode': 'additive',
            'yearly_seasonality': 'auto',
            'weekly_seasonality': 'auto',
            'daily_seasonality': 'auto',
            'interval_width': 0.95,
            'mcmc_samples': 0
        }
        
        # Merge with provided hyperparameters
        if hyperparameters is None:
            hyperparameters = {}
        final_hyperparameters = {**default_hyperparameters, **hyperparameters}
        self.hyperparameters = final_hyperparameters
        
        # Store regressors
        if regressors is None:
            regressors = []
        self.regressors = regressors
        
        # Validate regressors exist in data
        missing_regressors = [r for r in self.regressors if r not in train_data.columns]
        if missing_regressors:
            raise ValueError(f"Regressors not found in training data: {missing_regressors}")
        
        # Initialize Prophet model
        logger.info("Initializing Prophet model with hyperparameters:")
        for key, value in final_hyperparameters.items():
            logger.info(f"  {key}: {value}")
        
        self.model = Prophet(
            growth=final_hyperparameters['growth'],
            changepoint_prior_scale=final_hyperparameters['changepoint_prior_scale'],
            seasonality_prior_scale=final_hyperparameters['seasonality_prior_scale'],
            holidays_prior_scale=final_hyperparameters['holidays_prior_scale'],
            seasonality_mode=final_hyperparameters['seasonality_mode'],
            yearly_seasonality=final_hyperparameters['yearly_seasonality'],
            weekly_seasonality=final_hyperparameters['weekly_seasonality'],
            daily_seasonality=final_hyperparameters['daily_seasonality'],
            interval_width=final_hyperparameters['interval_width'],
            mcmc_samples=final_hyperparameters['mcmc_samples']
        )
        
        # Add holidays if provided
        if holidays is not None:
            if 'ds' not in holidays.columns or 'holiday' not in holidays.columns:
                raise ValueError("Holidays DataFrame must contain 'ds' and 'holiday' columns")
            self.model.holidays = holidays
            logger.info(f"Added {len(holidays)} holiday events")
        
        # Add external regressors
        for regressor in self.regressors:
            self.model.add_regressor(regressor)
            logger.info(f"Added regressor: {regressor}")
        
        # Fit the model
        logger.info(f"Training Prophet model on {len(train_data)} samples...")
        try:
            self.model.fit(train_data)
            logger.info("Prophet model training completed successfully")
        except Exception as e:
            logger.error(f"Prophet model training failed: {e}")
            raise
        
        # Store training metadata
        self.training_metadata = {
            'training_samples': len(train_data),
            'training_start': train_data['ds'].min().isoformat(),
            'training_end': train_data['ds'].max().isoformat(),
            'regressors': self.regressors,
            'hyperparameters': final_hyperparameters,
            'training_date': datetime.now().isoformat()
        }
        
        return self.training_metadata
    
    def predict(
        self,
        periods: int,
        freq: str = 'D',
        future_regressors: Optional[pd.DataFrame] = None
    ) -> pd.DataFrame:
        """
        Generate predictions for future periods.
        
        Args:
            periods: Number of periods to forecast
            freq: Frequency of predictions ('D' for daily, 'W' for weekly, etc.)
            future_regressors: DataFrame with future values of regressors
                              Must have 'ds' column and columns for each regressor
                              Should include BOTH historical and future values
            
        Returns:
            DataFrame with columns:
                - ds: datetime
                - yhat: point forecast
                - yhat_lower: lower bound of prediction interval
                - yhat_upper: upper bound of prediction interval
                - trend: trend component
                - seasonal components (yearly, weekly, daily if applicable)
                
        Raises:
            RuntimeError: If model has not been trained
            ValueError: If regressors are missing
        """
        if self.model is None:
            raise RuntimeError("Model must be trained before making predictions")
        
        # Create future dataframe
        logger.info(f"Generating predictions for {periods} periods with frequency '{freq}'")
        future = self.model.make_future_dataframe(periods=periods, freq=freq)
        
        # Add regressors if needed
        if self.regressors:
            if future_regressors is None:
                raise ValueError(
                    f"Model was trained with regressors {self.regressors}, "
                    "but future_regressors not provided"
                )
            
            # Validate future_regressors
            if 'ds' not in future_regressors.columns:
                raise ValueError("future_regressors must contain 'ds' column")
            
            missing_regressors = [r for r in self.regressors if r not in future_regressors.columns]
            if missing_regressors:
                raise ValueError(f"Missing regressors in future_regressors: {missing_regressors}")
            
            # Ensure 'ds' is datetime
            if not pd.api.types.is_datetime64_any_dtype(future_regressors['ds']):
                future_regressors = future_regressors.copy()
                future_regressors['ds'] = pd.to_datetime(future_regressors['ds'])
            
            # Merge regressors into future dataframe
            # Use left join to keep all dates from future
            future = future.merge(
                future_regressors[['ds'] + self.regressors],
                on='ds',
                how='left'
            )
            
            # Check for missing regressor values and raise error if found
            for regressor in self.regressors:
                if future[regressor].isna().any():
                    num_missing = future[regressor].isna().sum()
                    raise ValueError(
                        f"Regressor '{regressor}' has {num_missing} missing values in future dataframe. "
                        f"future_regressors must include values for all dates (historical + future)."
                    )
        
        # Generate predictions
        try:
            forecast = self.model.predict(future)
            logger.info(f"Generated {len(forecast)} predictions")
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            raise
        
        # Return relevant columns
        output_columns = ['ds', 'yhat', 'yhat_lower', 'yhat_upper', 'trend']
        
        # Add seasonal components if they exist
        for component in ['yearly', 'weekly', 'daily']:
            if component in forecast.columns:
                output_columns.append(component)
        
        # Add regressor effects if they exist
        for regressor in self.regressors:
            regressor_col = f'{regressor}_effect'
            if regressor_col in forecast.columns:
                output_columns.append(regressor_col)
        
        return forecast[output_columns]
    
    def get_prediction_intervals(
        self,
        periods: int,
        freq: str = 'D',
        future_regressors: Optional[pd.DataFrame] = None,
        interval_width: Optional[float] = None
    ) -> pd.DataFrame:
        """
        Generate prediction intervals with specified confidence level.
        
        Args:
            periods: Number of periods to forecast
            freq: Frequency of predictions ('D' for daily, 'W' for weekly, etc.)
            future_regressors: DataFrame with future values of regressors
            interval_width: Width of uncertainty intervals (e.g., 0.95 for 95% CI)
                          If None, uses the interval_width from training
            
        Returns:
            DataFrame with columns:
                - ds: datetime
                - yhat: point forecast
                - yhat_lower: lower bound of prediction interval
                - yhat_upper: upper bound of prediction interval
                - interval_width: width of the interval
                
        Raises:
            RuntimeError: If model has not been trained
        """
        if self.model is None:
            raise RuntimeError("Model must be trained before generating prediction intervals")
        
        # If custom interval width is specified, temporarily update model
        original_interval_width = self.model.interval_width
        if interval_width is not None:
            if not 0 < interval_width < 1:
                raise ValueError("interval_width must be between 0 and 1")
            self.model.interval_width = interval_width
            logger.info(f"Using custom interval width: {interval_width}")
        
        try:
            # Generate predictions (which include intervals)
            forecast = self.predict(periods=periods, freq=freq, future_regressors=future_regressors)
            
            # Calculate interval width
            forecast['interval_width'] = forecast['yhat_upper'] - forecast['yhat_lower']
            
            # Return only interval-related columns
            return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper', 'interval_width']]
            
        finally:
            # Restore original interval width
            if interval_width is not None:
                self.model.interval_width = original_interval_width
    
    def add_custom_seasonality(
        self,
        name: str,
        period: float,
        fourier_order: int,
        prior_scale: Optional[float] = None,
        mode: Optional[str] = None
    ) -> None:
        """
        Add custom seasonality to the model.
        
        Must be called before training.
        
        Args:
            name: Name of the seasonality component
            period: Period of the seasonality in days (e.g., 30.5 for monthly)
            fourier_order: Number of Fourier terms to use (higher = more flexible)
            prior_scale: Prior scale for this seasonality (default: uses seasonality_prior_scale)
            mode: 'additive' or 'multiplicative' (default: uses model's seasonality_mode)
            
        Raises:
            RuntimeError: If model has already been trained
        """
        if self.model is None:
            # Initialize model with default parameters if not already done
            self.model = Prophet()
        
        # Check if model has been fitted (has history attribute with data)
        if hasattr(self.model, 'history') and self.model.history is not None:
            raise RuntimeError("Cannot add seasonality after model has been trained")
        
        logger.info(
            f"Adding custom seasonality: {name} "
            f"(period={period}, fourier_order={fourier_order})"
        )
        
        self.model.add_seasonality(
            name=name,
            period=period,
            fourier_order=fourier_order,
            prior_scale=prior_scale,
            mode=mode
        )
    
    def save_model(self, path: str) -> None:
        """
        Save Prophet model to disk.
        
        Args:
            path: File path to save model (should end with .pkl)
            
        Raises:
            RuntimeError: If model has not been trained
        """
        if self.model is None:
            raise RuntimeError("Cannot save model that has not been trained")
        
        # Create checkpoint with model and metadata
        checkpoint = {
            'model': self.model,
            'regressors': self.regressors,
            'hyperparameters': self.hyperparameters,
            'training_metadata': self.training_metadata
        }
        
        try:
            with open(path, 'wb') as f:
                pickle.dump(checkpoint, f)
            logger.info(f"Model saved to {path}")
        except Exception as e:
            logger.error(f"Failed to save model: {e}")
            raise
    
    def load_model(self, path: str) -> None:
        """
        Load Prophet model from disk.
        
        Args:
            path: File path to load model from
            
        Raises:
            FileNotFoundError: If model file does not exist
        """
        try:
            with open(path, 'rb') as f:
                checkpoint = pickle.load(f)
            
            self.model = checkpoint['model']
            self.regressors = checkpoint.get('regressors', [])
            self.hyperparameters = checkpoint.get('hyperparameters', {})
            self.training_metadata = checkpoint.get('training_metadata', {})
            
            logger.info(f"Model loaded from {path}")
            logger.info(f"Training metadata: {self.training_metadata}")
            
        except FileNotFoundError:
            logger.error(f"Model file not found: {path}")
            raise
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    def get_component_importance(self) -> pd.DataFrame:
        """
        Get the importance of different model components.
        
        Returns:
            DataFrame with component names and their contribution to predictions
            
        Raises:
            RuntimeError: If model has not been trained
        """
        if self.model is None:
            raise RuntimeError("Model must be trained before getting component importance")
        
        # Get the last prediction to analyze components
        if not hasattr(self.model, 'history'):
            raise RuntimeError("Model has not been fitted yet")
        
        # Make a prediction on training data to get components
        forecast = self.model.predict(self.model.history)
        
        # Calculate contribution of each component
        components = {}
        
        # Trend contribution
        if 'trend' in forecast.columns:
            components['trend'] = forecast['trend'].std()
        
        # Seasonal components
        for component in ['yearly', 'weekly', 'daily']:
            if component in forecast.columns:
                components[component] = forecast[component].std()
        
        # Regressor contributions
        for regressor in self.regressors:
            regressor_col = f'{regressor}_effect'
            if regressor_col in forecast.columns:
                components[regressor] = forecast[regressor_col].std()
        
        # Create DataFrame
        importance_df = pd.DataFrame([
            {'component': name, 'std_contribution': value}
            for name, value in components.items()
        ])
        
        # Sort by contribution
        importance_df = importance_df.sort_values('std_contribution', ascending=False)
        
        # Calculate percentage
        total = importance_df['std_contribution'].sum()
        importance_df['percentage'] = (importance_df['std_contribution'] / total * 100).round(2)
        
        return importance_df.reset_index(drop=True)
    
    def get_changepoints(self) -> pd.DataFrame:
        """
        Get detected changepoints in the trend.
        
        Returns:
            DataFrame with changepoint dates and their effects
            
        Raises:
            RuntimeError: If model has not been trained
        """
        if self.model is None or not hasattr(self.model, 'changepoints'):
            raise RuntimeError("Model must be trained before getting changepoints")
        
        changepoints_df = pd.DataFrame({
            'changepoint': self.model.changepoints,
            'delta': self.model.params['delta'].flatten()
        })
        
        # Sort by absolute delta (impact)
        changepoints_df['abs_delta'] = changepoints_df['delta'].abs()
        changepoints_df = changepoints_df.sort_values('abs_delta', ascending=False)
        
        return changepoints_df[['changepoint', 'delta']].reset_index(drop=True)
