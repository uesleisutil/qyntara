"""
Tests for AI inference module.
"""
import numpy as np
from unittest.mock import patch, MagicMock


def test_heuristic_signals():
    """Test heuristic fallback when models aren't trained."""
    from backend.sagemaker.inference import _heuristic_signals

    markets = [
        {"market_id": "m1", "source": "polymarket", "question": "Test market?",
         "yes_price": 0.3, "volume": 100000, "volume_24h": 50000, "category": "Outros"},
        {"market_id": "m2", "source": "kalshi", "question": "Another market?",
         "yes_price": 0.7, "volume": 200000, "volume_24h": 80000, "category": "Cripto"},
        {"market_id": "m3", "source": "polymarket", "question": "Low volume?",
         "yes_price": 0.5, "volume": 100, "volume_24h": 10, "category": "Outros"},
    ]

    signals = _heuristic_signals(markets)
    # m3 should be filtered out (low volume)
    assert all(s["volume_24h"] > 5000 for s in signals)
    # Should have direction based on price
    for s in signals:
        if s["yes_price"] < 0.4:
            assert s["direction"] == "YES"
        elif s["yes_price"] > 0.6:
            assert s["direction"] == "NO"
    # Should be sorted by score descending
    scores = [s["signal_score"] for s in signals]
    assert scores == sorted(scores, reverse=True)


def test_heuristic_signals_empty():
    from backend.sagemaker.inference import _heuristic_signals
    assert _heuristic_signals([]) == []


@patch("backend.sagemaker.inference.get_edge_estimator")
@patch("backend.sagemaker.inference.get_anomaly_detector")
def test_generate_ai_signals_no_model(mock_detector, mock_estimator):
    """When no model is trained, should fall back to heuristic."""
    mock_estimator.return_value = None
    mock_detector.return_value = None

    from backend.sagemaker.inference import generate_ai_signals

    markets = [
        {"market_id": "m1", "source": "polymarket", "question": "Test?",
         "yes_price": 0.3, "volume": 100000, "volume_24h": 50000, "category": "Outros"},
    ]
    signals = generate_ai_signals(markets)
    # Should return heuristic signals
    assert len(signals) > 0
    assert signals[0]["signal_type"] == "heuristic"


@patch("backend.sagemaker.inference.get_edge_estimator")
@patch("backend.sagemaker.inference.get_anomaly_detector")
@patch("backend.sagemaker.inference.extract_features")
def test_generate_ai_signals_with_model(mock_features, mock_detector, mock_estimator):
    """When model is trained, should return AI-based signals."""
    # Mock estimator
    estimator = MagicMock()
    estimator.predict.return_value = np.array([0.85])  # AI thinks 85%
    mock_estimator.return_value = estimator

    # Mock detector
    detector = MagicMock()
    detector.detect.return_value = (np.array([False]), np.array([0.5]))
    mock_detector.return_value = detector

    # Mock features
    mock_features.return_value = np.zeros(10)

    from backend.sagemaker.inference import generate_ai_signals

    markets = [
        {"market_id": "m1", "source": "polymarket", "question": "Test?",
         "yes_price": 0.3, "volume": 100000, "volume_24h": 50000, "category": "Outros"},
    ]
    signals = generate_ai_signals(markets)
    assert len(signals) > 0
    s = signals[0]
    assert s["signal_type"] == "ai_edge"
    assert s["ai_estimated_price"] == 0.85
    assert s["edge"] > 0  # 0.85 - 0.3 = 0.55
    assert s["direction"] == "YES"
    assert s["is_anomaly"] is False
