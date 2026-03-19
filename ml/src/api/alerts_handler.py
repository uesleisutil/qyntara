"""
Alert Management Lambda Handler

Handles CRUD operations for ticker alerts stored in DynamoDB.
Supports alert creation, retrieval, update, and deletion.

Requirements: 5.1, 5.2, 5.5, 5.6, 5.7, 5.8
"""

import json
import os
import uuid
from datetime import datetime
from typing import Dict, List, Any
import boto3
from boto3.dynamodb.conditions import Key

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')
ALERTS_TABLE = os.environ.get('ALERTS_TABLE', 'B3TacticalRanking-Alerts')

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Main Lambda handler for alert operations
    
    Routes:
    - GET /api/alerts - Get all alerts for user
    - POST /api/alerts - Create new alert
    - PUT /api/alerts/{alertId} - Update alert
    - DELETE /api/alerts/{alertId} - Delete alert
    - POST /api/alerts/check - Check for triggered alerts
    """
    
    try:
        http_method = event.get('httpMethod', '')
        path = event.get('path', '')
        path_parameters = event.get('pathParameters') or {}
        
        # Extract user ID from authorizer context (Cognito)
        user_id = get_user_id(event)
        
        if http_method == 'GET' and path == '/api/alerts':
            return get_alerts(user_id)
        
        elif http_method == 'POST' and path == '/api/alerts':
            body = json.loads(event.get('body', '{}'))
            return create_alert(user_id, body)
        
        elif http_method == 'PUT' and '/api/alerts/' in path:
            alert_id = path_parameters.get('alertId')
            body = json.loads(event.get('body', '{}'))
            return update_alert(user_id, alert_id, body)
        
        elif http_method == 'DELETE' and '/api/alerts/' in path:
            alert_id = path_parameters.get('alertId')
            return delete_alert(user_id, alert_id)
        
        elif http_method == 'POST' and path == '/api/alerts/check':
            body = json.loads(event.get('body', '{}'))
            recommendations = body.get('recommendations', [])
            return check_triggered_alerts(user_id, recommendations)
        
        else:
            return error_response(404, 'NOT_FOUND', 'Endpoint not found')
    
    except Exception as e:
        print(f"Error in lambda_handler: {str(e)}")
        return error_response(500, 'INTERNAL_ERROR', 'An unexpected error occurred')


def get_user_id(event: Dict[str, Any]) -> str:
    """Extract user ID from event context"""
    # In production, extract from Cognito authorizer
    # For now, use a default user ID or from headers
    request_context = event.get('requestContext', {})
    authorizer = request_context.get('authorizer', {})
    
    user_id = authorizer.get('claims', {}).get('sub')
    if not user_id:
        # Fallback for testing
        user_id = event.get('headers', {}).get('x-user-id', 'default-user')
    
    return user_id


def get_alerts(user_id: str) -> Dict[str, Any]:
    """
    Get all alerts for a user
    
    Requirements: 5.5, 5.8
    """
    try:
        table = dynamodb.Table(ALERTS_TABLE)
        
        response = table.query(
            KeyConditionExpression=Key('userId').eq(user_id)
        )
        
        alerts = response.get('Items', [])
        
        # Sort by creation date (newest first)
        alerts.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
        
        return success_response({
            'alerts': alerts,
            'count': len(alerts)
        })
    
    except Exception as e:
        print(f"Error getting alerts: {str(e)}")
        return error_response(500, 'DATABASE_ERROR', 'Failed to retrieve alerts')


def create_alert(user_id: str, alert_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new alert
    
    Requirements: 5.1, 5.2, 5.3
    """
    try:
        # Validate required fields
        required_fields = ['ticker', 'conditionType', 'threshold']
        for field in required_fields:
            if field not in alert_data:
                return error_response(400, 'VALIDATION_ERROR', f'Missing required field: {field}')
        
        # Validate condition type
        valid_conditions = ['score_change', 'return_change', 'rank_change']
        if alert_data['conditionType'] not in valid_conditions:
            return error_response(400, 'VALIDATION_ERROR', f'Invalid condition type. Must be one of: {valid_conditions}')
        
        # Validate threshold
        try:
            threshold = float(alert_data['threshold'])
            if threshold < 0:
                return error_response(400, 'VALIDATION_ERROR', 'Threshold must be non-negative')
        except (ValueError, TypeError):
            return error_response(400, 'VALIDATION_ERROR', 'Threshold must be a number')
        
        # Create alert
        alert_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        alert = {
            'userId': user_id,
            'alertId': alert_id,
            'ticker': alert_data['ticker'].upper(),
            'conditionType': alert_data['conditionType'],
            'threshold': threshold,
            'enabled': alert_data.get('enabled', True),
            'createdAt': now,
            'updatedAt': now,
            'lastValue': None,
            'triggered': False
        }
        
        table = dynamodb.Table(ALERTS_TABLE)
        table.put_item(Item=alert)
        
        return success_response({
            'alert': alert,
            'message': 'Alert created successfully'
        }, status_code=201)
    
    except Exception as e:
        print(f"Error creating alert: {str(e)}")
        return error_response(500, 'DATABASE_ERROR', 'Failed to create alert')


def update_alert(user_id: str, alert_id: str, alert_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update an existing alert
    
    Requirements: 5.6
    """
    try:
        table = dynamodb.Table(ALERTS_TABLE)
        
        # Check if alert exists and belongs to user
        response = table.get_item(
            Key={'userId': user_id, 'alertId': alert_id}
        )
        
        if 'Item' not in response:
            return error_response(404, 'NOT_FOUND', 'Alert not found')
        
        # Update fields
        now = datetime.utcnow().isoformat()
        update_expression = 'SET updatedAt = :updatedAt'
        expression_values = {':updatedAt': now}
        
        if 'conditionType' in alert_data:
            update_expression += ', conditionType = :conditionType'
            expression_values[':conditionType'] = alert_data['conditionType']
        
        if 'threshold' in alert_data:
            update_expression += ', threshold = :threshold'
            expression_values[':threshold'] = float(alert_data['threshold'])
        
        if 'enabled' in alert_data:
            update_expression += ', enabled = :enabled'
            expression_values[':enabled'] = alert_data['enabled']
        
        response = table.update_item(
            Key={'userId': user_id, 'alertId': alert_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
            ReturnValues='ALL_NEW'
        )
        
        return success_response({
            'alert': response['Attributes'],
            'message': 'Alert updated successfully'
        })
    
    except Exception as e:
        print(f"Error updating alert: {str(e)}")
        return error_response(500, 'DATABASE_ERROR', 'Failed to update alert')


def delete_alert(user_id: str, alert_id: str) -> Dict[str, Any]:
    """
    Delete an alert
    
    Requirements: 5.7
    """
    try:
        table = dynamodb.Table(ALERTS_TABLE)
        
        # Check if alert exists and belongs to user
        response = table.get_item(
            Key={'userId': user_id, 'alertId': alert_id}
        )
        
        if 'Item' not in response:
            return error_response(404, 'NOT_FOUND', 'Alert not found')
        
        # Delete alert
        table.delete_item(
            Key={'userId': user_id, 'alertId': alert_id}
        )
        
        return success_response({
            'message': 'Alert deleted successfully'
        })
    
    except Exception as e:
        print(f"Error deleting alert: {str(e)}")
        return error_response(500, 'DATABASE_ERROR', 'Failed to delete alert')


def check_triggered_alerts(user_id: str, recommendations: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Check which alerts are triggered based on current recommendations
    
    Requirements: 5.4
    """
    try:
        # Get user's alerts
        table = dynamodb.Table(ALERTS_TABLE)
        response = table.query(
            KeyConditionExpression=Key('userId').eq(user_id)
        )
        
        alerts = response.get('Items', [])
        triggered = []
        
        # Check each alert
        for alert in alerts:
            if not alert.get('enabled', True):
                continue
            
            # Find ticker in recommendations
            ticker_data = next(
                (r for r in recommendations if r.get('ticker') == alert['ticker']),
                None
            )
            
            if not ticker_data:
                continue
            
            # Check condition
            is_triggered, message = check_alert_condition(alert, ticker_data)
            
            if is_triggered:
                triggered.append({
                    'alertId': alert['alertId'],
                    'ticker': alert['ticker'],
                    'conditionType': alert['conditionType'],
                    'threshold': alert['threshold'],
                    'message': message,
                    'timestamp': datetime.utcnow().isoformat()
                })
                
                # Create notification
                create_notification(user_id, alert, message)
        
        return success_response({
            'triggered': triggered,
            'count': len(triggered)
        })
    
    except Exception as e:
        print(f"Error checking triggered alerts: {str(e)}")
        return error_response(500, 'PROCESSING_ERROR', 'Failed to check alerts')


def check_alert_condition(alert: Dict[str, Any], ticker_data: Dict[str, Any]) -> tuple:
    """
    Check if an alert condition is met
    
    Returns: (is_triggered: bool, message: str)
    """
    condition_type = alert['conditionType']
    threshold = alert['threshold']
    last_value = alert.get('lastValue')
    
    if condition_type == 'score_change':
        current_score = ticker_data.get('confidence_score') or ticker_data.get('score', 0)
        if last_value is not None:
            diff = abs(current_score - last_value)
            if diff >= threshold:
                return True, f"Score mudou {diff:.1f} pontos (threshold: {threshold})"
    
    elif condition_type == 'return_change':
        current_return = (ticker_data.get('expected_return') or ticker_data.get('exp_return_20', 0)) * 100
        if last_value is not None:
            diff = abs(current_return - last_value)
            if diff >= threshold:
                return True, f"Retorno mudou {diff:.2f}% (threshold: {threshold}%)"
    
    elif condition_type == 'rank_change':
        current_rank = ticker_data.get('rank', 0)
        if last_value is not None:
            diff = abs(current_rank - last_value)
            if diff >= threshold:
                return True, f"Ranking mudou {diff} posições (threshold: {threshold})"
    
    return False, ""


def create_notification(user_id: str, alert: Dict[str, Any], message: str):
    """
    Create a notification for a triggered alert
    
    Requirements: 5.4
    """
    try:
        notifications_table = dynamodb.Table(
            os.environ.get('NOTIFICATIONS_TABLE', 'B3TacticalRanking-Notifications')
        )
        
        notification_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        notification = {
            'userId': user_id,
            'notificationId': notification_id,
            'type': 'warning',
            'category': 'alert',
            'title': f'Alerta: {alert["ticker"]}',
            'message': message,
            'timestamp': now,
            'read': False,
            'alertId': alert['alertId']
        }
        
        notifications_table.put_item(Item=notification)
        
    except Exception as e:
        print(f"Error creating notification: {str(e)}")
        # Don't fail the alert check if notification creation fails


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
