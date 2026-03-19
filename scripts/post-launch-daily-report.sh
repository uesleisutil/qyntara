#!/bin/bash
# =============================================================================
# B3 Tactical Ranking - Post-Launch Daily Monitoring Report
# =============================================================================
# Aggregates CloudWatch metrics, error logs, user adoption metrics, and cost
# metrics into a single daily report. Designed to run daily (e.g., via cron
# or EventBridge) after production launch.
#
# Requirements: 83.1-83.12, 91.1-91.10
#
# Usage:
#   ./scripts/post-launch-daily-report.sh [--json] [--email] [--days N]
# =============================================================================

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

NAMESPACE="B3Dashboard"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")
BUCKET="${BUCKET:-b3tr-${ACCOUNT_ID}-${REGION}}"
REPORT_DIR="monitoring/daily_reports"

JSON_OUTPUT=false
SEND_EMAIL=false
DAYS=1

for arg in "$@"; do
  case $arg in
    --json)    JSON_OUTPUT=true ;;
    --email)   SEND_EMAIL=true ;;
    --days=*)  DAYS="${arg#*=}" ;;
    --days)    shift; DAYS="${1:-1}" ;;
  esac
done

TODAY=$(date -u +%Y-%m-%d)
START_TIME=$(date -u -d "${DAYS} days ago" +%Y-%m-%dT00:00:00Z 2>/dev/null || date -u -v-${DAYS}d +%Y-%m-%dT00:00:00Z)
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# ─── Colors ───────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── Helper Functions ─────────────────────────────────────────────────────────

get_metric_stat() {
  local metric_name="$1"
  local stat="$2"
  local namespace="${3:-$NAMESPACE}"
  local period="${4:-86400}"

  aws cloudwatch get-metric-statistics \
    --namespace "$namespace" \
    --metric-name "$metric_name" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period "$period" \
    --statistics "$stat" \
    --query "Datapoints[0].${stat}" \
    --output text 2>/dev/null || echo "N/A"
}

get_alarm_state() {
  local alarm_name="$1"
  aws cloudwatch describe-alarms \
    --alarm-names "$alarm_name" \
    --query 'MetricAlarms[0].StateValue' \
    --output text 2>/dev/null || echo "MISSING"
}

count_log_errors() {
  local log_group="$1"
  local start_ms
  start_ms=$(date -u -d "${DAYS} days ago" +%s 2>/dev/null || date -u -v-${DAYS}d +%s)
  start_ms=$((start_ms * 1000))

  aws logs filter-log-events \
    --log-group-name "$log_group" \
    --start-time "$start_ms" \
    --filter-pattern "ERROR" \
    --query 'events | length(@)' \
    --output text 2>/dev/null || echo "0"
}

# =============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  B3 Tactical Ranking - Post-Launch Daily Report${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Date:    ${TODAY}"
echo -e "  Period:  Last ${DAYS} day(s)"
echo -e "  Region:  ${REGION}"
echo ""

# =============================================================================
# 1. CloudWatch Metrics Summary (Req 83.1, 83.2, 83.7)
# =============================================================================

echo -e "${CYAN}1. CloudWatch Metrics Summary${NC}"
echo "────────────────────────────────"

API_RESPONSE_AVG=$(get_metric_stat "APIResponseTime" "Average")
API_RESPONSE_MAX=$(get_metric_stat "APIResponseTime" "Maximum")
API_REQUESTS=$(get_metric_stat "APIRequests" "Sum")
API_ERRORS=$(get_metric_stat "APIErrors" "Sum")
PAGE_LOAD_AVG=$(get_metric_stat "PageLoadTime" "Average")
FCP_AVG=$(get_metric_stat "FirstContentfulPaint" "Average")

echo -e "  API Response Time (avg):  ${API_RESPONSE_AVG} ms"
echo -e "  API Response Time (max):  ${API_RESPONSE_MAX} ms"
echo -e "  Total API Requests:       ${API_REQUESTS}"
echo -e "  Total API Errors:         ${API_ERRORS}"
echo -e "  Page Load Time (avg):     ${PAGE_LOAD_AVG} ms"
echo -e "  First Contentful Paint:   ${FCP_AVG} ms"

# Calculate error rate
if [ "$API_REQUESTS" != "N/A" ] && [ "$API_ERRORS" != "N/A" ] && [ "$API_REQUESTS" != "0" ]; then
  ERROR_RATE=$(python3 -c "print(f'{(float(${API_ERRORS}) / float(${API_REQUESTS})) * 100:.2f}')" 2>/dev/null || echo "N/A")
  echo -e "  Error Rate:               ${ERROR_RATE}%"
else
  ERROR_RATE="N/A"
fi
echo ""

# =============================================================================
# 2. Error Logs Review (Req 83.4)
# =============================================================================

echo -e "${CYAN}2. Error Logs Review${NC}"
echo "────────────────────────────────"

B3_LOG_GROUPS=$(aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/B3" \
  --query 'logGroups[].logGroupName' --output text 2>/dev/null || echo "")

TOTAL_ERRORS=0
declare -A LOG_ERRORS

if [ -n "$B3_LOG_GROUPS" ]; then
  for LG in $B3_LOG_GROUPS; do
    FUNC_NAME=$(basename "$LG")
    ERR_COUNT=$(count_log_errors "$LG")
    if [ "$ERR_COUNT" != "0" ] && [ "$ERR_COUNT" != "None" ]; then
      echo -e "  ${YELLOW}⚠${NC} ${FUNC_NAME}: ${ERR_COUNT} errors"
      TOTAL_ERRORS=$((TOTAL_ERRORS + ERR_COUNT))
      LOG_ERRORS["$FUNC_NAME"]="$ERR_COUNT"
    else
      echo -e "  ${GREEN}✓${NC} ${FUNC_NAME}: 0 errors"
    fi
  done
else
  echo -e "  ${YELLOW}⚠${NC} No B3 Lambda log groups found"
fi

echo ""
echo -e "  Total errors across all functions: ${TOTAL_ERRORS}"
echo ""

# =============================================================================
# 3. Alarm Status (Req 83.3, 83.9)
# =============================================================================

echo -e "${CYAN}3. Alarm Status${NC}"
echo "────────────────────────────────"

ALARMS=(
  "B3Dashboard-HighAPIResponseTime"
  "B3Dashboard-HighErrorRate"
  "B3Dashboard-CriticalErrors"
  "B3Dashboard-HighPageLoadTime"
  "B3Dashboard-HighModelMAPE"
  "B3Dashboard-LowDirectionalAccuracy"
  "B3Dashboard-LowSharpeRatio"
  "B3Dashboard-NoActiveUsers"
  "B3Dashboard-HighAPICallVolume"
  "B3Dashboard-LambdaThrottles"
)

ALARMS_OK=0
ALARMS_FIRING=0
ALARMS_MISSING=0

for ALARM in "${ALARMS[@]}"; do
  STATE=$(get_alarm_state "$ALARM")
  case "$STATE" in
    OK)
      echo -e "  ${GREEN}✓${NC} ${ALARM}: OK"
      ALARMS_OK=$((ALARMS_OK + 1))
      ;;
    ALARM)
      echo -e "  ${RED}✗${NC} ${ALARM}: IN ALARM"
      ALARMS_FIRING=$((ALARMS_FIRING + 1))
      ;;
    INSUFFICIENT_DATA)
      echo -e "  ${YELLOW}⚠${NC} ${ALARM}: INSUFFICIENT DATA"
      ;;
    *)
      echo -e "  ${YELLOW}⚠${NC} ${ALARM}: MISSING"
      ALARMS_MISSING=$((ALARMS_MISSING + 1))
      ;;
  esac
done

echo ""
echo -e "  Summary: ${ALARMS_OK} OK, ${ALARMS_FIRING} firing, ${ALARMS_MISSING} missing"
echo ""

# =============================================================================
# 4. User Adoption Metrics (Req 91.1-91.5, 91.8, 91.10)
# =============================================================================

echo -e "${CYAN}4. User Adoption Metrics${NC}"
echo "────────────────────────────────"

ACTIVE_USERS=$(get_metric_stat "ActiveUsers" "Sum")
TOTAL_API_CALLS=$(get_metric_stat "APICallsTotal" "Sum")
PAGE_VIEWS=$(get_metric_stat "PageViews" "Sum")
FEATURE_USAGE=$(get_metric_stat "FeatureUsage" "Sum")
NAVIGATION_EVENTS=$(get_metric_stat "NavigationEvents" "Sum")
RECS_GENERATED=$(get_metric_stat "RecommendationsGenerated" "Sum")
PREDICTIONS_MADE=$(get_metric_stat "PredictionsMade" "Sum")

echo -e "  Active Users:              ${ACTIVE_USERS}"
echo -e "  Total API Calls:           ${TOTAL_API_CALLS}"
echo -e "  Page Views:                ${PAGE_VIEWS}"
echo -e "  Feature Usage Events:      ${FEATURE_USAGE}"
echo -e "  Navigation Events:         ${NAVIGATION_EVENTS}"
echo -e "  Recommendations Generated: ${RECS_GENERATED}"
echo -e "  Predictions Made:          ${PREDICTIONS_MADE}"
echo ""

# =============================================================================
# 5. Model Performance (Req 83.1, 83.2)
# =============================================================================

echo -e "${CYAN}5. Model Performance${NC}"
echo "────────────────────────────────"

MODEL_MAPE=$(get_metric_stat "ModelMAPE" "Average")
DIR_ACCURACY=$(get_metric_stat "DirectionalAccuracy" "Average")
SHARPE=$(get_metric_stat "SharpeRatio" "Average")
HIT_RATE=$(get_metric_stat "HitRate" "Average")

echo -e "  Model MAPE:                ${MODEL_MAPE}%"
echo -e "  Directional Accuracy:      ${DIR_ACCURACY}%"
echo -e "  Sharpe Ratio:              ${SHARPE}"
echo -e "  Hit Rate:                  ${HIT_RATE}%"

# Check thresholds
if [ "$MODEL_MAPE" != "N/A" ]; then
  MAPE_OK=$(python3 -c "print('OK' if float('${MODEL_MAPE}') < 15 else 'WARNING')" 2>/dev/null || echo "N/A")
  if [ "$MAPE_OK" = "WARNING" ]; then
    echo -e "  ${YELLOW}⚠ MAPE exceeds 15% threshold${NC}"
  fi
fi
echo ""

# =============================================================================
# 6. Cost Metrics (Req 9.1-9.7)
# =============================================================================

echo -e "${CYAN}6. Cost Metrics${NC}"
echo "────────────────────────────────"

# Try to load latest cost report from S3
COST_REPORT=$(aws s3 ls "s3://${BUCKET}/monitoring/costs/dt=${TODAY}/" --recursive 2>/dev/null | tail -1 | awk '{print $4}')

if [ -n "$COST_REPORT" ]; then
  COST_DATA=$(aws s3 cp "s3://${BUCKET}/${COST_REPORT}" - 2>/dev/null || echo "{}")

  TOTAL_7D_USD=$(echo "$COST_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{d.get('total_7_days',{}).get('usd',0):.2f}\")" 2>/dev/null || echo "N/A")
  MONTHLY_PROJ_BRL=$(echo "$COST_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{d.get('monthly_projection',{}).get('brl',0):.2f}\")" 2>/dev/null || echo "N/A")
  THRESHOLD_EXCEEDED=$(echo "$COST_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('threshold',{}).get('exceeded',False))" 2>/dev/null || echo "N/A")
  ANOMALY_COUNT=$(echo "$COST_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('anomalies',[])))" 2>/dev/null || echo "0")

  echo -e "  Total Cost (7 days):       \$${TOTAL_7D_USD} USD"
  echo -e "  Monthly Projection:        R\$${MONTHLY_PROJ_BRL} BRL"
  echo -e "  Threshold Exceeded:        ${THRESHOLD_EXCEEDED}"
  echo -e "  Cost Anomalies:            ${ANOMALY_COUNT}"

  if [ "$THRESHOLD_EXCEEDED" = "True" ]; then
    echo -e "  ${RED}✗ Monthly projection exceeds R\$500 threshold!${NC}"
  fi
else
  echo -e "  ${YELLOW}⚠ No cost report found for today. Run monitor_costs Lambda.${NC}"
  TOTAL_7D_USD="N/A"
  MONTHLY_PROJ_BRL="N/A"
  THRESHOLD_EXCEEDED="N/A"
  ANOMALY_COUNT="0"
fi
echo ""

# =============================================================================
# 7. Health Check (Req 83.10)
# =============================================================================

echo -e "${CYAN}7. System Health${NC}"
echo "────────────────────────────────"

HEALTH_STATUS=$(get_metric_stat "HealthCheckStatus" "Minimum")
echo -e "  Health Check Status:       $([ "$HEALTH_STATUS" = "1" ] && echo "${GREEN}Healthy${NC}" || echo "${YELLOW}${HEALTH_STATUS}${NC}")"

# Check storage metrics
STORAGE_GB=$(aws cloudwatch get-metric-statistics \
  --namespace "B3Dashboard/Storage" \
  --metric-name "StorageSizeGB" \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 86400 \
  --statistics "Average" \
  --query "Datapoints[0].Average" \
  --output text 2>/dev/null || echo "N/A")

echo -e "  Storage Size:              ${STORAGE_GB} GB"
echo ""

# =============================================================================
# 8. Summary & Recommendations
# =============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Daily Report Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Determine overall status
ISSUES=0
[ "$ALARMS_FIRING" -gt 0 ] && ISSUES=$((ISSUES + 1))
[ "$TOTAL_ERRORS" -gt 50 ] && ISSUES=$((ISSUES + 1))
[ "$THRESHOLD_EXCEEDED" = "True" ] && ISSUES=$((ISSUES + 1))

if [ "$ISSUES" -eq 0 ]; then
  echo -e "  ${GREEN}✅ System is healthy. No critical issues detected.${NC}"
elif [ "$ISSUES" -le 2 ]; then
  echo -e "  ${YELLOW}⚠️  System has ${ISSUES} issue(s) requiring attention.${NC}"
else
  echo -e "  ${RED}❌ System has ${ISSUES} critical issues. Immediate action required.${NC}"
fi
echo ""

# =============================================================================
# 9. Save Report to S3
# =============================================================================

REPORT_JSON=$(python3 -c "
import json
from datetime import datetime

report = {
    'timestamp': datetime.utcnow().isoformat() + 'Z',
    'date': '${TODAY}',
    'period_days': ${DAYS},
    'metrics': {
        'api_response_time_avg_ms': '${API_RESPONSE_AVG}',
        'api_response_time_max_ms': '${API_RESPONSE_MAX}',
        'api_requests': '${API_REQUESTS}',
        'api_errors': '${API_ERRORS}',
        'error_rate': '${ERROR_RATE:-N/A}',
        'page_load_time_avg_ms': '${PAGE_LOAD_AVG}',
    },
    'errors': {
        'total_log_errors': ${TOTAL_ERRORS},
    },
    'alarms': {
        'ok': ${ALARMS_OK},
        'firing': ${ALARMS_FIRING},
        'missing': ${ALARMS_MISSING},
    },
    'adoption': {
        'active_users': '${ACTIVE_USERS}',
        'api_calls': '${TOTAL_API_CALLS}',
        'page_views': '${PAGE_VIEWS}',
        'feature_usage': '${FEATURE_USAGE}',
        'recommendations_generated': '${RECS_GENERATED}',
    },
    'model_performance': {
        'mape': '${MODEL_MAPE}',
        'directional_accuracy': '${DIR_ACCURACY}',
        'sharpe_ratio': '${SHARPE}',
        'hit_rate': '${HIT_RATE}',
    },
    'costs': {
        'total_7d_usd': '${TOTAL_7D_USD}',
        'monthly_projection_brl': '${MONTHLY_PROJ_BRL}',
        'threshold_exceeded': '${THRESHOLD_EXCEEDED}',
        'anomaly_count': '${ANOMALY_COUNT}',
    },
    'health': {
        'status': '${HEALTH_STATUS}',
        'storage_gb': '${STORAGE_GB}',
    },
    'issues_count': ${ISSUES},
}
print(json.dumps(report, indent=2))
" 2>/dev/null)

if [ -n "$REPORT_JSON" ]; then
  REPORT_KEY="${REPORT_DIR}/dt=${TODAY}/daily_report_$(date -u +%H%M%S).json"
  echo "$REPORT_JSON" | aws s3 cp - "s3://${BUCKET}/${REPORT_KEY}" \
    --content-type "application/json" 2>/dev/null && \
    echo -e "  Report saved to s3://${BUCKET}/${REPORT_KEY}" || \
    echo -e "  ${YELLOW}⚠ Could not save report to S3${NC}"
fi

# JSON output to stdout
if $JSON_OUTPUT; then
  echo ""
  echo "$REPORT_JSON"
fi

echo ""
echo -e "${BLUE}Report complete.${NC}"
