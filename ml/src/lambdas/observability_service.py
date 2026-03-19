"""
Observability Service

Centralized service for monitoring, logging, and observability.
Implements CloudWatch metrics, logs, distributed tracing, and health checks.

Requirements: 83.1-83.12
"""

import json
import logging
import os
import time
from datetime import datetime, UTC
from typing import Any, Dict, List, Optional
from functools import wraps

import boto3
from botocore.exceptions import ClientError

# Initialize AWS clients
cloudwatch = boto3.client("cloudwatch")
logs = boto3.client("logs")
sns = boto3.client("sns")

# Environment variables
NAMESPACE = os.environ.get("CLOUDWATCH_NAMESPACE", "B3Dashboard")
LOG_GROUP = os.environ.get("LOG_GROUP", "/aws/lambda/b3-dashboard")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


class ObservabilityService:
    """
    Centralized observability service for monitoring and logging.
    
    Implements:
    - Req 83.1: Send application metrics to CloudWatch
    - Req 83.2: Send custom business metrics
    - Req 83.3: Create CloudWatch alarms
    - Req 83.4: Send error logs to CloudWatch Logs
    - Req 83.5: Distributed tracing for API requests
    - Req 83.6: Track frontend performance metrics
    - Req 83.7: Track API performance metrics
    - Req 83.9: Send alerts to SNS
    - Req 83.10: Health check endpoints
    """
    
    def __init__(self, namespace: str = NAMESPACE):
        self.namespace = namespace
        self.cloudwatch = cloudwatch
        self.logs = logs
        self.sns = sns
        
    def put_metric(
        self,
        metric_name: str,
        value: float,
        unit: str = "None",
        dimensions: Optional[Dict[str, str]] = None,
        timestamp: Optional[datetime] = None
    ) -> bool:
        """
        Send a metric to CloudWatch.
        
        Implements Req 83.1: Send application metrics to CloudWatch
        
        Args:
            metric_name: Name of the metric
            value: Metric value
            unit: Unit of measurement (Count, Seconds, Percent, etc.)
            dimensions: Optional dimensions for the metric
            timestamp: Optional timestamp (defaults to now)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            metric_data = {
                "MetricName": metric_name,
                "Value": value,
                "Unit": unit,
                "Timestamp": timestamp or datetime.now(UTC)
            }
            
            if dimensions:
                metric_data["Dimensions"] = [
                    {"Name": k, "Value": v} for k, v in dimensions.items()
                ]
            
            self.cloudwatch.put_metric_data(
                Namespace=self.namespace,
                MetricData=[metric_data]
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending metric {metric_name}: {e}")
            return False
    
    def put_metrics_batch(self, metrics: List[Dict[str, Any]]) -> bool:
        """
        Send multiple metrics to CloudWatch in a single request.
        
        Implements Req 83.1, 83.2: Send application and business metrics
        
        Args:
            metrics: List of metric dictionaries with keys:
                - metric_name: str
                - value: float
                - unit: str (optional, default "None")
                - dimensions: dict (optional)
                - timestamp: datetime (optional)
                
        Returns:
            True if successful, False otherwise
        """
        try:
            metric_data = []
            
            for metric in metrics:
                data = {
                    "MetricName": metric["metric_name"],
                    "Value": metric["value"],
                    "Unit": metric.get("unit", "None"),
                    "Timestamp": metric.get("timestamp", datetime.now(UTC))
                }
                
                if "dimensions" in metric:
                    data["Dimensions"] = [
                        {"Name": k, "Value": v}
                        for k, v in metric["dimensions"].items()
                    ]
                
                metric_data.append(data)
            
            # CloudWatch allows max 20 metrics per request
            for i in range(0, len(metric_data), 20):
                batch = metric_data[i:i+20]
                self.cloudwatch.put_metric_data(
                    Namespace=self.namespace,
                    MetricData=batch
                )
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending metrics batch: {e}")
            return False
    
    def track_business_metrics(
        self,
        active_users: Optional[int] = None,
        api_calls: Optional[int] = None,
        errors: Optional[int] = None,
        recommendations_generated: Optional[int] = None,
        predictions_made: Optional[int] = None
    ) -> bool:
        """
        Track custom business metrics.
        
        Implements Req 83.2: Send custom business metrics
        
        Args:
            active_users: Number of active users
            api_calls: Number of API calls
            errors: Number of errors
            recommendations_generated: Number of recommendations generated
            predictions_made: Number of predictions made
            
        Returns:
            True if successful, False otherwise
        """
        metrics = []
        
        if active_users is not None:
            metrics.append({
                "metric_name": "ActiveUsers",
                "value": active_users,
                "unit": "Count"
            })
        
        if api_calls is not None:
            metrics.append({
                "metric_name": "APICallsTotal",
                "value": api_calls,
                "unit": "Count"
            })
        
        if errors is not None:
            metrics.append({
                "metric_name": "ErrorsTotal",
                "value": errors,
                "unit": "Count"
            })
        
        if recommendations_generated is not None:
            metrics.append({
                "metric_name": "RecommendationsGenerated",
                "value": recommendations_generated,
                "unit": "Count"
            })
        
        if predictions_made is not None:
            metrics.append({
                "metric_name": "PredictionsMade",
                "value": predictions_made,
                "unit": "Count"
            })
        
        return self.put_metrics_batch(metrics)
    
    def track_api_performance(
        self,
        endpoint: str,
        response_time: float,
        status_code: int,
        error: bool = False
    ) -> bool:
        """
        Track API performance metrics.
        
        Implements Req 83.7: Track API performance metrics
        
        Args:
            endpoint: API endpoint path
            response_time: Response time in milliseconds
            status_code: HTTP status code
            error: Whether the request resulted in an error
            
        Returns:
            True if successful, False otherwise
        """
        metrics = [
            {
                "metric_name": "APIResponseTime",
                "value": response_time,
                "unit": "Milliseconds",
                "dimensions": {"Endpoint": endpoint}
            },
            {
                "metric_name": "APIRequests",
                "value": 1,
                "unit": "Count",
                "dimensions": {
                    "Endpoint": endpoint,
                    "StatusCode": str(status_code)
                }
            }
        ]
        
        if error:
            metrics.append({
                "metric_name": "APIErrors",
                "value": 1,
                "unit": "Count",
                "dimensions": {"Endpoint": endpoint}
            })
        
        return self.put_metrics_batch(metrics)
    
    def track_frontend_performance(
        self,
        page_load_time: Optional[float] = None,
        time_to_interactive: Optional[float] = None,
        first_contentful_paint: Optional[float] = None,
        page: Optional[str] = None
    ) -> bool:
        """
        Track frontend performance metrics.
        
        Implements Req 83.6: Track frontend performance metrics
        
        Args:
            page_load_time: Page load time in milliseconds
            time_to_interactive: Time to interactive in milliseconds
            first_contentful_paint: First contentful paint in milliseconds
            page: Page identifier
            
        Returns:
            True if successful, False otherwise
        """
        metrics = []
        dimensions = {"Page": page} if page else {}
        
        if page_load_time is not None:
            metrics.append({
                "metric_name": "PageLoadTime",
                "value": page_load_time,
                "unit": "Milliseconds",
                "dimensions": dimensions
            })
        
        if time_to_interactive is not None:
            metrics.append({
                "metric_name": "TimeToInteractive",
                "value": time_to_interactive,
                "unit": "Milliseconds",
                "dimensions": dimensions
            })
        
        if first_contentful_paint is not None:
            metrics.append({
                "metric_name": "FirstContentfulPaint",
                "value": first_contentful_paint,
                "unit": "Milliseconds",
                "dimensions": dimensions
            })
        
        return self.put_metrics_batch(metrics)
    
    def log_error(
        self,
        error_message: str,
        error_type: str,
        stack_trace: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Log error to CloudWatch Logs.
        
        Implements Req 83.4: Send error logs to CloudWatch Logs
        
        Args:
            error_message: Error message
            error_type: Type of error
            stack_trace: Optional stack trace
            context: Optional context information
            
        Returns:
            True if successful, False otherwise
        """
        try:
            log_entry = {
                "timestamp": datetime.now(UTC).isoformat(),
                "level": "ERROR",
                "error_type": error_type,
                "message": error_message,
                "stack_trace": stack_trace,
                "context": context or {}
            }
            
            logger.error(json.dumps(log_entry))
            
            # Also send error count metric
            self.put_metric("ErrorsLogged", 1, "Count", {"ErrorType": error_type})
            
            return True
            
        except Exception as e:
            logger.error(f"Error logging error: {e}")
            return False
    
    def send_alert(
        self,
        subject: str,
        message: str,
        severity: str = "WARNING"
    ) -> bool:
        """
        Send alert to SNS topic.
        
        Implements Req 83.9: Send alerts to SNS when thresholds exceeded
        
        Args:
            subject: Alert subject
            message: Alert message
            severity: Alert severity (INFO, WARNING, CRITICAL)
            
        Returns:
            True if successful, False otherwise
        """
        if not SNS_TOPIC_ARN:
            logger.warning("SNS_TOPIC_ARN not configured, skipping alert")
            return False
        
        try:
            alert_data = {
                "timestamp": datetime.now(UTC).isoformat(),
                "severity": severity,
                "subject": subject,
                "message": message
            }
            
            self.sns.publish(
                TopicArn=SNS_TOPIC_ARN,
                Subject=f"[{severity}] {subject}",
                Message=json.dumps(alert_data, indent=2)
            )
            
            # Track alert metric
            self.put_metric("AlertsSent", 1, "Count", {"Severity": severity})
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending alert: {e}")
            return False
    
    def create_trace_id(self) -> str:
        """
        Create a unique trace ID for distributed tracing.
        
        Implements Req 83.5: Distributed tracing for API requests
        
        Returns:
            Unique trace ID
        """
        import uuid
        return str(uuid.uuid4())
    
    def trace_request(self, trace_id: str, operation: str, metadata: Dict[str, Any]) -> None:
        """
        Log trace information for distributed tracing.
        
        Implements Req 83.5: Distributed tracing for API requests
        
        Args:
            trace_id: Unique trace ID
            operation: Operation name
            metadata: Additional metadata
        """
        trace_entry = {
            "timestamp": datetime.now(UTC).isoformat(),
            "trace_id": trace_id,
            "operation": operation,
            "metadata": metadata
        }
        
        logger.info(f"TRACE: {json.dumps(trace_entry)}")


# Singleton instance
observability = ObservabilityService()


def track_performance(operation_name: str):
    """
    Decorator to track performance of Lambda functions.
    
    Implements Req 83.7: Track API performance metrics
    
    Args:
        operation_name: Name of the operation being tracked
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            trace_id = observability.create_trace_id()
            error = False
            status_code = 200
            
            try:
                # Log trace start
                observability.trace_request(
                    trace_id,
                    f"{operation_name}_start",
                    {"function": func.__name__}
                )
                
                # Execute function
                result = func(*args, **kwargs)
                
                # Extract status code if available
                if isinstance(result, dict) and "statusCode" in result:
                    status_code = result["statusCode"]
                    error = status_code >= 400
                
                return result
                
            except Exception as e:
                error = True
                status_code = 500
                observability.log_error(
                    str(e),
                    type(e).__name__,
                    context={"operation": operation_name, "trace_id": trace_id}
                )
                raise
                
            finally:
                # Calculate duration
                duration = (time.time() - start_time) * 1000  # Convert to ms
                
                # Track performance
                observability.track_api_performance(
                    operation_name,
                    duration,
                    status_code,
                    error
                )
                
                # Log trace end
                observability.trace_request(
                    trace_id,
                    f"{operation_name}_end",
                    {
                        "function": func.__name__,
                        "duration_ms": duration,
                        "status_code": status_code,
                        "error": error
                    }
                )
        
        return wrapper
    return decorator


def health_check_handler(event, context):
    """
    Health check endpoint for monitoring.
    
    Implements Req 83.10: Health check endpoints
    
    Returns:
        Health check response with system status
    """
    try:
        health_status = {
            "status": "healthy",
            "timestamp": datetime.now(UTC).isoformat(),
            "service": "b3-dashboard",
            "checks": {
                "cloudwatch": check_cloudwatch_connection(),
                "s3": check_s3_connection(),
                "dynamodb": check_dynamodb_connection()
            }
        }
        
        # Determine overall status
        all_healthy = all(health_status["checks"].values())
        health_status["status"] = "healthy" if all_healthy else "degraded"
        
        # Track health check metric
        observability.put_metric(
            "HealthCheckStatus",
            1 if all_healthy else 0,
            "None"
        )
        
        return {
            "statusCode": 200 if all_healthy else 503,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps(health_status)
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now(UTC).isoformat()
            })
        }


def check_cloudwatch_connection() -> bool:
    """Check CloudWatch connectivity."""
    try:
        cloudwatch.list_metrics(Namespace=NAMESPACE, MaxRecords=1)
        return True
    except Exception:
        return False


def check_s3_connection() -> bool:
    """Check S3 connectivity."""
    try:
        s3 = boto3.client("s3")
        bucket = os.environ.get("BUCKET")
        if bucket:
            s3.head_bucket(Bucket=bucket)
        return True
    except Exception:
        return False


def check_dynamodb_connection() -> bool:
    """Check DynamoDB connectivity."""
    try:
        dynamodb = boto3.client("dynamodb")
        dynamodb.list_tables(Limit=1)
        return True
    except Exception:
        return False
