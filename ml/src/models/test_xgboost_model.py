"""
Unit tests for XGBoost Model Wrapper

Tests cover:
- Model initialization
- Training with various configurations
- Prediction generation
- Feature importance analysis
- Model persistence (save/load)
- Error handling
- SHAP contributions
"""

import os
import tempfile

import numpy as np
import pandas as pd
import pytest

from ml.src.models.xgboost_model import XGBoostModel


@pytest.fixture
def sample_training_data():
    """Create sample training data for testing."""
    np.random.seed(42)
    
    # Generate 1000 samples with 10 features
    n_samples = 1000
    n_features = 10
    
    # Create features
    X = pd.DataFrame(
        np.random.randn(n_samples, n_features),
        columns=[f'feature_{i}' for i in range(n_features)]
    )
    
    # Create target with some relationship to features
    y = pd.Series(
        X['feature_0'] * 2 + X['feature_1'] * 1.5 - X['feature_2'] * 0.5 + 
        np.random.randn(n_samples) * 0.1
    )
    
    return X, y


@pytest.fixture
def sample_train_val_data():
    """Create sample training and validation data."""
    np.random.seed(42)
    
    # Training data
    n_train = 800
    n_features = 10
    
    X_train = pd.DataFrame(
        np.random.randn(n_train, n_features),
        columns=[f'feature_{i}' for i in range(n_features)]
    )
    y_train = pd.Series(
        X_train['feature_0'] * 2 + X_train['feature_1'] * 1.5 + 
        np.random.randn(n_train) * 0.1
    )
    
    # Validation data
    n_val = 200
    X_val = pd.DataFrame(
        np.random.randn(n_val, n_features),
        columns=[f'feature_{i}' for i in range(n_features)]
    )
    y_val = pd.Series(
        X_val['feature_0'] * 2 + X_val['feature_1'] * 1.5 + 
        np.random.randn(n_val) * 0.1
    )
    
    return X_train, y_train, X_val, y_val


class TestXGBoostModelInitialization:
    """Test XGBoost model initialization."""
    
    def test_initialization(self):
        """Test basic model initialization."""
        model = XGBoostModel()
        assert model.model is None
        assert model.feature_names == []
        assert model.hyperparameters == {}
        assert model.training_metadata == {}
        assert model.best_iteration == 0
    
    def test_multiple_instances(self):
        """Test that multiple instances are independent."""
        model1 = XGBoostModel()
        model2 = XGBoostModel()
        
        assert model1 is not model2
        assert model1.feature_names is not model2.feature_names


class TestXGBoostModelTraining:
    """Test XGBoost model training."""
    
    def test_basic_training(self, sample_training_data):
        """Test basic model training."""
        X, y = sample_training_data
        model = XGBoostModel()
        
        metadata = model.train(X, y, verbose=False)
        
        assert model.model is not None
        assert metadata['training_samples'] == len(X)
        assert metadata['num_features'] == X.shape[1]
        assert 'training_date' in metadata
        assert 'training_time_seconds' in metadata
        assert metadata['feature_names'] == list(X.columns)
    
    def test_training_with_hyperparameters(self, sample_training_data):
        """Test training with custom hyperparameters."""
        X, y = sample_training_data
        model = XGBoostModel()
        
        hyperparameters = {
            'max_depth': 4,
            'learning_rate': 0.05,
            'n_estimators': 50,
            'subsample': 0.7,
            'colsample_bytree': 0.7
        }
        
        metadata = model.train(X, y, hyperparameters=hyperparameters, verbose=False)
        
        assert model.hyperparameters['max_depth'] == 4
        assert model.hyperparameters['learning_rate'] == 0.05
        assert model.hyperparameters['subsample'] == 0.7
    
    def test_training_with_validation(self, sample_train_val_data):
        """Test training with validation data and early stopping."""
        X_train, y_train, X_val, y_val = sample_train_val_data
        model = XGBoostModel()
        
        metadata = model.train(
            X_train, y_train,
            X_val, y_val,
            early_stopping_rounds=5,
            verbose=False
        )
        
        assert metadata['validation_samples'] == len(X_val)
        assert metadata['early_stopping_used'] is True
        assert model.best_iteration > 0
    
    def test_training_empty_data(self):
        """Test that training with empty data raises error."""
        model = XGBoostModel()
        empty_X = pd.DataFrame()
        empty_y = pd.Series(dtype=float)
        
        with pytest.raises(ValueError, match="Training data cannot be empty"):
            model.train(empty_X, empty_y)
    
    def test_training_mismatched_lengths(self):
        """Test that training with mismatched X and y lengths raises error."""
        model = XGBoostModel()
        X = pd.DataFrame({'a': [1, 2, 3]})
        y = pd.Series([1, 2])
        
        with pytest.raises(ValueError, match="must have same length"):
            model.train(X, y)
    
    def test_training_validation_mismatch(self, sample_training_data):
        """Test that providing only X_val or y_val raises error."""
        X, y = sample_training_data
        model = XGBoostModel()
        
        X_val = X.iloc[:100]
        
        with pytest.raises(ValueError, match="Both X_val and y_val must be provided"):
            model.train(X, y, X_val=X_val, y_val=None)


class TestXGBoostModelPrediction:
    """Test XGBoost model prediction."""
    
    def test_basic_prediction(self, sample_training_data):
        """Test basic prediction generation."""
        X, y = sample_training_data
        model = XGBoostModel()
        model.train(X, y, verbose=False)
        
        # Predict on same data
        predictions = model.predict(X)
        
        assert len(predictions) == len(X)
        assert isinstance(predictions, np.ndarray)
        assert predictions.dtype == np.float32 or predictions.dtype == np.float64
    
    def test_prediction_on_new_data(self, sample_training_data):
        """Test prediction on new data with same features."""
        X, y = sample_training_data
        model = XGBoostModel()
        model.train(X, y, verbose=False)
        
        # Create new test data
        X_test = pd.DataFrame(
            np.random.randn(100, X.shape[1]),
            columns=X.columns
        )
        
        predictions = model.predict(X_test)
        
        assert len(predictions) == len(X_test)
    
    def test_prediction_without_training(self):
        """Test that prediction without training raises error."""
        model = XGBoostModel()
        X_test = pd.DataFrame({'a': [1, 2, 3]})
        
        with pytest.raises(RuntimeError, match="Model must be trained"):
            model.predict(X_test)
    
    def test_prediction_empty_data(self, sample_training_data):
        """Test that prediction with empty data raises error."""
        X, y = sample_training_data
        model = XGBoostModel()
        model.train(X, y, verbose=False)
        
        empty_X = pd.DataFrame()
        
        with pytest.raises(ValueError, match="Test data cannot be empty"):
            model.predict(empty_X)
    
    def test_prediction_feature_mismatch(self, sample_training_data):
        """Test that prediction with mismatched features raises error."""
        X, y = sample_training_data
        model = XGBoostModel()
        model.train(X, y, verbose=False)
        
        # Create test data with different features
        X_test = pd.DataFrame({'wrong_feature': [1, 2, 3]})
        
        with pytest.raises(ValueError, match="Feature mismatch"):
            model.predict(X_test)
    
    def test_prediction_feature_order(self, sample_training_data):
        """Test that prediction handles different feature order correctly."""
        X, y = sample_training_data
        model = XGBoostModel()
        model.train(X, y, verbose=False)
        
        # Create test data with reversed column order
        X_test = X.iloc[:10].copy()
        X_test_reordered = X_test[list(reversed(X_test.columns))]
        
        # Model reorders features internally to match training order
        predictions_reordered = model.predict(X_test_reordered)
        predictions_original = model.predict(X_test)
        
        # Predictions should be identical regardless of input column order
        np.testing.assert_array_almost_equal(
            predictions_original,
            predictions_reordered,
            decimal=5
        )


class TestXGBoostModelFeatureImportance:
    """Test XGBoost feature importance functionality."""
    
    def test_get_feature_importance_gain(self, sample_training_data):
        """Test getting feature importance with gain method."""
        X, y = sample_training_data
        model = XGBoostModel()
        model.train(X, y, verbose=False)
        
        importance = model.get_feature_importance(importance_type='gain')
        
        assert isinstance(importance, pd.DataFrame)
        assert 'rank' in importance.columns
        assert 'feature' in importance.columns
        assert 'importance' in importance.columns
        assert 'percentage' in importance.columns
        
        # Check that importance is sorted
        assert (importance['importance'].diff().dropna() <= 0).all()
        
        # Check that percentages sum to approximately 100
        assert abs(importance['percentage'].sum() - 100) < 0.1
    
    def test_get_feature_importance_weight(self, sample_training_data):
        """Test getting feature importance with weight method."""
        X, y = sample_training_data
        model = XGBoostModel()
        model.train(X, y, verbose=False)
        
        importance = model.get_feature_importance(importance_type='weight')
        
        assert len(importance) > 0
        assert 'feature' in importance.columns
        assert 'importance' in importance.columns
    
    def test_feature_importance_without_training(self):
        """Test that getting feature importance without training raises error."""
        model = XGBoostModel()
        
        with pytest.raises(RuntimeError, match="Model must be trained"):
            model.get_feature_importance()
    
    def test_feature_importance_invalid_type(self, sample_training_data):
        """Test that invalid importance type raises error."""
        X, y = sample_training_data
        model = XGBoostModel()
        model.train(X, y, verbose=False)
        
        with pytest.raises(ValueError, match="Invalid importance_type"):
            model.get_feature_importance(importance_type='invalid')
    
    def test_feature_importance_all_types(self, sample_training_data):
        """Test all importance types."""
        X, y = sample_training_data
        model = XGBoostModel()
        model.train(X, y, verbose=False)
        
        importance_types = ['weight', 'gain', 'cover', 'total_gain', 'total_cover']
        
        for imp_type in importance_types:
            importance = model.get_feature_importance(importance_type=imp_type)
            assert len(importance) > 0
            assert 'feature' in importance.columns


class TestXGBoostModelPersistence:
    """Test model save/load functionality."""
    
    def test_save_and_load_pickle(self, sample_training_data):
        """Test saving and loading model as pickle."""
        X, y = sample_training_data
        model = XGBoostModel()
        model.train(X, y, verbose=False)
        
        # Make prediction with original model
        predictions_original = model.predict(X.iloc[:10])
        
        # Save model
        with tempfile.NamedTemporaryFile(suffix='.pkl', delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            model.save_model(tmp_path)
            
            # Load model
            loaded_model = XGBoostModel()
            loaded_model.load_model(tmp_path)
            
            # Make prediction with loaded model
            predictions_loaded = loaded_model.predict(X.iloc[:10])
            
            # Predictions should be identical
            np.testing.assert_array_almost_equal(
                predictions_original,
                predictions_loaded,
                decimal=5
            )
            
            # Metadata should be preserved
            assert loaded_model.feature_names == model.feature_names
            assert loaded_model.best_iteration == model.best_iteration
            
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    def test_save_and_load_json(self, sample_training_data):
        """Test saving and loading model as JSON."""
        X, y = sample_training_data
        model = XGBoostModel()
        model.train(X, y, verbose=False)
        
        # Make prediction with original model
        predictions_original = model.predict(X.iloc[:10])
        
        # Save model
        with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as tmp:
            tmp_path = tmp.name
        
        metadata_path = tmp_path.replace('.json', '_metadata.json')
        
        try:
            model.save_model(tmp_path)
            
            # Load model
            loaded_model = XGBoostModel()
            loaded_model.load_model(tmp_path)
            
            # Make prediction with loaded model
            predictions_loaded = loaded_model.predict(X.iloc[:10])
            
            # Predictions should be identical
            np.testing.assert_array_almost_equal(
                predictions_original,
                predictions_loaded,
                decimal=5
            )
            
            # Metadata should be preserved
            assert loaded_model.feature_names == model.feature_names
            
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            if os.path.exists(metadata_path):
                os.unlink(metadata_path)
    
    def test_save_untrained_model(self):
        """Test that saving untrained model raises error."""
        model = XGBoostModel()
        
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
        model = XGBoostModel()
        
        with pytest.raises(FileNotFoundError):
            model.load_model('/nonexistent/path/model.pkl')


class TestXGBoostModelAdvanced:
    """Test advanced XGBoost functionality."""
    
    def test_predict_with_contributions(self, sample_training_data):
        """Test prediction with SHAP contributions."""
        X, y = sample_training_data
        model = XGBoostModel()
        model.train(X, y, verbose=False)
        
        X_test = X.iloc[:10]
        predictions, contributions = model.predict_with_contributions(X_test)
        
        assert len(predictions) == len(X_test)
        assert contributions.shape[0] == len(X_test)
        # Contributions include all features + bias term
        assert contributions.shape[1] == X_test.shape[1] + 1
        
        # Sum of contributions should approximately equal predictions
        contribution_sums = contributions.sum(axis=1)
        np.testing.assert_array_almost_equal(
            predictions,
            contribution_sums,
            decimal=5
        )
    
    def test_get_model_dump(self, sample_training_data):
        """Test getting model dump."""
        X, y = sample_training_data
        model = XGBoostModel()
        model.train(X, y, hyperparameters={'n_estimators': 5}, verbose=False)
        
        dump = model.get_model_dump(dump_format='text')
        
        assert isinstance(dump, list)
        assert len(dump) > 0
        # Should have one dump per tree
        assert len(dump) == 5
    
    def test_model_dump_without_training(self):
        """Test that getting model dump without training raises error."""
        model = XGBoostModel()
        
        with pytest.raises(RuntimeError, match="Model must be trained"):
            model.get_model_dump()


class TestXGBoostModelIntegration:
    """Integration tests for complete workflows."""
    
    def test_complete_workflow(self, sample_train_val_data):
        """Test complete workflow: train, predict, get importance, save, load."""
        X_train, y_train, X_val, y_val = sample_train_val_data
        
        # Train model
        model = XGBoostModel()
        hyperparameters = {
            'max_depth': 4,
            'learning_rate': 0.1,
            'n_estimators': 50
        }
        metadata = model.train(
            X_train, y_train,
            X_val, y_val,
            hyperparameters=hyperparameters,
            early_stopping_rounds=5,
            verbose=False
        )
        
        assert metadata['training_samples'] == len(X_train)
        assert metadata['validation_samples'] == len(X_val)
        
        # Make predictions
        predictions = model.predict(X_val)
        assert len(predictions) == len(X_val)
        
        # Get feature importance
        importance = model.get_feature_importance()
        assert len(importance) > 0
        
        # Get predictions with contributions
        preds, contribs = model.predict_with_contributions(X_val.iloc[:5])
        assert len(preds) == 5
        
        # Save model
        with tempfile.NamedTemporaryFile(suffix='.pkl', delete=False) as tmp:
            tmp_path = tmp.name
        
        try:
            model.save_model(tmp_path)
            
            # Load model
            loaded_model = XGBoostModel()
            loaded_model.load_model(tmp_path)
            
            # Make predictions with loaded model
            predictions_loaded = loaded_model.predict(X_val)
            
            # Predictions should match
            np.testing.assert_array_almost_equal(
                predictions,
                predictions_loaded,
                decimal=5
            )
            
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    
    def test_workflow_with_time_series_features(self):
        """Test workflow with time series-like features."""
        np.random.seed(42)
        
        # Create time series features
        n_samples = 500
        dates = pd.date_range('2022-01-01', periods=n_samples, freq='D')
        
        # Create features: lags, rolling stats, etc.
        price = 100 + np.cumsum(np.random.randn(n_samples) * 0.5)
        
        df = pd.DataFrame({
            'price': price,
            'lag_1': np.roll(price, 1),
            'lag_2': np.roll(price, 2),
            'lag_5': np.roll(price, 5),
            'rolling_mean_5': pd.Series(price).rolling(5).mean(),
            'rolling_std_5': pd.Series(price).rolling(5).std(),
            'rolling_mean_10': pd.Series(price).rolling(10).mean(),
            'rolling_std_10': pd.Series(price).rolling(10).std(),
        })
        
        # Remove NaN rows
        df = df.dropna()
        
        # Target is next day's price
        df['target'] = df['price'].shift(-1)
        df = df.dropna()
        
        # Split into train and test
        train_size = int(len(df) * 0.8)
        train_df = df.iloc[:train_size]
        test_df = df.iloc[train_size:]
        
        feature_cols = [col for col in df.columns if col not in ['price', 'target']]
        
        X_train = train_df[feature_cols]
        y_train = train_df['target']
        X_test = test_df[feature_cols]
        y_test = test_df['target']
        
        # Train model
        model = XGBoostModel()
        model.train(X_train, y_train, verbose=False)
        
        # Make predictions
        predictions = model.predict(X_test)
        
        # Calculate RMSE
        rmse = np.sqrt(np.mean((predictions - y_test.values) ** 2))
        
        # RMSE should be reasonable (not perfect, but not terrible)
        assert rmse < 10.0  # Adjust threshold based on data scale
        
        # Get feature importance
        importance = model.get_feature_importance()
        
        # Lag features should be important
        top_features = importance.head(3)['feature'].tolist()
        assert any('lag' in feat or 'rolling' in feat for feat in top_features)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
