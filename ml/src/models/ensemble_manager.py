"""
Ensemble Manager for combining multiple forecasting models.

This module provides functionality for:
- Loading and managing multiple models (DeepAR, LSTM, Prophet, XGBoost)
- Calculating dynamic weights based on historical performance
- Combining predictions using weighted average
- Generating ensemble prediction intervals
"""

import logging
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class DynamicWeightCalculator:
    """
    Calculates and adjusts ensemble weights based on historical MAPE.
    
    Requirements:
    - 4.2: Calculate weights based on historical MAPE
    - 4.3: Recalculate weights monthly with 3-month window
    - 4.4: Adjust weights when MAPE differs > 20%
    """
    
    def __init__(
        self,
        window_months: int = 3,
        adjustment_threshold: float = 0.20,
        min_weight: float = 0.05
    ):
        """
        Initialize weight calculator.
        
        Args:
            window_months: Rolling window for performance calculation (default: 3)
            adjustment_threshold: Threshold for weight adjustment (default: 0.20)
            min_weight: Minimum weight for any model (default: 0.05)
        """
        self.window_months = window_months
        self.adjustment_threshold = adjustment_threshold
        self.min_weight = min_weight
        self.weight_history: List[Dict[str, Any]] = []
        
    def calculate_weights(
        self,
        performance_metrics: Dict[str, List[float]],
        dates: Optional[List[datetime]] = None
    ) -> Dict[str, float]:
        """
        Calculate weights based on historical MAPE.
        
        Lower MAPE gets higher weight using inverse MAPE weighting.
        
        Args:
            performance_metrics: Dict mapping model names to list of MAPE values
            dates: Optional list of dates corresponding to MAPE values
            
        Returns:
            Dict mapping model names to weights (sum to 1.0)
            
        Raises:
            ValueError: If performance_metrics is empty or contains invalid data
        """
        if not performance_metrics:
            raise ValueError("performance_metrics cannot be empty")
            
        # Validate all models have data
        for model_name, mapes in performance_metrics.items():
            if not mapes or len(mapes) == 0:
                raise ValueError(f"Model {model_name} has no MAPE values")
            if any(np.isnan(mapes)) or any(np.isinf(mapes)):
                raise ValueError(f"Model {model_name} has invalid MAPE values")
                
        # Calculate average MAPE for each model
        avg_mapes = {
            model: np.mean(mapes) 
            for model, mapes in performance_metrics.items()
        }
        
        # Calculate inverse MAPE weights
        inverse_mapes = {
            model: 1.0 / mape if mape > 0 else 1e6
            for model, mape in avg_mapes.items()
        }
        
        total_inverse = sum(inverse_mapes.values())
        
        # Normalize to sum to 1.0
        weights = {
            model: inv_mape / total_inverse
            for model, inv_mape in inverse_mapes.items()
        }
        
        # Apply minimum weight constraint
        weights = self._apply_min_weight_constraint(weights)
        
        # Store in history
        self.weight_history.append({
            'timestamp': datetime.now(),
            'weights': weights.copy(),
            'avg_mapes': avg_mapes.copy()
        })
        
        logger.info(f"Calculated weights: {weights}")
        logger.info(f"Based on average MAPEs: {avg_mapes}")
        
        return weights
    
    def _apply_min_weight_constraint(
        self,
        weights: Dict[str, float]
    ) -> Dict[str, float]:
        """
        Apply minimum weight constraint and renormalize.
        
        Args:
            weights: Original weights
            
        Returns:
            Adjusted weights with minimum constraint applied
        """
        adjusted_weights = {}
        excess_weight = 0.0
        models_above_min = []
        
        # First pass: apply minimum weight
        for model, weight in weights.items():
            if weight < self.min_weight:
                adjusted_weights[model] = self.min_weight
                excess_weight += (self.min_weight - weight)
            else:
                adjusted_weights[model] = weight
                models_above_min.append(model)
        
        # Second pass: redistribute excess weight
        if models_above_min and excess_weight > 0:
            reduction_per_model = excess_weight / len(models_above_min)
            for model in models_above_min:
                adjusted_weights[model] -= reduction_per_model
        
        # Renormalize to ensure sum is exactly 1.0
        total = sum(adjusted_weights.values())
        adjusted_weights = {
            model: weight / total
            for model, weight in adjusted_weights.items()
        }
        
        return adjusted_weights
    
    def should_recalculate(
        self,
        current_metrics: Dict[str, float],
        last_weights: Dict[str, float]
    ) -> bool:
        """
        Determine if weights should be recalculated based on MAPE changes.
        
        Args:
            current_metrics: Current MAPE for each model
            last_weights: Last calculated weights
            
        Returns:
            True if weights should be recalculated
        """
        if not last_weights:
            return True
            
        # Check if any model's MAPE changed by more than threshold
        for model, current_mape in current_metrics.items():
            if model not in last_weights:
                return True
                
            # Get historical MAPE from weight history
            if not self.weight_history:
                return True
                
            last_mape = self.weight_history[-1]['avg_mapes'].get(model)
            if last_mape is None:
                return True
                
            # Calculate relative change
            if last_mape > 0:
                relative_change = abs(current_mape - last_mape) / last_mape
                if relative_change > self.adjustment_threshold:
                    logger.info(
                        f"Model {model} MAPE changed by {relative_change:.2%}, "
                        f"exceeding threshold {self.adjustment_threshold:.2%}"
                    )
                    return True
        
        return False
    
    def get_weight_history(self) -> List[Dict[str, Any]]:
        """Get history of weight calculations."""
        return self.weight_history.copy()


class EnsembleManager:
    """
    Manages ensemble of multiple forecasting models.
    
    Requirements:
    - 4.1: Train and predict with all 4 models
    - 4.2: Combine predictions using weighted average
    - 4.5: Generate ensemble intervals
    """
    
    def __init__(
        self,
        models: Optional[Dict[str, Any]] = None,
        weight_calculator: Optional[DynamicWeightCalculator] = None
    ):
        """
        Initialize ensemble manager.
        
        Args:
            models: Dict mapping model names to model instances
            weight_calculator: Optional weight calculator instance
        """
        self.models = models or {}
        self.weight_calculator = weight_calculator or DynamicWeightCalculator()
        self.current_weights: Dict[str, float] = {}
        
    def add_model(self, name: str, model: Any) -> None:
        """Add a model to the ensemble."""
        self.models[name] = model
        logger.info(f"Added model '{name}' to ensemble")
        
    def remove_model(self, name: str) -> None:
        """Remove a model from the ensemble."""
        if name in self.models:
            del self.models[name]
            logger.info(f"Removed model '{name}' from ensemble")
        
    def predict_all(
        self,
        input_data: pd.DataFrame,
        **kwargs
    ) -> Dict[str, np.ndarray]:
        """
        Generate predictions from all models.
        
        Args:
            input_data: Input features for prediction
            **kwargs: Additional arguments passed to model predict methods
            
        Returns:
            Dict mapping model names to prediction arrays
            
        Raises:
            ValueError: If no models are available
        """
        if not self.models:
            raise ValueError("No models available in ensemble")
            
        predictions = {}
        
        for name, model in self.models.items():
            try:
                pred = model.predict(input_data, **kwargs)
                predictions[name] = pred
                logger.info(f"Model '{name}' generated {len(pred)} predictions")
            except Exception as e:
                logger.error(f"Error predicting with model '{name}': {e}")
                raise
                
        return predictions
    
    def weighted_average(
        self,
        predictions: Dict[str, np.ndarray],
        weights: Optional[Dict[str, float]] = None
    ) -> np.ndarray:
        """
        Combine predictions using weighted average.
        
        Args:
            predictions: Dict mapping model names to prediction arrays
            weights: Optional weights (uses current_weights if None)
            
        Returns:
            Weighted average predictions
            
        Raises:
            ValueError: If predictions is empty or weights don't match models
        """
        if not predictions:
            raise ValueError("predictions cannot be empty")
            
        if weights is None:
            weights = self.current_weights
            
        if not weights:
            # Equal weights if no weights specified
            weights = {name: 1.0 / len(predictions) for name in predictions.keys()}
            
        # Validate weights match predictions
        if set(weights.keys()) != set(predictions.keys()):
            raise ValueError("Weight keys must match prediction keys")
            
        # Validate all predictions have same length
        pred_lengths = [len(pred) for pred in predictions.values()]
        if len(set(pred_lengths)) > 1:
            raise ValueError("All predictions must have same length")
            
        # Calculate weighted average
        ensemble_pred = np.zeros(pred_lengths[0])
        
        for name, pred in predictions.items():
            weight = weights[name]
            ensemble_pred += weight * pred
            
        logger.info(f"Combined {len(predictions)} predictions with weights: {weights}")
        
        return ensemble_pred
    
    def update_weights(
        self,
        performance_metrics: Dict[str, List[float]]
    ) -> Dict[str, float]:
        """
        Update ensemble weights based on performance metrics.
        
        Args:
            performance_metrics: Dict mapping model names to MAPE lists
            
        Returns:
            Updated weights
        """
        self.current_weights = self.weight_calculator.calculate_weights(
            performance_metrics
        )
        return self.current_weights.copy()
    
    def get_current_weights(self) -> Dict[str, float]:
        """Get current ensemble weights."""
        return self.current_weights.copy()



class PredictionIntervalGenerator:
    """
    Generates prediction intervals for ensemble forecasts.
    
    Requirements:
    - 4.5: Generate ensemble intervals using quantile regression
    - 10.1: Generate 95% prediction intervals
    - 10.2: Minimize interval width while maintaining 90% coverage
    - 10.5: Use conformal prediction calibration
    """
    
    def __init__(
        self,
        target_coverage: float = 0.90,
        confidence_level: float = 0.95
    ):
        """
        Initialize interval generator.
        
        Args:
            target_coverage: Target coverage rate (default: 0.90)
            confidence_level: Confidence level for intervals (default: 0.95)
        """
        self.target_coverage = target_coverage
        self.confidence_level = confidence_level
        self.calibration_scores: List[float] = []
        
    def generate_intervals(
        self,
        predictions: Dict[str, np.ndarray],
        weights: Optional[Dict[str, float]] = None,
        model_intervals: Optional[Dict[str, Tuple[np.ndarray, np.ndarray]]] = None
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generate ensemble prediction intervals.
        
        Args:
            predictions: Dict mapping model names to point predictions
            weights: Optional weights for each model
            model_intervals: Optional dict of (lower, upper) bounds per model
            
        Returns:
            Tuple of (lower_bounds, upper_bounds)
            
        Raises:
            ValueError: If inputs are invalid
        """
        if not predictions:
            raise ValueError("predictions cannot be empty")
            
        # Use equal weights if not provided
        if weights is None:
            weights = {name: 1.0 / len(predictions) for name in predictions.keys()}
            
        # Validate weights match predictions
        if set(weights.keys()) != set(predictions.keys()):
            raise ValueError("Weight keys must match prediction keys")
            
        # If model intervals provided, use weighted quantile combination
        if model_intervals is not None:
            return self._combine_model_intervals(
                predictions, weights, model_intervals
            )
        
        # Otherwise, use prediction variance to estimate intervals
        return self._estimate_intervals_from_variance(predictions, weights)
    
    def _combine_model_intervals(
        self,
        predictions: Dict[str, np.ndarray],
        weights: Dict[str, float],
        model_intervals: Dict[str, Tuple[np.ndarray, np.ndarray]]
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Combine model-specific intervals using weighted quantiles.
        
        Args:
            predictions: Point predictions per model
            weights: Weights per model
            model_intervals: (lower, upper) bounds per model
            
        Returns:
            Tuple of (lower_bounds, upper_bounds)
        """
        # Validate all models have intervals
        if set(model_intervals.keys()) != set(predictions.keys()):
            raise ValueError("model_intervals keys must match predictions keys")
            
        # Get prediction length
        pred_length = len(next(iter(predictions.values())))
        
        # Initialize arrays
        lower_bounds = np.zeros(pred_length)
        upper_bounds = np.zeros(pred_length)
        
        # For each time step, combine intervals using weighted average
        for i in range(pred_length):
            lower_values = []
            upper_values = []
            weight_list = []
            
            for model_name in predictions.keys():
                lower, upper = model_intervals[model_name]
                lower_values.append(lower[i])
                upper_values.append(upper[i])
                weight_list.append(weights[model_name])
            
            # Weighted average of bounds
            lower_bounds[i] = np.average(lower_values, weights=weight_list)
            upper_bounds[i] = np.average(upper_values, weights=weight_list)
        
        # Apply calibration if available
        if self.calibration_scores:
            lower_bounds, upper_bounds = self._apply_conformal_calibration(
                lower_bounds, upper_bounds
            )
        
        return lower_bounds, upper_bounds
    
    def _estimate_intervals_from_variance(
        self,
        predictions: Dict[str, np.ndarray],
        weights: Dict[str, float]
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Estimate intervals from prediction variance across models.
        
        Args:
            predictions: Point predictions per model
            weights: Weights per model
            
        Returns:
            Tuple of (lower_bounds, upper_bounds)
        """
        # Stack predictions into matrix (models x time_steps)
        pred_matrix = np.array([predictions[name] for name in predictions.keys()])
        
        # Calculate weighted mean
        weight_array = np.array([weights[name] for name in predictions.keys()])
        ensemble_mean = np.average(pred_matrix, axis=0, weights=weight_array)
        
        # Calculate weighted standard deviation
        variance = np.average(
            (pred_matrix - ensemble_mean) ** 2,
            axis=0,
            weights=weight_array
        )
        std = np.sqrt(variance)
        
        # Use z-score for confidence level
        # For 95% confidence: z = 1.96
        z_score = 1.96 if self.confidence_level == 0.95 else 2.576
        
        # Calculate bounds
        lower_bounds = ensemble_mean - z_score * std
        upper_bounds = ensemble_mean + z_score * std
        
        # Apply calibration if available
        if self.calibration_scores:
            lower_bounds, upper_bounds = self._apply_conformal_calibration(
                lower_bounds, upper_bounds
            )
        
        return lower_bounds, upper_bounds
    
    def _apply_conformal_calibration(
        self,
        lower_bounds: np.ndarray,
        upper_bounds: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Apply conformal prediction calibration to adjust interval width.
        
        Args:
            lower_bounds: Initial lower bounds
            upper_bounds: Initial upper bounds
            
        Returns:
            Tuple of (calibrated_lower, calibrated_upper)
        """
        if not self.calibration_scores:
            return lower_bounds, upper_bounds
            
        # Calculate quantile from calibration scores
        alpha = 1 - self.target_coverage
        quantile = np.quantile(self.calibration_scores, 1 - alpha)
        
        # Adjust bounds by quantile
        interval_width = upper_bounds - lower_bounds
        center = (upper_bounds + lower_bounds) / 2
        
        adjusted_width = interval_width * quantile
        
        calibrated_lower = center - adjusted_width / 2
        calibrated_upper = center + adjusted_width / 2
        
        return calibrated_lower, calibrated_upper
    
    def calibrate(
        self,
        predictions: np.ndarray,
        actuals: np.ndarray,
        lower_bounds: np.ndarray,
        upper_bounds: np.ndarray
    ) -> None:
        """
        Calibrate interval generator using historical data.
        
        Args:
            predictions: Historical point predictions
            actuals: Historical actual values
            lower_bounds: Historical lower bounds
            upper_bounds: Historical upper bounds
        """
        if len(predictions) != len(actuals):
            raise ValueError("predictions and actuals must have same length")
            
        if len(predictions) != len(lower_bounds):
            raise ValueError("predictions and lower_bounds must have same length")
            
        if len(predictions) != len(upper_bounds):
            raise ValueError("predictions and upper_bounds must have same length")
            
        # Calculate nonconformity scores
        # Score = max distance from actual to interval bounds
        scores = []
        
        for i in range(len(predictions)):
            actual = actuals[i]
            lower = lower_bounds[i]
            upper = upper_bounds[i]
            
            # Calculate how far actual is from interval
            if actual < lower:
                score = (lower - actual) / (upper - lower + 1e-10)
            elif actual > upper:
                score = (actual - upper) / (upper - lower + 1e-10)
            else:
                score = 0.0
            
            scores.append(score)
        
        self.calibration_scores = scores
        
        # Calculate current coverage
        coverage = np.mean([
            lower_bounds[i] <= actuals[i] <= upper_bounds[i]
            for i in range(len(actuals))
        ])
        
        logger.info(f"Calibrated with {len(scores)} samples")
        logger.info(f"Current coverage: {coverage:.2%}")
        logger.info(f"Target coverage: {self.target_coverage:.2%}")
    
    def calculate_interval_width(
        self,
        lower_bounds: np.ndarray,
        upper_bounds: np.ndarray,
        predictions: np.ndarray
    ) -> float:
        """
        Calculate average interval width as percentage of predicted value.
        
        Args:
            lower_bounds: Lower bounds
            upper_bounds: Upper bounds
            predictions: Point predictions
            
        Returns:
            Average interval width as percentage
        """
        if len(lower_bounds) != len(upper_bounds):
            raise ValueError("lower_bounds and upper_bounds must have same length")
            
        if len(lower_bounds) != len(predictions):
            raise ValueError("bounds and predictions must have same length")
            
        # Calculate width as percentage of prediction
        widths = (upper_bounds - lower_bounds) / (predictions + 1e-10)
        
        return float(np.mean(widths))
    
    def get_calibration_scores(self) -> List[float]:
        """Get calibration scores."""
        return self.calibration_scores.copy()
