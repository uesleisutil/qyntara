#!/bin/bash
# Script de deploy da versão 2.0.0
# Autor: B3TR Team
# Data: 2026-03-07

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  B3 Tactical Ranking v2.0.0 - Deploy Script${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar pré-requisitos
echo -e "${YELLOW}📋 Verificando pré-requisitos...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI não encontrado${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não encontrado${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm não encontrado${NC}"
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ Credenciais AWS não configuradas${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Todos os pré-requisitos atendidos${NC}"
echo ""

# Obter informações da conta
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}

echo -e "${BLUE}📍 Conta AWS: ${ACCOUNT_ID}${NC}"
echo -e "${BLUE}📍 Região: ${REGION}${NC}"
echo ""

# Confirmar deploy
echo -e "${YELLOW}⚠️  Este script irá:${NC}"
echo "  1. Fazer deploy da infraestrutura AWS (CDK)"
echo "  2. Verificar recursos criados"
echo "  3. Executar testes básicos"
echo ""
read -p "Deseja continuar? (s/N): " CONFIRM

if [[ ! "$CONFIRM" =~ ^[Ss]$ ]]; then
    echo -e "${RED}❌ Deploy cancelado${NC}"
    exit 0
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Etapa 1: Deploy da Infraestrutura${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd infra

# Instalar dependências
echo -e "${YELLOW}📦 Instalando dependências...${NC}"
npm ci

# Bootstrap CDK (se necessário)
echo -e "${YELLOW}🔧 Verificando bootstrap do CDK...${NC}"
if ! aws cloudformation describe-stacks --stack-name CDKToolkit &> /dev/null; then
    echo -e "${YELLOW}🚀 Fazendo bootstrap do CDK...${NC}"
    npx cdk bootstrap
else
    echo -e "${GREEN}✅ CDK já está bootstrapped${NC}"
fi

# Synth
echo -e "${YELLOW}🔨 Sintetizando stack...${NC}"
npx cdk synth --quiet

# Deploy
echo -e "${YELLOW}🚀 Fazendo deploy...${NC}"
npx cdk deploy --require-approval never

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deploy concluído com sucesso!${NC}"
else
    echo -e "${RED}❌ Erro no deploy${NC}"
    exit 1
fi

cd ..

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Etapa 2: Verificação de Recursos${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Obter outputs do stack
echo -e "${YELLOW}📊 Obtendo informações do stack...${NC}"

STACK_NAME="B3TacticalRankingStackV2"
BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' \
    --output text 2>/dev/null || echo "")

ALERTS_TOPIC=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`AlertsTopicArn`].OutputValue' \
    --output text 2>/dev/null || echo "")

DASHBOARD_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs[?OutputKey==`DashboardUrl`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -n "$BUCKET_NAME" ]; then
    echo -e "${GREEN}✅ Bucket S3: ${BUCKET_NAME}${NC}"
else
    echo -e "${RED}❌ Bucket S3 não encontrado${NC}"
fi

if [ -n "$ALERTS_TOPIC" ]; then
    echo -e "${GREEN}✅ SNS Topic: ${ALERTS_TOPIC}${NC}"
else
    echo -e "${YELLOW}⚠️  SNS Topic não encontrado${NC}"
fi

if [ -n "$DASHBOARD_URL" ]; then
    echo -e "${GREEN}✅ Dashboard: ${DASHBOARD_URL}${NC}"
else
    echo -e "${YELLOW}⚠️  Dashboard URL não encontrada${NC}"
fi

# Verificar Lambdas
echo ""
echo -e "${YELLOW}🔍 Verificando Lambda Functions...${NC}"

LAMBDA_COUNT=$(aws lambda list-functions \
    --query "Functions[?contains(FunctionName, 'B3TacticalRanking')].FunctionName" \
    --output text | wc -w)

echo -e "${GREEN}✅ ${LAMBDA_COUNT} Lambda Functions criadas${NC}"

# Verificar EventBridge Rules
echo ""
echo -e "${YELLOW}🔍 Verificando EventBridge Rules...${NC}"

RULE_COUNT=$(aws events list-rules \
    --query "Rules[?contains(Name, 'B3TacticalRanking')].Name" \
    --output text | wc -w)

echo -e "${GREEN}✅ ${RULE_COUNT} EventBridge Rules criadas${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Etapa 3: Testes Básicos${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Verificar se o bucket está acessível
if [ -n "$BUCKET_NAME" ]; then
    echo -e "${YELLOW}🧪 Testando acesso ao S3...${NC}"
    if aws s3 ls s3://$BUCKET_NAME &> /dev/null; then
        echo -e "${GREEN}✅ Bucket S3 acessível${NC}"
    else
        echo -e "${RED}❌ Erro ao acessar bucket S3${NC}"
    fi
fi

# Verificar configuração do BRAPI secret
echo ""
echo -e "${YELLOW}🔐 Verificando BRAPI Secret...${NC}"
if aws secretsmanager describe-secret --secret-id brapi/pro/token &> /dev/null; then
    echo -e "${GREEN}✅ BRAPI Secret configurado${NC}"
else
    echo -e "${YELLOW}⚠️  BRAPI Secret não encontrado${NC}"
    echo -e "${YELLOW}   Configure com:${NC}"
    echo -e "${YELLOW}   aws secretsmanager create-secret --name brapi/pro/token --secret-string '{\"token\":\"SEU_TOKEN\"}'${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Deploy Concluído!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}✅ Deploy da versão 2.0.0 concluído com sucesso!${NC}"
echo ""

echo -e "${YELLOW}📋 Próximos Passos:${NC}"
echo ""

if ! aws secretsmanager describe-secret --secret-id brapi/pro/token &> /dev/null; then
    echo "1. Configure o BRAPI Secret:"
    echo "   aws secretsmanager create-secret \\"
    echo "     --name brapi/pro/token \\"
    echo "     --secret-string '{\"token\":\"SEU_TOKEN\"}'"
    echo ""
fi

if [ -n "$ALERTS_TOPIC" ]; then
    echo "2. Configure email de alertas (opcional):"
    echo "   aws sns subscribe \\"
    echo "     --topic-arn $ALERTS_TOPIC \\"
    echo "     --protocol email \\"
    echo "     --notification-endpoint seu-email@example.com"
    echo ""
fi

echo "3. Configure o dashboard no GitHub Pages:"
echo "   - Veja DEPLOY_GUIDE.md para instruções"
echo ""

echo "4. Teste o sistema:"
echo "   ./scripts/test-system.sh"
echo ""

if [ -n "$DASHBOARD_URL" ]; then
    echo "5. Acesse o dashboard:"
    echo "   $DASHBOARD_URL"
    echo ""
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${GREEN}🎉 Parabéns! Seu sistema B3TR v2.0.0 está no ar!${NC}"
echo ""
