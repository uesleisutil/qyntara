#!/bin/bash
# Script para limpar recursos do QuickSight (se houver)
# ATENÇÃO: Este script deleta recursos permanentemente!
# Autor: B3TR Team
# Data: 2026-03-07

set -e

echo "🗑️  Script de Limpeza do QuickSight"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  ATENÇÃO: Este script irá deletar TODOS os recursos do QuickSight!"
echo "⚠️  Esta ação é IRREVERSÍVEL!"
echo ""
read -p "Deseja continuar? (digite 'SIM' para confirmar): " CONFIRM

if [ "$CONFIRM" != "SIM" ]; then
    echo "❌ Operação cancelada pelo usuário."
    exit 0
fi

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
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo ""
echo "📍 Região: $REGION"
echo "🔑 Account ID: $ACCOUNT_ID"
echo ""

# Função para deletar dashboards
delete_dashboards() {
    echo "1️⃣ Deletando QuickSight Dashboards..."
    
    DASHBOARDS=$(aws quicksight list-dashboards \
        --aws-account-id $ACCOUNT_ID \
        --region $REGION 2>&1 || echo "ERROR")
    
    if echo "$DASHBOARDS" | grep -q "ERROR\|NOT_SUBSCRIBED\|ResourceNotFoundException"; then
        echo -e "${GREEN}✅ Nenhum dashboard encontrado${NC}"
        return
    fi
    
    DASHBOARD_IDS=$(echo "$DASHBOARDS" | jq -r '.DashboardSummaryList[]?.DashboardId' 2>/dev/null || echo "")
    
    if [ -z "$DASHBOARD_IDS" ]; then
        echo -e "${GREEN}✅ Nenhum dashboard encontrado${NC}"
        return
    fi
    
    for DASHBOARD_ID in $DASHBOARD_IDS; do
        echo "   Deletando dashboard: $DASHBOARD_ID"
        aws quicksight delete-dashboard \
            --aws-account-id $ACCOUNT_ID \
            --dashboard-id "$DASHBOARD_ID" \
            --region $REGION 2>&1 || echo "   ⚠️  Erro ao deletar $DASHBOARD_ID"
    done
    
    echo -e "${GREEN}✅ Dashboards deletados${NC}"
}

# Função para deletar data sets
delete_datasets() {
    echo ""
    echo "2️⃣ Deletando QuickSight Data Sets..."
    
    DATASETS=$(aws quicksight list-data-sets \
        --aws-account-id $ACCOUNT_ID \
        --region $REGION 2>&1 || echo "ERROR")
    
    if echo "$DATASETS" | grep -q "ERROR\|NOT_SUBSCRIBED\|ResourceNotFoundException"; then
        echo -e "${GREEN}✅ Nenhum data set encontrado${NC}"
        return
    fi
    
    DATASET_IDS=$(echo "$DATASETS" | jq -r '.DataSetSummaries[]?.DataSetId' 2>/dev/null || echo "")
    
    if [ -z "$DATASET_IDS" ]; then
        echo -e "${GREEN}✅ Nenhum data set encontrado${NC}"
        return
    fi
    
    for DATASET_ID in $DATASET_IDS; do
        echo "   Deletando data set: $DATASET_ID"
        aws quicksight delete-data-set \
            --aws-account-id $ACCOUNT_ID \
            --data-set-id "$DATASET_ID" \
            --region $REGION 2>&1 || echo "   ⚠️  Erro ao deletar $DATASET_ID"
    done
    
    echo -e "${GREEN}✅ Data sets deletados${NC}"
}

# Função para deletar data sources
delete_datasources() {
    echo ""
    echo "3️⃣ Deletando QuickSight Data Sources..."
    
    DATASOURCES=$(aws quicksight list-data-sources \
        --aws-account-id $ACCOUNT_ID \
        --region $REGION 2>&1 || echo "ERROR")
    
    if echo "$DATASOURCES" | grep -q "ERROR\|NOT_SUBSCRIBED\|ResourceNotFoundException"; then
        echo -e "${GREEN}✅ Nenhum data source encontrado${NC}"
        return
    fi
    
    DATASOURCE_IDS=$(echo "$DATASOURCES" | jq -r '.DataSources[]?.DataSourceId' 2>/dev/null || echo "")
    
    if [ -z "$DATASOURCE_IDS" ]; then
        echo -e "${GREEN}✅ Nenhum data source encontrado${NC}"
        return
    fi
    
    for DATASOURCE_ID in $DATASOURCE_IDS; do
        echo "   Deletando data source: $DATASOURCE_ID"
        aws quicksight delete-data-source \
            --aws-account-id $ACCOUNT_ID \
            --data-source-id "$DATASOURCE_ID" \
            --region $REGION 2>&1 || echo "   ⚠️  Erro ao deletar $DATASOURCE_ID"
    done
    
    echo -e "${GREEN}✅ Data sources deletados${NC}"
}

# Executar limpeza
delete_dashboards
delete_datasets
delete_datasources

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Limpeza de recursos concluída!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  PRÓXIMO PASSO IMPORTANTE:"
echo ""
echo "Para cancelar a assinatura do QuickSight e parar as cobranças:"
echo ""
echo "1. Acesse: https://console.aws.amazon.com/quicksight/"
echo "2. Clique no ícone de usuário (canto superior direito)"
echo "3. Selecione 'Manage QuickSight'"
echo "4. Vá em 'Account settings'"
echo "5. Role até o final e clique em 'Unsubscribe'"
echo "6. Confirme o cancelamento"
echo ""
echo "💡 Após cancelar, você não será mais cobrado pelo QuickSight!"
echo ""
echo "✅ Dashboard alternativo disponível em:"
echo "   https://qyntara.tech"
echo ""
