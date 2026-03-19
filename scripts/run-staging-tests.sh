#!/bin/bash
# =============================================================================
# B3 Tactical Ranking - Staging Test Runner
# =============================================================================
# Orchestrates all staging tests in sequence:
#   1. Infrastructure verification (verify-staging.sh)
#   2. Smoke tests (smoke-test-staging.sh)
#   3. Integration tests (integration-test-staging.sh)
#   4. Performance benchmarks (benchmark-staging.sh)
#
# Requirements: 85.4 - Comprehensive staging environment testing
#
# Usage:
#   ./scripts/run-staging-tests.sh [options]
#
# Options:
#   --skip-infra       Skip infrastructure verification
#   --skip-smoke       Skip smoke tests
#   --skip-integration Skip integration tests
#   --skip-benchmark   Skip performance benchmarks
#   --skip-dr          Skip disaster recovery drill (in integration tests)
#   --verbose          Verbose output for all test suites
#   --fail-fast        Stop on first suite failure
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Flags
SKIP_INFRA=false
SKIP_SMOKE=false
SKIP_INTEGRATION=false
SKIP_BENCHMARK=false
SKIP_DR=false
VERBOSE=false
FAIL_FAST=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-infra)       SKIP_INFRA=true; shift ;;
    --skip-smoke)       SKIP_SMOKE=true; shift ;;
    --skip-integration) SKIP_INTEGRATION=true; shift ;;
    --skip-benchmark)   SKIP_BENCHMARK=true; shift ;;
    --skip-dr)          SKIP_DR=true; shift ;;
    --verbose)          VERBOSE=true; shift ;;
    --fail-fast)        FAIL_FAST=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--skip-infra] [--skip-smoke] [--skip-integration] [--skip-benchmark] [--skip-dr] [--verbose] [--fail-fast]"
      exit 0
      ;;
    *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
  esac
done

START_TIME=$(date +%s)

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   B3 Tactical Ranking - Staging Test Suite              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Started:  $(date -u +'%Y-%m-%d %H:%M:%S UTC')${NC}"
echo -e "${BLUE}Options:  infra=$([ "$SKIP_INFRA" = true ] && echo "skip" || echo "run") smoke=$([ "$SKIP_SMOKE" = true ] && echo "skip" || echo "run") integration=$([ "$SKIP_INTEGRATION" = true ] && echo "skip" || echo "run") benchmark=$([ "$SKIP_BENCHMARK" = true ] && echo "skip" || echo "run")${NC}"
echo ""

# Track suite results
declare -A SUITE_RESULTS
SUITES_RUN=0
SUITES_PASSED=0
SUITES_FAILED=0
SUITES_SKIPPED=0

run_suite() {
  local name="$1"
  local script="$2"
  shift 2
  local args=("$@")

  SUITES_RUN=$((SUITES_RUN + 1))

  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Suite ${SUITES_RUN}: ${name}${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  local suite_start
  suite_start=$(date +%s)

  if [ ! -x "$script" ]; then
    chmod +x "$script" 2>/dev/null || true
  fi

  if [ ! -f "$script" ]; then
    echo -e "  ${RED}✗ Script not found: ${script}${NC}"
    SUITE_RESULTS["$name"]="MISSING"
    SUITES_FAILED=$((SUITES_FAILED + 1))
    echo ""
    return 1
  fi

  local exit_code=0
  bash "$script" "${args[@]}" || exit_code=$?

  local suite_end
  suite_end=$(date +%s)
  local suite_duration=$((suite_end - suite_start))

  echo ""
  if [ "$exit_code" -eq 0 ]; then
    echo -e "  ${GREEN}Suite '${name}' PASSED in ${suite_duration}s${NC}"
    SUITE_RESULTS["$name"]="PASSED (${suite_duration}s)"
    SUITES_PASSED=$((SUITES_PASSED + 1))
  else
    echo -e "  ${RED}Suite '${name}' FAILED (exit code: ${exit_code}) in ${suite_duration}s${NC}"
    SUITE_RESULTS["$name"]="FAILED (${suite_duration}s)"
    SUITES_FAILED=$((SUITES_FAILED + 1))

    if [ "$FAIL_FAST" = true ]; then
      echo -e "  ${RED}--fail-fast: stopping test run${NC}"
      return 1
    fi
  fi
  echo ""
  return 0
}

# ─── Execute Test Suites ─────────────────────────────────────────────────────

OVERALL_EXIT=0

# Suite 1: Infrastructure Verification
if [ "$SKIP_INFRA" = false ]; then
  INFRA_ARGS=()
  [ "$VERBOSE" = true ] && INFRA_ARGS+=("--verbose")
  run_suite "Infrastructure Verification" "$SCRIPT_DIR/verify-staging.sh" "${INFRA_ARGS[@]}" || OVERALL_EXIT=1
else
  echo -e "${YELLOW}⏭  Skipping Infrastructure Verification (--skip-infra)${NC}"
  SUITES_SKIPPED=$((SUITES_SKIPPED + 1))
  SUITE_RESULTS["Infrastructure Verification"]="SKIPPED"
  echo ""
fi

# Suite 2: Smoke Tests
if [ "$SKIP_SMOKE" = false ] && ([ "$OVERALL_EXIT" -eq 0 ] || [ "$FAIL_FAST" = false ]); then
  SMOKE_ARGS=()
  [ "$VERBOSE" = true ] && SMOKE_ARGS+=("--verbose")
  run_suite "Smoke Tests" "$SCRIPT_DIR/smoke-test-staging.sh" "${SMOKE_ARGS[@]}" || OVERALL_EXIT=1
else
  if [ "$SKIP_SMOKE" = true ]; then
    echo -e "${YELLOW}⏭  Skipping Smoke Tests (--skip-smoke)${NC}"
  fi
  SUITES_SKIPPED=$((SUITES_SKIPPED + 1))
  SUITE_RESULTS["Smoke Tests"]="SKIPPED"
  echo ""
fi

# Suite 3: Integration Tests
if [ "$SKIP_INTEGRATION" = false ] && ([ "$OVERALL_EXIT" -eq 0 ] || [ "$FAIL_FAST" = false ]); then
  INTEG_ARGS=()
  [ "$VERBOSE" = true ] && INTEG_ARGS+=("--verbose")
  [ "$SKIP_DR" = true ] && INTEG_ARGS+=("--skip-dr")
  run_suite "Integration Tests" "$SCRIPT_DIR/integration-test-staging.sh" "${INTEG_ARGS[@]}" || OVERALL_EXIT=1
else
  if [ "$SKIP_INTEGRATION" = true ]; then
    echo -e "${YELLOW}⏭  Skipping Integration Tests (--skip-integration)${NC}"
  fi
  SUITES_SKIPPED=$((SUITES_SKIPPED + 1))
  SUITE_RESULTS["Integration Tests"]="SKIPPED"
  echo ""
fi

# Suite 4: Performance Benchmarks
if [ "$SKIP_BENCHMARK" = false ] && ([ "$OVERALL_EXIT" -eq 0 ] || [ "$FAIL_FAST" = false ]); then
  BENCH_ARGS=()
  [ "$VERBOSE" = true ] && BENCH_ARGS+=("--verbose")
  run_suite "Performance Benchmarks" "$SCRIPT_DIR/benchmark-staging.sh" "${BENCH_ARGS[@]}" || OVERALL_EXIT=1
else
  if [ "$SKIP_BENCHMARK" = true ]; then
    echo -e "${YELLOW}⏭  Skipping Performance Benchmarks (--skip-benchmark)${NC}"
  fi
  SUITES_SKIPPED=$((SUITES_SKIPPED + 1))
  SUITE_RESULTS["Performance Benchmarks"]="SKIPPED"
  echo ""
fi

# ─── Final Report ─────────────────────────────────────────────────────────────

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Staging Test Suite - Final Report                     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Duration: ${TOTAL_DURATION}s"
echo -e "  Suites:   $((SUITES_PASSED + SUITES_FAILED + SUITES_SKIPPED)) total"
echo -e "  ${GREEN}Passed:   ${SUITES_PASSED}${NC}"
echo -e "  ${RED}Failed:   ${SUITES_FAILED}${NC}"
echo -e "  ${YELLOW}Skipped:  ${SUITES_SKIPPED}${NC}"
echo ""
echo "  Results by Suite:"

for suite in "Infrastructure Verification" "Smoke Tests" "Integration Tests" "Performance Benchmarks"; do
  result="${SUITE_RESULTS[$suite]:-NOT RUN}"
  case "$result" in
    PASSED*) echo -e "    ${GREEN}✓${NC} ${suite}: ${result}" ;;
    FAILED*) echo -e "    ${RED}✗${NC} ${suite}: ${result}" ;;
    SKIPPED) echo -e "    ${YELLOW}⏭${NC} ${suite}: ${result}" ;;
    MISSING) echo -e "    ${RED}?${NC} ${suite}: Script not found" ;;
    *)       echo -e "    ${YELLOW}-${NC} ${suite}: ${result}" ;;
  esac
done

echo ""

# Write final report
REPORT_FILE="$PROJECT_ROOT/staging-test-report.txt"
{
  echo "# Staging Test Suite Report"
  echo "Date: $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
  echo "Duration: ${TOTAL_DURATION}s"
  echo "Passed: $SUITES_PASSED | Failed: $SUITES_FAILED | Skipped: $SUITES_SKIPPED"
  echo ""
  for suite in "Infrastructure Verification" "Smoke Tests" "Integration Tests" "Performance Benchmarks"; do
    echo "  $suite: ${SUITE_RESULTS[$suite]:-NOT RUN}"
  done
} > "$REPORT_FILE"
echo -e "Full report: ${REPORT_FILE}"
echo ""

if [ "$SUITES_FAILED" -gt 0 ]; then
  echo -e "${RED}❌ Staging test suite completed with failures.${NC}"
  echo -e "${RED}   Review individual suite output above for details.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All staging tests passed! Ready for production deployment.${NC}"
  exit 0
fi
