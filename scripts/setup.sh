#!/usr/bin/env bash
# Setup completo do projeto B3TR
set -euo pipefail

echo "🚀 Setup B3TR - B3 Tactical Ranking"
echo "=================================="

# Verificar pré-requisitos
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI não encontrado. Instale primeiro."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js não encontrado. Instale primeiro."; exit 1; }
command -v cdk >/dev/null 2>&1 || { echo "❌ AWS CDK não encontrado. Execute: npm i -g aws-cdk"; exit 1; }

# Verificar configuração AWS
aws sts get-caller-identity >/dev/null 2>&1 || { echo "❌ AWS CLI não configurado. Execute: aws configure"; exit 1; }

echo "✅ Pré-requisitos OK"

# Configurar ambiente
if [ ! -f .env ]; then
    echo "📝 Criando .env a partir do exemplo..."
    cp .env.example .env
    echo "⚠️  IMPORTANTE: Edite o arquivo .env com suas configurações!"
    echo "   - ALERT_EMAIL=your-email@example.com"
    echo "   - Outros parâmetros conforme necessário"
fi

# Deploy da infraestrutura
echo "🏗️  Fazendo deploy da infraestrutura..."
cd infra
npm ci
cdk bootstrap --region us-east-1
cdk deploy --require-approval never
cd ..

# Extrair informações do stack
echo "📋 Extraindo informações do stack..."
./scripts/bootstrap_env.sh

# Instruções finais
echo ""
echo "🎉 Setup concluído com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "1. Configure o token BRAPI:"
echo "   aws secretsmanager create-secret --name 'brapi/pro/token' --secret-string '{\"token\":\"SEU_TOKEN\"}'"
echo ""
echo "2. Configure alertas por email:"
echo "   aws sns subscribe --topic-arn \$(grep ALERTS_TOPIC_ARN .env.local | cut -d= -f2) --protocol email --notification-endpoint your-email@example.com"
echo ""
echo "3. Teste o sistema:"
echo "   ./scripts/test-system.sh"
echo ""
echo "📚 Documentação: docs/"
echo "🔧 Troubleshooting: docs/troubleshooting.md"