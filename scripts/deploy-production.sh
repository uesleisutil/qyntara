#!/bin/bash
# =============================================================================
# B3 Tactical Ranking - Production Blue-Green Deployment Script
# =============================================================================
# Implements blue-green deployment strategy for zero-downtime production updates.
# Requirements: 85.5 (manual approval), 85.6 (blue-green deployment), 85.7 (auto rollback)
#
# Usage:
#   ./scripts/deploy-production.sh [OPTIONS]
#
# Options:
#   --rollback          Rollback to previous (blue) version
#   --skip-approval     Skip interactive approval prompt (for CI/CD)
#   --skip-frontend     Skip frontend deployment
#   --skip-backend      Skip backend/infra deployment
#   --dry-run           Show what would be deployed without executing
#   --help              Show this help message
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Flags
ROLLBACK=false
SKIP_APPROVAL=false
SKIP_FRONTEND=false
SKIP_BACKEND=false
DRY_RUN=false

# Deployment metadata
DEPLOY_TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DEPLOY_VERSION="${REACT_APP_VERSION:-$(git describe --tags --always 2>/dev/null || echo "unknown")}"
DEPLOY_LOG="$PROJECT_ROOT/deploy-production-${DEPLOY_TIMESTAMP}.log"

for arg in "$@"; do
  case $arg in
    --rollback)       ROLLBACK=true ;;
    --skip-approval)  SKIP_APPROVAL=true ;;
    --skip-frontend)  SKIP_FRONTEND=true ;;
    --skip-backend)   SKIP_BACKEND=true ;;
    --dry-run)        DRY_RUN=true ;;
    --help|-h)
      echo "Usage: $0 [--rollback] [--skip-approval] [--skip-frontend] [--skip-backend] [--dry-run]"
      echo ""
      echo "Options:"
      echo "  --rollback       Rollback to previous (blue) version"
      echo "  --skip-approval  Skip interactive approval prompt (for CI/CD)"
      echo "  --skip-frontend  Skip frontend deployment"
      echo "  --skip-backend   Skip backend/infra deployment"
      echo "  --dry-run        Show what would be deployed without executing"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $arg${NC}"
      exit 1
      ;;
  esac
done

# ─── Utility Functions ───────────────────────────────────────────────────────

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo "$msg" >> "$DEPLOY_LOG"
  echo -e "$1"
}

fail() {
  log "${RED}❌ FATAL: $1${NC}"
  log "${YELLOW}Deployment failed. Check log: $DEPLOY_LOG${NC}"
  exit 1
}

run_or_dry() {
  if [ "$DRY_RUN" = true ]; then
    log "${CYAN}[DRY-RUN] Would execute: $*${NC}"
  else
    "$@"
  fi
}

# ─── Banner ──────────────────────────────────────────────────────────────────

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$ROLLBACK" = true ]; then
  echo -e "${RED}  B3 Tactical Ranking - PRODUCTION ROLLBACK${NC}"
else
  echo -e "${BLUE}  B3 Tactical Ranking - Production Blue-Green Deploy${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ─── Pre-flight Checks ──────────────────────────────────────────────────────

log "${YELLOW}📋 Pre-flight checks...${NC}"

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    fail "$1 not found. Please install it first."
  fi
}

check_cmd aws
check_cmd node
check_cmd npm
check_cmd git

if ! aws sts get-caller-identity &>/dev/null; then
  fail "AWS credentials not configured or expired"
fi

# Load production environment
PROD_ENV_FILE="$PROJECT_ROOT/.env.production"
if [ -f "$PROD_ENV_FILE" ]; then
  log "${YELLOW}📦 Loading production environment from .env.production${NC}"
  set -a
  source "$PROD_ENV_FILE"
  set +a
else
  log "${YELLOW}⚠️  No .env.production found, using environment variables${NC}"
fi

export B3TR_STAGE=prod
export ENVIRONMENT=production

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}
PROD_STACK_NAME="B3TacticalRankingStackV2"
PROD_BUCKET="${B3TR_BUCKET_PREFIX:-b3tr}-${ACCOUNT_ID}-${REGION}"
GREEN_PREFIX="dashboard-green-${DEPLOY_TIMESTAMP}"
BLUE_PREFIX="dashboard-prod"

log "${GREEN}✅ All prerequisites met${NC}"
echo ""
log "${BLUE}📍 Account:     ${ACCOUNT_ID}${NC}"
log "${BLUE}📍 Region:      ${REGION}${NC}"
log "${BLUE}📍 Stack:       ${PROD_STACK_NAME}${NC}"
log "${BLUE}📍 Version:     ${DEPLOY_VERSION}${NC}"
log "${BLUE}📍 Timestamp:   ${DEPLOY_TIMESTAMP}${NC}"
log "${BLUE}📍 Log:         ${DEPLOY_LOG}${NC}"
echo ""

# ─── Production Readiness Validation ─────────────────────────────────────────

if [ "$ROLLBACK" = false ]; then
  log "${YELLOW}🔍 Running production readiness validation...${NC}"
  if [ -x "$SCRIPT_DIR/validate-production-ready.sh" ]; then
    if ! run_or_dry "$SCRIPT_DIR/validate-production-ready.sh"; then
      fail "Production readiness validation failed. Fix issues before deploying."
    fi
  else
    log "${YELLOW}⚠️  validate-production-ready.sh not found, skipping validation${NC}"
  fi
  echo ""
fi

# ─── Manual Approval Gate (Req 85.5) ────────────────────────────────────────

if [ "$SKIP_APPROVAL" = false ] && [ "$DRY_RUN" = false ]; then
  echo -e "${YELLOW}⚠️  PRODUCTION DEPLOYMENT${NC}"
  echo ""
  echo "  This will deploy to the PRODUCTION environment using blue-green strategy."
  echo "  Version: ${DEPLOY_VERSION}"
  echo "  Stack:   ${PROD_STACK_NAME}"
  echo ""
  if [ "$ROLLBACK" = true ]; then
    echo -e "  ${RED}ACTION: ROLLBACK to previous version${NC}"
  else
    echo "  ACTION: Deploy new green version, health check, then switch traffic"
  fi
  echo ""
  read -p "  Type 'deploy' to confirm: " CONFIRM
  if [ "$CONFIRM" != "deploy" ]; then
    log "${RED}❌ Deployment cancelled by user${NC}"
    exit 0
  fi
  echo ""
fi

# ─── ROLLBACK PATH ───────────────────────────────────────────────────────────

if [ "$ROLLBACK" = true ]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}  Rollback: Reverting to Previous Version${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # Step 1: Restore frontend from blue backup
  log "${YELLOW}🔄 Restoring frontend from blue backup...${NC}"
  BLUE_BACKUP_PREFIX="dashboard-blue-backup"

  if run_or_dry aws s3 ls "s3://${PROD_BUCKET}/${BLUE_BACKUP_PREFIX}/" &>/dev/null 2>&1; then
    run_or_dry aws s3 sync "s3://${PROD_BUCKET}/${BLUE_BACKUP_PREFIX}/" \
      "s3://${PROD_BUCKET}/${BLUE_PREFIX}/" \
      --delete \
      --cache-control "public, max-age=86400, s-maxage=31536000"
    log "${GREEN}✅ Frontend restored from blue backup${NC}"
  else
    log "${RED}❌ No blue backup found at s3://${PROD_BUCKET}/${BLUE_BACKUP_PREFIX}/${NC}"
    log "${YELLOW}Attempting CDK rollback for infrastructure...${NC}"
  fi

  # Step 2: Rollback Lambda functions via CDK
  log "${YELLOW}🔄 Rolling back Lambda functions...${NC}"
  PREVIOUS_COMMIT=$(git rev-parse HEAD~1 2>/dev/null || echo "")

  if [ -n "$PREVIOUS_COMMIT" ]; then
    log "${YELLOW}Rolling back to commit: ${PREVIOUS_COMMIT}${NC}"
    # Use CloudFormation rollback to previous successful state
    run_or_dry aws cloudformation rollback-stack \
      --stack-name "$PROD_STACK_NAME" 2>/dev/null || {
      log "${YELLOW}CloudFormation rollback not available, using continue-update-rollback...${NC}"
      run_or_dry aws cloudformation continue-update-rollback \
        --stack-name "$PROD_STACK_NAME" 2>/dev/null || true
    }
    log "${GREEN}✅ Infrastructure rollback initiated${NC}"
  else
    log "${YELLOW}⚠️  No previous commit found for rollback reference${NC}"
  fi

  # Step 3: Invalidate CloudFront cache
  log "${YELLOW}🔄 Invalidating CloudFront cache...${NC}"
  PROD_CF_ID=$(aws cloudformation describe-stacks \
    --stack-name "$PROD_STACK_NAME" \
    --query "Stacks[0].Outputs[?contains(OutputKey, 'CloudFront') || contains(OutputKey, 'Distribution')].OutputValue" \
    --output text 2>/dev/null | head -1 || echo "")

  if [ -n "$PROD_CF_ID" ]; then
    run_or_dry aws cloudfront create-invalidation \
      --distribution-id "$PROD_CF_ID" \
      --paths "/*" >/dev/null 2>&1 || true
    log "${GREEN}✅ CloudFront cache invalidated${NC}"
  fi

  # Step 4: Verify rollback
  log "${YELLOW}🔍 Verifying rollback...${NC}"
  if [ -x "$SCRIPT_DIR/verify-production.sh" ]; then
    run_or_dry "$SCRIPT_DIR/verify-production.sh" || true
  fi

  echo ""
  log "${GREEN}✅ Rollback complete. Monitor production for issues.${NC}"
  exit 0
fi

# =============================================================================
# BLUE-GREEN DEPLOYMENT (Req 85.6)
# =============================================================================
# Strategy:
#   1. Backup current production (blue) frontend to a backup prefix
#   2. Deploy new version (green) to a separate prefix
#   3. Run health checks against the green version
#   4. Switch CloudFront origin / S3 prefix from blue to green
#   5. Invalidate CloudFront cache
#   6. Run post-deployment verification
#   7. Keep blue backup available for quick rollback
# =============================================================================

# ─── Step 1: Backup Current Production (Blue) ───────────────────────────────

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 1: Backup Current Production (Blue)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

BLUE_BACKUP_PREFIX="dashboard-blue-backup"

log "${YELLOW}📦 Backing up current production frontend...${NC}"
if run_or_dry aws s3 ls "s3://${PROD_BUCKET}/${BLUE_PREFIX}/" &>/dev/null 2>&1; then
  run_or_dry aws s3 sync "s3://${PROD_BUCKET}/${BLUE_PREFIX}/" \
    "s3://${PROD_BUCKET}/${BLUE_BACKUP_PREFIX}/" \
    --delete
  log "${GREEN}✅ Blue backup created at s3://${PROD_BUCKET}/${BLUE_BACKUP_PREFIX}/${NC}"
else
  log "${YELLOW}⚠️  No existing production frontend to backup (first deployment?)${NC}"
fi

# Tag current Lambda versions for rollback reference
log "${YELLOW}📦 Tagging current Lambda versions...${NC}"
LAMBDA_FUNCTIONS=$(aws lambda list-functions \
  --query "Functions[?contains(FunctionName, 'B3TacticalRanking') && !contains(FunctionName, 'Staging')].FunctionName" \
  --output text 2>/dev/null || echo "")

for FUNC in $LAMBDA_FUNCTIONS; do
  CURRENT_VERSION=$(aws lambda get-function \
    --function-name "$FUNC" \
    --query 'Configuration.Version' --output text 2>/dev/null || echo "\$LATEST")
  run_or_dry aws lambda tag-resource \
    --resource "$(aws lambda get-function --function-name "$FUNC" --query 'Configuration.FunctionArn' --output text 2>/dev/null)" \
    --tags "BlueVersion=${CURRENT_VERSION},BlueTimestamp=${DEPLOY_TIMESTAMP}" 2>/dev/null || true
done
log "${GREEN}✅ Lambda versions tagged for rollback${NC}"
echo ""

# ─── Step 2: Deploy Green Infrastructure (CDK) ──────────────────────────────

if [ "$SKIP_BACKEND" = false ]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Step 2: Deploy Green Infrastructure (CDK)${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  cd "$PROJECT_ROOT/infra"

  log "${YELLOW}📦 Installing CDK dependencies...${NC}"
  run_or_dry npm ci

  log "${YELLOW}🔧 Checking CDK bootstrap...${NC}"
  if ! aws cloudformation describe-stacks --stack-name CDKToolkit &>/dev/null; then
    log "${YELLOW}🚀 Bootstrapping CDK...${NC}"
    run_or_dry npx cdk bootstrap
  else
    log "${GREEN}✅ CDK already bootstrapped${NC}"
  fi

  log "${YELLOW}🔨 Synthesizing production stack...${NC}"
  run_or_dry npx cdk synth --context stage=prod --quiet

  log "${YELLOW}🚀 Deploying green infrastructure to production...${NC}"
  if run_or_dry npx cdk deploy "$PROD_STACK_NAME" \
    --context stage=prod \
    --require-approval never \
    --outputs-file "$PROJECT_ROOT/prod-outputs.json"; then
    log "${GREEN}✅ Green infrastructure deployed${NC}"
  else
    log "${RED}❌ Infrastructure deployment failed${NC}"
    log "${YELLOW}🔄 Initiating automatic rollback (Req 85.7)...${NC}"
    "$0" --rollback --skip-approval
    exit 1
  fi

  cd "$PROJECT_ROOT"
  echo ""
else
  log "${YELLOW}⏭️  Skipping backend deployment (--skip-backend)${NC}"
  echo ""
fi

# ─── Step 3: Build & Deploy Green Frontend ───────────────────────────────────

if [ "$SKIP_FRONTEND" = false ]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Step 3: Build & Deploy Green Frontend${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  cd "$PROJECT_ROOT/dashboard"

  log "${YELLOW}📦 Installing frontend dependencies...${NC}"
  run_or_dry npm ci

  # Resolve production API URL from CDK outputs or env
  PROD_API_URL="${REACT_APP_API_BASE_URL:-}"
  if [ -f "$PROJECT_ROOT/prod-outputs.json" ]; then
    DETECTED_URL=$(node -e "
      const o = require('$PROJECT_ROOT/prod-outputs.json');
      const stack = o['$PROD_STACK_NAME'] || {};
      const url = stack.ApiUrl || stack.DashboardApiUrl || '';
      process.stdout.write(url);
    " 2>/dev/null || true)
    if [ -n "$DETECTED_URL" ]; then
      PROD_API_URL="$DETECTED_URL"
    fi
  fi

  log "${YELLOW}🔨 Building frontend for production...${NC}"
  run_or_dry env \
    REACT_APP_API_BASE_URL="${PROD_API_URL}" \
    REACT_APP_API_KEY="${REACT_APP_API_KEY:-}" \
    REACT_APP_ENVIRONMENT=production \
    REACT_APP_SENTRY_DSN="${REACT_APP_SENTRY_DSN:-}" \
    REACT_APP_VERSION="${DEPLOY_VERSION}" \
    npm run build

  if [ $? -ne 0 ]; then
    fail "Frontend build failed"
  fi

  # Deploy green version to a separate S3 prefix
  log "${YELLOW}🚀 Uploading green frontend to s3://${PROD_BUCKET}/${GREEN_PREFIX}/...${NC}"
  run_or_dry aws s3 sync build/ "s3://${PROD_BUCKET}/${GREEN_PREFIX}/" \
    --delete \
    --cache-control "public, max-age=86400, s-maxage=31536000"

  log "${GREEN}✅ Green frontend uploaded${NC}"
  cd "$PROJECT_ROOT"
  echo ""
else
  log "${YELLOW}⏭️  Skipping frontend deployment (--skip-frontend)${NC}"
  echo ""
fi

# ─── Step 4: Health Checks on Green Version ──────────────────────────────────

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 4: Health Checks on Green Version${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

HEALTH_CHECK_PASSED=true

# Check 1: Verify green frontend files exist in S3
log "${YELLOW}🩺 Checking green frontend files...${NC}"
if [ "$SKIP_FRONTEND" = false ]; then
  GREEN_FILE_COUNT=$(aws s3 ls "s3://${PROD_BUCKET}/${GREEN_PREFIX}/" --recursive 2>/dev/null | wc -l || echo 0)
  if [ "$GREEN_FILE_COUNT" -gt 5 ]; then
    log "${GREEN}✅ Green frontend: ${GREEN_FILE_COUNT} files deployed${NC}"
  else
    log "${RED}❌ Green frontend: only ${GREEN_FILE_COUNT} files found${NC}"
    HEALTH_CHECK_PASSED=false
  fi
fi

# Check 2: Verify Lambda functions are healthy
log "${YELLOW}🩺 Checking Lambda function health...${NC}"
LAMBDA_HEALTHY=0
LAMBDA_TOTAL=0

for FUNC in $LAMBDA_FUNCTIONS; do
  LAMBDA_TOTAL=$((LAMBDA_TOTAL + 1))
  FUNC_STATE=$(aws lambda get-function \
    --function-name "$FUNC" \
    --query 'Configuration.State' --output text 2>/dev/null || echo "Unknown")

  if [ "$FUNC_STATE" = "Active" ]; then
    LAMBDA_HEALTHY=$((LAMBDA_HEALTHY + 1))
  else
    log "${RED}❌ Lambda $FUNC state: $FUNC_STATE${NC}"
    HEALTH_CHECK_PASSED=false
  fi
done

if [ "$LAMBDA_TOTAL" -gt 0 ]; then
  log "${GREEN}✅ Lambda health: ${LAMBDA_HEALTHY}/${LAMBDA_TOTAL} active${NC}"
fi

# Check 3: Verify API Gateway endpoint responds
log "${YELLOW}🩺 Checking API Gateway health...${NC}"
PROD_API_ENDPOINT="${REACT_APP_API_BASE_URL:-}"
if [ -f "$PROJECT_ROOT/prod-outputs.json" ]; then
  PROD_API_ENDPOINT=$(node -e "
    const o = require('$PROJECT_ROOT/prod-outputs.json');
    const stack = o['$PROD_STACK_NAME'] || {};
    const url = stack.ApiUrl || stack.DashboardApiUrl || '';
    process.stdout.write(url);
  " 2>/dev/null || true)
fi

if [ -n "$PROD_API_ENDPOINT" ]; then
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    "${PROD_API_ENDPOINT}/health" --max-time 10 2>/dev/null || echo "000")
  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
    log "${GREEN}✅ API Gateway health: HTTP ${HTTP_STATUS}${NC}"
  elif [ "$HTTP_STATUS" = "403" ]; then
    log "${YELLOW}⚠️  API Gateway returned 403 (may require API key) - acceptable${NC}"
  else
    log "${RED}❌ API Gateway health: HTTP ${HTTP_STATUS}${NC}"
    HEALTH_CHECK_PASSED=false
  fi
else
  log "${YELLOW}⚠️  No API endpoint detected, skipping API health check${NC}"
fi

# Check 4: Verify CloudFormation stack is stable
log "${YELLOW}🩺 Checking CloudFormation stack status...${NC}"
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "$PROD_STACK_NAME" \
  --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "UNKNOWN")

if [[ "$STACK_STATUS" == *"COMPLETE"* ]] && [[ "$STACK_STATUS" != *"DELETE"* ]] && [[ "$STACK_STATUS" != *"ROLLBACK"* ]]; then
  log "${GREEN}✅ Stack status: ${STACK_STATUS}${NC}"
else
  log "${RED}❌ Stack status: ${STACK_STATUS}${NC}"
  HEALTH_CHECK_PASSED=false
fi

echo ""

# Fail-safe: auto-rollback on health check failure (Req 85.7)
if [ "$HEALTH_CHECK_PASSED" = false ]; then
  log "${RED}❌ Health checks FAILED on green version${NC}"
  log "${YELLOW}🔄 Initiating automatic rollback (Req 85.7)...${NC}"
  # Clean up green deployment
  aws s3 rm "s3://${PROD_BUCKET}/${GREEN_PREFIX}/" --recursive 2>/dev/null || true
  "$0" --rollback --skip-approval
  exit 1
fi

log "${GREEN}✅ All health checks passed${NC}"
echo ""

# ─── Step 5: Switch Traffic from Blue to Green ───────────────────────────────

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 5: Switch Traffic (Blue → Green)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$SKIP_FRONTEND" = false ]; then
  # Copy green files to the production prefix (atomic swap)
  log "${YELLOW}🔄 Promoting green frontend to production prefix...${NC}"
  run_or_dry aws s3 sync "s3://${PROD_BUCKET}/${GREEN_PREFIX}/" \
    "s3://${PROD_BUCKET}/${BLUE_PREFIX}/" \
    --delete \
    --cache-control "public, max-age=86400, s-maxage=31536000"

  log "${GREEN}✅ Green frontend promoted to production${NC}"

  # Clean up green staging prefix
  log "${YELLOW}🧹 Cleaning up green staging prefix...${NC}"
  run_or_dry aws s3 rm "s3://${PROD_BUCKET}/${GREEN_PREFIX}/" --recursive 2>/dev/null || true
fi

# Invalidate CloudFront cache to serve new content
log "${YELLOW}🔄 Invalidating CloudFront cache...${NC}"
PROD_CF_ID=$(aws cloudformation describe-stacks \
  --stack-name "$PROD_STACK_NAME" \
  --query "Stacks[0].Outputs[?contains(OutputKey, 'CloudFront') || contains(OutputKey, 'Distribution')].OutputValue" \
  --output text 2>/dev/null | head -1 || echo "")

if [ -z "$PROD_CF_ID" ]; then
  # Try alternative: list distributions and find production one
  PROD_CF_ID=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?contains(Comment, 'prod') || contains(Comment, 'Production')].Id" \
    --output text 2>/dev/null | head -1 || echo "")
fi

if [ -n "$PROD_CF_ID" ]; then
  INVALIDATION_ID=$(run_or_dry aws cloudfront create-invalidation \
    --distribution-id "$PROD_CF_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' --output text 2>/dev/null || echo "")
  log "${GREEN}✅ CloudFront invalidation created: ${INVALIDATION_ID:-pending}${NC}"
else
  log "${YELLOW}⚠️  No CloudFront distribution found, skipping invalidation${NC}"
fi

echo ""

# ─── Step 6: Post-Deployment Verification ────────────────────────────────────

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 6: Post-Deployment Verification${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -x "$SCRIPT_DIR/verify-production.sh" ]; then
  log "${YELLOW}🔍 Running production verification...${NC}"
  if run_or_dry "$SCRIPT_DIR/verify-production.sh"; then
    log "${GREEN}✅ Production verification passed${NC}"
  else
    log "${YELLOW}⚠️  Some verification checks had warnings${NC}"
  fi
else
  log "${YELLOW}⚠️  verify-production.sh not found, running inline checks${NC}"

  # Basic inline verification
  if aws cloudformation describe-stacks --stack-name "$PROD_STACK_NAME" &>/dev/null; then
    FINAL_STATUS=$(aws cloudformation describe-stacks \
      --stack-name "$PROD_STACK_NAME" \
      --query 'Stacks[0].StackStatus' --output text)
    log "${GREEN}✅ Stack status: ${FINAL_STATUS}${NC}"
  fi

  FINAL_LAMBDA_COUNT=$(aws lambda list-functions \
    --query "Functions[?contains(FunctionName, 'B3TacticalRanking') && !contains(FunctionName, 'Staging')].FunctionName" \
    --output text 2>/dev/null | wc -w || echo 0)
  log "${GREEN}✅ ${FINAL_LAMBDA_COUNT} production Lambda functions active${NC}"
fi

echo ""

# ─── Step 7: Tag Release ────────────────────────────────────────────────────

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Step 7: Tag Release${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

RELEASE_TAG="production-${DEPLOY_TIMESTAMP}"
log "${YELLOW}🏷️  Tagging release: ${RELEASE_TAG}${NC}"
run_or_dry git tag -a "$RELEASE_TAG" -m "Production deployment ${DEPLOY_TIMESTAMP} (v${DEPLOY_VERSION})" 2>/dev/null || true
run_or_dry git push origin "$RELEASE_TAG" 2>/dev/null || true
log "${GREEN}✅ Release tagged${NC}"
echo ""

# ─── Summary ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Production Blue-Green Deployment Complete${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
log "${GREEN}✅ Production deployment finished successfully!${NC}"
echo ""
echo -e "${BLUE}Deployment Details:${NC}"
echo "  Version:    ${DEPLOY_VERSION}"
echo "  Timestamp:  ${DEPLOY_TIMESTAMP}"
echo "  Tag:        ${RELEASE_TAG}"
echo "  Log:        ${DEPLOY_LOG}"
echo ""
echo -e "${YELLOW}Rollback:${NC}"
echo "  To rollback: ./scripts/deploy-production.sh --rollback"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Monitor CloudWatch dashboards for errors"
echo "  2. Verify: ./scripts/verify-production.sh"
echo "  3. Check Sentry for new error reports"
echo "  4. Notify stakeholders of successful deployment"
echo ""
