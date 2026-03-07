"""
Unit tests for Prophet Model Wrapper

Tests cover:
- Model initialization
- Training with various configurations
- Prediction generation
- Prediction intervals
- External regressors
- Custom seasonality
- Model persistence (save/load)
- Error handling
"""

import os
import tempfile
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import pytest

from ml.src.models.prophet_model import ProphetModel


@pytest.fixture
def sample_training_data():
    """Create sample training data for testing."""
    # Generate 2 years of daily data
    dates = pd.date_range(start='2022-01-01', end='2023-12-31', freq='D')
    
    # Create synthetic time series with trend and seasonality
    np.random.seed(42)
    trend = np.linspace(100, 150, len(dates))
    seasonal = 10 * np.sin(2 * np.pi * np.arange(len(dates)) / 365.25)
    noise = np.random.normal(0, 2, len(dates))
    
    y = trend + seasonal + noise
    
    df = pd.DataFrame({
        'ds': dates,
        'y': y
    })
    
    return df


@pytest.fixture
def sample_data_with_regressors():
    """Create sample training data with external regressors."""
    dates = pd.date_range(start='2022-01-01', end='2023-12-31', freq='D')
    
    np.random.seed(42)
    trend = np.linspace(100, 150, len(dates))
    seasonal = 10 * np.sin(2 * np.pi * np.arange(len(dates)) / 365.25)
    
    # Add regressors
    regressor1 = np.random.normal(50, 10, len(dates))
    regressor2 = np.random.normal(20, 5, len(dates))
    
    # Target influenced by regressors
    y = trend + seasonal + 0.5 * regressor1 + 0.3 * regressor2 + np.random.normal(0, 2, len(dates))
    
    df = pd.DataFrame({
        'ds': dates,
        'y': y,
        'regressor1': regressor1,
        'regressor2': regressor2
    })
    
    return df


@pytest.fixture
def sample_holidays():
    """Create sample holidays dataframe."""
    holidays = pd.DataFrame({
        'ds': pd.to_datetime(['2022-01-01', '2022-12-25', '2023-01-01', '2023-12-25']),
        'holiday': ['New Year', 'Christmas', 'New Year', 'Christmas']
    })
    return holidays


class TestProphetModelInitialization:
    """Test Prophet model initialization."""
    
    def test_initialization(self):
        """Test basic model initialization."""
        model = ProphetModel()
        assert model.model is None
        assert model.regressors == []
        assert model.hyperparameters == {}
        assert model.training_metadata == {}
    
    def test_multiple_instances(self):
        """Test that multiple instances are independent."""
        model1 = ProphetModel()
        model2 = ProphetModel()
        
        assert model1 is not model2
        assert model1.regressors is not model2.regressors


class TestProphetModelTraining:
    """Test Prophet model training."""
    
    def test_basic_training(self, sample_training_data):
        """Test basic model training."""
        model = ProphetModel()
        metadata = model.train(sample_training_data)
        
        assert model.model is not None
        assert metadata['training_samples'] == len(sample_training_data)
        assert 'training_start' in metadata
        assert 'training_end' in metadata
        assert 'training_date' in metadata
    
    def test_training_with_hyperparameters(self, sample_training_data):
        """Test training with custom hyperparameters."""
        model = ProphetModel()
        
        hyperparameters = {
            'changepoint_prior_scale': 0.1,
            'seasonality_prior_scale': 5.0,
            'yearly_seasonality': True,
            'weekly_seasonality': False,
            'daily_seasonality': False
        }
        
        metadata = model.train(sample_training_data, hyperparameters=hyperparameters)
        
        assert model.hyperparameters['changepoint_prior_scale'] == 0.1
        assert model.hyperparameters['seasonality_prior_scale'] == 5.0
        assert model.hyperparameters['yearly_seasonality'] is True
        assert model.hyperparameters['weekly_seasonality'] is False
    
    def test_training_with_regressors(self, sample_data_with_regressors):
        """Test training with external regressors."""
        model = ProphetModel()
        
        regressors = ['regressor1', 'regressor2']
        metadata = model.train(
            sample_data_with_regressors,
            regressors=regressors
        )
        
        assert model.regressors == regressors
        assert metadata['regressors'] == regressors
    
    def test_training_with_holidays(self, sample_training_data, sample_holidays):
        """Test training with holidays."""
        model = ProphetModel()
        metadata = model.train(
            sample_training_data,
            holidays=sample_holidays
        )
        
        assert model.model is not None
        assert model.model.holidays is not None
    
    def test_training_empty_data(self):
        """Test that training with empty data raises error."""
        model = ProphetModel()
        empty_df = pd.DataFrame()
        
        with pytest.raises(ValueError, match="Training data cannot be empty"):
            model.train(empty_df)
    
    def test_training_missing_columns(self):
        """Test that training with missing required columns raises error."""
        model = ProphetModel()
        invalid_df = pd.DataFrame({'date': [1, 2, 3], 'value': [10, 20, 30]})
        
        with pytest.raises(ValueError, match="must contain 'ds' and 'y' columns"):
            model.train(invalid_df)
    
    def test_training_missing_regressors(self, sample_training_data):
        """Test that training with missing regressors raises error."""
        model = ProphetModel()
        
        with pytest.raises(ValueError, match="Regressors not found"):
            model.train(
                sample_training_data,
                regressors=['nonexistent_regressor']
            )
    
    def test_training_converts_ds_to_datetime(self):
        """Test that training converts 'ds' column to datetime."""
        model = ProphetModel()
        
        # Create data with string dates
        df = pd.DataFrame({
            'ds': ['2022-01-01', '2022-01-02', '2022-01-03'],
            'y': [10, 20, 30]
        })
        
        metadata = model.train(df)
        assert model.model is not None


class TestProphetModelPrediction:
    """Test Prophet model prediction."""
    
    def test_basic_prediction(self, sample_training_data):
        """Test basic prediction generation."""
        model = ProphetModel()
        model.train(sample_training_data)
        
        forecast = model.predict(periods=30)
        
        assert len(forecast) == len(sample_training_data) + 30
        assert 'ds' in forecast.columns
        assert 'yhat' in forecast.columns
        assert 'yhat_lower' in forecast.columns
        assert 'yhat_upper' in forecast.columns
        assert 'trend' in forecast.columns
    
    def test_prediction_with_regressors(self, sample_data_with_regressors):
        """Test prediction with external regressors."""
        model = ProphetModel()
        regressors = ['regressor1', 'regressor2']
        model.train(sample_data_with_regressors, regressors=regressors)
        
        # Create future regressor values
        future_dates = pd.date_range(
            start=sample_data_with_regressors['ds'].max() + timedelta(days=1),
            periods=30,
            freq='D'
        )
        
        future_regressor_values = pd.DataFrame({
            'ds': future_dates,
            'regressor1': np.random.normal(50, 10, 30),
            'regressor2': np.random.normal(20, 5, 30)
        })
        
        # Combine historical and future regressor values
        # Prophet needs regressors for ALL dates (historical + future)
        future_regressors = pd.concat([
            sample_data_with_regressors[['ds', 'regressor1', 'regressor2']],
            future_regressor_values
        ], ignore_index=True)
        
        forecast = model.predict(periods=30, future_regressors=future_regressors)
        
        assert len(forecast) == len(sample_data_with_regressors) + 30
        assert 'yhat' in forecast.columns
    
    def test_prediction_without_training(self):
        """Test that prediction without training raises error."""
        model = ProphetModel()
        
        with pytest.raises(RuntimeError, match="Model must be trained"):
            model.predict(periods=30)
    
    def test_prediction_missing_regressors(self, sample_data_with_regressors):
        """Test that prediction without required regressors raises error."""
        model = ProphetModel()
        regressors = ['regressor1', 'regressor2']
        model.train(sample_data_with_regressors, regressors=regressors)
        
        with pytest.raises(ValueError, match="future_regressors not provided"):
            model.predict(periods=30)
    
    def test_prediction_different_frequencies(self, sample_training_data):
        """Test prediction with different frequencies."""
        model = ProphetModel()
        model.train(sample_training_data)
        
        # Daily predictions
        forecast_daily = model.predict(periods=7, freq='D')
        assert len(forecast_daily) == len(sample_training_data) + 7
        
        # Weekly predictions (note: this extends the training data too)
        forecast_weekly = model.predict(periods=4, freq='W')
        assert 'yhat' in forecast_weekly.columns


class TestProphetModelPredictionIntervals:
    """Test Prophet model prediction intervals."""
    
    def test_get_prediction_intervals(self, sample_training_data):
        """Test prediction interval generation."""
        model = ProphetModel()
        model.train(sample_training_data)
        
        intervals = model.get_prediction_intervals(periods=30)
        
        assert len(intervals) == len(sample_training_data) + 30
        assert 'ds' in intervals.columns
        assert 'yhat' in intervals.columns
        assert 'yhat_lower' in intervals.columns
        assert 'yhat_upper' in intervals.columns
        assert 'interval_width' in intervals.columns
        
        # Check that intervals are valid
        assert (intervals['yhat_upper'] >= intervals['yhat_lower']).all()
        assert (intervals['interval_width'] >= 0).all()
    
    def test_custom_interval_width(self, sample_training_data):
        """Test prediction intervals with custom width."""
        model = ProphetModel()
        model.train(sample_training_data)
        
        # 80% confidence interval
        intervals_80 = model.get_prediction_intervals(periods=30, interval_width=0.80)
        
        # 95% confidence interval
        intervals_95 = model.get_prediction_intervals(periods=30, interval_width=0.95)
        
        # 95% intervals should be wider than 80% intervals
        avg_width_80 = intervals_80['interval_width'].mean()
        avg_width_95 = intervals_95['interval_width'].mean()
        
        assert avg_width_95 > avg_width_80
    
    def test_interval_width_validation(self, sample_training_data):
        """Test that invalid interval width raises error."""
        model = ProphetModel()
        model.train(sample_training_data)
        
        with pytest.raises(ValueError, match="interval_width must be between 0 and 1"):
            model.get_prediction_intervals(periods=30, interval_width=1.5)
    
    def test_intervals_without_training(self):
        """Test that getting intervals without training raises error."""
        model = ProphetModel()
        
        with pytest.raises(RuntimeError, match="Model must be trained"):
            model.get_prediction_intervals(periods=30)


class TestProphetModelCustomSeasonality:
    """Test custom seasonality functionality."""
    
    def test_add_custom_seasonality(self, sample_training_data):
        """Test adding custom seasonality."""
        model = ProphetModel()
        
        # Add monthly seasonality
        model.add_custom_seasonality(
            name='monthly',
            period=30.5,
            fourier_order=5
        )
        
        metadata = model.train(sample_training_data)
        forecast = model.predict(periods=30)
        
        assert model.model is not None
        assert 'yhat' in forecast.columns
    
    def test_add_seasonality_after_training(self, sample_training_data):
        """Test that adding seasonality after training raises error."""
        model = ProphetModel()
        model.train(sample_training_data)
        
        with pytest.raises(RuntimeError, match="Cannot add seasonality after model has been trained"):
            model.add_custom_seasonality(
                name='monthly',
                period=30.5,
                fourier_order=5
            )


class TestProphetModelPersistence:
    """Test model save/load functionality."""
    
    def test_save_and_load_model(self, sample_training_data):
        """Test saving and loading model."""
        model = ProphetModel()
        model.train(sample_training_data)
        
        # Make prediction with original model
        forecast_original = model.predict(periods=30)
        
        # Save model
        with tempfile.NamedTemporaryFile(suffix='.pkl', delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            model.save_model(tmp_path)
            
            # Load model
            loaded_model = ProphetModel()
            loaded_model.load_model(tmp_path)
            
            # Make prediction with loaded model
            forecast_loaded = loaded_model.predict(periods=30)
            
            # Predictions should be identical
            pd.testing.assert_frame_equal(
                forecast_original[['ds', 'yhat']],
                forecast_loaded[['ds', 'yhat']]
            )
            
            # Metadata should be preserved
            assert loaded_model.training_metadata == model.training_metadata
            assert loaded_model.hyperparameters == model.hyperparameters
            
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    def test_save_model_with_regressors(self, sample_data_with_regressors):
        """Test saving and loading model with regressors."""
        model = ProphetModel()
        regressors = ['regressor1', 'regressor2']
        model.train(sample_data_with_regressors, regressors=regressors)
        
        with tempfile.NamedTemporaryFile(suffix='.pkl', delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            model.save_model(tmp_path)
            
            loaded_model = ProphetModel()
            loaded_model.load_model(tmp_path)
            
            assert loaded_model.regressors == regressors
            
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    def test_save_untrained_model(self):
        """Test that saving untrained model raises error."""
        model = ProphetModel()
        
        with tempfile.NamedTemporaryFile(suffix='.pkl', delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            with pytest.raises(RuntimeError, match="Cannot save model that has not been trained"):
                model.save_model(tmp_path)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    def test_load_nonexistent_model(self):
        """Test that loading nonexistent model raises error."""
        model = ProphetModel()
        
        with pytest.raises(FileNotFoundError):
            model.load_model('/nonexistent/path/model.pkl')


class TestProphetModelAnalysis:
    """Test model analysis functionality."""
    
    def test_get_component_importance(self, sample_training_data):
        """Test getting component importance."""
        model = ProphetModel()
        model.train(sample_training_data)
        
        importance = model.get_component_importance()
        
        assert isinstance(importance, pd.DataFrame)
        assert 'component' in importance.columns
        assert 'std_contribution' in importance.columns
        assert 'percentage' in importance.columns
        
        # Should have at least trend component
        assert 'trend' in importance['component'].values
        
        # Percentages should sum to approximately 100
        assert abs(importance['percentage'].sum() - 100) < 0.1
    
    def test_get_changepoints(self, sample_training_data):
        """Test getting changepoints."""
        model = ProphetModel()
        model.train(sample_training_data)
        
        changepoints = model.get_changepoints()
        
        assert isinstance(changepoints, pd.DataFrame)
        assert 'changepoint' in changepoints.columns
        assert 'delta' in changepoints.columns
        
        # Should have some changepoints
        assert len(changepoints) > 0
    
    def test_component_importance_without_training(self):
        """Test that getting component importance without training raises error."""
        model = ProphetModel()
        
        with pytest.raises(RuntimeError, match="Model must be trained"):
            model.get_component_importance()
    
    def test_changepoints_without_training(self):
        """Test that getting changepoints without training raises error."""
        model = ProphetModel()
        
        with pytest.raises(RuntimeError, match="Model must be trained"):
            model.get_changepoints()


class TestProphetModelIntegration:
    """Integration tests for complete workflows."""
    
    def test_complete_workflow(self, sample_training_data):
        """Test complete workflow: train, predict, save, load, predict again."""
        # Train model
        model = ProphetModel()
        hyperparameters = {
            'changepoint_prior_scale': 0.05,
            'seasonality_prior_scale': 10.0,
            'yearly_seasonality': True
        }
        metadata = model.train(sample_training_data, hyperparameters=hyperparameters)
        
        assert metadata['training_samples'] == len(sample_training_data)
        
        # Make predictions
        forecast1 = model.predict(periods=30)
        assert len(forecast1) > len(sample_training_data)
        
        # Get prediction intervals
        intervals = model.get_prediction_intervals(periods=30)
        assert (intervals['yhat_upper'] >= intervals['yhat_lower']).all()
        
        # Get component importance
        importance = model.get_component_importance()
        assert len(importance) > 0
        
        # Save model
        with tempfile.NamedTemporaryFile(suffix='.pkl', delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            model.save_model(tmp_path)
            
            # Load model
            loaded_model = ProphetModel()
            loaded_model.load_model(tmp_path)
            
            # Make predictions with loaded model
            forecast2 = loaded_model.predict(periods=30)
            
            # Predictions should match
            pd.testing.assert_frame_equal(
                forecast1[['ds', 'yhat']],
                forecast2[['ds', 'yhat']]
            )
            
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    def test_workflow_with_regressors(self, sample_data_with_regressors):
        """Test complete workflow with external regressors."""
        # Train model with regressors
        model = ProphetModel()
        regressors = ['regressor1', 'regressor2']
        metadata = model.train(sample_data_with_regressors, regressors=regressors)
        
        assert metadata['regressors'] == regressors
        
        # Create future regressor values
        future_dates = pd.date_range(
            start=sample_data_with_regressors['ds'].max() + timedelta(days=1),
            periods=30,
            freq='D'
        )
        
        future_regressor_values = pd.DataFrame({
            'ds': future_dates,
            'regressor1': np.random.normal(50, 10, 30),
            'regressor2': np.random.normal(20, 5, 30)
        })
        
        # Combine historical and future regressor values
        future_regressors = pd.concat([
            sample_data_with_regressors[['ds', 'regressor1', 'regressor2']],
            future_regressor_values
        ], ignore_index=True)
        
        # Make predictions
        forecast = model.predict(periods=30, future_regressors=future_regressors)
        assert len(forecast) == len(sample_data_with_regressors) + 30
        
        # Get prediction intervals
        intervals = model.get_prediction_intervals(
            periods=30,
            future_regressors=future_regressors
        )
        assert len(intervals) == len(sample_data_with_regressors) + 30
        
        # Get component importance (should include regressors)
        importance = model.get_component_importance()
        # Prophet creates regressor effects, not direct regressor columns
        # Just verify we got some components
        assert len(importance) > 0
        assert 'trend' in importance['component'].values


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
