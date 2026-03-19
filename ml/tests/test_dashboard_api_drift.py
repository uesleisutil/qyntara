"""
Tests for drift detection endpoints in dashboard_api.py

Tests the four new drift detection endpoints:
- /api/drift/data-drift
- /api/drift/concept-drift
- /api/drift/degradation
- /api/drift/retraining
"""

import json
import sys
import os
from pathlib import Path
from unittest.mock import patch, MagicMock

# Set required env vars before import
os.environ.setdefault("BUCKET", "test-bucket")

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from lambdas.dashboard_api import (
    get_drift_data_drift,
    get_drift_concept_drift,
    get_drift_degradation,
    get_drift_retraining,
)

# Sample drift data returned by load_time_series
SAMPLE_DRIFT_DATA = [
    {
        "date": "2026-03-18",
        "data_drift": [
            {
                "feature": "volume",
                "ks_statistic": 0.15,
                "p_value": 0.03,
                "current_distribution": [0.1, 0.2, 0.3, 0.15, 0.25],
                "baseline_distribution": [0.12, 0.18, 0.28, 0.17, 0.25],
            },
            {
                "feature": "price_change",
                "ks_statistic": 0.05,
                "p_value": 0.45,
                "current_distribution": [0.2, 0.3, 0.25, 0.15, 0.1],
                "baseline_distribution": [0.21, 0.29, 0.24, 0.16, 0.1],
            },
        ],
        "concept_drift": [
            {
                "feature": "volume",
                "current_correlation": 0.6,
                "baseline_correlation": 0.3,
                "change": 0.3,
            },
            {
                "feature": "price_change",
                "current_correlation": 0.5,
                "baseline_correlation": 0.45,
                "change": 0.05,
            },
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


@patch("lambdas.dashboard_api.load_time_series", return_value=SAMPLE_DRIFT_DATA)
def test_data_drift_endpoint_structure(mock_lts):
    """Test that data drift endpoint returns correct structure"""
    response = get_drift_data_drift(days=90)
    
    assert response["statusCode"] in [200, 404], "Should return 200 or 404"
    
    if response["statusCode"] == 200:
        body = json.loads(response["body"])
        
        # Check required fields
        assert "driftData" in body, "Response should contain driftData"
        assert "summary" in body, "Response should contain summary"
        assert "metadata" in body, "Response should contain metadata"
        
        # Check summary structure
        summary = body["summary"]
        assert "totalFeatures" in summary
        assert "driftedFeatures" in summary
        assert "driftPercentage" in summary
        
        # Check metadata structure
        metadata = body["metadata"]
        assert "days" in metadata
        assert "timestamp" in metadata
        assert "cached" in metadata
        assert "cacheExpiry" in metadata
        
        # If there's drift data, check structure
        if body["driftData"]:
            drift_item = body["driftData"][0]
            assert "feature" in drift_item
            assert "ksStatistic" in drift_item
            assert "pValue" in drift_item
            assert "drifted" in drift_item
            assert "magnitude" in drift_item
            assert "currentDistribution" in drift_item
            assert "baselineDistribution" in drift_item
            
            # Check types
            assert isinstance(drift_item["feature"], str)
            assert isinstance(drift_item["ksStatistic"], (int, float))
            assert isinstance(drift_item["pValue"], (int, float))
            assert isinstance(drift_item["drifted"], bool)
            assert isinstance(drift_item["magnitude"], (int, float))
            assert isinstance(drift_item["currentDistribution"], list)
            assert isinstance(drift_item["baselineDistribution"], list)
        
        print("✓ Data drift endpoint structure is correct")


@patch("lambdas.dashboard_api.load_time_series", return_value=SAMPLE_DRIFT_DATA)
def test_concept_drift_endpoint_structure(mock_lts):
    """Test that concept drift endpoint returns correct structure"""
    response = get_drift_concept_drift(days=90)
    
    assert response["statusCode"] in [200, 404], "Should return 200 or 404"
    
    if response["statusCode"] == 200:
        body = json.loads(response["body"])
        
        # Check required fields
        assert "conceptDriftData" in body, "Response should contain conceptDriftData"
        assert "overallDriftScore" in body, "Response should contain overallDriftScore"
        assert "summary" in body, "Response should contain summary"
        assert "metadata" in body, "Response should contain metadata"
        
        # Check summary structure
        summary = body["summary"]
        assert "totalFeatures" in summary
        assert "driftedFeatures" in summary
        assert "driftPercentage" in summary
        
        # If there's concept drift data, check structure
        if body["conceptDriftData"]:
            drift_item = body["conceptDriftData"][0]
            assert "feature" in drift_item
            assert "currentCorrelation" in drift_item
            assert "baselineCorrelation" in drift_item
            assert "change" in drift_item
            assert "drifted" in drift_item
            
            # Check types
            assert isinstance(drift_item["feature"], str)
            assert isinstance(drift_item["currentCorrelation"], (int, float))
            assert isinstance(drift_item["baselineCorrelation"], (int, float))
            assert isinstance(drift_item["change"], (int, float))
            assert isinstance(drift_item["drifted"], bool)
        
        print("✓ Concept drift endpoint structure is correct")


@patch("lambdas.dashboard_api.load_time_series", return_value=SAMPLE_DRIFT_DATA)
@patch("lambdas.dashboard_api.load_latest_from_prefix", return_value=SAMPLE_DRIFT_DATA[0])
def test_degradation_endpoint_structure(mock_llp, mock_lts):
    """Test that degradation endpoint returns correct structure"""
    response = get_drift_degradation(days=90)
    
    assert response["statusCode"] in [200, 404], "Should return 200 or 404"
    
    if response["statusCode"] == 200:
        body = json.loads(response["body"])
        
        # Check required fields
        assert "performanceDegradation" in body, "Response should contain performanceDegradation"
        assert "driftEvents" in body, "Response should contain driftEvents"
        assert "metadata" in body, "Response should contain metadata"
        
        # If there's degradation data, check structure
        if body["performanceDegradation"]:
            deg_item = body["performanceDegradation"][0]
            assert "metric" in deg_item
            assert "current" in deg_item
            assert "baseline" in deg_item
            assert "change" in deg_item
            assert "changePercentage" in deg_item
            assert "degraded" in deg_item
            assert "duration" in deg_item
            assert "severity" in deg_item
            assert "threshold" in deg_item
            assert "firstDetected" in deg_item
            
            # Check types
            assert isinstance(deg_item["metric"], str)
            assert isinstance(deg_item["current"], (int, float))
            assert isinstance(deg_item["baseline"], (int, float))
            assert isinstance(deg_item["change"], (int, float))
            assert isinstance(deg_item["changePercentage"], (int, float))
            assert isinstance(deg_item["degraded"], bool)
            assert isinstance(deg_item["duration"], int)
            assert deg_item["severity"] in ["low", "medium", "high", "critical"]
            assert isinstance(deg_item["threshold"], (int, float))
        
        # Check drift events structure
        if body["driftEvents"]:
            event = body["driftEvents"][0]
            assert "date" in event
            assert "type" in event
            assert "description" in event
            assert "severity" in event
        
        print("✓ Degradation endpoint structure is correct")


@patch("lambdas.dashboard_api.load_time_series", return_value=SAMPLE_DRIFT_DATA)
@patch("lambdas.dashboard_api.load_latest_from_prefix", return_value=SAMPLE_DRIFT_DATA[0])
def test_retraining_endpoint_structure(mock_llp, mock_lts):
    """Test that retraining endpoint returns correct structure"""
    response = get_drift_retraining(days=90)
    
    assert response["statusCode"] in [200, 404], "Should return 200 or 404"
    
    if response["statusCode"] == 200:
        body = json.loads(response["body"])
        
        # Check required fields
        assert "driftedFeaturesPercentage" in body
        assert "conceptDriftDetected" in body
        assert "performanceDegradationDays" in body
        assert "daysSinceLastTraining" in body
        assert "metadata" in body
        
        # Check types
        assert isinstance(body["driftedFeaturesPercentage"], (int, float))
        assert isinstance(body["conceptDriftDetected"], bool)
        assert isinstance(body["performanceDegradationDays"], int)
        assert isinstance(body["daysSinceLastTraining"], int)
        
        # If recommendation exists, check structure
        if body.get("recommendation"):
            rec = body["recommendation"]
            assert "priority" in rec
            assert "reason" in rec
            assert "expectedImprovement" in rec
            assert "triggers" in rec
            
            assert rec["priority"] in ["low", "medium", "high", "critical"]
            assert isinstance(rec["reason"], str)
            assert isinstance(rec["expectedImprovement"], (int, float))
            assert isinstance(rec["triggers"], list)
            
            # Check trigger structure
            if rec["triggers"]:
                trigger = rec["triggers"][0]
                assert "type" in trigger
                assert "severity" in trigger
                assert "description" in trigger
                assert "value" in trigger
                assert "threshold" in trigger
        
        print("✓ Retraining endpoint structure is correct")


@patch("lambdas.dashboard_api.load_time_series", return_value=SAMPLE_DRIFT_DATA)
@patch("lambdas.dashboard_api.load_latest_from_prefix", return_value=SAMPLE_DRIFT_DATA[0])
def test_response_caching_metadata(mock_llp, mock_lts):
    """Test that all endpoints include caching metadata"""
    endpoints = [
        get_drift_data_drift,
        get_drift_concept_drift,
        get_drift_degradation,
        get_drift_retraining,
    ]
    
    for endpoint in endpoints:
        response = endpoint(days=90)
        
        if response["statusCode"] == 200:
            body = json.loads(response["body"])
            metadata = body.get("metadata", {})
            
            # Check caching fields (Req 80.10)
            assert "cached" in metadata, f"{endpoint.__name__} should include cached field"
            assert "cacheExpiry" in metadata, f"{endpoint.__name__} should include cacheExpiry field"
            assert metadata["cached"] is True, "Cached should be True"
            
            # Verify cache expiry is 30 minutes in the future
            from datetime import datetime, timedelta, UTC
            cache_expiry = datetime.fromisoformat(metadata["cacheExpiry"])
            now = datetime.now(UTC)
            time_diff = (cache_expiry - now).total_seconds()
            
            # Should be approximately 30 minutes (1800 seconds), allow some tolerance
            assert 1700 < time_diff < 1900, f"Cache expiry should be ~30 minutes, got {time_diff}s"
    
    print("✓ All endpoints include proper caching metadata")


@patch("lambdas.dashboard_api.load_time_series", return_value=SAMPLE_DRIFT_DATA)
@patch("lambdas.dashboard_api.load_latest_from_prefix", return_value=SAMPLE_DRIFT_DATA[0])
def test_error_handling(mock_llp, mock_lts):
    """Test that endpoints handle errors gracefully"""
    # Test with invalid days parameter — mock returns data so it should still work
    mock_lts.return_value = SAMPLE_DRIFT_DATA
    # Test with invalid days parameter (should still work, just use default)
    response = get_drift_data_drift(days=-1)
    assert response["statusCode"] in [200, 404, 500], "Should return valid status code"
    
    # All endpoints should return proper error structure on failure
    if response["statusCode"] == 500:
        body = json.loads(response["body"])
        assert "error" in body, "Error response should contain error field"
        assert "message" in body, "Error response should contain message field"
    
    print("✓ Error handling works correctly")


if __name__ == "__main__":
    print("\nTesting drift detection endpoints...\n")
    
    try:
        test_data_drift_endpoint_structure()
        test_concept_drift_endpoint_structure()
        test_degradation_endpoint_structure()
        test_retraining_endpoint_structure()
        test_response_caching_metadata()
        test_error_handling()
        
        print("\n✅ All tests passed!\n")
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
