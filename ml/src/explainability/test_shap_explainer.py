"""
Tests for SHAPExplainer

Tests SHAP value calculation and feature importance analysis.
"""

import pytest
import numpy as np
import pandas as pd
from unittest.mock import Mock, MagicMock, patch

# Mock shap module if not available
try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    shap = Mock()

from src.explainability.shap_explainer import SHAPExplainer


@pytest.mark.skipif(not SHAP_AVAILABLE, reason="SHAP not installed")
class TestSHAPExplainer:
    """Test suite for SHAPExplainer."""
    
    def setup_method(self):
        """Setup test fixtures."""
        # Create a simple mock model
        self.mock_model = Mock()
        self.explainer = SHAPExplainer(self.mock_model, model_type='tree')
    
    def test_initialization(self):
        """Test explainer initialization."""
        assert self.explainer.model == self.mock_model
        assert self.explainer.model_type == 'tree'
        assert self.explainer.explainer is None
    
    def test_initialization_without_model(self):
        """Test initialization without model."""
        explainer = SHAPExplainer(model_type='tree')
        assert explainer.model is None
    
    def test_get_feature_importance(self):
        """Test feature importance calculation."""
        # Create mock SHAP values
        shap_values = np.array([
            [0.5, -0.3, 0.1],
            [0.2, 0.4, -0.1],
            [-0.3, 0.2, 0.5]
        ])
        
        feature_names = ['feature_A', 'feature_B', 'feature_C']
        
        importance_df = self.explainer.get_feature_importance(
            shap_values,
            feature_names,
            top_n=3
        )
        
        assert len(importance_df) == 3
        assert 'feature' in importance_df.columns
        assert 'importance' in importance_df.columns
        
        # Check that features are sorted by importance
        assert importance_df['importance'].is_monotonic_decreasing
    
    def test_get_feature_importance_without_names(self):
        """Test feature importance without feature names."""
        shap_values = np.array([
            [0.5, -0.3, 0.1],
            [0.2, 0.4, -0.1]
        ])
        
        importance_df = self.explainer.get_feature_importance(
            shap_values,
            top_n=2
        )
        
        assert len(importance_df) == 2
        assert all(importance_df['feature'].str.startswith('feature_'))
    
    def test_get_feature_importance_top_n(self):
        """Test feature importance with top_n limit."""
        shap_values = np.array([
            [0.5, -0.3, 0.1, 0.2, -0.4]
        ])
        
        importance_df = self.explainer.get_feature_importance(
            shap_values,
            top_n=3
        )
        
        assert len(importance_df) == 3
    
    def test_aggregate_feature_importance(self):
        """Test aggregating feature importance across predictions."""
        shap_values_list = [
            np.array([[0.5, -0.3, 0.1]]),
            np.array([[0.2, 0.4, -0.1]]),
            np.array([[-0.3, 0.2, 0.5]])
        ]
        
        feature_names = ['feature_A', 'feature_B', 'feature_C']
        
        importance_df = self.explainer.aggregate_feature_importance(
            shap_values_list,
            feature_names,
            top_n=3
        )
        
        assert len(importance_df) == 3
        assert 'feature' in importance_df.columns
        assert 'importance' in importance_df.columns
    
    def test_get_top_interactions(self):
        """Test getting top feature interactions."""
        # Create mock interaction values (n_samples, n_features, n_features)
        interaction_values = np.array([
            [[0.0, 0.5, 0.2],
             [0.5, 0.0, 0.3],
             [0.2, 0.3, 0.0]],
            [[0.0, 0.4, 0.1],
             [0.4, 0.0, 0.2],
             [0.1, 0.2, 0.0]]
        ])
        
        feature_names = ['feature_A', 'feature_B', 'feature_C']
        
        interactions_df = self.explainer.get_top_interactions(
            interaction_values,
            feature_names,
            top_n=3
        )
        
        assert len(interactions_df) <= 3
        assert 'feature_1' in interactions_df.columns
        assert 'feature_2' in interactions_df.columns
        assert 'interaction_strength' in interactions_df.columns
        
        # Check that interactions are sorted by strength
        assert interactions_df['interaction_strength'].is_monotonic_decreasing
    
    def test_get_top_interactions_without_names(self):
        """Test getting top interactions without feature names."""
        interaction_values = np.array([
            [[0.0, 0.5],
             [0.5, 0.0]]
        ])
        
        interactions_df = self.explainer.get_top_interactions(
            interaction_values,
            top_n=1
        )
        
        assert len(interactions_df) == 1
        assert 'feature_1_idx' in interactions_df.columns
        assert 'feature_2_idx' in interactions_df.columns


class TestSHAPExplainerWithoutSHAP:
    """Test suite for SHAPExplainer when SHAP is not available."""
    
    @patch('src.explainability.shap_explainer.SHAP_AVAILABLE', False)
    def test_initialization_without_shap(self):
        """Test that initialization fails when SHAP is not available."""
        with pytest.raises(ImportError, match="SHAP is not installed"):
            SHAPExplainer(model_type='tree')
