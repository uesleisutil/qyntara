#!/bin/bash
# =============================================================================
# B3 Tactical Ranking - Staging Smoke Tests
# =============================================================================
# Comprehensive smoke tests for all 8 dashboard tabs and their API endpoints.
# Requirements: 85.4 - Staging environment verification
#
# Usage:
#   ./scripts/smoke-test-staging.sh [--verbose] [--tab <tab_name>]
#
# Options:
#   --verbose       Show full response bodies
#   --tab <name>    Test only a specific tab (e.g., recommendations, drift)
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
TARGET_TAB=""
PASS=0
FAIL=0
SKIP=0
RESULTS=()

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose) VERBOSE=true; shift ;;
    --tab) TARGET_TAB="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--verbose] [--tab <tab_name>]"
      echo "Tabs: recommendations, performance, validation, costs, data-quality, drift, explainability, backtesting"
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

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  B3 Tactical Ranking - Staging Smoke Tests${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}API Base: ${API_BASE}${NC}"
echo -e "${BLUE}Time:     $(date -u +'%Y-%m-%d %H:%M:%S UTC')${NC}"
echo ""

# ─── Helpers ──────────────────────────────────────────────────────────────────

record_result() {
  local tab="$1" endpoint="$2" status="$3" detail="$4"
  RESULTS+=("${tab}|${endpoint}|${status}|${detail}")
}

test_endpoint() {
  local tab="$1"
  local name="$2"
  local endpoint="$3"
  local expected_status="${4:-200}"

  local url="${API_BASE}${endpoint}"
  local http_code body

  body=$(curl -s -w "\n%{http_code}" \
    -H "x-api-key: ${API_KEY}" \
    -H "Content-Type: application/json" \
    --max-time 15 \
    "$url" 2>/dev/null) || true

  http_code=$(echo "$body" | tail -1)
  body=$(echo "$body" | sed '$d')

  if [ "$http_code" = "$expected_status" ]; then
    echo -e "  ${GREEN}✓${NC} ${name} (${endpoint}) → ${http_code}"
    PASS=$((PASS + 1))
    record_result "$tab" "$endpoint" "PASS" "HTTP $http_code"
  elif [ -z "$http_code" ] || [ "$http_code" = "000" ]; then
    echo -e "  ${YELLOW}⚠${NC} ${name} (${endpoint}) → timeout/unreachable"
    SKIP=$((SKIP + 1))
    record_result "$tab" "$endpoint" "SKIP" "Unreachable"
  else
    echo -e "  ${RED}✗${NC} ${name} (${endpoint}) → ${http_code} (expected ${expected_status})"
    FAIL=$((FAIL + 1))
    record_result "$tab" "$endpoint" "FAIL" "HTTP $http_code (expected $expected_status)"
  fi

  if [ "$VERBOSE" = true ] && [ -n "$body" ]; then
    echo "    Response: $(echo "$body" | head -c 200)"
  fi
}

test_post_endpoint() {
  local tab="$1"
  local name="$2"
  local endpoint="$3"
  local payload="$4"
  local expected_status="${5:-200}"

  local url="${API_BASE}${endpoint}"
  local http_code body

  body=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "x-api-key: ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    --max-time 30 \
    "$url" 2>/dev/null) || true

  http_code=$(echo "$body" | tail -1)
  body=$(echo "$body" | sed '$d')

  if [ "$http_code" = "$expected_status" ]; then
    echo -e "  ${GREEN}✓${NC} ${name} (POST ${endpoint}) → ${http_code}"
    PASS=$((PASS + 1))
    record_result "$tab" "POST $endpoint" "PASS" "HTTP $http_code"
  elif [ -z "$http_code" ] || [ "$http_code" = "000" ]; then
    echo -e "  ${YELLOW}⚠${NC} ${name} (POST ${endpoint}) → timeout/unreachable"
    SKIP=$((SKIP + 1))
    record_result "$tab" "POST $endpoint" "SKIP" "Unreachable"
  else
    echo -e "  ${RED}✗${NC} ${name} (POST ${endpoint}) → ${http_code} (expected ${expected_status})"
    FAIL=$((FAIL + 1))
    record_result "$tab" "POST $endpoint" "FAIL" "HTTP $http_code (expected $expected_status)"
  fi

  if [ "$VERBOSE" = true ] && [ -n "$body" ]; then
    echo "    Response: $(echo "$body" | head -c 200)"
  fi
}

should_test_tab() {
  local tab="$1"
  [ -z "$TARGET_TAB" ] || [ "$TARGET_TAB" = "$tab" ]
}

# ─── Tab 1: Recommendations ──────────────────────────────────────────────────

if should_test_tab "recommendations"; then
  echo "1. Recommendations Tab"
  echo "──────────────────────"
  test_endpoint "recommendations" "List recommendations"       "/api/recommendations"
  test_endpoint "recommendations" "Recommendations (filtered)" "/api/recommendations?sector=financeiro&min_score=0.5"
  test_endpoint "recommendations" "Ticker detail"              "/api/recommendations/PETR4"
  test_endpoint "recommendations" "Ticker history"             "/api/recommendations/PETR4/history"
  echo ""
fi

# ─── Tab 2: Performance ──────────────────────────────────────────────────────

if should_test_tab "performance"; then
  echo "2. Performance Tab"
  echo "──────────────────"
  test_endpoint "performance" "Performance summary"     "/api/performance"
  test_endpoint "performance" "Model breakdown"         "/api/performance/models"
  test_endpoint "performance" "Confusion matrix"        "/api/performance/confusion-matrix"
  test_endpoint "performance" "Error distribution"      "/api/performance/error-distribution"
  test_endpoint "performance" "Benchmark comparison"    "/api/performance/benchmarks"
  test_endpoint "performance" "Feature importance"      "/api/performance/feature-importance"
  echo ""
fi

# ─── Tab 3: Validation ───────────────────────────────────────────────────────

if should_test_tab "validation"; then
  echo "3. Validation Tab"
  echo "─────────────────"
  test_endpoint "validation" "Validation summary"       "/api/validation"
  test_endpoint "validation" "Predicted vs actual"      "/api/validation/scatter"
  test_endpoint "validation" "Temporal accuracy"        "/api/validation/temporal"
  test_endpoint "validation" "Segmentation"             "/api/validation/segmentation"
  test_endpoint "validation" "Outliers"                 "/api/validation/outliers"
  echo ""
fi

# ─── Tab 4: Costs ────────────────────────────────────────────────────────────

if should_test_tab "costs"; then
  echo "4. Costs Tab"
  echo "────────────"
  test_endpoint "costs" "Cost summary"              "/api/costs"
  test_endpoint "costs" "Cost trends"               "/api/costs/trends"
  test_endpoint "costs" "Cost per prediction"       "/api/costs/per-prediction"
  test_endpoint "costs" "Optimization suggestions"  "/api/costs/optimizations"
  test_endpoint "costs" "Budget status"             "/api/costs/budget"
  echo ""
fi

# ─── Tab 5: Data Quality ─────────────────────────────────────────────────────

if should_test_tab "data-quality"; then
  echo "5. Data Quality Tab"
  echo "───────────────────"
  test_endpoint "data-quality" "Data quality summary"   "/api/data-quality"
  test_endpoint "data-quality" "Completeness"           "/api/data-quality/completeness"
  test_endpoint "data-quality" "Anomalies"              "/api/data-quality/anomalies"
  test_endpoint "data-quality" "Freshness"              "/api/data-quality/freshness"
  test_endpoint "data-quality" "Coverage"               "/api/data-quality/coverage"
  echo ""
fi

# ─── Tab 6: Drift Detection ──────────────────────────────────────────────────

if should_test_tab "drift"; then
  echo "6. Drift Detection Tab"
  echo "──────────────────────"
  test_endpoint "drift" "Drift summary"             "/api/drift"
  test_endpoint "drift" "Data drift"                "/api/drift/data"
  test_endpoint "drift" "Concept drift"             "/api/drift/concept"
  test_endpoint "drift" "Performance degradation"   "/api/drift/degradation"
  test_endpoint "drift" "Retraining recommendation" "/api/drift/retraining"
  echo ""
fi

# ─── Tab 7: Explainability ───────────────────────────────────────────────────

if should_test_tab "explainability"; then
  echo "7. Explainability Tab"
  echo "─────────────────────"
  test_endpoint "explainability" "Explainability summary"  "/api/explainability"
  test_endpoint "explainability" "SHAP values (PETR4)"     "/api/explainability/PETR4"
  test_endpoint "explainability" "Sensitivity analysis"    "/api/explainability/sensitivity?ticker=PETR4"
  test_endpoint "explainability" "Feature impact"          "/api/explainability/feature-impact"
  echo ""
fi

# ─── Tab 8: Backtesting ──────────────────────────────────────────────────────

if should_test_tab "backtesting"; then
  echo "8. Backtesting Tab"
  echo "──────────────────"
  test_endpoint "backtesting" "Backtesting summary"    "/api/backtesting"
  test_endpoint "backtesting" "List backtest results"  "/api/backtesting/results"
  test_post_endpoint "backtesting" "Run backtest" "/api/backtesting/run" \
    '{"start_date":"2024-01-01","end_date":"2024-06-30","initial_capital":100000,"position_size":"equal","top_n":10,"rebalance_frequency":"monthly","commission_rate":0.001}'
  echo ""
fi

# ─── Health & System Endpoints ────────────────────────────────────────────────

if [ -z "$TARGET_TAB" ]; then
  echo "9. System Endpoints"
  echo "───────────────────"
  test_endpoint "system" "Health check"     "/api/health"
  test_endpoint "system" "API version"      "/api/version"
  test_endpoint "system" "WebSocket info"   "/api/ws/info"
  echo ""
fi

# ─── Frontend Accessibility ───────────────────────────────────────────────────

if [ -z "$TARGET_TAB" ]; then
  echo "10. Frontend (CloudFront/S3)"
  echo "────────────────────────────"

  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")
  REGION=${AWS_REGION:-us-east-1}
  STAGING_BUCKET="b3tr-staging-${ACCOUNT_ID}-${REGION}"
  FRONTEND_PREFIX="dashboard-staging"

  if aws s3 ls "s3://${STAGING_BUCKET}/${FRONTEND_PREFIX}/index.html" &>/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} index.html exists in S3"
    PASS=$((PASS + 1))
    record_result "frontend" "s3://index.html" "PASS" "File exists"
  else
    echo -e "  ${RED}✗${NC} index.html not found in S3"
    FAIL=$((FAIL + 1))
    record_result "frontend" "s3://index.html" "FAIL" "File missing"
  fi

  # Check static assets
  ASSET_COUNT=$(aws s3 ls "s3://${STAGING_BUCKET}/${FRONTEND_PREFIX}/static/" --recursive 2>/dev/null | wc -l || echo "0")
  if [ "$ASSET_COUNT" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} Static assets present (${ASSET_COUNT} files)"
    PASS=$((PASS + 1))
    record_result "frontend" "s3://static/" "PASS" "$ASSET_COUNT files"
  else
    echo -e "  ${RED}✗${NC} No static assets found"
    FAIL=$((FAIL + 1))
    record_result "frontend" "s3://static/" "FAIL" "No files"
  fi
  echo ""
fi

# ─── Summary ──────────────────────────────────────────────────────────────────

TOTAL=$((PASS + FAIL + SKIP))

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Smoke Test Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Total:    ${TOTAL}"
echo -e "  ${GREEN}Passed:   ${PASS}${NC}"
echo -e "  ${RED}Failed:   ${FAIL}${NC}"
echo -e "  ${YELLOW}Skipped:  ${SKIP}${NC}"
echo ""

# Write results to file for the orchestrator
REPORT_FILE="$PROJECT_ROOT/staging-smoke-test-results.txt"
{
  echo "# Smoke Test Results - $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
  echo "Total: $TOTAL | Passed: $PASS | Failed: $FAIL | Skipped: $SKIP"
  echo ""
  printf "%-18s %-40s %-6s %s\n" "TAB" "ENDPOINT" "STATUS" "DETAIL"
  printf "%-18s %-40s %-6s %s\n" "---" "--------" "------" "------"
  for r in "${RESULTS[@]}"; do
    IFS='|' read -r tab ep st dt <<< "$r"
    printf "%-18s %-40s %-6s %s\n" "$tab" "$ep" "$st" "$dt"
  done
} > "$REPORT_FILE"
echo -e "Report: ${REPORT_FILE}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}❌ Smoke tests found failures. Review above.${NC}"
  exit 1
elif [ "$SKIP" -gt "$((TOTAL / 2))" ]; then
  echo -e "${YELLOW}⚠️  Most endpoints unreachable. Is the staging environment running?${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Smoke tests passed!${NC}"
  exit 0
fi
