#!/bin/bash
#
# Test Model Optimization Pipeline
#
# This script tests the model optimization pipeline by:
# - Uploading sample data to S3
# - Triggering Lambda functions manually
# - Checking execution results
# - Verifying metrics and alerts
#
# Usage:
#   ./scripts/test-model-optimization.sh [--profile PROFILE] [--region REGION]
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
      echo "  --region REGION      AWS region to test in (default: $AWS_REGION)"
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
echo -e "${GREEN}Model Optimization Pipeline Test${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Load environment variables if available
if [ -f ".env.deployed" ]; then
    source .env.deployed
    echo -e "${GREEN}✓ Loaded environment from .env.deployed${NC}"
fi

# Get stack outputs
echo -e "${YELLOW}Getting stack outputs...${NC}"
BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
    --output text)

FEATURE_ENGINEERING_LAMBDA=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='FeatureEngineeringLambda'].OutputValue" \
    --output text)

TRAIN_MODELS_LAMBDA=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='TrainModelsLambda'].OutputValue" \
    --output text)

ENSEMBLE_PREDICT_LAMBDA=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='EnsemblePredictLambda'].OutputValue" \
    --output text)

MONITORING_LAMBDA=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='MonitoringLambda'].OutputValue" \
    --output text)

echo -e "${GREEN}✓ Stack outputs retrieved${NC}"
echo "Bucket: $BUCKET_NAME"
echo "Feature Engineering Lambda: $FEATURE_ENGINEERING_LAMBDA"
echo ""

# Test 1: Feature Engineering
echo -e "${YELLOW}Test 1: Feature Engineering${NC}"
echo "Invoking feature engineering Lambda..."

FEATURE_PAYLOAD=$(cat <<EOF
{
  "stock_symbols": ["PETR4", "VALE3"],
  "start_date": "2023-01-01",
  "end_date": "2024-01-01",
  "input_bucket": "$BUCKET_NAME",
  "input_prefix": "raw/",
  "output_bucket": "$BUCKET_NAME",
  "output_prefix": "features/"
}
EOF
)

FEATURE_RESULT=$(aws lambda invoke \
    --function-name "$FEATURE_ENGINEERING_LAMBDA" \
    --payload "$FEATURE_PAYLOAD" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    /tmp/feature-result.json 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Feature engineering invoked successfully${NC}"
    cat /tmp/feature-result.json | jq '.'
else
    echo -e "${RED}✗ Feature engineering failed${NC}"
    echo "$FEATURE_RESULT"
fi

echo ""

# Test 2: Model Training
echo -e "${YELLOW}Test 2: Model Training${NC}"
echo "Invoking model training Lambda..."

TRAIN_PAYLOAD=$(cat <<EOF
{
  "features_s3_path": "s3://$BUCKET_NAME/features/2024-01-01/features.csv",
  "output_bucket": "$BUCKET_NAME",
  "models_to_train": ["lstm", "prophet", "xgboost"],
  "target_column": "target",
  "parallel": false
}
EOF
)

TRAIN_RESULT=$(aws lambda invoke \
    --function-name "$TRAIN_MODELS_LAMBDA" \
    --payload "$TRAIN_PAYLOAD" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    /tmp/train-result.json 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Model training invoked successfully${NC}"
    cat /tmp/train-result.json | jq '.'
else
    echo -e "${RED}✗ Model training failed${NC}"
    echo "$TRAIN_RESULT"
fi

echo ""

# Test 3: Ensemble Prediction
echo -e "${YELLOW}Test 3: Ensemble Prediction${NC}"
echo "Invoking ensemble prediction Lambda..."

PREDICT_PAYLOAD=$(cat <<EOF
{
  "features_bucket": "$BUCKET_NAME",
  "features_key": "features/2024-01-01/features.parquet",
  "model_bucket": "$BUCKET_NAME",
  "model_versions": {
    "lstm": "v1",
    "prophet": "v1",
    "xgboost": "v1"
  },
  "output_bucket": "$BUCKET_NAME",
  "stock_symbols": ["PETR4", "VALE3"],
  "prediction_date": "2024-01-01"
}
EOF
)

PREDICT_RESULT=$(aws lambda invoke \
    --function-name "$ENSEMBLE_PREDICT_LAMBDA" \
    --payload "$PREDICT_PAYLOAD" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    /tmp/predict-result.json 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Ensemble prediction invoked successfully${NC}"
    cat /tmp/predict-result.json | jq '.'
else
    echo -e "${RED}✗ Ensemble prediction failed${NC}"
    echo "$PREDICT_RESULT"
fi

echo ""

# Test 4: Monitoring
echo -e "${YELLOW}Test 4: Monitoring${NC}"
echo "Invoking monitoring Lambda..."

MONITOR_PAYLOAD=$(cat <<EOF
{
  "prediction_date": "2024-01-01",
  "predictions_bucket": "$BUCKET_NAME",
  "actuals_bucket": "$BUCKET_NAME",
  "features_bucket": "$BUCKET_NAME",
  "metrics_bucket": "$BUCKET_NAME",
  "reference_date": "2023-12-01"
}
EOF
)

MONITOR_RESULT=$(aws lambda invoke \
    --function-name "$MONITORING_LAMBDA" \
    --payload "$MONITOR_PAYLOAD" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    /tmp/monitor-result.json 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Monitoring invoked successfully${NC}"
    cat /tmp/monitor-result.json | jq '.'
else
    echo -e "${RED}✗ Monitoring failed${NC}"
    echo "$MONITOR_RESULT"
fi

echo ""

# Check S3 for outputs
echo -e "${YELLOW}Checking S3 for pipeline outputs...${NC}"

echo "Features:"
aws s3 ls "s3://$BUCKET_NAME/features/" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --recursive | tail -5

echo ""
echo "Models:"
aws s3 ls "s3://$BUCKET_NAME/models/" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --recursive | tail -5

echo ""
echo "Predictions:"
aws s3 ls "s3://$BUCKET_NAME/predictions/" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --recursive | tail -5

echo ""
echo "Metrics:"
aws s3 ls "s3://$BUCKET_NAME/metrics/" \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --recursive | tail -5

echo ""

# Check CloudWatch Logs
echo -e "${YELLOW}Checking CloudWatch Logs...${NC}"

for LAMBDA in "$FEATURE_ENGINEERING_LAMBDA" "$TRAIN_MODELS_LAMBDA" "$ENSEMBLE_PREDICT_LAMBDA" "$MONITORING_LAMBDA"; do
    LOG_GROUP="/aws/lambda/$LAMBDA"
    
    echo "Latest logs for $LAMBDA:"
    aws logs tail "$LOG_GROUP" \
        --profile "$AWS_PROFILE" \
        --region "$AWS_REGION" \
        --since 10m \
        --format short 2>/dev/null | tail -10 || echo "No recent logs"
    echo ""
done

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Test Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Review the results above to verify the pipeline is working correctly."
echo ""
echo "To view detailed logs:"
echo "  aws logs tail /aws/lambda/$FEATURE_ENGINEERING_LAMBDA --follow"
echo ""
echo "To view CloudWatch Dashboard:"
echo "  https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#dashboards:name=B3TR-ModelOptimization"
echo ""
