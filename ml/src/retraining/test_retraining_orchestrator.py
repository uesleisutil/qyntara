"""
Tests for RetrainingOrchestrator
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, MagicMock

from src.retraining.retraining_orchestrator import RetrainingOrchestrator


class TestRetrainingOrchestrator:
    """Test suite for RetrainingOrchestrator."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.mock_version_manager = Mock()
        self.mock_validator = Mock()
        self.orchestrator = RetrainingOrchestrator(
            version_manager=self.mock_version_manager,
            validator=self.mock_validator
        )
    
    def test_should_trigger_monthly_retraining_first_day(self):
        """Test monthly retraining trigger on first day of month."""
        current_date = datetime(2024, 2, 1)
        last_training = datetime(2024, 1, 1)
        
        should_trigger = self.orchestrator.should_trigger_monthly_retraining(
            current_date,
            last_training
        )
        
        assert should_trigger is True
    
    def test_should_trigger_monthly_retraining_not_first_day(self):
        """Test monthly retraining not triggered on non-first day."""
        current_date = datetime(2024, 2, 15)
        last_training = datetime(2024, 1, 1)
        
        should_trigger = self.orchestrator.should_trigger_monthly_retraining(
            current_date,
            last_training
        )
        
        assert should_trigger is False
    
    def test_should_trigger_emergency_retraining_within_window(self):
        """Test emergency retraining within 4-hour window."""
        drift_time = datetime(2024, 1, 1, 10, 0)
        current_time = datetime(2024, 1, 1, 12, 0)  # 2 hours later
        
        should_trigger = self.orchestrator.should_trigger_emergency_retraining(
            drift_time,
            current_time,
            max_hours=4
        )
        
        assert should_trigger is True
    
    def test_should_trigger_emergency_retraining_outside_window(self):
        """Test emergency retraining outside 4-hour window."""
        drift_time = datetime(2024, 1, 1, 10, 0)
        current_time = datetime(2024, 1, 1, 15, 0)  # 5 hours later
        
        should_trigger = self.orchestrator.should_trigger_emergency_retraining(
            drift_time,
            current_time,
            max_hours=4
        )
        
        assert should_trigger is False
    
    def test_compare_model_performance_improvement(self):
        """Test model performance comparison with improvement."""
        new_metrics = {'mape': 6.0}
        current_metrics = {'mape': 7.0}
        
        should_deploy, change = self.orchestrator.compare_model_performance(
            new_metrics,
            current_metrics,
            metric_name='mape'
        )
        
        assert should_deploy is True
        assert change > 0  # Positive change means improvement for MAPE
    
    def test_compare_model_performance_degradation(self):
        """Test model performance comparison with degradation."""
        new_metrics = {'mape': 8.0}
        current_metrics = {'mape': 7.0}
        
        should_deploy, change = self.orchestrator.compare_model_performance(
            new_metrics,
            current_metrics,
            metric_name='mape'
        )
        
        assert should_deploy is False
        assert change < 0  # Negative change means degradation for MAPE
    
    def test_deploy_model(self):
        """Test model deployment."""
        self.mock_version_manager.load_version_metadata.return_value = {
            'model_type': 'lstm',
            'version': 'v1.0'
        }
        
        result = self.orchestrator.deploy_model(
            'lstm',
            'v1.0',
            deployment_reason='scheduled'
        )
        
        assert result['status'] == 'success'
        assert result['model_type'] == 'lstm'
        assert result['version'] == 'v1.0'
        
        self.mock_version_manager.set_current_version.assert_called_once()
    
    def test_rollback_model(self):
        """Test model rollback."""
        # Mock version history
        self.mock_version_manager.list_versions.return_value = [
            {'version': 'v2.0', 'status': 'deployed'},
            {'version': 'v1.0', 'status': 'deployed'}
        ]
        
        self.mock_version_manager.get_current_version.return_value = {
            'version': 'v2.0'
        }
        
        self.mock_version_manager.rollback_to_version.return_value = {
            'new_version': 'v1.0'
        }
        
        result = self.orchestrator.rollback_model(
            'lstm',
            reason='performance_degradation'
        )
        
        assert result['status'] == 'success'
        self.mock_version_manager.rollback_to_version.assert_called_once()
