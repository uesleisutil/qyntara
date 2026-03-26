#!/bin/bash
# =============================================================================
# B3 Tactical Ranking - Monitoring Verification Script
# =============================================================================
# Verifies all monitoring components are properly configured and operational.
# Run this after setup-production-monitoring.sh to confirm everything works.
#
# Requirements: 83.1-83.12
#
# Usage:
#   ./scripts/verify-monitoring.sh [--verbose] [--json]
# =============================================================================

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

NAMESPACE="B3Dashboard"
STACK_NAME="B3TacticalRankingStackV2"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")

VERBOSE=false
JSON_OUTPUT=false

for arg in "$@"; do
  case $arg in
    --verbose) VERBOSE=true ;;
    --json)    JSON_OUTPUT=true ;;
  esac
done

# ─── Colors ───────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

RESULTS=()

check_pass() {
  echo -e "${GREEN}✓${NC} $1"
  PASS=$((PASS + 1))
  RESULTS+=("{\"check\":\"$1\",\"status\":\"pass\"}")
}

check_fail() {
  echo -e "${RED}✗${NC} $1"
  FAIL=$((FAIL + 1))
  RESULTS+=("{\"check\":\"$1\",\"status\":\"fail\"}")
}

check_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  WARN=$((WARN + 1))
  RESULTS+=("{\"check\":\"$1\",\"status\":\"warn\"}")
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  B3 Tactical Ranking - Monitoring Verification${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Account: ${ACCOUNT_ID}"
echo -e "  Region:  ${REGION}"
echo ""

# =============================================================================
# 1. CloudWatch Dashboards (Req 83.8)
# =============================================================================

echo "1. CloudWatch Dashboards (Req 83.8)"
echo "────────────────────────────────────"

EXPECTED_DASHBOARDS=(
  "B3-Dashboard-System-Health"
  "B3-Dashboard-Model-Performance"
  "B3-Dashboard-Cost-Analysis"
)

for DASH in "${EXPECTED_DASHBOARDS[@]}"; do
  DASH_EXISTS=$(aws cloudwatch get-dashboard --dashboard-name "$DASH" \
    --query 'DashboardName' --output text 2>/dev/null || echo "")

  if [ -n "$DASH_EXISTS" ] && [ "$DASH_EXISTS" != "None" ]; then
    check_pass "Dashboard: ${DASH}"
    if $VERBOSE; then
      WIDGET_COUNT=$(aws cloudwatch get-dashboard --dashboard-name "$DASH" \
        --query 'DashboardBody' --output text 2>/dev/null | \
        python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('widgets',[])))" 2>/dev/null || echo "?")
      echo "     Widgets: ${WIDGET_COUNT}"
    fi
  else
    check_fail "Dashboard missing: ${DASH}"
  fi
done
echo ""

# =============================================================================
# 2. CloudWatch Alarms (Req 83.3)
# =============================================================================

echo "2. CloudWatch Alarms (Req 83.3)"
echo "────────────────────────────────"

EXPECTED_ALARMS=(
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

ALARM_OK=0
ALARM_IN_ALARM=0
ALARM_MISSING=0

for ALARM in "${EXPECTED_ALARMS[@]}"; do
  ALARM_STATE=$(aws cloudwatch describe-alarms \
    --alarm-names "$ALARM" \
    --query 'MetricAlarms[0].StateValue' --output text 2>/dev/null || echo "MISSING")

  case "$ALARM_STATE" in
    OK)
      check_pass "Alarm: ${ALARM} [OK]"
      ALARM_OK=$((ALARM_OK + 1))
      ;;
    ALARM)
      check_warn "Alarm: ${ALARM} [IN ALARM]"
      ALARM_IN_ALARM=$((ALARM_IN_ALARM + 1))
      if $VERBOSE; then
        REASON=$(aws cloudwatch describe-alarms \
          --alarm-names "$ALARM" \
          --query 'MetricAlarms[0].StateReason' --output text 2>/dev/null || echo "unknown")
        echo "     Reason: ${REASON}"
      fi
      ;;
    INSUFFICIENT_DATA)
      check_warn "Alarm: ${ALARM} [INSUFFICIENT DATA]"
      ;;
    *)
      check_fail "Alarm missing: ${ALARM}"
      ALARM_MISSING=$((ALARM_MISSING + 1))
      ;;
  esac
done

echo ""
echo "  Summary: ${ALARM_OK} OK, ${ALARM_IN_ALARM} in alarm, ${ALARM_MISSING} missing"
echo ""

# =============================================================================
# 3. SNS Topics & Subscriptions (Req 83.9)
# =============================================================================

echo "3. SNS Topics & Subscriptions (Req 83.9)"
echo "──────────────────────────────────────────"

SNS_TOPICS_TO_CHECK=(
  "b3-dashboard-alarms"
  "b3-dashboard-critical-alarms"
)

for TOPIC_NAME in "${SNS_TOPICS_TO_CHECK[@]}"; do
  TOPIC_ARN=$(aws sns list-topics \
    --query "Topics[?contains(TopicArn, '${TOPIC_NAME}')].TopicArn" \
    --output text 2>/dev/null || echo "")

  if [ -n "$TOPIC_ARN" ] && [ "$TOPIC_ARN" != "None" ]; then
    check_pass "SNS topic: ${TOPIC_NAME}"

    # Check subscriptions
    SUB_COUNT=$(aws sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" \
      --query 'Subscriptions | length(@)' --output text 2>/dev/null || echo "0")

    CONFIRMED=$(aws sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" \
      --query "Subscriptions[?SubscriptionArn!='PendingConfirmation'] | length(@)" \
      --output text 2>/dev/null || echo "0")

    if [ "$CONFIRMED" -gt 0 ] 2>/dev/null; then
      check_pass "  Subscriptions: ${CONFIRMED} confirmed (${SUB_COUNT} total)"
    else
      check_warn "  No confirmed subscriptions (${SUB_COUNT} pending)"
    fi
  else
    check_fail "SNS topic missing: ${TOPIC_NAME}"
  fi
done
echo ""

# =============================================================================
# 4. Sentry Integration (Req 83.4, 83.6)
# =============================================================================

echo "4. Sentry Integration (Req 83.4, 83.6)"
echo "────────────────────────────────────────"

# Check Sentry config file
if [ -f "config/sentry.json" ]; then
  check_pass "Sentry config: config/sentry.json"

  # Validate JSON structure
  if python3 -c "
import json, sys
with open('config/sentry.json') as f:
    cfg = json.load(f)
required = ['project', 'alertRules', 'errorGrouping']
missing = [k for k in required if k not in cfg]
if missing:
    print(f'Missing keys: {missing}', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null; then
    check_pass "Sentry config structure valid"
  else
    check_warn "Sentry config missing required keys"
  fi
else
  check_fail "Sentry config missing: config/sentry.json"
fi

# Check environment variables
if [ -f ".env.production" ]; then
  if grep -q "VITE_SENTRY_DSN" .env.production; then
    check_pass "VITE_SENTRY_DSN configured"
  else
    check_fail "VITE_SENTRY_DSN not in .env.production"
  fi

  if grep -q "VITE_SENTRY_SAMPLE_RATE" .env.production; then
    RATE=$(grep "VITE_SENTRY_SAMPLE_RATE" .env.production | cut -d= -f2)
    if [ "$RATE" = "0" ]; then
      check_warn "Sentry sample rate is 0 (no errors will be captured)"
    else
      check_pass "Sentry sample rate: ${RATE}"
    fi
  else
    check_warn "VITE_SENTRY_SAMPLE_RATE not configured"
  fi
fi
echo ""

# =============================================================================
# 5. CloudWatch Logs (Req 83.4, 83.5)
# =============================================================================

echo "5. CloudWatch Logs (Req 83.4, 83.5)"
echo "─────────────────────────────────────"

EXPECTED_LOG_GROUPS=(
  "/aws/lambda/B3TacticalRanking"
)

# Find all B3-related log groups
B3_LOG_GROUPS=$(aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/B3" \
  --query 'logGroups[].logGroupName' --output text 2>/dev/null || echo "")

if [ -n "$B3_LOG_GROUPS" ]; then
  GROUP_COUNT=$(echo "$B3_LOG_GROUPS" | wc -w)
  check_pass "CloudWatch log groups: ${GROUP_COUNT} found"

  if $VERBOSE; then
    for LG in $B3_LOG_GROUPS; do
      RETENTION=$(aws logs describe-log-groups \
        --log-group-name-prefix "$LG" \
        --query 'logGroups[0].retentionInDays' --output text 2>/dev/null || echo "Never expires")
      echo "     ${LG} (retention: ${RETENTION} days)"
    done
  fi
else
  check_warn "No B3 Lambda log groups found"
fi

# Check X-Ray tracing
if grep -q "ENABLE_XRAY_TRACING=true" .env.production 2>/dev/null; then
  check_pass "X-Ray tracing enabled (Req 83.5)"
else
  check_warn "X-Ray tracing not enabled in .env.production"
fi
echo ""

# =============================================================================
# 6. Health Check Endpoints (Req 83.10)
# =============================================================================

echo "6. Health Check Endpoints (Req 83.10)"
echo "──────────────────────────────────────"

PROD_API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?contains(OutputKey, 'Api')].OutputValue" \
  --output text 2>/dev/null | head -1 || echo "")

if [ -n "$PROD_API_URL" ]; then
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    "${PROD_API_URL}/health" --max-time 10 2>/dev/null || echo "000")

  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
    check_pass "Health endpoint: HTTP ${HTTP_STATUS}"
  elif [ "$HTTP_STATUS" = "403" ]; then
    check_pass "Health endpoint reachable (HTTP 403 - API key required)"
  else
    check_warn "Health endpoint: HTTP ${HTTP_STATUS}"
  fi
else
  check_warn "Could not determine API URL from stack outputs"
fi

# Check synthetics canary
CANARY_STATUS=$(aws synthetics describe-canaries \
  --query "Canaries[?contains(Name, 'b3')].{Name:Name,Status:Status.State}" \
  --output text 2>/dev/null || echo "")

if [ -n "$CANARY_STATUS" ]; then
  check_pass "Synthetics canary found: ${CANARY_STATUS}"
else
  check_warn "No synthetics canary configured"
fi
echo ""

# =============================================================================
# 7. User Analytics (Req 83.11)
# =============================================================================

echo "7. User Analytics (Req 83.11)"
echo "──────────────────────────────"

ANALYTICS_METRICS=("ActiveUsers" "APICallsTotal" "FeatureUsage" "PageViews" "NavigationPatterns")
METRICS_WITH_DATA=0

for METRIC in "${ANALYTICS_METRICS[@]}"; do
  HAS_DATA=$(aws cloudwatch list-metrics \
    --namespace "${NAMESPACE}" \
    --metric-name "${METRIC}" \
    --query 'Metrics | length(@)' --output text 2>/dev/null || echo "0")

  if [ "$HAS_DATA" -gt 0 ] 2>/dev/null; then
    check_pass "Analytics metric registered: ${METRIC}"
    METRICS_WITH_DATA=$((METRICS_WITH_DATA + 1))
  else
    check_warn "Analytics metric not found: ${METRIC}"
  fi
done

echo "  ${METRICS_WITH_DATA}/${#ANALYTICS_METRICS[@]} analytics metrics active"
echo ""

# =============================================================================
# 8. On-Call Rotation
# =============================================================================

echo "8. On-Call Rotation"
echo "───────────────────"

if [ -f "config/on-call-rotation.json" ]; then
  check_pass "On-call rotation config exists"

  # Validate structure
  if python3 -c "
import json, sys
with open('config/on-call-rotation.json') as f:
    cfg = json.load(f)
required = ['rotationSchedule', 'escalationPolicy', 'contacts']
missing = [k for k in required if k not in cfg]
if missing:
    print(f'Missing: {missing}', file=sys.stderr)
    sys.exit(1)
contacts = cfg.get('contacts', [])
if len(contacts) < 2:
    print('Warning: fewer than 2 contacts', file=sys.stderr)
    sys.exit(2)
" 2>/dev/null; then
    check_pass "On-call config structure valid"
  else
    check_warn "On-call config may be incomplete"
  fi
else
  check_fail "On-call rotation config missing: config/on-call-rotation.json"
fi
echo ""

# =============================================================================
# 9. Operational Reports (Req 83.12)
# =============================================================================

echo "9. Operational Reports (Req 83.12)"
echo "───────────────────────────────────"

REPORT_LAMBDA=$(aws lambda list-functions \
  --query "Functions[?contains(FunctionName, 'report') || contains(FunctionName, 'Report')].FunctionName" \
  --output text 2>/dev/null | head -1)

if [ -n "$REPORT_LAMBDA" ]; then
  check_pass "Report Lambda: ${REPORT_LAMBDA}"
else
  check_warn "No operational report Lambda found"
fi

REPORT_RULE=$(aws events list-rules \
  --query "Rules[?contains(Name, 'report') || contains(Name, 'Report')].State" \
  --output text 2>/dev/null || echo "")

if [ -n "$REPORT_RULE" ]; then
  check_pass "Report schedule: ${REPORT_RULE}"
else
  check_warn "No scheduled report rule found"
fi
echo ""

# =============================================================================
# Summary
# =============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Monitoring Verification Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${GREEN}Passed:   ${PASS}${NC}"
echo -e "  ${YELLOW}Warnings: ${WARN}${NC}"
echo -e "  ${RED}Failed:   ${FAIL}${NC}"
echo ""

# JSON output
if $JSON_OUTPUT; then
  echo ""
  echo "{"
  echo "  \"timestamp\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\","
  echo "  \"passed\": ${PASS},"
  echo "  \"warnings\": ${WARN},"
  echo "  \"failed\": ${FAIL},"
  echo "  \"checks\": [$(IFS=,; echo "${RESULTS[*]}")]"
  echo "}"
fi

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}❌ Monitoring verification found failures. Run setup-production-monitoring.sh to fix.${NC}"
  exit 1
elif [ "$WARN" -gt 3 ]; then
  echo -e "${YELLOW}⚠️  Monitoring partially configured. Some components need attention.${NC}"
  exit 0
else
  echo -e "${GREEN}✅ All monitoring components verified!${NC}"
  exit 0
fi
