#!/bin/bash

# Script de validação automática para Checkpoint 6: Governança de Dados
# 
# Uso: ./validate_governance.sh [ACCOUNT_ID] [REGION]
# Exemplo: ./validate_governance.sh 123456789012 us-east-1

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuração
ACCOUNT_ID=${1:-$(aws sts get-caller-identity --query Account --output text)}
REGION=${2:-us-east-1}
BUCKET="qyntara-${ACCOUNT_ID}-${REGION}"
TODAY=$(date +%Y-%m-%d)

echo "=========================================="
echo "Validação de Governança de Dados"
echo "=========================================="
echo "Account ID: $ACCOUNT_ID"
echo "Region: $REGION"
echo "Bucket: $BUCKET"
echo "Date: $TODAY"
echo ""

# Função para verificar sucesso
check_success() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
        return 0
    else
        echo -e "${RED}✗ $1${NC}"
        return 1
    fi
}

# Função para verificar warning
check_warning() {
    if [ $? -eq 0 ]; then
        echo -e "${YELLOW}⚠ $1${NC}"
        return 0
    else
        echo -e "${RED}✗ $1${NC}"
        return 1
    fi
}

# Contador de testes
TESTS_PASSED=0
TESTS_FAILED=0

# ==========================================
# 1. Validar Data Quality Lambda
# ==========================================
echo "=========================================="
echo "1. Validando Data Quality Lambda"
echo "=========================================="

echo "Executando Data Quality Lambda..."
aws lambda invoke \
  --function-name b3tr-data-quality \
  --payload '{}' \
  /tmp/dq_response.json > /dev/null 2>&1

if check_success "Lambda executada"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

# Verificar resposta
if jq -e '.ok == true' /tmp/dq_response.json > /dev/null 2>&1; then
    check_success "Resposta OK"
    ((TESTS_PASSED++))
else
    check_success "Resposta com erro"
    ((TESTS_FAILED++))
    cat /tmp/dq_response.json | jq .
fi

# Verificar métricas no S3
echo ""
echo "Verificando métricas no S3..."
QUALITY_FILES=$(aws s3 ls s3://${BUCKET}/monitoring/data_quality/dt=${TODAY}/ 2>/dev/null | wc -l)

if [ "$QUALITY_FILES" -gt 0 ]; then
    check_success "Métricas salvas no S3 ($QUALITY_FILES arquivos)"
    ((TESTS_PASSED++))
else
    check_success "Nenhuma métrica encontrada no S3"
    ((TESTS_FAILED++))
fi

# Baixar última métrica e verificar campos
if [ "$QUALITY_FILES" -gt 0 ]; then
    LATEST_QUALITY=$(aws s3 ls s3://${BUCKET}/monitoring/data_quality/dt=${TODAY}/ | tail -1 | awk '{print $4}')
    aws s3 cp s3://${BUCKET}/monitoring/data_quality/dt=${TODAY}/${LATEST_QUALITY} /tmp/quality.json > /dev/null 2>&1
    
    # Verificar campos obrigatórios
    REQUIRED_FIELDS=("completeness_percentage" "missing_tickers" "avg_ingestion_latency_ms" "error_rate" "anomalies" "quality_score")
    
    for field in "${REQUIRED_FIELDS[@]}"; do
        if jq -e "has(\"$field\")" /tmp/quality.json > /dev/null 2>&1; then
            ((TESTS_PASSED++))
        else
            echo -e "${RED}✗ Campo obrigatório ausente: $field${NC}"
            ((TESTS_FAILED++))
        fi
    done
    
    echo -e "${GREEN}✓ Todos os campos obrigatórios presentes${NC}"
    
    # Exibir métricas
    echo ""
    echo "Métricas de Qualidade:"
    echo "  Completeness: $(jq -r '.completeness_percentage' /tmp/quality.json)%"
    echo "  Quality Score: $(jq -r '.quality_score' /tmp/quality.json)"
    echo "  Validation Errors: $(jq -r '.validation_errors_count' /tmp/quality.json)"
    echo "  Anomalies: $(jq -r '.anomalies | length' /tmp/quality.json)"
fi

# ==========================================
# 2. Validar Historical Data Validator
# ==========================================
echo ""
echo "=========================================="
echo "2. Validando Historical Data Validator"
echo "=========================================="

echo "Executando Historical Validator Lambda..."
aws lambda invoke \
  --function-name b3tr-historical-validator \
  --payload '{}' \
  /tmp/hv_response.json > /dev/null 2>&1

if check_success "Lambda executada"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
fi

# Verificar resposta
if jq -e '.ok == true' /tmp/hv_response.json > /dev/null 2>&1; then
    check_success "Resposta OK"
    ((TESTS_PASSED++))
    
    echo ""
    echo "Resultados da Validação Histórica:"
    echo "  Overall Quality Score: $(jq -r '.overall_quality_score' /tmp/hv_response.json)"
    echo "  Tickers Validated: $(jq -r '.tickers_validated' /tmp/hv_response.json)"
    echo "  Gaps Found: $(jq -r '.gaps_found' /tmp/hv_response.json)"
    echo "  Inconsistencies Found: $(jq -r '.inconsistencies_found' /tmp/hv_response.json)"
else
    check_success "Resposta com erro"
    ((TESTS_FAILED++))
    cat /tmp/hv_response.json | jq .
fi

# Verificar relatório no S3
echo ""
echo "Verificando relatório no S3..."
REPORT=$(aws s3 ls s3://${BUCKET}/monitoring/validation/ 2>/dev/null | grep historical_data_report | tail -1 | awk '{print $4}')

if [ -n "$REPORT" ]; then
    check_success "Relatório encontrado: $REPORT"
    ((TESTS_PASSED++))
    
    # Baixar e verificar estrutura
    aws s3 cp s3://${BUCKET}/monitoring/validation/${REPORT} /tmp/report.json > /dev/null 2>&1
    
    REPORT_FIELDS=("timestamp" "period_start" "period_end" "tickers_validated" "overall_quality_score" "gaps" "inconsistencies" "ticker_scores")
    
    for field in "${REPORT_FIELDS[@]}"; do
        if jq -e "has(\"$field\")" /tmp/report.json > /dev/null 2>&1; then
            ((TESTS_PASSED++))
        else
            echo -e "${RED}✗ Campo obrigatório ausente no relatório: $field${NC}"
            ((TESTS_FAILED++))
        fi
    done
    
    echo -e "${GREEN}✓ Todos os campos obrigatórios presentes no relatório${NC}"
else
    check_success "Nenhum relatório encontrado"
    ((TESTS_FAILED++))
fi

# ==========================================
# 3. Validar Data Lineage
# ==========================================
echo ""
echo "=========================================="
echo "3. Validando Data Lineage"
echo "=========================================="

echo "Verificando registros de lineage..."
LINEAGE_FILES=$(aws s3 ls s3://${BUCKET}/monitoring/lineage/dt=${TODAY}/ 2>/dev/null | wc -l)

if [ "$LINEAGE_FILES" -gt 0 ]; then
    check_success "Registros de lineage encontrados ($LINEAGE_FILES arquivos)"
    ((TESTS_PASSED++))
    
    # Baixar e verificar estrutura
    LATEST_LINEAGE=$(aws s3 ls s3://${BUCKET}/monitoring/lineage/dt=${TODAY}/ | tail -1 | awk '{print $4}')
    aws s3 cp s3://${BUCKET}/monitoring/lineage/dt=${TODAY}/${LATEST_LINEAGE} /tmp/lineage.json > /dev/null 2>&1
    
    # Verificar campos obrigatórios
    LINEAGE_FIELDS=("data_id" "ticker" "timestamp" "source" "source_version" "pipeline_version" "collection_timestamp" "storage_timestamp" "transformations" "s3_location")
    
    FIRST_RECORD=$(jq -r '.records[0]' /tmp/lineage.json)
    
    for field in "${LINEAGE_FIELDS[@]}"; do
        if echo "$FIRST_RECORD" | jq -e "has(\"$field\")" > /dev/null 2>&1; then
            ((TESTS_PASSED++))
        else
            echo -e "${RED}✗ Campo obrigatório ausente no lineage: $field${NC}"
            ((TESTS_FAILED++))
        fi
    done
    
    echo -e "${GREEN}✓ Todos os campos obrigatórios presentes no lineage${NC}"
    
    # Verificar transformações
    TRANSFORMATIONS=$(echo "$FIRST_RECORD" | jq -r '.transformations | length')
    echo ""
    echo "Lineage Info:"
    echo "  Total Records: $(jq -r '.total_records' /tmp/lineage.json)"
    echo "  Transformations: $TRANSFORMATIONS"
    
    if [ "$TRANSFORMATIONS" -gt 0 ]; then
        check_success "Transformações registradas"
        ((TESTS_PASSED++))
    else
        check_warning "Nenhuma transformação registrada (execute Data Quality Lambda)"
        ((TESTS_FAILED++))
    fi
else
    check_success "Nenhum registro de lineage encontrado"
    ((TESTS_FAILED++))
fi

# ==========================================
# 4. Validar CloudWatch Metrics
# ==========================================
echo ""
echo "=========================================="
echo "4. Validando CloudWatch Metrics"
echo "=========================================="

echo "Verificando métricas publicadas..."
METRICS=$(aws cloudwatch list-metrics --namespace B3TR 2>/dev/null | jq -r '.Metrics[].MetricName' | sort -u)

if [ -n "$METRICS" ]; then
    check_success "Métricas encontradas no CloudWatch"
    ((TESTS_PASSED++))
    
    echo ""
    echo "Métricas disponíveis:"
    echo "$METRICS" | while read metric; do
        echo "  - $metric"
    done
    
    # Verificar métricas esperadas
    EXPECTED_METRICS=("DataCompleteness" "DataQualityScore" "ValidationErrors" "AnomaliesDetected")
    
    for metric in "${EXPECTED_METRICS[@]}"; do
        if echo "$METRICS" | grep -q "$metric"; then
            ((TESTS_PASSED++))
        else
            echo -e "${RED}✗ Métrica esperada não encontrada: $metric${NC}"
            ((TESTS_FAILED++))
        fi
    done
    
    echo -e "${GREEN}✓ Todas as métricas esperadas presentes${NC}"
else
    check_success "Nenhuma métrica encontrada no CloudWatch"
    ((TESTS_FAILED++))
fi

# ==========================================
# Resumo Final
# ==========================================
echo ""
echo "=========================================="
echo "Resumo da Validação"
echo "=========================================="
echo -e "${GREEN}Testes Passados: $TESTS_PASSED${NC}"
echo -e "${RED}Testes Falhados: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Todos os testes passaram! Governança de dados validada com sucesso.${NC}"
    echo ""
    echo "Próximos passos:"
    echo "  1. Revisar métricas de qualidade"
    echo "  2. Revisar relatório de validação histórica"
    echo "  3. Prosseguir para Task 7 (Model Ensemble)"
    exit 0
else
    echo -e "${RED}✗ Alguns testes falharam. Revise os erros acima.${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Verificar logs do CloudWatch"
    echo "  2. Verificar permissões IAM"
    echo "  3. Consultar VALIDATION_CHECKPOINT_6.md"
    exit 1
fi
