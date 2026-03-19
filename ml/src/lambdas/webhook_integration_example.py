"""
Webhook Integration Examples

This file shows how to integrate webhook triggers into existing monitoring lambdas.
"""

# Example 1: Integration in monitor_drift.py
# ============================================

def monitor_drift_with_webhooks():
    """
    Example of integrating webhook triggers into drift monitoring
    """
    from webhook_trigger import (
        trigger_drift_detection_webhook,
        trigger_performance_degradation_webhook
    )
    
    # Existing drift detection logic
    drift_results = detect_data_drift()
    
    # Check for data drift
    if drift_results['drifted_features']:
        # Trigger webhook for data drift
        trigger_drift_detection_webhook('data_drift', {
            'affected_features': drift_results['drifted_features'],
            'severity': 'high' if len(drift_results['drifted_features']) > 10 else 'medium',
            'drift_magnitude': drift_results['max_ks_statistic'],
            'total_features_checked': drift_results['total_features'],
            'drift_percentage': (len(drift_results['drifted_features']) / drift_results['total_features']) * 100
        })
    
    # Check for concept drift
    concept_drift_results = detect_concept_drift()
    
    if concept_drift_results['concept_drifted']:
        trigger_drift_detection_webhook('concept_drift', {
            'affected_features': concept_drift_results['drifted_features'],
            'severity': 'critical' if concept_drift_results['overall_score'] > 0.8 else 'high',
            'drift_score': concept_drift_results['overall_score'],
            'correlation_changes': concept_drift_results['correlation_changes']
        })


# Example 2: Integration in monitor_model_performance.py
# =======================================================

def monitor_performance_with_webhooks():
    """
    Example of integrating webhook triggers into performance monitoring
    """
    from webhook_trigger import (
        trigger_performance_degradation_webhook,
        trigger_accuracy_threshold_webhook
    )
    
    # Get current and baseline metrics
    current_metrics = get_current_performance_metrics()
    baseline_metrics = get_baseline_performance_metrics()
    
    # Check MAPE degradation
    mape_change_pct = ((current_metrics['mape'] - baseline_metrics['mape']) / baseline_metrics['mape']) * 100
    
    if mape_change_pct > 20:  # 20% increase in MAPE
        trigger_performance_degradation_webhook(
            metric='mape',
            current_value=current_metrics['mape'],
            baseline_value=baseline_metrics['mape'],
            threshold=20.0
        )
    
    # Check accuracy threshold
    if current_metrics['accuracy'] < 0.70:  # Below 70% accuracy
        trigger_accuracy_threshold_webhook(
            accuracy=current_metrics['accuracy'],
            threshold=0.70,
            period='daily'
        )
    
    # Check Sharpe ratio degradation
    sharpe_change = current_metrics['sharpe_ratio'] - baseline_metrics['sharpe_ratio']
    
    if sharpe_change < -0.5:  # Sharpe ratio decreased by more than 0.5
        trigger_performance_degradation_webhook(
            metric='sharpe_ratio',
            current_value=current_metrics['sharpe_ratio'],
            baseline_value=baseline_metrics['sharpe_ratio'],
            threshold=-0.5
        )


# Example 3: Integration in monitor_costs.py
# ===========================================

def monitor_costs_with_webhooks():
    """
    Example of integrating webhook triggers into cost monitoring
    """
    from webhook_trigger import (
        trigger_budget_exceeded_webhook,
        trigger_cost_spike_webhook
    )
    
    # Get current month costs
    current_spend = get_month_to_date_costs()
    budget_limit = get_monthly_budget_limit()
    
    # Check if budget exceeded
    if current_spend > budget_limit:
        trigger_budget_exceeded_webhook(
            current_spend=current_spend,
            budget_limit=budget_limit,
            period='monthly'
        )
    
    # Check for cost spikes
    daily_costs = get_daily_costs(days=30)
    average_daily_cost = sum(daily_costs) / len(daily_costs)
    today_cost = daily_costs[-1]
    
    if today_cost > average_daily_cost * 2:  # 200% spike
        trigger_cost_spike_webhook(
            current_cost=today_cost,
            average_cost=average_daily_cost,
            spike_threshold=2.0
        )


# Example 4: Integration in data_quality.py
# ==========================================

def monitor_data_quality_with_webhooks():
    """
    Example of integrating webhook triggers into data quality monitoring
    """
    from webhook_trigger import (
        trigger_completeness_threshold_webhook,
        trigger_anomaly_detected_webhook,
        trigger_freshness_warning_webhook
    )
    
    # Check data completeness
    completeness_results = calculate_completeness_rates()
    overall_completeness = completeness_results['overall_rate']
    
    if overall_completeness < 95:  # Below 95% completeness
        low_completeness_tickers = [
            ticker for ticker, rate in completeness_results['by_ticker'].items()
            if rate < 95
        ]
        
        trigger_completeness_threshold_webhook(
            completeness_rate=overall_completeness,
            threshold=95.0,
            affected_tickers=low_completeness_tickers
        )
    
    # Check for anomalies
    anomalies = detect_data_anomalies()
    
    for anomaly in anomalies:
        if anomaly['severity'] in ['high', 'critical']:
            trigger_anomaly_detected_webhook(
                anomaly_type=anomaly['type'],  # 'gap', 'outlier', 'inconsistency'
                anomaly_data={
                    'ticker': anomaly['ticker'],
                    'date': anomaly['date'],
                    'description': anomaly['description'],
                    'severity': anomaly['severity'],
                    'value': anomaly.get('value'),
                    'expected_range': anomaly.get('expected_range')
                }
            )
    
    # Check data freshness
    freshness_status = check_data_freshness()
    
    for source, status in freshness_status.items():
        if status['age_hours'] > 24:  # Data older than 24 hours
            trigger_freshness_warning_webhook(
                data_source=source,
                age_hours=status['age_hours'],
                threshold_hours=24
            )


# Example 5: Conditional Webhook Triggering
# ==========================================

def conditional_webhook_example():
    """
    Example of conditional webhook triggering based on severity
    """
    from webhook_trigger import trigger_drift_detection_webhook
    
    drift_results = detect_data_drift()
    
    # Calculate severity based on multiple factors
    num_drifted = len(drift_results['drifted_features'])
    total_features = drift_results['total_features']
    drift_percentage = (num_drifted / total_features) * 100
    max_drift = drift_results['max_ks_statistic']
    
    # Determine severity
    if drift_percentage > 50 or max_drift > 0.8:
        severity = 'critical'
    elif drift_percentage > 30 or max_drift > 0.5:
        severity = 'high'
    elif drift_percentage > 10 or max_drift > 0.3:
        severity = 'medium'
    else:
        severity = 'low'
    
    # Only trigger webhook for medium severity and above
    if severity in ['medium', 'high', 'critical']:
        trigger_drift_detection_webhook('data_drift', {
            'affected_features': drift_results['drifted_features'][:20],  # Limit to first 20
            'severity': severity,
            'drift_percentage': drift_percentage,
            'max_drift_magnitude': max_drift,
            'total_features': total_features,
            'recommendation': get_recommendation(severity)
        })


# Example 6: Batching Multiple Events
# ====================================

def batch_webhook_example():
    """
    Example of batching multiple related events
    """
    from webhook_trigger import trigger_performance_degradation_webhook
    
    # Collect all degraded metrics
    degraded_metrics = []
    
    metrics_to_check = [
        ('mape', get_mape, 20),  # 20% threshold
        ('accuracy', get_accuracy, -10),  # -10 percentage points
        ('sharpe_ratio', get_sharpe_ratio, -0.5)  # -0.5 threshold
    ]
    
    for metric_name, metric_func, threshold in metrics_to_check:
        current = metric_func()
        baseline = get_baseline(metric_name)
        
        if is_degraded(current, baseline, threshold):
            degraded_metrics.append({
                'metric': metric_name,
                'current': current,
                'baseline': baseline,
                'threshold': threshold
            })
    
    # If multiple metrics degraded, send a single comprehensive webhook
    if len(degraded_metrics) > 1:
        # Send combined webhook
        trigger_performance_degradation_webhook(
            metric='multiple',
            current_value=len(degraded_metrics),
            baseline_value=0,
            threshold=1
        )
    else:
        # Send individual webhooks
        for metric_data in degraded_metrics:
            trigger_performance_degradation_webhook(
                metric=metric_data['metric'],
                current_value=metric_data['current'],
                baseline_value=metric_data['baseline'],
                threshold=metric_data['threshold']
            )


# Example 7: Error Handling
# ==========================

def webhook_with_error_handling():
    """
    Example of proper error handling when triggering webhooks
    """
    from webhook_trigger import trigger_drift_detection_webhook
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        # Main monitoring logic
        drift_results = detect_data_drift()
        
        if drift_results['drifted_features']:
            try:
                # Attempt to trigger webhook
                trigger_drift_detection_webhook('data_drift', {
                    'affected_features': drift_results['drifted_features'],
                    'severity': 'high'
                })
                logger.info("Webhook triggered successfully")
            except Exception as webhook_error:
                # Log webhook error but don't fail the monitoring
                logger.error(f"Failed to trigger webhook: {webhook_error}")
                # Continue with monitoring even if webhook fails
        
        # Continue with rest of monitoring logic
        return drift_results
        
    except Exception as e:
        logger.error(f"Monitoring failed: {e}")
        raise


# Example 8: Testing Webhook Integration
# =======================================

def test_webhook_integration():
    """
    Example of testing webhook integration locally
    """
    import os
    
    # Set test mode environment variable
    os.environ['WEBHOOK_TEST_MODE'] = 'true'
    
    from webhook_trigger import trigger_drift_detection_webhook
    
    # Trigger test webhook
    trigger_drift_detection_webhook('data_drift', {
        'affected_features': ['test_feature_1', 'test_feature_2'],
        'severity': 'medium',
        'drift_magnitude': 0.45,
        'test_mode': True
    })
    
    print("Test webhook triggered. Check webhook endpoint for delivery.")


# Helper functions (placeholders)
# ================================

def detect_data_drift():
    """Placeholder for drift detection logic"""
    return {
        'drifted_features': ['feature1', 'feature2'],
        'total_features': 50,
        'max_ks_statistic': 0.65
    }

def detect_concept_drift():
    """Placeholder for concept drift detection"""
    return {
        'concept_drifted': True,
        'drifted_features': ['feature1'],
        'overall_score': 0.75,
        'correlation_changes': {}
    }

def get_current_performance_metrics():
    """Placeholder for current metrics"""
    return {
        'mape': 0.15,
        'accuracy': 0.68,
        'sharpe_ratio': 1.2
    }

def get_baseline_performance_metrics():
    """Placeholder for baseline metrics"""
    return {
        'mape': 0.12,
        'accuracy': 0.75,
        'sharpe_ratio': 1.8
    }

def get_month_to_date_costs():
    """Placeholder for cost calculation"""
    return 1200.0

def get_monthly_budget_limit():
    """Placeholder for budget limit"""
    return 1000.0

def get_daily_costs(days):
    """Placeholder for daily costs"""
    return [30.0] * (days - 1) + [65.0]  # Spike on last day

def calculate_completeness_rates():
    """Placeholder for completeness calculation"""
    return {
        'overall_rate': 92.5,
        'by_ticker': {
            'PETR4': 88.0,
            'VALE3': 95.0
        }
    }

def detect_data_anomalies():
    """Placeholder for anomaly detection"""
    return [
        {
            'type': 'outlier',
            'ticker': 'PETR4',
            'date': '2024-01-15',
            'description': 'Price spike detected',
            'severity': 'high',
            'value': 45.50,
            'expected_range': (30.0, 35.0)
        }
    ]

def check_data_freshness():
    """Placeholder for freshness check"""
    return {
        'prices': {'age_hours': 2},
        'fundamentals': {'age_hours': 26}  # Stale
    }

def get_recommendation(severity):
    """Get recommendation based on severity"""
    recommendations = {
        'critical': 'Immediate retraining required',
        'high': 'Schedule retraining within 24 hours',
        'medium': 'Monitor closely, consider retraining',
        'low': 'Continue monitoring'
    }
    return recommendations.get(severity, 'Monitor situation')

def is_degraded(current, baseline, threshold):
    """Check if metric is degraded"""
    if threshold > 0:
        return ((current - baseline) / baseline * 100) > threshold
    else:
        return (current - baseline) < threshold

def get_baseline(metric_name):
    """Get baseline value for metric"""
    baselines = {
        'mape': 0.12,
        'accuracy': 0.75,
        'sharpe_ratio': 1.8
    }
    return baselines.get(metric_name, 0)

def get_mape():
    return 0.15

def get_accuracy():
    return 0.68

def get_sharpe_ratio():
    return 1.2


if __name__ == '__main__':
    print("Webhook Integration Examples")
    print("=" * 50)
    print("\nThese examples show how to integrate webhook triggers")
    print("into existing monitoring lambdas.")
    print("\nSee function docstrings for detailed usage.")
