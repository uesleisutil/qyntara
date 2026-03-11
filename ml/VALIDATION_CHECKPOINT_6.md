# Checkpoint 6: Validação de Governança de Dados

## Objetivo

Validar que o sistema de governança de dados está funcionando corretamente, incluindo:
- Data Quality Lambda calculando métricas corretamente
- Historical Validator Lambda gerando relatórios completos
- Data Lineage sendo registrada e atualizada corretamente

## Pré-requisitos

- Task 4 (Data Governance) completa
- Task 5 (Data Lineage Tracking) completa
- Dados de teste disponíveis no S3
- AWS CLI configurado
- Credenciais AWS válidas

## Validações

### 1. Validar Data Quality Lambda

**Objetivo**: Verificar que a Lambda de qualidade de dados está calculando métricas corretamente.

**Passos**:

1. Executar Data Quality Lambda manualmente:
```bash
aws lambda invoke \
  --function-name b3tr-data-quality \
  --payload '{}' \
  response.json

cat response.json
```

2. Verificar resposta esperada:
```json
{
  "ok": true,
  "completeness": 100.0,
  "quality_score": 95.5,
  "validation_errors": 0,
  "anomalies": 0,
  "alert_generated": false
}
```

3. Verificar métricas salvas no S3:
```bash
# Listar arquivos de qualidade de hoje
TODAY=$(date +%Y-%m-%d)
aws s3 ls s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/data_quality/dt=${TODAY}/

# Baixar e visualizar última métrica
aws s3 cp s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/data_quality/dt=${TODAY}/quality_*.json - | jq .
```

4. Verificar campos obrigatórios:
```bash
aws s3 cp s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/data_quality/dt=${TODAY}/quality_*.json - | jq 'has("completeness_percentage", "missing_tickers", "avg_ingestion_latency_ms", "error_rate", "anomalies", "quality_score")'
# Deve retornar: true
```

**Critérios de Sucesso**:
- ✅ Lambda executa sem erros
- ✅ Completeness calculada corretamente (0-100%)
- ✅ Quality score calculado (0-100)
- ✅ Métricas salvas em `monitoring/data_quality/dt={date}/`
- ✅ Todos os campos obrigatórios presentes

### 2. Validar Alertas de Completude

**Objetivo**: Verificar que alertas são gerados quando completude < 90%.

**Passos**:

1. Simular cenário de baixa completude (remover dados de alguns tickers):
```bash
# Backup dos dados
TODAY=$(date +%Y-%m-%d)
aws s3 sync s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/quotes_5m/dt=${TODAY}/ /tmp/backup_quotes/

# Remover dados de 10 tickers (20% do universo)
for ticker in PETR4 VALE3 ITUB4 BBDC4 ABEV3 MGLU3 WEGE3 RENT3 LREN3 GGBR4; do
  aws s3 rm s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/quotes_5m/dt=${TODAY}/${ticker}_*.json
done
```

2. Executar Data Quality Lambda:
```bash
aws lambda invoke \
  --function-name b3tr-data-quality \
  --payload '{}' \
  response.json

cat response.json | jq .
```

3. Verificar alerta gerado:
```bash
cat response.json | jq '.alert_generated, .alert_severity'
# Deve retornar: true, "critical"
```

4. Restaurar dados:
```bash
aws s3 sync /tmp/backup_quotes/ s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/quotes_5m/dt=${TODAY}/
```

**Critérios de Sucesso**:
- ✅ Alerta crítico gerado quando completude < 90%
- ✅ Alerta warning gerado quando completude < 95%
- ✅ Missing tickers identificados corretamente

### 3. Validar Historical Data Validator Lambda

**Objetivo**: Verificar que a validação histórica gera relatórios completos.

**Passos**:

1. Executar Historical Validator Lambda:
```bash
aws lambda invoke \
  --function-name b3tr-historical-validator \
  --payload '{}' \
  response.json

cat response.json
```

2. Verificar resposta esperada:
```json
{
  "ok": true,
  "overall_quality_score": 94.5,
  "tickers_validated": 50,
  "gaps_found": 5,
  "inconsistencies_found": 2
}
```

3. Baixar e analisar relatório:
```bash
# Encontrar relatório mais recente
REPORT=$(aws s3 ls s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/validation/ | grep historical_data_report | tail -1 | awk '{print $4}')

# Baixar relatório
aws s3 cp s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/validation/${REPORT} - | jq .
```

4. Verificar estrutura do relatório:
```bash
aws s3 cp s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/validation/${REPORT} - | jq 'has("timestamp", "period_start", "period_end", "tickers_validated", "overall_quality_score", "gaps", "inconsistencies", "ticker_scores")'
# Deve retornar: true
```

5. Verificar gaps detectados:
```bash
aws s3 cp s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/validation/${REPORT} - | jq '.gaps[] | select(.duration_days > 5)'
```

6. Verificar recomendações:
```bash
aws s3 cp s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/validation/${REPORT} - | jq '.gaps[0].recommendation'
# Deve retornar uma recomendação de ação
```

**Critérios de Sucesso**:
- ✅ Lambda executa sem erros
- ✅ Relatório gerado com todos os campos obrigatórios
- ✅ Gaps > 5 dias úteis detectados corretamente
- ✅ Inconsistências de preços detectadas
- ✅ Score de qualidade calculado por ticker
- ✅ Recomendações geradas para cada problema

### 4. Validar Data Lineage Tracking

**Objetivo**: Verificar que lineage está sendo registrada e atualizada corretamente.

**Passos**:

1. Verificar registros de lineage criados pelo Ingest Lambda:
```bash
TODAY=$(date +%Y-%m-%d)
aws s3 ls s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/lineage/dt=${TODAY}/

# Baixar e visualizar
aws s3 cp s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/lineage/dt=${TODAY}/lineage_*.json - | jq .
```

2. Verificar campos obrigatórios em registro de lineage:
```bash
aws s3 cp s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/lineage/dt=${TODAY}/lineage_*.json - | jq '.records[0] | has("data_id", "ticker", "timestamp", "source", "source_version", "pipeline_version", "collection_timestamp", "storage_timestamp", "transformations", "s3_location")'
# Deve retornar: true
```

3. Executar Data Quality Lambda para adicionar transformações:
```bash
aws lambda invoke \
  --function-name b3tr-data-quality \
  --payload '{}' \
  response.json
```

4. Verificar transformações adicionadas:
```bash
aws s3 cp s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/lineage/dt=${TODAY}/lineage_*.json - | jq '.records[0].transformations'
```

5. Verificar estrutura da transformação:
```bash
aws s3 cp s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/lineage/dt=${TODAY}/lineage_*.json - | jq '.records[0].transformations[0] | has("type", "timestamp", "status", "details")'
# Deve retornar: true
```

6. Contar registros de lineage:
```bash
aws s3 cp s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/lineage/dt=${TODAY}/lineage_*.json - | jq '.total_records'
```

**Critérios de Sucesso**:
- ✅ Registros de lineage criados para cada dado ingerido
- ✅ Todos os campos obrigatórios presentes
- ✅ Transformações adicionadas pelo Data Quality Lambda
- ✅ Timestamps corretos (collection < storage)
- ✅ S3 location aponta para arquivo correto

### 5. Validar Detecção de Anomalias

**Objetivo**: Verificar que anomalias são detectadas corretamente.

**Passos**:

1. Criar dados com anomalia (variação > 50%):
```bash
# Criar cotação normal para ontem
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)
cat > /tmp/normal_quote.json <<EOF
{
  "ticker": "TEST4",
  "timestamp": "${YESTERDAY}T15:00:00Z",
  "open": 100.0,
  "high": 105.0,
  "low": 98.0,
  "close": 102.0,
  "volume": 1000000,
  "ingested_at": "${YESTERDAY}T15:05:00Z"
}
EOF

aws s3 cp /tmp/normal_quote.json s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/quotes_5m/dt=${YESTERDAY}/TEST4_150000.json

# Criar cotação com anomalia para hoje (volume 2x maior)
TODAY=$(date +%Y-%m-%d)
cat > /tmp/anomaly_quote.json <<EOF
{
  "ticker": "TEST4",
  "timestamp": "${TODAY}T15:00:00Z",
  "open": 101.0,
  "high": 106.0,
  "low": 99.0,
  "close": 103.0,
  "volume": 2500000,
  "ingested_at": "${TODAY}T15:05:00Z"
}
EOF

aws s3 cp /tmp/anomaly_quote.json s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/quotes_5m/dt=${TODAY}/TEST4_150000.json
```

2. Executar Data Quality Lambda:
```bash
aws lambda invoke \
  --function-name b3tr-data-quality \
  --payload '{}' \
  response.json
```

3. Verificar anomalias detectadas:
```bash
cat response.json | jq '.anomalies'
# Deve retornar: número > 0
```

4. Verificar detalhes da anomalia:
```bash
aws s3 cp s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/data_quality/dt=${TODAY}/quality_*.json - | jq '.anomalies[] | select(.ticker == "TEST4")'
```

5. Limpar dados de teste:
```bash
aws s3 rm s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/quotes_5m/dt=${YESTERDAY}/TEST4_150000.json
aws s3 rm s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/quotes_5m/dt=${TODAY}/TEST4_150000.json
```

**Critérios de Sucesso**:
- ✅ Anomalias de volume detectadas (variação > 50%)
- ✅ Anomalias de preço detectadas (variação > 50%)
- ✅ Detalhes da anomalia incluem ticker, data, métrica, valores

### 6. Validar CloudWatch Metrics

**Objetivo**: Verificar que métricas são publicadas no CloudWatch.

**Passos**:

1. Verificar métricas de Data Quality:
```bash
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name DataCompleteness \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average
```

2. Verificar métricas disponíveis:
```bash
aws cloudwatch list-metrics --namespace B3TR
```

3. Verificar valores recentes:
```bash
for metric in DataCompleteness DataQualityScore ValidationErrors AnomaliesDetected; do
  echo "=== $metric ==="
  aws cloudwatch get-metric-statistics \
    --namespace B3TR \
    --metric-name $metric \
    --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 3600 \
    --statistics Average,Maximum,Minimum
done
```

**Critérios de Sucesso**:
- ✅ Métricas publicadas: DataCompleteness, DataQualityScore, ValidationErrors, AnomaliesDetected
- ✅ Valores dentro dos ranges esperados
- ✅ Timestamps recentes

## Checklist Final

Antes de prosseguir para a próxima fase, confirme:

- [ ] Data Quality Lambda executa sem erros
- [ ] Métricas de qualidade calculadas corretamente
- [ ] Alertas gerados quando completude < 90%
- [ ] Historical Validator Lambda gera relatórios completos
- [ ] Gaps > 5 dias úteis detectados
- [ ] Inconsistências de dados detectadas
- [ ] Recomendações geradas para problemas
- [ ] Data Lineage registrada para cada dado ingerido
- [ ] Transformações adicionadas aos registros de lineage
- [ ] Anomalias detectadas corretamente (variação > 50%)
- [ ] CloudWatch metrics publicadas
- [ ] Todos os dados salvos com particionamento correto (dt=YYYY-MM-DD)

## Troubleshooting

### Problema: Lambda retorna erro de timeout

**Solução**:
```bash
# Aumentar timeout da Lambda
aws lambda update-function-configuration \
  --function-name b3tr-data-quality \
  --timeout 300
```

### Problema: Métricas não aparecem no S3

**Solução**:
```bash
# Verificar logs do CloudWatch
aws logs tail /aws/lambda/b3tr-data-quality --follow

# Verificar permissões IAM
aws iam get-role-policy \
  --role-name b3tr-data-quality-role \
  --policy-name s3-access
```

### Problema: Lineage não está sendo atualizada

**Solução**:
```bash
# Verificar se arquivos de lineage existem
TODAY=$(date +%Y-%m-%d)
aws s3 ls s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/monitoring/lineage/dt=${TODAY}/

# Verificar logs do Data Quality Lambda
aws logs tail /aws/lambda/b3tr-data-quality --follow --filter-pattern "lineage"
```

### Problema: Anomalias não detectadas

**Solução**:
```bash
# Verificar se há dados do dia anterior
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)
aws s3 ls s3://b3-tactical-ranking-${ACCOUNT_ID}-${REGION}/quotes_5m/dt=${YESTERDAY}/

# Verificar threshold de detecção (50%)
# Ajustar se necessário no código da Lambda
```

## Próximos Passos

Após validação bem-sucedida:
1. Documentar quaisquer problemas encontrados
2. Ajustar configurações se necessário
3. Prosseguir para Task 7 (Model Ensemble - Geração de Recomendações)
