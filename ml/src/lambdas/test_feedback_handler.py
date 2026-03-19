"""Tests for feedback_handler Lambda."""

import json
import unittest
from unittest.mock import MagicMock, patch

# Patch boto3 before importing handler
with patch("boto3.resource") as mock_resource:
    mock_table = MagicMock()
    mock_resource.return_value.Table.return_value = mock_table
    from feedback_handler import handler, get_feedback_summary


class TestFeedbackHandler(unittest.TestCase):
    @patch("feedback_handler.dynamodb")
    def test_valid_feedback(self, mock_dynamo):
        mock_table = MagicMock()
        mock_dynamo.Table.return_value = mock_table

        event = {
            "body": json.dumps({"rating": 4, "comment": "Nice!", "category": "general"}),
        }
        result = handler(event, None)
        self.assertEqual(result["statusCode"], 200)
        body = json.loads(result["body"])
        self.assertTrue(body["success"])
        self.assertIn("feedback_id", body)
        mock_table.put_item.assert_called_once()

    def test_missing_rating(self):
        event = {"body": json.dumps({"comment": "No rating"})}
        result = handler(event, None)
        self.assertEqual(result["statusCode"], 400)

    def test_invalid_rating_too_high(self):
        event = {"body": json.dumps({"rating": 10})}
        result = handler(event, None)
        self.assertEqual(result["statusCode"], 400)

    def test_invalid_rating_zero(self):
        event = {"body": json.dumps({"rating": 0})}
        result = handler(event, None)
        self.assertEqual(result["statusCode"], 400)

    def test_invalid_json(self):
        event = {"body": "not json"}
        result = handler(event, None)
        self.assertEqual(result["statusCode"], 400)

    @patch("feedback_handler.dynamodb")
    def test_comment_truncation(self, mock_dynamo):
        mock_table = MagicMock()
        mock_dynamo.Table.return_value = mock_table

        long_comment = "x" * 3000
        event = {"body": json.dumps({"rating": 3, "comment": long_comment})}
        result = handler(event, None)
        self.assertEqual(result["statusCode"], 200)
        # Verify the stored comment was truncated
        stored = mock_table.put_item.call_args[1]["Item"]
        self.assertEqual(len(stored["comment"]), 2000)

    @patch("feedback_handler.dynamodb")
    def test_invalid_category_defaults_to_general(self, mock_dynamo):
        mock_table = MagicMock()
        mock_dynamo.Table.return_value = mock_table

        event = {"body": json.dumps({"rating": 5, "category": "invalid_cat"})}
        result = handler(event, None)
        self.assertEqual(result["statusCode"], 200)
        stored = mock_table.put_item.call_args[1]["Item"]
        self.assertEqual(stored["category"], "general")

    @patch("feedback_handler.dynamodb")
    def test_cors_headers(self, mock_dynamo):
        mock_table = MagicMock()
        mock_dynamo.Table.return_value = mock_table

        event = {"body": json.dumps({"rating": 3})}
        result = handler(event, None)
        self.assertIn("Access-Control-Allow-Origin", result["headers"])
        self.assertEqual(result["headers"]["Access-Control-Allow-Origin"], "*")


if __name__ == "__main__":
    unittest.main()
