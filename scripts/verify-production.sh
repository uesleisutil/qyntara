#!/bin/bash
# =============================================================================
# B3 Tactical Ranking - Production Verification Script
# =============================================================================
# Verifies that all production services are running and healthy after deployment.
# Requirements: 85.5, 85.6 - Production deployment verification
#
# Usage:
#   ./scripts/verify-production.sh [--verbose] [--json]
# =============================================================================

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VERBOSE=false
JSON_OUTPUT=false

for arg in "$@"; do
  case $arg in
    --verbose) VERBOSE=true ;;
    --json)    JSON_OUTPUT=true ;;
  esac
done

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
echo -e "${BLUE}  B3 Tactical Ranking - Production Verification${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PROD_STACK_NAME="B3TacticalRankingStackV2"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")
REGION=${AWS_REGION:-us-east-1}

echo -e "${BLUE}📍 Stack:   ${PROD_STACK_NAME}${NC}"
echo -e "${BLUE}📍 Account: ${ACCOUNT_ID}${NC}"
echo -e "${BLUE}📍 Region:  ${REGION}${NC}"
echo ""

# ─── 1. CloudFormation Stack ─────────────────────────────────────────────────

echo "1. CloudFormation Stack"
echo "───────────────────────"

if aws cloudformation describe-stacks --stack-name "$PROD_STACK_NAME" &>/dev/null; then
  STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$PROD_STACK_NAME" \
    --query 'Stacks[0].StackStatus' --output text)

  if [[ "$STACK_STATUS" == *"COMPLETE"* ]] && [[ "$STACK_STATUS" != *"DELETE"* ]] && [[ "$STACK_STATUS" != *"ROLLBACK"* ]]; then
    check_pass "Stack $PROD_STACK_NAME: $STACK_STATUS"
  else
    check_fail "Stack $PROD_STACK_NAME: $STACK_STATUS"
  fi

  LAST_UPDATED=$(aws cloudformation describe-stacks \
    --stack-name "$PROD_STACK_NAME" \
    --query 'Stacks[0].LastUpdatedTime' --output text 2>/dev/null || echo "N/A")
  echo "   Last updated: $LAST_UPDATED"
else
  check_fail "Stack $PROD_STACK_NAME not found"
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
    --query "Functions[?contains(FunctionName, 'B3TacticalRanking') && !contains(FunctionName, 'Staging') && contains(FunctionName, '$LAMBDA_NAME')].FunctionName" \
    --output text 2>/dev/null | head -1)

  if [ -n "$FOUND" ]; then
    FUNC_STATE=$(aws lambda get-function \
      --function-name "$FOUND" \
      --query 'Configuration.State' --output text 2>/dev/null || echo "Unknown")

    if [ "$FUNC_STATE" = "Active" ]; then
      if $VERBOSE; then
        RUNTIME=$(aws lambda get-function-configuration \
          --function-name "$FOUND" \
          --query 'Runtime' --output text 2>/dev/null || echo "unknown")
        LAST_MODIFIED=$(aws lambda get-function-configuration \
          --function-name "$FOUND" \
          --query 'LastModified' --output text 2>/dev/null || echo "unknown")
        check_pass "$LAMBDA_NAME (${RUNTIME}, modified: ${LAST_MODIFIED})"
      else
        check_pass "$LAMBDA_NAME: Active"
      fi
    else
      check_fail "$LAMBDA_NAME: $FUNC_STATE"
    fi
  else
    check_warn "$LAMBDA_NAME not found in production"
  fi
done
echo ""

# ─── 3. S3 Bucket & Frontend ─────────────────────────────────────────────────

echo "3. S3 Bucket & Frontend"
echo "───────────────────────"

PROD_BUCKET="b3tr-${ACCOUNT_ID}-${REGION}"

if aws s3 ls "s3://${PROD_BUCKET}" &>/dev/null 2>&1; then
  check_pass "Production bucket exists: ${PROD_BUCKET}"

  # Check frontend deployment
  FRONTEND_FILES=$(aws s3 ls "s3://${PROD_BUCKET}/dashboard-prod/" --recursive 2>/dev/null | wc -l || echo 0)
  if [ "$FRONTEND_FILES" -gt 5 ]; then
    check_pass "Frontend deployed: ${FRONTEND_FILES} files"
  else
    check_warn "Frontend may not be deployed (${FRONTEND_FILES} files)"
  fi

  # Check blue backup exists (for rollback capability)
  BACKUP_FILES=$(aws s3 ls "s3://${PROD_BUCKET}/dashboard-blue-backup/" --recursive 2>/dev/null | wc -l || echo 0)
  if [ "$BACKUP_FILES" -gt 0 ]; then
    check_pass "Blue backup available: ${BACKUP_FILES} files (rollback ready)"
  else
    check_warn "No blue backup found (rollback not available)"
  fi

  # Check config folder
  if aws s3 ls "s3://${PROD_BUCKET}/config/" &>/dev/null 2>&1; then
    check_pass "config/ folder present"
  else
    check_warn "config/ folder not found"
  fi

  # Check models
  if aws s3 ls "s3://${PROD_BUCKET}/models/" &>/dev/null 2>&1; then
    check_pass "models/ folder present"
  else
    check_warn "models/ folder not found"
  fi
else
  check_fail "Production bucket not found: ${PROD_BUCKET}"
fi
echo ""

# ─── 4. API Gateway ──────────────────────────────────────────────────────────

echo "4. API Gateway"
echo "──────────────"

PROD_API=$(aws apigateway get-rest-apis \
  --query "items[?!contains(name, 'staging') && !contains(name, 'Staging')].{name:name,id:id}" \
  --output json 2>/dev/null || echo "[]")

API_COUNT=$(echo "$PROD_API" | node -e "
  const d = require('fs').readFileSync('/dev/stdin','utf8');
  const arr = JSON.parse(d || '[]');
  process.stdout.write(String(arr.length));
" 2>/dev/null || echo "0")

if [ "$API_COUNT" -gt 0 ]; then
  check_pass "Production API Gateway found ($API_COUNT API(s))"

  # Try health check on API endpoint
  PROD_API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$PROD_STACK_NAME" \
    --query "Stacks[0].Outputs[?contains(OutputKey, 'Api')].OutputValue" \
    --output text 2>/dev/null | head -1 || echo "")

  if [ -n "$PROD_API_URL" ]; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      "${PROD_API_URL}/health" --max-time 10 2>/dev/null || echo "000")
    if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
      check_pass "API health endpoint: HTTP ${HTTP_STATUS}"
    elif [ "$HTTP_STATUS" = "403" ]; then
      check_pass "API reachable (HTTP 403 - API key required)"
    else
      check_warn "API health endpoint: HTTP ${HTTP_STATUS}"
    fi
  fi
else
  check_warn "No production API Gateway found"
fi
echo ""

# ─── 5. CloudFront Distribution ──────────────────────────────────────────────

echo "5. CloudFront Distribution"
echo "──────────────────────────"

PROD_CF=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?contains(Comment, 'prod') || contains(Comment, 'Production') || contains(Comment, 'B3')].{Id:Id,DomainName:DomainName,Status:Status}" \
  --output json 2>/dev/null || echo "[]")

CF_COUNT=$(echo "$PROD_CF" | node -e "
  const d = require('fs').readFileSync('/dev/stdin','utf8');
  const arr = JSON.parse(d || '[]');
  process.stdout.write(String(arr.length));
" 2>/dev/null || echo "0")

if [ "$CF_COUNT" -gt 0 ]; then
  CF_STATUS=$(echo "$PROD_CF" | node -e "
    const d = require('fs').readFileSync('/dev/stdin','utf8');
    const arr = JSON.parse(d || '[]');
    if (arr.length > 0) process.stdout.write(arr[0].Status || 'Unknown');
  " 2>/dev/null || echo "Unknown")

  if [ "$CF_STATUS" = "Deployed" ]; then
    check_pass "CloudFront distribution: Deployed"
  else
    check_warn "CloudFront distribution status: $CF_STATUS"
  fi
else
  check_warn "No production CloudFront distribution detected"
fi
echo ""

# ─── 6. EventBridge Rules ────────────────────────────────────────────────────

echo "6. EventBridge Rules"
echo "────────────────────"

PROD_RULES=$(aws events list-rules \
  --query "Rules[?!contains(Name, 'Staging')].{Name:Name,State:State}" \
  --output json 2>/dev/null || echo "[]")

RULE_COUNT=$(echo "$PROD_RULES" | node -e "
  const d = require('fs').readFileSync('/dev/stdin','utf8');
  const arr = JSON.parse(d || '[]');
  process.stdout.write(String(arr.length));
" 2>/dev/null || echo "0")

if [ "$RULE_COUNT" -gt 0 ]; then
  ENABLED_RULES=$(echo "$PROD_RULES" | node -e "
    const d = require('fs').readFileSync('/dev/stdin','utf8');
    const arr = JSON.parse(d || '[]');
    const enabled = arr.filter(r => r.State === 'ENABLED').length;
    process.stdout.write(String(enabled));
  " 2>/dev/null || echo "0")
  check_pass "$RULE_COUNT EventBridge rules ($ENABLED_RULES enabled)"
else
  check_warn "No production EventBridge rules found"
fi
echo ""

# ─── 7. DynamoDB Tables ──────────────────────────────────────────────────────

echo "7. DynamoDB Tables"
echo "──────────────────"

DYNAMO_TABLES=$(aws dynamodb list-tables \
  --query "TableNames[?contains(@, 'B3') || contains(@, 'b3tr')]" \
  --output json 2>/dev/null || echo "[]")

TABLE_COUNT=$(echo "$DYNAMO_TABLES" | node -e "
  const d = require('fs').readFileSync('/dev/stdin','utf8');
  const arr = JSON.parse(d || '[]');
  process.stdout.write(String(arr.length));
" 2>/dev/null || echo "0")

if [ "$TABLE_COUNT" -gt 0 ]; then
  check_pass "$TABLE_COUNT DynamoDB tables found"
else
  check_warn "No DynamoDB tables found"
fi
echo ""

# ─── 8. SNS Alert Topics ─────────────────────────────────────────────────────

echo "8. SNS Alert Topics"
echo "────────────────────"

SNS_TOPICS=$(aws sns list-topics \
  --query "Topics[?contains(TopicArn, 'B3') || contains(TopicArn, 'b3tr') || contains(TopicArn, 'Alert')].TopicArn" \
  --output text 2>/dev/null || echo "")

if [ -n "$SNS_TOPICS" ]; then
  TOPIC_COUNT=$(echo "$SNS_TOPICS" | wc -w)
  check_pass "$TOPIC_COUNT SNS alert topic(s) found"
else
  check_warn "No SNS alert topics found"
fi
echo ""

# ─── 9. CloudWatch Alarms ────────────────────────────────────────────────────

echo "9. CloudWatch Alarms"
echo "─────────────────────"

ALARM_COUNT=$(aws cloudwatch describe-alarms \
  --query "MetricAlarms[?contains(AlarmName, 'B3') || contains(AlarmName, 'b3tr')].AlarmName" \
  --output text 2>/dev/null | wc -w || echo 0)

ALARM_IN_ALARM=$(aws cloudwatch describe-alarms \
  --state-value ALARM \
  --query "MetricAlarms[?contains(AlarmName, 'B3') || contains(AlarmName, 'b3tr')].AlarmName" \
  --output text 2>/dev/null | wc -w || echo 0)

if [ "$ALARM_COUNT" -gt 0 ]; then
  if [ "$ALARM_IN_ALARM" -gt 0 ]; then
    check_warn "$ALARM_COUNT CloudWatch alarms ($ALARM_IN_ALARM currently in ALARM state)"
  else
    check_pass "$ALARM_COUNT CloudWatch alarms (all OK)"
  fi
else
  check_warn "No CloudWatch alarms configured"
fi
echo ""

# ─── 10. Recent Lambda Errors ────────────────────────────────────────────────

echo "10. Recent Lambda Errors (last 15 min)"
echo "───────────────────────────────────────"

ERROR_FOUND=false
for LAMBDA_NAME in "${EXPECTED_LAMBDAS[@]}"; do
  FOUND=$(aws lambda list-functions \
    --query "Functions[?contains(FunctionName, 'B3TacticalRanking') && !contains(FunctionName, 'Staging') && contains(FunctionName, '$LAMBDA_NAME')].FunctionName" \
    --output text 2>/dev/null | head -1)

  if [ -n "$FOUND" ]; then
    ERROR_COUNT=$(aws cloudwatch get-metric-statistics \
      --namespace AWS/Lambda \
      --metric-name Errors \
      --dimensions "Name=FunctionName,Value=$FOUND" \
      --start-time "$(date -u -v-15M '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || date -u -d '15 minutes ago' '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || echo '2024-01-01T00:00:00')" \
      --end-time "$(date -u '+%Y-%m-%dT%H:%M:%S')" \
      --period 900 \
      --statistics Sum \
      --query 'Datapoints[0].Sum' --output text 2>/dev/null || echo "0")

    if [ "$ERROR_COUNT" != "None" ] && [ "$ERROR_COUNT" != "0" ] && [ -n "$ERROR_COUNT" ]; then
      check_warn "$LAMBDA_NAME: $ERROR_COUNT errors in last 15 min"
      ERROR_FOUND=true
    fi
  fi
done

if [ "$ERROR_FOUND" = false ]; then
  check_pass "No recent Lambda errors detected"
fi
echo ""

# ─── Summary ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Production Verification Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${GREEN}Passed:   ${PASS_COUNT}${NC}"
echo -e "  ${YELLOW}Warnings: ${WARN_COUNT}${NC}"
echo -e "  ${RED}Failed:   ${FAIL_COUNT}${NC}"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "${RED}❌ Production verification found failures. Investigate immediately.${NC}"
  echo ""
  echo -e "${YELLOW}Rollback command: ./scripts/deploy-production.sh --rollback${NC}"
  exit 1
elif [ "$WARN_COUNT" -gt 3 ]; then
  echo -e "${YELLOW}⚠️  Production partially healthy. Some services may need attention.${NC}"
  exit 0
else
  echo -e "${GREEN}✅ Production environment is healthy!${NC}"
  exit 0
fi
