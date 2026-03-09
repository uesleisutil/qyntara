"""
Public Recommendations API

Simple API to serve the latest recommendations for the dashboard.
Requires API Key authentication via API Gateway.
"""

import json
import logging
import os
from datetime import datetime, timedelta
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')


def handler(event, context):
    """
    Lambda handler for public recommendations API.
    
    Returns the most recent recommendations from S3.
    """
    try:
        logger.info(f"Recommendations API request: {json.dumps(event)}")
        
        # Get bucket from environment
        bucket = os.environ.get('BUCKET')
        if not bucket:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({'error': 'Bucket not configured'})
            }
        
        # Get path from API Gateway
        path = event.get('path', '')
        resource = event.get('resource', '')
        
        # Route based on path
        if '/recommendations' in path or '/recommendations' in resource:
            result = get_latest_recommendations(bucket)
        elif '/quality' in path or '/quality' in resource:
            result = get_quality_metrics(bucket)
        elif '/ingestion' in path or '/ingestion' in resource:
            result = get_ingestion_status(bucket)
        else:
            result = {
                'error': 'Unknown endpoint',
                'available_endpoints': [
                    '/recommendations',
                    '/quality',
                    '/ingestion'
                ]
            }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
                'Cache-Control': 'max-age=300',  # Cache for 5 minutes
            },
            'body': json.dumps(result)
        }
        
    except Exception as e:
        logger.error(f"Error in recommendations API: {e}", exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({'error': str(e)})
        }


def get_latest_recommendations(bucket: str) -> dict:
    """Get the most recent recommendations."""
    try:
        # List recommendation files
        response = s3.list_objects_v2(
            Bucket=bucket,
            Prefix='recommendations/',
            MaxKeys=100
        )
        
        if 'Contents' not in response or len(response['Contents']) == 0:
            return {
                'recommendations': [],
                'message': 'No recommendations available yet'
            }
        
        # Find most recent file
        files = sorted(response['Contents'], key=lambda x: x['LastModified'], reverse=True)
        latest_file = files[0]
        
        # Read the file
        obj = s3.get_object(Bucket=bucket, Key=latest_file['Key'])
        data = json.loads(obj['Body'].read())
        
        # Add metadata
        data['last_updated'] = latest_file['LastModified'].isoformat()
        data['file_key'] = latest_file['Key']
        
        return data
        
    except Exception as e:
        logger.error(f"Error getting recommendations: {e}")
        return {
            'error': str(e),
            'recommendations': []
        }


def get_quality_metrics(bucket: str) -> dict:
    """Get recent quality metrics."""
    try:
        # Get last 30 days of quality data
        cutoff_date = datetime.now() - timedelta(days=30)
        
        response = s3.list_objects_v2(
            Bucket=bucket,
            Prefix='monitoring/model_quality/',
            MaxKeys=100
        )
        
        if 'Contents' not in response:
            return {
                'quality_data': [],
                'message': 'No quality data available yet'
            }
        
        # Filter and load recent files
        quality_data = []
        for obj in response['Contents']:
            if obj['LastModified'] >= cutoff_date:
                try:
                    data_obj = s3.get_object(Bucket=bucket, Key=obj['Key'])
                    data = json.loads(data_obj['Body'].read())
                    quality_data.append(data)
                except Exception as e:
                    logger.warning(f"Error loading {obj['Key']}: {e}")
                    continue
        
        # Sort by date
        quality_data.sort(key=lambda x: x.get('dt', ''), reverse=True)
        
        return {
            'quality_data': quality_data[:30],  # Last 30 days
            'count': len(quality_data)
        }
        
    except Exception as e:
        logger.error(f"Error getting quality metrics: {e}")
        return {
            'error': str(e),
            'quality_data': []
        }


def get_ingestion_status(bucket: str) -> dict:
    """Get recent ingestion status."""
    try:
        # Get last 48 hours of ingestion data
        cutoff_time = datetime.now() - timedelta(hours=48)
        
        response = s3.list_objects_v2(
            Bucket=bucket,
            Prefix='monitoring/ingestion/',
            MaxKeys=200
        )
        
        if 'Contents' not in response:
            return {
                'ingestion_data': [],
                'message': 'No ingestion data available yet'
            }
        
        # Filter and load recent files
        ingestion_data = []
        for obj in response['Contents']:
            if obj['LastModified'] >= cutoff_time:
                try:
                    data_obj = s3.get_object(Bucket=bucket, Key=obj['Key'])
                    data = json.loads(data_obj['Body'].read())
                    ingestion_data.append(data)
                except Exception as e:
                    logger.warning(f"Error loading {obj['Key']}: {e}")
                    continue
        
        # Sort by timestamp
        ingestion_data.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        # Calculate summary
        total = len(ingestion_data)
        successful = sum(1 for d in ingestion_data if d.get('status') == 'success')
        
        return {
            'ingestion_data': ingestion_data[:100],  # Last 100 records
            'summary': {
                'total_records': total,
                'successful': successful,
                'success_rate': successful / total if total > 0 else 0,
                'last_48_hours': True
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting ingestion status: {e}")
        return {
            'error': str(e),
            'ingestion_data': []
        }
