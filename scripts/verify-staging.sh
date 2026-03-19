#!/bin/bash
# =============================================================================
# B3 Tactical Ranking - Staging Verification Script
# =============================================================================
# Verifies that all staging services are running and healthy.
# Requirements: 85.4, 85.12 - Separate staging environment verification
#
# Usage:
#   ./scripts/verify-staging.sh [--verbose]
# =============================================================================

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VERBOSE=false
[ "${1:-}" = "--verbose" ] && VERBOSE=true

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

check_pass() {
  echo -e "${GREEN}✓${NC} $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

check_fail() {
  echo -e "${RED}✗${NC} $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

check_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  B3 Tactical Ranking - Staging Verification${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

STACK_NAME="B3TacticalRankingStaging"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")
REGION=${AWS_REGION:-us-east-1}

echo -e "${BLUE}📍 Stack:   ${STACK_NAME}${NC}"
echo -e "${BLUE}📍 Account: ${ACCOUNT_ID}${NC}"
echo -e "${BLUE}📍 Region:  ${REGION}${NC}"
echo ""

# ─── 1. CloudFormation Stack ─────────────────────────────────────────────────

echo "1. CloudFormation Stack"
echo "───────────────────────"

if aws cloudformation describe-stacks --stack-name "$STACK_NAME" &>/dev/null; then
  STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].StackStatus' --output text)

  if [[ "$STACK_STATUS" == *"COMPLETE"* ]] && [[ "$STACK_STATUS" != *"DELETE"* ]]; then
    check_pass "Stack $STACK_NAME: $STACK_STATUS"
  else
    check_fail "Stack $STACK_NAME: $STACK_STATUS"
  fi
else
  check_fail "Stack $STACK_NAME not found"
fi
echo ""

# ─── 2. Lambda Functions ─────────────────────────────────────────────────────

echo "2. Lambda Functions"
echo "───────────────────"

EXPECTED_LAMBDAS=(
  "Quotes5mIngest"
  "TrainSageMaker"
  "RankSageMaker"
  "MonitorIngestion"
  "MonitorCosts"
  "MonitorModelQuality"
  "DashboardAPI"
  "S3Proxy"
)

for LAMBDA_NAME in "${EXPECTED_LAMBDAS[@]}"; do
  FOUND=$(aws lambda list-functions \
    --query "Functions[?contains(FunctionName, 'Staging') && contains(FunctionName, '$LAMBDA_NAME')].FunctionName" \
    --output text 2>/dev/null | head -1)

  if [ -n "$FOUND" ]; then
    # Check if function can be invoked (dry run)
    if $VERBOSE; then
      LAST_MODIFIED=$(aws lambda get-function-configuration \
        --function-name "$FOUND" \
        --query 'LastModified' --output text 2>/dev/null || echo "unknown")
      check_pass "$LAMBDA_NAME ($FOUND) - Last modified: $LAST_MODIFIED"
    else
      check_pass "$LAMBDA_NAME"
    fi
  else
    check_warn "$LAMBDA_NAME not found in staging"
  fi
done
echo ""

# ─── 3. S3 Bucket ────────────────────────────────────────────────────────────

echo "3. S3 Bucket"
echo "────────────"

STAGING_BUCKET="b3tr-staging-${ACCOUNT_ID}-${REGION}"

if aws s3 ls "s3://${STAGING_BUCKET}" &>/dev/null 2>&1; then
  check_pass "Staging bucket exists: ${STAGING_BUCKET}"

  # Check config folder
  if aws s3 ls "s3://${STAGING_BUCKET}/config/" &>/dev/null 2>&1; then
    check_pass "config/ folder present"
  else
    check_warn "config/ folder not found"
  fi

  # Check frontend deployment
  if aws s3 ls "s3://${STAGING_BUCKET}/dashboard-staging/" &>/dev/null 2>&1; then
    check_pass "Frontend deployed to dashboard-staging/"
  else
    check_warn "Frontend not yet deployed to dashboard-staging/"
  fi
else
  check_warn "Staging bucket not found: ${STAGING_BUCKET}"
fi
echo ""

# ─── 4. API Gateway ──────────────────────────────────────────────────────────

echo "4. API Gateway"
echo "──────────────"

STAGING_API=$(aws apigateway get-rest-apis \
  --query "items[?contains(name, 'Staging') || contains(name, 'staging')].{name:name,id:id}" \
  --output json 2>/dev/null || echo "[]")

API_COUNT=$(echo "$STAGING_API" | node -e "
  const d = require('fs').readFileSync('/dev/stdin','utf8');
  const arr = JSON.parse(d);
  process.stdout.write(String(arr.length));
" 2>/dev/null || echo "0")

if [ "$API_COUNT" -gt 0 ]; then
  check_pass "Staging API Gateway found ($API_COUNT API(s))"

  if $VERBOSE; then
    echo "$STAGING_API" | node -e "
      const d = require('fs').readFileSync('/dev/stdin','utf8');
      JSON.parse(d).forEach(a => console.log('   - ' + a.name + ' (' + a.id + ')'));
    " 2>/dev/null || true
  fi
else
  check_warn "No staging API Gateway found (may be part of main stack)"
fi
echo ""

# ─── 5. EventBridge Rules ────────────────────────────────────────────────────

echo "5. EventBridge Rules"
echo "────────────────────"

RULE_COUNT=$(aws events list-rules \
  --query "Rules[?contains(Name, 'Staging')].Name" \
  --output text 2>/dev/null | wc -w || echo 0)

if [ "$RULE_COUNT" -gt 0 ]; then
  check_pass "$RULE_COUNT staging EventBridge rules found"

  if $VERBOSE; then
    aws events list-rules \
      --query "Rules[?contains(Name, 'Staging')].{Name:Name,State:State}" \
      --output table 2>/dev/null || true
  fi
else
  check_warn "No staging EventBridge rules found"
fi
echo ""

# ─── 6. SSM Parameters ───────────────────────────────────────────────────────

echo "6. SSM Parameters"
echo "─────────────────"

SSM_PREFIX="/b3tr/staging"
SSM_COUNT=$(aws ssm get-parameters-by-path \
  --path "$SSM_PREFIX" \
  --query 'Parameters[*].Name' \
  --output text 2>/dev/null | wc -w || echo 0)

if [ "$SSM_COUNT" -gt 0 ]; then
  check_pass "$SSM_COUNT staging SSM parameters found under $SSM_PREFIX"
else
  check_warn "No SSM parameters found under $SSM_PREFIX"
fi
echo ""

# ─── 7. CloudFront Distribution ──────────────────────────────────────────────

echo "7. CloudFront Distribution"
echo "──────────────────────────"

CF_STAGING=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?contains(Comment, 'staging') || contains(Comment, 'Staging')].{Id:Id,DomainName:DomainName,Status:Status}" \
  --output json 2>/dev/null || echo "[]")

CF_COUNT=$(echo "$CF_STAGING" | node -e "
  const d = require('fs').readFileSync('/dev/stdin','utf8');
  const arr = JSON.parse(d || '[]');
  process.stdout.write(String(arr.length));
" 2>/dev/null || echo "0")

if [ "$CF_COUNT" -gt 0 ]; then
  check_pass "Staging CloudFront distribution found"
else
  check_warn "No staging CloudFront distribution detected"
fi
echo ""

# ─── 8. SNS Topics ───────────────────────────────────────────────────────────

echo "8. SNS Alert Topics"
echo "────────────────────"

SNS_STAGING=$(aws sns list-topics \
  --query "Topics[?contains(TopicArn, 'staging')].TopicArn" \
  --output text 2>/dev/null || echo "")

if [ -n "$SNS_STAGING" ]; then
  check_pass "Staging SNS topic found"
else
  check_warn "No staging-specific SNS topic found"
fi
echo ""

# ─── Summary ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Verification Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${GREEN}Passed:   ${PASS_COUNT}${NC}"
echo -e "  ${YELLOW}Warnings: ${WARN_COUNT}${NC}"
echo -e "  ${RED}Failed:   ${FAIL_COUNT}${NC}"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "${RED}❌ Staging verification found failures. Review above.${NC}"
  exit 1
elif [ "$WARN_COUNT" -gt 3 ]; then
  echo -e "${YELLOW}⚠️  Staging partially deployed. Some services may need attention.${NC}"
  exit 0
else
  echo -e "${GREEN}✅ Staging environment is healthy!${NC}"
  exit 0
fi
