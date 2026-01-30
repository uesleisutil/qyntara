#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
STACK="${B3TR_STACK_NAME:-B3TacticalRankingStack}"

BUCKET="$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text)"

TOPIC_ARN="$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='AlertsTopicArn'].OutputValue" \
  --output text)"

SM_ROLE_ARN="$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='SageMakerRoleArn'].OutputValue" \
  --output text)"

if [[ -z "$BUCKET" || "$BUCKET" == "None" ]]; then
  echo "ERRO: não achei BucketName nos outputs."
  exit 1
fi

cat > .env.local <<EOF2
AWS_REGION=$REGION
B3TR_STACK_NAME=$STACK
B3TR_BUCKET=$BUCKET
B3TR_ALERTS_TOPIC_ARN=$TOPIC_ARN
SAGEMAKER_ROLE_ARN=$SM_ROLE_ARN
EOF2

echo "OK: .env.local criado."
echo "B3TR_BUCKET=$BUCKET"
