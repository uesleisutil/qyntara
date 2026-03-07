"""
Ensemble Contribution Analyzer

Identifies dominant models and analyzes model contributions in ensemble predictions.
Provides breakdown for high uncertainty predictions.

Requirements: 15.2, 15.5
"""

from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd


class EnsembleContributionAnalyzer:
    """
    Analyzes ensemble model contributions and identifies dominant models.
    
    Provides insights into which models contribute most to predictions
    and explains high uncertainty predictions.
    """
    
    def __init__(self, uncertainty_threshold: float = 0.15):
        """
        Initialize ensemble contribution analyzer.
        
        Args:
            uncertainty_threshold: Threshold for high uncertainty (as fraction of prediction)
        """
        self.uncertainty_threshold = uncertainty_threshold
    
    def identify_dominant_model(
        self,
        predictions: Dict[str, np.ndarray],
        weights: Dict[str, float],
        ensemble_prediction: np.ndarray
    ) -> List[str]:
        """
        Identify the dominant model for each prediction.
        
        The dominant model is the one whose weighted prediction is closest
        to the ensemble prediction.
        
        Args:
            predictions: Dict mapping model names to prediction arrays
            weights: Dict mapping model names to weights
            ensemble_prediction: Ensemble prediction array
            
        Returns:
            List of dominant model names for each prediction
        """
        n_predictions = len(ensemble_prediction)
        dominant_models = []
        
        for i in range(n_predictions):
            min_distance = float('inf')
            dominant_model = None
            
            for model_name, model_preds in predictions.items():
                # Calculate weighted prediction
                weighted_pred = model_preds[i] * weights[model_name]
                
                # Calculate distance to ensemble prediction
                distance = abs(weighted_pred - ensemble_prediction[i])
                
                if distance < min_distance:
                    min_distance = distance
                    dominant_model = model_name
            
            dominant_models.append(dominant_model)
        
        return dominant_models
    
    def calculate_model_contributions(
        self,
        predictions: Dict[str, np.ndarray],
        weights: Dict[str, float]
    ) -> Dict[str, np.ndarray]:
        """
        Calculate weighted contributions of each model.
        
        Args:
            predictions: Dict mapping model names to prediction arrays
            weights: Dict mapping model names to weights
            
        Returns:
            Dict mapping model names to weighted contribution arrays
        """
        contributions = {}
        
        for model_name, model_preds in predictions.items():
            contributions[model_name] = model_preds * weights[model_name]
        
        return contributions
    
    def calculate_prediction_uncertainty(
        self,
        predictions: Dict[str, np.ndarray],
        ensemble_prediction: np.ndarray
    ) -> np.ndarray:
        """
        Calculate prediction uncertainty based on model disagreement.
        
        Uncertainty is measured as the standard deviation of individual
        model predictions relative to the ensemble prediction.
        
        Args:
            predictions: Dict mapping model names to prediction arrays
            ensemble_prediction: Ensemble prediction array
            
        Returns:
            Array of uncertainty values (relative to ensemble prediction)
        """
        # Stack all predictions
        all_preds = np.array(list(predictions.values()))
        
        # Calculate standard deviation across models
        std_dev = np.std(all_preds, axis=0)
        
        # Calculate relative uncertainty
        epsilon = 1e-10
        relative_uncertainty = std_dev / (np.abs(ensemble_prediction) + epsilon)
        
        return relative_uncertainty
    
    def identify_high_uncertainty_predictions(
        self,
        predictions: Dict[str, np.ndarray],
        ensemble_prediction: np.ndarray,
        threshold: Optional[float] = None
    ) -> np.ndarray:
        """
        Identify predictions with high uncertainty.
        
        Args:
            predictions: Dict mapping model names to prediction arrays
            ensemble_prediction: Ensemble prediction array
            threshold: Uncertainty threshold (uses instance threshold if None)
            
        Returns:
            Boolean array indicating high uncertainty predictions
        """
        if threshold is None:
            threshold = self.uncertainty_threshold
        
        uncertainty = self.calculate_prediction_uncertainty(
            predictions,
            ensemble_prediction
        )
        
        return uncertainty > threshold
    
    def explain_high_uncertainty_prediction(
        self,
        predictions: Dict[str, np.ndarray],
        weights: Dict[str, float],
        ensemble_prediction: np.ndarray,
        prediction_idx: int,
        feature_values: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Provide detailed explanation for a high uncertainty prediction.
        
        Args:
            predictions: Dict mapping model names to prediction arrays
            weights: Dict mapping model names to weights
            ensemble_prediction: Ensemble prediction array
            prediction_idx: Index of prediction to explain
            feature_values: Optional dict of feature values for context
            
        Returns:
            Dictionary with detailed explanation
        """
        # Get predictions for this index
        model_preds = {
            name: preds[prediction_idx]
            for name, preds in predictions.items()
        }
        
        # Calculate contributions
        contributions = {
            name: pred * weights[name]
            for name, pred in model_preds.items()
        }
        
        # Calculate uncertainty
        uncertainty = self.calculate_prediction_uncertainty(
            predictions,
            ensemble_prediction
        )[prediction_idx]
        
        # Calculate disagreement metrics
        pred_values = list(model_preds.values())
        pred_range = max(pred_values) - min(pred_values)
        pred_std = np.std(pred_values)
        
        # Identify outlier models (predictions far from ensemble)
        ensemble_pred = ensemble_prediction[prediction_idx]
        outlier_threshold = 2 * pred_std
        outliers = []
        
        for name, pred in model_preds.items():
            if abs(pred - ensemble_pred) > outlier_threshold:
                outliers.append({
                    'model': name,
                    'prediction': float(pred),
                    'deviation': float(pred - ensemble_pred)
                })
        
        explanation = {
            'prediction_idx': prediction_idx,
            'ensemble_prediction': float(ensemble_pred),
            'uncertainty': float(uncertainty),
            'model_predictions': {
                name: float(pred) for name, pred in model_preds.items()
            },
            'model_contributions': {
                name: float(contrib) for name, contrib in contributions.items()
            },
            'model_weights': weights,
            'disagreement_metrics': {
                'range': float(pred_range),
                'std_dev': float(pred_std),
                'coefficient_of_variation': float(pred_std / (abs(ensemble_pred) + 1e-10))
            },
            'outlier_models': outliers
        }
        
        if feature_values:
            explanation['feature_values'] = feature_values
        
        return explanation
    
    def generate_contribution_report(
        self,
        predictions: Dict[str, np.ndarray],
        weights: Dict[str, float],
        ensemble_prediction: np.ndarray,
        stock_symbols: Optional[List[str]] = None
    ) -> pd.DataFrame:
        """
        Generate a comprehensive contribution report.
        
        Args:
            predictions: Dict mapping model names to prediction arrays
            weights: Dict mapping model names to weights
            ensemble_prediction: Ensemble prediction array
            stock_symbols: Optional list of stock symbols
            
        Returns:
            DataFrame with contribution analysis for each prediction
        """
        n_predictions = len(ensemble_prediction)
        
        # Calculate contributions and uncertainty
        contributions = self.calculate_model_contributions(predictions, weights)
        uncertainty = self.calculate_prediction_uncertainty(
            predictions,
            ensemble_prediction
        )
        dominant_models = self.identify_dominant_model(
            predictions,
            weights,
            ensemble_prediction
        )
        high_uncertainty = self.identify_high_uncertainty_predictions(
            predictions,
            ensemble_prediction
        )
        
        # Build report
        report_data = []
        
        for i in range(n_predictions):
            row = {
                'prediction_idx': i,
                'ensemble_prediction': ensemble_prediction[i],
                'uncertainty': uncertainty[i],
                'high_uncertainty': high_uncertainty[i],
                'dominant_model': dominant_models[i]
            }
            
            # Add individual model predictions
            for model_name, model_preds in predictions.items():
                row[f'{model_name}_prediction'] = model_preds[i]
            
            # Add model contributions
            for model_name, model_contribs in contributions.items():
                row[f'{model_name}_contribution'] = model_contribs[i]
            
            # Add stock symbol if provided
            if stock_symbols and i < len(stock_symbols):
                row['stock_symbol'] = stock_symbols[i]
            
            report_data.append(row)
        
        return pd.DataFrame(report_data)
    
    def analyze_model_dominance(
        self,
        predictions: Dict[str, np.ndarray],
        weights: Dict[str, float],
        ensemble_prediction: np.ndarray
    ) -> Dict[str, Any]:
        """
        Analyze overall model dominance patterns.
        
        Args:
            predictions: Dict mapping model names to prediction arrays
            weights: Dict mapping model names to weights
            ensemble_prediction: Ensemble prediction array
            
        Returns:
            Dictionary with dominance analysis
        """
        dominant_models = self.identify_dominant_model(
            predictions,
            weights,
            ensemble_prediction
        )
        
        # Count dominance frequency
        dominance_counts = pd.Series(dominant_models).value_counts()
        dominance_percentages = (dominance_counts / len(dominant_models) * 100).to_dict()
        
        # Calculate average contribution per model
        contributions = self.calculate_model_contributions(predictions, weights)
        avg_contributions = {
            name: float(np.mean(np.abs(contribs)))
            for name, contribs in contributions.items()
        }
        
        # Calculate model agreement with ensemble
        agreements = {}
        for model_name, model_preds in predictions.items():
            # Calculate correlation with ensemble
            correlation = np.corrcoef(model_preds, ensemble_prediction)[0, 1]
            agreements[model_name] = float(correlation)
        
        return {
            'dominance_frequency': dominance_counts.to_dict(),
            'dominance_percentage': dominance_percentages,
            'average_contributions': avg_contributions,
            'model_agreement_with_ensemble': agreements,
            'weights': weights
        }
