#!/bin/bash
#
# Deploy Model Optimization Pipeline
#
# This script deploys the complete model optimization infrastructure including:
# - Lambda functions for feature engineering, training, prediction, and monitoring
# - EventBridge rules for scheduled executions
# - S3 event triggers for automated pipeline execution
# - SNS topics for alerts
# - CloudWatch alarms and dashboards
#
# Usage:
#   ./scripts/deploy-model-optimization.sh [--profile PROFILE] [--region REGION]
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
AWS_PROFILE="${AWS_PROFILE:-default}"
AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="B3TacticalRankingStackV2"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --profile)
      AWS_PROFILE="$2"
      shift 2
      ;;
    --region)
      AWS_REGION="$2"
      shift 2
      ;;
    --stack-name)
      STACK_NAME="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --profile PROFILE    AWS profile to use (default: $AWS_PROFILE)"
      echo "  --region REGION      AWS region to deploy to (default: $AWS_REGION)"
      echo "  --stack-name NAME    CloudFormation stack name (default: $STACK_NAME)"
      echo "  --help               Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Model Optimization Pipeline Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "AWS Profile: $AWS_PROFILE"
echo "AWS Region: $AWS_REGION"
echo "Stack Name: $STACK_NAME"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    echo -e "${RED}Error: AWS CDK is not installed${NC}"
    echo "Install with: npm install -g aws-cdk"
    exit 1
fi

# Check if .env file exists
if [ ! -f "infra/.env" ]; then
    echo -e "${YELLOW}Warning: infra/.env file not found${NC}"
    echo "Creating from example..."
    if [ -f ".env.example" ]; then
        cp .env.example infra/.env
        echo -e "${YELLOW}Please edit infra/.env with your configuration${NC}"
        exit 1
    else
        echo -e "${RED}Error: .env.example not found${NC}"
        exit 1
    fi
fi

# Verify AWS credentials
echo -e "${YELLOW}Verifying AWS credentials...${NC}"
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" --region "$AWS_REGION" &> /dev/null; then
    echo -e "${RED}Error: Invalid AWS credentials${NC}"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --region "$AWS_REGION" --query Account --output text)
echo -e "${GREEN}✓ AWS Account: $ACCOUNT_ID${NC}"

# Install Python dependencies
echo ""
echo -e "${YELLOW}Installing Python dependencies...${NC}"
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi

source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r dl/requirements.txt
echo -e "${GREEN}✓ Python dependencies installed${NC}"

# Install CDK dependencies
echo ""
echo -e "${YELLOW}Installing CDK dependencies...${NC}"
cd infra
npm install
cd ..
echo -e "${GREEN}✓ CDK dependencies installed${NC}"

# Bootstrap CDK (if needed)
echo ""
echo -e "${YELLOW}Checking CDK bootstrap...${NC}"
if ! aws cloudformation describe-stacks \
    --stack-name CDKToolkit \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" &> /dev/null; then
    echo "Bootstrapping CDK..."
    cd infra
    cdk bootstrap aws://$ACCOUNT_ID/$AWS_REGION \
        --profile "$AWS_PROFILE"
    cd ..
    echo -e "${GREEN}✓ CDK bootstrapped${NC}"
else
    echo -e "${GREEN}✓ CDK already bootstrapped${NC}"
fi

# Synthesize CDK stack
echo ""
echo -e "${YELLOW}Synthesizing CDK stack...${NC}"
cd infra
cdk synth --profile "$AWS_PROFILE" > /dev/null
echo -e "${GREEN}✓ CDK stack synthesized${NC}"

# Deploy CDK stack
echo ""
echo -e "${YELLOW}Deploying CDK stack...${NC}"
echo "This may take several minutes..."
cdk deploy \
    --profile "$AWS_PROFILE" \
    --require-approval never \
    --outputs-file ../cdk-outputs.json

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ CDK stack deployed successfully${NC}"
else
    echo -e "${RED}Error: CDK deployment failed${NC}"
    exit 1
fi

cd ..

# Extract outputs
echo ""
echo -e "${YELLOW}Extracting stack outputs...${NC}"
if [ -f "cdk-outputs.json" ]; then
    BUCKET_NAME=$(jq -r ".[\"$STACK_NAME\"].BucketName" cdk-outputs.json)
    ALERTS_TOPIC_ARN=$(jq -r ".[\"$STACK_NAME\"].AlertsTopicArn" cdk-outputs.json)
    DASHBOARD_URL=$(jq -r ".[\"$STACK_NAME\"].DashboardUrl" cdk-outputs.json)
    
    echo -e "${GREEN}✓ Stack outputs extracted${NC}"
    echo ""
    echo "Bucket Name: $BUCKET_NAME"
    echo "Alerts Topic ARN: $ALERTS_TOPIC_ARN"
    echo "Dashboard URL: $DASHBOARD_URL"
else
    echo -e "${YELLOW}Warning: cdk-outputs.json not found${NC}"
fi

# Upload configuration files to S3
echo ""
echo -e "${YELLOW}Uploading configuration files to S3...${NC}"
if [ -n "$BUCKET_NAME" ]; then
    aws s3 cp config/universe.txt "s3://$BUCKET_NAME/config/universe.txt" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION"
    
    aws s3 cp config/b3_holidays_2026.json "s3://$BUCKET_NAME/config/b3_holidays_2026.json" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION"
    
    echo -e "${GREEN}✓ Configuration files uploaded${NC}"
else
    echo -e "${YELLOW}Warning: Bucket name not found, skipping config upload${NC}"
fi

# Create sample environment variables file
echo ""
echo -e "${YELLOW}Creating environment variables file...${NC}"
cat > .env.deployed << EOF
# Model Optimization Pipeline Environment Variables
# Generated on $(date)

AWS_PROFILE=$AWS_PROFILE
AWS_REGION=$AWS_REGION
AWS_ACCOUNT_ID=$ACCOUNT_ID

BUCKET_NAME=$BUCKET_NAME
ALERTS_TOPIC_ARN=$ALERTS_TOPIC_ARN
DASHBOARD_URL=$DASHBOARD_URL

# Lambda Functions
FEATURE_ENGINEERING_LAMBDA=$(jq -r ".[\"$STACK_NAME\"].FeatureEngineeringLambda // \"\"" cdk-outputs.json 2>/dev/null || echo "")
TRAIN_MODELS_LAMBDA=$(jq -r ".[\"$STACK_NAME\"].TrainModelsLambda // \"\"" cdk-outputs.json 2>/dev/null || echo "")
ENSEMBLE_PREDICT_LAMBDA=$(jq -r ".[\"$STACK_NAME\"].EnsemblePredictLambda // \"\"" cdk-outputs.json 2>/dev/null || echo "")
MONITORING_LAMBDA=$(jq -r ".[\"$STACK_NAME\"].MonitoringLambda // \"\"" cdk-outputs.json 2>/dev/null || echo "")
EOF

echo -e "${GREEN}✓ Environment variables saved to .env.deployed${NC}"

# Display deployment summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Subscribe to SNS alerts:"
echo "   aws sns subscribe \\"
echo "     --topic-arn $ALERTS_TOPIC_ARN \\"
echo "     --protocol email \\"
echo "     --notification-endpoint your-email@example.com \\"
echo "     --profile $AWS_PROFILE \\"
echo "     --region $AWS_REGION"
echo ""
echo "2. View CloudWatch Dashboard:"
echo "   https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#dashboards:name=B3TR-ModelOptimization"
echo ""
echo "3. Monitor Lambda functions:"
echo "   https://console.aws.amazon.com/lambda/home?region=$AWS_REGION"
echo ""
echo "4. Test the pipeline:"
echo "   ./scripts/test-model-optimization.sh"
echo ""
echo -e "${GREEN}Deployment successful!${NC}"
