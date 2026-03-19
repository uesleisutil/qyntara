"""
Tests for the feedback_survey Lambda module.

Covers:
  - Survey template retrieval
  - Survey response submission and validation
  - Feature usage analysis
  - Iteration 2 roadmap generation
"""

import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime, UTC

# Ensure the Lambda source is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ml", "src", "lambdas"))


class TestGetSurveyHandler(unittest.TestCase):
    """Tests for get_survey_handler."""

    @patch.dict(os.environ, {"FEEDBACK_TABLE": "TestFeedback", "ANALYTICS_TABLE": "TestAnalytics", "BUCKET": "test-bucket"})
    def test_returns_post_launch_survey(self):
        from feedback_survey import get_survey_handler

        event = {"pathParameters": {"surveyId": "post_launch"}}
        result = get_survey_handler(event, None)

        self.assertEqual(result["statusCode"], 200)
        body = json.loads(result["body"])
        self.assertIn("survey", body)
        self.assertEqual(body["survey"]["id"], "post_launch_v1")
        self.assertTrue(len(body["survey"]["questions"]) > 0)

    @patch.dict(os.environ, {"FEEDBACK_TABLE": "TestFeedback", "ANALYTICS_TABLE": "TestAnalytics", "BUCKET": "test-bucket"})
    def test_returns_404_for_unknown_survey(self):
        from feedback_survey import get_survey_handler

        event = {"pathParameters": {"surveyId": "nonexistent"}}
        result = get_survey_handler(event, None)

        self.assertEqual(result["statusCode"], 404)
        body = json.loads(result["body"])
        self.assertIn("error", body)


class TestSubmitSurveyHandler(unittest.TestCase):
    """Tests for submit_survey_handler."""

    @patch.dict(os.environ, {"FEEDBACK_TABLE": "TestFeedback", "ANALYTICS_TABLE": "TestAnalytics", "BUCKET": "test-bucket"})
    @patch("feedback_survey.dynamodb")
    @patch("feedback_survey.cloudwatch")
    def test_submit_valid_survey(self, mock_cw, mock_dynamo):
        from feedback_survey import submit_survey_handler

        mock_table = MagicMock()
        mock_dynamo.Table.return_value = mock_table

        event = {
            "pathParameters": {"surveyId": "post_launch"},
            "body": json.dumps({
                "responses": {
                    "overall_satisfaction": 4,
                    "most_useful_feature": "Recommendations",
                    "ease_of_use": 5,
                    "performance_rating": 4,
                    "recommendation_quality": 4,
                    "would_recommend": "Definitely",
                }
            }),
            "requestContext": {},
        }

        result = submit_survey_handler(event, None)
        self.assertEqual(result["statusCode"], 200)
        body = json.loads(result["body"])
        self.assertTrue(body["success"])
        self.assertIn("response_id", body)
        mock_table.put_item.assert_called_once()

    @patch.dict(os.environ, {"FEEDBACK_TABLE": "TestFeedback", "ANALYTICS_TABLE": "TestAnalytics", "BUCKET": "test-bucket"})
    def test_submit_missing_required_field(self):
        from feedback_survey import submit_survey_handler

        event = {
            "pathParameters": {"surveyId": "post_launch"},
            "body": json.dumps({
                "responses": {
                    "overall_satisfaction": 4,
                    # Missing other required fields
                }
            }),
            "requestContext": {},
        }

        result = submit_survey_handler(event, None)
        self.assertEqual(result["statusCode"], 400)
        body = json.loads(result["body"])
        self.assertIn("error", body)

    @patch.dict(os.environ, {"FEEDBACK_TABLE": "TestFeedback", "ANALYTICS_TABLE": "TestAnalytics", "BUCKET": "test-bucket"})
    def test_submit_to_nonexistent_survey(self):
        from feedback_survey import submit_survey_handler

        event = {
            "pathParameters": {"surveyId": "nonexistent"},
            "body": json.dumps({"responses": {}}),
            "requestContext": {},
        }

        result = submit_survey_handler(event, None)
        self.assertEqual(result["statusCode"], 404)


class TestAnalyzeFeatureUsage(unittest.TestCase):
    """Tests for analyze_feature_usage_handler."""

    @patch.dict(os.environ, {"FEEDBACK_TABLE": "TestFeedback", "ANALYTICS_TABLE": "TestAnalytics", "BUCKET": "test-bucket"})
    @patch("feedback_survey.s3")
    @patch("feedback_survey.dynamodb")
    def test_analyze_feature_usage(self, mock_dynamo, mock_s3):
        from feedback_survey import analyze_feature_usage_handler

        mock_table = MagicMock()
        mock_dynamo.Table.return_value = mock_table
        mock_table.scan.return_value = {
            "Items": [
                {
                    "user_id": "user1",
                    "event_type": "feature_usage",
                    "event_data": json.dumps({"feature": "export_csv"}),
                    "timestamp": "2024-01-15T10:00:00Z",
                },
                {
                    "user_id": "user2",
                    "event_type": "feature_usage",
                    "event_data": json.dumps({"feature": "export_csv"}),
                    "timestamp": "2024-01-15T11:00:00Z",
                },
                {
                    "user_id": "user1",
                    "event_type": "feature_usage",
                    "event_data": json.dumps({"feature": "backtesting"}),
                    "timestamp": "2024-01-15T12:00:00Z",
                },
            ]
        }

        event = {"queryStringParameters": {"days": "30"}}
        result = analyze_feature_usage_handler(event, None)

        self.assertEqual(result["statusCode"], 200)
        body = json.loads(result["body"])
        self.assertEqual(body["total_events"], 3)
        self.assertEqual(body["unique_users"], 2)
        self.assertTrue(len(body["feature_ranking"]) > 0)
        # export_csv should be top feature
        self.assertEqual(body["feature_ranking"][0]["feature"], "export_csv")
        self.assertEqual(body["feature_ranking"][0]["count"], 2)

    @patch.dict(os.environ, {"FEEDBACK_TABLE": "TestFeedback", "ANALYTICS_TABLE": "TestAnalytics", "BUCKET": "test-bucket"})
    @patch("feedback_survey.s3")
    @patch("feedback_survey.dynamodb")
    def test_analyze_empty_usage(self, mock_dynamo, mock_s3):
        from feedback_survey import analyze_feature_usage_handler

        mock_table = MagicMock()
        mock_dynamo.Table.return_value = mock_table
        mock_table.scan.return_value = {"Items": []}

        event = {"queryStringParameters": {"days": "7"}}
        result = analyze_feature_usage_handler(event, None)

        self.assertEqual(result["statusCode"], 200)
        body = json.loads(result["body"])
        self.assertEqual(body["total_events"], 0)
        self.assertEqual(body["unique_users"], 0)


class TestGenerateIteration2Roadmap(unittest.TestCase):
    """Tests for generate_iteration2_roadmap_handler."""

    @patch.dict(os.environ, {"FEEDBACK_TABLE": "TestFeedback", "ANALYTICS_TABLE": "TestAnalytics", "BUCKET": "test-bucket"})
    @patch("feedback_survey.s3")
    @patch("feedback_survey.dynamodb")
    def test_generate_roadmap(self, mock_dynamo, mock_s3):
        from feedback_survey import generate_iteration2_roadmap_handler

        feedback_table = MagicMock()
        analytics_table = MagicMock()

        def table_factory(name):
            if name == "TestFeedback":
                return feedback_table
            return analytics_table

        mock_dynamo.Table.side_effect = table_factory

        feedback_table.scan.return_value = {
            "Items": [
                {"feedback_id": "1", "rating": 4, "category": "general", "comment": "Great tool"},
                {"feedback_id": "2", "rating": 2, "category": "bug", "comment": "Slow loading"},
                {"feedback_id": "3", "rating": 5, "category": "feature", "comment": "Add alerts"},
            ]
        }

        analytics_table.scan.return_value = {
            "Items": [
                {
                    "event_type": "feature_usage",
                    "event_data": json.dumps({"feature": "recommendations_filter"}),
                },
                {
                    "event_type": "feature_usage",
                    "event_data": json.dumps({"feature": "recommendations_filter"}),
                },
            ]
        }

        event = {"queryStringParameters": {"days": "30"}}
        result = generate_iteration2_roadmap_handler(event, None)

        self.assertEqual(result["statusCode"], 200)
        body = json.loads(result["body"])

        self.assertIn("feedback_summary", body)
        self.assertIn("usage_summary", body)
        self.assertIn("iteration2_roadmap", body)
        self.assertEqual(body["feedback_summary"]["total_feedback"], 3)
        self.assertAlmostEqual(body["feedback_summary"]["average_rating"], 3.67, places=1)
        self.assertTrue(len(body["iteration2_roadmap"]) > 0)


class TestResponseHelper(unittest.TestCase):
    """Tests for the _response helper."""

    @patch.dict(os.environ, {"FEEDBACK_TABLE": "TestFeedback", "ANALYTICS_TABLE": "TestAnalytics", "BUCKET": "test-bucket"})
    def test_response_format(self):
        from feedback_survey import _response

        result = _response(200, {"key": "value"})
        self.assertEqual(result["statusCode"], 200)
        self.assertEqual(result["headers"]["Content-Type"], "application/json")
        self.assertEqual(result["headers"]["Access-Control-Allow-Origin"], "*")
        body = json.loads(result["body"])
        self.assertEqual(body["key"], "value")


if __name__ == "__main__":
    unittest.main()
