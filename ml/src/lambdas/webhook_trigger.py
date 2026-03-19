"""
Webhook Trigger Utility

Helper functions to trigger webhooks from various monitoring lambdas.
"""

import json
import boto3
from typing import Dict, Any, Optional
from datetime import datetime

lambda_client = boto3.client('lambda')

WEBHOOK_LAMBDA_NAME = 'webhook-management'


def trigger_drift_detection_webhook(drift_type: str, drift_data: Dict[str, Any]) -> None:
    """
    Trigger webhook for drift detection events
    
    Args:
        drift_type: 'data_drift' or 'concept_drift'
        drift_data: Dictionary containing drift detection results
    """
    event_type = f'drift.{drift_type}_detected'
    
    payload = {
        'drift_type': drift_type,
        'detected_at': datetime.utcnow().isoformat(),
        'affected_features': drift_data.get('affected_features', []),
        'severity': drift_data.get('severity', 'medium'),
        'details': drift_data
    }
    
    _invoke_webhook_delivery(event_type, payload)


def trigger_performance_degradation_webhook(metric: str, current_value: float, 
                                            baseline_value: float, threshold: float) -> None:
    """
    Trigger webhook for performance degradation events
    
    Args:
        metric: Name of the performance metric (e.g., 'mape', 'accuracy', 'sharpe_ratio')
        current_value: Current value of the metric
        baseline_value: Baseline value for comparison
        threshold: Threshold that was exceeded
    """
    event_type = 'performance.degradation_detected'
    
    change_pct = ((current_value - baseline_value) / baseline_value) * 100
    
    payload = {
        'metric': metric,
        'current_value': current_value,
        'baseline_value': baseline_value,
        'change_percentage': change_pct,
        'threshold': threshold,
        'detected_at': datetime.utcnow().isoformat(),
        'severity': 'critical' if abs(change_pct) > 30 else 'high'
    }
    
    _invoke_webhook_delivery(event_type, payload)


def trigger_accuracy_threshold_webhook(accuracy: float, threshold: float, 
                                       period: str = 'daily') -> None:
    """
    Trigger webhook when accuracy falls below threshold
    
    Args:
        accuracy: Current accuracy value
        threshold: Minimum acceptable accuracy
        period: Time period for the measurement
    """
    event_type = 'performance.accuracy_below_threshold'
    
    payload = {
        'accuracy': accuracy,
        'threshold': threshold,
        'period': period,
        'detected_at': datetime.utcnow().isoformat(),
        'severity': 'critical' if accuracy < threshold * 0.9 else 'high'
    }
    
    _invoke_webhook_delivery(event_type, payload)


def trigger_budget_exceeded_webhook(current_spend: float, budget_limit: float, 
                                    period: str = 'monthly') -> None:
    """
    Trigger webhook when budget is exceeded
    
    Args:
        current_spend: Current spending amount
        budget_limit: Budget limit
        period: Budget period
    """
    event_type = 'cost.budget_exceeded'
    
    overage_pct = ((current_spend - budget_limit) / budget_limit) * 100
    
    payload = {
        'current_spend': current_spend,
        'budget_limit': budget_limit,
        'overage_amount': current_spend - budget_limit,
        'overage_percentage': overage_pct,
        'period': period,
        'detected_at': datetime.utcnow().isoformat(),
        'severity': 'critical' if overage_pct > 20 else 'high'
    }
    
    _invoke_webhook_delivery(event_type, payload)


def trigger_cost_spike_webhook(current_cost: float, average_cost: float, 
                               spike_threshold: float = 2.0) -> None:
    """
    Trigger webhook when cost spike is detected
    
    Args:
        current_cost: Current daily cost
        average_cost: Average daily cost
        spike_threshold: Multiplier for spike detection (default 2.0 = 200%)
    """
    event_type = 'cost.spike_detected'
    
    spike_multiplier = current_cost / average_cost if average_cost > 0 else 0
    
    payload = {
        'current_cost': current_cost,
        'average_cost': average_cost,
        'spike_multiplier': spike_multiplier,
        'spike_threshold': spike_threshold,
        'detected_at': datetime.utcnow().isoformat(),
        'severity': 'critical' if spike_multiplier > 3.0 else 'high'
    }
    
    _invoke_webhook_delivery(event_type, payload)


def trigger_completeness_threshold_webhook(completeness_rate: float, threshold: float,
                                          affected_tickers: list) -> None:
    """
    Trigger webhook when data completeness falls below threshold
    
    Args:
        completeness_rate: Current completeness rate (0-100)
        threshold: Minimum acceptable completeness rate
        affected_tickers: List of tickers with low completeness
    """
    event_type = 'data_quality.completeness_below_threshold'
    
    payload = {
        'completeness_rate': completeness_rate,
        'threshold': threshold,
        'affected_tickers': affected_tickers[:10],  # Limit to first 10
        'total_affected': len(affected_tickers),
        'detected_at': datetime.utcnow().isoformat(),
        'severity': 'critical' if completeness_rate < threshold * 0.9 else 'high'
    }
    
    _invoke_webhook_delivery(event_type, payload)


def trigger_anomaly_detected_webhook(anomaly_type: str, anomaly_data: Dict[str, Any]) -> None:
    """
    Trigger webhook when data anomaly is detected
    
    Args:
        anomaly_type: Type of anomaly ('gap', 'outlier', 'inconsistency')
        anomaly_data: Dictionary containing anomaly details
    """
    event_type = 'data_quality.anomaly_detected'
    
    payload = {
        'anomaly_type': anomaly_type,
        'ticker': anomaly_data.get('ticker'),
        'date': anomaly_data.get('date'),
        'description': anomaly_data.get('description'),
        'severity': anomaly_data.get('severity', 'medium'),
        'detected_at': datetime.utcnow().isoformat(),
        'details': anomaly_data
    }
    
    _invoke_webhook_delivery(event_type, payload)


def trigger_freshness_warning_webhook(data_source: str, age_hours: int, 
                                      threshold_hours: int = 24) -> None:
    """
    Trigger webhook when data freshness warning occurs
    
    Args:
        data_source: Name of the data source
        age_hours: Age of data in hours
        threshold_hours: Threshold for warning
    """
    event_type = 'data_quality.freshness_warning'
    
    payload = {
        'data_source': data_source,
        'age_hours': age_hours,
        'threshold_hours': threshold_hours,
        'detected_at': datetime.utcnow().isoformat(),
        'severity': 'critical' if age_hours > threshold_hours * 2 else 'high'
    }
    
    _invoke_webhook_delivery(event_type, payload)


def _invoke_webhook_delivery(event_type: str, event_data: Dict[str, Any]) -> None:
    """
    Invoke the webhook management lambda to deliver an event
    
    Args:
        event_type: Type of event to deliver
        event_data: Event payload data
    """
    try:
        payload = {
            'action': 'deliver_event',
            'event_type': event_type,
            'event_data': event_data
        }
        
        response = lambda_client.invoke(
            FunctionName=WEBHOOK_LAMBDA_NAME,
            InvocationType='Event',  # Async invocation
            Payload=json.dumps(payload)
        )
        
        print(f"Webhook delivery triggered for event: {event_type}")
        
    except Exception as e:
        # Log error but don't fail the calling function
        print(f"Error triggering webhook delivery: {e}")


# Example usage in monitoring lambdas:
"""
# In monitor_drift.py:
from webhook_trigger import trigger_drift_detection_webhook

if data_drift_detected:
    trigger_drift_detection_webhook('data_drift', {
        'affected_features': drifted_features,
        'severity': 'high',
        'drift_magnitude': max_drift_magnitude
    })

# In monitor_model_performance.py:
from webhook_trigger import trigger_performance_degradation_webhook

if mape_increased_significantly:
    trigger_performance_degradation_webhook(
        metric='mape',
        current_value=current_mape,
        baseline_value=baseline_mape,
        threshold=degradation_threshold
    )

# In monitor_costs.py:
from webhook_trigger import trigger_budget_exceeded_webhook, trigger_cost_spike_webhook

if current_spend > budget_limit:
    trigger_budget_exceeded_webhook(current_spend, budget_limit)

if daily_cost > average_cost * 2:
    trigger_cost_spike_webhook(daily_cost, average_cost)

# In data_quality.py:
from webhook_trigger import (
    trigger_completeness_threshold_webhook,
    trigger_anomaly_detected_webhook,
    trigger_freshness_warning_webhook
)

if completeness_rate < threshold:
    trigger_completeness_threshold_webhook(
        completeness_rate,
        threshold,
        low_completeness_tickers
    )

if anomaly_detected:
    trigger_anomaly_detected_webhook('outlier', {
        'ticker': ticker,
        'date': date,
        'description': 'Price outlier detected',
        'severity': 'high'
    })

if data_age_hours > 24:
    trigger_freshness_warning_webhook('prices', data_age_hours)
"""
