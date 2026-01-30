#!/bin/bash

# Script para configurar permissões do Amazon Q Business (QuickSight) para S3
# Execute: ./scripts/setup-quicksight-permissions.sh

set -e

echo "🔧 Configurando permissões Amazon Q Business (QuickSight) para S3"
echo "================================================================="

# Verificar se AWS CLI está configurado
if ! aws sts get-caller-identity &>/dev/null; then
    echo "❌ AWS CLI não está configurado"
    echo "Execute: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"
BUCKET_NAME="b3tr-${ACCOUNT_ID}-${REGION}"

echo "✅ AWS Account ID: $ACCOUNT_ID"
echo "✅ Bucket Name: $BUCKET_NAME"
echo "✅ Region: $REGION"

# Verificar se Amazon Q Business (QuickSight) está habilitado
echo ""
echo "🔍 Verificando status do Amazon Q Business..."
if ! aws quicksight describe-account-settings --aws-account-id $ACCOUNT_ID --region $REGION &>/dev/null; then
    echo "❌ Amazon Q Business (QuickSight) não está habilitado nesta conta"
    echo "Por favor, acesse https://q.aws.amazon.com/ e configure o Amazon Q Business primeiro"
    exit 1
fi

echo "✅ Amazon Q Business está habilitado"

# Verificar se o bucket existe
echo ""
echo "🔍 Verificando bucket S3..."
if ! aws s3 ls "s3://$BUCKET_NAME" &>/dev/null; then
    echo "❌ Bucket $BUCKET_NAME não encontrado"
    echo "Execute o deploy da infraestrutura primeiro"
    exit 1
fi

echo "✅ Bucket encontrado: $BUCKET_NAME"

echo ""
echo "🎉 Verificações concluídas!"
echo "=========================="
echo ""
echo "📋 Próximos passos MANUAIS:"
echo "1. Acesse Amazon Q Console: https://q.aws.amazon.com/"
echo "2. Vá para QuickSight dentro do Q Business"
echo "3. Clique no ícone do usuário → 'Manage Amazon Q'"
echo "4. Vá em 'Security & permissions' → 'Manage'"
echo "5. Configure 'QuickSight access to AWS services':"
echo "   - ✅ Marque 'Amazon S3'"
echo "   - ✅ Selecione o bucket: $BUCKET_NAME"
echo "   - ✅ Marque 'Write permission' (se disponível)"
echo "6. Clique 'Update'"
echo ""
echo "🚀 Após configurar, execute o deploy CDK novamente!"
echo ""
echo "ℹ️  NOTA: Amazon Q Business substituiu o QuickSight tradicional"
echo "   Mas a funcionalidade de dashboards continua a mesma!"