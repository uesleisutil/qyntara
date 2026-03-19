"""
Tests for the optimize-from-usage.py script functions.

Covers:
  - Slow endpoint detection
  - Cache performance analysis
  - Lambda memory optimization
  - Cost reduction analysis
  - Report generation
"""

import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta

# Add script to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

# We need to import the module; since it's a .py script, import directly
import importlib.util

spec = importlib.util.spec_from_file_location(
    "optimize_from_usage",
    os.path.join(os.path.dirname(__file__), "..", "scripts", "optimize-from-usage.py"),
)
optimize_mod = importlib.util.module_from_spec(spec)


class TestEndpointRecommendation(unittest.TestCase):
    """Test the _get_endpoint_recommendation helper."""

    def setUp(self):
        # Load module with mocked boto3
        with patch.dict("sys.modules", {"boto3": MagicMock()}):
            spec.loader.exec_module(optimize_mod)

    def test_high_latency_recommendation(self):
        rec = optimize_mod._get_endpoint_recommendation("/api/data", 1500, 500)
        self.assertIn("caching", rec.lower())

    def test_high_traffic_slow_endpoint(self):
        rec = optimize_mod._get_endpoint_recommendation("/api/data", 600, 2000)
        self.assertIn("ElastiCache", rec)

    def test_recommendations_endpoint(self):
        rec = optimize_mod._get_endpoint_recommendation("/api/recommendations", 800, 100)
        self.assertIn("Pre-compute", rec)

    def test_backtest_endpoint(self):
        rec = optimize_mod._get_endpoint_recommendation("/api/backtest", 5000, 10)
        self.assertIn("async", rec.lower())

    def test_normal_endpoint(self):
        rec = optimize_mod._get_endpoint_recommendation("/api/health", 50, 100)
        self.assertEqual(rec, "Monitor and profile")


class TestDetectSlowEndpoints(unittest.TestCase):
    """Test slow endpoint detection."""

    def setUp(self):
        with patch.dict("sys.modules", {"boto3": MagicMock()}):
            spec.loader.exec_module(optimize_mod)

    @patch.object(optimize_mod, "cloudwatch")
    def test_detect_slow_endpoints(self, mock_cw):
        # Mock list_metrics paginator
        mock_paginator = MagicMock()
        mock_cw.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [
            {
                "Metrics": [
                    {"Dimensions": [{"Name": "Endpoint", "Value": "/api/slow"}]},
                    {"Dimensions": [{"Name": "Endpoint", "Value": "/api/fast"}]},
                ]
            }
        ]

        # Mock get_metric_statistics
        def mock_stats(**kwargs):
            endpoint = None
            for dim in kwargs.get("Dimensions", []):
                if dim["Name"] == "Endpoint":
                    endpoint = dim["Value"]

            if endpoint == "/api/slow":
                return {
                    "Datapoints": [
                        {"Average": 1500, "Maximum": 3000, "SampleCount": 100}
                    ]
                }
            else:
                return {
                    "Datapoints": [
                        {"Average": 100, "Maximum": 200, "SampleCount": 500}
                    ]
                }

        mock_cw.get_metric_statistics.side_effect = mock_stats

        result = optimize_mod.detect_slow_endpoints(days=7)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["endpoint"], "/api/slow")
        self.assertEqual(result[0]["severity"], "high")

    @patch.object(optimize_mod, "cloudwatch")
    def test_no_slow_endpoints(self, mock_cw):
        mock_paginator = MagicMock()
        mock_cw.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [
            {
                "Metrics": [
                    {"Dimensions": [{"Name": "Endpoint", "Value": "/api/fast"}]},
                ]
            }
        ]

        mock_cw.get_metric_statistics.return_value = {
            "Datapoints": [{"Average": 50, "Maximum": 100, "SampleCount": 1000}]
        }

        result = optimize_mod.detect_slow_endpoints(days=7)
        self.assertEqual(len(result), 0)


class TestAnalyzeCachePerformance(unittest.TestCase):
    """Test cache performance analysis."""

    def setUp(self):
        with patch.dict("sys.modules", {"boto3": MagicMock()}):
            spec.loader.exec_module(optimize_mod)

    @patch.object(optimize_mod, "cloudwatch")
    @patch.object(optimize_mod, "elasticache")
    def test_no_cache_cluster(self, mock_ec, mock_cw):
        mock_ec.describe_cache_clusters.return_value = {"CacheClusters": []}

        result = optimize_mod.analyze_cache_performance(days=7)

        self.assertFalse(result["cluster_found"])
        self.assertTrue(len(result["recommendations"]) > 0)
        self.assertEqual(result["recommendations"][0]["type"], "no_cache")

    @patch.object(optimize_mod, "cloudwatch")
    @patch.object(optimize_mod, "elasticache")
    def test_low_hit_rate(self, mock_ec, mock_cw):
        mock_ec.describe_cache_clusters.return_value = {
            "CacheClusters": [
                {
                    "CacheClusterId": "b3-dashboard-cache",
                    "CacheNodeType": "cache.t3.micro",
                }
            ]
        }

        def mock_stats(**kwargs):
            metric = kwargs["MetricName"]
            if metric == "CacheHitRate":
                return {"Datapoints": [{"Average": 50.0}]}
            elif metric == "CPUUtilization":
                return {"Datapoints": [{"Average": 20.0, "Maximum": 30.0}]}
            elif metric == "DatabaseMemoryUsagePercentage":
                return {"Datapoints": [{"Average": 40.0, "Maximum": 50.0}]}
            return {"Datapoints": []}

        mock_cw.get_metric_statistics.side_effect = mock_stats

        result = optimize_mod.analyze_cache_performance(days=7)

        self.assertTrue(result["cluster_found"])
        self.assertEqual(result["hit_rate"], 50.0)
        # Should recommend increasing TTLs
        low_hit_recs = [r for r in result["recommendations"] if r["type"] == "low_hit_rate"]
        self.assertTrue(len(low_hit_recs) > 0)


class TestOptimizeLambdaMemory(unittest.TestCase):
    """Test Lambda memory optimization."""

    def setUp(self):
        with patch.dict("sys.modules", {"boto3": MagicMock()}):
            spec.loader.exec_module(optimize_mod)

    @patch.object(optimize_mod, "cloudwatch")
    @patch.object(optimize_mod, "lambda_client")
    def test_over_provisioned_lambda(self, mock_lambda, mock_cw):
        mock_paginator = MagicMock()
        mock_lambda.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [
            {
                "Functions": [
                    {
                        "FunctionName": "B3Dashboard-API",
                        "MemorySize": 2048,
                        "Timeout": 30,
                    }
                ]
            }
        ]

        def mock_stats(**kwargs):
            metric = kwargs["MetricName"]
            if metric == "Duration":
                return {"Datapoints": [{"Average": 100, "Maximum": 200, "SampleCount": 500}]}
            elif metric == "Errors":
                return {"Datapoints": [{"Sum": 0}]}
            elif metric == "Invocations":
                return {"Datapoints": [{"Sum": 500}]}
            return {"Datapoints": []}

        mock_cw.get_metric_statistics.side_effect = mock_stats

        result = optimize_mod.optimize_lambda_memory(days=7)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["function_name"], "B3Dashboard-API")
        self.assertIn("suggested_memory_mb", result[0])
        self.assertLess(result[0]["suggested_memory_mb"], 2048)

    @patch.object(optimize_mod, "cloudwatch")
    @patch.object(optimize_mod, "lambda_client")
    def test_no_optimization_needed(self, mock_lambda, mock_cw):
        mock_paginator = MagicMock()
        mock_lambda.get_paginator.return_value = mock_paginator
        mock_paginator.paginate.return_value = [
            {
                "Functions": [
                    {
                        "FunctionName": "B3Dashboard-API",
                        "MemorySize": 512,
                        "Timeout": 30,
                    }
                ]
            }
        ]

        def mock_stats(**kwargs):
            metric = kwargs["MetricName"]
            if metric == "Duration":
                return {"Datapoints": [{"Average": 500, "Maximum": 1000, "SampleCount": 100}]}
            elif metric == "Errors":
                return {"Datapoints": [{"Sum": 1}]}
            elif metric == "Invocations":
                return {"Datapoints": [{"Sum": 100}]}
            return {"Datapoints": []}

        mock_cw.get_metric_statistics.side_effect = mock_stats

        result = optimize_mod.optimize_lambda_memory(days=7)
        # No recommendations since memory is reasonable for the duration
        self.assertEqual(len(result), 0)


class TestCostReduction(unittest.TestCase):
    """Test cost reduction analysis."""

    def setUp(self):
        with patch.dict("sys.modules", {"boto3": MagicMock()}):
            spec.loader.exec_module(optimize_mod)

    @patch.object(optimize_mod, "ce")
    def test_analyze_costs(self, mock_ce):
        mock_ce.get_cost_and_usage.return_value = {
            "ResultsByTime": [
                {
                    "Groups": [
                        {
                            "Keys": ["AWS Lambda"],
                            "Metrics": {"UnblendedCost": {"Amount": "10.0"}},
                        },
                        {
                            "Keys": ["Amazon Simple Storage Service"],
                            "Metrics": {"UnblendedCost": {"Amount": "5.0"}},
                        },
                    ]
                }
            ]
        }

        result = optimize_mod.analyze_cost_reduction(days=7)

        self.assertAlmostEqual(result["total_cost_usd"], 15.0)
        self.assertIn("AWS Lambda", result["costs_by_service"])
        # Lambda daily avg > $1, should have recommendation
        lambda_recs = [r for r in result["recommendations"] if r["type"] == "lambda_optimization"]
        self.assertTrue(len(lambda_recs) > 0)


if __name__ == "__main__":
    unittest.main()
