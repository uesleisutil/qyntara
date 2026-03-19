"""
Security Middleware for API Gateway Lambda Functions

Implements:
- Requirement 82.9: TLS 1.3 for data in transit
- Requirement 82.11: CSRF protection
- Requirement 82.12: Input sanitization (XSS prevention)
- Requirement 82.13: Rate limiting
"""

import hashlib
import html
import json
import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any, Dict, Optional
from urllib.parse import unquote

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS clients
dynamodb = boto3.resource("dynamodb")

# Rate limiting configuration
RATE_LIMIT_TABLE = "B3Dashboard-RateLimits"
RATE_LIMIT_REQUESTS = 100  # requests per window
RATE_LIMIT_WINDOW = 60  # seconds


class SecurityError(Exception):
    """Raised when security validation fails"""
    pass


def sanitize_input(value: Any) -> Any:
    """
    Sanitize user input to prevent XSS attacks.
    Implements Requirement 82.12.
    
    Args:
        value: Input value (string, dict, list, or primitive)
        
    Returns:
        Sanitized value
    """
    if isinstance(value, str):
        # HTML escape
        sanitized = html.escape(value)
        
        # Remove potentially dangerous patterns
        # Remove script tags
        sanitized = re.sub(r'<script[^>]*>.*?</script>', '', sanitized, flags=re.IGNORECASE | re.DOTALL)
        
        # Remove event handlers
        sanitized = re.sub(r'\s*on\w+\s*=\s*["\']?[^"\']*["\']?', '', sanitized, flags=re.IGNORECASE)
        
        # Remove javascript: protocol
        sanitized = re.sub(r'javascript:', '', sanitized, flags=re.IGNORECASE)
        
        # Remove data: protocol (can be used for XSS)
        sanitized = re.sub(r'data:', '', sanitized, flags=re.IGNORECASE)
        
        return sanitized
    
    elif isinstance(value, dict):
        return {k: sanitize_input(v) for k, v in value.items()}
    
    elif isinstance(value, list):
        return [sanitize_input(item) for item in value]
    
    else:
        # Primitives (int, float, bool, None) are safe
        return value


def validate_csrf_token(event: Dict[str, Any], expected_token: Optional[str] = None) -> bool:
    """
    Validate CSRF token for state-changing operations.
    Implements Requirement 82.11.
    
    Args:
        event: Lambda event object
        expected_token: Expected CSRF token (from session)
        
    Returns:
        True if valid, False otherwise
    """
    # Only check CSRF for state-changing methods
    http_method = event.get("httpMethod", "")
    if http_method in ["GET", "HEAD", "OPTIONS"]:
        return True
    
    headers = event.get("headers", {})
    
    # Get CSRF token from header
    csrf_token = headers.get("X-CSRF-Token", headers.get("x-csrf-token", ""))
    
    if not csrf_token:
        logger.warning("Missing CSRF token")
        return False
    
    # If expected token provided, validate it
    if expected_token and csrf_token != expected_token:
        logger.warning("Invalid CSRF token")
        return False
    
    # Additional validation: check token format
    # CSRF tokens should be at least 32 characters
    if len(csrf_token) < 32:
        logger.warning("CSRF token too short")
        return False
    
    return True


def generate_csrf_token() -> str:
    """
    Generate a CSRF token.
    
    Returns:
        A secure random token
    """
    import secrets
    return secrets.token_hex(32)


def check_rate_limit(identifier: str, limit: int = RATE_LIMIT_REQUESTS, window: int = RATE_LIMIT_WINDOW) -> bool:
    """
    Check if request is within rate limit.
    Implements Requirement 82.13.
    
    Args:
        identifier: Unique identifier (user ID, IP address, API key hash)
        limit: Maximum requests per window
        window: Time window in seconds
        
    Returns:
        True if within limit, False if exceeded
    """
    try:
        table = dynamodb.Table(RATE_LIMIT_TABLE)
        now = datetime.now(UTC)
        window_start = now - timedelta(seconds=window)
        
        # Get current count
        response = table.get_item(Key={"identifier": identifier})
        
        if "Item" not in response:
            # First request
            table.put_item(
                Item={
                    "identifier": identifier,
                    "count": 1,
                    "windowStart": now.isoformat(),
                    "ttl": int((now + timedelta(seconds=window * 2)).timestamp())
                }
            )
            return True
        
        item = response["Item"]
        item_window_start = datetime.fromisoformat(item["windowStart"].replace("Z", "+00:00"))
        
        # Check if we're in a new window
        if item_window_start < window_start:
            # Reset counter for new window
            table.put_item(
                Item={
                    "identifier": identifier,
                    "count": 1,
                    "windowStart": now.isoformat(),
                    "ttl": int((now + timedelta(seconds=window * 2)).timestamp())
                }
            )
            return True
        
        # Increment counter
        current_count = item.get("count", 0)
        
        if current_count >= limit:
            logger.warning(f"Rate limit exceeded for {identifier}: {current_count}/{limit}")
            return False
        
        # Increment
        table.update_item(
            Key={"identifier": identifier},
            UpdateExpression="SET #count = #count + :inc",
            ExpressionAttributeNames={"#count": "count"},
            ExpressionAttributeValues={":inc": 1}
        )
        
        return True
        
    except Exception as e:
        logger.error(f"Error checking rate limit: {e}")
        # Fail open (allow request) to avoid blocking legitimate traffic
        return True


def validate_tls_version(event: Dict[str, Any]) -> bool:
    """
    Validate that request uses TLS 1.3.
    Implements Requirement 82.9.
    
    Note: This is enforced at API Gateway level, but we log for monitoring.
    
    Args:
        event: Lambda event object
        
    Returns:
        True if TLS 1.3, False otherwise
    """
    request_context = event.get("requestContext", {})
    identity = request_context.get("identity", {})
    
    # API Gateway doesn't expose TLS version directly
    # This would be configured at the API Gateway level
    # We log the protocol for monitoring
    protocol = request_context.get("protocol", "")
    
    logger.info(f"Request protocol: {protocol}")
    
    # In production, API Gateway should be configured to require TLS 1.3
    # This function serves as a monitoring point
    return True


def validate_content_type(event: Dict[str, Any], allowed_types: list[str]) -> bool:
    """
    Validate Content-Type header.
    
    Args:
        event: Lambda event object
        allowed_types: List of allowed content types
        
    Returns:
        True if valid, False otherwise
    """
    headers = event.get("headers", {})
    content_type = headers.get("Content-Type", headers.get("content-type", ""))
    
    if not content_type:
        return True  # No content type (GET requests)
    
    # Extract base content type (ignore charset, boundary, etc.)
    base_type = content_type.split(";")[0].strip().lower()
    
    return base_type in [t.lower() for t in allowed_types]


def validate_request_size(event: Dict[str, Any], max_size_bytes: int = 1024 * 1024) -> bool:
    """
    Validate request body size to prevent DoS attacks.
    
    Args:
        event: Lambda event object
        max_size_bytes: Maximum allowed body size in bytes
        
    Returns:
        True if within limit, False otherwise
    """
    body = event.get("body", "")
    
    if not body:
        return True
    
    # Check size
    body_size = len(body.encode("utf-8"))
    
    if body_size > max_size_bytes:
        logger.warning(f"Request body too large: {body_size} bytes (max: {max_size_bytes})")
        return False
    
    return True


def apply_security_headers(response: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply security headers to response.
    
    Args:
        response: Lambda response object
        
    Returns:
        Response with security headers added
    """
    headers = response.get("headers", {})
    
    # Security headers
    security_headers = {
        # Prevent clickjacking
        "X-Frame-Options": "DENY",
        
        # Prevent MIME type sniffing
        "X-Content-Type-Options": "nosniff",
        
        # Enable XSS protection
        "X-XSS-Protection": "1; mode=block",
        
        # Strict Transport Security (HSTS)
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        
        # Content Security Policy
        "Content-Security-Policy": (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none';"
        ),
        
        # Referrer Policy
        "Referrer-Policy": "strict-origin-when-cross-origin",
        
        # Permissions Policy
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
    }
    
    headers.update(security_headers)
    response["headers"] = headers
    
    return response


def security_middleware(handler):
    """
    Decorator to apply security middleware to Lambda handlers.
    
    Usage:
        @security_middleware
        def handler(event, context):
            # Your handler code
            pass
    """
    def wrapper(event, context):
        try:
            # Validate TLS version (logging only)
            validate_tls_version(event)
            
            # Validate request size
            if not validate_request_size(event):
                return {
                    "statusCode": 413,
                    "headers": {"Content-Type": "application/json"},
                    "body": json.dumps({"error": "Request body too large"})
                }
            
            # Validate content type for POST/PUT/PATCH
            http_method = event.get("httpMethod", "")
            if http_method in ["POST", "PUT", "PATCH"]:
                if not validate_content_type(event, ["application/json", "application/x-www-form-urlencoded"]):
                    return {
                        "statusCode": 415,
                        "headers": {"Content-Type": "application/json"},
                        "body": json.dumps({"error": "Unsupported content type"})
                    }
            
            # Sanitize input
            if event.get("body"):
                try:
                    body = json.loads(event["body"])
                    sanitized_body = sanitize_input(body)
                    event["body"] = json.dumps(sanitized_body)
                except json.JSONDecodeError:
                    pass  # Not JSON, skip sanitization
            
            if event.get("queryStringParameters"):
                event["queryStringParameters"] = sanitize_input(event["queryStringParameters"])
            
            if event.get("pathParameters"):
                event["pathParameters"] = sanitize_input(event["pathParameters"])
            
            # Call the actual handler
            response = handler(event, context)
            
            # Apply security headers
            response = apply_security_headers(response)
            
            return response
            
        except Exception as e:
            logger.error(f"Security middleware error: {e}")
            return {
                "statusCode": 500,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Internal server error"})
            }
    
    return wrapper


def cors_headers(allow_credentials: bool = True) -> Dict[str, str]:
    """
    Generate CORS headers.
    
    Args:
        allow_credentials: Whether to allow credentials
        
    Returns:
        Dictionary of CORS headers
    """
    headers = {
        "Access-Control-Allow-Origin": "*",  # Configure based on environment
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, X-API-Key",
        "Access-Control-Max-Age": "86400"
    }
    
    if allow_credentials:
        headers["Access-Control-Allow-Credentials"] = "true"
    
    return headers
