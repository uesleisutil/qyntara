"""
SHAP Explainer

Calculates SHAP values for feature importance and aggregates across predictions.
Uses SHAP (SHapley Additive exPlanations) to explain model predictions.

Requirements: 15.1, 15.3
"""

from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False


class SHAPExplainer:
    """
    Calculates SHAP values for model explainability.
    
    Provides feature importance explanations for individual predictions
    and aggregated importance across multiple predictions.
    """
    
    def __init__(self, model=None, model_type: str = 'tree'):
        """
        Initialize SHAP explainer.
        
        Args:
            model: Trained model to explain
            model_type: Type of model ('tree', 'linear', 'deep', 'kernel')
        """
        self.model = model
        self.model_type = model_type
        self.explainer = None
        
        if not SHAP_AVAILABLE:
            raise ImportError(
                "SHAP is not installed. Install it with: pip install shap"
            )
    
    def initialize_explainer(
        self,
        background_data: Optional[np.ndarray] = None,
        **kwargs
    ) -> None:
        """
        Initialize the appropriate SHAP explainer based on model type.
        
        Args:
            background_data: Background dataset for KernelExplainer
            **kwargs: Additional arguments for explainer initialization
        """
        if self.model is None:
            raise ValueError("Model must be set before initializing explainer")
        
        if self.model_type == 'tree':
            # For tree-based models (Random Forest, etc.)
            self.explainer = shap.TreeExplainer(self.model, **kwargs)
        elif self.model_type == 'linear':
            # For linear models
            self.explainer = shap.LinearExplainer(self.model, background_data, **kwargs)
        elif self.model_type == 'deep':
            # For deep learning models
            self.explainer = shap.DeepExplainer(self.model, background_data, **kwargs)
        elif self.model_type == 'kernel':
            # Model-agnostic explainer
            self.explainer = shap.KernelExplainer(self.model, background_data, **kwargs)
        else:
            raise ValueError(f"Unknown model type: {self.model_type}")
    
    def calculate_shap_values(
        self,
        X: np.ndarray,
        check_additivity: bool = False
    ) -> np.ndarray:
        """
        Calculate SHAP values for input data.
        
        Args:
            X: Input features (n_samples, n_features)
            check_additivity: Whether to check SHAP value additivity
            
        Returns:
            SHAP values array (n_samples, n_features)
        """
        if self.explainer is None:
            raise ValueError("Explainer must be initialized first")
        
        shap_values = self.explainer.shap_values(X, check_additivity=check_additivity)
        
        # Handle multi-output models (e.g., multi-class classification)
        if isinstance(shap_values, list):
            # For binary classification, use positive class
            shap_values = shap_values[1] if len(shap_values) == 2 else shap_values[0]
        
        return shap_values
    
    def get_feature_importance(
        self,
        shap_values: np.ndarray,
        feature_names: Optional[List[str]] = None,
        top_n: int = 10
    ) -> pd.DataFrame:
        """
        Calculate feature importance from SHAP values.
        
        Args:
            shap_values: SHAP values array (n_samples, n_features)
            feature_names: Names of features
            top_n: Number of top features to return
            
        Returns:
            DataFrame with feature importance sorted by absolute mean SHAP value
        """
        # Calculate mean absolute SHAP value for each feature
        mean_abs_shap = np.abs(shap_values).mean(axis=0)
        
        # Create feature names if not provided
        if feature_names is None:
            feature_names = [f'feature_{i}' for i in range(shap_values.shape[1])]
        
        # Create DataFrame
        importance_df = pd.DataFrame({
            'feature': feature_names,
            'importance': mean_abs_shap
        })
        
        # Sort by importance
        importance_df = importance_df.sort_values('importance', ascending=False)
        
        # Return top N features
        return importance_df.head(top_n).reset_index(drop=True)
    
    def explain_prediction(
        self,
        X: np.ndarray,
        feature_names: Optional[List[str]] = None,
        top_n: int = 10
    ) -> Dict[str, Any]:
        """
        Explain a single prediction with SHAP values.
        
        Args:
            X: Input features for single prediction (1, n_features)
            feature_names: Names of features
            top_n: Number of top contributing features to return
            
        Returns:
            Dictionary with explanation details
        """
        if X.ndim == 1:
            X = X.reshape(1, -1)
        
        # Calculate SHAP values
        shap_values = self.calculate_shap_values(X)
        
        # Get feature importance for this prediction
        if feature_names is None:
            feature_names = [f'feature_{i}' for i in range(X.shape[1])]
        
        # Create DataFrame with feature contributions
        contributions = pd.DataFrame({
            'feature': feature_names,
            'feature_value': X[0],
            'shap_value': shap_values[0]
        })
        
        # Sort by absolute SHAP value
        contributions['abs_shap'] = np.abs(contributions['shap_value'])
        contributions = contributions.sort_values('abs_shap', ascending=False)
        
        # Get top contributors
        top_contributors = contributions.head(top_n)[
            ['feature', 'feature_value', 'shap_value']
        ].to_dict('records')
        
        # Calculate base value (expected value)
        base_value = self.explainer.expected_value
        if isinstance(base_value, np.ndarray):
            base_value = float(base_value[0])
        
        # Calculate prediction
        prediction = base_value + shap_values[0].sum()
        
        return {
            'prediction': float(prediction),
            'base_value': float(base_value),
            'top_contributors': top_contributors,
            'total_shap_contribution': float(shap_values[0].sum())
        }
    
    def aggregate_feature_importance(
        self,
        shap_values_list: List[np.ndarray],
        feature_names: Optional[List[str]] = None,
        top_n: int = 10
    ) -> pd.DataFrame:
        """
        Aggregate feature importance across multiple predictions.
        
        Args:
            shap_values_list: List of SHAP value arrays
            feature_names: Names of features
            top_n: Number of top features to return
            
        Returns:
            DataFrame with aggregated feature importance
        """
        # Stack all SHAP values
        all_shap_values = np.vstack(shap_values_list)
        
        # Calculate aggregated importance
        return self.get_feature_importance(
            all_shap_values,
            feature_names,
            top_n
        )
    
    def calculate_shap_interaction_values(
        self,
        X: np.ndarray
    ) -> np.ndarray:
        """
        Calculate SHAP interaction values (feature interactions).
        
        Args:
            X: Input features (n_samples, n_features)
            
        Returns:
            SHAP interaction values (n_samples, n_features, n_features)
        """
        if self.model_type != 'tree':
            raise ValueError(
                "Interaction values are only supported for tree-based models"
            )
        
        if self.explainer is None:
            raise ValueError("Explainer must be initialized first")
        
        interaction_values = self.explainer.shap_interaction_values(X)
        
        return interaction_values
    
    def get_top_interactions(
        self,
        interaction_values: np.ndarray,
        feature_names: Optional[List[str]] = None,
        top_n: int = 10
    ) -> pd.DataFrame:
        """
        Get top feature interactions from SHAP interaction values.
        
        Args:
            interaction_values: SHAP interaction values (n_samples, n_features, n_features)
            feature_names: Names of features
            top_n: Number of top interactions to return
            
        Returns:
            DataFrame with top feature interactions
        """
        # Average interaction values across samples
        mean_interaction = np.abs(interaction_values).mean(axis=0)
        
        # Get upper triangle (avoid duplicates)
        n_features = mean_interaction.shape[0]
        interactions = []
        
        for i in range(n_features):
            for j in range(i + 1, n_features):
                interactions.append({
                    'feature_1_idx': i,
                    'feature_2_idx': j,
                    'interaction_strength': mean_interaction[i, j]
                })
        
        # Create DataFrame
        interactions_df = pd.DataFrame(interactions)
        
        # Add feature names if provided
        if feature_names is not None:
            interactions_df['feature_1'] = interactions_df['feature_1_idx'].map(
                lambda x: feature_names[x]
            )
            interactions_df['feature_2'] = interactions_df['feature_2_idx'].map(
                lambda x: feature_names[x]
            )
        
        # Sort by interaction strength
        interactions_df = interactions_df.sort_values(
            'interaction_strength',
            ascending=False
        )
        
        return interactions_df.head(top_n).reset_index(drop=True)
