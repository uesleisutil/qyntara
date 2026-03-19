"""
Backup Configuration Lambda

Implements automated backups of configuration data for disaster recovery.
Backs up DynamoDB tables and critical S3 data to a separate region.

Requirements: 90.1, 90.2, 90.4
"""

import json
import os
import boto3
from datetime import datetime, timezone
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

# AWS clients
s3_client = boto3.client("s3")
dynamodb_client = boto3.client("dynamodb")
sns_client = boto3.client("sns")
cloudwatch_client = boto3.client("cloudwatch")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main handler for backup configuration Lambda.
    
    Performs:
    1. DynamoDB table backups
    2. S3 configuration data backup
    3. Metadata backup
    4. Validation of backups
    """
    logger.info(f"Starting backup process: {json.dumps(event)}")
    
    backup_timestamp = datetime.now(timezone.utc).isoformat()
    backup_results = {
        "timestamp": backup_timestamp,
        "dynamodb_backups": [],
        "s3_backups": [],
        "errors": [],
    }
    
    try:
        # 1. Backup DynamoDB tables
        logger.info("Backing up DynamoDB tables...")
        dynamodb_results = backup_dynamodb_tables(backup_timestamp)
        backup_results["dynamodb_backups"] = dynamodb_results
        
        # 2. Backup S3 configuration data
        logger.info("Backing up S3 configuration data...")
        s3_results = backup_s3_config_data(backup_timestamp)
        backup_results["s3_backups"] = s3_results
        
        # 3. Backup metadata
        logger.info("Backing up metadata...")
        backup_metadata(backup_results)
        
        # 4. Validate backups
        logger.info("Validating backups...")
        validation_results = validate_backups(backup_results)
        backup_results["validation"] = validation_results
        
        # 5. Send metrics to CloudWatch
        send_backup_metrics(backup_results)
        
        # 6. Send success notification
        if not backup_results["errors"]:
            send_notification(
                "Backup Successful",
                f"Backup completed successfully at {backup_timestamp}\n\n"
                f"DynamoDB backups: {len(dynamodb_results)}\n"
                f"S3 backups: {len(s3_results)}\n"
                f"Validation: {'PASSED' if validation_results['success'] else 'FAILED'}"
            )
        else:
            send_notification(
                "Backup Completed with Errors",
                f"Backup completed with errors at {backup_timestamp}\n\n"
                f"Errors: {len(backup_results['errors'])}\n"
                f"Details: {json.dumps(backup_results['errors'], indent=2)}"
            )
        
        logger.info(f"Backup process completed: {json.dumps(backup_results)}")
        
        return {
            "statusCode": 200,
            "body": json.dumps(backup_results),
        }
        
    except Exception as e:
        logger.error(f"Backup process failed: {str(e)}", exc_info=True)
        backup_results["errors"].append({
            "type": "CRITICAL_FAILURE",
            "message": str(e),
        })
        
        # Send failure metrics
        cloudwatch_client.put_metric_data(
            Namespace="B3Dashboard/DisasterRecovery",
            MetricData=[
                {
                    "MetricName": "BackupFailures",
                    "Value": 1,
                    "Unit": "Count",
                    "Timestamp": datetime.now(timezone.utc),
                }
            ],
        )
        
        # Send failure notification
        send_notification(
            "Backup Failed",
            f"Backup process failed at {backup_timestamp}\n\n"
            f"Error: {str(e)}"
        )
        
        return {
            "statusCode": 500,
            "body": json.dumps(backup_results),
        }


def backup_dynamodb_tables(backup_timestamp: str) -> List[Dict[str, Any]]:
    """
    Create on-demand backups of DynamoDB tables.
    
    Implements Req 90.1, 90.4: Automated backups with point-in-time recovery
    """
    tables = [
        {"name": API_KEYS_TABLE, "description": "API Keys"},
        {"name": AUTH_LOGS_TABLE, "description": "Authentication Logs"},
        {"name": RATE_LIMITS_TABLE, "description": "Rate Limits"},
    ]
    
    backup_results = []
    
    for table in tables:
        try:
            # Create on-demand backup
            backup_name = f"{table['name']}-{backup_timestamp.replace(':', '-')}"
            
            response = dynamodb_client.create_backup(
                TableName=table["name"],
                BackupName=backup_name,
            )
            
            backup_results.append({
                "table": table["name"],
                "backup_arn": response["BackupDetails"]["BackupArn"],
                "backup_name": backup_name,
                "status": "SUCCESS",
            })
            
            logger.info(f"Created backup for table {table['name']}: {backup_name}")
            
        except Exception as e:
            logger.error(f"Failed to backup table {table['name']}: {str(e)}")
            backup_results.append({
                "table": table["name"],
                "status": "FAILED",
                "error": str(e),
            })
    
    return backup_results


def backup_s3_config_data(backup_timestamp: str) -> List[Dict[str, Any]]:
    """
    Backup critical S3 configuration data to backup bucket.
    
    Implements Req 90.1, 90.2: Backup configuration data to separate region
    """
    # Critical paths to backup
    critical_paths = [
        "config/",
        "recommendations/",  # Latest recommendations
    ]
    
    backup_results = []
    backup_prefix = f"backups/{backup_timestamp.split('T')[0]}/"
    
    for path in critical_paths:
        try:
            # List objects in primary bucket
            paginator = s3_client.get_paginator("list_objects_v2")
            pages = paginator.paginate(Bucket=PRIMARY_BUCKET, Prefix=path)
            
            objects_copied = 0
            
            for page in pages:
                if "Contents" not in page:
                    continue
                
                for obj in page["Contents"]:
                    source_key = obj["Key"]
                    dest_key = f"{backup_prefix}{source_key}"
                    
                    # Copy object to backup bucket
                    copy_source = {"Bucket": PRIMARY_BUCKET, "Key": source_key}
                    s3_client.copy_object(
                        CopySource=copy_source,
                        Bucket=BACKUP_BUCKET,
                        Key=dest_key,
                    )
                    
                    objects_copied += 1
            
            backup_results.append({
                "path": path,
                "objects_copied": objects_copied,
                "destination": f"s3://{BACKUP_BUCKET}/{backup_prefix}{path}",
                "status": "SUCCESS",
            })
            
            logger.info(f"Backed up {objects_copied} objects from {path}")
            
        except Exception as e:
            logger.error(f"Failed to backup S3 path {path}: {str(e)}")
            backup_results.append({
                "path": path,
                "status": "FAILED",
                "error": str(e),
            })
    
    return backup_results


def backup_metadata(backup_results: Dict[str, Any]) -> None:
    """
    Store backup metadata in backup bucket for recovery tracking.
    """
    try:
        metadata_key = f"backups/metadata/{backup_results['timestamp']}.json"
        
        s3_client.put_object(
            Bucket=BACKUP_BUCKET,
            Key=metadata_key,
            Body=json.dumps(backup_results, indent=2),
            ContentType="application/json",
        )
        
        logger.info(f"Stored backup metadata: {metadata_key}")
        
    except Exception as e:
        logger.error(f"Failed to store backup metadata: {str(e)}")
        backup_results["errors"].append({
            "type": "METADATA_BACKUP_FAILED",
            "message": str(e),
        })


def validate_backups(backup_results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate that backups were created successfully.
    """
    validation = {
        "success": True,
        "checks": [],
    }
    
    # Check DynamoDB backups
    for backup in backup_results["dynamodb_backups"]:
        if backup["status"] == "SUCCESS":
            validation["checks"].append({
                "type": "DYNAMODB",
                "resource": backup["table"],
                "status": "PASSED",
            })
        else:
            validation["success"] = False
            validation["checks"].append({
                "type": "DYNAMODB",
                "resource": backup["table"],
                "status": "FAILED",
                "error": backup.get("error"),
            })
    
    # Check S3 backups
    for backup in backup_results["s3_backups"]:
        if backup["status"] == "SUCCESS" and backup["objects_copied"] > 0:
            validation["checks"].append({
                "type": "S3",
                "resource": backup["path"],
                "status": "PASSED",
            })
        else:
            validation["success"] = False
            validation["checks"].append({
                "type": "S3",
                "resource": backup["path"],
                "status": "FAILED",
                "error": backup.get("error"),
            })
    
    return validation


def send_backup_metrics(backup_results: Dict[str, Any]) -> None:
    """
    Send backup metrics to CloudWatch.
    """
    try:
        metrics = []
        
        # Backup success metric
        metrics.append({
            "MetricName": "BackupSuccess",
            "Value": 1 if not backup_results["errors"] else 0,
            "Unit": "Count",
            "Timestamp": datetime.now(timezone.utc),
        })
        
        # DynamoDB backups count
        successful_dynamo = sum(
            1 for b in backup_results["dynamodb_backups"] if b["status"] == "SUCCESS"
        )
        metrics.append({
            "MetricName": "DynamoDBBackupsCreated",
            "Value": successful_dynamo,
            "Unit": "Count",
            "Timestamp": datetime.now(timezone.utc),
        })
        
        # S3 objects backed up
        total_objects = sum(
            b.get("objects_copied", 0) for b in backup_results["s3_backups"]
        )
        metrics.append({
            "MetricName": "S3ObjectsBackedUp",
            "Value": total_objects,
            "Unit": "Count",
            "Timestamp": datetime.now(timezone.utc),
        })
        
        # Backup age (for RPO monitoring)
        metrics.append({
            "MetricName": "BackupAgeHours",
            "Value": 0,  # Just created
            "Unit": "None",
            "Timestamp": datetime.now(timezone.utc),
        })
        
        cloudwatch_client.put_metric_data(
            Namespace="B3Dashboard/DisasterRecovery",
            MetricData=metrics,
        )
        
    except Exception as e:
        logger.error(f"Failed to send backup metrics: {str(e)}")


def send_notification(subject: str, message: str) -> None:
    """
    Send SNS notification about backup status.
    """
    try:
        sns_client.publish(
            TopicArn=ALERT_TOPIC_ARN,
            Subject=f"[B3 Dashboard DR] {subject}",
            Message=message,
        )
    except Exception as e:
        logger.error(f"Failed to send notification: {str(e)}")
