"""
Model Version Manager

Manages model versions, deployment, and rollback.
Maintains version history with performance metrics.

Requirements: 12.5
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import logging

try:
    import boto3
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False

logger = logging.getLogger(__name__)


class ModelVersionManager:
    """
    Manages model versions and deployment history.
    
    Tracks model versions, performance metrics, and enables rollback
    to previous versions when needed.
    """
    
    def __init__(
        self,
        s3_client=None,
        versions_bucket: Optional[str] = None,
        region_name: str = 'us-east-1'
    ):
        """
        Initialize model version manager.
        
        Args:
            s3_client: Optional S3 client
            versions_bucket: S3 bucket for version metadata
            region_name: AWS region name
        """
        self.versions_bucket = versions_bucket
        self.region_name = region_name
        
        if BOTO3_AVAILABLE and s3_client is None:
            self.s3_client = boto3.client('s3', region_name=region_name)
        else:
            self.s3_client = s3_client
    
    def create_version_metadata(
        self,
        model_type: str,
        version: str,
        training_date: datetime,
        validation_metrics: Dict[str, float],
        hyperparameters: Dict[str, Any],
        model_s3_path: str,
        additional_info: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create version metadata.
        
        Args:
            model_type: Type of model (deepar, lstm, prophet, xgboost)
            version: Version identifier
            training_date: Date when model was trained
            validation_metrics: Validation metrics (MAPE, coverage, etc.)
            hyperparameters: Model hyperparameters
            model_s3_path: S3 path to model artifacts
            additional_info: Optional additional information
            
        Returns:
            Version metadata dictionary
        """
        metadata = {
            'model_type': model_type,
            'version': version,
            'training_date': training_date.isoformat(),
            'validation_metrics': validation_metrics,
            'hyperparameters': hyperparameters,
            'model_s3_path': model_s3_path,
            'created_at': datetime.now().isoformat(),
            'status': 'trained'
        }
        
        if additional_info:
            metadata.update(additional_info)
        
        return metadata
    
    def save_version_metadata(
        self,
        metadata: Dict[str, Any]
    ) -> str:
        """
        Save version metadata to S3.
        
        Args:
            metadata: Version metadata dictionary
            
        Returns:
            S3 path where metadata was saved
        """
        if not self.s3_client or not self.versions_bucket:
            logger.warning("S3 client or bucket not configured")
            return ""
        
        model_type = metadata['model_type']
        version = metadata['version']
        
        key = f"versions/{model_type}/{version}/metadata.json"
        
        self.s3_client.put_object(
            Bucket=self.versions_bucket,
            Key=key,
            Body=json.dumps(metadata, indent=2),
            ContentType='application/json'
        )
        
        s3_path = f"s3://{self.versions_bucket}/{key}"
        logger.info(f"Saved version metadata to {s3_path}")
        
        return s3_path
    
    def load_version_metadata(
        self,
        model_type: str,
        version: str
    ) -> Dict[str, Any]:
        """
        Load version metadata from S3.
        
        Args:
            model_type: Type of model
            version: Version identifier
            
        Returns:
            Version metadata dictionary
        """
        if not self.s3_client or not self.versions_bucket:
            raise ValueError("S3 client or bucket not configured")
        
        key = f"versions/{model_type}/{version}/metadata.json"
        
        obj = self.s3_client.get_object(
            Bucket=self.versions_bucket,
            Key=key
        )
        
        metadata = json.loads(obj['Body'].read())
        
        return metadata
    
    def list_versions(
        self,
        model_type: str,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        List all versions for a model type.
        
        Args:
            model_type: Type of model
            limit: Optional limit on number of versions to return
            
        Returns:
            List of version metadata dictionaries, sorted by creation date
        """
        if not self.s3_client or not self.versions_bucket:
            logger.warning("S3 client or bucket not configured")
            return []
        
        prefix = f"versions/{model_type}/"
        
        response = self.s3_client.list_objects_v2(
            Bucket=self.versions_bucket,
            Prefix=prefix
        )
        
        if 'Contents' not in response:
            return []
        
        # Load metadata for each version
        versions = []
        
        for obj in response['Contents']:
            if obj['Key'].endswith('metadata.json'):
                try:
                    version_key = obj['Key']
                    obj_data = self.s3_client.get_object(
                        Bucket=self.versions_bucket,
                        Key=version_key
                    )
                    metadata = json.loads(obj_data['Body'].read())
                    versions.append(metadata)
                except Exception as e:
                    logger.warning(f"Error loading version from {obj['Key']}: {e}")
                    continue
        
        # Sort by creation date (newest first)
        versions.sort(
            key=lambda x: x.get('created_at', ''),
            reverse=True
        )
        
        if limit:
            versions = versions[:limit]
        
        return versions
    
    def get_current_version(
        self,
        model_type: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get currently deployed version.
        
        Args:
            model_type: Type of model
            
        Returns:
            Current version metadata or None if not found
        """
        if not self.s3_client or not self.versions_bucket:
            logger.warning("S3 client or bucket not configured")
            return None
        
        key = f"versions/{model_type}/current.json"
        
        try:
            obj = self.s3_client.get_object(
                Bucket=self.versions_bucket,
                Key=key
            )
            
            current_info = json.loads(obj['Body'].read())
            
            # Load full metadata for current version
            return self.load_version_metadata(
                model_type,
                current_info['version']
            )
            
        except self.s3_client.exceptions.NoSuchKey:
            logger.info(f"No current version found for {model_type}")
            return None
        except Exception as e:
            logger.error(f"Error loading current version: {e}")
            return None
    
    def set_current_version(
        self,
        model_type: str,
        version: str,
        deployment_reason: str = "manual"
    ) -> str:
        """
        Set the current deployed version.
        
        Args:
            model_type: Type of model
            version: Version to deploy
            deployment_reason: Reason for deployment
            
        Returns:
            S3 path where current version info was saved
        """
        if not self.s3_client or not self.versions_bucket:
            raise ValueError("S3 client or bucket not configured")
        
        current_info = {
            'model_type': model_type,
            'version': version,
            'deployed_at': datetime.now().isoformat(),
            'deployment_reason': deployment_reason
        }
        
        key = f"versions/{model_type}/current.json"
        
        self.s3_client.put_object(
            Bucket=self.versions_bucket,
            Key=key,
            Body=json.dumps(current_info, indent=2),
            ContentType='application/json'
        )
        
        s3_path = f"s3://{self.versions_bucket}/{key}"
        logger.info(f"Set current version to {version} for {model_type}")
        
        return s3_path
    
    def rollback_to_version(
        self,
        model_type: str,
        version: str,
        reason: str = "performance_degradation"
    ) -> Dict[str, Any]:
        """
        Rollback to a previous version.
        
        Args:
            model_type: Type of model
            version: Version to rollback to
            reason: Reason for rollback
            
        Returns:
            Dictionary with rollback details
        """
        # Get current version before rollback
        current_version = self.get_current_version(model_type)
        
        # Set new current version
        self.set_current_version(
            model_type,
            version,
            deployment_reason=f"rollback: {reason}"
        )
        
        # Load new version metadata
        new_version_metadata = self.load_version_metadata(model_type, version)
        
        rollback_info = {
            'model_type': model_type,
            'previous_version': current_version['version'] if current_version else None,
            'new_version': version,
            'rollback_reason': reason,
            'rollback_timestamp': datetime.now().isoformat(),
            'new_version_metrics': new_version_metadata.get('validation_metrics', {})
        }
        
        logger.info(
            f"Rolled back {model_type} from "
            f"{rollback_info['previous_version']} to {version}"
        )
        
        return rollback_info
    
    def get_version_history(
        self,
        model_type: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get deployment history for a model type.
        
        Args:
            model_type: Type of model
            limit: Maximum number of history entries to return
            
        Returns:
            List of deployment history entries
        """
        versions = self.list_versions(model_type, limit=limit)
        
        # Enrich with deployment information
        for version in versions:
            # Check if this version was ever deployed
            version['was_deployed'] = version.get('status') == 'deployed'
        
        return versions
