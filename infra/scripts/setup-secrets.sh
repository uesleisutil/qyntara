#!/bin/bash
# Script para configurar AWS Secrets Manager com token BRAPI
# Usage: ./setup-secrets.sh <brapi-token>

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <brapi-token>"
  echo "Example: $0 'your-brapi-pro-token-here'"
  exit 1
fi

BRAPI_TOKEN="$1"
SECRET_ID="${BRAPI_SECRET_ID:-brapi/pro/token}"
AWS_REGION="${AWS_REGION:-us-east-1}"

echo "🔐 Configurando AWS Secrets Manager..."
echo "Secret ID: $SECRET_ID"
echo "Region: $AWS_REGION"

# Verificar se o secret já existe
if aws secretsmanager describe-secret --secret-id "$SECRET_ID" --region "$AWS_REGION" 2>/dev/null; then
  echo "✅ Secret já existe. Atualizando valor..."
  aws secretsmanager put-secret-value \
    --secret-id "$SECRET_ID" \
    --secret-string "{\"token\":\"$BRAPI_TOKEN\"}" \
    --region "$AWS_REGION"
  echo "✅ Secret atualizado com sucesso!"
else
  echo "📝 Secret não existe. Criando..."
  aws secretsmanager create-secret \
    --name "$SECRET_ID" \
    --description "BRAPI Pro API Token for B3 Tactical Ranking" \
    --secret-string "{\"token\":\"$BRAPI_TOKEN\"}" \
    --region "$AWS_REGION"
  echo "✅ Secret criado com sucesso!"
fi

echo ""
echo "🎉 Configuração concluída!"
echo ""
echo "Para verificar o secret:"
echo "  aws secretsmanager get-secret-value --secret-id $SECRET_ID --region $AWS_REGION"
