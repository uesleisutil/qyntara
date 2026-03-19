# Runbook de Troubleshooting - B3 Tactical Ranking MLOps System

**Versão**: 5.0.0  
**Data**: 2026-03-15  
**Status**: 📋 PRODUÇÃO

## Visão Geral

Este runbook fornece soluções para problemas comuns do sistema ML Monitoring, Governance & Dashboard da B3, incluindo os módulos de Data Quality, Drift Detection, Explainability, Backtesting, Alerts & Notifications, e infraestrutura (Cache, CDN, WebSocket, Export).

---

## Índice de Problemas

1. [Ingestão de Dados](#1-ingestão-de-dados)
2. [Geração de Recomendações](#2-geração-de-recomendações)
3. [Dashboard](#3-dashboard)
4. [Performance e Custos](#4-performance-e-custos)
5. [Infraestrutura AWS](#5-infraestrutura-aws)
6. [Problemas Comuns de Dados](#6-problemas-comuns-de-dados)
7. [Procedimentos de Emergência](#7-procedimentos-de-emergência)
8. [Data Quality Issues](#8-data-quality-issues)
9. [Drift Detection Issues](#9-drift-detection-issues)
10. [Explainability Issues](#10-explainability-issues)
11. [Backtesting Issues](#11-backtesting-issues)
12. [Alert & Notification Issues](#12-alert--notification-issues)
13. [Authentication & Security Issues](#13-authentication--security-issues)
14. [Cache Issues (ElastiCache Redis)](#14-cache-issues-elasticache-redis)
15. [CDN Issues (CloudFront)](#15-cdn-issues-cloudfront)
16. [WebSocket Issues](#16-websocket-issues)
17. [Export Issues](#17-export-issues)
18. [API Error Code Reference](#18-api-error-code-reference)
19. [Frontend Debugging Guide](#19-frontend-debugging-guide)
20. [Diagnostic Flowcharts](#20-diagnostic-flowcharts)
21. [Contatos de Suporte](#21-contatos-de-suporte)

---

## 1. Ingestão de Dados

### 1.1 Lambda Timeout Durante Ingestão

**Sintoma**: Lambda termina com erro "Task timed out after 600.00 seconds"

**Causa**: Muitos tickers ou API lenta

**Solução**:
```bash
# Aumentar timeout da Lambda
aws lambda update-function-configuration \
  --function-name InfraStack-Quotes5mIngest \
  --timeout 900  # 15 minutos (máximo)

# Ou reduzir número de tickers
vim config/universe.txt  # Remover alguns tickers
aws s3 cp config/universe.txt s3://$BUCKET_NAME/config/universe.txt
```

### 1.2 Erro 429 - Rate Limit Excedido

**Sintoma**: Logs mostram "Rate limit hit (429)"

**Causa**: Muitas requisições à API BRAPI

**Solução**:
```bash
# Verificar plano BRAPI (Pro tem limite maior)
curl "https://brapi.dev/api/quote/PETR4?token=SEU_TOKEN"

# Aumentar delay entre requests
# Editar ml/src/lambdas/ingest_quotes.py
# RATE_LIMIT_DELAY = 1.0  # De 0.5 para 1.0 segundo

# Re-deploy
cd infra
cdk deploy

# Ou reduzir batch size
# BATCH_SIZE = 10  # De 20 para 10 tickers por request
```

### 1.3 Token BRAPI Inválido

**Sintoma**: Erro "401 Unauthorized" ou "403 Forbidden"

**Causa**: Token expirado ou inválido

**Solução**:
```bash
# Verificar token atual
aws secretsmanager get-secret-value --secret-id brapi/pro/token | jq -r '.SecretString'

# Testar token manualmente
TOKEN=$(aws secretsmanager get-secret-value --secret-id brapi/pro/token | jq -r '.SecretString | fromjson | .token')
curl "https://brapi.dev/api/quote/PETR4?token=$TOKEN"

# Atualizar token se necessário
aws secretsmanager update-secret \
  --secret-id brapi/pro/token \
  --secret-string '{"token":"NOVO_TOKEN_AQUI"}'

# Testar ingestão
aws lambda invoke \
  --function-name InfraStack-Quotes5mIngest \
  --payload '{}' \
  response.json
```

### 1.4 Dados Não Salvos no S3

**Sintoma**: Lambda executa com sucesso mas não há arquivos no S3

**Causa**: Permissões S3 incorretas ou erro silencioso

**Solução**:
```bash
# Verificar permissões da Lambda
aws iam get-role-policy \
  --role-name InfraStack-Quotes5mIngestRole* \
  --policy-name InfraStack-Quotes5mIngestRoleDefaultPolicy*

# Verificar logs detalhados
aws logs tail /aws/lambda/InfraStack-Quotes5mIngest --since 1h | grep -i "s3\|error"

# Testar escrita no S3 manualmente
echo "test" > test.txt
aws s3 cp test.txt s3://$BUCKET_NAME/test.txt
aws s3 rm s3://$BUCKET_NAME/test.txt

# Se permissões OK, verificar código
# Pode ser erro no formato de data ou path
```

### 1.5 Completude Baixa (< 90%)

**Sintoma**: Alerta de completude < 90%

**Causa**: Tickers inativos ou suspensos

**Solução**:
```bash
# Identificar tickers faltantes
aws s3 cp s3://$BUCKET_NAME/monitoring/completeness/dt=$(date +%Y-%m-%d)/completeness_*.json - | jq '.missing_tickers'

# Verificar cada ticker manualmente
for ticker in PETR4 VALE3 ITUB4; do
  echo "=== $ticker ==="
  curl "https://brapi.dev/api/quote/$ticker?token=$TOKEN"
done

# Remover tickers inativos
vim config/universe.txt
aws s3 cp config/universe.txt s3://$BUCKET_NAME/config/universe.txt

# Ou adicionar tickers alternativos
```

---

## 2. Geração de Recomendações

### 2.1 SageMaker Endpoint Não Encontrado

**Sintoma**: Erro "Could not find endpoint b3tr-ensemble-endpoint"

**Causa**: Endpoint não deployado ou deletado

**Solução**:
```bash
# Verificar endpoints existentes
aws sagemaker list-endpoints

# Se não existe, criar endpoint
# 1. Treinar modelos primeiro
aws lambda invoke \
  --function-name InfraStack-TrainSageMaker \
  --payload '{}' \
  response.json

# 2. Aguardar conclusão (2-4 horas)
aws sagemaker list-training-jobs --sort-by CreationTime --sort-order Descending

# 3. Criar endpoint a partir do modelo treinado
# (Isso deve ser feito automaticamente pela Lambda de treino)

# Alternativa: Usar predições locais sem SageMaker
# Editar ml/src/lambdas/rank.py para usar modelos locais
```

### 2.2 Predições Inválidas (NaN ou Infinito)

**Sintoma**: Recomendações com valores NaN ou infinitos

**Causa**: Dados de entrada inválidos ou modelo corrompido

**Solução**:
```bash
# Verificar dados de entrada
aws s3 ls s3://$BUCKET_NAME/quotes_5m/dt=$(date +%Y-%m-%d)/ --recursive | head -10

# Baixar e inspecionar
aws s3 cp s3://$BUCKET_NAME/quotes_5m/dt=$(date +%Y-%m-%d)/PETR4_*.json - | jq .

# Verificar se há valores nulos ou inválidos
aws s3 cp s3://$BUCKET_NAME/quotes_5m/dt=$(date +%Y-%m-%d)/PETR4_*.json - | jq 'select(.close == null or .close <= 0)'

# Se dados OK, problema é no modelo
# Retreinar modelo
aws lambda invoke \
  --function-name InfraStack-PrepareTrainingData \
  --payload '{}' \
  response.json

aws lambda invoke \
  --function-name InfraStack-TrainSageMaker \
  --payload '{}' \
  response.json
```

### 2.3 Nenhuma Recomendação Gerada

**Sintoma**: Arquivo de recomendações vazio ou não existe

**Causa**: Dados insuficientes ou erro na Lambda

**Solução**:
```bash
# Verificar logs da Rank Lambda
aws logs tail /aws/lambda/InfraStack-RankSageMaker --since 1h

# Verificar se há dados suficientes (últimos 60 dias)
for i in {0..59}; do
  date=$(date -d "$i days ago" +%Y-%m-%d)
  count=$(aws s3 ls s3://$BUCKET_NAME/quotes_5m/dt=$date/ --recursive 2>/dev/null | wc -l)
  echo "$date: $count files"
done

# Se dados insuficientes, executar bootstrap
aws lambda invoke \
  --function-name InfraStack-BootstrapHistoryDaily \
  --payload '{}' \
  response.json

# Aguardar bootstrap completar e tentar novamente
aws lambda invoke \
  --function-name InfraStack-RankSageMaker \
  --payload '{}' \
  response.json
```

### 2.4 Performance do Modelo Degradada (MAPE > 20%)

**Sintoma**: MAPE consistentemente > 20%

**Causa**: Modelo desatualizado ou mudança no mercado

**Solução**:
```bash
# Verificar tendência de MAPE (últimos 30 dias)
for i in {0..29}; do
  date=$(date -d "$i days ago" +%Y-%m-%d)
  mape=$(aws s3 cp s3://$BUCKET_NAME/monitoring/performance/dt=$date/performance_*.json - 2>/dev/null | jq -r '.mape // "N/A"')
  echo "$date: $mape"
done

# Se tendência de piora, retreinar
aws lambda invoke \
  --function-name InfraStack-PrepareTrainingData \
  --payload '{}' \
  response.json

aws lambda invoke \
  --function-name InfraStack-TrainSageMaker \
  --payload '{}' \
  response.json

# Monitorar treino
aws logs tail /aws/lambda/InfraStack-TrainSageMaker --follow

# Aguardar 20 dias para validar novo modelo
```

---

## 3. Dashboard

### 3.1 Dashboard Não Carrega (Tela Branca)

**Sintoma**: Dashboard exibe tela branca ou erro no console

**Causa**: Erro de build, API Key inválida, ou CORS

**Solução**:
```bash
# 1. Verificar console do navegador (F12)
# Procurar por erros JavaScript ou CORS

# 2. Verificar configuração da API
cat dashboard/.env.production

# 3. Testar API diretamente
curl -H "X-Api-Key: $API_KEY" ${API_URL}api/recommendations/latest

# 4. Se API OK, re-buildar dashboard
cd dashboard
rm -rf build node_modules
npm install
npm run build

# 5. Re-deploy
npm run deploy  # Se GitHub Pages
# Ou
aws s3 sync build/ s3://b3tr-dashboard-$AWS_ACCOUNT_ID/ --delete
```

### 3.2 Erro 403 Forbidden na API

**Sintoma**: Dashboard exibe erro "403 Forbidden"

**Causa**: API Key inválida ou não enviada

**Solução**:
```bash
# Verificar API Key
export API_KEY=$(aws apigateway get-api-key \
  --api-key $API_KEY_ID \
  --include-value \
  --query 'value' \
  --output text)

echo "API_KEY=$API_KEY"

# Atualizar .env.production
cd dashboard
cat > .env.production << EOF
REACT_APP_API_URL=$API_URL
REACT_APP_API_KEY=$API_KEY
EOF

# Re-buildar
npm run build
npm run deploy
```

### 3.3 Dados Não Atualizam (Auto-refresh Não Funciona)

**Sintoma**: Dashboard não atualiza após 5 minutos

**Causa**: TanStack Query não configurado corretamente

**Solução**:
```bash
# Verificar código dos hooks
cat dashboard/src/hooks/useRecommendations.js | grep -A 5 "refetchInterval"

# Deve ter:
# refetchInterval: 300000,  // 5 minutos
# staleTime: 240000,        // 4 minutos

# Se incorreto, corrigir e re-buildar
vim dashboard/src/hooks/useRecommendations.js
npm run build
npm run deploy

# Limpar cache do navegador (Ctrl+Shift+R)
```

### 3.4 Gráficos Não Renderizam

**Sintoma**: Gráficos aparecem vazios ou com erro

**Causa**: Dados no formato incorreto ou biblioteca Recharts com problema

**Solução**:
```bash
# Verificar formato dos dados da API
curl -H "X-Api-Key: $API_KEY" \
  "${API_URL}api/monitoring/data-quality?days=30" | jq '.data[0]'

# Verificar se componente de gráfico está recebendo dados
# Abrir DevTools > React DevTools > Components

# Se dados OK, problema é no componente
# Verificar console para erros de Recharts

# Atualizar Recharts se necessário
cd dashboard
npm update recharts
npm run build
npm run deploy
```

### 3.5 Performance Lenta (Carregamento > 2 segundos)

**Sintoma**: Dashboard demora muito para carregar

**Causa**: Lazy loading não funcionando ou dados muito grandes

**Solução**:
```bash
# Verificar tamanho das respostas da API
curl -H "X-Api-Key: $API_KEY" \
  "${API_URL}api/recommendations/latest" | wc -c

# Se > 1MB, otimizar API (adicionar paginação)

# Verificar se lazy loading está ativo
cat dashboard/src/App.js | grep "enabled: activeTab"

# Deve ter:
# useRecommendations({ enabled: activeTab === 'recommendations' })

# Verificar cache do TanStack Query
# staleTime deve ser 240000 (4 minutos)

# Otimizar build
cd dashboard
npm run build -- --profile
# Analisar bundle size

# Considerar code splitting
# import() dinâmico para componentes pesados
```

---

## 4. Performance e Custos

### 4.1 Custos Acima do Esperado (> R$500/mês)

**Sintoma**: Projeção mensal > R$500

**Causa**: SageMaker endpoint ativo 24/7, muitas invocações Lambda, ou armazenamento S3 crescendo

**Solução**:
```bash
# Identificar componente mais caro
aws s3 cp s3://$BUCKET_NAME/monitoring/costs/dt=$(date +%Y-%m-%d)/costs_*.json - | jq '.costs_by_service | to_entries | sort_by(.value) | reverse'

# Se SageMaker é o mais caro:
# Opção 1: Deletar endpoint e usar batch transform
aws sagemaker delete-endpoint --endpoint-name b3tr-ensemble-endpoint

# Opção 2: Usar instância menor
aws sagemaker update-endpoint \
  --endpoint-name b3tr-ensemble-endpoint \
  --endpoint-config-name b3tr-ensemble-config-small

# Se Lambda é caro:
# Reduzir frequência de ingestão
vim infra/.env
# B3TR_SCHEDULE_MINUTES=10  # De 5 para 10 minutos
cd infra
cdk deploy

# Se S3 é caro:
# Forçar lifecycle rules
aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET_NAME \
  --lifecycle-configuration file://lifecycle.json

# Deletar dados antigos manualmente
aws s3 rm s3://$BUCKET_NAME/quotes_5m/ --recursive --exclude "*" --include "dt=2025-*"
```

### 4.2 Lambda Out of Memory

**Sintoma**: Erro "Runtime exited with error: signal: killed"

**Causa**: Memória insuficiente (1024 MB)

**Solução**:
```bash
# Aumentar memória da Lambda
aws lambda update-function-configuration \
  --function-name InfraStack-RankSageMaker \
  --memory-size 2048  # De 1024 para 2048 MB

# Ou otimizar código para usar menos memória
# Processar dados em chunks menores
```

### 4.3 S3 Bucket Crescendo Muito Rápido

**Sintoma**: Bucket > 100 GB em poucos meses

**Causa**: Muitos dados de cotações ou monitoring

**Solução**:
```bash
# Ver tamanho por prefixo
aws s3 ls s3://$BUCKET_NAME/ --recursive --summarize | grep "Total Size"

for prefix in quotes_5m recommendations monitoring; do
  echo "=== $prefix ==="
  aws s3 ls s3://$BUCKET_NAME/$prefix/ --recursive --summarize | grep "Total Size"
done

# Aplicar lifecycle rules mais agressivas
# Mover para Glacier após 30 dias (em vez de 90)
# Deletar monitoring após 6 meses (em vez de 1 ano)

# Editar infra/lib/infra-stack.ts
# lifecycleRules: [
#   {
#     id: "ArchiveOldQuotes",
#     enabled: true,
#     prefix: "quotes_5m/",
#     transitions: [
#       {
#         storageClass: s3.StorageClass.GLACIER,
#         transitionAfter: cdk.Duration.days(30),  // De 90 para 30
#       },
#     ],
#   },
# ]

cd infra
cdk deploy
```

---

## 5. Infraestrutura AWS

### 5.1 CDK Deploy Falha

**Sintoma**: `cdk deploy` termina com erro

**Causa**: Permissões IAM insuficientes, recursos já existem, ou erro no código

**Solução**:
```bash
# Ver erro detalhado
cdk deploy --verbose

# Verificar permissões IAM
aws sts get-caller-identity
aws iam get-user

# Se erro de recurso já existe:
# Opção 1: Importar recurso existente
cdk import

# Opção 2: Deletar recurso manualmente e re-deploy
aws s3 rb s3://$BUCKET_NAME --force
cdk deploy

# Se erro no código TypeScript:
cd infra
npm run build
# Corrigir erros de compilação
cdk deploy
```

### 5.2 EventBridge Schedule Não Dispara

**Sintoma**: Lambda não é invocada no horário esperado

**Causa**: Schedule desabilitado, timezone incorreto, ou target incorreto

**Solução**:
```bash
# Verificar se schedule está habilitado
aws events describe-rule --name InfraStack-IngestDuringB3

# Se State = DISABLED, habilitar
aws events enable-rule --name InfraStack-IngestDuringB3

# Verificar targets
aws events list-targets-by-rule --rule InfraStack-IngestDuringB3

# Verificar timezone (EventBridge usa UTC)
# 10:00 BRT = 13:00 UTC
# Verificar se cron expression está correta

# Testar manualmente
aws lambda invoke \
  --function-name InfraStack-Quotes5mIngest \
  --payload '{}' \
  response.json
```

### 5.3 CloudWatch Alarm Não Dispara

**Sintoma**: Alarm não envia notificação apesar de condição atendida

**Causa**: SNS subscription não confirmada ou alarm mal configurado

**Solução**:
```bash
# Verificar estado do alarm
aws cloudwatch describe-alarms --alarm-names InfraStack-IngestionFailedAlarm

# Verificar SNS subscriptions
TOPIC_ARN=$(aws cloudformation describe-stacks \
  --stack-name InfraStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AlertsTopicArn`].OutputValue' \
  --output text)

aws sns list-subscriptions-by-topic --topic-arn $TOPIC_ARN

# Se subscription PendingConfirmation, confirmar no email

# Testar alarm manualmente
aws cloudwatch set-alarm-state \
  --alarm-name InfraStack-IngestionFailedAlarm \
  --state-value ALARM \
  --state-reason "Testing alarm"

# Verificar se email foi recebido
```

### 5.4 Secrets Manager Secret Não Acessível

**Sintoma**: Lambda não consegue ler secret

**Causa**: Permissões IAM incorretas ou secret não existe

**Solução**:
```bash
# Verificar se secret existe
aws secretsmanager describe-secret --secret-id brapi/pro/token

# Verificar permissões da Lambda
aws iam get-role-policy \
  --role-name InfraStack-Quotes5mIngestRole* \
  --policy-name InfraStack-Quotes5mIngestRoleDefaultPolicy*

# Deve ter:
# "Action": "secretsmanager:GetSecretValue"
# "Resource": "arn:aws:secretsmanager:...:secret:brapi/pro/token-*"

# Se permissões incorretas, re-deploy
cd infra
cdk deploy

# Testar acesso manualmente
aws secretsmanager get-secret-value --secret-id brapi/pro/token
```

### 5.5 Stack Preso em UPDATE_ROLLBACK_IN_PROGRESS

**Sintoma**: Stack não completa rollback

**Causa**: Recurso não pode ser deletado ou atualizado

**Solução**:
```bash
# Ver eventos do stack
aws cloudformation describe-stack-events \
  --stack-name InfraStack \
  --max-items 50

# Identificar recurso problemático
# Procurar por "UPDATE_FAILED" ou "DELETE_FAILED"

# Opção 1: Continuar rollback
aws cloudformation continue-update-rollback --stack-name InfraStack

# Opção 2: Deletar recurso manualmente e continuar
# Exemplo: Se S3 bucket não pode ser deletado
aws s3 rm s3://$BUCKET_NAME/ --recursive
aws s3 rb s3://$BUCKET_NAME

aws cloudformation continue-update-rollback --stack-name InfraStack

# Opção 3: Deletar stack completamente (CUIDADO!)
aws cloudformation delete-stack --stack-name InfraStack
```

---

## 6. Problemas Comuns de Dados

### 6.1 Gaps nos Dados Históricos

**Sintoma**: Faltam dados de alguns dias

**Causa**: Bootstrap incompleto ou falhas de ingestão

**Solução**:
```bash
# Identificar gaps
for i in {0..365}; do
  date=$(date -d "$i days ago" +%Y-%m-%d)
  count=$(aws s3 ls s3://$BUCKET_NAME/quotes_5m/dt=$date/ --recursive 2>/dev/null | wc -l)
  if [ $count -eq 0 ]; then
    echo "GAP: $date"
  fi
done

# Executar bootstrap para preencher gaps
aws lambda invoke \
  --function-name InfraStack-BootstrapHistoryDaily \
  --payload '{}' \
  response.json

# Monitorar progresso
aws logs tail /aws/lambda/InfraStack-BootstrapHistoryDaily --follow

# Verificar se gaps foram preenchidos
```

### 6.2 Dados Inconsistentes (high < low)

**Sintoma**: Validação detecta high < low

**Causa**: Erro na API BRAPI ou bug no código

**Solução**:
```bash
# Identificar dados inconsistentes
aws s3 cp s3://$BUCKET_NAME/monitoring/data_quality/dt=$(date +%Y-%m-%d)/validation_errors_*.json - | jq '.errors[] | select(.errors[] | contains("high_less_than_low"))'

# Deletar dados inconsistentes
TICKER="PETR4"
DATE="2026-03-10"
TIME="140000"

aws s3 rm s3://$BUCKET_NAME/quotes_5m/dt=$DATE/${TICKER}_${TIME}.json

# Re-ingerir
aws lambda invoke \
  --function-name InfraStack-Quotes5mIngest \
  --payload '{}' \
  response.json

# Se problema persiste, verificar código de ingestão
vim ml/src/lambdas/ingest_quotes.py
```

### 6.3 Lineage Tracking Não Funciona

**Sintoma**: Arquivos de lineage vazios ou não existem

**Causa**: Erro no código de lineage tracking

**Solução**:
```bash
# Verificar se lineage está sendo criada
aws s3 ls s3://$BUCKET_NAME/monitoring/lineage/dt=$(date +%Y-%m-%d)/ --recursive

# Ver conteúdo
aws s3 cp s3://$BUCKET_NAME/monitoring/lineage/dt=$(date +%Y-%m-%d)/lineage_*.json - | jq .

# Se vazio, verificar código
vim ml/src/lambdas/ingest_quotes.py
# Procurar por create_lineage_record()

# Re-deploy se necessário
cd infra
cdk deploy

# Re-executar ingestão
aws lambda invoke \
  --function-name InfraStack-Quotes5mIngest \
  --payload '{}' \
  response.json
```

---

## 7. Procedimentos de Emergência

### 7.1 Sistema Completamente Fora do Ar

**Ação imediata**:
```bash
# 1. Verificar status geral
aws cloudwatch describe-alarms --state-value ALARM

# 2. Verificar se stack existe
aws cloudformation describe-stacks --stack-name InfraStack

# 3. Se stack não existe, re-deploy
cd infra
cdk deploy

# 4. Se stack existe mas Lambdas não funcionam
# Verificar logs de todas as Lambdas
for lambda in $(aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `InfraStack`)].FunctionName' --output text); do
  echo "=== $lambda ==="
  aws logs tail /aws/lambda/$lambda --since 1h | tail -20
done

# 5. Escalar para Nível 3 (Arquiteto)
```

### 7.2 Perda de Dados Críticos

**Ação imediata**:
```bash
# 1. Verificar se backup existe
ls -lh backup-*/

# 2. Restaurar de backup
aws s3 sync ./backup-YYYYMMDD/ s3://$BUCKET_NAME/ --delete

# 3. Verificar integridade
aws s3 ls s3://$BUCKET_NAME/ --recursive | wc -l

# 4. Re-executar pipelines
aws lambda invoke --function-name InfraStack-Quotes5mIngest --payload '{}' response.json
aws lambda invoke --function-name InfraStack-RankSageMaker --payload '{}' response.json

# 5. Documentar incidente
```

### 7.3 Custos Dispararam (> R$1000/dia)

**Ação imediata**:
```bash
# 1. Desabilitar todos os schedules
for rule in $(aws events list-rules --name-prefix InfraStack --query 'Rules[].Name' --output text); do
  aws events disable-rule --name $rule
  echo "Disabled $rule"
done

# 2. Deletar SageMaker endpoints
for endpoint in $(aws sagemaker list-endpoints --query 'Endpoints[].EndpointName' --output text); do
  aws sagemaker delete-endpoint --endpoint-name $endpoint
  echo "Deleted $endpoint"
done

# 3. Verificar custos
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=SERVICE

# 4. Investigar causa
# 5. Escalar para Nível 3 (Arquiteto)
```

---

## 8. Data Quality Issues

### 8.1 Completeness Below Threshold

**Sintoma**: Data Quality tab shows completeness rate below 95% for one or more tickers

**Causa**: Missing data points from BRAPI API, ticker delisted or suspended, ingestion failures

**Diagnóstico**:
```bash
# Check completeness data from S3
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/completeness.json - | jq '.'

# Identify tickers below threshold
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/completeness.json - \
  | jq '[.[] | select(.rate < 95)] | sort_by(.rate)'

# Check if ticker is still active on B3
curl "https://brapi.dev/api/quote/TICKER_SYMBOL?token=$TOKEN"
```

**Solução**:
1. If ticker is delisted: remove from `config/universe.txt` and re-upload to S3
2. If ingestion failed: check Lambda logs and re-run ingestion for missing dates
3. If API returned partial data: increase retry count in ingestion Lambda
4. If specific features are missing: check the `missingFeatures` field in completeness data and verify the BRAPI response schema hasn't changed

### 8.2 Anomaly False Positives

**Sintoma**: Anomaly list shows many flagged items that are actually valid data (e.g., legitimate price spikes during earnings)

**Causa**: Outlier threshold (5 std devs) too sensitive for volatile periods, corporate events (splits, dividends)

**Diagnóstico**:
```bash
# Check anomaly data
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/anomalies.json - \
  | jq '[.[] | select(.type == "outlier")] | length'

# Check if anomaly coincides with corporate event
# Look for stock splits, dividend payments, or earnings dates
```

**Solução**:
1. Mark false positives in the dashboard UI (click "Mark as False Positive" on each anomaly)
2. If systemic: adjust the outlier threshold in the backend Lambda configuration
3. For stock splits: ensure the ingestion pipeline applies split-adjustment to historical data
4. Consider adding a corporate events calendar to filter known events

### 8.3 Data Freshness Warnings

**Sintoma**: Freshness indicators show "Warning" (>24h) or "Critical" (>48h) status

**Causa**: Ingestion Lambda failed, BRAPI API down, EventBridge schedule disabled

**Diagnóstico**:
```bash
# Check last successful ingestion
aws s3 ls s3://$BUCKET_NAME/quotes_5m/ --recursive | sort | tail -5

# Check freshness data
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/freshness.json - | jq '.'

# Check Lambda execution history
aws logs tail /aws/lambda/InfraStack-Quotes5mIngest --since 48h | grep -i "error\|success\|complete"

# Check EventBridge schedule
aws events describe-rule --name InfraStack-IngestDuringB3
```

**Solução**:
1. If Lambda failed: check error logs and fix the root cause, then manually trigger ingestion
2. If BRAPI is down: wait for recovery, data will auto-refresh on next successful run
3. If schedule disabled: `aws events enable-rule --name InfraStack-IngestDuringB3`
4. For fundamentals/news sources: check each data source endpoint independently

### 8.4 Coverage Drops Below 90%

**Sintoma**: Universe coverage metric drops below 90%, many tickers excluded

**Causa**: Bulk data quality failures, API changes, new tickers added without data

**Diagnóstico**:
```bash
# Check coverage data
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/coverage.json - | jq '.'

# List excluded tickers and reasons
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/coverage.json - \
  | jq '.excludedTickers[] | "\(.ticker): \(.reason)"'

# Compare universe file with available data
aws s3 cp s3://$BUCKET_NAME/config/universe.txt - | wc -l
```

**Solução**:
1. Review excluded tickers and their reasons
2. For "insufficient data": run bootstrap ingestion for those tickers
3. For "delisted": update `universe.txt` to remove delisted tickers
4. For "data quality": fix underlying data quality issues first, then coverage will recover

---

## 9. Drift Detection Issues

### 9.1 False Drift Alerts

**Sintoma**: Drift Detection tab flags features as drifted when no real distribution change occurred

**Causa**: Small sample size in rolling window, seasonal patterns misinterpreted, market regime changes

**Diagnóstico**:
```bash
# Check drift detection results
aws s3 cp s3://$BUCKET_NAME/drift/$(date +%Y-%m-%d)/data_drift.json - \
  | jq '[.[] | select(.drifted == true)] | length'

# Check KS test statistics for flagged features
aws s3 cp s3://$BUCKET_NAME/drift/$(date +%Y-%m-%d)/data_drift.json - \
  | jq '.[] | select(.drifted == true) | {feature, ksStatistic, pValue}'

# Compare with historical drift rates
for i in {0..29}; do
  date=$(date -d "$i days ago" +%Y-%m-%d)
  count=$(aws s3 cp s3://$BUCKET_NAME/drift/$date/data_drift.json - 2>/dev/null \
    | jq '[.[] | select(.drifted == true)] | length' 2>/dev/null)
  echo "$date: $count drifted features"
done
```

**Solução**:
1. If p-values are close to 0.05 threshold: these are borderline cases, monitor for persistence
2. If seasonal: consider using a longer baseline window (90 days instead of 30)
3. If market regime change: this is legitimate drift — consider retraining
4. Adjust significance threshold in drift Lambda if false positive rate is too high:
   ```python
   # In drift detection Lambda configuration
   DRIFT_SIGNIFICANCE_THRESHOLD = 0.01  # More conservative (default: 0.05)
   ```

### 9.2 KS Test Failures

**Sintoma**: KS test computation fails with errors, drift results missing for some features

**Causa**: Insufficient data points, constant-value features, NaN values in feature data

**Diagnóstico**:
```bash
# Check drift Lambda logs for errors
aws logs tail /aws/lambda/InfraStack-DriftDetection --since 1h | grep -i "error\|exception\|nan"

# Check feature data for NaN values
aws s3 cp s3://$BUCKET_NAME/drift/$(date +%Y-%m-%d)/data_drift.json - \
  | jq '.[] | select(.ksStatistic == null or .pValue == null)'
```

**Solução**:
1. For insufficient data: ensure at least 30 data points in each window
2. For constant features: these should be excluded from drift detection — add to exclusion list
3. For NaN values: fix upstream data quality issues first
4. If Lambda errors: check memory allocation and increase if needed

### 9.3 Concept Drift Misdetection

**Sintoma**: Concept drift flagged but model performance hasn't actually degraded

**Causa**: Correlation threshold (0.2) too sensitive, temporary market anomaly

**Diagnóstico**:
```bash
# Check concept drift data
aws s3 cp s3://$BUCKET_NAME/drift/$(date +%Y-%m-%d)/concept_drift.json - \
  | jq '.[] | select(.drifted == true) | {feature, currentCorrelation, baselineCorrelation, change}'

# Cross-reference with performance metrics
aws s3 cp s3://$BUCKET_NAME/monitoring/performance/dt=$(date +%Y-%m-%d)/performance_*.json - \
  | jq '{mape, accuracy, sharpe_ratio}'
```

**Solução**:
1. If performance is stable: concept drift may be benign — monitor but don't retrain
2. If correlation changes are small (0.2-0.3): consider raising the threshold
3. If persistent: schedule model retraining
4. Check if the drift correlates with known market events (elections, policy changes)

### 9.4 Performance Degradation Not Detected

**Sintoma**: Model performance has clearly degraded but no degradation alert was generated

**Causa**: Degradation thresholds too lenient, baseline metrics outdated, monitoring Lambda not running

**Diagnóstico**:
```bash
# Check current vs baseline metrics
aws s3 cp s3://$BUCKET_NAME/drift/$(date +%Y-%m-%d)/degradation.json - | jq '.'

# Check if monitoring Lambda ran
aws logs tail /aws/lambda/InfraStack-DriftDetection --since 24h | grep -c "SUCCESS"

# Manually compare recent MAPE with baseline
aws s3 cp s3://$BUCKET_NAME/monitoring/performance/dt=$(date +%Y-%m-%d)/performance_*.json - \
  | jq '.mape'
```

**Solução**:
1. Verify the monitoring Lambda is scheduled and running
2. Update baseline metrics if they are stale (>90 days old)
3. Adjust thresholds: MAPE +20%, accuracy -10pp, Sharpe -0.5 are the defaults
4. Manually trigger degradation check: invoke the drift detection Lambda

---

## 10. Explainability Issues

### 10.1 SHAP Values Not Loading

**Sintoma**: Explainability tab shows loading spinner indefinitely or error when selecting a ticker

**Causa**: SHAP values not computed for the selected ticker/date, Lambda timeout during SHAP computation, S3 data missing

**Diagnóstico**:
```bash
# Check if SHAP data exists for today
aws s3 ls s3://$BUCKET_NAME/explainability/$(date +%Y-%m-%d)/ --recursive

# Check SHAP Lambda logs
aws logs tail /aws/lambda/InfraStack-ExplainabilityLambda --since 1h | grep -i "error\|timeout"

# Test the API endpoint directly
curl -H "X-Api-Key: $API_KEY" \
  "${API_URL}api/explainability/shap?ticker=PETR4&date=$(date +%Y-%m-%d)"
```

**Solução**:
1. If data missing: trigger SHAP computation manually
   ```bash
   aws lambda invoke \
     --function-name InfraStack-ExplainabilityLambda \
     --payload '{"ticker": "PETR4", "date": "'$(date +%Y-%m-%d)'"}' \
     response.json
   ```
2. If Lambda timeout: SHAP computation is CPU-intensive — increase Lambda timeout and memory
   ```bash
   aws lambda update-function-configuration \
     --function-name InfraStack-ExplainabilityLambda \
     --timeout 300 --memory-size 3008
   ```
3. If model not available: ensure the SageMaker endpoint is running
4. Check that the SHAP library version is compatible with the model framework

### 10.2 Sensitivity Analysis Errors

**Sintoma**: Sensitivity analysis returns errors or shows flat lines (no sensitivity)

**Causa**: Feature range too narrow, feature not used by model, API error during computation

**Diagnóstico**:
```bash
# Test sensitivity endpoint
curl -H "X-Api-Key: $API_KEY" \
  "${API_URL}api/explainability/sensitivity?ticker=PETR4&feature=volume"

# Check if feature exists in model
aws s3 cp s3://$BUCKET_NAME/explainability/$(date +%Y-%m-%d)/shap_values.parquet - \
  | python3 -c "import sys, json; print(json.load(sys.stdin).keys())" 2>/dev/null
```

**Solução**:
1. If flat line: the feature may have zero importance — try a different feature
2. If error: check Lambda logs for the specific error message
3. If range too narrow: the feature variation range is computed from historical data — ensure sufficient history
4. For multi-feature sensitivity: limit to 3-4 features at a time to avoid timeout

### 10.3 SHAP Values Don't Sum to Prediction

**Sintoma**: Sum of displayed SHAP values + base value doesn't equal the final prediction

**Causa**: Only top 15 features displayed, rounding errors, stale SHAP data

**Solução**:
1. This is expected behavior — only top 15 features are shown. The remaining features' SHAP values account for the difference.
2. The dashboard should display a "Other features" row showing the aggregate of remaining features.
3. If the discrepancy is large (>5%): check that SHAP values were computed with the correct model version.

---

## 11. Backtesting Issues

### 11.1 Simulation Errors

**Sintoma**: Backtesting simulation fails with error or returns empty results

**Causa**: Invalid date range, insufficient historical data, Lambda timeout

**Diagnóstico**:
```bash
# Test backtest endpoint
curl -X POST -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  "${API_URL}api/backtest" \
  -d '{
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "initialCapital": 100000,
    "topN": 10,
    "rebalanceFrequency": "weekly"
  }'

# Check backtest Lambda logs
aws logs tail /aws/lambda/InfraStack-BacktestLambda --since 1h | grep -i "error"

# Verify historical data availability
aws s3 ls s3://$BUCKET_NAME/recommendations/2025-01-01/ 2>/dev/null
aws s3 ls s3://$BUCKET_NAME/recommendations/2025-12-31/ 2>/dev/null
```

**Solução**:
1. Ensure start date has available recommendation data
2. Ensure end date is not in the future
3. For long backtests (>1 year): increase Lambda timeout to 300s and memory to 2048MB
4. If data gaps exist in the backtest period: fill gaps first using bootstrap ingestion

### 11.2 Incorrect Metrics (Negative Sharpe, Impossible Returns)

**Sintoma**: Backtest metrics show impossible values (e.g., Sharpe ratio of 100, returns of 10000%)

**Causa**: Data errors in historical prices, division by zero in calculations, look-ahead bias

**Diagnóstico**:
```bash
# Check backtest results
aws s3 cp s3://$BUCKET_NAME/backtesting/results/BACKTEST_ID.json - | jq '.metrics'

# Verify historical price data for anomalies
aws s3 cp s3://$BUCKET_NAME/quotes_5m/dt=2025-06-15/PETR4_*.json - | jq '.close'
```

**Solução**:
1. Check for stock split adjustments in historical data
2. Verify commission rate is reasonable (default: 0.1%)
3. If Sharpe is extremely high/low: check that the risk-free rate is set correctly
4. If returns are impossible: look for data errors in the price history for the backtest period
5. Ensure no look-ahead bias: recommendations should only use data available at the time

### 11.3 Timeout on Large Backtests

**Sintoma**: Backtest with long date range or many tickers times out (>300s)

**Causa**: Too many tickers, too long date range, daily rebalancing with large universe

**Solução**:
1. Reduce the date range or use weekly/monthly rebalancing instead of daily
2. Reduce `topN` parameter (e.g., from 50 to 20)
3. Increase Lambda timeout and memory:
   ```bash
   aws lambda update-function-configuration \
     --function-name InfraStack-BacktestLambda \
     --timeout 900 --memory-size 3008
   ```
4. For very large backtests: consider running as a Step Functions workflow instead of a single Lambda

### 11.4 Backtest Results Don't Match Manual Calculation

**Sintoma**: Portfolio returns differ from manual spreadsheet calculation

**Causa**: Different assumptions about execution timing, commission handling, or rebalancing logic

**Solução**:
1. Verify execution timing: backtests use close prices by default
2. Check commission: applied on both buy and sell sides
3. Verify rebalancing: positions are rebalanced at the start of each period
4. Check position sizing: "equal" distributes capital equally, "weighted" uses recommendation scores
5. Review the backtest configuration parameters in the results JSON for exact settings used

---

## 12. Alert & Notification Issues

### 12.1 Alerts Not Triggering

**Sintoma**: Alert conditions are met but no notification appears in the notification center

**Causa**: Alert check Lambda not running, alert condition misconfigured, DynamoDB write failure

**Diagnóstico**:
```bash
# Check alert configurations in DynamoDB
aws dynamodb query \
  --table-name B3Dashboard-Alerts \
  --key-condition-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "USER_ID"}}'

# Check alert check Lambda logs
aws logs tail /aws/lambda/InfraStack-AlertCheckLambda --since 1h

# Manually test alert check
curl -X POST -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  "${API_URL}api/alerts/check" \
  -d '{"recommendations": [{"ticker": "PETR4", "score": 0.9}]}'
```

**Solução**:
1. Verify the alert check Lambda is scheduled (should run after each recommendation generation)
2. Check that alert conditions use the correct comparison operators
3. Verify DynamoDB table exists and Lambda has write permissions
4. Check that the notification center component is polling for new notifications

### 12.2 Notification Delivery Failures

**Sintoma**: In-app notifications work but email/SMS notifications are not delivered

**Causa**: SNS topic not configured, email not verified, SMS spending limit reached

**Diagnóstico**:
```bash
# Check SNS topic
aws sns list-topics | grep -i dashboard

# Check subscriptions
aws sns list-subscriptions-by-topic --topic-arn $NOTIFICATION_TOPIC_ARN

# Check SNS delivery logs
aws logs tail /aws/sns/us-east-1/$ACCOUNT_ID/DirectPublishToPhoneNumber --since 1h

# Check SMS spending limit
aws sns get-sms-attributes --attributes MonthlySpendLimit
```

**Solução**:
1. For email: verify the email address in SNS (check spam folder for confirmation)
2. For SMS: check monthly spending limit and increase if needed
3. Verify notification preferences in user settings (quiet hours may be active)
4. Check that the notification Lambda has `sns:Publish` permissions

### 12.3 Duplicate Notifications

**Sintoma**: Same alert triggers multiple notifications

**Causa**: Alert check running multiple times, missing deduplication logic

**Solução**:
1. Check EventBridge schedule for duplicate rules
2. Verify the alert check Lambda implements idempotency (checks if alert was already triggered)
3. Add a `lastTriggered` timestamp to the alert record and skip if triggered within the cooldown period
4. Check DynamoDB for duplicate notification records

---

## 13. Authentication & Security Issues

### 13.1 Login Failures

**Sintoma**: Users cannot log in, "Invalid credentials" or "Authentication failed" error

**Causa**: Cognito user pool misconfigured, user not confirmed, incorrect credentials

**Diagnóstico**:
```bash
# Check Cognito user pool status
aws cognito-idp describe-user-pool --user-pool-id $USER_POOL_ID

# Check if user exists and is confirmed
aws cognito-idp admin-get-user \
  --user-pool-id $USER_POOL_ID \
  --username USER_EMAIL

# Check auth logs
aws dynamodb query \
  --table-name B3Dashboard-AuthLogs \
  --key-condition-expression "userId = :uid" \
  --expression-attribute-values '{":uid": {"S": "USER_EMAIL"}}' \
  --scan-index-forward false --limit 10
```

**Solução**:
1. If user not confirmed: `aws cognito-idp admin-confirm-sign-up --user-pool-id $USER_POOL_ID --username USER_EMAIL`
2. If password expired: `aws cognito-idp admin-set-user-password --user-pool-id $USER_POOL_ID --username USER_EMAIL --password NEW_PASSWORD --permanent`
3. If user locked out (too many failed attempts): wait 15 minutes or reset via admin
4. Check Cognito app client settings (callback URLs, OAuth scopes)

### 13.2 Session Timeout Issues

**Sintoma**: Users are logged out unexpectedly or sessions don't expire after 60 minutes

**Causa**: Token refresh not working, clock skew between client and server, incorrect timeout configuration

**Solução**:
1. Verify session timeout is set to 60 minutes in Cognito:
   ```bash
   aws cognito-idp describe-user-pool-client \
     --user-pool-id $USER_POOL_ID \
     --client-id $CLIENT_ID \
     | jq '.UserPoolClient.AccessTokenValidity'
   ```
2. Check that the frontend token refresh logic is working (should refresh before expiry)
3. If sessions don't expire: verify the `AuthContext` checks token expiry on each request
4. For clock skew: ensure server and client times are synchronized (NTP)

### 13.3 API Key Problems

**Sintoma**: API requests return 401 AUTHENTICATION_ERROR with valid-looking API key

**Causa**: API key expired, key disabled, key hash mismatch, wrong header name

**Diagnóstico**:
```bash
# Check API key in DynamoDB (by hash)
API_KEY_HASH=$(echo -n "YOUR_API_KEY" | sha256sum | cut -d' ' -f1)
aws dynamodb get-item \
  --table-name B3Dashboard-APIKeys \
  --key '{"apiKeyHash": {"S": "'$API_KEY_HASH'"}}'

# Check if key is expired
# Look at expiresAt field in the response
```

**Solução**:
1. If expired: rotate the key via `POST /api/keys/{keyHash}/rotate`
2. If disabled: re-enable via admin panel or DynamoDB update
3. Verify the header name: use either `X-Api-Key` or `Authorization: ApiKey YOUR_KEY`
4. If key not found: create a new key via the admin API
5. Check rate limiting: key may be temporarily blocked (see section 18 for error 429)

### 13.4 Rate Limiting Issues

**Sintoma**: Requests return 429 "Rate limit exceeded" even with low traffic

**Causa**: Rate limit counter not resetting, shared rate limit across multiple clients, DynamoDB TTL not working

**Diagnóstico**:
```bash
# Check rate limit table
aws dynamodb scan \
  --table-name B3Dashboard-RateLimits \
  --filter-expression "identifier = :id" \
  --expression-attribute-values '{":id": {"S": "USER_OR_KEY_ID"}}'

# Check response headers for rate limit info
curl -v -H "X-Api-Key: $API_KEY" "${API_URL}api/recommendations" 2>&1 | grep -i "x-ratelimit"
```

**Solução**:
1. Wait for the rate limit window to reset (check `X-RateLimit-Reset` header)
2. If counter is stuck: delete the rate limit record from DynamoDB
3. Increase rate limit for the user/key if legitimate high traffic
4. Verify DynamoDB TTL is enabled on the rate limits table

### 13.5 CSRF Validation Failures

**Sintoma**: POST/PUT/DELETE requests fail with 403 "CSRF validation failed" error

**Causa**: CSRF token missing or expired, token mismatch between client and server, browser blocking cookies

**Diagnóstico**:
```bash
# Check CSRF validation failures in CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace B3Dashboard/Authentication \
  --metric-name CSRFValidationFailures \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 --statistics Sum

# Check auth logs for CSRF failures
aws dynamodb scan \
  --table-name B3Dashboard-AuthLogs \
  --filter-expression "reason = :csrf AND #ts > :recent" \
  --expression-attribute-names '{"#ts":"timestamp"}' \
  --expression-attribute-values '{":csrf":{"S":"CSRF_VALIDATION_FAILED"},":recent":{"S":"'"$(date -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)"'"}}'
```

**Solução**:
1. Verify the frontend sends the CSRF token in the `X-CSRF-Token` header on all state-changing requests
2. Check that cookies are not blocked by the browser (third-party cookie settings, incognito mode)
3. If token expired: the frontend should automatically refresh the CSRF token on 403 responses
4. If high volume of CSRF failures from a single IP: investigate potential CSRF attack
5. Verify the CSRF token generation and validation logic in the SecurityStack Lambda:
   ```bash
   aws logs tail /aws/lambda/B3Dashboard-CSRFValidator --since 1h | grep -i "error\|invalid\|expired"
   ```
6. For development/testing: ensure the CSRF middleware is configured to accept requests from `localhost`

---

## 14. Cache Issues (ElastiCache Redis)

### 14.1 ElastiCache Connection Failures

**Sintoma**: API responses are slow, logs show "Redis connection refused" or "ECONNREFUSED"

**Causa**: ElastiCache cluster down, security group misconfigured, Lambda not in VPC

**Diagnóstico**:
```bash
# Check ElastiCache cluster status
aws elasticache describe-cache-clusters --show-cache-node-info \
  | jq '.CacheClusters[] | {CacheClusterId, CacheClusterStatus, CacheNodes}'

# Check replication group status
aws elasticache describe-replication-groups \
  | jq '.ReplicationGroups[] | {ReplicationGroupId, Status, NodeGroups}'

# Check security group rules
CACHE_SG=$(aws elasticache describe-cache-clusters \
  --query 'CacheClusters[0].SecurityGroups[0].SecurityGroupId' --output text)
aws ec2 describe-security-groups --group-ids $CACHE_SG \
  | jq '.SecurityGroups[0].IpPermissions'

# Check Lambda VPC configuration
aws lambda get-function-configuration \
  --function-name InfraStack-DataLambda \
  | jq '{VpcConfig}'
```

**Solução**:
1. If cluster is down: check for maintenance window or reboot
   ```bash
   aws elasticache reboot-cache-cluster \
     --cache-cluster-id b3tr-cache \
     --cache-node-ids-to-reboot 0001
   ```
2. If security group issue: ensure Lambda's security group can reach Redis port 6379
3. If Lambda not in VPC: Lambda must be in the same VPC as ElastiCache
4. If DNS resolution fails: use the ElastiCache endpoint directly instead of DNS name

### 14.2 Stale Data in Cache

**Sintoma**: Dashboard shows outdated data even after new data is ingested

**Causa**: Cache TTL too long, cache not invalidated after data update

**Diagnóstico**:
```bash
# Check cache TTL settings in Lambda environment
aws lambda get-function-configuration \
  --function-name InfraStack-DataLambda \
  | jq '.Environment.Variables | {CACHE_TTL, CACHE_ENABLED}'

# Check API response metadata for cache status
curl -v -H "X-Api-Key: $API_KEY" "${API_URL}api/recommendations" 2>&1 \
  | grep -i "cached\|cache"
```

**Solução**:
1. Reduce cache TTL for frequently updated data (recommendations: 5 min, data quality: 60 min)
2. Implement cache invalidation on data write:
   ```bash
   # Manually flush specific cache keys (if Redis CLI available)
   redis-cli -h $CACHE_ENDPOINT -p 6379 DEL "recommendations:latest"
   redis-cli -h $CACHE_ENDPOINT -p 6379 DEL "data-quality:*"
   ```
3. Add cache-busting query parameter in frontend: `?_t=timestamp`
4. Check the `cached` field in API response metadata to confirm if data is from cache

### 14.3 Redis Memory Issues

**Sintoma**: ElastiCache evicting keys, "OOM command not allowed" errors

**Causa**: Cache node too small, no eviction policy, memory leak in cached data

**Diagnóstico**:
```bash
# Check memory usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name DatabaseMemoryUsagePercentage \
  --dimensions Name=CacheClusterId,Value=b3tr-cache \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 --statistics Average

# Check eviction count
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name Evictions \
  --dimensions Name=CacheClusterId,Value=b3tr-cache \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 --statistics Sum
```

**Solução**:
1. Scale up the cache node type (e.g., from cache.t3.micro to cache.t3.small)
2. Set appropriate eviction policy: `allkeys-lru` is recommended
3. Reduce TTL for large cached objects (backtest results, SHAP values)
4. Review what's being cached and remove unnecessary entries

---

## 15. CDN Issues (CloudFront)

### 15.1 CloudFront 5xx Errors

**Sintoma**: Dashboard returns 502 Bad Gateway or 504 Gateway Timeout

**Causa**: Origin (S3 or API Gateway) is down, CloudFront distribution misconfigured

**Diagnóstico**:
```bash
# Check CloudFront distribution status
aws cloudfront list-distributions \
  | jq '.DistributionList.Items[] | {Id, Status, DomainName, Origins}'

# Check origin health
curl -I "https://$S3_BUCKET.s3.amazonaws.com/index.html"
curl -I "${API_URL}api/health"

# Check CloudFront error rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name 5xxErrorRate \
  --dimensions Name=DistributionId,Value=$CF_DISTRIBUTION_ID \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 --statistics Average
```

**Solução**:
1. If origin S3 is down: check S3 service health and bucket configuration
2. If API Gateway timeout: increase API Gateway timeout or optimize Lambda
3. If distribution misconfigured: verify origin settings and behaviors
4. For 504 errors: increase CloudFront origin response timeout (default 30s)

### 15.2 Stale Content After Deployment

**Sintoma**: After deploying new dashboard version, users still see old version

**Causa**: CloudFront cache not invalidated after deployment

**Solução**:
```bash
# Create CloudFront invalidation
aws cloudfront create-invalidation \
  --distribution-id $CF_DISTRIBUTION_ID \
  --paths "/*"

# Check invalidation status
aws cloudfront list-invalidations --distribution-id $CF_DISTRIBUTION_ID \
  | jq '.InvalidationList.Items[0]'

# Alternative: use versioned filenames in build output
# React build already does this for JS/CSS bundles
# Only index.html needs invalidation:
aws cloudfront create-invalidation \
  --distribution-id $CF_DISTRIBUTION_ID \
  --paths "/index.html" "/manifest.json"
```

### 15.3 SSL Certificate Issues

**Sintoma**: Browser shows "Your connection is not private" or certificate errors

**Causa**: SSL certificate expired, certificate not attached to distribution, wrong domain

**Diagnóstico**:
```bash
# Check certificate status
aws acm list-certificates --region us-east-1 \
  | jq '.CertificateSummaryList[] | {DomainName, Status}'

# Check certificate details
aws acm describe-certificate --certificate-arn $CERT_ARN --region us-east-1 \
  | jq '{DomainName, Status, NotAfter, InUseBy}'
```

**Solução**:
1. If expired: ACM certificates auto-renew if DNS validation is configured correctly
2. Check DNS validation records: `aws acm describe-certificate --certificate-arn $CERT_ARN | jq '.Certificate.DomainValidationOptions'`
3. If not attached: update CloudFront distribution to use the certificate
4. Ensure certificate is in `us-east-1` region (required for CloudFront)

---

## 16. WebSocket Issues

### 16.1 WebSocket Connection Drops

**Sintoma**: Real-time updates stop working, console shows "WebSocket connection closed"

**Causa**: Idle timeout (10 min default), network interruption, API Gateway WebSocket limit

**Diagnóstico**:
```javascript
// Check WebSocket state in browser console
console.log('WebSocket readyState:', ws.readyState);
// 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED

// Check for close event details
ws.onclose = (event) => {
  console.log('Close code:', event.code, 'Reason:', event.reason);
};
```

```bash
# Check API Gateway WebSocket connections
aws apigatewayv2 get-apis | jq '.Items[] | select(.ProtocolType == "WEBSOCKET")'

# Check Lambda logs for WebSocket handler
aws logs tail /aws/lambda/InfraStack-WebSocketHandler --since 1h
```

**Solução**:
1. Implement automatic reconnection with exponential backoff in the frontend:
   ```javascript
   // The WebSocket service should auto-reconnect
   // Check dashboard/src/services/websocket.js for reconnect logic
   ```
2. Send periodic ping/pong messages to prevent idle timeout (every 5 minutes)
3. If API Gateway limit reached: check concurrent connection count
4. For network issues: the frontend should show a "Reconnecting..." indicator

### 16.2 Real-Time Updates Not Working

**Sintoma**: WebSocket connects but no data updates are received

**Causa**: Backend not publishing to WebSocket, subscription not registered, Lambda permission issue

**Diagnóstico**:
```bash
# Check if WebSocket Lambda is receiving events
aws logs tail /aws/lambda/InfraStack-WebSocketHandler --since 1h | grep -i "publish\|broadcast\|send"

# Check DynamoDB connections table
aws dynamodb scan --table-name B3Dashboard-WebSocketConnections --select COUNT

# Test WebSocket endpoint manually
# Use wscat or browser console:
# const ws = new WebSocket('wss://WEBSOCKET_URL');
# ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

**Solução**:
1. Verify the data pipeline triggers WebSocket broadcasts after new data is written
2. Check that the connection ID is stored in DynamoDB on `$connect`
3. Verify Lambda has `execute-api:ManageConnections` permission
4. If selective updates: ensure the client subscribes to the correct channels/topics

### 16.3 WebSocket Reconnection Failures

**Sintoma**: After a disconnect, the dashboard fails to reconnect and shows persistent "Disconnected" status

**Causa**: Reconnection logic not implemented, max retries exceeded, WebSocket URL changed, stale connection ID in DynamoDB

**Diagnóstico**:
```javascript
// In browser console, check reconnection state
console.log('WebSocket state:', window.__WS_DEBUG__);

// Check for reconnection attempts in console
// Look for: "WebSocket reconnecting... attempt X of Y"

// Check if the WebSocket URL is still valid
fetch('https://YOUR_API_URL/websocket-info')
  .then(r => r.json())
  .then(console.log);
```

```bash
# Check for stale connections in DynamoDB
aws dynamodb scan \
  --table-name B3Dashboard-WebSocketConnections \
  --filter-expression "#ts < :stale" \
  --expression-attribute-names '{"#ts":"connectedAt"}' \
  --expression-attribute-values '{":stale":{"S":"'"$(date -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)"'"}}' \
  --select COUNT

# Clean up stale connections
aws lambda invoke \
  --function-name InfraStack-WebSocketCleanup \
  --payload '{}' \
  response.json
```

**Solução**:
1. Verify the WebSocket service implements reconnection with exponential backoff:
   - Initial delay: 1 second
   - Max delay: 30 seconds
   - Max retries: 10 (then show "Connection lost" with manual retry button)
2. Clear stale connection records from DynamoDB (they prevent new connections with same ID)
3. If WebSocket URL changed after deployment: hard refresh the browser (Ctrl+Shift+R)
4. Check API Gateway WebSocket stage deployment — a new deployment may be needed
5. If persistent: check API Gateway WebSocket route integration for `$connect` and `$disconnect`

---

## 17. Export Issues

### 17.1 CSV/Excel Generation Failures

**Sintoma**: Export button shows error, downloaded file is empty or corrupted

**Causa**: Data too large for client-side generation, browser memory limit, library error

**Diagnóstico**:
```javascript
// Check browser console for export errors
// Common errors:
// - "RangeError: Invalid array length" (too much data)
// - "Out of memory" (browser limit)
// - "Blob is not defined" (compatibility issue)
```

**Solução**:
1. For large datasets: implement server-side export via Lambda
   ```bash
   # Test export endpoint
   curl -H "X-Api-Key: $API_KEY" \
     "${API_URL}api/export/recommendations?format=csv&date=$(date +%Y-%m-%d)" \
     -o recommendations.csv
   ```
2. For client-side: limit export to visible/filtered data only
3. If Excel fails but CSV works: check SheetJS (xlsx) library version
4. For PDF export: ensure the PDF generation library is properly loaded

### 17.2 Large Dataset Export Timeouts

**Sintoma**: Export of large datasets (>10,000 rows) times out or browser becomes unresponsive

**Causa**: Client-side processing too slow, Lambda timeout for server-side export

**Solução**:
1. For client-side: use Web Workers for CSV/Excel generation to avoid blocking the UI
2. For server-side: increase Lambda timeout for export function
   ```bash
   aws lambda update-function-configuration \
     --function-name InfraStack-ExportLambda \
     --timeout 300 --memory-size 2048
   ```
3. Implement pagination in exports: export in chunks and merge
4. Add a progress indicator for large exports
5. Consider pre-generating exports on a schedule and storing in S3 for download

### 17.3 Export Data Doesn't Match Dashboard

**Sintoma**: Exported CSV/Excel has different data than what's displayed on screen

**Causa**: Filters not applied to export, data refreshed between view and export, timezone mismatch

**Solução**:
1. Verify that active filters are passed to the export function
2. Export should use the same data snapshot that's currently displayed (from React Query cache)
3. Check timezone handling: dates in export should match the dashboard display timezone
4. Verify column mapping: exported column headers should match table headers

---

## 18. API Error Code Reference

| HTTP Status | Error Code | Meaning | Common Cause | Solution |
|-------------|-----------|---------|--------------|----------|
| 400 | `BAD_REQUEST` | Invalid request parameters | Missing required field, invalid date format, value out of range | Check request parameters against API documentation. Ensure dates are YYYY-MM-DD, numbers are within valid ranges. |
| 400 | `VALIDATION_ERROR` | Request body validation failed | Invalid JSON, wrong data types, constraint violations | Validate request body against the API schema. Check field types and constraints. |
| 401 | `AUTHENTICATION_ERROR` | Missing or invalid credentials | No API key provided, expired API key, invalid Cognito token | Include `X-Api-Key` header or `Authorization: Bearer TOKEN`. Rotate expired keys. Re-login for expired sessions. |
| 403 | `AUTHORIZATION_ERROR` | Insufficient permissions | User role doesn't have access to the endpoint | Check user role (viewer/analyst/admin). Contact admin to upgrade role if needed. |
| 404 | `NOT_FOUND` | Resource not found | Ticker doesn't exist, no data for requested date, invalid endpoint | Verify the resource exists. Check date range has available data. Verify endpoint URL. |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests | Exceeded 1000 requests/hour (API key) or 100 requests/minute (per user) | Wait for rate limit window to reset (check `X-RateLimit-Reset` header). Implement request throttling in client. |
| 500 | `INTERNAL_ERROR` | Unexpected server error | Lambda crash, unhandled exception, dependency failure | Retry the request. If persistent, check Lambda logs in CloudWatch. Report to engineering team. |
| 502 | `BAD_GATEWAY` | Upstream service error | Lambda timeout, API Gateway integration error | Check Lambda execution duration. Increase timeout if needed. Verify API Gateway integration. |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable | Deployment in progress, dependency down | Wait and retry. Check system status page. |
| 504 | `GATEWAY_TIMEOUT` | Request timeout | Lambda exceeded timeout, slow database query | Optimize the query or increase Lambda timeout. For backtests, use smaller date ranges. |

### Frontend Error Handling Behavior

The frontend `api.js` service handles errors as follows:

- **4xx errors** (client errors): Not retried. Error is thrown immediately as `APIError` with status and data.
- **5xx errors** (server errors): Retried up to 3 times with exponential backoff (1s, 2s, 4s delays).
- **Network errors**: Retried up to 3 times with exponential backoff.
- **Error boundaries**: React error boundaries catch rendering errors at app, tab, and component levels.

### Rate Limit Headers

Every API response includes rate limit information:

```
X-RateLimit-Limit: 1000          # Max requests per hour
X-RateLimit-Remaining: 950       # Remaining requests in window
X-RateLimit-Reset: 1642248000    # Unix timestamp when limit resets
```

---

## 19. Frontend Debugging Guide

### 19.1 Browser Console Errors

**Common JavaScript errors and solutions**:

| Error | Cause | Solution |
|-------|-------|----------|
| `TypeError: Cannot read properties of undefined` | API returned unexpected data shape | Check API response format. Add null checks in component. |
| `ChunkLoadError: Loading chunk X failed` | Code splitting / lazy loading failure | Hard refresh (Ctrl+Shift+R). Clear browser cache. Check CDN. |
| `APIError: HTTP 401` | Authentication expired | Re-login. Check that API key is set in environment. |
| `RangeError: Maximum call stack size exceeded` | Infinite re-render loop | Check useEffect dependencies. Look for circular state updates. |
| `Error: Minified React error #XXX` | Production React error | Look up error code at https://reactjs.org/docs/error-decoder.html |

### 19.2 React Error Boundaries

The dashboard implements three levels of error boundaries:

1. **App-level** (`<AppErrorBoundary>`): Catches fatal errors. Shows full-page error with reload button.
2. **Tab-level** (`<TabErrorBoundary>`): Catches tab-specific errors. Shows error within the tab, other tabs remain functional.
3. **Component-level** (`<ChartErrorBoundary>`): Catches chart/widget errors. Shows error placeholder, rest of tab works.

**Debugging error boundaries**:
```javascript
// In browser console, check React DevTools > Components
// Look for ErrorBoundary components and their state
// state.hasError = true indicates a caught error
// state.error contains the error details
```

### 19.3 Network Issues

**Diagnóstico**:
1. Open DevTools > Network tab
2. Filter by XHR/Fetch requests
3. Look for failed requests (red entries)
4. Check request headers (API key present?)
5. Check response body for error details
6. Check timing for slow requests

**Common network issues**:

| Symptom | Cause | Solution |
|---------|-------|----------|
| All requests fail with CORS error | API Gateway CORS not configured | Verify CORS headers in API Gateway. Check `Access-Control-Allow-Origin`. |
| Requests hang indefinitely | DNS resolution failure or firewall | Check network connectivity. Try accessing API URL directly. |
| Intermittent failures | Network instability | The retry logic (3 retries with backoff) should handle this. Check if retries are working. |
| Slow responses (>5s) | Cold start, large payload, no caching | Check if Lambda cold starts are the issue. Enable caching. Reduce payload size. |

### 19.4 Performance Debugging

```javascript
// Check React Query cache status in DevTools
// Install React Query DevTools for visual inspection

// Check component re-renders
// React DevTools > Profiler > Record and analyze

// Check bundle size
// Run: npm run build -- --stats
// Analyze with: npx webpack-bundle-analyzer build/bundle-stats.json
```

### 19.5 Clearing Local State

If the dashboard is in a broken state due to corrupted local storage:

```javascript
// Clear all dashboard state (run in browser console)
localStorage.clear();
sessionStorage.clear();

// Clear specific items
localStorage.removeItem('theme');
localStorage.removeItem('filterState');
localStorage.removeItem('userPreferences');

// Clear React Query cache
// The QueryClient.clear() is called on logout

// Hard refresh
location.reload(true);
```

---

## 20. Diagnostic Flowcharts

### 20.1 Dashboard Not Loading — Decision Tree

```
Dashboard not loading?
├── Browser console shows errors?
│   ├── CORS error → Check API Gateway CORS config (Section 19.3)
│   ├── 401/403 error → Check authentication (Section 13.1, 13.3)
│   ├── ChunkLoadError → Clear cache, hard refresh, check CDN (Section 15.2)
│   └── Other JS error → Check React error boundaries (Section 19.2)
├── Network tab shows failed requests?
│   ├── All requests fail → Check API Gateway health, DNS resolution
│   ├── Some requests fail → Check specific Lambda logs
│   └── Requests timeout → Check Lambda timeout, cold starts
├── Blank page, no errors?
│   ├── Check if build deployed → aws s3 ls s3://BUCKET/index.html
│   ├── Check CloudFront → Section 15.1
│   └── Re-build and deploy → cd dashboard && npm run build
└── Slow loading (>5s)?
    ├── Check cache hit rate → Section 14 (ElastiCache)
    ├── Check CDN performance → Section 15 (CloudFront)
    └── Check Lambda cold starts → CloudWatch metrics
```

### 20.2 Data Not Updating — Decision Tree

```
Data not updating?
├── Check data freshness → Section 8.3
│   ├── Freshness > 48h (critical) → Check ingestion Lambda
│   └── Freshness > 24h (warning) → Check EventBridge schedule
├── Check cache → Section 14.2
│   ├── Stale cache → Invalidate cache, reduce TTL
│   └── Cache miss → Check Redis connectivity
├── Check WebSocket → Section 16
│   ├── WS disconnected → Check reconnection logic
│   └── WS connected, no updates → Check backend broadcast
└── Check API response
    ├── API returns old data → Check S3 data timestamps
    └── API returns error → Check Lambda logs
```

### 20.3 Performance Degradation — Decision Tree

```
Model performance degraded?
├── Check drift → Section 9
│   ├── Data drift detected → Check data quality first
│   ├── Concept drift detected → Market regime change?
│   └── No drift → Check data quality
├── Check data quality → Section 8
│   ├── Completeness < 95% → Fix missing data
│   ├── Anomalies detected → Investigate outliers
│   └── Data quality OK → Check model age
├── Check model age
│   ├── > 90 days since training → Retrain model
│   └── < 90 days → Check for code changes
└── Check retraining recommendations → Section 9.4
    ├── Priority: critical → Retrain immediately
    ├── Priority: high → Schedule retraining
    └── Priority: low/medium → Monitor
```

### 20.4 Quick Diagnostic Commands

```bash
# === SYSTEM HEALTH CHECK (run all at once) ===

echo "=== 1. Active Alarms ==="
aws cloudwatch describe-alarms --state-value ALARM --query 'MetricAlarms[].AlarmName'

echo "=== 2. Recent Lambda Errors ==="
for fn in $(aws lambda list-functions --query 'Functions[?starts_with(FunctionName,`B3Dashboard`) || starts_with(FunctionName,`InfraStack`)].FunctionName' --output text); do
  errors=$(aws logs filter-log-events --log-group-name /aws/lambda/$fn --start-time $(($(date +%s) - 3600))000 --filter-pattern "ERROR" --max-items 1 --query 'events | length(@)' 2>/dev/null)
  [ "$errors" != "0" ] && echo "  ERRORS in $fn: $errors"
done

echo "=== 3. Cache Status ==="
aws elasticache describe-cache-clusters --query 'CacheClusters[0].CacheClusterStatus'

echo "=== 4. CloudFront Status ==="
aws cloudfront list-distributions --query 'DistributionList.Items[0].Status'

echo "=== 5. API Health ==="
curl -s -o /dev/null -w "%{http_code}" -H "X-Api-Key: $API_KEY" "${API_URL}api/health"
echo ""

echo "=== 6. Data Freshness ==="
aws s3 ls s3://$BUCKET_NAME/quotes_5m/ --recursive | sort | tail -1

echo "=== 7. DynamoDB Tables ==="
for table in B3Dashboard-APIKeys B3Dashboard-AuthLogs B3Dashboard-RateLimits; do
  status=$(aws dynamodb describe-table --table-name $table --query 'Table.TableStatus' --output text 2>/dev/null || echo "NOT_FOUND")
  echo "  $table: $status"
done
```

---

## 21. Contatos de Suporte

### AWS Support
- Console: https://console.aws.amazon.com/support/
- Telefone: +1-866-947-7829

### BRAPI Support
- Email: contato@brapi.dev
- Docs: https://brapi.dev/docs

### Equipe Interna
- Operador: operador@example.com
- Engenheiro: engenheiro@example.com
- Arquiteto: arquiteto@example.com
- Segurança: security@example.com

### GitHub
- Issues: https://github.com/uesleisutil/b3-tactical-ranking/issues
- Discussions: https://github.com/uesleisutil/b3-tactical-ranking/discussions

### Escalation Path

| Nível | Responsável | Quando Escalar |
|-------|-------------|----------------|
| L1 - Operador | operador@example.com | Problemas conhecidos, procedimentos documentados |
| L2 - Engenheiro | engenheiro@example.com | Problemas não documentados, bugs, performance |
| L3 - Arquiteto | arquiteto@example.com | Problemas de arquitetura, custos, decisões de design |
| Segurança | security@example.com | Vulnerabilidades, incidentes de segurança, acesso não autorizado |

---

**Última atualização**: 2026-03-15  
**Versão do Sistema**: 5.0.0
