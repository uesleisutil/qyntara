# Runbook de Troubleshooting - B3 Tactical Ranking MLOps System

**Versão**: 3.0.0  
**Data**: 2026-03-10  
**Status**: 📋 PRODUÇÃO

## Visão Geral

Este runbook fornece soluções para problemas comuns do sistema ML Monitoring, Governance & Dashboard da B3.

---

## Índice de Problemas

1. [Ingestão de Dados](#1-ingestão-de-dados)
2. [Geração de Recomendações](#2-geração-de-recomendações)
3. [Dashboard](#3-dashboard)
4. [Performance e Custos](#4-performance-e-custos)
5. [Infraestrutura AWS](#5-infraestrutura-aws)

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

# Ver próximas execuções (não há comando direto, calcular manualmente)
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

## 8. Contatos de Suporte

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

### GitHub
- Issues: https://github.com/uesleisutil/b3-tactical-ranking/issues
- Discussions: https://github.com/uesleisutil/b3-tactical-ranking/discussions

---

**Última atualização**: 2026-03-10  
**Versão do Sistema**: 3.0.0

