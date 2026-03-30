"""
Tests for core API endpoints.
Uses FastAPI TestClient — no external services needed.
"""
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Create test client with mocked external dependencies."""
    with patch("backend.api._ensure_init"):
        with patch("backend.api.poly_client"):
            with patch("backend.api.kalshi_client"):
                with patch("backend.api.news_client"):
                    from backend.api import app, _cache
                    _cache["markets"] = [
                        {
                            "market_id": "test-1", "source": "polymarket",
                            "question": "Will it rain tomorrow?",
                            "yes_price": 0.65, "no_price": 0.35,
                            "volume": 100000, "volume_24h": 5000,
                            "category": "Clima", "end_date": "2026-12-31",
                            "liquidity": 50000,
                        },
                        {
                            "market_id": "test-2", "source": "kalshi",
                            "question": "Bitcoin above 100k?",
                            "yes_price": 0.42, "no_price": 0.58,
                            "volume": 500000, "volume_24h": 25000,
                            "category": "Cripto", "end_date": "2026-06-30",
                            "liquidity": 200000,
                        },
                    ]
                    _cache["signals"] = [
                        {
                            "market_id": "test-1", "source": "polymarket",
                            "question": "Will it rain tomorrow?",
                            "yes_price": 0.65, "ai_estimated_price": 0.78,
                            "edge": 0.13, "volume_24h": 5000,
                            "signal_score": 0.26, "signal_type": "ai_edge",
                            "direction": "YES", "is_anomaly": False,
                            "anomaly_score": 0.5, "category": "Clima",
                        },
                    ]
                    _cache["arbitrage"] = []
                    _cache["stats"] = {
                        "total_markets": 2, "polymarket": 1,
                        "kalshi": 1, "volume_24h": 30000,
                    }
                    yield TestClient(app)


# ── Public endpoints ──

def test_stats(client):
    res = client.get("/stats")
    assert res.status_code == 200
    data = res.json()
    assert data["total_markets"] == 2
    assert data["polymarket"] == 1
    assert data["kalshi"] == 1


def test_list_markets(client):
    res = client.get("/markets?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert len(data["markets"]) == 2
    assert data["total"] == 2


def test_list_markets_filter_source(client):
    res = client.get("/markets?source=polymarket")
    assert res.status_code == 200
    data = res.json()
    assert all(m["source"] == "polymarket" for m in data["markets"])


def test_list_markets_filter_category(client):
    res = client.get("/markets?category=Cripto")
    assert res.status_code == 200
    data = res.json()
    assert all("Cripto" in m.get("category", "") for m in data["markets"])


def test_list_markets_search(client):
    res = client.get("/markets?search=bitcoin")
    assert res.status_code == 200
    data = res.json()
    assert len(data["markets"]) == 1
    assert "Bitcoin" in data["markets"][0]["question"]


def test_get_market_detail(client):
    res = client.get("/markets/test-1")
    assert res.status_code == 200
    data = res.json()
    assert data["market_id"] == "test-1"
    assert data["yes_price"] == 0.65


def test_get_market_not_found(client):
    res = client.get("/markets/nonexistent")
    assert res.status_code == 404


def test_signals_preview_no_auth(client):
    res = client.get("/signals/preview")
    assert res.status_code == 200
    data = res.json()
    assert "signals" in data
    assert data["total_available"] >= 0
    # Preview should not include score/edge
    for s in data["signals"]:
        assert "signal_score" not in s
        assert "edge" not in s


def test_signals_requires_auth(client):
    res = client.get("/signals")
    assert res.status_code in (401, 403, 422)


def test_arbitrage_requires_auth(client):
    res = client.get("/arbitrage")
    assert res.status_code in (401, 403, 422)


# ── Auth endpoints ──

def test_register_missing_fields(client):
    res = client.post("/auth/register", json={})
    assert res.status_code == 422


def test_login_missing_fields(client):
    res = client.post("/auth/login", json={})
    assert res.status_code == 422


# ── Helpers ──

def test_categorize_market():
    from backend.api import _categorize_market
    assert _categorize_market("Will Trump win the election?") == "Política"
    assert _categorize_market("Bitcoin price above 100k?") == "Cripto"
    assert _categorize_market("Will the NFL season start?") == "Esportes"
    assert _categorize_market("Fed rate cut in June?") == "Economia"
    assert _categorize_market("OpenAI releases GPT-5?") == "Tecnologia"
    assert _categorize_market("Random question about nothing") == "Outros"


def test_find_arbitrage_empty():
    from backend.api import _find_arbitrage
    result = _find_arbitrage([])
    assert result == []


def test_find_arbitrage_no_match():
    from backend.api import _find_arbitrage
    markets = [
        {"market_id": "a", "source": "polymarket", "question": "Apples?", "yes_price": 0.5},
        {"market_id": "b", "source": "kalshi", "question": "Oranges?", "yes_price": 0.5},
    ]
    result = _find_arbitrage(markets)
    assert len(result) == 0


def test_generate_signals():
    from backend.api import _generate_signals
    markets = [
        {"market_id": "m1", "source": "polymarket", "question": "Test?",
         "yes_price": 0.3, "volume": 100000, "volume_24h": 50000, "category": "Outros"},
    ]
    signals = _generate_signals(markets)
    assert len(signals) > 0
    assert signals[0]["direction"] == "YES"  # yes_price < 0.4
    assert signals[0]["signal_score"] > 0
