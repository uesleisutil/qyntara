#!/bin/bash
set -e

echo "=================================================="
echo "  B3 Tactical Ranking - Validação de Produção"
echo "=================================================="
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funções auxiliares
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Verificar AWS CLI
echo "1. Verificando AWS CLI..."
if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version 2>&1 | cut -d' ' -f1)
    check_pass "AWS CLI instalado: $AWS_VERSION"
else
    check_fail "AWS CLI não encontrado"
    exit 1
fi

# Verificar credenciais AWS
echo ""
echo "2. Verificando credenciais AWS..."
if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    REGION=$(aws configure get region)
    check_pass "Credenciais válidas - Account: $ACCOUNT_ID, Region: $REGION"
else
    check_fail "Credenciais AWS inválidas"
    exit 1
fi

# Verificar bucket S3
echo ""
echo "3. Verificando bucket S3..."
BUCKET_PREFIX=${B3TR_BUCKET_PREFIX:-b3tr}
BUCKET_NAME="${BUCKET_PREFIX}-${ACCOUNT_ID}-${REGION}"

if aws s3 ls "s3://${BUCKET_NAME}" &> /dev/null; then
    check_pass "Bucket existe: s3://${BUCKET_NAME}"
    
    # Verificar estrutura de pastas
    echo "   Verificando estrutura..."
    
    if aws s3 ls "s3://${BUCKET_NAME}/config/" &> /dev/null; then
        check_pass "   - config/ existe"
    else
        check_warn "   - config/ não encontrado"
    fi
    
    if aws s3 ls "s3://${BUCKET_NAME}/curated/daily_monthly/" &> /dev/null; then
        DATA_COUNT=$(aws s3 ls "s3://${BUCKET_NAME}/curated/daily_monthly/" --recursive | wc -l)
        if [ "$DATA_COUNT" -gt 100 ]; then
            check_pass "   - curated/daily_monthly/ existe ($DATA_COUNT arquivos)"
        else
            check_warn "   - curated/daily_monthly/ tem poucos dados ($DATA_COUNT arquivos)"
        fi
    else
        check_warn "   - curated/daily_monthly/ não encontrado"
    fi
    
    if aws s3 ls "s3://${BUCKET_NAME}/models/ensemble/" &> /dev/null; then
        check_pass "   - models/ensemble/ existe"
        
        # Verificar se há modelo treinado
        MODEL_COUNT=$(aws s3 ls "s3://${BUCKET_NAME}/models/ensemble/" --recursive | grep "model.tar.gz" | wc -l)
        if [ "$MODEL_COUNT" -gt 0 ]; then
            check_pass "   - Modelo treinado encontrado"
        else
            check_warn "   - Nenhum modelo treinado encontrado"
        fi
    else
        check_warn "   - models/ensemble/ não encontrado"
    fi
else
    check_fail "Bucket não existe: s3://${BUCKET_NAME}"
    echo "   Execute: cd infra && cdk deploy"
    exit 1
fi

# Verificar Lambdas
echo ""
echo "4. Verificando Lambdas..."

LAMBDAS=(
    "TrainSageMaker"
    "RankSageMaker"
    "MonitorCosts"
    "MonitorIngestion"
    "MonitorModelQuality"
)

for LAMBDA in "${LAMBDAS[@]}"; do
    FULL_NAME=$(aws lambda list-functions --query "Functions[?contains(FunctionName, '$LAMBDA')].FunctionName" --output text | head -1)
    if [ -n "$FULL_NAME" ]; then
        check_pass "   - $LAMBDA: $FULL_NAME"
    else
        check_fail "   - $LAMBDA não encontrado"
    fi
done

# Verificar SageMaker Role
echo ""
echo "5. Verificando SageMaker Role..."
ROLE_NAME="B3TRSageMakerRole"
if aws iam get-role --role-name "$ROLE_NAME" &> /dev/null; then
    ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
    check_pass "SageMaker Role existe: $ROLE_ARN"
else
    check_fail "SageMaker Role não encontrado"
fi

# Verificar EventBridge Rules
echo ""
echo "6. Verificando EventBridge Rules..."

RULES=(
    "IngestDuringB3"
    "RankSageMakerDaily"
    "MonitorCostsDaily"
)

for RULE in "${RULES[@]}"; do
    FULL_RULE=$(aws events list-rules --query "Rules[?contains(Name, '$RULE')].Name" --output text | head -1)
    if [ -n "$FULL_RULE" ]; then
        STATE=$(aws events describe-rule --name "$FULL_RULE" --query 'State' --output text)
        if [ "$STATE" == "ENABLED" ]; then
            check_pass "   - $RULE: ENABLED"
        else
            check_warn "   - $RULE: $STATE"
        fi
    else
        check_fail "   - $RULE não encontrado"
    fi
done

# Verificar arquivos locais
echo ""
echo "7. Verificando arquivos locais..."

FILES=(
    "ml/src/features/advanced_features.py"
    "ml/src/sagemaker/train_ensemble.py"
    "ml/src/sagemaker/hyperparameter_tuning.py"
    "ml/src/lambdas/train_sagemaker.py"
    "ml/src/lambdas/rank_sagemaker.py"
    "PRODUCTION_DEPLOYMENT.md"
    "SAGEMAKER_ENSEMBLE.md"
    "IMPLEMENTATION_SUMMARY.md"
)

for FILE in "${FILES[@]}"; do
    if [ -f "$FILE" ]; then
        check_pass "   - $FILE"
    else
        check_fail "   - $FILE não encontrado"
    fi
done

# Verificar dependências Python
echo ""
echo "8. Verificando dependências Python..."
if [ -f "ml/requirements.txt" ]; then
    check_pass "requirements.txt existe"
    
    REQUIRED_DEPS=("boto3" "pandas" "numpy" "xgboost")
    for DEP in "${REQUIRED_DEPS[@]}"; do
        if grep -q "$DEP" ml/requirements.txt; then
            check_pass "   - $DEP"
        else
            check_warn "   - $DEP não encontrado em requirements.txt"
        fi
    done
else
    check_fail "requirements.txt não encontrado"
fi

# Resumo final
echo ""
echo "=================================================="
echo "  Resumo da Validação"
echo "=================================================="
echo ""

# Verificar se há dados suficientes
if [ "$DATA_COUNT" -gt 100 ]; then
    echo -e "${GREEN}✓${NC} Dados históricos: OK ($DATA_COUNT arquivos)"
else
    echo -e "${YELLOW}⚠${NC} Dados históricos: Aguardando bootstrap ($DATA_COUNT arquivos)"
    echo "   Execute: aws logs tail /aws/lambda/*BootstrapHistory* --follow"
fi

# Verificar se há modelo treinado
if [ "$MODEL_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Modelo treinado: OK"
else
    echo -e "${YELLOW}⚠${NC} Modelo treinado: Pendente"
    echo "   Execute: aws lambda invoke --function-name TrainSageMaker --payload '{\"lookback_days\": 365}' output.json"
fi

echo ""
echo "=================================================="
echo "  Próximos Passos"
echo "=================================================="
echo ""
echo "1. Aguardar bootstrap de dados (120+ dias por ticker)"
echo "2. Treinar modelo inicial:"
echo "   aws lambda invoke --function-name <TrainSageMaker> --payload '{\"lookback_days\": 365}' output.json"
echo ""
echo "3. Verificar modelo treinado:"
echo "   aws s3 ls s3://${BUCKET_NAME}/models/ensemble/ --recursive"
echo ""
echo "4. Testar ranking:"
echo "   aws lambda invoke --function-name <RankSageMaker> --payload '{}' output.json"
echo ""
echo "5. Ver recomendações:"
echo "   aws s3 cp s3://${BUCKET_NAME}/recommendations/dt=\$(date +%Y-%m-%d)/top50.json - | jq"
echo ""
echo "=================================================="
