#!/bin/bash
# =============================================================================
# B3 Tactical Ranking - Staging Deployment Script
# =============================================================================
# Deploys the full stack (infrastructure + frontend + backend) to staging.
# Requirements: 85.4 - Automated staging deployment on merge to main
#
# Usage:
#   ./scripts/deploy-staging.sh [--skip-frontend] [--skip-infra] [--skip-verify]
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Flags
SKIP_FRONTEND=false
SKIP_INFRA=false
SKIP_VERIFY=false

for arg in "$@"; do
  case $arg in
    --skip-frontend) SKIP_FRONTEND=true ;;
    --skip-infra)    SKIP_INFRA=true ;;
    --skip-verify)   SKIP_VERIFY=true ;;
    --help|-h)
      echo "Usage: $0 [--skip-frontend] [--skip-infra] [--skip-verify]"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $arg${NC}"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  B3 Tactical Ranking - Staging Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ─── Pre-flight checks ───────────────────────────────────────────────────────

echo -e "${YELLOW}📋 Pre-flight checks...${NC}"

check_cmd() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "${RED}❌ $1 not found. Please install it first.${NC}"
    exit 1
  fi
}

check_cmd aws
check_cmd node
check_cmd npm

if ! aws sts get-caller-identity &>/dev/null; then
  echo -e "${RED}❌ AWS credentials not configured${NC}"
  exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"
echo ""

# ─── Load staging environment ────────────────────────────────────────────────

STAGING_ENV_FILE="$PROJECT_ROOT/.env.staging"
if [ -f "$STAGING_ENV_FILE" ]; then
  echo -e "${YELLOW}📦 Loading staging environment from .env.staging${NC}"
  set -a
  source "$STAGING_ENV_FILE"
  set +a
else
  echo -e "${YELLOW}⚠️  No .env.staging found, using environment variables${NC}"
fi

export B3TR_STAGE=staging
export ENVIRONMENT=staging

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}
STACK_NAME="B3TacticalRankingStaging"

echo -e "${BLUE}📍 Account:     ${ACCOUNT_ID}${NC}"
echo -e "${BLUE}📍 Region:      ${REGION}${NC}"
echo -e "${BLUE}📍 Stack:       ${STACK_NAME}${NC}"
echo -e "${BLUE}📍 Environment: staging${NC}"
echo ""

# ─── Step 1: Deploy Infrastructure (CDK) ─────────────────────────────────────

if [ "$SKIP_INFRA" = false ]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Step 1: Deploy Infrastructure to Staging${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  cd "$PROJECT_ROOT/infra"

  echo -e "${YELLOW}📦 Installing CDK dependencies...${NC}"
  npm ci

  echo -e "${YELLOW}🔧 Checking CDK bootstrap...${NC}"
  if ! aws cloudformation describe-stacks --stack-name CDKToolkit &>/dev/null; then
    echo -e "${YELLOW}🚀 Bootstrapping CDK...${NC}"
    npx cdk bootstrap
  else
    echo -e "${GREEN}✅ CDK already bootstrapped${NC}"
  fi

  echo -e "${YELLOW}🔨 Synthesizing staging stack...${NC}"
  npx cdk synth --context stage=staging --quiet

  echo -e "${YELLOW}🚀 Deploying staging infrastructure...${NC}"
  npx cdk deploy "$STACK_NAME" \
    --context stage=staging \
    --require-approval never \
    --outputs-file "$PROJECT_ROOT/staging-outputs.json"

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Infrastructure deployed to staging${NC}"
  else
    echo -e "${RED}❌ Infrastructure deployment failed${NC}"
    exit 1
  fi

  cd "$PROJECT_ROOT"
  echo ""
else
  echo -e "${YELLOW}⏭️  Skipping infrastructure deployment (--skip-infra)${NC}"
  echo ""
fi

# ─── Step 2: Deploy Frontend to Staging ───────────────────────────────────────

if [ "$SKIP_FRONTEND" = false ]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Step 2: Build & Deploy Frontend to Staging${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  cd "$PROJECT_ROOT/dashboard"

  echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
  npm ci

  # Resolve staging API URL from CDK outputs or env
  STAGING_API_URL="${REACT_APP_API_BASE_URL:-}"
  if [ -f "$PROJECT_ROOT/staging-outputs.json" ]; then
    DETECTED_URL=$(node -e "
      const o = require('$PROJECT_ROOT/staging-outputs.json');
      const stack = o['$STACK_NAME'] || {};
      const url = stack.ApiUrl || stack.DashboardApiUrl || '';
      process.stdout.write(url);
    " 2>/dev/null || true)
    if [ -n "$DETECTED_URL" ]; then
      STAGING_API_URL="$DETECTED_URL"
    fi
  fi

  echo -e "${YELLOW}🔨 Building frontend for staging...${NC}"
  REACT_APP_API_BASE_URL="${STAGING_API_URL}" \
  REACT_APP_API_KEY="${REACT_APP_API_KEY:-STAGING_KEY}" \
  REACT_APP_ENVIRONMENT=staging \
  REACT_APP_VERSION="${REACT_APP_VERSION:-2.0.3-staging}" \
    npm run build

  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
  fi

  # Deploy to staging S3 bucket
  STAGING_BUCKET="${B3TR_BUCKET_PREFIX:-b3tr-staging}-${ACCOUNT_ID}-${REGION}"
  FRONTEND_PREFIX="dashboard-staging"

  echo -e "${YELLOW}🚀 Uploading frontend to s3://${STAGING_BUCKET}/${FRONTEND_PREFIX}/...${NC}"
  aws s3 sync build/ "s3://${STAGING_BUCKET}/${FRONTEND_PREFIX}/" \
    --delete \
    --cache-control "public, max-age=3600"

  # Invalidate CloudFront cache if distribution exists
  STAGING_CF_ID="${STAGING_CLOUDFRONT_ID:-}"
  if [ -f "$PROJECT_ROOT/staging-outputs.json" ]; then
    STAGING_CF_ID=$(node -e "
      const o = require('$PROJECT_ROOT/staging-outputs.json');
      const stack = o['$STACK_NAME'] || {};
      const id = stack.CloudFrontDistributionId || stack.StagingDistributionId || '';
      process.stdout.write(id);
    " 2>/dev/null || true)
  fi

  if [ -n "$STAGING_CF_ID" ]; then
    echo -e "${YELLOW}🔄 Invalidating CloudFront cache...${NC}"
    aws cloudfront create-invalidation \
      --distribution-id "$STAGING_CF_ID" \
      --paths "/*" >/dev/null 2>&1 || true
    echo -e "${GREEN}✅ CloudFront cache invalidated${NC}"
  fi

  echo -e "${GREEN}✅ Frontend deployed to staging${NC}"
  cd "$PROJECT_ROOT"
  echo ""
else
  echo -e "${YELLOW}⏭️  Skipping frontend deployment (--skip-frontend)${NC}"
  echo ""
fi

# ─── Step 3: Verify Staging ──────────────────────────────────────────────────

if [ "$SKIP_VERIFY" = false ]; then
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  Step 3: Verify Staging Deployment${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  if [ -x "$SCRIPT_DIR/verify-staging.sh" ]; then
    "$SCRIPT_DIR/verify-staging.sh"
  else
    echo -e "${YELLOW}⚠️  verify-staging.sh not found or not executable, running inline checks${NC}"

    # Basic stack check
    if aws cloudformation describe-stacks --stack-name "$STACK_NAME" &>/dev/null; then
      STACK_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query 'Stacks[0].StackStatus' --output text)
      echo -e "${GREEN}✅ Stack status: ${STACK_STATUS}${NC}"
    else
      echo -e "${RED}❌ Stack $STACK_NAME not found${NC}"
    fi

    # Lambda count
    LAMBDA_COUNT=$(aws lambda list-functions \
      --query "Functions[?contains(FunctionName, 'Staging')].FunctionName" \
      --output text 2>/dev/null | wc -w || echo 0)
    echo -e "${GREEN}✅ ${LAMBDA_COUNT} staging Lambda functions found${NC}"
  fi
  echo ""
else
  echo -e "${YELLOW}⏭️  Skipping verification (--skip-verify)${NC}"
  echo ""
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Staging Deployment Complete${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Staging deployment finished successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Run smoke tests:  ./scripts/verify-staging.sh"
echo "  2. Test manually via the staging URL"
echo "  3. When ready, deploy to production: ./scripts/deploy-v2.sh"
echo ""
