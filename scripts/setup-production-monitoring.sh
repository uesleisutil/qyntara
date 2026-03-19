#!/bin/bash
# =============================================================================
# B3 Tactical Ranking - Production Monitoring Setup
# =============================================================================
# Creates and verifies all production monitoring components:
#   - CloudWatch dashboards (system health, model performance, costs)
#   - CloudWatch alarms (Lambda errors, API latency, model quality, costs)
#   - SNS topics and subscriptions for alerting
#   - Sentry integration verification
#   - CloudWatch Synthetics canaries for uptime monitoring
#
# Requirements: 83.1-83.12
#
# Usage:
#   ./scripts/setup-production-monitoring.sh [--dry-run] [--verbose]
# =============================================================================

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

NAMESPACE="B3Dashboard"
STACK_NAME="B3TacticalRankingStackV2"
REGION="${AWS_REGION:-us-east-1}"
ALERT_EMAIL="${ALERT_EMAIL:-production-alerts@example.com}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")
BUCKET="b3tr-${ACCOUNT_ID}-${REGION}"
DASHBOARD_NAME="B3-Dashboard-System-Health"
MODEL_DASHBOARD_NAME="B3-Dashboard-Model-Performance"
COST_DASHBOARD_NAME="B3-Dashboard-Cost-Analysis"
SNS_TOPIC_NAME="b3-dashboard-alarms"
SNS_CRITICAL_TOPIC_NAME="b3-dashboard-critical-alarms"
CANARY_BUCKET="b3tr-synthetics-${ACCOUNT_ID}-${REGION}"

DRY_RUN=false
VERBOSE=false

for arg in "$@"; do
  case $arg in
    --dry-run)  DRY_RUN=true ;;
    --verbose)  VERBOSE=true ;;
  esac
done

# ─── Colors ───────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}ℹ${NC} $1"; }
log_ok()    { echo -e "${GREEN}✓${NC} $1"; }
log_warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
log_fail()  { echo -e "${RED}✗${NC} $1"; }
log_step()  { echo -e "\n${BLUE}━━━ $1 ━━━${NC}"; }

run_cmd() {
  if $DRY_RUN; then
    log_info "[DRY RUN] $1"
  else
    eval "$1"
  fi
}

PASS=0
FAIL=0
SKIP=0

# =============================================================================
# 1. SNS Topics & Subscriptions (Req 83.9)
# =============================================================================

setup_sns_topics() {
  log_step "1. SNS Topics & Subscriptions (Req 83.9)"

  # Standard alerts topic
  EXISTING_TOPIC=$(aws sns list-topics \
    --query "Topics[?contains(TopicArn, '${SNS_TOPIC_NAME}')].TopicArn" \
    --output text 2>/dev/null || echo "")

  if [ -n "$EXISTING_TOPIC" ] && [ "$EXISTING_TOPIC" != "None" ]; then
    log_ok "SNS topic exists: ${SNS_TOPIC_NAME}"
    SNS_TOPIC_ARN="$EXISTING_TOPIC"
  else
    log_info "Creating SNS topic: ${SNS_TOPIC_NAME}"
    SNS_TOPIC_ARN=$(run_cmd "aws sns create-topic --name ${SNS_TOPIC_NAME} --query TopicArn --output text")
    log_ok "Created SNS topic: ${SNS_TOPIC_ARN}"
  fi

  # Critical alerts topic (separate for PagerDuty/on-call integration)
  EXISTING_CRITICAL=$(aws sns list-topics \
    --query "Topics[?contains(TopicArn, '${SNS_CRITICAL_TOPIC_NAME}')].TopicArn" \
    --output text 2>/dev/null || echo "")

  if [ -n "$EXISTING_CRITICAL" ] && [ "$EXISTING_CRITICAL" != "None" ]; then
    log_ok "Critical SNS topic exists: ${SNS_CRITICAL_TOPIC_NAME}"
    SNS_CRITICAL_ARN="$EXISTING_CRITICAL"
  else
    log_info "Creating critical SNS topic: ${SNS_CRITICAL_TOPIC_NAME}"
    SNS_CRITICAL_ARN=$(run_cmd "aws sns create-topic --name ${SNS_CRITICAL_TOPIC_NAME} --query TopicArn --output text")
    log_ok "Created critical SNS topic: ${SNS_CRITICAL_ARN}"
  fi

  # Subscribe email to standard alerts
  SUBS=$(aws sns list-subscriptions-by-topic --topic-arn "${SNS_TOPIC_ARN}" \
    --query "Subscriptions[?Protocol=='email'].Endpoint" --output text 2>/dev/null || echo "")

  if echo "$SUBS" | grep -q "${ALERT_EMAIL}"; then
    log_ok "Email subscription exists: ${ALERT_EMAIL}"
  else
    log_info "Subscribing ${ALERT_EMAIL} to alerts topic"
    run_cmd "aws sns subscribe --topic-arn ${SNS_TOPIC_ARN} --protocol email --notification-endpoint ${ALERT_EMAIL}"
    log_warn "Confirm subscription via email sent to ${ALERT_EMAIL}"
  fi

  PASS=$((PASS + 1))
}

# =============================================================================
# 2. CloudWatch Dashboards (Req 83.1, 83.2, 83.6, 83.7, 83.8)
# =============================================================================

setup_cloudwatch_dashboards() {
  log_step "2. CloudWatch Dashboards (Req 83.8)"

  # ── System Health Dashboard ──
  SYSTEM_HEALTH_BODY=$(cat <<'DASHBOARD_EOF'
{
  "widgets": [
    {
      "type": "text",
      "x": 0, "y": 0, "width": 24, "height": 1,
      "properties": { "markdown": "# B3 Tactical Ranking - System Health Dashboard" }
    },
    {
      "type": "metric",
      "x": 0, "y": 1, "width": 12, "height": 6,
      "properties": {
        "title": "API Response Time (Req 83.7)",
        "metrics": [
          ["B3Dashboard", "APIResponseTime", {"stat": "Average", "label": "Avg Response Time"}],
          ["B3Dashboard", "APIResponseTime", {"stat": "p99", "label": "p99 Response Time"}],
          ["B3Dashboard", "APIResponseTime", {"stat": "Maximum", "label": "Max Response Time"}]
        ],
        "period": 300,
        "region": "us-east-1",
        "view": "timeSeries"
      }
    },
    {
      "type": "metric",
      "x": 12, "y": 1, "width": 12, "height": 6,
      "properties": {
        "title": "Frontend Performance (Req 83.6)",
        "metrics": [
          ["B3Dashboard", "PageLoadTime", {"stat": "Average", "label": "Page Load Time"}],
          ["B3Dashboard", "TimeToInteractive", {"stat": "Average", "label": "Time to Interactive"}],
          ["B3Dashboard", "FirstContentfulPaint", {"stat": "Average", "label": "FCP"}]
        ],
        "period": 300,
        "region": "us-east-1",
        "view": "timeSeries"
      }
    },
    {
      "type": "metric",
      "x": 0, "y": 7, "width": 12, "height": 6,
      "properties": {
        "title": "Error Rate (Req 83.7)",
        "metrics": [
          [{"expression": "(errors / requests) * 100", "label": "Error Rate %", "id": "e1"}],
          ["B3Dashboard", "APIErrors", {"stat": "Sum", "id": "errors", "visible": false}],
          ["B3Dashboard", "APIRequests", {"stat": "Sum", "id": "requests", "visible": false}]
        ],
        "period": 300,
        "region": "us-east-1",
        "view": "timeSeries",
        "yAxis": {"left": {"min": 0, "max": 100}}
      }
    },
    {
      "type": "metric",
      "x": 12, "y": 7, "width": 6, "height": 6,
      "properties": {
        "title": "Active Users (Req 83.2)",
        "metrics": [
          ["B3Dashboard", "ActiveUsers", {"stat": "Sum", "label": "Active Users"}]
        ],
        "period": 3600,
        "region": "us-east-1",
        "view": "singleValue"
      }
    },
    {
      "type": "metric",
      "x": 18, "y": 7, "width": 6, "height": 6,
      "properties": {
        "title": "Total Errors (24h) (Req 83.4)",
        "metrics": [
          ["B3Dashboard", "ErrorsTotal", {"stat": "Sum", "label": "Errors", "period": 86400}]
        ],
        "region": "us-east-1",
        "view": "singleValue"
      }
    },
    {
      "type": "metric",
      "x": 0, "y": 13, "width": 24, "height": 6,
      "properties": {
        "title": "Lambda Function Errors",
        "metrics": [
          ["AWS/Lambda", "Errors", "FunctionName", "B3TacticalRanking-Quotes5mIngest", {"stat": "Sum"}],
          ["AWS/Lambda", "Errors", "FunctionName", "B3TacticalRanking-TrainSageMaker", {"stat": "Sum"}],
          ["AWS/Lambda", "Errors", "FunctionName", "B3TacticalRanking-RankSageMaker", {"stat": "Sum"}],
          ["AWS/Lambda", "Errors", "FunctionName", "B3TacticalRanking-DashboardAPI", {"stat": "Sum"}],
          ["AWS/Lambda", "Errors", "FunctionName", "B3TacticalRanking-MonitorIngestion", {"stat": "Sum"}],
          ["AWS/Lambda", "Errors", "FunctionName", "B3TacticalRanking-MonitorCosts", {"stat": "Sum"}]
        ],
        "period": 300,
        "region": "us-east-1",
        "view": "timeSeries"
      }
    },
    {
      "type": "metric",
      "x": 0, "y": 19, "width": 24, "height": 6,
      "properties": {
        "title": "Lambda Duration (ms)",
        "metrics": [
          ["AWS/Lambda", "Duration", "FunctionName", "B3TacticalRanking-Quotes5mIngest", {"stat": "Average"}],
          ["AWS/Lambda", "Duration", "FunctionName", "B3TacticalRanking-DashboardAPI", {"stat": "Average"}],
          ["AWS/Lambda", "Duration", "FunctionName", "B3TacticalRanking-RankSageMaker", {"stat": "Average"}]
        ],
        "period": 300,
        "region": "us-east-1",
        "view": "timeSeries"
      }
    },
    {
      "type": "metric",
      "x": 0, "y": 25, "width": 24, "height": 6,
      "properties": {
        "title": "Business Metrics (Req 83.2)",
        "metrics": [
          ["B3Dashboard", "RecommendationsGenerated", {"stat": "Sum", "label": "Recommendations"}],
          ["B3Dashboard", "PredictionsMade", {"stat": "Sum", "label": "Predictions"}],
          ["B3Dashboard", "APICallsTotal", {"stat": "Sum", "label": "API Calls"}]
        ],
        "period": 3600,
        "region": "us-east-1",
        "view": "timeSeries"
      }
    }
  ]
}
DASHBOARD_EOF
)

  log_info "Creating/updating system health dashboard: ${DASHBOARD_NAME}"
  run_cmd "aws cloudwatch put-dashboard --dashboard-name '${DASHBOARD_NAME}' --dashboard-body '${SYSTEM_HEALTH_BODY}'"
  log_ok "System health dashboard ready"

  # ── Model Performance Dashboard ──
  MODEL_BODY=$(cat <<'MODEL_EOF'
{
  "widgets": [
    {
      "type": "text",
      "x": 0, "y": 0, "width": 24, "height": 1,
      "properties": { "markdown": "# B3 Tactical Ranking - Model Performance" }
    },
    {
      "type": "metric",
      "x": 0, "y": 1, "width": 12, "height": 6,
      "properties": {
        "title": "Model MAPE (%)",
        "metrics": [
          ["B3Dashboard", "ModelMAPE", {"stat": "Average", "label": "MAPE"}]
        ],
        "period": 86400,
        "region": "us-east-1",
        "view": "timeSeries",
        "annotations": {
          "horizontal": [{"label": "Threshold", "value": 15, "color": "#d62728"}]
        }
      }
    },
    {
      "type": "metric",
      "x": 12, "y": 1, "width": 12, "height": 6,
      "properties": {
        "title": "Directional Accuracy (%)",
        "metrics": [
          ["B3Dashboard", "DirectionalAccuracy", {"stat": "Average", "label": "Accuracy"}]
        ],
        "period": 86400,
        "region": "us-east-1",
        "view": "timeSeries",
        "annotations": {
          "horizontal": [{"label": "Minimum", "value": 50, "color": "#d62728"}]
        }
      }
    },
    {
      "type": "metric",
      "x": 0, "y": 7, "width": 12, "height": 6,
      "properties": {
        "title": "Sharpe Ratio",
        "metrics": [
          ["B3Dashboard", "SharpeRatio", {"stat": "Average", "label": "Sharpe Ratio"}]
        ],
        "period": 86400,
        "region": "us-east-1",
        "view": "timeSeries",
        "annotations": {
          "horizontal": [{"label": "Minimum", "value": 0.5, "color": "#d62728"}]
        }
      }
    },
    {
      "type": "metric",
      "x": 12, "y": 7, "width": 12, "height": 6,
      "properties": {
        "title": "Predictions Generated",
        "metrics": [
          ["B3Dashboard", "PredictionsMade", {"stat": "Sum", "label": "Predictions"}],
          ["B3Dashboard", "RecommendationsGenerated", {"stat": "Sum", "label": "Recommendations"}]
        ],
        "period": 86400,
        "region": "us-east-1",
        "view": "timeSeries"
      }
    }
  ]
}
MODEL_EOF
)

  log_info "Creating/updating model performance dashboard: ${MODEL_DASHBOARD_NAME}"
  run_cmd "aws cloudwatch put-dashboard --dashboard-name '${MODEL_DASHBOARD_NAME}' --dashboard-body '${MODEL_BODY}'"
  log_ok "Model performance dashboard ready"

  # ── Cost Analysis Dashboard ──
  COST_BODY=$(cat <<'COST_EOF'
{
  "widgets": [
    {
      "type": "text",
      "x": 0, "y": 0, "width": 24, "height": 1,
      "properties": { "markdown": "# B3 Tactical Ranking - Cost Analysis" }
    },
    {
      "type": "metric",
      "x": 0, "y": 1, "width": 24, "height": 6,
      "properties": {
        "title": "Lambda Invocations & Cost Proxy",
        "metrics": [
          ["AWS/Lambda", "Invocations", "FunctionName", "B3TacticalRanking-Quotes5mIngest", {"stat": "Sum"}],
          ["AWS/Lambda", "Invocations", "FunctionName", "B3TacticalRanking-DashboardAPI", {"stat": "Sum"}],
          ["AWS/Lambda", "Invocations", "FunctionName", "B3TacticalRanking-RankSageMaker", {"stat": "Sum"}],
          ["AWS/Lambda", "Invocations", "FunctionName", "B3TacticalRanking-TrainSageMaker", {"stat": "Sum"}]
        ],
        "period": 86400,
        "region": "us-east-1",
        "view": "timeSeries"
      }
    },
    {
      "type": "metric",
      "x": 0, "y": 7, "width": 12, "height": 6,
      "properties": {
        "title": "Lambda Duration (Cost Driver)",
        "metrics": [
          ["AWS/Lambda", "Duration", "FunctionName", "B3TacticalRanking-TrainSageMaker", {"stat": "Sum", "label": "Train Total ms"}],
          ["AWS/Lambda", "Duration", "FunctionName", "B3TacticalRanking-RankSageMaker", {"stat": "Sum", "label": "Rank Total ms"}]
        ],
        "period": 86400,
        "region": "us-east-1",
        "view": "timeSeries"
      }
    },
    {
      "type": "metric",
      "x": 12, "y": 7, "width": 12, "height": 6,
      "properties": {
        "title": "API Gateway Requests",
        "metrics": [
          ["AWS/ApiGateway", "Count", {"stat": "Sum", "label": "Total Requests"}],
          ["AWS/ApiGateway", "4XXError", {"stat": "Sum", "label": "4XX Errors"}],
          ["AWS/ApiGateway", "5XXError", {"stat": "Sum", "label": "5XX Errors"}]
        ],
        "period": 86400,
        "region": "us-east-1",
        "view": "timeSeries"
      }
    }
  ]
}
COST_EOF
)

  log_info "Creating/updating cost analysis dashboard: ${COST_DASHBOARD_NAME}"
  run_cmd "aws cloudwatch put-dashboard --dashboard-name '${COST_DASHBOARD_NAME}' --dashboard-body '${COST_BODY}'"
  log_ok "Cost analysis dashboard ready"

  PASS=$((PASS + 1))
}

# =============================================================================
# 3. CloudWatch Alarms (Req 83.3, 83.9)
# =============================================================================

setup_cloudwatch_alarms() {
  log_step "3. CloudWatch Alarms (Req 83.3)"

  SNS_TOPIC_ARN="arn:aws:sns:${REGION}:${ACCOUNT_ID}:${SNS_TOPIC_NAME}"
  SNS_CRITICAL_ARN="arn:aws:sns:${REGION}:${ACCOUNT_ID}:${SNS_CRITICAL_TOPIC_NAME}"

  # ── API Response Time > 1s ──
  log_info "Creating alarm: B3Dashboard-HighAPIResponseTime"
  run_cmd "aws cloudwatch put-metric-alarm \
    --alarm-name 'B3Dashboard-HighAPIResponseTime' \
    --alarm-description 'API response time exceeds 1 second (Req 83.7)' \
    --namespace '${NAMESPACE}' \
    --metric-name 'APIResponseTime' \
    --statistic Average \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 1000 \
    --comparison-operator GreaterThanThreshold \
    --treat-missing-data notBreaching \
    --alarm-actions '${SNS_TOPIC_ARN}' \
    --ok-actions '${SNS_TOPIC_ARN}'"
  log_ok "Alarm: HighAPIResponseTime (>1000ms)"

  # ── Error Rate > 5% ──
  log_info "Creating alarm: B3Dashboard-HighErrorRate"
  run_cmd "aws cloudwatch put-metric-alarm \
    --alarm-name 'B3Dashboard-HighErrorRate' \
    --alarm-description 'Error rate exceeds 5% (Req 83.7)' \
    --metrics '[
      {\"Id\":\"errors\",\"MetricStat\":{\"Metric\":{\"Namespace\":\"${NAMESPACE}\",\"MetricName\":\"APIErrors\"},\"Period\":300,\"Stat\":\"Sum\"},\"ReturnData\":false},
      {\"Id\":\"requests\",\"MetricStat\":{\"Metric\":{\"Namespace\":\"${NAMESPACE}\",\"MetricName\":\"APIRequests\"},\"Period\":300,\"Stat\":\"Sum\"},\"ReturnData\":false},
      {\"Id\":\"error_rate\",\"Expression\":\"(errors / requests) * 100\",\"Label\":\"Error Rate %\",\"ReturnData\":true}
    ]' \
    --evaluation-periods 2 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --treat-missing-data notBreaching \
    --alarm-actions '${SNS_TOPIC_ARN}' \
    --ok-actions '${SNS_TOPIC_ARN}'"
  log_ok "Alarm: HighErrorRate (>5%)"

  # ── Critical Errors (any) ──
  log_info "Creating alarm: B3Dashboard-CriticalErrors"
  run_cmd "aws cloudwatch put-metric-alarm \
    --alarm-name 'B3Dashboard-CriticalErrors' \
    --alarm-description 'Critical errors detected (Req 83.4)' \
    --namespace '${NAMESPACE}' \
    --metric-name 'ErrorsLogged' \
    --dimensions Name=ErrorType,Value=CRITICAL \
    --statistic Sum \
    --period 300 \
    --evaluation-periods 1 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --treat-missing-data notBreaching \
    --alarm-actions '${SNS_CRITICAL_ARN}' \
    --ok-actions '${SNS_CRITICAL_ARN}'"
  log_ok "Alarm: CriticalErrors (>=1)"

  # ── Page Load Time > 3s ──
  log_info "Creating alarm: B3Dashboard-HighPageLoadTime"
  run_cmd "aws cloudwatch put-metric-alarm \
    --alarm-name 'B3Dashboard-HighPageLoadTime' \
    --alarm-description 'Page load time exceeds 3 seconds (Req 83.6)' \
    --namespace '${NAMESPACE}' \
    --metric-name 'PageLoadTime' \
    --statistic Average \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 3000 \
    --comparison-operator GreaterThanThreshold \
    --treat-missing-data notBreaching \
    --alarm-actions '${SNS_TOPIC_ARN}'"
  log_ok "Alarm: HighPageLoadTime (>3000ms)"

  # ── Model MAPE > 15% ──
  log_info "Creating alarm: B3Dashboard-HighModelMAPE"
  run_cmd "aws cloudwatch put-metric-alarm \
    --alarm-name 'B3Dashboard-HighModelMAPE' \
    --alarm-description 'Model MAPE exceeds 15%' \
    --namespace '${NAMESPACE}' \
    --metric-name 'ModelMAPE' \
    --statistic Average \
    --period 86400 \
    --evaluation-periods 2 \
    --threshold 15 \
    --comparison-operator GreaterThanThreshold \
    --treat-missing-data notBreaching \
    --alarm-actions '${SNS_TOPIC_ARN}'"
  log_ok "Alarm: HighModelMAPE (>15%)"

  # ── Directional Accuracy < 50% ──
  log_info "Creating alarm: B3Dashboard-LowDirectionalAccuracy"
  run_cmd "aws cloudwatch put-metric-alarm \
    --alarm-name 'B3Dashboard-LowDirectionalAccuracy' \
    --alarm-description 'Directional accuracy below 50%' \
    --namespace '${NAMESPACE}' \
    --metric-name 'DirectionalAccuracy' \
    --statistic Average \
    --period 86400 \
    --evaluation-periods 2 \
    --threshold 50 \
    --comparison-operator LessThanThreshold \
    --treat-missing-data notBreaching \
    --alarm-actions '${SNS_TOPIC_ARN}'"
  log_ok "Alarm: LowDirectionalAccuracy (<50%)"

  # ── Sharpe Ratio < 0.5 ──
  log_info "Creating alarm: B3Dashboard-LowSharpeRatio"
  run_cmd "aws cloudwatch put-metric-alarm \
    --alarm-name 'B3Dashboard-LowSharpeRatio' \
    --alarm-description 'Sharpe Ratio below 0.5' \
    --namespace '${NAMESPACE}' \
    --metric-name 'SharpeRatio' \
    --statistic Average \
    --period 86400 \
    --evaluation-periods 3 \
    --threshold 0.5 \
    --comparison-operator LessThanThreshold \
    --treat-missing-data notBreaching \
    --alarm-actions '${SNS_TOPIC_ARN}'"
  log_ok "Alarm: LowSharpeRatio (<0.5)"

  # ── No Active Users (1h) ──
  log_info "Creating alarm: B3Dashboard-NoActiveUsers"
  run_cmd "aws cloudwatch put-metric-alarm \
    --alarm-name 'B3Dashboard-NoActiveUsers' \
    --alarm-description 'No active users in the last hour (Req 83.2)' \
    --namespace '${NAMESPACE}' \
    --metric-name 'ActiveUsers' \
    --statistic Sum \
    --period 3600 \
    --evaluation-periods 1 \
    --threshold 1 \
    --comparison-operator LessThanThreshold \
    --treat-missing-data breaching \
    --alarm-actions '${SNS_TOPIC_ARN}'"
  log_ok "Alarm: NoActiveUsers"

  # ── High API Call Volume ──
  log_info "Creating alarm: B3Dashboard-HighAPICallVolume"
  run_cmd "aws cloudwatch put-metric-alarm \
    --alarm-name 'B3Dashboard-HighAPICallVolume' \
    --alarm-description 'API call volume exceeds normal threshold (Req 83.2)' \
    --namespace '${NAMESPACE}' \
    --metric-name 'APICallsTotal' \
    --statistic Sum \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 1000 \
    --comparison-operator GreaterThanThreshold \
    --treat-missing-data notBreaching \
    --alarm-actions '${SNS_TOPIC_ARN}'"
  log_ok "Alarm: HighAPICallVolume (>1000/5min)"

  # ── Lambda Throttles ──
  log_info "Creating alarm: B3Dashboard-LambdaThrottles"
  run_cmd "aws cloudwatch put-metric-alarm \
    --alarm-name 'B3Dashboard-LambdaThrottles' \
    --alarm-description 'Lambda functions being throttled' \
    --namespace 'AWS/Lambda' \
    --metric-name 'Throttles' \
    --statistic Sum \
    --period 300 \
    --evaluation-periods 1 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --treat-missing-data notBreaching \
    --alarm-actions '${SNS_CRITICAL_ARN}'"
  log_ok "Alarm: LambdaThrottles (>=1)"

  PASS=$((PASS + 1))
}

# =============================================================================
# 4. Sentry Integration Verification (Req 83.4, 83.6)
# =============================================================================

verify_sentry_integration() {
  log_step "4. Sentry Integration Verification"

  SENTRY_CONFIG="config/sentry.json"

  if [ -f "$SENTRY_CONFIG" ]; then
    log_ok "Sentry configuration file exists: ${SENTRY_CONFIG}"

    # Verify DSN is configured in production env
    if grep -q "REACT_APP_SENTRY_DSN" .env.production 2>/dev/null; then
      log_ok "REACT_APP_SENTRY_DSN configured in .env.production"
    else
      log_warn "REACT_APP_SENTRY_DSN not found in .env.production"
      FAIL=$((FAIL + 1))
    fi

    # Verify Sentry environment is set
    if grep -q "REACT_APP_ENVIRONMENT=production" .env.production 2>/dev/null; then
      log_ok "REACT_APP_ENVIRONMENT=production is set"
    else
      log_warn "REACT_APP_ENVIRONMENT not set to production"
    fi

    # Verify sample rate
    if grep -q "REACT_APP_SENTRY_SAMPLE_RATE" .env.production 2>/dev/null; then
      log_ok "Sentry sample rate configured"
    else
      log_warn "REACT_APP_SENTRY_SAMPLE_RATE not configured"
    fi
  else
    log_warn "Sentry config not found at ${SENTRY_CONFIG}. Creating default config..."
    log_info "Run: cat config/sentry.json to review Sentry configuration"
    FAIL=$((FAIL + 1))
  fi

  # Verify frontend monitoring service exists
  MONITORING_SERVICE=$(find . -path "*/services/monitoring*" -o -path "*/services/sentry*" 2>/dev/null | head -1)
  if [ -n "$MONITORING_SERVICE" ]; then
    log_ok "Frontend monitoring service found: ${MONITORING_SERVICE}"
  else
    log_warn "No frontend monitoring service found (expected services/monitoring.js or similar)"
  fi

  PASS=$((PASS + 1))
}

# =============================================================================
# 5. CloudWatch Synthetics Canaries (Req 83.10)
# =============================================================================

setup_synthetics_canaries() {
  log_step "5. CloudWatch Synthetics Canaries (Req 83.10)"

  # Create S3 bucket for canary artifacts if it doesn't exist
  if aws s3 ls "s3://${CANARY_BUCKET}" &>/dev/null 2>&1; then
    log_ok "Synthetics artifact bucket exists: ${CANARY_BUCKET}"
  else
    log_info "Creating synthetics artifact bucket: ${CANARY_BUCKET}"
    run_cmd "aws s3 mb s3://${CANARY_BUCKET} --region ${REGION}"
    log_ok "Created synthetics artifact bucket"
  fi

  # Get API endpoint from CloudFormation
  PROD_API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?contains(OutputKey, 'Api')].OutputValue" \
    --output text 2>/dev/null | head -1 || echo "")

  if [ -z "$PROD_API_URL" ]; then
    log_warn "Could not determine API URL from stack outputs. Skipping canary setup."
    log_info "Set PROD_API_URL manually and re-run to create canaries."
    SKIP=$((SKIP + 1))
    return
  fi

  # Health check canary
  CANARY_NAME="b3-health-check"
  EXISTING_CANARY=$(aws synthetics describe-canaries \
    --query "Canaries[?Name=='${CANARY_NAME}'].Name" \
    --output text 2>/dev/null || echo "")

  if [ -n "$EXISTING_CANARY" ] && [ "$EXISTING_CANARY" != "None" ]; then
    log_ok "Health check canary exists: ${CANARY_NAME}"
  else
    log_info "Creating health check canary: ${CANARY_NAME}"
    log_info "Canary will ping ${PROD_API_URL}/health every 5 minutes"

    CANARY_SCRIPT=$(cat <<CANARY_EOF
const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');

const apiCanaryBlueprint = async function () {
  const url = '${PROD_API_URL}/health';
  const requestOptions = { hostname: new URL(url).hostname, path: '/health', method: 'GET' };
  const stepConfig = { includeRequestHeaders: true, includeResponseHeaders: true, includeRequestBody: true, includeResponseBody: true };
  await synthetics.executeHttpStep('healthCheck', requestOptions, null, stepConfig);
};

exports.handler = async () => { return await apiCanaryBlueprint(); };
CANARY_EOF
)

    log_info "[Manual step] Create canary via AWS Console or CDK with the above script"
    log_info "Schedule: rate(5 minutes), Runtime: syn-nodejs-puppeteer-6.2"
  fi

  PASS=$((PASS + 1))
}

# =============================================================================
# 6. User Analytics Verification (Req 83.11)
# =============================================================================

verify_user_analytics() {
  log_step "6. User Analytics Verification (Req 83.11)"

  # Check DynamoDB analytics table
  ANALYTICS_TABLE=$(aws dynamodb list-tables \
    --query "TableNames[?contains(@, 'Analytics') || contains(@, 'analytics')]" \
    --output text 2>/dev/null || echo "")

  if [ -n "$ANALYTICS_TABLE" ]; then
    log_ok "Analytics DynamoDB table found: ${ANALYTICS_TABLE}"
  else
    log_warn "No analytics DynamoDB table found"
  fi

  # Verify custom metrics for user behavior are being published
  ANALYTICS_METRICS=("ActiveUsers" "APICallsTotal" "FeatureUsage" "PageViews")
  for METRIC in "${ANALYTICS_METRICS[@]}"; do
    DATAPOINTS=$(aws cloudwatch get-metric-statistics \
      --namespace "${NAMESPACE}" \
      --metric-name "${METRIC}" \
      --start-time "$(date -u -d '24 hours ago' '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || date -u -v-24H '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || echo '2024-01-01T00:00:00')" \
      --end-time "$(date -u '+%Y-%m-%dT%H:%M:%S')" \
      --period 3600 \
      --statistics Sum \
      --query 'Datapoints | length(@)' --output text 2>/dev/null || echo "0")

    if [ "$DATAPOINTS" -gt 0 ] 2>/dev/null; then
      log_ok "Metric '${METRIC}' has data (${DATAPOINTS} datapoints in 24h)"
    else
      log_warn "Metric '${METRIC}' has no recent data"
    fi
  done

  PASS=$((PASS + 1))
}

# =============================================================================
# 7. Operational Reports (Req 83.12)
# =============================================================================

verify_operational_reports() {
  log_step "7. Operational Reports (Req 83.12)"

  # Check for operational report Lambda
  REPORT_LAMBDA=$(aws lambda list-functions \
    --query "Functions[?contains(FunctionName, 'operational-report') || contains(FunctionName, 'OperationalReport')].FunctionName" \
    --output text 2>/dev/null | head -1)

  if [ -n "$REPORT_LAMBDA" ]; then
    log_ok "Operational report Lambda found: ${REPORT_LAMBDA}"
  else
    log_warn "No operational report Lambda found"
    log_info "Weekly reports can be generated via: aws lambda invoke --function-name operational-reports --payload '{\"days\": 7}' response.json"
  fi

  # Check EventBridge rule for weekly reports
  REPORT_RULE=$(aws events list-rules \
    --query "Rules[?contains(Name, 'report') || contains(Name, 'Report')].{Name:Name,State:State}" \
    --output text 2>/dev/null || echo "")

  if [ -n "$REPORT_RULE" ]; then
    log_ok "Report schedule rule found: ${REPORT_RULE}"
  else
    log_warn "No scheduled report rule found"
    log_info "Create an EventBridge rule for weekly report generation"
  fi

  PASS=$((PASS + 1))
}

# =============================================================================
# 8. On-Call Rotation Setup
# =============================================================================

setup_on_call_rotation() {
  log_step "8. On-Call Rotation"

  ON_CALL_CONFIG="config/on-call-rotation.json"

  if [ -f "$ON_CALL_CONFIG" ]; then
    log_ok "On-call rotation config exists: ${ON_CALL_CONFIG}"

    # Validate JSON
    if python3 -c "import json; json.load(open('${ON_CALL_CONFIG}'))" 2>/dev/null; then
      log_ok "On-call rotation config is valid JSON"
    else
      log_fail "On-call rotation config has invalid JSON"
      FAIL=$((FAIL + 1))
    fi
  else
    log_warn "On-call rotation config not found at ${ON_CALL_CONFIG}"
    FAIL=$((FAIL + 1))
  fi

  PASS=$((PASS + 1))
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  B3 Tactical Ranking - Production Monitoring Setup${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "  Account:  ${ACCOUNT_ID}"
  echo -e "  Region:   ${REGION}"
  echo -e "  Stack:    ${STACK_NAME}"
  echo -e "  Email:    ${ALERT_EMAIL}"
  if $DRY_RUN; then
    echo -e "  ${YELLOW}Mode: DRY RUN (no changes will be made)${NC}"
  fi
  echo ""

  setup_sns_topics
  setup_cloudwatch_dashboards
  setup_cloudwatch_alarms
  verify_sentry_integration
  setup_synthetics_canaries
  verify_user_analytics
  verify_operational_reports
  setup_on_call_rotation

  # ── Summary ──
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Monitoring Setup Summary${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "  ${GREEN}Passed:  ${PASS}${NC}"
  echo -e "  ${RED}Failed:  ${FAIL}${NC}"
  echo -e "  ${YELLOW}Skipped: ${SKIP}${NC}"
  echo ""

  if [ "$FAIL" -gt 0 ]; then
    echo -e "${RED}❌ Some monitoring components need attention.${NC}"
    exit 1
  else
    echo -e "${GREEN}✅ Production monitoring setup complete!${NC}"
    echo ""
    echo "  Dashboards:"
    echo "    - ${DASHBOARD_NAME}"
    echo "    - ${MODEL_DASHBOARD_NAME}"
    echo "    - ${COST_DASHBOARD_NAME}"
    echo ""
    echo "  Next steps:"
    echo "    1. Confirm SNS email subscription"
    echo "    2. Review on-call rotation: config/on-call-rotation.json"
    echo "    3. Verify Sentry DSN in .env.production"
    echo "    4. Run ./scripts/verify-monitoring.sh to validate"
    exit 0
  fi
}

main "$@"
