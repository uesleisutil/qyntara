"""
Cache Helper Module for Lambda Functions

Implements caching layer using ElastiCache Redis for Lambda functions.

Requirements:
- 80.10: Implement response caching in Lambda
- Infrastructure enhancements: Caching layer
- Cache frequently accessed data (5-60 minutes)
- Monitor cache hit rates
"""

import json
import os
import logging
from typing import Any, Optional, Callable
from functools import wraps
import hashlib
import time

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Redis client (lazy loaded)
_redis_client = None


def get_redis_client():
    """
    Get Redis client instance (lazy initialization)
    
    Returns:
        Redis client or None if not configured
    """
    global _redis_client
    
    if _redis_client is not None:
        return _redis_client
    
    cache_endpoint = os.environ.get("CACHE_ENDPOINT")
    cache_port = os.environ.get("CACHE_PORT", "6379")
    
    if not cache_endpoint:
        logger.warning("CACHE_ENDPOINT not configured, caching disabled")
        return None
    
    try:
        import redis
        _redis_client = redis.Redis(
            host=cache_endpoint,
            port=int(cache_port),
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        # Test connection
        _redis_client.ping()
        logger.info(f"Connected to Redis at {cache_endpoint}:{cache_port}")
        return _redis_client
    except ImportError:
        logger.warning("redis-py not installed, caching disabled")
        return None
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        return None


def generate_cache_key(prefix: str, *args, **kwargs) -> str:
    """
    Generate a cache key from function arguments
    
    Args:
        prefix: Cache key prefix (e.g., function name)
        *args: Positional arguments
        **kwargs: Keyword arguments
    
    Returns:
        Cache key string
    """
    # Create a deterministic string from arguments
    key_parts = [str(arg) for arg in args]
    key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
    key_string = ":".join(key_parts)
    
    # Hash if too long
    if len(key_string) > 100:
        key_hash = hashlib.md5(key_string.encode()).hexdigest()
        return f"{prefix}:{key_hash}"
    
    return f"{prefix}:{key_string}" if key_string else prefix


def cache_response(ttl: int = 300, key_prefix: Optional[str] = None):
    """
    Decorator to cache function responses in Redis
    
    Args:
        ttl: Time to live in seconds (default: 5 minutes)
        key_prefix: Cache key prefix (default: function name)
    
    Usage:
        @cache_response(ttl=600)
        def get_recommendations(date: str):
            # Expensive operation
            return data
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            redis_client = get_redis_client()
            
            # If Redis not available, call function directly
            if redis_client is None:
                logger.debug(f"Cache disabled, calling {func.__name__} directly")
                return func(*args, **kwargs)
            
            # Generate cache key
            prefix = key_prefix or f"lambda:{func.__name__}"
            cache_key = generate_cache_key(prefix, *args, **kwargs)
            
            try:
                # Try to get from cache
                start_time = time.time()
                cached_value = redis_client.get(cache_key)
                
                if cached_value is not None:
                    # Cache hit
                    elapsed = (time.time() - start_time) * 1000
                    logger.info(f"Cache HIT for {cache_key} ({elapsed:.2f}ms)")
                    
                    # Track cache hit metric
                    track_cache_metric("hit", func.__name__)
                    
                    return json.loads(cached_value)
                
                # Cache miss - call function
                logger.info(f"Cache MISS for {cache_key}")
                track_cache_metric("miss", func.__name__)
                
                result = func(*args, **kwargs)
                
                # Store in cache
                redis_client.setex(
                    cache_key,
                    ttl,
                    json.dumps(result, default=str)
                )
                
                return result
                
            except Exception as e:
                # On cache error, fall back to calling function
                logger.error(f"Cache error for {cache_key}: {e}")
                track_cache_metric("error", func.__name__)
                return func(*args, **kwargs)
        
        return wrapper
    return decorator


def invalidate_cache(pattern: str) -> int:
    """
    Invalidate cache entries matching a pattern
    
    Args:
        pattern: Redis key pattern (e.g., "lambda:get_recommendations:*")
    
    Returns:
        Number of keys deleted
    """
    redis_client = get_redis_client()
    
    if redis_client is None:
        logger.warning("Cache not available for invalidation")
        return 0
    
    try:
        keys = redis_client.keys(pattern)
        if keys:
            deleted = redis_client.delete(*keys)
            logger.info(f"Invalidated {deleted} cache entries matching {pattern}")
            return deleted
        return 0
    except Exception as e:
        logger.error(f"Failed to invalidate cache pattern {pattern}: {e}")
        return 0


def get_cached(key: str) -> Optional[Any]:
    """
    Get a value from cache
    
    Args:
        key: Cache key
    
    Returns:
        Cached value or None if not found
    """
    redis_client = get_redis_client()
    
    if redis_client is None:
        return None
    
    try:
        value = redis_client.get(key)
        if value:
            return json.loads(value)
        return None
    except Exception as e:
        logger.error(f"Failed to get cache key {key}: {e}")
        return None


def set_cached(key: str, value: Any, ttl: int = 300) -> bool:
    """
    Set a value in cache
    
    Args:
        key: Cache key
        value: Value to cache (must be JSON serializable)
        ttl: Time to live in seconds
    
    Returns:
        True if successful, False otherwise
    """
    redis_client = get_redis_client()
    
    if redis_client is None:
        return False
    
    try:
        redis_client.setex(key, ttl, json.dumps(value, default=str))
        return True
    except Exception as e:
        logger.error(f"Failed to set cache key {key}: {e}")
        return False


def track_cache_metric(metric_type: str, function_name: str):
    """
    Track cache metrics to CloudWatch
    
    Args:
        metric_type: "hit", "miss", or "error"
        function_name: Name of the function
    """
    try:
        import boto3
        
        cloudwatch = boto3.client("cloudwatch")
        cloudwatch.put_metric_data(
            Namespace="B3Dashboard/Cache",
            MetricData=[
                {
                    "MetricName": f"Cache{metric_type.capitalize()}",
                    "Value": 1,
                    "Unit": "Count",
                    "Dimensions": [
                        {
                            "Name": "Function",
                            "Value": function_name,
                        }
                    ],
                }
            ],
        )
    except Exception as e:
        logger.debug(f"Failed to track cache metric: {e}")


def get_cache_stats() -> dict:
    """
    Get cache statistics from Redis
    
    Returns:
        Dictionary with cache statistics
    """
    redis_client = get_redis_client()
    
    if redis_client is None:
        return {
            "available": False,
            "error": "Cache not configured",
        }
    
    try:
        info = redis_client.info("stats")
        return {
            "available": True,
            "keyspace_hits": info.get("keyspace_hits", 0),
            "keyspace_misses": info.get("keyspace_misses", 0),
            "hit_rate": (
                info.get("keyspace_hits", 0) /
                (info.get("keyspace_hits", 0) + info.get("keyspace_misses", 1))
                * 100
            ),
            "total_commands_processed": info.get("total_commands_processed", 0),
            "connected_clients": info.get("connected_clients", 0),
        }
    except Exception as e:
        logger.error(f"Failed to get cache stats: {e}")
        return {
            "available": False,
            "error": str(e),
        }


# Cache TTL constants (in seconds)
CACHE_TTL_SHORT = 60  # 1 minute
CACHE_TTL_MEDIUM = 300  # 5 minutes
CACHE_TTL_LONG = 3600  # 1 hour
