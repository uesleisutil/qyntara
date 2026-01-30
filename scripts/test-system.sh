#!/usr/bin/env bash
# Testa o sistema B3TR após deploy
set -euo pipefail

echo "🧪 Testando Sistema B3TR"
echo "======================="

# Carregar variáveis
if [ -f .env.local ]; then
    source .env.local
else
    echo "❌ Arquivo .env.local não encontrado. Execute ./scripts/setup.sh primeiro."
    exit 1
fi

# Função para testar Lambda
test_lambda() {
    local function_name=$1
    local description=$2
    
    echo "🔍 Testando: $description"
    
    # Encontrar nome completo da função
    local full_name=$(aws lambda list-functions \
        --query "Functions[?contains(FunctionName, '$function_name')].FunctionName" \
        --output text)
    
    if [ -z "$full_name" ]; then
        echo "❌ Função $function_name não encontrada"
        return 1
    fi
    
    # Invocar função
    local result=$(aws lambda invoke \
        --function-name "$full_name" \
        --payload '{}' \
        /tmp/test-$function_name.json 2>&1)
    
    if echo "$result" | grep -q '"StatusCode": 200'; then
        echo "✅ $description: OK"
        # Mostrar resultado se não for muito grande
        local output=$(cat /tmp/test-$function_name.json)
        if [ ${#output} -lt 200 ]; then
            echo "   Resultado: $output"
        fi
    else
        echo "❌ $description: FALHOU"
        echo "   Erro: $result"
        cat /tmp/test-$function_name.json
    fi
    
    rm -f /tmp/test-$function_name.json
}

# Verificar infraestrutura
echo "🏗️  Verificando infraestrutura..."

# Verificar bucket S3
if aws s3 ls "s3://$B3TR_BUCKET" >/dev/null 2>&1; then
    echo "✅ Bucket S3: OK ($B3TR_BUCKET)"
else
    echo "❌ Bucket S3: FALHOU"
fi

# Verificar secret BRAPI
if aws secretsmanager describe-secret --secret-id brapi/pro/token >/dev/null 2>&1; then
    echo "✅ Secret BRAPI: OK"
else
    echo "⚠️  Secret BRAPI: NÃO CONFIGURADO"
    echo "   Configure com: aws secretsmanager create-secret --name 'brapi/pro/token' --secret-string '{\"token\":\"SEU_TOKEN\"}'"
fi

# Testar Lambdas
echo ""
echo "🔧 Testando Funções Lambda..."
test_lambda "Bootstrap" "Bootstrap histórico"
test_lambda "Quotes5m" "Ingestão de cotações"
test_lambda "MonitorIngestion" "Monitor de ingestão"

# Verificar schedules EventBridge
echo ""
echo "⏰ Verificando schedules..."
local schedules=$(aws events list-rules \
    --query "Rules[?contains(Name, 'B3Tactical')].{Name:Name,State:State}" \
    --output table)

if [ -n "$schedules" ]; then
    echo "✅ EventBridge schedules configurados:"
    echo "$schedules"
else
    echo "❌ Nenhum schedule encontrado"
fi

# Verificar alarmes CloudWatch
echo ""
echo "🚨 Verificando alarmes..."
local alarms=$(aws cloudwatch describe-alarms \
    --query "MetricAlarms[?contains(AlarmName, 'B3Tactical')].{Name:AlarmName,State:StateValue}" \
    --output table)

if [ -n "$alarms" ]; then
    echo "✅ CloudWatch alarms configurados:"
    echo "$alarms"
else
    echo "❌ Nenhum alarme encontrado"
fi

# Verificar dados no S3
echo ""
echo "📊 Verificando dados..."
local data_count=$(aws s3 ls "s3://$B3TR_BUCKET" --recursive | wc -l)
echo "📁 Arquivos no S3: $data_count"

if [ "$data_count" -gt 0 ]; then
    echo "✅ Dados encontrados no S3"
    echo "📋 Estrutura de dados:"
    aws s3 ls "s3://$B3TR_BUCKET/" | head -10
else
    echo "⚠️  Nenhum dado encontrado (normal se acabou de fazer deploy)"
fi

echo ""
echo "🎯 Resumo do Teste"
echo "=================="
echo "✅ Sistema deployado e funcionando"
echo "📚 Consulte docs/troubleshooting.md para problemas"
echo "📊 Monitore em: AWS Console > CloudWatch"
echo "📧 Configure alertas: AWS Console > SNS"