"""
API Key Management Lambda.

Implements:
- Requirement 65.2: API key authentication
- Requirement 82.5: API key management
- Create, list, revoke, and rotate API keys
- Store hashed keys in DynamoDB
"""

import hashlib
import json
import logging
import os
import secrets
from datetime import UTC, datetime, timedelta
from typing import Dict, Optional

import boto3
from botocore.exceptions import ClientError

# Initialize AWS clients
dynamodb = boto3.resource("dynamodb")
cognito = boto3.client("cognito-idp")

# Environment variables
API_KEYS_TABLE = os.environ.get("API_KEYS_TABLE", "")
USER_POOL_ID = os.environ.get("USER_POOL_ID", "")

# Logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def cors_headers() -> Dict[str, str]:
    """Return CORS headers for API responses."""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Content-Type": "application/json"
    }


def error_response(status_code: int, error_code: str, message: str) -> Dict:
    """Create standardized error response."""
    return {
        "statusCode": status_code,
        "headers": cors_headers(),
        "body": json.dumps({
            "error": {
                "code": error_code,
                "message": message
            }
        })
    }


def success_response(data: Dict, status_code: int = 200) -> Dict:
    """Create standardized success response."""
    return {
        "statusCode": status_code,
        "headers": cors_headers(),
        "body": json.dumps(data)
    }


def generate_api_key() -> str:
    """Generate a secure random API key."""
    return f"btr_{secrets.token_urlsafe(32)}"


def hash_api_key(api_key: str) -> str:
    """Hash API key for secure storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()


def get_user_from_token(authorization_header: str) -> Optional[str]:
    """Extract user ID from Cognito JWT token."""
    if not authorization_header or not authorization_header.startswith("Bearer "):
        return None
    
    token = authorization_header.replace("Bearer ", "")
    
    try:
        # Verify token with Cognito
        response = cognito.get_user(AccessToken=token)
        
        # Extract user ID from attributes
        user_id = response.get("Username")
        return user_id
    
    except Exception as e:
        logger.error(f"Error verifying token: {e}")
        return None


def create_api_key(user_id: str, name: str, expires_days: int = 90) -> Dict:
    """
    Create a new API key for a user.
    
    Args:
        user_id: The user ID
        name: Friendly name for the API key
        expires_days: Number of days until expiration (default: 90)
    
    Returns:
        Dict with API key details
    """
    try:
        table = dynamodb.Table(API_KEYS_TABLE)
        
        # Generate API key
        api_key = generate_api_key()
        hashed_key = hash_api_key(api_key)
        
        # Calculate expiration
        created_at = datetime.now(UTC)
        expires_at = created_at + timedelta(days=expires_days)
        
        # Store in DynamoDB
        item = {
            "apiKeyHash": hashed_key,
            "userId": user_id,
            "name": name,
            "createdAt": created_at.isoformat(),
            "expiresAt": expires_at.isoformat(),
            "lastUsed": None,
            "enabled": True,
            "requestCount": 0
        }
        
        table.put_item(Item=item)
        
        # Return API key (only time it's shown in plain text)
        return {
            "apiKey": api_key,
            "apiKeyHash": hashed_key,
            "name": name,
            "createdAt": created_at.isoformat(),
            "expiresAt": expires_at.isoformat(),
            "enabled": True
        }
    
    except Exception as e:
        logger.error(f"Error creating API key: {e}")
        raise


def list_api_keys(user_id: str) -> list:
    """
    List all API keys for a user.
    
    Args:
        user_id: The user ID
    
    Returns:
        List of API key details (without plain text keys)
    """
    try:
        table = dynamodb.Table(API_KEYS_TABLE)
        
        # Query by userId (requires GSI)
        response = table.scan(
            FilterExpression="userId = :user_id",
            ExpressionAttributeValues={":user_id": user_id}
        )
        
        items = response.get("Items", [])
        
        # Remove sensitive data
        for item in items:
            item.pop("apiKeyHash", None)
        
        # Sort by creation date
        items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
        
        return items
    
    except Exception as e:
        logger.error(f"Error listing API keys: {e}")
        raise


def revoke_api_key(user_id: str, api_key_hash: str) -> bool:
    """
    Revoke (disable) an API key.
    
    Args:
        user_id: The user ID
        api_key_hash: The hashed API key
    
    Returns:
        True if successful
    """
    try:
        table = dynamodb.Table(API_KEYS_TABLE)
        
        # Verify ownership
        response = table.get_item(Key={"apiKeyHash": api_key_hash})
        
        if "Item" not in response:
            raise ValueError("API key not found")
        
        item = response["Item"]
        
        if item.get("userId") != user_id:
            raise ValueError("Unauthorized: API key belongs to different user")
        
        # Disable the key
        table.update_item(
            Key={"apiKeyHash": api_key_hash},
            UpdateExpression="SET enabled = :enabled",
            ExpressionAttributeValues={":enabled": False}
        )
        
        return True
    
    except Exception as e:
        logger.error(f"Error revoking API key: {e}")
        raise


def rotate_api_key(user_id: str, old_api_key_hash: str, name: str) -> Dict:
    """
    Rotate an API key (revoke old, create new).
    
    Args:
        user_id: The user ID
        old_api_key_hash: The hashed API key to rotate
        name: Name for the new API key
    
    Returns:
        Dict with new API key details
    """
    try:
        # Revoke old key
        revoke_api_key(user_id, old_api_key_hash)
        
        # Create new key
        new_key = create_api_key(user_id, name)
        
        return new_key
    
    except Exception as e:
        logger.error(f"Error rotating API key: {e}")
        raise


def lambda_handler(event, context):
    """
    Main Lambda handler for API key management.
    
    Endpoints:
    - POST /api/keys - Create new API key
    - GET /api/keys - List user's API keys
    - DELETE /api/keys/{keyHash} - Revoke API key
    - POST /api/keys/{keyHash}/rotate - Rotate API key
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    # Handle OPTIONS requests for CORS
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": cors_headers(),
            "body": ""
        }
    
    # Extract user from authorization header
    headers = event.get("headers", {})
    authorization = headers.get("Authorization") or headers.get("authorization")
    
    if not authorization:
        return error_response(401, "AUTHENTICATION_ERROR", "Authorization header is required")
    
    user_id = get_user_from_token(authorization)
    
    if not user_id:
        return error_response(401, "AUTHENTICATION_ERROR", "Invalid or expired token")
    
    # Extract path and method
    path = event.get("path", "")
    method = event.get("httpMethod", "")
    path_parameters = event.get("pathParameters") or {}
    
    try:
        # Route to appropriate handler
        if method == "POST" and path.endswith("/api/keys"):
            # Create new API key
            body = json.loads(event.get("body", "{}"))
            name = body.get("name", "Unnamed Key")
            expires_days = body.get("expiresDays", 90)
            
            result = create_api_key(user_id, name, expires_days)
            return success_response(result, 201)
        
        elif method == "GET" and path.endswith("/api/keys"):
            # List API keys
            keys = list_api_keys(user_id)
            return success_response({"keys": keys})
        
        elif method == "DELETE" and "/api/keys/" in path:
            # Revoke API key
            key_hash = path_parameters.get("keyHash")
            
            if not key_hash:
                return error_response(400, "VALIDATION_ERROR", "keyHash is required")
            
            revoke_api_key(user_id, key_hash)
            return success_response({"message": "API key revoked successfully"})
        
        elif method == "POST" and path.endswith("/rotate"):
            # Rotate API key
            key_hash = path_parameters.get("keyHash")
            body = json.loads(event.get("body", "{}"))
            name = body.get("name", "Rotated Key")
            
            if not key_hash:
                return error_response(400, "VALIDATION_ERROR", "keyHash is required")
            
            result = rotate_api_key(user_id, key_hash, name)
            return success_response(result)
        
        else:
            return error_response(404, "NOT_FOUND", f"Endpoint not found: {method} {path}")
    
    except ValueError as e:
        return error_response(400, "VALIDATION_ERROR", str(e))
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return error_response(500, "INTERNAL_ERROR", "An unexpected error occurred")
