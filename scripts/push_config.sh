#!/usr/bin/env bash
set -euo pipefail

eval "$(./scripts/setenv.sh)"

aws s3 cp config/universe.txt "s3://$BUCKET/config/universe.txt" --region "$AWS_REGION"
aws s3 cp config/b3_holidays_2026.json "s3://$BUCKET/config/b3_holidays_2026.json" --region "$AWS_REGION"
aws s3 ls "s3://$BUCKET/config/" --region "$AWS_REGION"