"""
Retraining Orchestrator

Orchestrates model retraining with validation and deployment.
Handles monthly scheduled retraining and emergency retraining on drift detection.

Requirements: 12.1, 12.2, 12.3, 12.4
"""

from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import logging
import json

try:
    import boto3
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False

from src.retraining.model_version_manager import ModelVersionManager
from src.models.walk_forward_validator import WalkForwardValidator

logger = logging.getLogger(__name__)


class RetrainingOrchestrator:
    """
    Orchestrates model retraining workflow.
    
    Handles:
    - Monthly scheduled retraining
    - Emergency retraining on drift detection
    - Model validation before deployment
    - Automatic rollback on performance degradation
    """
    
    def __init__(
        self,
        s3_client=None,
        lambda_client=None,
        version_manager: Optional[ModelVersionManager] = None,
        validator: Optional[WalkForwardValidator] = None
    ):
        """
        Initialize retraining orchestrator.
        
        Args:
            s3_client: Optional S3 client
            lambda_client: Optional Lambda client
            version_manager: Optional ModelVersionManager instance
            validator: Optional WalkForwardValidator instance
        """
        if BOTO3_AVAILABLE:
            self.s3_client = s3_client or boto3.client('s3')
            self.lambda_client = lambda_client or boto3.client('lambda')
        else:
            self.s3_client = s3_client
            self.lambda_client = lambda_client
        
        self.version_manager = version_manager or ModelVersionManager(s3_client=self.s3_client)
        self.validator = validator or WalkForwardValidator()
    
    def should_trigger_monthly_retraining(
        self,
        current_date: datetime,
        last_training_date: Optional[datetime] = None
    ) -> bool:
        """
        Check if monthly retraining should be triggered.
        
        Monthly retraining occurs on the first day of each month.
        
        Args:
            current_date: Current date
            last_training_date: Date of last training
            
        Returns:
            True if retraining should be triggered
        """
        # Check if it's the first day of the month
        if current_date.day != 1:
            return False
        
        # If no last training date, trigger retraining
        if last_training_date is None:
            return True
        
        # Check if at least 28 days have passed since last training
        days_since_training = (current_date - last_training_date).days
        
        return days_since_training >= 28
    
    def should_trigger_emergency_retraining(
        self,
        drift_alert_time: datetime,
        current_time: datetime,
        max_hours: int = 4
    ) -> bool:
        """
        Check if emergency retraining should be triggered.
        
        Emergency retraining should occur within 4 hours of drift alert.
        
        Args:
            drift_alert_time: Time when drift was detected
            current_time: Current time
            max_hours: Maximum hours to wait before retraining
            
        Returns:
            True if emergency retraining should be triggered
        """
        hours_since_alert = (current_time - drift_alert_time).total_seconds() / 3600
        
        return hours_since_alert <= max_hours
    
    def invoke_training_lambda(
        self,
        training_lambda_arn: str,
        training_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Invoke training Lambda function.
        
        Args:
            training_lambda_arn: ARN of training Lambda
            training_config: Training configuration
            
        Returns:
            Training result
        """
        if not self.lambda_client:
            logger.warning("Lambda client not available")
            return {'status': 'error', 'message': 'Lambda client not available'}
        
        logger.info(f"Invoking training Lambda: {training_lambda_arn}")
        
        response = self.lambda_client.invoke(
            FunctionName=training_lambda_arn,
            InvocationType='RequestResponse',
            Payload=json.dumps(training_config)
        )
        
        result = json.loads(response['Payload'].read())
        
        return result
    
    def validate_retrained_model(
        self,
        model_type: str,
        model_s3_path: str,
        validation_data_path: str
    ) -> Dict[str, float]:
        """
        Validate retrained model using walk-forward validation.
        
        Args:
            model_type: Type of model
            model_s3_path: S3 path to model artifacts
            validation_data_path: S3 path to validation data
            
        Returns:
            Dictionary with validation metrics
        """
        logger.info(f"Validating retrained {model_type} model")
        
        # In a real implementation, this would:
        # 1. Load the model from S3
        # 2. Load validation data
        # 3. Run walk-forward validation
        # 4. Calculate metrics
        
        # For now, return placeholder metrics
        # This should be implemented based on specific model types
        
        metrics = {
            'mape': 0.0,
            'mae': 0.0,
            'rmse': 0.0,
            'coverage': 0.0
        }
        
        logger.info(f"Validation metrics: {metrics}")
        
        return metrics
    
    def compare_model_performance(
        self,
        new_metrics: Dict[str, float],
        current_metrics: Dict[str, float],
        metric_name: str = 'mape',
        improvement_threshold: float = 0.0
    ) -> Tuple[bool, float]:
        """
        Compare new model performance against current model.
        
        Args:
            new_metrics: Metrics from new model
            current_metrics: Metrics from current model
            metric_name: Metric to compare (default: mape)
            improvement_threshold: Minimum improvement required
            
        Returns:
            Tuple of (should_deploy, performance_change)
        """
        new_value = new_metrics.get(metric_name, float('inf'))
        current_value = current_metrics.get(metric_name, float('inf'))
        
        # For MAPE, lower is better
        if metric_name in ['mape', 'mae', 'rmse']:
            performance_change = (current_value - new_value) / current_value
            should_deploy = new_value <= current_value * (1 + improvement_threshold)
        else:
            # For coverage, higher is better
            performance_change = (new_value - current_value) / current_value
            should_deploy = new_value >= current_value * (1 - improvement_threshold)
        
        logger.info(
            f"Performance comparison - Current: {current_value:.4f}, "
            f"New: {new_value:.4f}, Change: {performance_change*100:.2f}%"
        )
        
        return should_deploy, performance_change
    
    def deploy_model(
        self,
        model_type: str,
        version: str,
        deployment_reason: str = "scheduled_retraining"
    ) -> Dict[str, Any]:
        """
        Deploy a model version.
        
        Args:
            model_type: Type of model
            version: Version to deploy
            deployment_reason: Reason for deployment
            
        Returns:
            Deployment result
        """
        logger.info(f"Deploying {model_type} version {version}")
        
        # Set as current version
        self.version_manager.set_current_version(
            model_type,
            version,
            deployment_reason=deployment_reason
        )
        
        # Update version metadata status
        metadata = self.version_manager.load_version_metadata(model_type, version)
        metadata['status'] = 'deployed'
        metadata['deployed_at'] = datetime.now().isoformat()
        self.version_manager.save_version_metadata(metadata)
        
        return {
            'status': 'success',
            'model_type': model_type,
            'version': version,
            'deployment_reason': deployment_reason,
            'deployed_at': datetime.now().isoformat()
        }
    
    def rollback_model(
        self,
        model_type: str,
        reason: str = "performance_degradation"
    ) -> Dict[str, Any]:
        """
        Rollback to previous model version.
        
        Args:
            model_type: Type of model
            reason: Reason for rollback
            
        Returns:
            Rollback result
        """
        logger.warning(f"Rolling back {model_type} model: {reason}")
        
        # Get version history
        versions = self.version_manager.list_versions(model_type, limit=5)
        
        if len(versions) < 2:
            return {
                'status': 'error',
                'message': 'No previous version available for rollback'
            }
        
        # Get current version
        current_version = self.version_manager.get_current_version(model_type)
        
        # Find previous deployed version
        previous_version = None
        for version in versions:
            if version['version'] != current_version['version']:
                if version.get('status') == 'deployed':
                    previous_version = version
                    break
        
        if not previous_version:
            # If no previous deployed version, use the second most recent
            previous_version = versions[1]
        
        # Perform rollback
        rollback_info = self.version_manager.rollback_to_version(
            model_type,
            previous_version['version'],
            reason=reason
        )
        
        return {
            'status': 'success',
            'rollback_info': rollback_info
        }
    
    def retrain_model(
        self,
        model_type: str,
        training_config: Dict[str, Any],
        retraining_reason: str = "scheduled",
        auto_deploy: bool = True
    ) -> Dict[str, Any]:
        """
        Retrain a model with validation and optional deployment.
        
        Args:
            model_type: Type of model to retrain
            training_config: Training configuration
            retraining_reason: Reason for retraining
            auto_deploy: Whether to auto-deploy if validation passes
            
        Returns:
            Retraining result
        """
        logger.info(f"Starting retraining for {model_type}: {retraining_reason}")
        
        start_time = datetime.now()
        
        # Generate new version identifier
        new_version = f"v{start_time.strftime('%Y%m%d_%H%M%S')}"
        
        # Get current version for comparison
        current_version = self.version_manager.get_current_version(model_type)
        
        # Invoke training Lambda
        training_result = self.invoke_training_lambda(
            training_config.get('training_lambda_arn', ''),
            {
                'model_type': model_type,
                'version': new_version,
                **training_config
            }
        )
        
        if training_result.get('status') != 'success':
            return {
                'status': 'error',
                'message': 'Training failed',
                'training_result': training_result
            }
        
        # Validate retrained model
        validation_metrics = self.validate_retrained_model(
            model_type,
            training_result.get('model_s3_path', ''),
            training_config.get('validation_data_path', '')
        )
        
        # Save version metadata
        metadata = self.version_manager.create_version_metadata(
            model_type=model_type,
            version=new_version,
            training_date=start_time,
            validation_metrics=validation_metrics,
            hyperparameters=training_config.get('hyperparameters', {}),
            model_s3_path=training_result.get('model_s3_path', ''),
            additional_info={
                'retraining_reason': retraining_reason,
                'training_duration_seconds': (datetime.now() - start_time).total_seconds()
            }
        )
        
        self.version_manager.save_version_metadata(metadata)
        
        # Compare with current version
        should_deploy = True
        performance_change = 0.0
        
        if current_version and auto_deploy:
            should_deploy, performance_change = self.compare_model_performance(
                validation_metrics,
                current_version.get('validation_metrics', {}),
                metric_name='mape'
            )
        
        # Deploy or rollback
        deployment_result = None
        
        if should_deploy and auto_deploy:
            deployment_result = self.deploy_model(
                model_type,
                new_version,
                deployment_reason=retraining_reason
            )
        elif not should_deploy and current_version:
            logger.warning(
                f"New model performance degraded by {abs(performance_change)*100:.2f}%. "
                "Keeping current version."
            )
            deployment_result = {
                'status': 'skipped',
                'reason': 'performance_degradation',
                'performance_change': performance_change
            }
        
        return {
            'status': 'success',
            'model_type': model_type,
            'new_version': new_version,
            'validation_metrics': validation_metrics,
            'deployed': should_deploy and auto_deploy,
            'deployment_result': deployment_result,
            'performance_change': performance_change,
            'retraining_duration_seconds': (datetime.now() - start_time).total_seconds()
        }
