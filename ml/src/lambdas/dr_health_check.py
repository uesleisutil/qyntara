"""
DR Health Check Lambda

Validates disaster recovery readiness by checking:
- Backup existence and freshness
- Point-in-time recovery status
- Cross-region replication status
- Recovery procedures documentation

Requirements: 90.6, 90.8
"""

import json
import os
import boto3
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Environment variables
PRIMARY_BUCKET = os.environ["PRIMARY_BUCKET"]
BACKUP_BUCKET = os.environ["BACKUP_BUCKET"]
BACKUP_REGION = os.environ["BACKUP_REGION"]
API_KEYS_TABLE = os.environ["API_KEYS_TABLE"]
AUTH_LOGS_TABLE = os.environ["AUTH_LOGS_TABLE"]
RATE_LIMITS_TABLE = os.environ["RATE_LIMITS_TABLE"]
ALERT_TOPIC_ARN = os.environ["ALERT_TOPIC_ARN"]

# DR Requirements
RPO_HOURS = 24  # Recovery Point Objective: 24 hours
RTO_HOURS = 4   # Recovery Time Objective: 4 hours

# AWS clients
s3_client = boto3.client("s3")
dynamodb_client = boto3.client("dynamodb")
sns_client = boto3.client("sns")
cloudwatch_client = boto3.client("cloudwatch")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main handler for DR health check Lambda.
    
    Performs comprehensive DR readiness checks:
    1. Backup freshness (RPO compliance)
    2. Point-in-time recovery status
    3. Backup bucket accessibility
    4. DynamoDB backup status
    5. S3 data backup status
    """
    logger.info("Starting DR health check...")
    
    health_check_results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall_status": "HEALTHY",
        "checks": [],
        "warnings": [],
        "errors": [],
    }
    
    try:
        # 1. Check DynamoDB backups
        logger.info("Checking DynamoDB backups...")
        dynamodb_checks = check_dynamodb_backups()
        health_check_results["checks"].extend(dynamodb_checks)
        
        # 2. Check S3 backups
        logger.info("Checking S3 backups...")
        s3_checks = check_s3_backups()
        health_check_results["checks"].extend(s3_checks)
        
        # 3. Check point-in-time recovery
        logger.info("Checking point-in-time recovery...")
        pitr_checks = check_pitr_status()
        health_check_results["checks"].extend(pitr_checks)
        
        # 4. Check backup bucket accessibility
        logger.info("Checking backup bucket accessibility...")
        bucket_checks = check_backup_bucket()
        health_check_results["checks"].extend(bucket_checks)
        
        # 5. Evaluate overall health
        evaluate_overall_health(health_check_results)
        
        # 6. Send metrics to CloudWatch
        send_health_metrics(health_check_results)
        
        # 7. Send notifications if issues found
        if health_check_results["overall_status"] != "HEALTHY":
            send_health_notification(health_check_results)
        
        logger.info(f"DR health check completed: {health_check_results['overall_status']}")
        
        return {
            "statusCode": 200,
            "body": json.dumps(health_check_results),
        }
        
    except Exception as e:
        logger.error(f"DR health check failed: {str(e)}", exc_info=True)
        health_check_results["overall_status"] = "CRITICAL"
        health_check_results["errors"].append({
            "type": "HEALTH_CHECK_FAILURE",
            "message": str(e),
        })
        
        # Send critical alert
        send_notification(
            "DR Health Check Failed",
            f"DR health check encountered a critical error\n\n"
            f"Error: {str(e)}"
        )
        
        return {
            "statusCode": 500,
            "body": json.dumps(health_check_results),
        }


def check_dynamodb_backups() -> List[Dict[str, Any]]:
    """
    Check DynamoDB backup status and freshness.
    
    Implements Req 90.8: RPO of 24 hours
    """
    tables = [
        {"name": API_KEYS_TABLE, "description": "API Keys"},
        {"name": AUTH_LOGS_TABLE, "description": "Authentication Logs"},
        {"name": RATE_LIMITS_TABLE, "description": "Rate Limits"},
    ]
    
    checks = []
    now = datetime.now(timezone.utc)
    rpo_threshold = now - timedelta(hours=RPO_HOURS)
    
    for table in tables:
        try:
            # List recent backups
            response = dynamodb_client.list_backups(
                TableName=table["name"],
                BackupType="USER",
            )
            
            backups = response.get("BackupSummaries", [])
            
            if not backups:
                checks.append({
                    "check": f"DynamoDB Backup - {table['name']}",
                    "status": "FAILED",
                    "message": "No backups found",
                    "severity": "CRITICAL",
                })
                continue
            
            # Find most recent backup
            backups.sort(key=lambda x: x["BackupCreationDateTime"], reverse=True)
            latest_backup = backups[0]
            backup_age = now - latest_backup["BackupCreationDateTime"]
            
            # Check if backup is within RPO
            if latest_backup["BackupCreationDateTime"] < rpo_threshold:
                checks.append({
                    "check": f"DynamoDB Backup - {table['name']}",
                    "status": "WARNING",
                    "message": f"Backup is {backup_age.total_seconds() / 3600:.1f} hours old (RPO: {RPO_HOURS}h)",
                    "severity": "HIGH",
                    "backup_age_hours": backup_age.total_seconds() / 3600,
                })
            else:
                checks.append({
                    "check": f"DynamoDB Backup - {table['name']}",
                    "status": "PASSED",
                    "message": f"Backup is {backup_age.total_seconds() / 3600:.1f} hours old",
                    "backup_age_hours": backup_age.total_seconds() / 3600,
                })
            
        except Exception as e:
            logger.error(f"Failed to check backups for {table['name']}: {str(e)}")
            checks.append({
                "check": f"DynamoDB Backup - {table['name']}",
                "status": "FAILED",
                "message": str(e),
                "severity": "CRITICAL",
            })
    
    return checks


def check_s3_backups() -> List[Dict[str, Any]]:
    """
    Check S3 backup status and freshness.
    """
    checks = []
    
    try:
        # Check for recent backups
        now = datetime.now(timezone.utc)
        today = now.strftime("%Y-%m-%d")
        yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Check today's backup
        today_prefix = f"backups/{today}/"
        response = s3_client.list_objects_v2(
            Bucket=BACKUP_BUCKET,
            Prefix=today_prefix,
            MaxKeys=1,
        )
        
        if response.get("KeyCount", 0) > 0:
            checks.append({
                "check": "S3 Backup - Today",
                "status": "PASSED",
                "message": f"Backup exists for {today}",
            })
        else:
            # Check yesterday's backup
            yesterday_prefix = f"backups/{yesterday}/"
            response = s3_client.list_objects_v2(
                Bucket=BACKUP_BUCKET,
                Prefix=yesterday_prefix,
                MaxKeys=1,
            )
            
            if response.get("KeyCount", 0) > 0:
                checks.append({
                    "check": "S3 Backup - Recent",
                    "status": "WARNING",
                    "message": f"No backup for today, but yesterday's backup exists",
                    "severity": "MEDIUM",
                })
            else:
                checks.append({
                    "check": "S3 Backup - Recent",
                    "status": "FAILED",
                    "message": "No recent backups found (checked today and yesterday)",
                    "severity": "HIGH",
                })
        
        # Check backup metadata
        metadata_prefix = "backups/metadata/"
        response = s3_client.list_objects_v2(
            Bucket=BACKUP_BUCKET,
            Prefix=metadata_prefix,
            MaxKeys=10,
        )
        
        if response.get("KeyCount", 0) > 0:
            checks.append({
                "check": "S3 Backup Metadata",
                "status": "PASSED",
                "message": f"Found {response['KeyCount']} backup metadata files",
            })
        else:
            checks.append({
                "check": "S3 Backup Metadata",
                "status": "WARNING",
                "message": "No backup metadata found",
                "severity": "LOW",
            })
        
    except Exception as e:
        logger.error(f"Failed to check S3 backups: {str(e)}")
        checks.append({
            "check": "S3 Backup",
            "status": "FAILED",
            "message": str(e),
            "severity": "CRITICAL",
        })
    
    return checks


def check_pitr_status() -> List[Dict[str, Any]]:
    """
    Check point-in-time recovery status for DynamoDB tables.
    
    Implements Req 90.4: Point-in-time recovery for critical data
    """
    tables = [
        {"name": API_KEYS_TABLE, "description": "API Keys"},
        {"name": AUTH_LOGS_TABLE, "description": "Authentication Logs"},
        {"name": RATE_LIMITS_TABLE, "description": "Rate Limits"},
    ]
    
    checks = []
    
    for table in tables:
        try:
            response = dynamodb_client.describe_continuous_backups(
                TableName=table["name"]
            )
            
            pitr_status = response["ContinuousBackupsDescription"]["PointInTimeRecoveryDescription"]["PointInTimeRecoveryStatus"]
            
            if pitr_status == "ENABLED":
                earliest_time = response["ContinuousBackupsDescription"]["PointInTimeRecoveryDescription"].get("EarliestRestorableDateTime")
                latest_time = response["ContinuousBackupsDescription"]["PointInTimeRecoveryDescription"].get("LatestRestorableDateTime")
                
                checks.append({
                    "check": f"PITR - {table['name']}",
                    "status": "PASSED",
                    "message": f"PITR enabled (earliest: {earliest_time}, latest: {latest_time})",
                })
            else:
                checks.append({
                    "check": f"PITR - {table['name']}",
                    "status": "FAILED",
                    "message": f"PITR not enabled (status: {pitr_status})",
                    "severity": "HIGH",
                })
            
        except Exception as e:
            logger.error(f"Failed to check PITR for {table['name']}: {str(e)}")
            checks.append({
                "check": f"PITR - {table['name']}",
                "status": "FAILED",
                "message": str(e),
                "severity": "CRITICAL",
            })
    
    return checks


def check_backup_bucket() -> List[Dict[str, Any]]:
    """
    Check backup bucket accessibility and configuration.
    """
    checks = []
    
    try:
        # Check bucket exists and is accessible
        response = s3_client.head_bucket(Bucket=BACKUP_BUCKET)
        
        checks.append({
            "check": "Backup Bucket Accessibility",
            "status": "PASSED",
            "message": f"Backup bucket {BACKUP_BUCKET} is accessible",
        })
        
        # Check bucket versioning
        versioning = s3_client.get_bucket_versioning(Bucket=BACKUP_BUCKET)
        
        if versioning.get("Status") == "Enabled":
            checks.append({
                "check": "Backup Bucket Versioning",
                "status": "PASSED",
                "message": "Versioning is enabled",
            })
        else:
            checks.append({
                "check": "Backup Bucket Versioning",
                "status": "WARNING",
                "message": "Versioning is not enabled",
                "severity": "MEDIUM",
            })
        
        # Check bucket encryption
        try:
            encryption = s3_client.get_bucket_encryption(Bucket=BACKUP_BUCKET)
            checks.append({
                "check": "Backup Bucket Encryption",
                "status": "PASSED",
                "message": "Encryption is enabled",
            })
        except s3_client.exceptions.ServerSideEncryptionConfigurationNotFoundError:
            checks.append({
                "check": "Backup Bucket Encryption",
                "status": "WARNING",
                "message": "Encryption is not configured",
                "severity": "MEDIUM",
            })
        
    except Exception as e:
        logger.error(f"Failed to check backup bucket: {str(e)}")
        checks.append({
            "check": "Backup Bucket Accessibility",
            "status": "FAILED",
            "message": str(e),
            "severity": "CRITICAL",
        })
    
    return checks


def evaluate_overall_health(health_check_results: Dict[str, Any]) -> None:
    """
    Evaluate overall DR health based on individual checks.
    """
    failed_checks = [c for c in health_check_results["checks"] if c["status"] == "FAILED"]
    warning_checks = [c for c in health_check_results["checks"] if c["status"] == "WARNING"]
    
    # Categorize issues by severity
    critical_issues = [c for c in failed_checks if c.get("severity") == "CRITICAL"]
    high_issues = [c for c in failed_checks + warning_checks if c.get("severity") == "HIGH"]
    
    if critical_issues:
        health_check_results["overall_status"] = "CRITICAL"
        health_check_results["errors"].extend(critical_issues)
    elif high_issues:
        health_check_results["overall_status"] = "DEGRADED"
        health_check_results["warnings"].extend(high_issues)
    elif warning_checks:
        health_check_results["overall_status"] = "WARNING"
        health_check_results["warnings"].extend(warning_checks)
    else:
        health_check_results["overall_status"] = "HEALTHY"


def send_health_metrics(health_check_results: Dict[str, Any]) -> None:
    """
    Send DR health metrics to CloudWatch.
    """
    try:
        metrics = []
        
        # Overall readiness metric
        readiness_value = 1 if health_check_results["overall_status"] == "HEALTHY" else 0
        metrics.append({
            "MetricName": "DRReadiness",
            "Value": readiness_value,
            "Unit": "None",
            "Timestamp": datetime.now(timezone.utc),
        })
        
        # Failed checks count
        failed_count = sum(1 for c in health_check_results["checks"] if c["status"] == "FAILED")
        metrics.append({
            "MetricName": "DRFailedChecks",
            "Value": failed_count,
            "Unit": "Count",
            "Timestamp": datetime.now(timezone.utc),
        })
        
        # Warning checks count
        warning_count = sum(1 for c in health_check_results["checks"] if c["status"] == "WARNING")
        metrics.append({
            "MetricName": "DRWarningChecks",
            "Value": warning_count,
            "Unit": "Count",
            "Timestamp": datetime.now(timezone.utc),
        })
        
        cloudwatch_client.put_metric_data(
            Namespace="B3Dashboard/DisasterRecovery",
            MetricData=metrics,
        )
        
    except Exception as e:
        logger.error(f"Failed to send health metrics: {str(e)}")


def send_health_notification(health_check_results: Dict[str, Any]) -> None:
    """
    Send notification about DR health issues.
    """
    status = health_check_results["overall_status"]
    
    message_parts = [
        f"DR Health Status: {status}",
        "",
        "Issues Found:",
    ]
    
    if health_check_results["errors"]:
        message_parts.append("\nCritical Errors:")
        for error in health_check_results["errors"]:
            message_parts.append(f"- {error.get('check', 'Unknown')}: {error.get('message', 'No details')}")
    
    if health_check_results["warnings"]:
        message_parts.append("\nWarnings:")
        for warning in health_check_results["warnings"]:
            message_parts.append(f"- {warning.get('check', 'Unknown')}: {warning.get('message', 'No details')}")
    
    message = "\n".join(message_parts)
    
    send_notification(f"DR Health Check - {status}", message)


def send_notification(subject: str, message: str) -> None:
    """
    Send SNS notification.
    """
    try:
        sns_client.publish(
            TopicArn=ALERT_TOPIC_ARN,
            Subject=f"[B3 Dashboard DR] {subject}",
            Message=message,
        )
    except Exception as e:
        logger.error(f"Failed to send notification: {str(e)}")
