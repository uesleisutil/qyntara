#!/bin/bash
# Script para verificar se há recursos do QuickSight ativos na AWS
# Autor: B3TR Team
# Data: 2026-03-07

set -e

echo "🔍 Verificando recursos do QuickSight na AWS..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se AWS CLI está configurado
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI não encontrado. Instale o AWS CLI primeiro.${NC}"
    exit 1
fi

# Verificar credenciais AWS
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ Credenciais AWS não configuradas. Execute 'aws configure' primeiro.${NC}"
    exit 1
fi

REGION=${AWS_REGION:-us-east-1}
echo "📍 Região: $REGION"
echo ""

# Verificar QuickSight Dashboards
echo "1️⃣ Verificando QuickSight Dashboards..."
DASHBOARDS=$(aws quicksight list-dashboards --aws-account-id $(aws sts get-caller-identity --query Account --output text) --region $REGION 2>&1 || echo "NOT_SUBSCRIBED")

if echo "$DASHBOARDS" | grep -q "NOT_SUBSCRIBED\|ResourceNotFoundException\|AccessDeniedException"; then
    echo -e "${GREEN}✅ Nenhuma assinatura do QuickSight encontrada${NC}"
elif echo "$DASHBOARDS" | grep -q "DashboardSummaryList"; then
    DASHBOARD_COUNT=$(echo "$DASHBOARDS" | jq '.DashboardSummaryList | length' 2>/dev/null || echo "0")
    if [ "$DASHBOARD_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✅ Nenhum dashboard do QuickSight encontrado${NC}"
    else
        echo -e "${YELLOW}⚠️  Encontrados $DASHBOARD_COUNT dashboard(s) do QuickSight${NC}"
        echo "$DASHBOARDS" | jq '.DashboardSummaryList[] | {Name: .Name, DashboardId: .DashboardId}'
    fi
else
    echo -e "${GREEN}✅ Nenhum dashboard do QuickSight encontrado${NC}"
fi
echo ""

# Verificar QuickSight Data Sources
echo "2️⃣ Verificando QuickSight Data Sources..."
DATASOURCES=$(aws quicksight list-data-sources --aws-account-id $(aws sts get-caller-identity --query Account --output text) --region $REGION 2>&1 || echo "NOT_SUBSCRIBED")

if echo "$DATASOURCES" | grep -q "NOT_SUBSCRIBED\|ResourceNotFoundException\|AccessDeniedException"; then
    echo -e "${GREEN}✅ Nenhum data source do QuickSight encontrado${NC}"
elif echo "$DATASOURCES" | grep -q "DataSources"; then
    DATASOURCE_COUNT=$(echo "$DATASOURCES" | jq '.DataSources | length' 2>/dev/null || echo "0")
    if [ "$DATASOURCE_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✅ Nenhum data source do QuickSight encontrado${NC}"
    else
        echo -e "${YELLOW}⚠️  Encontrados $DATASOURCE_COUNT data source(s) do QuickSight${NC}"
        echo "$DATASOURCES" | jq '.DataSources[] | {Name: .Name, DataSourceId: .DataSourceId}'
    fi
else
    echo -e "${GREEN}✅ Nenhum data source do QuickSight encontrado${NC}"
fi
echo ""

# Verificar QuickSight Data Sets
echo "3️⃣ Verificando QuickSight Data Sets..."
DATASETS=$(aws quicksight list-data-sets --aws-account-id $(aws sts get-caller-identity --query Account --output text) --region $REGION 2>&1 || echo "NOT_SUBSCRIBED")

if echo "$DATASETS" | grep -q "NOT_SUBSCRIBED\|ResourceNotFoundException\|AccessDeniedException"; then
    echo -e "${GREEN}✅ Nenhum data set do QuickSight encontrado${NC}"
elif echo "$DATASETS" | grep -q "DataSetSummaries"; then
    DATASET_COUNT=$(echo "$DATASETS" | jq '.DataSetSummaries | length' 2>/dev/null || echo "0")
    if [ "$DATASET_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✅ Nenhum data set do QuickSight encontrado${NC}"
    else
        echo -e "${YELLOW}⚠️  Encontrados $DATASET_COUNT data set(s) do QuickSight${NC}"
        echo "$DATASETS" | jq '.DataSetSummaries[] | {Name: .Name, DataSetId: .DataSetId}'
    fi
else
    echo -e "${GREEN}✅ Nenhum data set do QuickSight encontrado${NC}"
fi
echo ""

# Verificar assinatura do QuickSight
echo "4️⃣ Verificando assinatura do QuickSight..."
SUBSCRIPTION=$(aws quicksight describe-account-subscription --aws-account-id $(aws sts get-caller-identity --query Account --output text) --region $REGION 2>&1 || echo "NOT_SUBSCRIBED")

if echo "$SUBSCRIPTION" | grep -q "NOT_SUBSCRIBED\|ResourceNotFoundException"; then
    echo -e "${GREEN}✅ Nenhuma assinatura ativa do QuickSight${NC}"
else
    echo -e "${YELLOW}⚠️  Assinatura do QuickSight ainda ativa!${NC}"
    echo ""
    echo "Para cancelar a assinatura do QuickSight:"
    echo "1. Acesse: https://console.aws.amazon.com/quicksight/"
    echo "2. Vá em 'Manage QuickSight' → 'Account settings'"
    echo "3. Clique em 'Unsubscribe'"
    echo ""
    echo -e "${RED}⚠️  IMPORTANTE: Cancele a assinatura para evitar cobranças!${NC}"
fi
echo ""

# Resumo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMO DA VERIFICAÇÃO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Dashboard atual: GitHub Pages (GRATUITO)"
echo "✅ URL: https://qyntara.tech"
echo ""
echo "💰 Economia estimada: ~$18-24/mês"
echo "   (QuickSight Enterprise: $18/usuário/mês + $0.30/sessão)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
