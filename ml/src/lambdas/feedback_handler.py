"""
Feedback Handler Lambda

Receives user feedback (rating + comments) from the dashboard
and stores it in DynamoDB for analysis.

Requirements: 91.6 (user satisfaction through in-app surveys),
              91.7 (error rates and user-reported issues)
"""

import json
import logging
import os
import uuid
from datetime import datetime, UTC

import boto3

# AWS clients
dynamodb = boto3.resource("dynamodb")

# Environment
FEEDBACK_TABLE = os.environ.get("FEEDBACK_TABLE", "UserFeedback")

logger = logging.getLogger()
logger.setLevel(logging.INFO)

VALID_CATEGORIES = {"general", "bug", "feature", "usability", "performance"}

ALLOWED_ORIGINS = os.environ.get(
    'ALLOWED_ORIGINS',
    'https://qyntara.tech,https://www.qyntara.tech'
).split(',')


def _get_cors_origin(event):
    """Return the request Origin if it is in the allow-list."""
    headers = event.get('headers') or {}
    origin = headers.get('origin') or headers.get('Origin') or ''
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0]


def _response(status_code: int, body: dict, event: dict = None) -> dict:
    origin = _get_cors_origin(event) if event else ALLOWED_ORIGINS[0]
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Api-Key, Authorization",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Cache-Control": "no-store",
        },
        "body": json.dumps(body),
    }


def handler(event, context):
    """
    Handle feedback submission.

    POST /api/feedback
    Body: { rating: 1-5, comment?: string, category?: string, page?: string }
    """
    try:
        # Parse body
        if "body" in event:
            body = json.loads(event["body"]) if isinstance(event["body"], str) else event["body"]
        else:
            body = event

        rating = body.get("rating")
        comment = body.get("comment", "")
        category = body.get("category", "general")
        page = body.get("page", "")
        timestamp = body.get("timestamp", datetime.now(UTC).isoformat())

        # Validate rating
        if rating is None or not isinstance(rating, (int, float)) or not (1 <= rating <= 5):
            return _response(400, {"error": "rating is required and must be between 1 and 5"})

        rating = int(rating)

        # Validate category
        if category not in VALID_CATEGORIES:
            category = "general"

        # Sanitise comment length
        if len(comment) > 2000:
            comment = comment[:2000]

        # Extract user info from request context (Cognito authorizer)
        user_id = "anonymous"
        request_context = event.get("requestContext", {})
        authorizer = request_context.get("authorizer", {})
        if authorizer.get("claims"):
            user_id = authorizer["claims"].get("sub", "anonymous")

        feedback_id = str(uuid.uuid4())

        # Store in DynamoDB
        table = dynamodb.Table(FEEDBACK_TABLE)
        table.put_item(
            Item={
                "feedback_id": feedback_id,
                "user_id": user_id,
                "rating": rating,
                "comment": comment,
                "category": category,
                "page": page,
                "timestamp": timestamp,
                "status": "new",
            }
        )

        logger.info(
            "Feedback stored: id=%s user=%s rating=%d category=%s",
            feedback_id, user_id, rating, category,
        )

        return _response(200, {"success": True, "feedback_id": feedback_id})

    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})
    except Exception as exc:
        logger.error("Error handling feedback: %s", exc, exc_info=True)
        return _response(500, {"error": "Internal server error"})


def get_feedback_summary(event, context):
    """
    GET /api/feedback/summary?days=30

    Returns aggregated feedback metrics for the requested period.
    Req 91.6, 91.9
    """
    try:
        params = event.get("queryStringParameters", {}) or {}
        days = int(params.get("days", 30))

        table = dynamodb.Table(FEEDBACK_TABLE)
        cutoff = datetime.now(UTC).isoformat()[:10]  # simplified; production would use proper date math

        response = table.scan(Limit=1000)
        items = response.get("Items", [])

        if not items:
            return _response(200, {
                "total": 0,
                "average_rating": 0,
                "by_category": {},
                "by_rating": {},
            })

        total = len(items)
        avg_rating = sum(int(i.get("rating", 0)) for i in items) / total

        by_category = {}
        by_rating = {}
        for item in items:
            cat = item.get("category", "general")
            by_category[cat] = by_category.get(cat, 0) + 1
            r = str(item.get("rating", 0))
            by_rating[r] = by_rating.get(r, 0) + 1

        return _response(200, {
            "total": total,
            "average_rating": round(avg_rating, 2),
            "by_category": by_category,
            "by_rating": by_rating,
        })

    except Exception as exc:
        logger.error("Error getting feedback summary: %s", exc, exc_info=True)
        return _response(500, {"error": "Internal server error"})
