"""
REST API Lambda for external integrations.

Implements:
- Requirement 65.1-65.14: REST API for programmatic data access
- Requirement 82.5: API key authentication
- API endpoints for recommendations, performance, validation, costs, data-quality, drift
- Rate limiting (1000 requests/hour per API key)
- CORS support
- JSON responses with proper HTTP status codes
"""

import hashlib
import json
import logging
import os
import time
from datetime import UTC, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.exceptions import ClientError

# Initialize AWS clients
s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

# Environment variables
BUCKET = os.environ.get("BUCKET", "")
API_KEYS_TABLE = os.environ.get("API_KEYS_TABLE", "")
RATE_LIMIT_TABLE = os.environ.get("RATE_LIMIT_TABLE", "")

# Rate limiting configuration
RATE_LIMIT_REQUESTS = 1000  # requests per hour
RATE_LIMIT_WINDOW = 3600  # 1 hour in seconds

# Logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def cors_headers() -> Dict[str, str]:
    """Return CORS headers for API responses."""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Api-Key,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
            },
            "metadata": {
                "timestamp": datetime.now(UTC).isoformat()
            }
        })
    }


def success_response(data: Any, cached: bool = False) -> Dict:
    """Create standardized success response."""
    return {
        "statusCode": 200,
        "headers": cors_headers(),
        "body": json.dumps({
            "data": data,
            "metadata": {
                "timestamp": datetime.now(UTC).isoformat(),
                "version": "1.0",
                "cached": cached
            }
        })
    }


def hash_api_key(api_key: str) -> str:
    """Hash API key for secure storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()


def validate_api_key(api_key: str) -> Tuple[bool, Optional[str]]:
    """
    Validate API key and return (is_valid, user_id).
    
    Args:
        api_key: The API key to validate
    
    Returns:
        Tuple of (is_valid, user_id)
    """
    if not api_key or not API_KEYS_TABLE:
        return False, None
    
    try:
        table = dynamodb.Table(API_KEYS_TABLE)
        hashed_key = hash_api_key(api_key)
        
        response = table.get_item(Key={"apiKeyHash": hashed_key})
        
        if "Item" not in response:
            return False, None
        
        item = response["Item"]
        
        # Check if key is enabled
        if not item.get("enabled", True):
            return False, None
        
        # Check if key is expired
        expires_at = item.get("expiresAt")
        if expires_at and datetime.fromisoformat(expires_at) < datetime.now(UTC):
            return False, None
        
        # Update last used timestamp
        table.update_item(
            Key={"apiKeyHash": hashed_key},
            UpdateExpression="SET lastUsed = :timestamp",
            ExpressionAttributeValues={":timestamp": datetime.now(UTC).isoformat()}
        )
        
        return True, item.get("userId")
    
    except Exception as e:
        logger.error(f"Error validating API key: {e}")
        return False, None


def check_rate_limit(user_id: str) -> Tuple[bool, int]:
    """
    Check if user has exceeded rate limit.
    
    Args:
        user_id: The user ID to check
    
    Returns:
        Tuple of (is_allowed, remaining_requests)
    """
    if not RATE_LIMIT_TABLE:
        return True, RATE_LIMIT_REQUESTS
    
    try:
        table = dynamodb.Table(RATE_LIMIT_TABLE)
        current_time = int(time.time())
        window_start = current_time - RATE_LIMIT_WINDOW
        
        # Get current rate limit data
        response = table.get_item(Key={"userId": user_id})
        
        if "Item" not in response:
            # First request, create entry
            table.put_item(Item={
                "userId": user_id,
                "requests": [current_time],
                "ttl": current_time + RATE_LIMIT_WINDOW
            })
            return True, RATE_LIMIT_REQUESTS - 1
        
        item = response["Item"]
        requests = item.get("requests", [])
        
        # Filter requests within current window
        recent_requests = [r for r in requests if r > window_start]
        
        # Check if limit exceeded
        if len(recent_requests) >= RATE_LIMIT_REQUESTS:
            return False, 0
        
        # Add current request
        recent_requests.append(current_time)
        
        # Update DynamoDB
        table.put_item(Item={
            "userId": user_id,
            "requests": recent_requests,
            "ttl": current_time + RATE_LIMIT_WINDOW
        })
        
        remaining = RATE_LIMIT_REQUESTS - len(recent_requests)
        return True, remaining
    
    except Exception as e:
        logger.error(f"Error checking rate limit: {e}")
        # Allow request on error to avoid blocking legitimate users
        return True, RATE_LIMIT_REQUESTS


def load_latest_from_s3(prefix: str, days: int = 7) -> Optional[Dict]:
    """Load the most recent file from an S3 prefix."""
    try:
        for i in range(days):
            date = (datetime.now(UTC).date() - timedelta(days=i)).isoformat()
            full_prefix = f"{prefix}{date}/"
            
            response = s3.list_objects_v2(Bucket=BUCKET, Prefix=full_prefix)
            
            if "Contents" not in response:
                continue
            
            # Get latest file
            latest_file = sorted(response["Contents"], key=lambda x: x["Key"])[-1]
            key = latest_file["Key"]
            
            # Load data
            obj = s3.get_object(Bucket=BUCKET, Key=key)
            data = json.loads(obj["Body"].read().decode("utf-8"))
            
            return data
        
        return None
    
    except Exception as e:
        logger.error(f"Error loading from S3 prefix {prefix}: {e}")
        return None


def load_time_series_from_s3(prefix: str, days: int = 30) -> List[Dict]:
    """Load time series data from S3 prefix."""
    data_list = []
    
    try:
        for i in range(days):
            date = (datetime.now(UTC).date() - timedelta(days=i)).isoformat()
            full_prefix = f"{prefix}{date}/"
            
            try:
                response = s3.list_objects_v2(Bucket=BUCKET, Prefix=full_prefix)
                
                if "Contents" not in response:
                    continue
                
                latest_file = sorted(response["Contents"], key=lambda x: x["Key"])[-1]
                key = latest_file["Key"]
                
                obj = s3.get_object(Bucket=BUCKET, Key=key)
                data = json.loads(obj["Body"].read().decode("utf-8"))
                data_list.append(data)
            
            except Exception:
                continue
        
        # Sort by date
        data_list.sort(key=lambda x: x.get("date", x.get("timestamp", "")))
        
    except Exception as e:
        logger.error(f"Error loading time series from {prefix}: {e}")
    
    return data_list


def get_recommendations(query_params: Dict[str, str]) -> Dict:
    """
    GET /api/recommendations
    
    Returns recommendation data with optional filtering.
    
    Query parameters:
    - date: Filter by specific date (YYYY-MM-DD)
    - sector: Filter by sector
    - min_score: Minimum score threshold
    - limit: Maximum number of results (default: 100)
    """
    try:
        # Parse query parameters
        date_filter = query_params.get("date")
        sector_filter = query_params.get("sector")
        min_score = float(query_params.get("min_score", 0))
        limit = int(query_params.get("limit", 100))
        
        # Load data
        if date_filter:
            # Load specific date
            prefix = f"recommendations/dt={date_filter}/"
            response = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix)
            
            if "Contents" not in response:
                return error_response(404, "NOT_FOUND", f"No recommendations found for date {date_filter}")
            
            latest_file = sorted(response["Contents"], key=lambda x: x["Key"])[-1]
            obj = s3.get_object(Bucket=BUCKET, Key=latest_file["Key"])
            data = json.loads(obj["Body"].read().decode("utf-8"))
        else:
            # Load latest
            data = load_latest_from_s3("recommendations/dt=", days=7)
            
            if not data:
                return error_response(404, "NOT_FOUND", "No recommendations found")
        
        # Extract recommendations
        items = data.get("items", data.get("recommendations", []))
        
        # Apply filters
        filtered_items = items
        
        if sector_filter:
            filtered_items = [item for item in filtered_items if item.get("sector") == sector_filter]
        
        if min_score > 0:
            filtered_items = [item for item in filtered_items if item.get("score", 0) >= min_score]
        
        # Apply limit
        filtered_items = filtered_items[:limit]
        
        # Build response
        response_data = {
            "timestamp": data.get("timestamp"),
            "date": data.get("dt", data.get("date")),
            "recommendations": filtered_items,
            "total_count": len(filtered_items),
            "filters_applied": {
                "date": date_filter,
                "sector": sector_filter,
                "min_score": min_score if min_score > 0 else None
            }
        }
        
        return success_response(response_data)
    
    except Exception as e:
        logger.error(f"Error getting recommendations: {e}")
        return error_response(500, "INTERNAL_ERROR", "An error occurred while fetching recommendations")


def get_performance(query_params: Dict[str, str]) -> Dict:
    """
    GET /api/performance
    
    Returns model performance metrics.
    
    Query parameters:
    - days: Number of days of history (default: 30)
    - model: Filter by specific model
    """
    try:
        days = int(query_params.get("days", 30))
        model_filter = query_params.get("model")
        
        # Load performance data
        data = load_latest_from_s3("monitoring/model_performance/dt=", days=7)
        
        if not data:
            return error_response(404, "NOT_FOUND", "No performance data found")
        
        # Apply model filter if specified
        if model_filter and "models" in data:
            data["models"] = [m for m in data["models"] if m.get("model_id") == model_filter]
        
        return success_response(data)
    
    except Exception as e:
        logger.error(f"Error getting performance: {e}")
        return error_response(500, "INTERNAL_ERROR", "An error occurred while fetching performance data")


def get_validation(query_params: Dict[str, str]) -> Dict:
    """
    GET /api/validation
    
    Returns validation results (predicted vs actual).
    
    Query parameters:
    - days: Number of days of history (default: 30)
    """
    try:
        days = int(query_params.get("days", 30))
        
        # Load validation data
        history_data = load_time_series_from_s3("recommendations/dt=", days=days + 20)
        
        if not history_data:
            return error_response(404, "NOT_FOUND", "No validation data found")
        
        # Calculate validation metrics (simplified version)
        validation_results = []
        
        for i, data in enumerate(history_data[:-20]):  # Exclude last 20 days (no actuals yet)
            date = data.get("dt", data.get("date"))
            items = data.get("items", data.get("recommendations", []))
            
            # Get actuals from 20 days later
            if i + 20 < len(history_data):
                future_data = history_data[i + 20]
                future_items = future_data.get("items", future_data.get("recommendations", []))
                
                for item in items[:10]:  # Limit to top 10 per date
                    ticker = item.get("ticker")
                    predicted = item.get("exp_return_20")
                    
                    # Find actual (simplified - would use real price data in production)
                    future_item = next((f for f in future_items if f.get("ticker") == ticker), None)
                    actual = future_item.get("exp_return_20") if future_item else None
                    
                    if predicted is not None and actual is not None:
                        validation_results.append({
                            "ticker": ticker,
                            "date": date,
                            "predicted": predicted,
                            "actual": actual,
                            "error": abs(predicted - actual)
                        })
        
        # Calculate summary metrics
        if validation_results:
            errors = [v["error"] for v in validation_results]
            mae = sum(errors) / len(errors)
            rmse = (sum(e ** 2 for e in errors) / len(errors)) ** 0.5
        else:
            mae = 0
            rmse = 0
        
        response_data = {
            "summary": {
                "total_validations": len(validation_results),
                "mean_absolute_error": mae,
                "rmse": rmse
            },
            "validations": validation_results[:100]  # Limit to 100 results
        }
        
        return success_response(response_data)
    
    except Exception as e:
        logger.error(f"Error getting validation: {e}")
        return error_response(500, "INTERNAL_ERROR", "An error occurred while fetching validation data")


def get_costs(query_params: Dict[str, str]) -> Dict:
    """
    GET /api/costs
    
    Returns AWS cost data.
    
    Query parameters:
    - days: Number of days of history (default: 30)
    """
    try:
        days = int(query_params.get("days", 30))
        
        # Load cost data
        data = load_latest_from_s3("monitoring/costs/dt=", days=7)
        
        if not data:
            return error_response(404, "NOT_FOUND", "No cost data found")
        
        return success_response(data)
    
    except Exception as e:
        logger.error(f"Error getting costs: {e}")
        return error_response(500, "INTERNAL_ERROR", "An error occurred while fetching cost data")


def get_data_quality(query_params: Dict[str, str]) -> Dict:
    """
    GET /api/data-quality
    
    Returns data quality metrics.
    
    Query parameters:
    - days: Number of days of history (default: 30)
    """
    try:
        days = int(query_params.get("days", 30))
        
        # Load data quality metrics
        data = load_latest_from_s3("monitoring/data_quality/dt=", days=7)
        
        if not data:
            return error_response(404, "NOT_FOUND", "No data quality metrics found")
        
        return success_response(data)
    
    except Exception as e:
        logger.error(f"Error getting data quality: {e}")
        return error_response(500, "INTERNAL_ERROR", "An error occurred while fetching data quality metrics")


def get_drift(query_params: Dict[str, str]) -> Dict:
    """
    GET /api/drift
    
    Returns drift detection results.
    
    Query parameters:
    - days: Number of days of history (default: 30)
    - type: Filter by drift type (data, concept, performance)
    """
    try:
        days = int(query_params.get("days", 30))
        drift_type = query_params.get("type")
        
        # Load drift data
        data = load_latest_from_s3("monitoring/drift/dt=", days=7)
        
        if not data:
            return error_response(404, "NOT_FOUND", "No drift data found")
        
        # Apply type filter if specified
        if drift_type:
            filtered_data = {}
            if drift_type == "data" and "data_drift" in data:
                filtered_data["data_drift"] = data["data_drift"]
            elif drift_type == "concept" and "concept_drift" in data:
                filtered_data["concept_drift"] = data["concept_drift"]
            elif drift_type == "performance" and "performance_degradation" in data:
                filtered_data["performance_degradation"] = data["performance_degradation"]
            else:
                filtered_data = data
            
            data = filtered_data
        
        return success_response(data)
    
    except Exception as e:
        logger.error(f"Error getting drift: {e}")
        return error_response(500, "INTERNAL_ERROR", "An error occurred while fetching drift data")


def lambda_handler(event, context):
    """
    Main Lambda handler for REST API.
    
    Handles authentication, rate limiting, and routing to appropriate endpoints.
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    # Handle OPTIONS requests for CORS
    if event.get("httpMethod") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": cors_headers(),
            "body": ""
        }
    
    # Extract API key from headers
    headers = event.get("headers", {})
    api_key = headers.get("X-Api-Key") or headers.get("x-api-key")
    
    if not api_key:
        return error_response(401, "AUTHENTICATION_ERROR", "API key is required. Provide X-Api-Key header.")
    
    # Validate API key
    is_valid, user_id = validate_api_key(api_key)
    
    if not is_valid:
        return error_response(401, "AUTHENTICATION_ERROR", "Invalid or expired API key")
    
    # Check rate limit
    is_allowed, remaining = check_rate_limit(user_id)
    
    if not is_allowed:
        return error_response(429, "RATE_LIMIT_EXCEEDED", f"Rate limit exceeded. Limit: {RATE_LIMIT_REQUESTS} requests per hour")
    
    # Add rate limit headers
    rate_limit_headers = cors_headers()
    rate_limit_headers.update({
        "X-RateLimit-Limit": str(RATE_LIMIT_REQUESTS),
        "X-RateLimit-Remaining": str(remaining),
        "X-RateLimit-Reset": str(int(time.time()) + RATE_LIMIT_WINDOW)
    })
    
    # Extract path and query parameters
    path = event.get("path", "")
    query_params = event.get("queryStringParameters") or {}
    
    # Route to appropriate endpoint
    try:
        if path.endswith("/recommendations"):
            response = get_recommendations(query_params)
        elif path.endswith("/performance"):
            response = get_performance(query_params)
        elif path.endswith("/validation"):
            response = get_validation(query_params)
        elif path.endswith("/costs"):
            response = get_costs(query_params)
        elif path.endswith("/data-quality"):
            response = get_data_quality(query_params)
        elif path.endswith("/drift"):
            response = get_drift(query_params)
        else:
            response = error_response(404, "NOT_FOUND", f"Endpoint not found: {path}")
        
        # Add rate limit headers to response
        if "headers" in response:
            response["headers"].update(rate_limit_headers)
        
        return response
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return error_response(500, "INTERNAL_ERROR", "An unexpected error occurred")
