"""
Unit tests for security implementation

Tests:
- Authentication service
- Security middleware
- Data encryption
- Input sanitization
- Rate limiting
- CSRF protection
"""

import json
import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.lambdas.auth_service import (
    hash_api_key,
    generate_api_key,
    check_authorization,
    ROLE_HIERARCHY,
)
from src.lambdas.security_middleware import (
    sanitize_input,
    validate_csrf_token,
    check_rate_limit,
    validate_request_size,
)
from src.lambdas.data_encryption import (
    classify_data_sensitivity,
    mask_sensitive_data,
)


class TestAuthService(unittest.TestCase):
    """Test authentication service"""
    
    def test_hash_api_key(self):
        """Test API key hashing"""
        key = "test-api-key-12345"
        hash1 = hash_api_key(key)
        hash2 = hash_api_key(key)
        
        # Same key should produce same hash
        self.assertEqual(hash1, hash2)
        
        # Hash should be 64 characters (SHA-256 hex)
        self.assertEqual(len(hash1), 64)
        
        # Different keys should produce different hashes
        hash3 = hash_api_key("different-key")
        self.assertNotEqual(hash1, hash3)
    
    def test_generate_api_key(self):
        """Test API key generation"""
        key1 = generate_api_key()
        key2 = generate_api_key()
        
        # Keys should be unique
        self.assertNotEqual(key1, key2)
        
        # Keys should be 64 characters (32 bytes hex)
        self.assertEqual(len(key1), 64)
        self.assertEqual(len(key2), 64)
    
    def test_check_authorization(self):
        """Test role-based authorization"""
        # Admin can access everything
        self.assertTrue(check_authorization("admin", "admin"))
        self.assertTrue(check_authorization("admin", "analyst"))
        self.assertTrue(check_authorization("admin", "viewer"))
        
        # Analyst can access analyst and viewer
        self.assertFalse(check_authorization("analyst", "admin"))
        self.assertTrue(check_authorization("analyst", "analyst"))
        self.assertTrue(check_authorization("analyst", "viewer"))
        
        # Viewer can only access viewer
        self.assertFalse(check_authorization("viewer", "admin"))
        self.assertFalse(check_authorization("viewer", "analyst"))
        self.assertTrue(check_authorization("viewer", "viewer"))
        
        # Invalid roles
        self.assertFalse(check_authorization("invalid", "viewer"))
        self.assertFalse(check_authorization("viewer", "invalid"))


class TestSecurityMiddleware(unittest.TestCase):
    """Test security middleware"""
    
    def test_sanitize_input_string(self):
        """Test string sanitization"""
        # HTML escaping
        result = sanitize_input("<script>alert('xss')</script>")
        self.assertNotIn("<script>", result)
        
        # Event handlers
        result = sanitize_input('<div onclick="alert()">test</div>')
        self.assertNotIn("onclick", result)
        
        # JavaScript protocol
        result = sanitize_input('<a href="javascript:alert()">link</a>')
        self.assertNotIn("javascript:", result)
        
        # Data protocol
        result = sanitize_input('<img src="data:text/html,<script>alert()</script>">')
        self.assertNotIn("data:", result)
    
    def test_sanitize_input_dict(self):
        """Test dictionary sanitization"""
        data = {
            "name": "<script>alert('xss')</script>",
            "email": "user@example.com",
            "nested": {
                "value": '<img src="javascript:alert()">'
            }
        }
        
        result = sanitize_input(data)
        
        # Script tags should be removed
        self.assertNotIn("<script>", result["name"])
        
        # Safe values should be unchanged
        self.assertEqual(result["email"], "user@example.com")
        
        # Nested values should be sanitized
        self.assertNotIn("javascript:", result["nested"]["value"])
    
    def test_sanitize_input_list(self):
        """Test list sanitization"""
        data = [
            "<script>alert()</script>",
            "safe value",
            {"key": '<img src="javascript:alert()">'}
        ]
        
        result = sanitize_input(data)
        
        # Script tags should be removed
        self.assertNotIn("<script>", result[0])
        
        # Safe values should be unchanged
        self.assertEqual(result[1], "safe value")
        
        # Nested dicts should be sanitized
        self.assertNotIn("javascript:", result[2]["key"])
    
    def test_validate_csrf_token(self):
        """Test CSRF token validation"""
        # GET requests don't need CSRF token
        event = {"httpMethod": "GET", "headers": {}}
        self.assertTrue(validate_csrf_token(event))
        
        # POST requests need CSRF token
        event = {
            "httpMethod": "POST",
            "headers": {"X-CSRF-Token": "a" * 32}
        }
        self.assertTrue(validate_csrf_token(event))
        
        # Missing CSRF token
        event = {"httpMethod": "POST", "headers": {}}
        self.assertFalse(validate_csrf_token(event))
        
        # Token too short
        event = {
            "httpMethod": "POST",
            "headers": {"X-CSRF-Token": "short"}
        }
        self.assertFalse(validate_csrf_token(event))
    
    def test_validate_request_size(self):
        """Test request size validation"""
        # Small request
        event = {"body": "small"}
        self.assertTrue(validate_request_size(event, max_size_bytes=1024))
        
        # Large request
        event = {"body": "x" * 2000}
        self.assertFalse(validate_request_size(event, max_size_bytes=1024))
        
        # No body
        event = {}
        self.assertTrue(validate_request_size(event))


class TestDataEncryption(unittest.TestCase):
    """Test data encryption utilities"""
    
    def test_classify_data_sensitivity(self):
        """Test data sensitivity classification"""
        # Restricted data (contains secrets)
        data = {"api_key": "secret123", "value": 100}
        self.assertEqual(classify_data_sensitivity(data), "restricted")
        
        data = {"password": "pass123"}
        self.assertEqual(classify_data_sensitivity(data), "restricted")
        
        # Confidential data (contains PII)
        data = {"email": "user@example.com", "value": 100}
        self.assertEqual(classify_data_sensitivity(data), "confidential")
        
        data = {"name": "John Doe", "phone": "123-456-7890"}
        self.assertEqual(classify_data_sensitivity(data), "confidential")
        
        # Internal data (no sensitive fields)
        data = {"ticker": "PETR4", "score": 0.85}
        self.assertEqual(classify_data_sensitivity(data), "internal")
    
    def test_mask_sensitive_data(self):
        """Test sensitive data masking"""
        data = {
            "api_key": "1234567890abcdef",
            "username": "john_doe",
            "password": "secret123",
            "ticker": "PETR4"
        }
        
        masked = mask_sensitive_data(data)
        
        # Sensitive fields should be masked
        self.assertNotEqual(masked["api_key"], data["api_key"])
        self.assertIn("*", masked["api_key"])
        
        self.assertNotEqual(masked["password"], data["password"])
        
        # Non-sensitive fields should be unchanged
        self.assertEqual(masked["username"], data["username"])
        self.assertEqual(masked["ticker"], data["ticker"])
    
    def test_mask_sensitive_data_nested(self):
        """Test masking nested sensitive data"""
        data = {
            "user": {
                "name": "John Doe",
                "credentials": {
                    "api_key": "1234567890abcdef",
                    "secret": "topsecret"
                }
            },
            "ticker": "PETR4"
        }
        
        masked = mask_sensitive_data(data)
        
        # Nested sensitive fields should be masked
        self.assertNotEqual(
            masked["user"]["credentials"]["api_key"],
            data["user"]["credentials"]["api_key"]
        )
        self.assertNotEqual(
            masked["user"]["credentials"]["secret"],
            data["user"]["credentials"]["secret"]
        )
        
        # Non-sensitive fields should be unchanged
        self.assertEqual(masked["user"]["name"], data["user"]["name"])
        self.assertEqual(masked["ticker"], data["ticker"])


class TestRateLimiting(unittest.TestCase):
    """Test rate limiting"""
    
    @patch('src.lambdas.security_middleware.dynamodb')
    def test_rate_limit_first_request(self, mock_dynamodb):
        """Test rate limiting for first request"""
        # Mock DynamoDB response - no existing item
        mock_table = MagicMock()
        mock_table.get_item.return_value = {}
        mock_dynamodb.Table.return_value = mock_table
        
        # First request should be allowed
        result = check_rate_limit("user123", limit=100, window=60)
        self.assertTrue(result)
        
        # Should create new item
        mock_table.put_item.assert_called_once()
    
    @patch('src.lambdas.security_middleware.dynamodb')
    def test_rate_limit_within_limit(self, mock_dynamodb):
        """Test rate limiting within limit"""
        # Mock DynamoDB response - existing item within limit
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            "Item": {
                "identifier": "user123",
                "count": 50,
                "windowStart": datetime.now(UTC).isoformat()
            }
        }
        mock_dynamodb.Table.return_value = mock_table
        
        # Request should be allowed
        result = check_rate_limit("user123", limit=100, window=60)
        self.assertTrue(result)
        
        # Should increment counter
        mock_table.update_item.assert_called_once()
    
    @patch('src.lambdas.security_middleware.dynamodb')
    def test_rate_limit_exceeded(self, mock_dynamodb):
        """Test rate limiting when limit exceeded"""
        # Mock DynamoDB response - existing item at limit
        mock_table = MagicMock()
        mock_table.get_item.return_value = {
            "Item": {
                "identifier": "user123",
                "count": 100,
                "windowStart": datetime.now(UTC).isoformat()
            }
        }
        mock_dynamodb.Table.return_value = mock_table
        
        # Request should be denied
        result = check_rate_limit("user123", limit=100, window=60)
        self.assertFalse(result)
        
        # Should not increment counter
        mock_table.update_item.assert_not_called()


if __name__ == "__main__":
    unittest.main()
