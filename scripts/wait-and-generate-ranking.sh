#!/bin/bash

# Script para aguardar treinamento e gerar ranking

set -e

JOB_NAME="b3tr-deepar-20260305-221300"
RANK_START_LAMBDA="B3TacticalRankingStackV2-RankStart0C43949D-C8EvaGliJywJ"
RANK_FINALIZE_LAMBDA="B3TacticalRankingStackV2-RankFinalize29480CC5-NWnTPORyllHA"

echo "🤖 Aguardando treinamento do modelo: $JOB_NAME"
echo "⏱️  Tempo estimado: 30 minutos"
echo ""

# Aguardar até o job completar
for i in {1..120}; do
  STATUS=$(aws sagemaker describe-training-job \
    --training-job-name $JOB_NAME \
    --query 'TrainingJobStatus' \
    --output text 2>/dev/null || echo "NOT_FOUND")
  
  if [[ "$STATUS" == "Completed" ]]; then
    echo "✅ Treinamento concluído!"
    break
  elif [[ "$STATUS" == "Failed" ]] || [[ "$STATUS" == "Stopped" ]]; then
    echo "❌ Treinamento falhou com status: $STATUS"
    exit 1
  fi
  
  echo "[$i/120] Status: $STATUS (aguardando...)"
  sleep 15
done

if [[ "$STATUS" != "Completed" ]]; then
  echo "⏰ Timeout aguardando treinamento"
  exit 1
fi

echo ""
echo "🚀 Iniciando geração de ranking..."

# Executar rank_start
aws lambda invoke \
  --function-name $RANK_START_LAMBDA \
  --payload '{}' \
  /tmp/rank-start.json

echo "✅ Rank Start executado"
cat /tmp/rank-start.json | jq .

# Aguardar um pouco para o SageMaker processar
echo "⏱️  Aguardando processamento do SageMaker..."
sleep 60

# Executar rank_finalize
aws lambda invoke \
  --function-name $RANK_FINALIZE_LAMBDA \
  --payload '{}' \
  /tmp/rank-finalize.json

echo "✅ Rank Finalize executado"
cat /tmp/rank-finalize.json | jq .

echo ""
echo "🎉 Pipeline completo! Dados disponíveis no dashboard:"
echo "   https://uesleisutil.github.io/b3-tactical-ranking"
