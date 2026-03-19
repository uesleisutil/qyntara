"""
Authentication and Authorization Service

Implements:
- Requirement 82.2: Enterprise SSO integration (SAML, OAuth)
- Requirement 82.3: Role-based access control (admin, analyst, viewer)
- Requirement 82.4: Restrict sensitive features to admin users
- Requirement 82.6: API key rotation (90 days)
- Requirement 82.7: Log all authentication attempts
- Requirement 82.8: Session timeout (60 minutes)
"""

import hashlib
import json
import logging
import os
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any, Dict, Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS clients
dynamodb = boto3.resource("dynamodb")
cognito = boto3.client("cognito-idp")
cloudwatch = boto3.client("cloudwatch")

# Environment variables
USER_POOL_ID = os.environ.get("USER_POOL_ID", "")
API_KEYS_TABLE = os.environ.get("API_KEYS_TABLE", "")
AUTH_LOGS_TABLE = os.environ.get("AUTH_LOGS_TABLE", "")

# Constants
SESSION_TIMEOUT_MINUTES = 60
API_KEY_ROTATION_DAYS = 90
ROLE_HIERARCHY = {"viewer": 1, "analyst": 2, "admin": 3}


class AuthenticationError(Exception):
    """Raised when authentication fails"""
    pass


class AuthorizationError(Exception):
    """Raised when authorization fails"""
    pass


def hash_api_key(api_key: str) -> str:
    """
    Hash an API key using SHA-256.
    
    Args:
        api_key: The API key to hash
        
    Returns:
        Hexadecimal hash string
    """
    return hashlib.sha256(api_key.encode()).hexdigest()


def generate_api_key() -> str:
    """
    Generate a secure random API key.
    
    Returns:
        A 64-character hexadecimal API key
    """
    return secrets.token_hex(32)


def log_auth_attempt(
    user_id: str,
    auth_type: str,
    success: bool,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    reason: Optional[str] = None
) -> None:
    """
    Log authentication attempt to DynamoDB and CloudWatch.
    Implements Requirement 82.7.
    
    Args:
        user_id: User identifier
        auth_type: Type of authentication (cognito, api_key, sso)
        success: Whether authentication succeeded
        ip_address: Client IP address
        user_agent: Client user agent
        reason: Failure reason if unsuccessful
    """
    timestamp = datetime.now(UTC).isoformat()
    
    # Log to DynamoDB
    try:
        table = dynamodb.Table(AUTH_LOGS_TABLE)
        table.put_item(
            Item={
                "userId": user_id,
                "timestamp": timestamp,
                "authType": auth_type,
                "success": success,
                "ipAddress": ip_address or "unknown",
                "userAgent": user_agent or "unknown",
                "reason": reason or "",
                "ttl": int((datetime.now(UTC) + timedelta(days=90)).timestamp())
            }
        )
    except Exception as e:
        logger.error(f"Failed to log auth attempt to DynamoDB: {e}")
    
    # Log to CloudWatch Metrics
    try:
        cloudwatch.put_metric_data(
            Namespace="B3Dashboard/Authentication",
            MetricData=[
                {
                    "MetricName": "AuthenticationAttempts",
                    "Value": 1,
                    "Unit": "Count",
                    "Timestamp": datetime.now(UTC),
                    "Dimensions": [
                        {"Name": "AuthType", "Value": auth_type},
                        {"Name": "Success", "Value": str(success)}
                    ]
                }
            ]
        )
    except Exception as e:
        logger.error(f"Failed to log auth metric to CloudWatch: {e}")
    
    # Log to CloudWatch Logs
    logger.info(
        f"Auth attempt: user={user_id}, type={auth_type}, success={success}, "
        f"ip={ip_address}, reason={reason}"
    )


def verify_cognito_token(access_token: str) -> Dict[str, Any]:
    """
    Verify AWS Cognito access token and extract user information.
    Implements Requirement 82.1, 82.8.
    
    Args:
        access_token: Cognito access token
        
    Returns:
        User information including userId, email, role
        
    Raises:
        AuthenticationError: If token is invalid or expired
    """
    try:
        # Get user info from Cognito
        response = cognito.get_user(AccessToken=access_token)
        
        # Extract user attributes
        attributes = {attr["Name"]: attr["Value"] for attr in response["UserAttributes"]}
        
        user_id = response["Username"]
        email = attributes.get("email", "")
        role = attributes.get("custom:role", "viewer")
        
        # Validate role
        if role not in ROLE_HIERARCHY:
            role = "viewer"
        
        # Log successful authentication
        log_auth_attempt(user_id, "cognito", True)
        
        return {
            "userId": user_id,
            "email": email,
            "role": role,
            "authType": "cognito"
        }
        
    except cognito.exceptions.NotAuthorizedException as e:
        logger.warning(f"Invalid Cognito token: {e}")
        log_auth_attempt("unknown", "cognito", False, reason="Invalid token")
        raise AuthenticationError("Invalid or expired token")
    except Exception as e:
        logger.error(f"Error verifying Cognito token: {e}")
        log_auth_attempt("unknown", "cognito", False, reason=str(e))
        raise AuthenticationError("Authentication failed")


def verify_api_key(api_key: str, ip_address: Optional[str] = None) -> Dict[str, Any]:
    """
    Verify API key and check expiration.
    Implements Requirement 82.5, 82.6.
    
    Args:
        api_key: The API key to verify
        ip_address: Client IP address for logging
        
    Returns:
        User information including userId, role
        
    Raises:
        AuthenticationError: If API key is invalid or expired
    """
    try:
        # Hash the API key
        key_hash = hash_api_key(api_key)
        
        # Look up in DynamoDB
        table = dynamodb.Table(API_KEYS_TABLE)
        response = table.get_item(Key={"apiKeyHash": key_hash})
        
        if "Item" not in response:
            log_auth_attempt("unknown", "api_key", False, ip_address, reason="Invalid key")
            raise AuthenticationError("Invalid API key")
        
        key_data = response["Item"]
        
        # Check if key is enabled
        if not key_data.get("enabled", False):
            log_auth_attempt(
                key_data.get("userId", "unknown"),
                "api_key",
                False,
                ip_address,
                reason="Key disabled"
            )
            raise AuthenticationError("API key has been revoked")
        
        # Check expiration
        expires_at = datetime.fromisoformat(key_data["expiresAt"].replace("Z", "+00:00"))
        if datetime.now(UTC) > expires_at:
            log_auth_attempt(
                key_data.get("userId", "unknown"),
                "api_key",
                False,
                ip_address,
                reason="Key expired"
            )
            raise AuthenticationError("API key has expired")
        
        # Update last used timestamp and request count
        table.update_item(
            Key={"apiKeyHash": key_hash},
            UpdateExpression="SET lastUsed = :now, requestCount = requestCount + :inc",
            ExpressionAttributeValues={
                ":now": datetime.now(UTC).isoformat(),
                ":inc": 1
            }
        )
        
        # Log successful authentication
        user_id = key_data.get("userId", "unknown")
        log_auth_attempt(user_id, "api_key", True, ip_address)
        
        return {
            "userId": user_id,
            "role": key_data.get("role", "viewer"),
            "authType": "api_key",
            "keyName": key_data.get("name", "")
        }
        
    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(f"Error verifying API key: {e}")
        log_auth_attempt("unknown", "api_key", False, ip_address, reason=str(e))
        raise AuthenticationError("Authentication failed")


def check_authorization(user_role: str, required_role: str) -> bool:
    """
    Check if user has required role.
    Implements Requirement 82.3, 82.4.
    
    Args:
        user_role: User's current role
        required_role: Required role for the operation
        
    Returns:
        True if authorized, False otherwise
    """
    user_level = ROLE_HIERARCHY.get(user_role, 0)
    required_level = ROLE_HIERARCHY.get(required_role, 0)
    
    # If required role is invalid, deny access
    if required_level == 0 and required_role not in ROLE_HIERARCHY:
        return False
    
    return user_level >= required_level


def authenticate_request(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Authenticate incoming API request.
    Supports both Cognito tokens and API keys.
    
    Args:
        event: Lambda event object
        
    Returns:
        User information
        
    Raises:
        AuthenticationError: If authentication fails
    """
    headers = event.get("headers", {})
    
    # Get IP address for logging
    ip_address = (
        headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or event.get("requestContext", {}).get("identity", {}).get("sourceIp")
    )
    
    # Try Authorization header first (Bearer token or API key)
    auth_header = headers.get("Authorization", headers.get("authorization", ""))
    
    if auth_header.startswith("Bearer "):
        # Cognito access token
        token = auth_header[7:]
        return verify_cognito_token(token)
    
    elif auth_header.startswith("ApiKey "):
        # API key
        api_key = auth_header[7:]
        return verify_api_key(api_key, ip_address)
    
    # Try x-api-key header
    api_key = headers.get("x-api-key", headers.get("X-API-Key", ""))
    if api_key:
        return verify_api_key(api_key, ip_address)
    
    # No authentication provided
    log_auth_attempt("unknown", "none", False, ip_address, reason="No credentials")
    raise AuthenticationError("Authentication required")


def create_api_key(
    user_id: str,
    name: str,
    role: str = "viewer",
    expires_days: int = API_KEY_ROTATION_DAYS
) -> Dict[str, Any]:
    """
    Create a new API key for a user.
    Implements Requirement 82.5, 82.6.
    
    Args:
        user_id: User identifier
        name: Friendly name for the key
        role: Role to assign to the key
        expires_days: Days until expiration
        
    Returns:
        Dictionary with apiKey and metadata
    """
    # Generate API key
    api_key = generate_api_key()
    key_hash = hash_api_key(api_key)
    
    # Calculate expiration
    created_at = datetime.now(UTC)
    expires_at = created_at + timedelta(days=expires_days)
    
    # Store in DynamoDB
    table = dynamodb.Table(API_KEYS_TABLE)
    table.put_item(
        Item={
            "apiKeyHash": key_hash,
            "userId": user_id,
            "name": name,
            "role": role,
            "createdAt": created_at.isoformat(),
            "expiresAt": expires_at.isoformat(),
            "lastUsed": None,
            "enabled": True,
            "requestCount": 0
        }
    )
    
    logger.info(f"Created API key for user {user_id}: {name}")
    
    return {
        "apiKey": api_key,
        "apiKeyHash": key_hash,
        "name": name,
        "role": role,
        "createdAt": created_at.isoformat(),
        "expiresAt": expires_at.isoformat()
    }


def rotate_api_key(key_hash: str, user_id: str) -> Dict[str, Any]:
    """
    Rotate an API key by creating a new one and revoking the old one.
    Implements Requirement 82.6.
    
    Args:
        key_hash: Hash of the key to rotate
        user_id: User identifier (for verification)
        
    Returns:
        New API key information
    """
    table = dynamodb.Table(API_KEYS_TABLE)
    
    # Get old key info
    response = table.get_item(Key={"apiKeyHash": key_hash})
    if "Item" not in response:
        raise ValueError("API key not found")
    
    old_key = response["Item"]
    
    # Verify ownership
    if old_key["userId"] != user_id:
        raise AuthorizationError("Not authorized to rotate this key")
    
    # Create new key
    new_key = create_api_key(
        user_id=user_id,
        name=f"{old_key['name']} (Rotated)",
        role=old_key.get("role", "viewer"),
        expires_days=API_KEY_ROTATION_DAYS
    )
    
    # Revoke old key
    table.update_item(
        Key={"apiKeyHash": key_hash},
        UpdateExpression="SET enabled = :false",
        ExpressionAttributeValues={":false": False}
    )
    
    logger.info(f"Rotated API key for user {user_id}")
    
    return new_key


def revoke_api_key(key_hash: str, user_id: str) -> None:
    """
    Revoke an API key.
    
    Args:
        key_hash: Hash of the key to revoke
        user_id: User identifier (for verification)
    """
    table = dynamodb.Table(API_KEYS_TABLE)
    
    # Get key info
    response = table.get_item(Key={"apiKeyHash": key_hash})
    if "Item" not in response:
        raise ValueError("API key not found")
    
    key_data = response["Item"]
    
    # Verify ownership
    if key_data["userId"] != user_id:
        raise AuthorizationError("Not authorized to revoke this key")
    
    # Revoke key
    table.update_item(
        Key={"apiKeyHash": key_hash},
        UpdateExpression="SET enabled = :false",
        ExpressionAttributeValues={":false": False}
    )
    
    logger.info(f"Revoked API key for user {user_id}")


def list_api_keys(user_id: str) -> list[Dict[str, Any]]:
    """
    List all API keys for a user.
    
    Args:
        user_id: User identifier
        
    Returns:
        List of API key metadata (without actual keys)
    """
    table = dynamodb.Table(API_KEYS_TABLE)
    
    # Query by userId (requires GSI)
    response = table.query(
        IndexName="UserIdIndex",
        KeyConditionExpression="userId = :uid",
        ExpressionAttributeValues={":uid": user_id}
    )
    
    keys = []
    for item in response.get("Items", []):
        keys.append({
            "apiKeyHash": item["apiKeyHash"],
            "name": item["name"],
            "role": item.get("role", "viewer"),
            "createdAt": item["createdAt"],
            "expiresAt": item["expiresAt"],
            "lastUsed": item.get("lastUsed"),
            "enabled": item.get("enabled", False),
            "requestCount": item.get("requestCount", 0)
        })
    
    return keys


def check_api_key_rotation_needed() -> list[Dict[str, Any]]:
    """
    Check for API keys that need rotation (approaching expiration).
    Implements Requirement 82.6.
    
    Returns:
        List of keys that need rotation (< 7 days until expiration)
    """
    table = dynamodb.Table(API_KEYS_TABLE)
    
    # Scan for enabled keys
    response = table.scan(
        FilterExpression="enabled = :true",
        ExpressionAttributeValues={":true": True}
    )
    
    keys_needing_rotation = []
    now = datetime.now(UTC)
    warning_threshold = now + timedelta(days=7)
    
    for item in response.get("Items", []):
        expires_at = datetime.fromisoformat(item["expiresAt"].replace("Z", "+00:00"))
        
        if expires_at < warning_threshold:
            days_until_expiry = (expires_at - now).days
            keys_needing_rotation.append({
                "apiKeyHash": item["apiKeyHash"],
                "userId": item["userId"],
                "name": item["name"],
                "expiresAt": item["expiresAt"],
                "daysUntilExpiry": days_until_expiry
            })
    
    return keys_needing_rotation
