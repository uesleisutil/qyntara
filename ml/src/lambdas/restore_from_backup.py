"""
Restore from Backup Lambda

Implements disaster recovery restoration procedures.
Restores DynamoDB tables and S3 data from backups.

Requirements: 90.3, 90.7
"""

import json
import os
import boto3
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
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
    Main handler for restore from backup Lambda.
    
    Supports:
    - Full restoration from backup
    - Selective table restoration
    - Point-in-time recovery
    - Validation of restored data
    
    Event parameters:
    - restore_type: "full" | "selective" | "point_in_time"
    - backup_timestamp: ISO timestamp of backup to restore (optional)
    - tables: List of table names to restore (for selective)
    - point_in_time: ISO timestamp for PITR (for point_in_time)
    """
    logger.info(f"Starting restore process: {json.dumps(event)}")
    
    restore_type = event.get("restore_type", "full")
    backup_timestamp = event.get("backup_timestamp")
    tables_to_restore = event.get("tables", [])
    point_in_time = event.get("point_in_time")
    
    restore_results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "restore_type": restore_type,
        "dynamodb_restores": [],
        "s3_restores": [],
        "errors": [],
    }
    
    try:
        # Validate restore parameters
        if restore_type == "point_in_time" and not point_in_time:
            raise ValueError("point_in_time parameter required for PITR")
        
        if restore_type == "selective" and not tables_to_restore:
            raise ValueError("tables parameter required for selective restore")
        
        # 1. Restore DynamoDB tables
        logger.info(f"Restoring DynamoDB tables (type: {restore_type})...")
        
        if restore_type == "point_in_time":
            dynamodb_results = restore_dynamodb_pitr(point_in_time, tables_to_restore)
        else:
            dynamodb_results = restore_dynamodb_from_backup(
                backup_timestamp, tables_to_restore if restore_type == "selective" else None
            )
        
        restore_results["dynamodb_restores"] = dynamodb_results
        
        # 2. Restore S3 data
        if restore_type == "full":
            logger.info("Restoring S3 configuration data...")
            s3_results = restore_s3_data(backup_timestamp)
            restore_results["s3_restores"] = s3_results
        
        # 3. Validate restoration
        logger.info("Validating restoration...")
        validation_results = validate_restoration(restore_results)
        restore_results["validation"] = validation_results
        
        # 4. Send metrics
        send_restore_metrics(restore_results)
        
        # 5. Send notification
        if not restore_results["errors"]:
            send_notification(
                "Restoration Successful",
                f"Restoration completed successfully\n\n"
                f"Type: {restore_type}\n"
                f"DynamoDB restores: {len(dynamodb_results)}\n"
                f"S3 restores: {len(restore_results['s3_restores'])}\n"
                f"Validation: {'PASSED' if validation_results['success'] else 'FAILED'}"
            )
        else:
            send_notification(
                "Restoration Completed with Errors",
                f"Restoration completed with errors\n\n"
                f"Errors: {len(restore_results['errors'])}\n"
                f"Details: {json.dumps(restore_results['errors'], indent=2)}"
            )
        
        logger.info(f"Restore process completed: {json.dumps(restore_results)}")
        
        return {
            "statusCode": 200,
            "body": json.dumps(restore_results),
        }
        
    except Exception as e:
        logger.error(f"Restore process failed: {str(e)}", exc_info=True)
        restore_results["errors"].append({
            "type": "CRITICAL_FAILURE",
            "message": str(e),
        })
        
        # Send failure notification
        send_notification(
            "Restoration Failed",
            f"Restoration process failed\n\n"
            f"Error: {str(e)}"
        )
        
        return {
            "statusCode": 500,
            "body": json.dumps(restore_results),
        }


def restore_dynamodb_from_backup(
    backup_timestamp: Optional[str], tables: Optional[List[str]]
) -> List[Dict[str, Any]]:
    """
    Restore DynamoDB tables from on-demand backups.
    
    Implements Req 90.3: Test backup restoration
    """
    all_tables = [
        {"name": API_KEYS_TABLE, "description": "API Keys"},
        {"name": AUTH_LOGS_TABLE, "description": "Authentication Logs"},
        {"name": RATE_LIMITS_TABLE, "description": "Rate Limits"},
    ]
    
    # Filter tables if selective restore
    if tables:
        all_tables = [t for t in all_tables if t["name"] in tables]
    
    restore_results = []
    
    for table in all_tables:
        try:
            # Find the most recent backup
            backup_arn = find_latest_backup(table["name"], backup_timestamp)
            
            if not backup_arn:
                restore_results.append({
                    "table": table["name"],
                    "status": "FAILED",
                    "error": "No backup found",
                })
                continue
            
            # Restore table from backup
            # Note: This creates a new table, so we use a temporary name
            target_table_name = f"{table['name']}-restored-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
            
            response = dynamodb_client.restore_table_from_backup(
                TargetTableName=target_table_name,
                BackupArn=backup_arn,
            )
            
            restore_results.append({
                "table": table["name"],
                "restored_table": target_table_name,
                "backup_arn": backup_arn,
                "status": "SUCCESS",
                "note": "Restored to new table. Manual verification and table swap required.",
            })
            
            logger.info(f"Restored table {table['name']} to {target_table_name}")
            
        except Exception as e:
            logger.error(f"Failed to restore table {table['name']}: {str(e)}")
            restore_results.append({
                "table": table["name"],
                "status": "FAILED",
                "error": str(e),
            })
    
    return restore_results


def restore_dynamodb_pitr(
    point_in_time: str, tables: Optional[List[str]]
) -> List[Dict[str, Any]]:
    """
    Restore DynamoDB tables using point-in-time recovery.
    
    Implements Req 90.4: Point-in-time recovery for critical data
    """
    all_tables = [
        {"name": API_KEYS_TABLE, "description": "API Keys"},
        {"name": AUTH_LOGS_TABLE, "description": "Authentication Logs"},
        {"name": RATE_LIMITS_TABLE, "description": "Rate Limits"},
    ]
    
    # Filter tables if selective restore
    if tables:
        all_tables = [t for t in all_tables if t["name"] in tables]
    
    restore_results = []
    restore_datetime = datetime.fromisoformat(point_in_time.replace("Z", "+00:00"))
    
    for table in all_tables:
        try:
            # Check if PITR is enabled
            response = dynamodb_client.describe_continuous_backups(
                TableName=table["name"]
            )
            
            pitr_enabled = response["ContinuousBackupsDescription"]["PointInTimeRecoveryDescription"]["PointInTimeRecoveryStatus"] == "ENABLED"
            
            if not pitr_enabled:
                restore_results.append({
                    "table": table["name"],
                    "status": "FAILED",
                    "error": "Point-in-time recovery not enabled",
                })
                continue
            
            # Restore to point in time
            target_table_name = f"{table['name']}-pitr-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
            
            response = dynamodb_client.restore_table_to_point_in_time(
                SourceTableName=table["name"],
                TargetTableName=target_table_name,
                RestoreDateTime=restore_datetime,
            )
            
            restore_results.append({
                "table": table["name"],
                "restored_table": target_table_name,
                "point_in_time": point_in_time,
                "status": "SUCCESS",
                "note": "Restored to new table. Manual verification and table swap required.",
            })
            
            logger.info(f"Restored table {table['name']} to {target_table_name} at {point_in_time}")
            
        except Exception as e:
            logger.error(f"Failed to restore table {table['name']} with PITR: {str(e)}")
            restore_results.append({
                "table": table["name"],
                "status": "FAILED",
                "error": str(e),
            })
    
    return restore_results


def restore_s3_data(backup_timestamp: Optional[str]) -> List[Dict[str, Any]]:
    """
    Restore S3 data from backup bucket.
    
    Implements Req 90.3: Test backup restoration
    """
    restore_results = []
    
    try:
        # Find the backup to restore
        if backup_timestamp:
            backup_date = backup_timestamp.split("T")[0]
        else:
            # Find most recent backup
            backup_date = find_latest_s3_backup()
        
        backup_prefix = f"backups/{backup_date}/"
        
        # List objects in backup bucket
        paginator = s3_client.get_paginator("list_objects_v2")
        pages = paginator.paginate(Bucket=BACKUP_BUCKET, Prefix=backup_prefix)
        
        objects_restored = 0
        
        for page in pages:
            if "Contents" not in page:
                continue
            
            for obj in page["Contents"]:
                source_key = obj["Key"]
                # Remove backup prefix to get original key
                dest_key = source_key.replace(backup_prefix, "")
                
                if not dest_key:  # Skip if empty
                    continue
                
                # Copy object from backup to primary bucket
                copy_source = {"Bucket": BACKUP_BUCKET, "Key": source_key}
                s3_client.copy_object(
                    CopySource=copy_source,
                    Bucket=PRIMARY_BUCKET,
                    Key=dest_key,
                )
                
                objects_restored += 1
        
        restore_results.append({
            "backup_date": backup_date,
            "objects_restored": objects_restored,
            "status": "SUCCESS",
        })
        
        logger.info(f"Restored {objects_restored} objects from backup {backup_date}")
        
    except Exception as e:
        logger.error(f"Failed to restore S3 data: {str(e)}")
        restore_results.append({
            "status": "FAILED",
            "error": str(e),
        })
    
    return restore_results


def find_latest_backup(table_name: str, backup_timestamp: Optional[str]) -> Optional[str]:
    """
    Find the latest backup ARN for a table.
    """
    try:
        response = dynamodb_client.list_backups(
            TableName=table_name,
            BackupType="USER",
        )
        
        backups = response.get("BackupSummaries", [])
        
        if not backups:
            return None
        
        # Filter by timestamp if provided
        if backup_timestamp:
            target_time = datetime.fromisoformat(backup_timestamp.replace("Z", "+00:00"))
            backups = [
                b for b in backups
                if b["BackupCreationDateTime"] <= target_time
            ]
        
        # Sort by creation time and get the latest
        backups.sort(key=lambda x: x["BackupCreationDateTime"], reverse=True)
        
        return backups[0]["BackupArn"] if backups else None
        
    except Exception as e:
        logger.error(f"Failed to find backup for table {table_name}: {str(e)}")
        return None


def find_latest_s3_backup() -> str:
    """
    Find the most recent S3 backup date.
    """
    try:
        response = s3_client.list_objects_v2(
            Bucket=BACKUP_BUCKET,
            Prefix="backups/",
            Delimiter="/",
        )
        
        # Get all backup dates
        dates = []
        for prefix in response.get("CommonPrefixes", []):
            date_str = prefix["Prefix"].replace("backups/", "").replace("/", "")
            if date_str:
                dates.append(date_str)
        
        # Return most recent
        dates.sort(reverse=True)
        return dates[0] if dates else datetime.now(timezone.utc).strftime("%Y-%m-%d")
        
    except Exception as e:
        logger.error(f"Failed to find latest S3 backup: {str(e)}")
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def validate_restoration(restore_results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate that restoration was successful.
    """
    validation = {
        "success": True,
        "checks": [],
    }
    
    # Check DynamoDB restores
    for restore in restore_results["dynamodb_restores"]:
        if restore["status"] == "SUCCESS":
            validation["checks"].append({
                "type": "DYNAMODB",
                "resource": restore["table"],
                "status": "PASSED",
            })
        else:
            validation["success"] = False
            validation["checks"].append({
                "type": "DYNAMODB",
                "resource": restore["table"],
                "status": "FAILED",
                "error": restore.get("error"),
            })
    
    # Check S3 restores
    for restore in restore_results["s3_restores"]:
        if restore["status"] == "SUCCESS" and restore.get("objects_restored", 0) > 0:
            validation["checks"].append({
                "type": "S3",
                "status": "PASSED",
            })
        else:
            validation["success"] = False
            validation["checks"].append({
                "type": "S3",
                "status": "FAILED",
                "error": restore.get("error"),
            })
    
    return validation


def send_restore_metrics(restore_results: Dict[str, Any]) -> None:
    """
    Send restoration metrics to CloudWatch.
    """
    try:
        metrics = []
        
        # Restoration success metric
        metrics.append({
            "MetricName": "RestorationSuccess",
            "Value": 1 if not restore_results["errors"] else 0,
            "Unit": "Count",
            "Timestamp": datetime.now(timezone.utc),
        })
        
        # Tables restored
        successful_restores = sum(
            1 for r in restore_results["dynamodb_restores"] if r["status"] == "SUCCESS"
        )
        metrics.append({
            "MetricName": "TablesRestored",
            "Value": successful_restores,
            "Unit": "Count",
            "Timestamp": datetime.now(timezone.utc),
        })
        
        cloudwatch_client.put_metric_data(
            Namespace="B3Dashboard/DisasterRecovery",
            MetricData=metrics,
        )
        
    except Exception as e:
        logger.error(f"Failed to send restore metrics: {str(e)}")


def send_notification(subject: str, message: str) -> None:
    """
    Send SNS notification about restore status.
    """
    try:
        sns_client.publish(
            TopicArn=ALERT_TOPIC_ARN,
            Subject=f"[B3 Dashboard DR] {subject}",
            Message=message,
        )
    except Exception as e:
        logger.error(f"Failed to send notification: {str(e)}")
