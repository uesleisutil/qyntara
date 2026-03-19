"""
Feedback Survey Lambda

Provides structured survey endpoints for collecting post-launch user feedback,
analyzing feature usage patterns, and generating iteration 2 planning data.

Leverages the existing feedback_handler.py for storage and extends it with
survey-specific functionality.

Requirements: 91.6, 91.10
"""

import json
import logging
import os
import uuid
from datetime import datetime, UTC, timedelta
from typing import Dict, List, Any, Optional

import boto3
from boto3.dynamodb.conditions import Key, Attr

# AWS clients
dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")
cloudwatch = boto3.client("cloudwatch")

# Environment
FEEDBACK_TABLE = os.environ.get("FEEDBACK_TABLE", "UserFeedback")
ANALYTICS_TABLE = os.environ.get("ANALYTICS_TABLE", "UserAnalytics")
BUCKET = os.environ.get("BUCKET", "")

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ─── Survey Templates ─────────────────────────────────────────────────────────

SURVEY_TEMPLATES = {
    "post_launch": {
        "id": "post_launch_v1",
        "title": "B3 Dashboard Post-Launch Survey",
        "description": "Help us improve the dashboard by sharing your experience.",
        "questions": [
            {
                "id": "overall_satisfaction",
                "type": "rating",
                "text": "How satisfied are you with the B3 Dashboard overall?",
                "scale": 5,
                "required": True,
            },
            {
                "id": "most_useful_feature",
                "type": "single_choice",
                "text": "Which feature do you find most useful?",
                "options": [
                    "Recommendations",
                    "Performance Monitoring",
                    "Validation",
                    "Cost Analysis",
                    "Data Quality",
                    "Drift Detection",
                    "Explainability",
                    "Backtesting",
                ],
                "required": True,
            },
            {
                "id": "ease_of_use",
                "type": "rating",
                "text": "How easy is the dashboard to use?",
                "scale": 5,
                "required": True,
            },
            {
                "id": "performance_rating",
                "type": "rating",
                "text": "How would you rate the dashboard performance (speed)?",
                "scale": 5,
                "required": True,
            },
            {
                "id": "missing_features",
                "type": "text",
                "text": "What features or improvements would you like to see?",
                "max_length": 1000,
                "required": False,
            },
            {
                "id": "recommendation_quality",
                "type": "rating",
                "text": "How useful are the stock recommendations?",
                "scale": 5,
                "required": True,
            },
            {
                "id": "would_recommend",
                "type": "single_choice",
                "text": "Would you recommend this dashboard to a colleague?",
                "options": ["Definitely", "Probably", "Not sure", "Probably not", "Definitely not"],
                "required": True,
            },
            {
                "id": "additional_comments",
                "type": "text",
                "text": "Any additional comments or suggestions?",
                "max_length": 2000,
                "required": False,
            },
        ],
    },
}


# ─── Handlers ─────────────────────────────────────────────────────────────────


def get_survey_handler(event, context):
    """
    GET /api/surveys/{surveyId}

    Returns a survey template for the user to fill out.
    """
    try:
        params = event.get("pathParameters", {}) or {}
        survey_id = params.get("surveyId", "post_launch")

        template = SURVEY_TEMPLATES.get(survey_id)
        if not template:
            return _response(404, {"error": f"Survey '{survey_id}' not found"})

        return _response(200, {"survey": template})

    except Exception as e:
        logger.error("Error getting survey: %s", e, exc_info=True)
        return _response(500, {"error": "Internal server error"})


def submit_survey_handler(event, context):
    """
    POST /api/surveys/{surveyId}/responses

    Submit a completed survey response.

    Body: {
        "responses": {
            "overall_satisfaction": 4,
            "most_useful_feature": "Recommendations",
            ...
        }
    }
    """
    try:
        params = event.get("pathParameters", {}) or {}
        survey_id = params.get("surveyId", "post_launch")

        template = SURVEY_TEMPLATES.get(survey_id)
        if not template:
            return _response(404, {"error": f"Survey '{survey_id}' not found"})

        body = json.loads(event["body"]) if isinstance(event.get("body"), str) else event.get("body", {})
        responses = body.get("responses", {})

        # Validate required questions
        for question in template["questions"]:
            if question["required"] and question["id"] not in responses:
                return _response(400, {"error": f"Missing required answer: {question['id']}"})

        # Extract user info
        user_id = "anonymous"
        request_context = event.get("requestContext", {})
        authorizer = request_context.get("authorizer", {})
        if authorizer.get("claims"):
            user_id = authorizer["claims"].get("sub", "anonymous")

        response_id = str(uuid.uuid4())
        timestamp = datetime.now(UTC).isoformat()

        # Store survey response
        table = dynamodb.Table(FEEDBACK_TABLE)
        table.put_item(
            Item={
                "feedback_id": response_id,
                "user_id": user_id,
                "rating": responses.get("overall_satisfaction", 0),
                "comment": responses.get("additional_comments", ""),
                "category": "survey",
                "page": "survey",
                "timestamp": timestamp,
                "status": "new",
                "survey_id": survey_id,
                "survey_responses": json.dumps(responses),
            }
        )

        # Publish satisfaction metric
        satisfaction = responses.get("overall_satisfaction")
        if satisfaction is not None:
            cloudwatch.put_metric_data(
                Namespace="B3Dashboard",
                MetricData=[
                    {
                        "MetricName": "UserSatisfaction",
                        "Value": float(satisfaction),
                        "Unit": "None",
                        "Timestamp": datetime.now(UTC),
                    }
                ],
            )

        logger.info("Survey response stored: id=%s user=%s survey=%s", response_id, user_id, survey_id)

        return _response(200, {"success": True, "response_id": response_id})

    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})
    except Exception as e:
        logger.error("Error submitting survey: %s", e, exc_info=True)
        return _response(500, {"error": "Internal server error"})


def analyze_feature_usage_handler(event, context):
    """
    GET /api/analytics/feature-usage?days=30

    Analyzes feature usage patterns from the analytics table to identify
    popular features, underused features, and usage trends.

    Implements Req 91.2, 91.5, 91.10
    """
    try:
        params = event.get("queryStringParameters", {}) or {}
        days = int(params.get("days", 30))

        end_date = datetime.now(UTC)
        start_date = end_date - timedelta(days=days)

        # Scan analytics table for feature usage events
        table = dynamodb.Table(ANALYTICS_TABLE)
        response = table.scan(
            FilterExpression=Attr("event_type").eq("feature_usage")
            & Attr("timestamp").gte(start_date.isoformat()),
            Limit=5000,
        )
        items = response.get("Items", [])

        # Aggregate feature usage
        feature_counts: Dict[str, int] = {}
        daily_usage: Dict[str, Dict[str, int]] = {}
        user_features: Dict[str, set] = {}

        for item in items:
            event_data = json.loads(item.get("event_data", "{}"))
            feature = event_data.get("feature", "unknown")
            user_id = item.get("user_id", "anonymous")
            date = item.get("timestamp", "")[:10]

            feature_counts[feature] = feature_counts.get(feature, 0) + 1

            if date not in daily_usage:
                daily_usage[date] = {}
            daily_usage[date][feature] = daily_usage[date].get(feature, 0) + 1

            if user_id not in user_features:
                user_features[user_id] = set()
            user_features[user_id].add(feature)

        # Sort features by usage
        sorted_features = sorted(feature_counts.items(), key=lambda x: x[1], reverse=True)

        # Calculate adoption rates
        total_users = len(user_features)
        feature_adoption = {}
        for feature in feature_counts:
            users_using = sum(1 for u in user_features.values() if feature in u)
            feature_adoption[feature] = round(users_using / total_users * 100, 1) if total_users > 0 else 0

        # Identify underused features (< 10% adoption)
        all_features = {
            "recommendations_filter", "export_csv", "export_excel",
            "ticker_detail", "comparison_mode", "alerts",
            "backtesting", "explainability", "drift_detection",
            "data_quality", "cost_analysis", "performance_breakdown",
        }
        underused = [f for f in all_features if feature_adoption.get(f, 0) < 10]

        analysis = {
            "period_days": days,
            "total_events": len(items),
            "unique_users": total_users,
            "feature_ranking": [{"feature": f, "count": c} for f, c in sorted_features],
            "feature_adoption_pct": feature_adoption,
            "underused_features": underused,
            "daily_usage": {d: dict(v) for d, v in sorted(daily_usage.items())},
        }

        # Save analysis to S3
        if BUCKET:
            key = f"analytics/feature_usage/dt={end_date.date().isoformat()}/analysis.json"
            s3.put_object(
                Bucket=BUCKET,
                Key=key,
                Body=json.dumps(analysis, indent=2, default=str),
                ContentType="application/json",
            )

        return _response(200, analysis)

    except Exception as e:
        logger.error("Error analyzing feature usage: %s", e, exc_info=True)
        return _response(500, {"error": "Internal server error"})


def generate_iteration2_roadmap_handler(event, context):
    """
    GET /api/planning/iteration2?days=30

    Generates an iteration 2 planning report by combining feedback data,
    feature usage analytics, and performance metrics.

    Implements Req 91.6, 91.10
    """
    try:
        params = event.get("queryStringParameters", {}) or {}
        days = int(params.get("days", 30))

        end_date = datetime.now(UTC)
        start_date = end_date - timedelta(days=days)

        # ── 1. Aggregate feedback ──
        feedback_table = dynamodb.Table(FEEDBACK_TABLE)
        fb_response = feedback_table.scan(Limit=1000)
        fb_items = fb_response.get("Items", [])

        ratings = [int(i["rating"]) for i in fb_items if i.get("rating")]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0

        # Collect feature requests from comments
        feature_requests: Dict[str, int] = {}
        bug_reports = 0
        for item in fb_items:
            cat = item.get("category", "general")
            if cat == "bug":
                bug_reports += 1
            elif cat == "feature":
                comment = item.get("comment", "")
                if comment:
                    feature_requests[comment[:100]] = feature_requests.get(comment[:100], 0) + 1

        # Survey-specific analysis
        survey_responses = [i for i in fb_items if i.get("survey_id")]
        nps_like_score = 0
        if survey_responses:
            promoters = sum(1 for s in survey_responses if int(s.get("rating", 0)) >= 4)
            detractors = sum(1 for s in survey_responses if int(s.get("rating", 0)) <= 2)
            nps_like_score = round(
                ((promoters - detractors) / len(survey_responses)) * 100, 1
            )

        # ── 2. Feature usage analysis ──
        analytics_table = dynamodb.Table(ANALYTICS_TABLE)
        analytics_resp = analytics_table.scan(
            FilterExpression=Attr("event_type").eq("feature_usage"),
            Limit=5000,
        )
        analytics_items = analytics_resp.get("Items", [])

        feature_counts: Dict[str, int] = {}
        for item in analytics_items:
            event_data = json.loads(item.get("event_data", "{}"))
            feature = event_data.get("feature", "unknown")
            feature_counts[feature] = feature_counts.get(feature, 0) + 1

        top_features = sorted(feature_counts.items(), key=lambda x: x[1], reverse=True)[:10]

        # ── 3. Build roadmap ──
        improvement_opportunities = []

        # From feedback
        if avg_rating < 4:
            improvement_opportunities.append({
                "area": "User Satisfaction",
                "priority": "high",
                "description": f"Average rating is {avg_rating:.1f}/5. Focus on UX improvements.",
            })

        if bug_reports > 5:
            improvement_opportunities.append({
                "area": "Stability",
                "priority": "high",
                "description": f"{bug_reports} bug reports received. Prioritize bug fixes.",
            })

        # From usage patterns
        low_usage_features = [f for f, c in feature_counts.items() if c < 10]
        if low_usage_features:
            improvement_opportunities.append({
                "area": "Feature Discoverability",
                "priority": "medium",
                "description": f"Low-usage features: {', '.join(low_usage_features[:5])}. "
                               "Consider better onboarding or UI placement.",
            })

        # Standard iteration 2 items
        iteration2_themes = [
            {
                "theme": "Performance Optimization",
                "priority": "high",
                "items": [
                    "Optimize slow API endpoints based on real usage data",
                    "Tune cache TTLs based on access patterns",
                    "Optimize Lambda memory allocation",
                ],
            },
            {
                "theme": "User Experience",
                "priority": "high",
                "items": [
                    "Address top user feedback items",
                    "Improve feature discoverability for underused features",
                    "Enhance mobile responsiveness",
                ],
            },
            {
                "theme": "Data & Model Quality",
                "priority": "medium",
                "items": [
                    "Implement automated model retraining pipeline",
                    "Enhance drift detection sensitivity",
                    "Add more data quality checks",
                ],
            },
            {
                "theme": "Cost Optimization",
                "priority": "medium",
                "items": [
                    "Implement cost optimization suggestions",
                    "Review and optimize storage lifecycle policies",
                    "Right-size Lambda functions",
                ],
            },
        ]

        roadmap = {
            "generated_at": datetime.now(UTC).isoformat(),
            "analysis_period_days": days,
            "feedback_summary": {
                "total_feedback": len(fb_items),
                "average_rating": round(avg_rating, 2),
                "nps_like_score": nps_like_score,
                "bug_reports": bug_reports,
                "top_feature_requests": sorted(
                    feature_requests.items(), key=lambda x: x[1], reverse=True
                )[:10],
            },
            "usage_summary": {
                "total_events": len(analytics_items),
                "top_features": [{"feature": f, "count": c} for f, c in top_features],
                "low_usage_features": low_usage_features[:10],
            },
            "improvement_opportunities": improvement_opportunities,
            "iteration2_roadmap": iteration2_themes,
        }

        # Save to S3
        if BUCKET:
            key = f"planning/iteration2/dt={end_date.date().isoformat()}/roadmap.json"
            s3.put_object(
                Bucket=BUCKET,
                Key=key,
                Body=json.dumps(roadmap, indent=2, default=str),
                ContentType="application/json",
            )
            logger.info("Iteration 2 roadmap saved to s3://%s/%s", BUCKET, key)

        return _response(200, roadmap)

    except Exception as e:
        logger.error("Error generating iteration 2 roadmap: %s", e, exc_info=True)
        return _response(500, {"error": "Internal server error"})


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-Api-Key, Authorization",
        },
        "body": json.dumps(body, default=str),
    }
