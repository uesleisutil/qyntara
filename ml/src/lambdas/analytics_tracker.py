"""
Analytics Tracker Lambda

Tracks user behavior analytics including feature usage and navigation patterns.

Requirements: 83.11
"""

import json
import logging
import os
from datetime import datetime, UTC, timedelta
from typing import Dict, List, Optional

import boto3

from observability_service import observability, track_performance

# Initialize AWS clients
s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

# Environment variables
BUCKET = os.environ.get("BUCKET", "")
ANALYTICS_TABLE = os.environ.get("ANALYTICS_TABLE", "UserAnalytics")

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


@track_performance("track_analytics")
def handler(event, context):
    """
    Track user behavior analytics.
    
    Implements Req 83.11: Track user behavior analytics
    
    Expected event structure:
    {
        "user_id": "user123",
        "session_id": "session456",
        "event_type": "page_view" | "feature_usage" | "navigation" | "interaction",
        "event_data": {
            "page": "recommendations",
            "feature": "filter",
            "action": "click",
            "metadata": {}
        },
        "timestamp": "2024-01-01T12:00:00Z"
    }
    """
    try:
        # Parse event
        if "body" in event:
            body = json.loads(event["body"]) if isinstance(event["body"], str) else event["body"]
        else:
            body = event
        
        user_id = body.get("user_id", "anonymous")
        session_id = body.get("session_id", "")
        event_type = body.get("event_type", "")
        event_data = body.get("event_data", {})
        timestamp = body.get("timestamp", datetime.now(UTC).isoformat())
        
        # Validate required fields
        if not event_type:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "event_type is required"})
            }
        
        # Store analytics event
        analytics_entry = {
            "user_id": user_id,
            "session_id": session_id,
            "event_type": event_type,
            "event_data": event_data,
            "timestamp": timestamp
        }
        
        # Save to DynamoDB
        table = dynamodb.Table(ANALYTICS_TABLE)
        table.put_item(Item={
            "user_id": user_id,
            "timestamp": timestamp,
            "session_id": session_id,
            "event_type": event_type,
            "event_data": json.dumps(event_data)
        })
        
        # Track metrics based on event type
        if event_type == "page_view":
            page = event_data.get("page", "unknown")
            observability.put_metric(
                "PageViews",
                1,
                "Count",
                {"Page": page}
            )
        
        elif event_type == "feature_usage":
            feature = event_data.get("feature", "unknown")
            observability.put_metric(
                "FeatureUsage",
                1,
                "Count",
                {"Feature": feature}
            )
        
        elif event_type == "navigation":
            from_page = event_data.get("from", "unknown")
            to_page = event_data.get("to", "unknown")
            observability.put_metric(
                "NavigationEvents",
                1,
                "Count",
                {"From": from_page, "To": to_page}
            )
        
        # Save to S3 for long-term storage and analysis
        date_str = datetime.fromisoformat(timestamp.replace("Z", "+00:00")).date().isoformat()
        s3_key = f"analytics/dt={date_str}/{user_id}_{session_id}_{int(time.time() * 1000)}.json"
        
        s3.put_object(
            Bucket=BUCKET,
            Key=s3_key,
            Body=json.dumps(analytics_entry).encode("utf-8"),
            ContentType="application/json"
        )
        
        logger.info(f"Tracked analytics event: {event_type} for user {user_id}")
        
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "success": True,
                "event_id": f"{user_id}_{timestamp}"
            })
        }
        
    except Exception as e:
        logger.error(f"Error tracking analytics: {e}", exc_info=True)
        observability.log_error(str(e), type(e).__name__)
        
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Internal server error"})
        }


@track_performance("get_analytics_summary")
def get_analytics_summary_handler(event, context):
    """
    Get analytics summary for a user or time period.
    
    Implements Req 83.11: Track user behavior analytics
    """
    try:
        # Parse query parameters
        params = event.get("queryStringParameters", {}) or {}
        user_id = params.get("user_id", "")
        days = int(params.get("days", 7))
        
        # Calculate date range
        end_date = datetime.now(UTC)
        start_date = end_date - timedelta(days=days)
        
        # Query DynamoDB
        table = dynamodb.Table(ANALYTICS_TABLE)
        
        if user_id:
            # Query for specific user
            response = table.query(
                KeyConditionExpression="user_id = :uid AND #ts BETWEEN :start AND :end",
                ExpressionAttributeNames={"#ts": "timestamp"},
                ExpressionAttributeValues={
                    ":uid": user_id,
                    ":start": start_date.isoformat(),
                    ":end": end_date.isoformat()
                }
            )
        else:
            # Scan for all users (limited)
            response = table.scan(
                FilterExpression="#ts BETWEEN :start AND :end",
                ExpressionAttributeNames={"#ts": "timestamp"},
                ExpressionAttributeValues={
                    ":start": start_date.isoformat(),
                    ":end": end_date.isoformat()
                },
                Limit=1000
            )
        
        items = response.get("Items", [])
        
        # Aggregate analytics
        summary = {
            "total_events": len(items),
            "unique_users": len(set(item["user_id"] for item in items)),
            "unique_sessions": len(set(item["session_id"] for item in items if item.get("session_id"))),
            "event_types": {},
            "popular_pages": {},
            "popular_features": {},
            "navigation_patterns": []
        }
        
        for item in items:
            event_type = item.get("event_type", "unknown")
            summary["event_types"][event_type] = summary["event_types"].get(event_type, 0) + 1
            
            event_data = json.loads(item.get("event_data", "{}"))
            
            if event_type == "page_view":
                page = event_data.get("page", "unknown")
                summary["popular_pages"][page] = summary["popular_pages"].get(page, 0) + 1
            
            elif event_type == "feature_usage":
                feature = event_data.get("feature", "unknown")
                summary["popular_features"][feature] = summary["popular_features"].get(feature, 0) + 1
        
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps(summary)
        }
        
    except Exception as e:
        logger.error(f"Error getting analytics summary: {e}", exc_info=True)
        observability.log_error(str(e), type(e).__name__)
        
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Internal server error"})
        }


import time
