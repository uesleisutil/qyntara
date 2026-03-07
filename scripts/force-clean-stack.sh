#!/bin/bash

# Script para forçar limpeza da stack B3TR

set -e

STACK_NAME="B3TacticalRankingStack"

echo "🧹 Limpando stack $STACK_NAME..."

# Deletar recursos manualmente se necessário
echo "Verificando recursos problemáticos..."

# Tentar deletar a stack ignorando o recurso problemático
echo "Tentando deletar stack..."
aws cloudformation delete-stack \
  --stack-name $STACK_NAME \
  --retain-resources DashboardBucket5758873D 2>/dev/null || true

# Aguardar deleção
echo "Aguardando deleção da stack..."
for i in {1..60}; do
  STATUS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].StackStatus' \
    --output text 2>&1 || echo "DELETED")
  
  if [[ "$STATUS" == *"does not exist"* ]] || [[ "$STATUS" == "DELETED" ]]; then
    echo "✅ Stack deletada com sucesso!"
    exit 0
  fi
  
  echo "Status: $STATUS (tentativa $i/60)"
  sleep 5
done

echo "⚠️  Stack ainda existe. Você pode precisar deletar manualmente via console AWS."
echo "   https://console.aws.amazon.com/cloudformation"
