"""
Alert Manager

Manages alerts for drift detection and triggers retraining.
Sends SNS alerts for performance drift and feature drift.

Requirements: 7.3, 7.5
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import logging

try:
    import boto3
    from botocore.exceptions import ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False


logger = logging.getLogger(__name__)


class AlertManager:
    """
    Manages alerts for drift detection and triggers retraining.
    
    Sends SNS notifications for performance drift and feature drift.
    Can trigger retraining workflows when drift is detected.
    """
    
    def __init__(
        self,
        sns_topic_arn: Optional[str] = None,
        retraining_topic_arn: Optional[str] = None,
        region_name: str = 'us-east-1'
    ):
        """
        Initialize the alert manager.
        
        Args:
            sns_topic_arn: ARN of SNS topic for drift alerts
            retraining_topic_arn: ARN of SNS topic for retraining triggers
            region_name: AWS region name
        """
        self.sns_topic_arn = sns_topic_arn
        self.retraining_topic_arn = retraining_topic_arn
        self.region_name = region_name
        
        # Initialize SNS client if boto3 is available
        if BOTO3_AVAILABLE and sns_topic_arn:
            self.sns_client = boto3.client('sns', region_name=region_name)
        else:
            self.sns_client = None
            if not BOTO3_AVAILABLE:
                logger.warning("boto3 not available. SNS alerts will be logged only.")
    
    def _send_sns_message(
        self,
        topic_arn: str,
        subject: str,
        message: str,
        message_attributes: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Send SNS message.
        
        Args:
            topic_arn: SNS topic ARN
            subject: Message subject
            message: Message body
            message_attributes: Optional message attributes
            
        Returns:
            True if message sent successfully, False otherwise
        """
        if not self.sns_client:
            logger.warning(f"SNS client not available. Would send: {subject}")
            logger.info(f"Message: {message}")
            return False
        
        try:
            params = {
                'TopicArn': topic_arn,
                'Subject': subject,
                'Message': message
            }
            
            if message_attributes:
                params['MessageAttributes'] = message_attributes
            
            response = self.sns_client.publish(**params)
            
            logger.info(f"SNS message sent. MessageId: {response.get('MessageId')}")
            return True
            
        except ClientError as e:
            logger.error(f"Failed to send SNS message: {e}")
            return False
    
    def send_performance_drift_alert(
        self,
        current_mape: float,
        baseline_mape: float,
        mape_change_percentage: float,
        detection_date: datetime,
        additional_info: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Send alert for performance drift.
        
        Args:
            current_mape: Current MAPE value
            baseline_mape: Baseline MAPE value
            mape_change_percentage: Percentage change in MAPE
            detection_date: Date of drift detection
            additional_info: Optional additional information
            
        Returns:
            True if alert sent successfully, False otherwise
        """
        subject = f"⚠️ Performance Drift Detected - MAPE Increased by {mape_change_percentage*100:.1f}%"
        
        message_data = {
            'alert_type': 'performance_drift',
            'detection_date': detection_date.isoformat(),
            'current_mape': current_mape,
            'baseline_mape': baseline_mape,
            'mape_change_percentage': mape_change_percentage,
            'mape_increase_percent': mape_change_percentage * 100
        }
        
        if additional_info:
            message_data.update(additional_info)
        
        message = f"""
Performance Drift Alert
=======================

Detection Date: {detection_date.strftime('%Y-%m-%d %H:%M:%S')}

Metrics:
- Current MAPE: {current_mape:.4f}
- Baseline MAPE: {baseline_mape:.4f}
- Change: {mape_change_percentage*100:+.2f}%

The model performance has degraded significantly. 
Retraining may be required to restore accuracy.

Details:
{json.dumps(message_data, indent=2)}
"""
        
        if not self.sns_topic_arn:
            logger.warning("SNS topic ARN not configured for alerts")
            logger.info(f"Performance drift alert: {subject}")
            return False
        
        return self._send_sns_message(
            self.sns_topic_arn,
            subject,
            message
        )
    
    def send_feature_drift_alert(
        self,
        drifted_features: List[str],
        total_features: int,
        drift_percentage: float,
        detection_date: datetime,
        drift_details: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> bool:
        """
        Send alert for feature drift.
        
        Args:
            drifted_features: List of features with detected drift
            total_features: Total number of features tested
            drift_percentage: Percentage of features with drift
            detection_date: Date of drift detection
            drift_details: Optional detailed drift results per feature
            
        Returns:
            True if alert sent successfully, False otherwise
        """
        num_drifted = len(drifted_features)
        
        subject = f"⚠️ Feature Drift Detected - {num_drifted}/{total_features} Features Drifting"
        
        message_data = {
            'alert_type': 'feature_drift',
            'detection_date': detection_date.isoformat(),
            'drifted_features_count': num_drifted,
            'total_features': total_features,
            'drift_percentage': drift_percentage,
            'drifted_features': drifted_features
        }
        
        if drift_details:
            message_data['drift_details'] = drift_details
        
        # Format drifted features list
        features_list = '\n'.join([f"  - {feature}" for feature in drifted_features[:10]])
        if num_drifted > 10:
            features_list += f"\n  ... and {num_drifted - 10} more"
        
        message = f"""
Feature Drift Alert
===================

Detection Date: {detection_date.strftime('%Y-%m-%d %H:%M:%S')}

Summary:
- Drifted Features: {num_drifted}/{total_features} ({drift_percentage:.1f}%)

Drifted Features:
{features_list}

The input feature distributions have changed significantly.
This may indicate data quality issues or changing market conditions.

Details:
{json.dumps(message_data, indent=2)}
"""
        
        if not self.sns_topic_arn:
            logger.warning("SNS topic ARN not configured for alerts")
            logger.info(f"Feature drift alert: {subject}")
            return False
        
        return self._send_sns_message(
            self.sns_topic_arn,
            subject,
            message
        )
    
    def trigger_retraining(
        self,
        reason: str,
        drift_type: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Trigger model retraining workflow.
        
        Args:
            reason: Reason for retraining
            drift_type: Type of drift detected ('performance' or 'feature')
            metadata: Optional metadata about the drift
            
        Returns:
            True if retraining triggered successfully, False otherwise
        """
        subject = f"🔄 Retraining Triggered - {drift_type.title()} Drift"
        
        message_data = {
            'action': 'trigger_retraining',
            'reason': reason,
            'drift_type': drift_type,
            'timestamp': datetime.now().isoformat()
        }
        
        if metadata:
            # Convert datetime objects to ISO format strings for JSON serialization
            serializable_metadata = {}
            for key, value in metadata.items():
                if isinstance(value, datetime):
                    serializable_metadata[key] = value.isoformat()
                else:
                    serializable_metadata[key] = value
            message_data['metadata'] = serializable_metadata
        
        message = f"""
Retraining Trigger
==================

Reason: {reason}
Drift Type: {drift_type}
Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Automated retraining workflow has been initiated.

Details:
{json.dumps(message_data, indent=2)}
"""
        
        if not self.retraining_topic_arn:
            logger.warning("Retraining topic ARN not configured")
            logger.info(f"Would trigger retraining: {reason}")
            return False
        
        return self._send_sns_message(
            self.retraining_topic_arn,
            subject,
            message
        )
    
    def handle_performance_drift(
        self,
        drift_result: Dict[str, Any],
        trigger_retraining: bool = True
    ) -> Dict[str, bool]:
        """
        Handle performance drift detection.
        
        Sends alert and optionally triggers retraining.
        
        Args:
            drift_result: Result from PerformanceDriftDetector
            trigger_retraining: Whether to trigger retraining (default: True)
            
        Returns:
            Dictionary with 'alert_sent' and 'retraining_triggered' status
        """
        alert_sent = self.send_performance_drift_alert(
            current_mape=drift_result['current_mape'],
            baseline_mape=drift_result['baseline_mape'],
            mape_change_percentage=drift_result['mape_change_percentage'],
            detection_date=drift_result['detection_date'],
            additional_info={
                'window_days': drift_result.get('window_days'),
                'drift_threshold': drift_result.get('drift_threshold')
            }
        )
        
        retraining_triggered = False
        if trigger_retraining:
            retraining_triggered = self.trigger_retraining(
                reason=f"Performance drift detected: MAPE increased by {drift_result['mape_change_percentage']*100:.1f}%",
                drift_type='performance',
                metadata=drift_result
            )
        
        return {
            'alert_sent': alert_sent,
            'retraining_triggered': retraining_triggered
        }
    
    def handle_feature_drift(
        self,
        drift_summary: Dict[str, Any],
        drift_results: Dict[str, Dict[str, Any]],
        detection_date: datetime,
        trigger_retraining: bool = True
    ) -> Dict[str, bool]:
        """
        Handle feature drift detection.
        
        Sends alert and optionally triggers retraining.
        
        Args:
            drift_summary: Summary from FeatureDriftDetector
            drift_results: Detailed results from FeatureDriftDetector
            detection_date: Date of drift detection
            trigger_retraining: Whether to trigger retraining (default: True)
            
        Returns:
            Dictionary with 'alert_sent' and 'retraining_triggered' status
        """
        alert_sent = self.send_feature_drift_alert(
            drifted_features=drift_summary['drifted_features'],
            total_features=drift_summary['total_features'],
            drift_percentage=drift_summary['drift_percentage'],
            detection_date=detection_date,
            drift_details=drift_results
        )
        
        retraining_triggered = False
        if trigger_retraining:
            retraining_triggered = self.trigger_retraining(
                reason=f"Feature drift detected: {drift_summary['drifted_features_count']} features drifting",
                drift_type='feature',
                metadata={
                    'drift_summary': drift_summary,
                    'detection_date': detection_date.isoformat()
                }
            )
        
        return {
            'alert_sent': alert_sent,
            'retraining_triggered': retraining_triggered
        }
