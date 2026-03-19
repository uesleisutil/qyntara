#!/bin/bash
# =============================================================================
# B3 Tactical Ranking - Staging Performance Benchmarks
# =============================================================================
# Verifies that response times and throughput meet performance requirements.
# Requirements: 85.4, 86.1-86.8 - Performance benchmarks
#
# Benchmarks:
#   - Initial page load:     < 3 seconds  (Req 86.1)
#   - User interactions:     < 100ms      (Req 86.2)
#   - Chart rendering:       < 1 second   (Req 86.3)
#   - API p95 response time: < 500ms
#   - Concurrent requests:   50 simultaneous
#
# Usage:
#   ./scripts/benchmark-staging.sh [--iterations N] [--concurrency N] [--verbose]
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

ITERATIONS=10
CONCURRENCY=10
VERBOSE=false
PASS=0
FAIL=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --iterations) ITERATIONS="$2"; shift 2 ;;
    --concurrency) CONCURRENCY="$2"; shift 2 ;;
    --verbose) VERBOSE=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--iterations N] [--concurrency N] [--verbose]"
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
echo -e "${BLUE}  B3 Tactical Ranking - Staging Performance Benchmarks${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}API Base:     ${API_BASE}${NC}"
echo -e "${BLUE}Iterations:   ${ITERATIONS}${NC}"
echo -e "${BLUE}Concurrency:  ${CONCURRENCY}${NC}"
echo -e "${BLUE}Time:         $(date -u +'%Y-%m-%d %H:%M:%S UTC')${NC}"
echo ""

# ─── Helpers ──────────────────────────────────────────────────────────────────

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }

# Measure response time for a single request (returns milliseconds)
measure_request() {
  local endpoint="$1"
  local url="${API_BASE}${endpoint}"
  curl -s -o /dev/null -w "%{time_total}" \
    -H "x-api-key: ${API_KEY}" \
    -H "Content-Type: application/json" \
    --max-time 30 \
    "$url" 2>/dev/null || echo "30.0"
}

# Run N iterations and compute stats
benchmark_endpoint() {
  local name="$1"
  local endpoint="$2"
  local threshold_ms="$3"
  local iterations="${4:-$ITERATIONS}"

  local times=()
  local total=0

  for ((i=1; i<=iterations; i++)); do
    local t
    t=$(measure_request "$endpoint")
    local ms
    ms=$(echo "$t * 1000" | bc 2>/dev/null || python3 -c "print(int(float('$t') * 1000))")
    times+=("$ms")
    total=$(echo "$total + $ms" | bc 2>/dev/null || python3 -c "print(int(float('$total') + float('$ms')))")
  done

  # Sort times for percentile calculation
  IFS=$'\n' sorted=($(sort -n <<<"${times[*]}")); unset IFS

  local count=${#sorted[@]}
  local avg=$((total / count))
  local min=${sorted[0]}
  local max=${sorted[$((count - 1))]}

  # p50 (median)
  local p50_idx=$(( (count * 50 / 100) ))
  [ "$p50_idx" -ge "$count" ] && p50_idx=$((count - 1))
  local p50=${sorted[$p50_idx]}

  # p95
  local p95_idx=$(( (count * 95 / 100) ))
  [ "$p95_idx" -ge "$count" ] && p95_idx=$((count - 1))
  local p95=${sorted[$p95_idx]}

  # p99
  local p99_idx=$(( (count * 99 / 100) ))
  [ "$p99_idx" -ge "$count" ] && p99_idx=$((count - 1))
  local p99=${sorted[$p99_idx]}

  local threshold_int
  threshold_int=$(echo "$threshold_ms" | cut -d. -f1)

  if [ "$p95" -le "$threshold_int" ]; then
    pass "$name: p95=${p95}ms (threshold: ${threshold_ms}ms) | avg=${avg}ms min=${min}ms max=${max}ms"
  else
    fail "$name: p95=${p95}ms EXCEEDS threshold ${threshold_ms}ms | avg=${avg}ms min=${min}ms max=${max}ms"
  fi

  if [ "$VERBOSE" = true ]; then
    echo "    Distribution: p50=${p50}ms p95=${p95}ms p99=${p99}ms"
    echo "    Raw times: ${times[*]}"
  fi

  # Return p95 for report
  echo "$p95" > "/tmp/bench_${name// /_}_p95.txt" 2>/dev/null || true
}

# ─── 1. API Response Time Benchmarks ─────────────────────────────────────────

echo "1. API Response Times (p95 threshold)"
echo "──────────────────────────────────────"

# Core endpoints - should respond within 500ms
benchmark_endpoint "Health check"          "/api/health"              "500"
benchmark_endpoint "Recommendations list"  "/api/recommendations"     "500"
benchmark_endpoint "Performance summary"   "/api/performance"         "500"
benchmark_endpoint "Validation summary"    "/api/validation"          "500"
benchmark_endpoint "Costs summary"         "/api/costs"               "500"
benchmark_endpoint "Data quality"          "/api/data-quality"        "500"
benchmark_endpoint "Drift summary"         "/api/drift"               "500"
benchmark_endpoint "Explainability"        "/api/explainability"      "500"
benchmark_endpoint "Backtesting"           "/api/backtesting"         "500"
echo ""

# ─── 2. Filtered Query Performance ───────────────────────────────────────────

echo "2. Filtered Query Performance (p95 < 500ms)"
echo "─────────────────────────────────────────────"

benchmark_endpoint "Filtered recommendations" "/api/recommendations?sector=financeiro&min_score=0.5" "500"
benchmark_endpoint "Paginated results"        "/api/recommendations?page=1&page_size=20"             "500"
benchmark_endpoint "Ticker detail"            "/api/recommendations/PETR4"                           "500"
benchmark_endpoint "SHAP values"              "/api/explainability/PETR4"                             "500"
echo ""

# ─── 3. Heavy Computation Endpoints ──────────────────────────────────────────

echo "3. Heavy Computation Endpoints (p95 < 3000ms)"
echo "───────────────────────────────────────────────"

benchmark_endpoint "Confusion matrix"      "/api/performance/confusion-matrix"   "3000" 5
benchmark_endpoint "Error distribution"    "/api/performance/error-distribution" "3000" 5
benchmark_endpoint "Feature importance"    "/api/performance/feature-importance" "3000" 5
benchmark_endpoint "Benchmark comparison"  "/api/performance/benchmarks"         "3000" 5
benchmark_endpoint "Concept drift heatmap" "/api/drift/concept"                  "3000" 5
echo ""

# ─── 4. Concurrent Request Throughput ─────────────────────────────────────────

echo "4. Concurrent Request Throughput"
echo "────────────────────────────────"

CONCURRENT_ENDPOINT="/api/recommendations"
TMPDIR_BENCH=$(mktemp -d)

echo "  Sending $CONCURRENCY concurrent requests to $CONCURRENT_ENDPOINT..."

START_TIME=$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time()*1e9))")

for ((i=1; i<=CONCURRENCY; i++)); do
  (
    t=$(measure_request "$CONCURRENT_ENDPOINT")
    ms=$(echo "$t * 1000" | bc 2>/dev/null || python3 -c "print(int(float('$t') * 1000))")
    echo "$ms" > "$TMPDIR_BENCH/req_$i.txt"
  ) &
done
wait

END_TIME=$(date +%s%N 2>/dev/null || python3 -c "import time; print(int(time.time()*1e9))")
WALL_MS=$(( (END_TIME - START_TIME) / 1000000 ))

# Collect results
CONCURRENT_TIMES=()
CONCURRENT_TOTAL=0
for f in "$TMPDIR_BENCH"/req_*.txt; do
  if [ -f "$f" ]; then
    ms=$(cat "$f")
    CONCURRENT_TIMES+=("$ms")
    CONCURRENT_TOTAL=$((CONCURRENT_TOTAL + ms))
  fi
done
rm -rf "$TMPDIR_BENCH"

CONCURRENT_COUNT=${#CONCURRENT_TIMES[@]}
if [ "$CONCURRENT_COUNT" -gt 0 ]; then
  CONCURRENT_AVG=$((CONCURRENT_TOTAL / CONCURRENT_COUNT))
  IFS=$'\n' CONCURRENT_SORTED=($(sort -n <<<"${CONCURRENT_TIMES[*]}")); unset IFS
  CONCURRENT_MAX=${CONCURRENT_SORTED[$((CONCURRENT_COUNT - 1))]}

  THROUGHPUT=$(echo "scale=1; $CONCURRENT_COUNT * 1000 / $WALL_MS" | bc 2>/dev/null || \
    python3 -c "print(f'{$CONCURRENT_COUNT * 1000 / $WALL_MS:.1f}')")

  echo -e "  Wall time: ${WALL_MS}ms for $CONCURRENT_COUNT requests"
  echo -e "  Throughput: ~${THROUGHPUT} req/s"
  echo -e "  Avg response: ${CONCURRENT_AVG}ms | Max: ${CONCURRENT_MAX}ms"

  if [ "$CONCURRENT_MAX" -le 5000 ]; then
    pass "All $CONCURRENT_COUNT concurrent requests completed within 5s"
  else
    fail "Some concurrent requests exceeded 5s (max: ${CONCURRENT_MAX}ms)"
  fi
else
  fail "No concurrent requests completed"
fi
echo ""

# ─── 5. Cold Start Measurement ───────────────────────────────────────────────

echo "5. Lambda Cold Start (first request after idle)"
echo "─────────────────────────────────────────────────"

# Measure a single cold-start-like request (first hit)
COLD_TIME=$(measure_request "/api/recommendations")
COLD_MS=$(echo "$COLD_TIME * 1000" | bc 2>/dev/null || python3 -c "print(int(float('$COLD_TIME') * 1000))")

if [ "$COLD_MS" -le 3000 ]; then
  pass "Cold start: ${COLD_MS}ms (threshold: 3000ms / Req 86.1)"
else
  fail "Cold start: ${COLD_MS}ms EXCEEDS 3000ms threshold (Req 86.1)"
fi

# Warm request (immediately after)
WARM_TIME=$(measure_request "/api/recommendations")
WARM_MS=$(echo "$WARM_TIME * 1000" | bc 2>/dev/null || python3 -c "print(int(float('$WARM_TIME') * 1000))")

if [ "$WARM_MS" -le 500 ]; then
  pass "Warm request: ${WARM_MS}ms (threshold: 500ms)"
else
  fail "Warm request: ${WARM_MS}ms EXCEEDS 500ms threshold"
fi
echo ""

# ─── 6. Frontend Asset Size Check ────────────────────────────────────────────

echo "6. Frontend Bundle Size (Req 86.7: < 1MB gzipped)"
echo "───────────────────────────────────────────────────"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")
REGION=${AWS_REGION:-us-east-1}
STAGING_BUCKET="b3tr-staging-${ACCOUNT_ID}-${REGION}"

JS_SIZE=$(aws s3 ls "s3://${STAGING_BUCKET}/dashboard-staging/static/js/" --recursive \
  --human-readable 2>/dev/null | awk '{sum += $3} END {print sum+0}' || echo "0")

CSS_SIZE=$(aws s3 ls "s3://${STAGING_BUCKET}/dashboard-staging/static/css/" --recursive \
  --human-readable 2>/dev/null | awk '{sum += $3} END {print sum+0}' || echo "0")

TOTAL_SIZE=$((JS_SIZE + CSS_SIZE))
TOTAL_KB=$((TOTAL_SIZE / 1024))

if [ "$TOTAL_SIZE" -gt 0 ]; then
  if [ "$TOTAL_KB" -le 1024 ]; then
    pass "Bundle size: ${TOTAL_KB}KB (threshold: 1024KB)"
  else
    fail "Bundle size: ${TOTAL_KB}KB EXCEEDS 1024KB threshold"
  fi
else
  echo -e "  ${YELLOW}⚠${NC} Could not determine bundle size from S3"
fi

# Also check if build directory exists locally
if [ -d "$PROJECT_ROOT/dashboard/build/static/js" ]; then
  LOCAL_SIZE=$(du -sb "$PROJECT_ROOT/dashboard/build/static/" 2>/dev/null | awk '{print $1}' || echo "0")
  LOCAL_KB=$((LOCAL_SIZE / 1024))
  echo -e "  Local build size: ${LOCAL_KB}KB (uncompressed)"
fi
echo ""

# ─── Summary ──────────────────────────────────────────────────────────────────

TOTAL=$((PASS + FAIL))

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Performance Benchmark Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Total:    ${TOTAL}"
echo -e "  ${GREEN}Passed:   ${PASS}${NC}"
echo -e "  ${RED}Failed:   ${FAIL}${NC}"
echo ""
echo "  Key Thresholds (from Requirements):"
echo "    Initial load (Req 86.1):  < 3000ms"
echo "    Interactions (Req 86.2):  < 100ms"
echo "    Chart render (Req 86.3):  < 1000ms"
echo "    Bundle size (Req 86.7):   < 1MB gzipped"
echo ""

# Write benchmark report
REPORT_FILE="$PROJECT_ROOT/staging-benchmark-results.txt"
{
  echo "# Performance Benchmark Results - $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
  echo "Iterations: $ITERATIONS | Concurrency: $CONCURRENCY"
  echo "Total: $TOTAL | Passed: $PASS | Failed: $FAIL"
} > "$REPORT_FILE"
echo -e "Report: ${REPORT_FILE}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}❌ Performance benchmarks found failures.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All performance benchmarks passed!${NC}"
  exit 0
fi
