#!/usr/bin/env bash
set -euo pipefail

STACK_NAME="${STACK_NAME:-B3TacticalRankingStack}"
REGION="${AWS_REGION:-us-east-1}"

BUCKET="$(
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue | [0]" \
    --output text
)"

SSM_PREFIX="$(
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='SsmPrefix'].OutputValue | [0]" \
    --output text
)"

if [[ -z "$BUCKET" || "$BUCKET" == "None" ]]; then
  echo "ERRO: não achei BucketName no stack $STACK_NAME ($REGION)"
  exit 1
fi

echo "export B3TR_STACK_NAME=$STACK_NAME"
echo "export AWS_REGION=$REGION"
echo "export BUCKET=$BUCKET"
echo "export B3TR_SSM_PREFIX=$SSM_PREFIX"