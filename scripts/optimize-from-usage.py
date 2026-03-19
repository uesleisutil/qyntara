#!/usr/bin/env python3
"""
B3 Tactical Ranking - Post-Launch Usage-Based Optimizer

Analyzes real production usage patterns and generates actionable optimization
recommendations for:
  - Slow query detection and optimization
  - Cache settings tuning
  - Lambda memory allocation optimization
  - Cost reduction opportunities

Leverages existing lambda_optimizer.py and storage_optimizer.py infrastructure.

Requirements: 18.1-18.8

Usage:
    python scripts/optimize-from-usage.py [--days 7] [--json] [--apply]
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import boto3

# ─── Configuration ────────────────────────────────────────────────────────────

REGION = os.environ.get("AWS_REGION", "us-east-1")
NAMESPACE = "B3Dashboard"
LAMBDA_NAMESPACE = "B3Dashboard/Lambda"
STORAGE_NAMESPACE = "B3Dashboard/Storage"
ACCOUNT_ID = None

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# AWS clients
cloudwatch = boto3.client("cloudwatch", region_name=REGION)
lambda_client = boto3.client("lambda", region_name=REGION)
s3 = boto3.client("s3", region_name=REGION)
elasticache = boto3.client("elasticache", region_name=REGION)
ce = boto3.client("ce", region_name=REGION)


def get_account_id() -> str:
    global ACCOUNT_ID
    if ACCOUNT_ID is None:
        sts = boto3.client("sts", region_name=REGION)
        ACCOUNT_ID = sts.get_caller_identity()["Account"]
    return ACCOUNT_ID


# =============================================================================
# 1. Slow Query / Slow Endpoint Detection (Req 18.1, 18.2)
# =============================================================================


def detect_slow_endpoints(days: int = 7) -> List[Dict[str, Any]]:
    """
    Identify API endpoints with high response times by querying CloudWatch
    metrics for APIResponseTime with Endpoint dimension.
    """
    logger.info("Detecting slow endpoints over the last %d days...", days)
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=days)

    slow_endpoints = []

    try:
        # List all metrics with Endpoint dimension
        paginator = cloudwatch.get_paginator("list_metrics")
        pages = paginator.paginate(
            Namespace=NAMESPACE,
            MetricName="APIResponseTime",
            Dimensions=[{"Name": "Endpoint"}],
        )

        endpoints = set()
        for page in pages:
            for metric in page["Metrics"]:
                for dim in metric["Dimensions"]:
                    if dim["Name"] == "Endpoint":
                        endpoints.add(dim["Value"])

        for endpoint in endpoints:
            stats = cloudwatch.get_metric_statistics(
                Namespace=NAMESPACE,
                MetricName="APIResponseTime",
                Dimensions=[{"Name": "Endpoint", "Value": endpoint}],
                StartTime=start_time,
                EndTime=end_time,
                Period=86400,
                Statistics=["Average", "Maximum", "SampleCount"],
            )

            datapoints = stats.get("Datapoints", [])
            if not datapoints:
                continue

            avg_response = sum(d["Average"] for d in datapoints) / len(datapoints)
            max_response = max(d["Maximum"] for d in datapoints)
            total_calls = sum(d.get("SampleCount", 0) for d in datapoints)

            if avg_response > 500 or max_response > 2000:
                severity = "high" if avg_response > 1000 else "medium"
                slow_endpoints.append({
                    "endpoint": endpoint,
                    "avg_response_ms": round(avg_response, 2),
                    "max_response_ms": round(max_response, 2),
                    "total_calls": int(total_calls),
                    "severity": severity,
                    "recommendation": _get_endpoint_recommendation(endpoint, avg_response, total_calls),
                })

    except Exception as e:
        logger.error("Error detecting slow endpoints: %s", e)

    slow_endpoints.sort(key=lambda x: x["avg_response_ms"], reverse=True)
    logger.info("Found %d slow endpoints", len(slow_endpoints))
    return slow_endpoints


def _get_endpoint_recommendation(endpoint: str, avg_ms: float, calls: int) -> str:
    """Generate a specific recommendation for a slow endpoint."""
    recommendations = []
    if avg_ms > 1000:
        recommendations.append("Consider adding response caching (TTL 60-300s)")
    if calls > 1000 and avg_ms > 500:
        recommendations.append("High-traffic slow endpoint: add ElastiCache layer")
    if "recommendations" in endpoint.lower():
        recommendations.append("Pre-compute recommendations during off-peak hours")
    if "backtest" in endpoint.lower():
        recommendations.append("Move to async processing with status polling")
    return "; ".join(recommendations) if recommendations else "Monitor and profile"


# =============================================================================
# 2. Cache Settings Optimization (Req 18.4)
# =============================================================================


def analyze_cache_performance(days: int = 7) -> Dict[str, Any]:
    """
    Analyze ElastiCache performance and recommend TTL adjustments.
    """
    logger.info("Analyzing cache performance...")
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=days)

    cache_analysis = {
        "cluster_found": False,
        "hit_rate": None,
        "cpu_avg": None,
        "memory_avg": None,
        "recommendations": [],
    }

    try:
        # Find B3 cache cluster
        clusters = elasticache.describe_cache_clusters(ShowCacheNodeInfo=True)
        b3_cluster = None
        for cluster in clusters.get("CacheClusters", []):
            if "b3" in cluster["CacheClusterId"].lower():
                b3_cluster = cluster
                break

        if not b3_cluster:
            cache_analysis["recommendations"].append({
                "type": "no_cache",
                "message": "No ElastiCache cluster found. Consider adding Redis cache.",
                "estimated_savings": "20-40% reduction in API response times",
                "priority": "high",
            })
            return cache_analysis

        cluster_id = b3_cluster["CacheClusterId"]
        cache_analysis["cluster_found"] = True
        cache_analysis["cluster_id"] = cluster_id
        cache_analysis["node_type"] = b3_cluster.get("CacheNodeType", "unknown")

        # Get cache hit rate
        hit_rate_stats = cloudwatch.get_metric_statistics(
            Namespace="AWS/ElastiCache",
            MetricName="CacheHitRate",
            Dimensions=[{"Name": "CacheClusterId", "Value": cluster_id}],
            StartTime=start_time,
            EndTime=end_time,
            Period=86400,
            Statistics=["Average"],
        )
        if hit_rate_stats["Datapoints"]:
            cache_analysis["hit_rate"] = round(
                sum(d["Average"] for d in hit_rate_stats["Datapoints"])
                / len(hit_rate_stats["Datapoints"]),
                2,
            )

        # Get CPU utilization
        cpu_stats = cloudwatch.get_metric_statistics(
            Namespace="AWS/ElastiCache",
            MetricName="CPUUtilization",
            Dimensions=[{"Name": "CacheClusterId", "Value": cluster_id}],
            StartTime=start_time,
            EndTime=end_time,
            Period=86400,
            Statistics=["Average", "Maximum"],
        )
        if cpu_stats["Datapoints"]:
            cache_analysis["cpu_avg"] = round(
                sum(d["Average"] for d in cpu_stats["Datapoints"])
                / len(cpu_stats["Datapoints"]),
                2,
            )

        # Get memory usage
        mem_stats = cloudwatch.get_metric_statistics(
            Namespace="AWS/ElastiCache",
            MetricName="DatabaseMemoryUsagePercentage",
            Dimensions=[{"Name": "CacheClusterId", "Value": cluster_id}],
            StartTime=start_time,
            EndTime=end_time,
            Period=86400,
            Statistics=["Average", "Maximum"],
        )
        if mem_stats["Datapoints"]:
            cache_analysis["memory_avg"] = round(
                sum(d["Average"] for d in mem_stats["Datapoints"])
                / len(mem_stats["Datapoints"]),
                2,
            )

        # Generate recommendations
        hit_rate = cache_analysis["hit_rate"]
        if hit_rate is not None and hit_rate < 70:
            cache_analysis["recommendations"].append({
                "type": "low_hit_rate",
                "message": f"Cache hit rate is {hit_rate}% (target: >80%). "
                           "Increase TTLs for frequently accessed data.",
                "action": "Increase short TTL from 60s to 120s, medium from 300s to 600s",
                "priority": "high",
            })
        elif hit_rate is not None and hit_rate > 95:
            cache_analysis["recommendations"].append({
                "type": "high_hit_rate",
                "message": f"Cache hit rate is {hit_rate}%. TTLs may be too long, "
                           "risking stale data.",
                "action": "Review if data freshness requirements are met",
                "priority": "low",
            })

        cpu_avg = cache_analysis["cpu_avg"]
        if cpu_avg is not None and cpu_avg > 75:
            cache_analysis["recommendations"].append({
                "type": "high_cpu",
                "message": f"Cache CPU at {cpu_avg}%. Consider upgrading node type.",
                "action": f"Upgrade from {b3_cluster.get('CacheNodeType')} to next tier",
                "priority": "high",
            })
        elif cpu_avg is not None and cpu_avg < 10:
            cache_analysis["recommendations"].append({
                "type": "low_cpu",
                "message": f"Cache CPU at {cpu_avg}%. Node may be over-provisioned.",
                "action": "Consider downgrading node type to save costs",
                "estimated_savings": "~30% on ElastiCache costs",
                "priority": "medium",
            })

        mem_avg = cache_analysis["memory_avg"]
        if mem_avg is not None and mem_avg > 80:
            cache_analysis["recommendations"].append({
                "type": "high_memory",
                "message": f"Cache memory at {mem_avg}%. Risk of evictions.",
                "action": "Reduce TTLs or upgrade node type",
                "priority": "high",
            })

    except Exception as e:
        logger.error("Error analyzing cache: %s", e)
        cache_analysis["error"] = str(e)

    return cache_analysis


# =============================================================================
# 3. Lambda Memory Optimization (Req 18.2, 18.7)
# =============================================================================


def optimize_lambda_memory(days: int = 7) -> List[Dict[str, Any]]:
    """
    Analyze Lambda function performance and recommend memory adjustments.
    Uses duration and memory metrics to find over/under-provisioned functions.
    """
    logger.info("Analyzing Lambda memory allocation...")
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=days)

    recommendations = []

    try:
        # List B3 Lambda functions
        paginator = lambda_client.get_paginator("list_functions")
        b3_functions = []
        for page in paginator.paginate():
            for func in page["Functions"]:
                name = func["FunctionName"]
                if "B3" in name or "b3" in name:
                    b3_functions.append(func)

        for func in b3_functions:
            name = func["FunctionName"]
            current_memory = func["MemorySize"]
            timeout = func.get("Timeout", 30)

            # Get duration stats
            duration_stats = cloudwatch.get_metric_statistics(
                Namespace="AWS/Lambda",
                MetricName="Duration",
                Dimensions=[{"Name": "FunctionName", "Value": name}],
                StartTime=start_time,
                EndTime=end_time,
                Period=86400,
                Statistics=["Average", "Maximum", "SampleCount"],
            )

            # Get error stats
            error_stats = cloudwatch.get_metric_statistics(
                Namespace="AWS/Lambda",
                MetricName="Errors",
                Dimensions=[{"Name": "FunctionName", "Value": name}],
                StartTime=start_time,
                EndTime=end_time,
                Period=86400 * days,
                Statistics=["Sum"],
            )

            # Get invocation count
            invocation_stats = cloudwatch.get_metric_statistics(
                Namespace="AWS/Lambda",
                MetricName="Invocations",
                Dimensions=[{"Name": "FunctionName", "Value": name}],
                StartTime=start_time,
                EndTime=end_time,
                Period=86400 * days,
                Statistics=["Sum"],
            )

            dp = duration_stats.get("Datapoints", [])
            if not dp:
                continue

            avg_duration = sum(d["Average"] for d in dp) / len(dp)
            max_duration = max(d["Maximum"] for d in dp)
            total_invocations = sum(
                d.get("Sum", 0) for d in invocation_stats.get("Datapoints", [])
            )
            total_errors = sum(
                d.get("Sum", 0) for d in error_stats.get("Datapoints", [])
            )

            rec = {
                "function_name": name,
                "current_memory_mb": current_memory,
                "avg_duration_ms": round(avg_duration, 2),
                "max_duration_ms": round(max_duration, 2),
                "total_invocations": int(total_invocations),
                "total_errors": int(total_errors),
                "timeout_s": timeout,
                "recommendations": [],
            }

            # Memory optimization logic
            # If avg duration is very low and memory is high, suggest reducing
            if avg_duration < 200 and current_memory > 512:
                suggested = max(256, current_memory // 2)
                rec["suggested_memory_mb"] = suggested
                rec["recommendations"].append(
                    f"Reduce memory from {current_memory}MB to {suggested}MB. "
                    f"Avg duration is only {avg_duration:.0f}ms."
                )
                # Estimate savings
                cost_reduction_pct = round((1 - suggested / current_memory) * 100, 1)
                rec["estimated_cost_reduction_pct"] = cost_reduction_pct

            # If max duration is close to timeout, suggest increasing memory
            elif max_duration > timeout * 1000 * 0.8:
                suggested = min(3008, current_memory * 2)
                rec["suggested_memory_mb"] = suggested
                rec["recommendations"].append(
                    f"Increase memory from {current_memory}MB to {suggested}MB. "
                    f"Max duration ({max_duration:.0f}ms) is near timeout ({timeout}s)."
                )

            # If high error rate, flag it
            if total_invocations > 0 and total_errors / total_invocations > 0.05:
                error_rate = round(total_errors / total_invocations * 100, 2)
                rec["recommendations"].append(
                    f"High error rate: {error_rate}%. Investigate error logs."
                )

            if rec["recommendations"]:
                recommendations.append(rec)

    except Exception as e:
        logger.error("Error analyzing Lambda functions: %s", e)

    logger.info("Generated %d Lambda optimization recommendations", len(recommendations))
    return recommendations


# =============================================================================
# 4. Cost Reduction Analysis (Req 18.3, 18.5, 18.6, 18.8)
# =============================================================================


def analyze_cost_reduction(days: int = 7) -> Dict[str, Any]:
    """
    Analyze AWS costs and identify reduction opportunities.
    """
    logger.info("Analyzing cost reduction opportunities...")
    end_time = datetime.now(timezone.utc)
    start_date = (end_time - timedelta(days=days)).strftime("%Y-%m-%d")
    end_date = end_time.strftime("%Y-%m-%d")

    cost_analysis = {
        "period": {"start": start_date, "end": end_date, "days": days},
        "costs_by_service": {},
        "total_cost_usd": 0,
        "recommendations": [],
    }

    try:
        response = ce.get_cost_and_usage(
            TimePeriod={"Start": start_date, "End": end_date},
            Granularity="DAILY",
            Metrics=["UnblendedCost"],
            GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
        )

        for result in response.get("ResultsByTime", []):
            for group in result.get("Groups", []):
                service = group["Keys"][0]
                cost = float(group["Metrics"]["UnblendedCost"]["Amount"])
                cost_analysis["costs_by_service"][service] = (
                    cost_analysis["costs_by_service"].get(service, 0) + cost
                )
                cost_analysis["total_cost_usd"] += cost

        cost_analysis["total_cost_usd"] = round(cost_analysis["total_cost_usd"], 2)

        # Generate recommendations based on cost breakdown
        for service, cost in cost_analysis["costs_by_service"].items():
            daily_avg = cost / days

            if "Lambda" in service and daily_avg > 1.0:
                cost_analysis["recommendations"].append({
                    "service": service,
                    "daily_avg_usd": round(daily_avg, 4),
                    "type": "lambda_optimization",
                    "message": "Review Lambda memory allocation and execution time. "
                               "Use AWS Lambda Power Tuning to find optimal settings.",
                    "priority": "medium",
                })

            if "S3" in service or "Storage" in service:
                if daily_avg > 0.5:
                    cost_analysis["recommendations"].append({
                        "service": service,
                        "daily_avg_usd": round(daily_avg, 4),
                        "type": "storage_optimization",
                        "message": "Review S3 lifecycle policies. Ensure old data transitions "
                                   "to IA/Glacier. Enable compression for new uploads.",
                        "priority": "medium",
                    })

            if "CloudWatch" in service and daily_avg > 0.5:
                cost_analysis["recommendations"].append({
                    "service": service,
                    "daily_avg_usd": round(daily_avg, 4),
                    "type": "monitoring_optimization",
                    "message": "Review CloudWatch log retention periods. "
                               "Set retention to 7-30 days for non-critical logs.",
                    "priority": "low",
                })

            if "SageMaker" in service and daily_avg > 5.0:
                cost_analysis["recommendations"].append({
                    "service": service,
                    "daily_avg_usd": round(daily_avg, 4),
                    "type": "sagemaker_optimization",
                    "message": "Review SageMaker endpoint usage. Delete unused endpoints. "
                               "Consider Serverless Inference for low-traffic models.",
                    "priority": "high",
                })

    except Exception as e:
        logger.error("Error analyzing costs: %s", e)
        cost_analysis["error"] = str(e)

    return cost_analysis


# =============================================================================
# Main Report Generator
# =============================================================================


def generate_optimization_report(days: int = 7) -> Dict[str, Any]:
    """Generate a comprehensive optimization report."""
    logger.info("=" * 60)
    logger.info("B3 Tactical Ranking - Usage-Based Optimization Report")
    logger.info("=" * 60)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "analysis_period_days": days,
        "slow_endpoints": detect_slow_endpoints(days),
        "cache_analysis": analyze_cache_performance(days),
        "lambda_optimization": optimize_lambda_memory(days),
        "cost_reduction": analyze_cost_reduction(days),
    }

    # Aggregate all recommendations with priorities
    all_recommendations = []

    for ep in report["slow_endpoints"]:
        all_recommendations.append({
            "category": "slow_endpoint",
            "target": ep["endpoint"],
            "priority": ep["severity"],
            "recommendation": ep["recommendation"],
        })

    for rec in report["cache_analysis"].get("recommendations", []):
        all_recommendations.append({
            "category": "cache",
            "target": report["cache_analysis"].get("cluster_id", "N/A"),
            "priority": rec["priority"],
            "recommendation": rec["message"],
        })

    for func_rec in report["lambda_optimization"]:
        for rec_text in func_rec["recommendations"]:
            all_recommendations.append({
                "category": "lambda",
                "target": func_rec["function_name"],
                "priority": "medium",
                "recommendation": rec_text,
            })

    for rec in report["cost_reduction"].get("recommendations", []):
        all_recommendations.append({
            "category": "cost",
            "target": rec["service"],
            "priority": rec["priority"],
            "recommendation": rec["message"],
        })

    # Sort by priority
    priority_order = {"high": 0, "medium": 1, "low": 2}
    all_recommendations.sort(key=lambda x: priority_order.get(x["priority"], 3))

    report["summary"] = {
        "total_recommendations": len(all_recommendations),
        "high_priority": sum(1 for r in all_recommendations if r["priority"] == "high"),
        "medium_priority": sum(1 for r in all_recommendations if r["priority"] == "medium"),
        "low_priority": sum(1 for r in all_recommendations if r["priority"] == "low"),
        "slow_endpoints_count": len(report["slow_endpoints"]),
        "lambda_functions_to_optimize": len(report["lambda_optimization"]),
        "total_cost_usd": report["cost_reduction"].get("total_cost_usd", 0),
    }

    report["all_recommendations"] = all_recommendations

    return report


def print_report(report: Dict[str, Any]) -> None:
    """Print a human-readable report to stdout."""
    print("\n" + "=" * 70)
    print("  B3 Tactical Ranking - Usage-Based Optimization Report")
    print("=" * 70)
    print(f"  Generated: {report['generated_at']}")
    print(f"  Period:    Last {report['analysis_period_days']} days")
    print()

    summary = report["summary"]
    print("  SUMMARY")
    print("  " + "-" * 40)
    print(f"  Total Recommendations:  {summary['total_recommendations']}")
    print(f"    High Priority:        {summary['high_priority']}")
    print(f"    Medium Priority:      {summary['medium_priority']}")
    print(f"    Low Priority:         {summary['low_priority']}")
    print(f"  Slow Endpoints:         {summary['slow_endpoints_count']}")
    print(f"  Lambda to Optimize:     {summary['lambda_functions_to_optimize']}")
    print(f"  Total Cost ({report['analysis_period_days']}d):       ${summary['total_cost_usd']:.2f}")
    print()

    # Slow endpoints
    if report["slow_endpoints"]:
        print("  SLOW ENDPOINTS")
        print("  " + "-" * 40)
        for ep in report["slow_endpoints"]:
            print(f"  [{ep['severity'].upper()}] {ep['endpoint']}")
            print(f"    Avg: {ep['avg_response_ms']}ms | Max: {ep['max_response_ms']}ms | Calls: {ep['total_calls']}")
            print(f"    → {ep['recommendation']}")
        print()

    # Cache
    cache = report["cache_analysis"]
    print("  CACHE ANALYSIS")
    print("  " + "-" * 40)
    if cache.get("cluster_found"):
        print(f"  Cluster: {cache.get('cluster_id')} ({cache.get('node_type')})")
        print(f"  Hit Rate: {cache.get('hit_rate', 'N/A')}%")
        print(f"  CPU Avg:  {cache.get('cpu_avg', 'N/A')}%")
        print(f"  Memory:   {cache.get('memory_avg', 'N/A')}%")
    else:
        print("  No cache cluster found")
    for rec in cache.get("recommendations", []):
        print(f"  [{rec['priority'].upper()}] {rec['message']}")
    print()

    # Lambda
    if report["lambda_optimization"]:
        print("  LAMBDA OPTIMIZATION")
        print("  " + "-" * 40)
        for func in report["lambda_optimization"]:
            print(f"  {func['function_name']}")
            print(f"    Memory: {func['current_memory_mb']}MB → {func.get('suggested_memory_mb', 'N/A')}MB")
            print(f"    Avg Duration: {func['avg_duration_ms']}ms | Invocations: {func['total_invocations']}")
            for rec in func["recommendations"]:
                print(f"    → {rec}")
        print()

    # Cost
    cost = report["cost_reduction"]
    print("  COST REDUCTION")
    print("  " + "-" * 40)
    print(f"  Total Cost ({report['analysis_period_days']}d): ${cost.get('total_cost_usd', 0):.2f}")
    for rec in cost.get("recommendations", []):
        print(f"  [{rec['priority'].upper()}] {rec['service']}: ${rec['daily_avg_usd']:.4f}/day")
        print(f"    → {rec['message']}")
    print()

    print("=" * 70)


def save_report_to_s3(report: Dict[str, Any], bucket: str) -> Optional[str]:
    """Save the optimization report to S3."""
    try:
        today = datetime.now(timezone.utc).date().isoformat()
        key = f"monitoring/optimization_reports/dt={today}/report.json"
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(report, indent=2, default=str),
            ContentType="application/json",
        )
        logger.info("Report saved to s3://%s/%s", bucket, key)
        return key
    except Exception as e:
        logger.error("Failed to save report to S3: %s", e)
        return None


def main():
    parser = argparse.ArgumentParser(
        description="B3 Tactical Ranking - Usage-Based Optimizer"
    )
    parser.add_argument("--days", type=int, default=7, help="Analysis period in days")
    parser.add_argument("--json", action="store_true", help="Output JSON to stdout")
    parser.add_argument("--save-s3", action="store_true", help="Save report to S3")
    args = parser.parse_args()

    report = generate_optimization_report(args.days)

    if args.json:
        print(json.dumps(report, indent=2, default=str))
    else:
        print_report(report)

    if args.save_s3:
        account_id = get_account_id()
        bucket = os.environ.get("BUCKET", f"b3tr-{account_id}-{REGION}")
        save_report_to_s3(report, bucket)


if __name__ == "__main__":
    main()
