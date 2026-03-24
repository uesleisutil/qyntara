#!/usr/bin/env bash
# =============================================================================
# Secret Rotation Script - Post Trivy Supply Chain Incident (March 2026)
# =============================================================================
# This script helps rotate GitHub Actions secrets as a precautionary measure.
#
# ANALYSIS SUMMARY:
#   - security.yml ran on 2026-03-24 with trivy-action@master
#   - security.yml has minimal permissions (contents:read, security-events:write)
#   - security.yml does NOT access any sensitive secrets (AWS, SMTP, API keys)
#   - deploy.yml (which has sensitive secrets) did NOT run during the attack window
#   - GITHUB_TOKEN is ephemeral and already expired
#   - Risk level: LOW, but rotation is recommended as best practice
#
# USAGE:
#   chmod +x scripts/rotate-secrets.sh
#   ./scripts/rotate-secrets.sh
#
# PREREQUISITES:
#   - gh CLI authenticated (gh auth login)
#   - AWS CLI configured (aws configure) for AWS key rotation
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

REPO="uesleisutil/qyntara"

echo "============================================="
echo " Secret Rotation - Qyntara"
echo "============================================="
echo ""

# ── 1. Rotate AWS Access Keys ──
echo -e "${YELLOW}[1/3] AWS Access Keys${NC}"
echo "  Current AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY need rotation via AWS IAM."
echo ""
echo "  Steps:"
echo "    1. Go to AWS IAM Console → Users → your-deploy-user → Security credentials"
echo "    2. Create a new access key"
echo "    3. Run the commands below with the NEW values:"
echo ""
echo "    gh secret set AWS_ACCESS_KEY_ID --repo $REPO"
echo "    gh secret set AWS_SECRET_ACCESS_KEY --repo $REPO"
echo ""
echo "    4. Deactivate the OLD access key in IAM"
echo "    5. After confirming deploy works, DELETE the old key"
echo ""
read -p "  Press Enter when done (or 's' to skip): " choice
if [[ "$choice" == "s" ]]; then
  echo -e "  ${YELLOW}Skipped${NC}"
fi
echo ""

# ── 2. Rotate API Key ──
echo -e "${YELLOW}[2/3] REACT_APP_API_KEY${NC}"
echo "  This is the API Gateway key. Rotate via AWS Console or CLI:"
echo ""
echo "    aws apigateway create-api-key --name 'qyntara-prod-rotated' --enabled"
echo ""
echo "  Then update the GitHub secret:"
echo "    gh secret set REACT_APP_API_KEY --repo $REPO"
echo ""
read -p "  Press Enter when done (or 's' to skip): " choice
if [[ "$choice" == "s" ]]; then
  echo -e "  ${YELLOW}Skipped${NC}"
fi
echo ""

# ── 3. Rotate SMTP Credentials ──
echo -e "${YELLOW}[3/3] SMTP Credentials${NC}"
echo "  Update SMTP password with your email provider, then:"
echo ""
echo "    gh secret set SMTP_PASSWORD --repo $REPO"
echo ""
read -p "  Press Enter when done (or 's' to skip): " choice
if [[ "$choice" == "s" ]]; then
  echo -e "  ${YELLOW}Skipped${NC}"
fi
echo ""

echo "============================================="
echo -e "${GREEN} Rotation checklist complete.${NC}"
echo ""
echo "  Next steps:"
echo "    - Trigger a test deploy to verify new credentials work"
echo "    - Delete/deactivate old credentials"
echo "    - Review: gh secret list --repo $REPO"
echo "============================================="
