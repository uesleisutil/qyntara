"""
Operational Reports Generator

Generates weekly operational reports with system metrics and insights.

Requirements: 83.12
"""

import json
import logging
import os
from datetime import datetime, UTC, timedelta
from typing import Dict, List, Optional

import boto3

from observability_service import observability, track_performance

# Initialize AWS clients
s3 = boto3.client("s3")
cloudwatch = boto3.client("cloudwatch")
ses = boto3.client("ses")

# Environment variables
BUCKET = os.environ.get("BUCKET", "")
REPORT_EMAIL = os.environ.get("REPORT_EMAIL", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@b3dashboard.com")

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def get_cloudwatch_metrics(metric_name: str, days: int = 7) -> List[Dict]:
    """
    Get CloudWatch metrics for the specified period.
    
    Args:
        metric_name: Name of the metric
        days: Number of days to look back
        
    Returns:
        List of metric data points
    """
    try:
        end_time = datetime.now(UTC)
        start_time = end_time - timedelta(days=days)
        
        response = cloudwatch.get_metric_statistics(
            Namespace="B3Dashboard",
            MetricName=metric_name,
            StartTime=start_time,
            EndTime=end_time,
            Period=86400,  # 1 day
            Statistics=["Sum", "Average", "Maximum", "Minimum"]
        )
        
        return response.get("Datapoints", [])
        
    except Exception as e:
        logger.error(f"Error getting CloudWatch metrics for {metric_name}: {e}")
        return []


def calculate_metric_summary(datapoints: List[Dict]) -> Dict:
    """
    Calculate summary statistics for metric datapoints.
    
    Args:
        datapoints: List of CloudWatch datapoints
        
    Returns:
        Summary statistics
    """
    if not datapoints:
        return {
            "total": 0,
            "average": 0,
            "maximum": 0,
            "minimum": 0,
            "trend": "stable"
        }
    
    # Sort by timestamp
    sorted_points = sorted(datapoints, key=lambda x: x["Timestamp"])
    
    # Calculate statistics
    sums = [p.get("Sum", 0) for p in sorted_points]
    averages = [p.get("Average", 0) for p in sorted_points]
    
    total = sum(sums)
    avg = sum(averages) / len(averages) if averages else 0
    maximum = max([p.get("Maximum", 0) for p in sorted_points])
    minimum = min([p.get("Minimum", 0) for p in sorted_points])
    
    # Calculate trend (simple: compare first half vs second half)
    if len(averages) >= 2:
        mid = len(averages) // 2
        first_half_avg = sum(averages[:mid]) / mid
        second_half_avg = sum(averages[mid:]) / (len(averages) - mid)
        
        if second_half_avg > first_half_avg * 1.1:
            trend = "increasing"
        elif second_half_avg < first_half_avg * 0.9:
            trend = "decreasing"
        else:
            trend = "stable"
    else:
        trend = "insufficient_data"
    
    return {
        "total": total,
        "average": avg,
        "maximum": maximum,
        "minimum": minimum,
        "trend": trend
    }


def generate_report_data(days: int = 7) -> Dict:
    """
    Generate operational report data.
    
    Implements Req 83.12: Generate weekly operational reports
    
    Args:
        days: Number of days to include in report
        
    Returns:
        Report data dictionary
    """
    report = {
        "period": {
            "start": (datetime.now(UTC) - timedelta(days=days)).isoformat(),
            "end": datetime.now(UTC).isoformat(),
            "days": days
        },
        "metrics": {}
    }
    
    # Key metrics to include in report
    metrics_to_track = [
        ("ActiveUsers", "Active Users"),
        ("APICallsTotal", "API Calls"),
        ("ErrorsTotal", "Errors"),
        ("APIResponseTime", "API Response Time (ms)"),
        ("PageLoadTime", "Page Load Time (ms)"),
        ("TimeToInteractive", "Time to Interactive (ms)"),
        ("RecommendationsGenerated", "Recommendations Generated"),
        ("PredictionsMade", "Predictions Made"),
        ("ModelMAPE", "Model MAPE (%)"),
        ("DirectionalAccuracy", "Directional Accuracy (%)"),
        ("SharpeRatio", "Sharpe Ratio"),
        ("HitRate", "Hit Rate (%)"),
        ("HealthCheckStatus", "Health Check Status")
    ]
    
    for metric_name, display_name in metrics_to_track:
        datapoints = get_cloudwatch_metrics(metric_name, days)
        summary = calculate_metric_summary(datapoints)
        report["metrics"][display_name] = summary
    
    # Add insights
    report["insights"] = generate_insights(report["metrics"])
    
    # Add recommendations
    report["recommendations"] = generate_recommendations(report["metrics"])
    
    return report


def generate_insights(metrics: Dict) -> List[str]:
    """
    Generate insights from metrics.
    
    Args:
        metrics: Dictionary of metric summaries
        
    Returns:
        List of insight strings
    """
    insights = []
    
    # Check error rate
    errors = metrics.get("Errors", {}).get("total", 0)
    api_calls = metrics.get("API Calls", {}).get("total", 1)
    error_rate = (errors / api_calls * 100) if api_calls > 0 else 0
    
    if error_rate > 5:
        insights.append(f"⚠️ High error rate detected: {error_rate:.2f}% of API calls resulted in errors")
    elif error_rate < 1:
        insights.append(f"✅ Excellent error rate: {error_rate:.2f}%")
    
    # Check performance
    response_time = metrics.get("API Response Time (ms)", {})
    if response_time.get("average", 0) > 1000:
        insights.append(f"⚠️ API response time is high: {response_time['average']:.0f}ms average")
    elif response_time.get("average", 0) < 200:
        insights.append(f"✅ Excellent API response time: {response_time['average']:.0f}ms average")
    
    # Check model performance
    mape = metrics.get("Model MAPE (%)", {})
    if mape.get("trend") == "increasing":
        insights.append("⚠️ Model MAPE is increasing - consider retraining")
    elif mape.get("average", 0) < 5:
        insights.append(f"✅ Excellent model accuracy: {mape['average']:.2f}% MAPE")
    
    # Check user activity
    active_users = metrics.get("Active Users", {})
    if active_users.get("trend") == "increasing":
        insights.append(f"📈 User activity is growing: {active_users['trend']}")
    elif active_users.get("trend") == "decreasing":
        insights.append(f"📉 User activity is declining: {active_users['trend']}")
    
    return insights


def generate_recommendations(metrics: Dict) -> List[str]:
    """
    Generate recommendations based on metrics.
    
    Args:
        metrics: Dictionary of metric summaries
        
    Returns:
        List of recommendation strings
    """
    recommendations = []
    
    # Performance recommendations
    response_time = metrics.get("API Response Time (ms)", {})
    if response_time.get("average", 0) > 500:
        recommendations.append("Consider implementing caching to improve API response times")
    
    page_load = metrics.get("Page Load Time (ms)", {})
    if page_load.get("average", 0) > 3000:
        recommendations.append("Optimize frontend bundle size and implement code splitting")
    
    # Model recommendations
    mape = metrics.get("Model MAPE (%)", {})
    if mape.get("average", 0) > 10:
        recommendations.append("Model accuracy is below target - schedule retraining")
    
    # Error handling recommendations
    errors = metrics.get("Errors", {})
    if errors.get("total", 0) > 100:
        recommendations.append("Investigate and address recurring errors")
    
    # Capacity recommendations
    api_calls = metrics.get("API Calls", {})
    if api_calls.get("trend") == "increasing":
        recommendations.append("Monitor capacity - API usage is growing")
    
    return recommendations


def format_report_html(report_data: Dict) -> str:
    """
    Format report data as HTML email.
    
    Args:
        report_data: Report data dictionary
        
    Returns:
        HTML string
    """
    html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            h1 {{ color: #2c3e50; }}
            h2 {{ color: #34495e; margin-top: 30px; }}
            table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
            th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
            th {{ background-color: #3498db; color: white; }}
            tr:nth-child(even) {{ background-color: #f2f2f2; }}
            .insight {{ background-color: #e8f4f8; padding: 10px; margin: 10px 0; border-left: 4px solid #3498db; }}
            .recommendation {{ background-color: #fff3cd; padding: 10px; margin: 10px 0; border-left: 4px solid #ffc107; }}
            .trend-increasing {{ color: #27ae60; }}
            .trend-decreasing {{ color: #e74c3c; }}
            .trend-stable {{ color: #95a5a6; }}
        </style>
    </head>
    <body>
        <h1>B3 Dashboard - Weekly Operational Report</h1>
        <p><strong>Period:</strong> {report_data['period']['start'][:10]} to {report_data['period']['end'][:10]} ({report_data['period']['days']} days)</p>
        
        <h2>Key Metrics</h2>
        <table>
            <tr>
                <th>Metric</th>
                <th>Total</th>
                <th>Average</th>
                <th>Maximum</th>
                <th>Minimum</th>
                <th>Trend</th>
            </tr>
    """
    
    for metric_name, data in report_data["metrics"].items():
        trend_class = f"trend-{data['trend']}"
        html += f"""
            <tr>
                <td>{metric_name}</td>
                <td>{data['total']:.2f}</td>
                <td>{data['average']:.2f}</td>
                <td>{data['maximum']:.2f}</td>
                <td>{data['minimum']:.2f}</td>
                <td class="{trend_class}">{data['trend']}</td>
            </tr>
        """
    
    html += """
        </table>
        
        <h2>Insights</h2>
    """
    
    for insight in report_data["insights"]:
        html += f'<div class="insight">{insight}</div>'
    
    html += """
        <h2>Recommendations</h2>
    """
    
    for recommendation in report_data["recommendations"]:
        html += f'<div class="recommendation">{recommendation}</div>'
    
    html += """
        <hr>
        <p><small>This is an automated report generated by the B3 Dashboard monitoring system.</small></p>
    </body>
    </html>
    """
    
    return html


@track_performance("generate_operational_report")
def handler(event, context):
    """
    Generate and send weekly operational report.
    
    Implements Req 83.12: Generate weekly operational reports
    """
    try:
        # Get report period from event or default to 7 days
        days = event.get("days", 7)
        
        logger.info(f"Generating operational report for {days} days")
        
        # Generate report data
        report_data = generate_report_data(days)
        
        # Save report to S3
        timestamp = datetime.now(UTC)
        report_key = f"reports/operational/dt={timestamp.date().isoformat()}/report_{timestamp.strftime('%H%M%S')}.json"
        
        s3.put_object(
            Bucket=BUCKET,
            Key=report_key,
            Body=json.dumps(report_data, indent=2).encode("utf-8"),
            ContentType="application/json"
        )
        
        logger.info(f"Saved report to {report_key}")
        
        # Send email report if configured
        if REPORT_EMAIL:
            html_report = format_report_html(report_data)
            
            try:
                ses.send_email(
                    Source=FROM_EMAIL,
                    Destination={"ToAddresses": [REPORT_EMAIL]},
                    Message={
                        "Subject": {
                            "Data": f"B3 Dashboard - Weekly Operational Report ({timestamp.date().isoformat()})"
                        },
                        "Body": {
                            "Html": {"Data": html_report}
                        }
                    }
                )
                logger.info(f"Sent email report to {REPORT_EMAIL}")
            except Exception as e:
                logger.error(f"Error sending email report: {e}")
        
        # Track report generation metric
        observability.put_metric("ReportsGenerated", 1, "Count")
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "success": True,
                "report_key": report_key,
                "insights_count": len(report_data["insights"]),
                "recommendations_count": len(report_data["recommendations"])
            })
        }
        
    except Exception as e:
        logger.error(f"Error generating operational report: {e}", exc_info=True)
        observability.log_error(str(e), type(e).__name__)
        
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Internal server error"})
        }
