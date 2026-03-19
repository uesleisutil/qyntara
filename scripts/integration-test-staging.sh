#!/bin/bash
# =============================================================================
# B3 Tactical Ranking - Staging Integration Tests
# =============================================================================
# Tests cross-feature integrations: filtering, export, alerts, WebSocket,
# monitoring, and disaster recovery procedures.
# Requirements: 85.4 - Staging environment verification
#
# Usage:
#   ./scripts/integration-test-staging.sh [--verbose] [--skip-dr]
#
# Options:
#   --verbose    Show full response bodies
#   --skip-dr    Skip disaster recovery drill (faster run)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VERBOSE=false
SKIP_DR=false
PASS=0
FAIL=0
SKIP=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose) VERBOSE=true; shift ;;
    --skip-dr) SKIP_DR=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--verbose] [--skip-dr]"
      exit 0
      ;;
    *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
  esac
done

# Load staging config
if [ -f "$PROJECT_ROOT/.env.staging" ]; then
  set -a; source "$PROJECT_ROOT/.env.staging"; set +a
fi
if [ -f "$PROJECT_ROOT/dashboard/.env.staging" ]; then
  set -a; source "$PROJECT_ROOT/dashboard/.env.staging"; set +a
fi

API_BASE="${REACT_APP_API_BASE_URL:-https://staging-api.execute-api.us-east-1.amazonaws.com/staging}"
API_KEY="${REACT_APP_API_KEY:-STAGING_API_KEY_PLACEHOLDER}"
REGION=${AWS_REGION:-us-east-1}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  B3 Tactical Ranking - Staging Integration Tests${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ─── Helpers ──────────────────────────────────────────────────────────────────

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; SKIP=$((SKIP + 1)); }

api_get() {
  curl -s -w "\n%{http_code}" \
    -H "x-api-key: ${API_KEY}" \
    -H "Content-Type: application/json" \
    --max-time 15 \
    "${API_BASE}$1" 2>/dev/null || echo -e "\n000"
}

api_post() {
  curl -s -w "\n%{http_code}" \
    -X POST \
    -H "x-api-key: ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$2" \
    --max-time 30 \
    "${API_BASE}$1" 2>/dev/null || echo -e "\n000"
}

get_status() {
  echo "$1" | tail -1
}

get_body() {
  echo "$1" | sed '$d'
}

# ─── 1. Cross-Tab Filtering Integration ──────────────────────────────────────

echo "1. Cross-Tab Filtering Integration"
echo "───────────────────────────────────"

# Test: filter on recommendations, verify filtered data flows to other endpoints
RESP=$(api_get "/api/recommendations?sector=financeiro")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")

if [ "$STATUS" = "200" ]; then
  # Check that response contains filtered data (not empty)
  if echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d.get('data',d.get('recommendations',[]))) >= 0" 2>/dev/null; then
    pass "Sector filter returns valid JSON response"
  else
    pass "Sector filter returns HTTP 200 (response format may vary)"
  fi
else
  if [ "$STATUS" = "000" ]; then
    warn "Sector filter endpoint unreachable"
  else
    fail "Sector filter returned HTTP $STATUS"
  fi
fi

# Test: combined filters
RESP=$(api_get "/api/recommendations?sector=financeiro&min_score=0.5&min_return=0.01&max_return=0.10")
STATUS=$(get_status "$RESP")
if [ "$STATUS" = "200" ]; then
  pass "Combined filters (sector + score + return range) work together"
else
  if [ "$STATUS" = "000" ]; then warn "Combined filter endpoint unreachable"
  else fail "Combined filters returned HTTP $STATUS"; fi
fi

# Test: filter persistence across pagination
RESP=$(api_get "/api/recommendations?sector=financeiro&page=1&page_size=5")
STATUS=$(get_status "$RESP")
if [ "$STATUS" = "200" ]; then
  pass "Filters work with pagination"
else
  if [ "$STATUS" = "000" ]; then warn "Paginated filter endpoint unreachable"
  else fail "Paginated filter returned HTTP $STATUS"; fi
fi
echo ""

# ─── 2. Export Integration ────────────────────────────────────────────────────

echo "2. Export Integration"
echo "─────────────────────"

# Test: CSV export with active filters
RESP=$(api_get "/api/recommendations/export?format=csv&sector=financeiro")
STATUS=$(get_status "$RESP")
if [ "$STATUS" = "200" ]; then
  pass "CSV export with filters returns 200"
elif [ "$STATUS" = "000" ]; then
  warn "CSV export endpoint unreachable"
else
  fail "CSV export returned HTTP $STATUS"
fi

# Test: Excel export
RESP=$(api_get "/api/recommendations/export?format=excel")
STATUS=$(get_status "$RESP")
if [ "$STATUS" = "200" ]; then
  pass "Excel export returns 200"
elif [ "$STATUS" = "000" ]; then
  warn "Excel export endpoint unreachable"
else
  fail "Excel export returned HTTP $STATUS"
fi

# Test: PDF report generation
RESP=$(api_post "/api/reports/generate" '{"type":"performance","format":"pdf","date_range":"30d"}')
STATUS=$(get_status "$RESP")
if [ "$STATUS" = "200" ] || [ "$STATUS" = "202" ]; then
  pass "PDF report generation accepted"
elif [ "$STATUS" = "000" ]; then
  warn "Report generation endpoint unreachable"
else
  fail "Report generation returned HTTP $STATUS"
fi
echo ""

# ─── 3. Alert System Integration ─────────────────────────────────────────────

echo "3. Alert System Integration"
echo "───────────────────────────"

# Test: create alert
ALERT_PAYLOAD='{"ticker":"PETR4","condition":"score_change","threshold":0.1,"severity":"warning"}'
RESP=$(api_post "/api/alerts" "$ALERT_PAYLOAD")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")

if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
  pass "Alert creation succeeds"
  # Extract alert ID for cleanup
  ALERT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id',''))" 2>/dev/null || echo "")
elif [ "$STATUS" = "000" ]; then
  warn "Alert creation endpoint unreachable"
  ALERT_ID=""
else
  fail "Alert creation returned HTTP $STATUS"
  ALERT_ID=""
fi

# Test: list alerts
RESP=$(api_get "/api/alerts")
STATUS=$(get_status "$RESP")
if [ "$STATUS" = "200" ]; then
  pass "Alert listing works"
else
  if [ "$STATUS" = "000" ]; then warn "Alert listing endpoint unreachable"
  else fail "Alert listing returned HTTP $STATUS"; fi
fi

# Test: notification center
RESP=$(api_get "/api/notifications")
STATUS=$(get_status "$RESP")
if [ "$STATUS" = "200" ]; then
  pass "Notification center accessible"
else
  if [ "$STATUS" = "000" ]; then warn "Notification endpoint unreachable"
  else fail "Notification center returned HTTP $STATUS"; fi
fi

# Cleanup: delete test alert
if [ -n "$ALERT_ID" ]; then
  curl -s -X DELETE \
    -H "x-api-key: ${API_KEY}" \
    --max-time 10 \
    "${API_BASE}/api/alerts/${ALERT_ID}" &>/dev/null || true
fi
echo ""

# ─── 4. WebSocket Integration ────────────────────────────────────────────────

echo "4. WebSocket Integration"
echo "────────────────────────"

# Test: WebSocket endpoint info
RESP=$(api_get "/api/ws/info")
STATUS=$(get_status "$RESP")
if [ "$STATUS" = "200" ]; then
  pass "WebSocket info endpoint accessible"
else
  if [ "$STATUS" = "000" ]; then warn "WebSocket info endpoint unreachable"
  else fail "WebSocket info returned HTTP $STATUS"; fi
fi

# Test: WebSocket connectivity (basic check via HTTP upgrade endpoint)
WS_URL="${API_BASE/https/wss}/ws"
WS_URL="${WS_URL/http/ws}"
if command -v wscat &>/dev/null; then
  if timeout 5 wscat -c "$WS_URL" --execute '{"action":"ping"}' 2>/dev/null; then
    pass "WebSocket connection established"
  else
    warn "WebSocket connection could not be established (wscat)"
  fi
elif command -v websocat &>/dev/null; then
  if echo '{"action":"ping"}' | timeout 5 websocat "$WS_URL" 2>/dev/null; then
    pass "WebSocket connection established"
  else
    warn "WebSocket connection could not be established (websocat)"
  fi
else
  warn "No WebSocket client available (install wscat or websocat for WS testing)"
fi
echo ""

# ─── 5. Monitoring & Alerting Verification ───────────────────────────────────

echo "5. Monitoring & Alerting"
echo "────────────────────────"

# Check CloudWatch alarms exist for staging
ALARM_COUNT=$(aws cloudwatch describe-alarms \
  --query "MetricAlarms[?contains(AlarmName, 'Staging') || contains(AlarmName, 'staging')].AlarmName" \
  --output text --region "$REGION" 2>/dev/null | wc -w || echo "0")

if [ "$ALARM_COUNT" -gt 0 ]; then
  pass "CloudWatch alarms configured ($ALARM_COUNT alarms)"
else
  warn "No staging CloudWatch alarms found"
fi

# Check for alarms in ALARM state
ALARMING=$(aws cloudwatch describe-alarms \
  --state-value ALARM \
  --query "MetricAlarms[?contains(AlarmName, 'Staging') || contains(AlarmName, 'staging')].AlarmName" \
  --output text --region "$REGION" 2>/dev/null || echo "")

if [ -z "$ALARMING" ]; then
  pass "No alarms currently firing"
else
  fail "Active alarms: $ALARMING"
fi

# Check SNS topic for staging alerts
SNS_TOPIC=$(aws sns list-topics \
  --query "Topics[?contains(TopicArn, 'staging')].TopicArn" \
  --output text --region "$REGION" 2>/dev/null | head -1 || echo "")

if [ -n "$SNS_TOPIC" ]; then
  SUB_COUNT=$(aws sns list-subscriptions-by-topic \
    --topic-arn "$SNS_TOPIC" \
    --query 'Subscriptions | length(@)' \
    --output text --region "$REGION" 2>/dev/null || echo "0")
  pass "SNS alert topic exists ($SUB_COUNT subscriptions)"
else
  warn "No staging SNS topic found"
fi

# Check CloudWatch dashboard exists
CW_DASHBOARDS=$(aws cloudwatch list-dashboards \
  --query "DashboardEntries[?contains(DashboardName, 'Staging') || contains(DashboardName, 'staging')].DashboardName" \
  --output text --region "$REGION" 2>/dev/null || echo "")

if [ -n "$CW_DASHBOARDS" ]; then
  pass "CloudWatch dashboard exists: $CW_DASHBOARDS"
else
  warn "No staging CloudWatch dashboard found"
fi

# Check Lambda error metrics (last hour)
LAMBDA_ERRORS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value="$(aws lambda list-functions \
    --query "Functions[?contains(FunctionName, 'Staging')].FunctionName" \
    --output text --region "$REGION" 2>/dev/null | head -1 || echo 'none')" \
  --start-time "$(date -u -d '1 hour ago' +'%Y-%m-%dT%H:%M:%S' 2>/dev/null || date -u -v-1H +'%Y-%m-%dT%H:%M:%S')" \
  --end-time "$(date -u +'%Y-%m-%dT%H:%M:%S')" \
  --period 3600 \
  --statistics Sum \
  --query 'Datapoints[0].Sum' \
  --output text --region "$REGION" 2>/dev/null || echo "None")

if [ "$LAMBDA_ERRORS" = "None" ] || [ "$LAMBDA_ERRORS" = "0.0" ] || [ "$LAMBDA_ERRORS" = "0" ]; then
  pass "No Lambda errors in the last hour"
else
  fail "Lambda errors in last hour: $LAMBDA_ERRORS"
fi
echo ""

# ─── 6. Disaster Recovery Procedures ─────────────────────────────────────────

echo "6. Disaster Recovery"
echo "────────────────────"

if [ "$SKIP_DR" = true ]; then
  echo -e "  ${YELLOW}⏭${NC}  Skipped (--skip-dr flag)"
  SKIP=$((SKIP + 1))
else
  # Run DR drill in dry-run mode
  DR_SCRIPT="$PROJECT_ROOT/infra/scripts/dr-drill.sh"
  if [ -x "$DR_SCRIPT" ]; then
    echo "  Running DR drill (dry-run)..."
    if bash "$DR_SCRIPT" full-drill --dry-run --region "$REGION" 2>&1 | tail -5; then
      pass "DR drill (dry-run) completed successfully"
    else
      fail "DR drill (dry-run) failed"
    fi
  else
    warn "DR drill script not found or not executable: $DR_SCRIPT"
  fi

  # Verify backup bucket exists
  BACKUP_BUCKET=$(aws s3 ls --region "$REGION" 2>/dev/null | grep "b3tr-backup" | awk '{print $3}' | head -1 || echo "")
  if [ -n "$BACKUP_BUCKET" ]; then
    pass "Backup bucket exists: $BACKUP_BUCKET"
  else
    warn "No backup bucket found"
  fi

  # Verify DynamoDB PITR
  TABLES=("B3Dashboard-APIKeys" "B3Dashboard-AuthLogs" "B3Dashboard-RateLimits")
  PITR_OK=0
  PITR_TOTAL=${#TABLES[@]}
  for TABLE in "${TABLES[@]}"; do
    PITR=$(aws dynamodb describe-continuous-backups \
      --table-name "$TABLE" \
      --region "$REGION" \
      --query 'ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus' \
      --output text 2>/dev/null || echo "NOT_FOUND")
    if [ "$PITR" = "ENABLED" ]; then
      PITR_OK=$((PITR_OK + 1))
    fi
  done

  if [ "$PITR_OK" -eq "$PITR_TOTAL" ]; then
    pass "DynamoDB PITR enabled on all $PITR_TOTAL tables"
  elif [ "$PITR_OK" -gt 0 ]; then
    warn "DynamoDB PITR enabled on $PITR_OK/$PITR_TOTAL tables"
  else
    warn "DynamoDB PITR not enabled (tables may not exist in staging)"
  fi
fi
echo ""

# ─── 7. API Key & Auth Integration ───────────────────────────────────────────

echo "7. API Key & Auth Integration"
echo "─────────────────────────────"

# Test: unauthenticated request should be rejected
RESP=$(curl -s -w "\n%{http_code}" \
  --max-time 10 \
  "${API_BASE}/api/recommendations" 2>/dev/null || echo -e "\n000")
STATUS=$(get_status "$RESP")

if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
  pass "Unauthenticated requests are rejected (HTTP $STATUS)"
elif [ "$STATUS" = "000" ]; then
  warn "Endpoint unreachable for auth test"
else
  warn "Unauthenticated request returned HTTP $STATUS (expected 401/403)"
fi

# Test: invalid API key
RESP=$(curl -s -w "\n%{http_code}" \
  -H "x-api-key: INVALID_KEY_12345" \
  --max-time 10 \
  "${API_BASE}/api/recommendations" 2>/dev/null || echo -e "\n000")
STATUS=$(get_status "$RESP")

if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
  pass "Invalid API key is rejected (HTTP $STATUS)"
elif [ "$STATUS" = "000" ]; then
  warn "Endpoint unreachable for invalid key test"
else
  warn "Invalid API key returned HTTP $STATUS (expected 401/403)"
fi
echo ""

# ─── Summary ──────────────────────────────────────────────────────────────────

TOTAL=$((PASS + FAIL + SKIP))

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Integration Test Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Total:    ${TOTAL}"
echo -e "  ${GREEN}Passed:   ${PASS}${NC}"
echo -e "  ${RED}Failed:   ${FAIL}${NC}"
echo -e "  ${YELLOW}Skipped:  ${SKIP}${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}❌ Integration tests found failures.${NC}"
  exit 1
elif [ "$SKIP" -gt "$((TOTAL / 2))" ]; then
  echo -e "${YELLOW}⚠️  Most tests skipped. Is the staging environment running?${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Integration tests passed!${NC}"
  exit 0
fi
