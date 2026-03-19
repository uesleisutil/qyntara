"""
Lambda Function Optimizer

Implements Lambda optimizations for Task 28.3:
- Response caching
- Request validation
- Comprehensive error handling
- Logging for debugging
- Connection pooling
- Parallel processing

Requirements:
- 80.10: Implement response caching in Lambda
- 80.11: Implement request validation
- 80.12: Implement comprehensive error handling
- 80.13: Implement logging for debugging
- 80.14: Optimize memory allocation
"""

import json
import logging
import time
import traceback
from functools import wraps
from typing import Any, Callable, Dict, Optional
import os

from cache_helper import cache_response, get_cache_stats, CACHE_TTL_MEDIUM

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Connection pool for boto3 clients (reuse across invocations)
_boto3_clients = {}


def get_boto3_client(service_name: str):
    """
    Get or create a boto3 client with connection pooling
    
    Implements: Connection pooling for performance
    
    Args:
        service_name: AWS service name (e.g., 's3', 'dynamodb')
    
    Returns:
        Boto3 client instance
    """
    if service_name not in _boto3_clients:
        import boto3
        _boto3_clients[service_name] = boto3.client(service_name)
    
    return _boto3_clients[service_name]


def validate_request(event: Dict, required_params: Optional[list] = None) -> Dict:
    """
    Validate Lambda request event
    
    Implements: 80.11 - Request validation
    
    Args:
        event: Lambda event
        required_params: List of required query parameters
    
    Returns:
        Validated parameters dictionary
    
    Raises:
        ValueError: If validation fails
    """
    # Extract query parameters
    params = event.get("queryStringParameters") or {}
    
    # Validate required parameters
    if required_params:
        missing = [p for p in required_params if p not in params]
        if missing:
            raise ValueError(f"Missing required parameters: {', '.join(missing)}")
    
    # Validate date format if present
    if "date" in params:
        try:
            from datetime import datetime
            datetime.fromisoformat(params["date"])
        except ValueError:
            raise ValueError(f"Invalid date format: {params['date']}. Expected ISO format (YYYY-MM-DD)")
    
    # Validate days parameter if present
    if "days" in params:
        try:
            days = int(params["days"])
            if days < 1 or days > 365:
                raise ValueError("days parameter must be between 1 and 365")
        except ValueError:
            raise ValueError(f"Invalid days parameter: {params['days']}")
    
    return params


def create_response(
    status_code: int,
    body: Any,
    compress: bool = True,
    cache_control: Optional[str] = None,
) -> Dict:
    """
    Create standardized API response
    
    Implements: Response formatting with compression
    
    Args:
        status_code: HTTP status code
        body: Response body (will be JSON serialized)
        compress: Whether to gzip compress the response
        cache_control: Cache-Control header value
    
    Returns:
        API Gateway response dictionary
    """
    import gzip
    
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Api-Key,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    }
    
    if cache_control:
        headers["Cache-Control"] = cache_control
    
    # Serialize body
    body_str = json.dumps(body, default=str)
    
    # Compress if enabled and body is large enough
    if compress and len(body_str) > 1024:  # Only compress if > 1KB
        headers["Content-Encoding"] = "gzip"
        body_bytes = gzip.compress(body_str.encode("utf-8"))
        return {
            "statusCode": status_code,
            "headers": headers,
            "body": body_bytes.decode("latin1"),  # API Gateway expects string
            "isBase64Encoded": True,
        }
    
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": body_str,
    }


def create_error_response(
    status_code: int,
    error_message: str,
    error_code: Optional[str] = None,
    details: Optional[Dict] = None,
) -> Dict:
    """
    Create standardized error response
    
    Implements: 80.12 - Comprehensive error handling
    
    Args:
        status_code: HTTP status code
        error_message: Human-readable error message
        error_code: Machine-readable error code
        details: Additional error details
    
    Returns:
        API Gateway error response
    """
    error_body = {
        "error": {
            "message": error_message,
            "code": error_code or f"ERROR_{status_code}",
        }
    }
    
    if details:
        error_body["error"]["details"] = details
    
    return create_response(status_code, error_body, compress=False)


def lambda_handler_wrapper(
    cache_ttl: Optional[int] = None,
    required_params: Optional[list] = None,
    log_request: bool = True,
    log_response: bool = False,
):
    """
    Decorator to wrap Lambda handlers with optimizations
    
    Implements:
    - 80.10: Response caching
    - 80.11: Request validation
    - 80.12: Error handling
    - 80.13: Logging
    
    Args:
        cache_ttl: Cache TTL in seconds (None = no caching)
        required_params: List of required query parameters
        log_request: Whether to log request details
        log_response: Whether to log response details
    
    Usage:
        @lambda_handler_wrapper(cache_ttl=300, required_params=["date"])
        def handler(event, context):
            # Your handler code
            return data
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(event, context):
            start_time = time.time()
            request_id = context.request_id if context else "local"
            
            try:
                # Log request
                if log_request:
                    logger.info(f"Request {request_id}: {event.get('path', 'unknown')} "
                               f"from {event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')}")
                
                # Handle OPTIONS request (CORS preflight)
                if event.get("httpMethod") == "OPTIONS":
                    return create_response(200, {"message": "OK"})
                
                # Validate request
                try:
                    params = validate_request(event, required_params)
                except ValueError as e:
                    logger.warning(f"Request validation failed: {e}")
                    return create_error_response(400, str(e), "VALIDATION_ERROR")
                
                # Check cache if enabled
                if cache_ttl:
                    cache_key = f"lambda:{func.__name__}:{json.dumps(params, sort_keys=True)}"
                    from cache_helper import get_cached, set_cached
                    
                    cached_result = get_cached(cache_key)
                    if cached_result is not None:
                        logger.info(f"Cache HIT for {func.__name__}")
                        elapsed = (time.time() - start_time) * 1000
                        
                        # Add cache metadata
                        if isinstance(cached_result, dict):
                            cached_result["_cache"] = {
                                "hit": True,
                                "elapsed_ms": round(elapsed, 2),
                            }
                        
                        return create_response(
                            200,
                            cached_result,
                            cache_control=f"max-age={cache_ttl}",
                        )
                    
                    logger.info(f"Cache MISS for {func.__name__}")
                
                # Call the actual handler
                result = func(event, context)
                
                # Handle different return types
                if isinstance(result, dict) and "statusCode" in result:
                    # Already a formatted response
                    response = result
                else:
                    # Wrap in standard response
                    response = create_response(
                        200,
                        result,
                        cache_control=f"max-age={cache_ttl}" if cache_ttl else None,
                    )
                
                # Cache the result if enabled
                if cache_ttl and response.get("statusCode") == 200:
                    cache_key = f"lambda:{func.__name__}:{json.dumps(params, sort_keys=True)}"
                    from cache_helper import set_cached
                    
                    # Extract body for caching
                    body = json.loads(response["body"]) if isinstance(response.get("body"), str) else result
                    set_cached(cache_key, body, cache_ttl)
                
                # Log response
                elapsed = (time.time() - start_time) * 1000
                logger.info(f"Request {request_id} completed in {elapsed:.2f}ms "
                           f"with status {response.get('statusCode', 'unknown')}")
                
                if log_response:
                    logger.debug(f"Response: {response}")
                
                # Track performance metric
                track_performance_metric(func.__name__, elapsed, response.get("statusCode", 500))
                
                return response
                
            except Exception as e:
                # Comprehensive error handling
                elapsed = (time.time() - start_time) * 1000
                error_trace = traceback.format_exc()
                
                logger.error(f"Request {request_id} failed after {elapsed:.2f}ms: {e}")
                logger.error(f"Traceback: {error_trace}")
                
                # Track error metric
                track_error_metric(func.__name__, type(e).__name__)
                
                # Determine error type and status code
                if isinstance(e, ValueError):
                    status_code = 400
                    error_code = "VALIDATION_ERROR"
                elif isinstance(e, PermissionError):
                    status_code = 403
                    error_code = "PERMISSION_DENIED"
                elif isinstance(e, FileNotFoundError):
                    status_code = 404
                    error_code = "NOT_FOUND"
                else:
                    status_code = 500
                    error_code = "INTERNAL_ERROR"
                
                return create_error_response(
                    status_code,
                    str(e),
                    error_code,
                    details={"request_id": request_id} if status_code == 500 else None,
                )
        
        return wrapper
    return decorator


def track_performance_metric(function_name: str, duration_ms: float, status_code: int):
    """
    Track performance metrics to CloudWatch
    
    Implements: 80.13 - Logging for debugging
    
    Args:
        function_name: Name of the Lambda function
        duration_ms: Request duration in milliseconds
        status_code: HTTP status code
    """
    try:
        cloudwatch = get_boto3_client("cloudwatch")
        
        cloudwatch.put_metric_data(
            Namespace="B3Dashboard/Lambda",
            MetricData=[
                {
                    "MetricName": "Duration",
                    "Value": duration_ms,
                    "Unit": "Milliseconds",
                    "Dimensions": [
                        {"Name": "Function", "Value": function_name},
                    ],
                },
                {
                    "MetricName": "Requests",
                    "Value": 1,
                    "Unit": "Count",
                    "Dimensions": [
                        {"Name": "Function", "Value": function_name},
                        {"Name": "StatusCode", "Value": str(status_code)},
                    ],
                },
            ],
        )
    except Exception as e:
        logger.debug(f"Failed to track performance metric: {e}")


def track_error_metric(function_name: str, error_type: str):
    """
    Track error metrics to CloudWatch
    
    Args:
        function_name: Name of the Lambda function
        error_type: Type of error
    """
    try:
        cloudwatch = get_boto3_client("cloudwatch")
        
        cloudwatch.put_metric_data(
            Namespace="B3Dashboard/Lambda",
            MetricData=[
                {
                    "MetricName": "Errors",
                    "Value": 1,
                    "Unit": "Count",
                    "Dimensions": [
                        {"Name": "Function", "Value": function_name},
                        {"Name": "ErrorType", "Value": error_type},
                    ],
                },
            ],
        )
    except Exception as e:
        logger.debug(f"Failed to track error metric: {e}")


def parallel_s3_load(keys: list, bucket: str) -> list:
    """
    Load multiple S3 objects in parallel
    
    Implements: Parallel processing for performance
    
    Args:
        keys: List of S3 keys to load
        bucket: S3 bucket name
    
    Returns:
        List of loaded objects (None for failed loads)
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    s3_client = get_boto3_client("s3")
    results = [None] * len(keys)
    
    def load_object(index: int, key: str):
        try:
            obj = s3_client.get_object(Bucket=bucket, Key=key)
            data = json.loads(obj["Body"].read().decode("utf-8"))
            return index, data
        except Exception as e:
            logger.warning(f"Failed to load {key}: {e}")
            return index, None
    
    # Use thread pool for parallel loading
    max_workers = min(10, len(keys))  # Limit concurrent requests
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(load_object, i, key): i
            for i, key in enumerate(keys)
        }
        
        for future in as_completed(futures):
            index, data = future.result()
            results[index] = data
    
    return results


# Memory optimization recommendations based on function patterns
MEMORY_RECOMMENDATIONS = {
    "data_processing": 2048,  # Heavy data processing
    "api_gateway": 512,  # Simple API responses
    "s3_operations": 1024,  # S3 read/write operations
    "ml_inference": 3008,  # ML model inference
    "aggregation": 1536,  # Data aggregation
}


def get_memory_recommendation(function_type: str) -> int:
    """
    Get memory allocation recommendation for function type
    
    Implements: 80.14 - Optimize memory allocation
    
    Args:
        function_type: Type of function (see MEMORY_RECOMMENDATIONS)
    
    Returns:
        Recommended memory in MB
    """
    return MEMORY_RECOMMENDATIONS.get(function_type, 1024)
