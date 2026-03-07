"""
Tests for EnsembleContributionAnalyzer

Tests ensemble contribution analysis and dominant model identification.
"""

import pytest
import numpy as np
import pandas as pd

from src.explainability.ensemble_contribution_analyzer import EnsembleContributionAnalyzer


class TestEnsembleContributionAnalyzer:
    """Test suite for EnsembleContributionAnalyzer."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.analyzer = EnsembleContributionAnalyzer(uncertainty_threshold=0.15)
        
        # Create sample predictions
        self.predictions = {
            'model_a': np.array([10.0, 20.0, 30.0]),
            'model_b': np.array([12.0, 19.0, 31.0]),
            'model_c': np.array([11.0, 21.0, 29.0])
        }
        
        self.weights = {
            'model_a': 0.4,
            'model_b': 0.3,
            'model_c': 0.3
        }
        
        # Calculate ensemble prediction
        self.ensemble_prediction = np.array([
            10.0 * 0.4 + 12.0 * 0.3 + 11.0 * 0.3,
            20.0 * 0.4 + 19.0 * 0.3 + 21.0 * 0.3,
            30.0 * 0.4 + 31.0 * 0.3 + 29.0 * 0.3
        ])
    
    def test_initialization(self):
        """Test analyzer initialization."""
        assert self.analyzer.uncertainty_threshold == 0.15
    
    def test_identify_dominant_model(self):
        """Test identifying dominant model for each prediction."""
        dominant_models = self.analyzer.identify_dominant_model(
            self.predictions,
            self.weights,
            self.ensemble_prediction
        )
        
        assert len(dominant_models) == 3
        assert all(model in ['model_a', 'model_b', 'model_c'] for model in dominant_models)
    
    def test_calculate_model_contributions(self):
        """Test calculating weighted model contributions."""
        contributions = self.analyzer.calculate_model_contributions(
            self.predictions,
            self.weights
        )
        
        assert len(contributions) == 3
        assert 'model_a' in contributions
        assert 'model_b' in contributions
        assert 'model_c' in contributions
        
        # Check that contributions are weighted correctly
        np.testing.assert_array_almost_equal(
            contributions['model_a'],
            self.predictions['model_a'] * 0.4
        )
    
    def test_calculate_prediction_uncertainty(self):
        """Test calculating prediction uncertainty."""
        uncertainty = self.analyzer.calculate_prediction_uncertainty(
            self.predictions,
            self.ensemble_prediction
        )
        
        assert len(uncertainty) == 3
        assert all(uncertainty >= 0)
    
    def test_calculate_prediction_uncertainty_high_disagreement(self):
        """Test uncertainty calculation with high model disagreement."""
        # Create predictions with high disagreement
        predictions = {
            'model_a': np.array([10.0]),
            'model_b': np.array([20.0]),
            'model_c': np.array([30.0])
        }
        ensemble_pred = np.array([20.0])
        
        uncertainty = self.analyzer.calculate_prediction_uncertainty(
            predictions,
            ensemble_pred
        )
        
        # High disagreement should result in high uncertainty
        assert uncertainty[0] > 0.3
    
    def test_calculate_prediction_uncertainty_low_disagreement(self):
        """Test uncertainty calculation with low model disagreement."""
        # Create predictions with low disagreement
        predictions = {
            'model_a': np.array([10.0]),
            'model_b': np.array([10.1]),
            'model_c': np.array([9.9])
        }
        ensemble_pred = np.array([10.0])
        
        uncertainty = self.analyzer.calculate_prediction_uncertainty(
            predictions,
            ensemble_pred
        )
        
        # Low disagreement should result in low uncertainty
        assert uncertainty[0] < 0.05
    
    def test_identify_high_uncertainty_predictions(self):
        """Test identifying high uncertainty predictions."""
        # Create predictions with varying uncertainty
        predictions = {
            'model_a': np.array([10.0, 20.0, 30.0]),
            'model_b': np.array([10.1, 25.0, 30.5]),
            'model_c': np.array([9.9, 15.0, 29.5])
        }
        ensemble_pred = np.array([10.0, 20.0, 30.0])
        
        high_uncertainty = self.analyzer.identify_high_uncertainty_predictions(
            predictions,
            ensemble_pred,
            threshold=0.10
        )
        
        assert len(high_uncertainty) == 3
        assert isinstance(high_uncertainty, np.ndarray)
        assert high_uncertainty.dtype == bool
    
    def test_identify_high_uncertainty_predictions_custom_threshold(self):
        """Test identifying high uncertainty with custom threshold."""
        high_uncertainty = self.analyzer.identify_high_uncertainty_predictions(
            self.predictions,
            self.ensemble_prediction,
            threshold=0.01
        )
        
        # With very low threshold, more predictions should be flagged
        assert high_uncertainty.any()
    
    def test_explain_high_uncertainty_prediction(self):
        """Test explaining a high uncertainty prediction."""
        explanation = self.analyzer.explain_high_uncertainty_prediction(
            self.predictions,
            self.weights,
            self.ensemble_prediction,
            prediction_idx=0
        )
        
        assert 'prediction_idx' in explanation
        assert 'ensemble_prediction' in explanation
        assert 'uncertainty' in explanation
        assert 'model_predictions' in explanation
        assert 'model_contributions' in explanation
        assert 'model_weights' in explanation
        assert 'disagreement_metrics' in explanation
        assert 'outlier_models' in explanation
        
        assert explanation['prediction_idx'] == 0
        assert len(explanation['model_predictions']) == 3
        assert len(explanation['model_contributions']) == 3
    
    def test_explain_high_uncertainty_prediction_with_features(self):
        """Test explaining prediction with feature values."""
        feature_values = {
            'feature_1': 100.0,
            'feature_2': 200.0
        }
        
        explanation = self.analyzer.explain_high_uncertainty_prediction(
            self.predictions,
            self.weights,
            self.ensemble_prediction,
            prediction_idx=1,
            feature_values=feature_values
        )
        
        assert 'feature_values' in explanation
        assert explanation['feature_values'] == feature_values
    
    def test_generate_contribution_report(self):
        """Test generating contribution report."""
        report = self.analyzer.generate_contribution_report(
            self.predictions,
            self.weights,
            self.ensemble_prediction
        )
        
        assert isinstance(report, pd.DataFrame)
        assert len(report) == 3
        
        # Check required columns
        assert 'prediction_idx' in report.columns
        assert 'ensemble_prediction' in report.columns
        assert 'uncertainty' in report.columns
        assert 'high_uncertainty' in report.columns
        assert 'dominant_model' in report.columns
        
        # Check model prediction columns
        assert 'model_a_prediction' in report.columns
        assert 'model_b_prediction' in report.columns
        assert 'model_c_prediction' in report.columns
        
        # Check contribution columns
        assert 'model_a_contribution' in report.columns
        assert 'model_b_contribution' in report.columns
        assert 'model_c_contribution' in report.columns
    
    def test_generate_contribution_report_with_symbols(self):
        """Test generating contribution report with stock symbols."""
        stock_symbols = ['PETR4', 'VALE3', 'ITUB4']
        
        report = self.analyzer.generate_contribution_report(
            self.predictions,
            self.weights,
            self.ensemble_prediction,
            stock_symbols=stock_symbols
        )
        
        assert 'stock_symbol' in report.columns
        assert list(report['stock_symbol']) == stock_symbols
    
    def test_analyze_model_dominance(self):
        """Test analyzing overall model dominance."""
        analysis = self.analyzer.analyze_model_dominance(
            self.predictions,
            self.weights,
            self.ensemble_prediction
        )
        
        assert 'dominance_frequency' in analysis
        assert 'dominance_percentage' in analysis
        assert 'average_contributions' in analysis
        assert 'model_agreement_with_ensemble' in analysis
        assert 'weights' in analysis
        
        # Check that percentages sum to 100
        total_percentage = sum(analysis['dominance_percentage'].values())
        assert pytest.approx(total_percentage, rel=0.01) == 100.0
        
        # Check that all models have agreement scores
        assert len(analysis['model_agreement_with_ensemble']) == 3
        
        # Agreement should be between -1 and 1
        for agreement in analysis['model_agreement_with_ensemble'].values():
            assert -1 <= agreement <= 1
    
    def test_analyze_model_dominance_single_dominant(self):
        """Test dominance analysis when one model dominates."""
        # Create predictions where model_a is always closest
        predictions = {
            'model_a': np.array([10.0, 20.0, 30.0]),
            'model_b': np.array([15.0, 25.0, 35.0]),
            'model_c': np.array([15.0, 25.0, 35.0])
        }
        
        weights = {
            'model_a': 0.5,
            'model_b': 0.25,
            'model_c': 0.25
        }
        
        ensemble_pred = np.array([
            10.0 * 0.5 + 15.0 * 0.25 + 15.0 * 0.25,
            20.0 * 0.5 + 25.0 * 0.25 + 25.0 * 0.25,
            30.0 * 0.5 + 35.0 * 0.25 + 35.0 * 0.25
        ])
        
        analysis = self.analyzer.analyze_model_dominance(
            predictions,
            weights,
            ensemble_pred
        )
        
        # model_a should dominate all predictions
        assert analysis['dominance_frequency']['model_a'] == 3
        assert analysis['dominance_percentage']['model_a'] == 100.0
