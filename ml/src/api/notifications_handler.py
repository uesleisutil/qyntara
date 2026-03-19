"""
Notification Management Lambda Handler

Handles notification operations for the dashboard.
Supports retrieving, marking as read, and deleting notifications.

Requirements: 5.4
"""

import json
import os
from datetime import datetime
from typing import Dict, Any
import boto3
from boto3.dynamodb.conditions import Key

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')
NOTIFICATIONS_TABLE = os.environ.get('NOTIFICATIONS_TABLE', 'B3TacticalRanking-Notifications')

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for notification operations
    
    Routes:
    - GET /api/notifications - Get all notifications for user
    - PUT /api/notifications/{notificationId}/read - Mark notification as read
    - PUT /api/notifications/read-all - Mark all notifications as read
    - DELETE /api/notifications/{notificationId} - Delete notification
    """
    
    try:
        http_method = event.get('httpMethod', '')
        path = event.get('path', '')
        path_parameters = event.get('pathParameters') or {}
        
        # Extract user ID from authorizer context
        user_id = get_user_id(event)
        
        if http_method == 'GET' and path == '/api/notifications':
            return get_notifications(user_id)
        
        elif http_method == 'PUT' and '/read' in path:
            if path == '/api/notifications/read-all':
                return mark_all_as_read(user_id)
            else:
                notification_id = path_parameters.get('notificationId')
                return mark_as_read(user_id, notification_id)
        
        elif http_method == 'DELETE' and '/api/notifications/' in path:
            notification_id = path_parameters.get('notificationId')
            return delete_notification(user_id, notification_id)
        
        else:
            return error_response(404, 'NOT_FOUND', 'Endpoint not found')
    
    except Exception as e:
        print(f"Error in lambda_handler: {str(e)}")
        return error_response(500, 'INTERNAL_ERROR', 'An unexpected error occurred')


def get_user_id(event: Dict[str, Any]) -> str:
    """Extract user ID from event context"""
    request_context = event.get('requestContext', {})
    authorizer = request_context.get('authorizer', {})
    
    user_id = authorizer.get('claims', {}).get('sub')
    if not user_id:
        # Fallback for testing
        user_id = event.get('headers', {}).get('x-user-id', 'default-user')
    
    return user_id


def get_notifications(user_id: str) -> Dict[str, Any]:
    """
    Get all notifications for a user
    
    Returns notifications sorted by timestamp (newest first)
    """
    try:
        table = dynamodb.Table(NOTIFICATIONS_TABLE)
        
        response = table.query(
            KeyConditionExpression=Key('userId').eq(user_id)
        )
        
        notifications = response.get('Items', [])
        
        # Sort by timestamp (newest first)
        notifications.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        # Limit to last 100 notifications
        notifications = notifications[:100]
        
        return success_response({
            'notifications': notifications,
            'count': len(notifications),
            'unreadCount': sum(1 for n in notifications if not n.get('read', False))
        })
    
    except Exception as e:
        print(f"Error getting notifications: {str(e)}")
        return error_response(500, 'DATABASE_ERROR', 'Failed to retrieve notifications')


def mark_as_read(user_id: str, notification_id: str) -> Dict[str, Any]:
    """
    Mark a notification as read
    """
    try:
        table = dynamodb.Table(NOTIFICATIONS_TABLE)
        
        # Check if notification exists and belongs to user
        response = table.get_item(
            Key={'userId': user_id, 'notificationId': notification_id}
        )
        
        if 'Item' not in response:
            return error_response(404, 'NOT_FOUND', 'Notification not found')
        
        # Update notification
        response = table.update_item(
            Key={'userId': user_id, 'notificationId': notification_id},
            UpdateExpression='SET #read = :read',
            ExpressionAttributeNames={'#read': 'read'},
            ExpressionAttributeValues={':read': True},
            ReturnValues='ALL_NEW'
        )
        
        return success_response({
            'notification': response['Attributes'],
            'message': 'Notification marked as read'
        })
    
    except Exception as e:
        print(f"Error marking notification as read: {str(e)}")
        return error_response(500, 'DATABASE_ERROR', 'Failed to update notification')


def mark_all_as_read(user_id: str) -> Dict[str, Any]:
    """
    Mark all notifications as read for a user
    """
    try:
        table = dynamodb.Table(NOTIFICATIONS_TABLE)
        
        # Get all unread notifications
        response = table.query(
            KeyConditionExpression=Key('userId').eq(user_id),
            FilterExpression='#read = :false',
            ExpressionAttributeNames={'#read': 'read'},
            ExpressionAttributeValues={':false': False}
        )
        
        notifications = response.get('Items', [])
        
        # Update each notification
        updated_count = 0
        for notification in notifications:
            try:
                table.update_item(
                    Key={
                        'userId': user_id,
                        'notificationId': notification['notificationId']
                    },
                    UpdateExpression='SET #read = :read',
                    ExpressionAttributeNames={'#read': 'read'},
                    ExpressionAttributeValues={':read': True}
                )
                updated_count += 1
            except Exception as e:
                print(f"Error updating notification {notification['notificationId']}: {str(e)}")
        
        return success_response({
            'message': f'Marked {updated_count} notifications as read',
            'updatedCount': updated_count
        })
    
    except Exception as e:
        print(f"Error marking all notifications as read: {str(e)}")
        return error_response(500, 'DATABASE_ERROR', 'Failed to update notifications')


def delete_notification(user_id: str, notification_id: str) -> Dict[str, Any]:
    """
    Delete a notification
    """
    try:
        table = dynamodb.Table(NOTIFICATIONS_TABLE)
        
        # Check if notification exists and belongs to user
        response = table.get_item(
            Key={'userId': user_id, 'notificationId': notification_id}
        )
        
        if 'Item' not in response:
            return error_response(404, 'NOT_FOUND', 'Notification not found')
        
        # Delete notification
        table.delete_item(
            Key={'userId': user_id, 'notificationId': notification_id}
        )
        
        return success_response({
            'message': 'Notification deleted successfully'
        })
    
    except Exception as e:
        print(f"Error deleting notification: {str(e)}")
        return error_response(500, 'DATABASE_ERROR', 'Failed to delete notification')


def success_response(data: Dict[str, Any], status_code: int = 200) -> Dict[str, Any]:
    """Create a success response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps({
            'data': data,
            'metadata': {
                'timestamp': datetime.utcnow().isoformat(),
                'version': '1.0'
            }
        })
    }


def error_response(status_code: int, error_code: str, message: str) -> Dict[str, Any]:
    """Create an error response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps({
            'error': {
                'code': error_code,
                'message': message
            },
            'metadata': {
                'timestamp': datetime.utcnow().isoformat()
            }
        })
    }
