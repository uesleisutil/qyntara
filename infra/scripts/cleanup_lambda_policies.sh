#!/bin/bash
# Script to clean up stale Lambda resource-based policy statements
# that accumulated from previous CDK deployments with individual API routes.
#
# The 20KB policy limit is being hit because old Lambda::Permission statements
# from removed CloudFormation resources were never cleaned up.
#
# Usage: bash infra/scripts/cleanup_lambda_policies.sh [--dry-run]

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "=== DRY RUN MODE ==="
fi

REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="B3TacticalRankingStackV2"

echo "Region: $REGION"
echo "Stack: $STACK_NAME"
echo ""

# Get all Lambda function names from the stack
FUNCTIONS=$(aws cloudformation list-stack-resources \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "StackResourceSummaries[?ResourceType=='AWS::Lambda::Function'].PhysicalResourceId" \
  --output text 2>/dev/null || echo "")

if [[ -z "$FUNCTIONS" ]]; then
  echo "ERROR: Could not list stack resources. Is the stack in a stable state?"
  echo "If UPDATE_ROLLBACK_COMPLETE, try: aws cloudformation continue-update-rollback --stack-name $STACK_NAME"
  exit 1
fi

echo "Found Lambda functions in stack:"
for FN in $FUNCTIONS; do
  echo "  - $FN"
done
echo ""

CLEANED=0
ERRORS=0

for FN in $FUNCTIONS; do
  echo "--- Checking: $FN ---"
  
  # Get current resource policy
  POLICY=$(aws lambda get-policy --function-name "$FN" --region "$REGION" 2>/dev/null || echo "")
  
  if [[ -z "$POLICY" ]]; then
    echo "  No resource policy (OK)"
    continue
  fi

  # Parse policy size
  POLICY_JSON=$(echo "$POLICY" | python3 -c "import sys,json; print(json.loads(json.load(sys.stdin)['Policy'])['Statement'] | length if False else json.load(sys.stdin)['Policy'])" 2>/dev/null || echo "")
  POLICY_SIZE=${#POLICY_JSON}
  
  # Count statements
  STMT_COUNT=$(echo "$POLICY" | python3 -c "
import sys, json
p = json.loads(json.load(sys.stdin)['Policy'])
print(len(p.get('Statement', [])))
" 2>/dev/null || echo "0")

  echo "  Policy size: ~${POLICY_SIZE} bytes, Statements: ${STMT_COUNT}"

  if [[ "$POLICY_SIZE" -gt 18000 ]]; then
    echo "  ⚠️  Policy is large (${POLICY_SIZE} bytes) — listing SIDs:"
    
    # List all statement IDs
    SIDS=$(echo "$POLICY" | python3 -c "
import sys, json
p = json.loads(json.load(sys.stdin)['Policy'])
for s in p.get('Statement', []):
    sid = s.get('Sid', 'NO-SID')
    principal = s.get('Principal', {})
    if isinstance(principal, dict):
        principal = principal.get('Service', str(principal))
    print(f'{sid}|{principal}')
" 2>/dev/null || echo "")

    while IFS='|' read -r SID PRINCIPAL; do
      echo "    SID: $SID (principal: $PRINCIPAL)"
    done <<< "$SIDS"

    if [[ "$DRY_RUN" == "false" ]]; then
      echo ""
      echo "  🧹 Removing ALL policy statements to let CloudFormation recreate them cleanly..."
      
      # Remove each statement
      echo "$POLICY" | python3 -c "
import sys, json
p = json.loads(json.load(sys.stdin)['Policy'])
for s in p.get('Statement', []):
    sid = s.get('Sid', '')
    if sid:
        print(sid)
" 2>/dev/null | while read -r SID; do
        echo "    Removing: $SID"
        aws lambda remove-permission \
          --function-name "$FN" \
          --statement-id "$SID" \
          --region "$REGION" 2>/dev/null || echo "    (failed to remove $SID)"
      done
      
      CLEANED=$((CLEANED + 1))
    fi
  else
    echo "  ✅ Policy size OK"
  fi
  echo ""
done

echo "=== Done ==="
if [[ "$DRY_RUN" == "true" ]]; then
  echo "This was a dry run. Run without --dry-run to actually clean up."
else
  echo "Cleaned $CLEANED function(s). You can now retry: cdk deploy"
fi
