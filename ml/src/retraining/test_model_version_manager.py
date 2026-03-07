"""
Tests for ModelVersionManager
"""

import pytest
from datetime import datetime
from unittest.mock import Mock, MagicMock
import json

from src.retraining.model_version_manager import ModelVersionManager


class TestModelVersionManager:
    """Test suite for ModelVersionManager."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.mock_s3 = Mock()
        self.manager = ModelVersionManager(
            s3_client=self.mock_s3,
            versions_bucket='test-bucket'
        )
    
    def test_initialization(self):
        """Test manager initialization."""
        assert self.manager.versions_bucket == 'test-bucket'
        assert self.manager.s3_client == self.mock_s3
    
    def test_create_version_metadata(self):
        """Test creating version metadata."""
        metadata = self.manager.create_version_metadata(
            model_type='lstm',
            version='v1.0',
            training_date=datetime(2024, 1, 1),
            validation_metrics={'mape': 6.5, 'coverage': 91.0},
            hyperparameters={'hidden_size': 128},
            model_s3_path='s3://bucket/models/lstm/v1.0/'
        )
        
        assert metadata['model_type'] == 'lstm'
        assert metadata['version'] == 'v1.0'
        assert metadata['validation_metrics']['mape'] == 6.5
        assert metadata['status'] == 'trained'
    
    def test_save_version_metadata(self):
        """Test saving version metadata."""
        metadata = {
            'model_type': 'lstm',
            'version': 'v1.0',
            'validation_metrics': {'mape': 6.5}
        }
        
        s3_path = self.manager.save_version_metadata(metadata)
        
        assert 's3://test-bucket/versions/lstm/v1.0/metadata.json' in s3_path
        self.mock_s3.put_object.assert_called_once()
    
    def test_set_current_version(self):
        """Test setting current version."""
        s3_path = self.manager.set_current_version(
            'lstm',
            'v1.0',
            deployment_reason='scheduled'
        )
        
        assert 's3://test-bucket/versions/lstm/current.json' in s3_path
        self.mock_s3.put_object.assert_called_once()
    
    def test_rollback_to_version(self):
        """Test rolling back to previous version."""
        # Mock get_current_version
        self.mock_s3.get_object.return_value = {
            'Body': Mock(read=lambda: json.dumps({
                'version': 'v2.0'
            }).encode())
        }
        
        rollback_info = self.manager.rollback_to_version(
            'lstm',
            'v1.0',
            reason='performance_degradation'
        )
        
        assert rollback_info['new_version'] == 'v1.0'
        assert rollback_info['rollback_reason'] == 'performance_degradation'
