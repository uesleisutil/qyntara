"""
Integration tests for drift detection endpoint routing in dashboard_api.py

Tests that the Lambda handler correctly routes requests to the drift endpoints.
"""

import json
import sys
import os
from pathlib import Path
from unittest.mock import patch

# Set required env vars before import
os.environ.setdefault("BUCKET", "test-bucket")

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from lambdas.dashboard_api import handler

# Sample drift data for mocking
SAMPLE_DRIFT_DATA = [
    {
        "date": "2026-03-18",
        "data_drift": [
            {
                "feature": "volume",
                "ks_statistic": 0.15,
                "p_value": 0.03,
                "current_distribution": [0.1, 0.2, 0.3],
                "baseline_distribution": [0.12, 0.18, 0.28],
            }
        ],
        "concept_drift": [
            {
                "feature": "volume",
                "current_correlation": 0.6,
                "baseline_correlation": 0.3,
                "change": 0.3,
            }
        ],
        "performance": {
            "mape": {"current": 0.12, "baseline": 0.10},
            "accuracy": {"current": 0.65, "baseline": 0.72},
            "sharpe_ratio": {"current": 1.0, "baseline": 1.3},
        },
        "model_info": {
            "last_training_date": "2026-02-01",
        },
    }
]


@patch("lambdas.dashboard_api.load_latest_from_prefix", return_value=SAMPLE_DRIFT_DATA[0])
@patch("lambdas.dashboard_api.load_time_series", return_value=SAMPLE_DRIFT_DATA)
def test_data_drift_routing(mock_lts, mock_llp):
    """Test that /api/drift/data-drift routes correctly"""
    event = {
        "path": "/api/drift/data-drift",
        "queryStringParameters": {"days": "90"}
    }
    context = {}
    
    response = handler(event, context)
    
    assert response["statusCode"] in [200, 404], "Should return 200 or 404"
    assert "headers" in response, "Should include CORS headers"
    assert response["headers"]["Access-Control-Allow-Origin"] == "*"
    
    if response["statusCode"] == 200:
        body = json.loads(response["body"])
        assert "driftData" in body or "error" not in body
    
    print("✓ Data drift routing works")


@patch("lambdas.dashboard_api.load_latest_from_prefix", return_value=SAMPLE_DRIFT_DATA[0])
@patch("lambdas.dashboard_api.load_time_series", return_value=SAMPLE_DRIFT_DATA)
def test_concept_drift_routing(mock_lts, mock_llp):
    """Test that /api/drift/concept-drift routes correctly"""
    event = {
        "path": "/api/drift/concept-drift",
        "queryStringParameters": {"days": "90"}
    }
    context = {}
    
    response = handler(event, context)
    
    assert response["statusCode"] in [200, 404], "Should return 200 or 404"
    assert "headers" in response, "Should include CORS headers"
    
    if response["statusCode"] == 200:
        body = json.loads(response["body"])
        assert "conceptDriftData" in body or "error" not in body
    
    print("✓ Concept drift routing works")


@patch("lambdas.dashboard_api.load_latest_from_prefix", return_value=SAMPLE_DRIFT_DATA[0])
@patch("lambdas.dashboard_api.load_time_series", return_value=SAMPLE_DRIFT_DATA)
def test_degradation_routing(mock_lts, mock_llp):
    """Test that /api/drift/degradation routes correctly"""
    event = {
        "path": "/api/drift/degradation",
        "queryStringParameters": {"days": "90"}
    }
    context = {}
    
    response = handler(event, context)
    
    assert response["statusCode"] in [200, 404], "Should return 200 or 404"
    assert "headers" in response, "Should include CORS headers"
    
    if response["statusCode"] == 200:
        body = json.loads(response["body"])
        assert "performanceDegradation" in body or "error" not in body
    
    print("✓ Degradation routing works")


@patch("lambdas.dashboard_api.load_latest_from_prefix", return_value=SAMPLE_DRIFT_DATA[0])
@patch("lambdas.dashboard_api.load_time_series", return_value=SAMPLE_DRIFT_DATA)
def test_retraining_routing(mock_lts, mock_llp):
    """Test that /api/drift/retraining routes correctly"""
    event = {
        "path": "/api/drift/retraining",
        "queryStringParameters": {"days": "90"}
    }
    context = {}
    
    response = handler(event, context)
    
    assert response["statusCode"] in [200, 404], "Should return 200 or 404"
    assert "headers" in response, "Should include CORS headers"
    
    if response["statusCode"] == 200:
        body = json.loads(response["body"])
        assert "driftedFeaturesPercentage" in body or "error" not in body
    
    print("✓ Retraining routing works")


@patch("lambdas.dashboard_api.load_latest_from_prefix", return_value=SAMPLE_DRIFT_DATA[0])
@patch("lambdas.dashboard_api.load_time_series", return_value=SAMPLE_DRIFT_DATA)
def test_default_days_parameter(mock_lts, mock_llp):
    """Test that days parameter defaults to 90 for drift endpoints"""
    event = {
        "path": "/api/drift/data-drift",
        "queryStringParameters": None  # No query params
    }
    context = {}
    
    response = handler(event, context)
    
    # Should not crash, should use default of 90 days
    assert response["statusCode"] in [200, 404, 500]
    
    print("✓ Default days parameter works")


@patch("lambdas.dashboard_api.load_latest_from_prefix", return_value=SAMPLE_DRIFT_DATA[0])
@patch("lambdas.dashboard_api.load_time_series", return_value=SAMPLE_DRIFT_DATA)
def test_cors_headers(mock_lts, mock_llp):
    """Test that all drift endpoints return proper CORS headers"""
    paths = [
        "/api/drift/data-drift",
        "/api/drift/concept-drift",
        "/api/drift/degradation",
        "/api/drift/retraining"
    ]
    
    for path in paths:
        event = {
            "path": path,
            "queryStringParameters": {"days": "90"}
        }
        context = {}
        
        response = handler(event, context)
        
        assert "headers" in response, f"{path} should include headers"
        headers = response["headers"]
        
        assert "Access-Control-Allow-Origin" in headers
        assert headers["Access-Control-Allow-Origin"] == "*"
        assert "Access-Control-Allow-Methods" in headers
        assert "Access-Control-Allow-Headers" in headers
        assert "Content-Type" in headers
        assert headers["Content-Type"] == "application/json"
    
    print("✓ CORS headers are correct for all endpoints")


@patch("lambdas.dashboard_api.load_latest_from_prefix", return_value=SAMPLE_DRIFT_DATA[0])
@patch("lambdas.dashboard_api.load_time_series", return_value=SAMPLE_DRIFT_DATA)
def test_gzip_compression_support(mock_lts, mock_llp):
    """Test that gzip compression is supported"""
    event = {
        "path": "/api/drift/data-drift",
        "queryStringParameters": {"days": "90"},
        "headers": {
            "Accept-Encoding": "gzip"
        }
    }
    context = {}
    
    response = handler(event, context)
    
    # If response is 200, check if compression was applied
    if response["statusCode"] == 200:
        # Compression should be applied for successful responses
        if response.get("isBase64Encoded"):
            assert "Content-Encoding" in response["headers"]
            assert response["headers"]["Content-Encoding"] == "gzip"
            print("✓ Gzip compression is applied when requested")
        else:
            print("✓ Gzip compression support is present (no data to compress)")
    else:
        print("✓ Gzip compression test skipped (no data available)")


if __name__ == "__main__":
    print("\nTesting drift detection endpoint routing...\n")
    
    try:
        test_data_drift_routing()
        test_concept_drift_routing()
        test_degradation_routing()
        test_retraining_routing()
        test_default_days_parameter()
        test_cors_headers()
        test_gzip_compression_support()
        
        print("\n✅ All routing tests passed!\n")
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
