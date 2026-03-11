# Guia de Operações - B3 Tactical Ranking MLOps System

**Versão**: 3.0.0  
**Data**: 2026-03-10  
**Status**: 📋 PRODUÇÃO

## Visão Geral

Este guia fornece instruções para operação diária, monitoramento e resposta a alertas do sistema ML Monitoring, Governance & Dashboard da B3.

---

## 1. Operações Diárias

### 1.1 Checklist Matinal (09:00 BRT)

```bash
# 1. Verificar status geral do sistema
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name IngestionOK \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Minimum

# 2. Verificar alarms ativos
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --alarm-name-prefix InfraStack

# 3. Verificar últimas recomendações geradas
aws s3 ls s3://$BUCKET_NAME/recommendations/dt=$(date -d '1 day ago' +%Y-%m-%d)/ --recursive

# 4. Verificar completude de dados de ontem
aws s3 cp s3://$BUCKET_NAME/monitoring/completeness/dt=$(date -d '1 day ago' +%Y-%m-%d)/completeness_*.json - | jq '.completeness_percentage'
```

**Ações esperadas:**
- ✅ IngestionOK = 1 nas últimas 24h
- ✅ Nenhum alarm ativo
- ✅ Recomendações de ontem geradas
- ✅ Completude > 90%

### 1.2 Checklist Pós-Pregão (18:00 BRT)

```bash
# 1. Verificar ingestão do dia
aws s3 ls s3://$BUCKET_NAME/quotes_5m/dt=$(date +%Y-%m-%d)/ --recursive | wc -l

# 2. Verificar qualidade dos dados
aws s3 cp s3://$BUCKET_NAME/monitoring/data_quality/dt=$(date +%Y-%m-%d)/quality_*.json - | jq '{completeness, quality_score, validation_errors_count}'

# 3. Aguardar geração de recomendações (18:30 BRT)
# Verificar após 19:00 BRT
aws s3 ls s3://$BUCKET_NAME/recommendations/dt=$(date +%Y-%m-%d)/ --recursive
```

**Ações esperadas:**
- ✅ Dados de cotações salvos (> 500 arquivos)
- ✅ Qualidade > 90%
- ✅ Recomendações geradas às 18:30 BRT

### 1.3 Checklist Noturno (21:00 BRT)

```bash
# 1. Verificar custos do dia
aws s3 cp s3://$BUCKET_NAME/monitoring/costs/dt=$(date +%Y-%m-%d)/costs_*.json - | jq '{total_cost, monthly_projection, alert_generated}'

# 2. Verificar drift detectado
aws s3 cp s3://$BUCKET_NAME/monitoring/drift/dt=$(date +%Y-%m-%d)/drift_*.json - | jq '{drift_detected, drift_score, retrain_recommended}'

# 3. Verificar performance do modelo
aws s3 cp s3://$BUCKET_NAME/monitoring/performance/dt=$(date +%Y-%m-%d)/performance_*.json - | jq '{mape, directional_accuracy, sharpe_ratio}'
```

**Ações esperadas:**
- ✅ Custos dentro do limite (< R$500/mês projetado)
- ✅ Drift monitorado
- ✅ Performance do modelo aceitável (MAPE < 20%)

---

## 2. Monitoramento Contínuo

### 2.1 Dashboard Web

**Acessar**: https://uesleisutil.github.io/b3-tactical-ranking

**Verificações:**
- ✅ Aba "Recomendações": Top 50 ações exibidas
- ✅ Aba "Monitoramento": Métricas atualizadas
- ✅ Aba "Custos": Projeção mensal dentro do limite
- ✅ Auto-refresh funcionando (5 minutos)
- ✅ Timestamp de última atualização recente

### 2.2 CloudWatch Dashboard

**Acessar**: Console AWS > CloudWatch > Dashboards > B3TR-AdvancedFeatures

**Métricas importantes:**
- Lambda Invocations (todas as Lambdas)
- Lambda Errors (deve ser 0)
- Lambda Duration (< timeout)
- Custom Metrics:
  - IngestionOK
  - RecordsIngested
  - DataCompleteness
  - DataQualityScore

### 2.3 CloudWatch Logs

```bash
# Ver logs em tempo real de uma Lambda
aws logs tail /aws/lambda/InfraStack-Quotes5mIngest --follow

# Buscar erros nas últimas 24h
aws logs filter-log-events \
  --log-group-name /aws/lambda/InfraStack-Quotes5mIngest \
  --start-time $(($(date +%s) - 86400))000 \
  --filter-pattern "ERROR"

# Ver logs de todas as Lambdas
for lambda in $(aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `InfraStack`)].FunctionName' --output text); do
  echo "=== $lambda ==="
  aws logs tail /aws/lambda/$lambda --since 1h
done
```

### 2.4 Métricas S3

```bash
# Tamanho total do bucket
aws s3 ls s3://$BUCKET_NAME --recursive --summarize | grep "Total Size"

# Número de objetos por prefixo
echo "Quotes 5m:"
aws s3 ls s3://$BUCKET_NAME/quotes_5m/ --recursive | wc -l

echo "Recommendations:"
aws s3 ls s3://$BUCKET_NAME/recommendations/ --recursive | wc -l

echo "Monitoring:"
aws s3 ls s3://$BUCKET_NAME/monitoring/ --recursive | wc -l
```

---

## 3. Interpretação de Alertas

### 3.1 Alerta: Ingestão Falhando

**Sintoma**: Email com assunto "ALARM: InfraStack-IngestionFailedAlarm"

**Causa possível**:
- Token BRAPI expirado ou inválido
- Rate limit da API BRAPI excedido
- Erro de rede/timeout
- Bucket S3 inacessível

**Diagnóstico**:
```bash
# 1. Ver logs da Ingest Lambda
aws logs tail /aws/lambda/InfraStack-Quotes5mIngest --since 1h

# 2. Verificar última execução
aws lambda invoke \
  --function-name InfraStack-Quotes5mIngest \
  --payload '{}' \
  response.json

cat response.json

# 3. Verificar token BRAPI
aws secretsmanager get-secret-value --secret-id brapi/pro/token

# 4. Testar API BRAPI manualmente
curl "https://brapi.dev/api/quote/PETR4?range=1d&interval=5m&token=SEU_TOKEN"
```

**Ação corretiva**:
```bash
# Se token expirado, atualizar
aws secretsmanager update-secret \
  --secret-id brapi/pro/token \
  --secret-string '{"token":"NOVO_TOKEN"}'

# Se rate limit, aguardar ou reduzir frequência
# Editar infra/.env: B3TR_SCHEDULE_MINUTES=10
cd infra
cdk deploy

# Se erro de rede, executar manualmente após resolver
aws lambda invoke \
  --function-name InfraStack-Quotes5mIngest \
  --payload '{}' \
  response.json
```

### 3.2 Alerta: Completude Baixa (< 90%)

**Sintoma**: Completude < 90% no relatório de qualidade

**Causa possível**:
- Alguns tickers não retornaram dados da API
- Tickers suspensos/delisted
- Erro na lista de universe.txt

**Diagnóstico**:
```bash
# Ver quais tickers faltam
aws s3 cp s3://$BUCKET_NAME/monitoring/completeness/dt=$(date +%Y-%m-%d)/completeness_*.json - | jq '.missing_tickers'

# Verificar se tickers estão ativos
for ticker in $(aws s3 cp s3://$BUCKET_NAME/monitoring/completeness/dt=$(date +%Y-%m-%d)/completeness_*.json - | jq -r '.missing_tickers[]'); do
  echo "Checking $ticker..."
  curl "https://brapi.dev/api/quote/$ticker?token=SEU_TOKEN"
done
```

**Ação corretiva**:
```bash
# Remover tickers inativos do universe.txt
vim config/universe.txt

# Upload para S3
aws s3 cp config/universe.txt s3://$BUCKET_NAME/config/universe.txt

# Executar ingestão novamente
aws lambda invoke \
  --function-name InfraStack-Quotes5mIngest \
  --payload '{}' \
  response.json
```

### 3.3 Alerta: Custos Acima do Limite

**Sintoma**: Projeção mensal > R$500

**Causa possível**:
- SageMaker endpoint ativo 24/7
- Muitas invocações de Lambda
- Armazenamento S3 crescendo muito
- CloudWatch Logs não sendo deletados

**Diagnóstico**:
```bash
# Ver breakdown de custos
aws s3 cp s3://$BUCKET_NAME/monitoring/costs/dt=$(date +%Y-%m-%d)/costs_*.json - | jq '.costs_by_service'

# Ver custos reais via Cost Explorer
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=SERVICE
```

**Ação corretiva**:
```bash
# 1. Desligar SageMaker endpoint se não usado
aws sagemaker delete-endpoint --endpoint-name b3tr-ensemble-endpoint

# 2. Reduzir frequência de ingestão
# Editar infra/.env: B3TR_SCHEDULE_MINUTES=10
cd infra
cdk deploy

# 3. Limpar logs antigos do CloudWatch
for log_group in $(aws logs describe-log-groups --log-group-name-prefix /aws/lambda/InfraStack --query 'logGroups[].logGroupName' --output text); do
  aws logs put-retention-policy \
    --log-group-name $log_group \
    --retention-in-days 7
done

# 4. Limpar dados antigos do S3 (cuidado!)
# Lifecycle rules já configuradas, mas pode forçar:
aws s3 rm s3://$BUCKET_NAME/quotes_5m/ --recursive --exclude "*" --include "dt=2025-*"
```

### 3.4 Alerta: Drift Detectado

**Sintoma**: Drift score > 0.5 ou > 30% features com drift

**Causa possível**:
- Mudança no comportamento do mercado
- Dados de entrada mudaram (nova fonte, formato diferente)
- Modelo desatualizado

**Diagnóstico**:
```bash
# Ver relatório de drift
aws s3 cp s3://$BUCKET_NAME/monitoring/drift/dt=$(date +%Y-%m-%d)/drift_*.json - | jq .

# Ver features com drift
aws s3 cp s3://$BUCKET_NAME/monitoring/drift/dt=$(date +%Y-%m-%d)/drift_*.json - | jq '.features_with_drift'

# Ver performance recente do modelo
aws s3 cp s3://$BUCKET_NAME/monitoring/performance/dt=$(date +%Y-%m-%d)/performance_*.json - | jq '{mape, directional_accuracy}'
```

**Ação corretiva**:
```bash
# Se recomendação de retreinamento foi gerada
aws s3 ls s3://$BUCKET_NAME/monitoring/retrain_recommendations/ --recursive

# Ver recomendação
aws s3 cp s3://$BUCKET_NAME/monitoring/retrain_recommendations/retrain_*.json - | jq .

# Executar retreinamento (manual)
# 1. Preparar dados de treino
aws lambda invoke \
  --function-name InfraStack-PrepareTrainingData \
  --payload '{}' \
  response.json

# 2. Treinar modelos
aws lambda invoke \
  --function-name InfraStack-TrainSageMaker \
  --payload '{}' \
  response.json

# 3. Aguardar conclusão (pode levar horas)
# Monitorar via CloudWatch Logs
```

### 3.5 Alerta: Performance do Modelo Degradada

**Sintoma**: MAPE > 20% ou Sharpe Ratio < 0.5

**Causa possível**:
- Modelo desatualizado
- Mudança no regime de mercado
- Dados de entrada com problemas

**Diagnóstico**:
```bash
# Ver histórico de performance (últimos 30 dias)
for i in {0..29}; do
  date=$(date -d "$i days ago" +%Y-%m-%d)
  echo -n "$date: "
  aws s3 cp s3://$BUCKET_NAME/monitoring/performance/dt=$date/performance_*.json - 2>/dev/null | jq -r '.mape // "N/A"'
done

# Ver se há tendência de piora
```

**Ação corretiva**:
```bash
# 1. Verificar qualidade dos dados de entrada
aws s3 cp s3://$BUCKET_NAME/monitoring/data_quality/dt=$(date +%Y-%m-%d)/quality_*.json - | jq .

# 2. Executar validação histórica
aws lambda invoke \
  --function-name InfraStack-HistoricalDataValidator \
  --payload '{}' \
  response.json

# 3. Se dados OK, considerar retreinamento
# (ver seção 3.4)
```

---

## 4. Execução Manual de Validação Histórica

### 4.1 Quando Executar

- Após adicionar novos tickers ao universe.txt
- Após bootstrap de dados históricos
- Mensalmente (rotina de manutenção)
- Quando suspeitar de problemas nos dados

### 4.2 Como Executar

```bash
# 1. Invocar Lambda de validação
aws lambda invoke \
  --function-name InfraStack-HistoricalDataValidator \
  --payload '{}' \
  response.json

cat response.json

# 2. Aguardar conclusão (pode levar 5-10 minutos)
aws logs tail /aws/lambda/InfraStack-HistoricalDataValidator --follow

# 3. Ver relatório gerado
REPORT_DATE=$(date +%Y-%m-%d)
aws s3 cp s3://$BUCKET_NAME/monitoring/validation/historical_data_report_$REPORT_DATE.json - | jq .
```

### 4.3 Interpretar Relatório

```bash
# Ver resumo
aws s3 cp s3://$BUCKET_NAME/monitoring/validation/historical_data_report_$REPORT_DATE.json - | jq '{
  total_tickers: .total_tickers,
  tickers_with_issues: .tickers_with_issues,
  avg_quality_score: .avg_quality_score
}'

# Ver tickers com problemas
aws s3 cp s3://$BUCKET_NAME/monitoring/validation/historical_data_report_$REPORT_DATE.json - | jq '.ticker_reports[] | select(.has_issues == true) | {ticker, quality_score, issues}'

# Ver recomendações
aws s3 cp s3://$BUCKET_NAME/monitoring/validation/historical_data_report_$REPORT_DATE.json - | jq '.recommendations'
```

### 4.4 Ações Corretivas

**Se gaps detectados**:
```bash
# Re-executar bootstrap para preencher gaps
aws lambda invoke \
  --function-name InfraStack-BootstrapHistoryDaily \
  --payload '{}' \
  response.json

# Monitorar progresso
aws logs tail /aws/lambda/InfraStack-BootstrapHistoryDaily --follow
```

**Se inconsistências detectadas**:
```bash
# Deletar dados inconsistentes e re-ingerir
TICKER="PETR4"
DATE="2026-03-01"

aws s3 rm s3://$BUCKET_NAME/quotes_5m/dt=$DATE/ --recursive --exclude "*" --include "${TICKER}_*"

# Re-executar ingestão para essa data (manual)
# Ou aguardar próximo bootstrap
```

---

## 5. Resposta a Recomendações de Retreinamento

### 5.1 Avaliar Necessidade

```bash
# Ver última recomendação
aws s3 ls s3://$BUCKET_NAME/monitoring/retrain_recommendations/ --recursive | tail -1

# Baixar e analisar
aws s3 cp s3://$BUCKET_NAME/monitoring/retrain_recommendations/retrain_*.json - | jq .
```

**Critérios para retreinamento**:
- ✅ MAPE > 20% por 5 dias consecutivos
- ✅ Drift score > 0.5
- ✅ > 30% features com drift
- ✅ Sharpe Ratio < 0.5 por 7 dias

### 5.2 Preparar Retreinamento

```bash
# 1. Verificar dados disponíveis (últimos 2 anos)
aws s3 ls s3://$BUCKET_NAME/quotes_5m/ --recursive | head -100

# 2. Preparar dados de treino
aws lambda invoke \
  --function-name InfraStack-PrepareTrainingData \
  --payload '{}' \
  response.json

# 3. Verificar dados preparados
aws s3 ls s3://$BUCKET_NAME/training_data/ --recursive
```

### 5.3 Executar Retreinamento

```bash
# 1. Treinar modelos (pode levar 2-4 horas)
aws lambda invoke \
  --function-name InfraStack-TrainSageMaker \
  --payload '{}' \
  response.json

# 2. Monitorar progresso
aws logs tail /aws/lambda/InfraStack-TrainSageMaker --follow

# 3. Verificar jobs de treino no SageMaker
aws sagemaker list-training-jobs \
  --sort-by CreationTime \
  --sort-order Descending \
  --max-results 5

# 4. Ver status de um job específico
aws sagemaker describe-training-job --training-job-name <job-name>
```

### 5.4 Validar Novo Modelo

```bash
# 1. Aguardar conclusão do treino
# Status deve ser "Completed"

# 2. Executar ranking com novo modelo
aws lambda invoke \
  --function-name InfraStack-RankSageMaker \
  --payload '{}' \
  response.json

# 3. Comparar performance
# Antes:
aws s3 cp s3://$BUCKET_NAME/monitoring/performance/dt=$(date -d '1 day ago' +%Y-%m-%d)/performance_*.json - | jq '.mape'

# Depois (aguardar 20 dias para validar predições):
# Monitorar MAPE nos próximos dias
```

---

## 6. Monitoramento de Custos

### 6.1 Verificar Custos Diários

```bash
# Ver custos de hoje
aws s3 cp s3://$BUCKET_NAME/monitoring/costs/dt=$(date +%Y-%m-%d)/costs_*.json - | jq '{
  total_cost,
  monthly_projection,
  costs_by_service,
  cost_per_recommendation
}'

# Ver tendência (últimos 7 dias)
for i in {0..6}; do
  date=$(date -d "$i days ago" +%Y-%m-%d)
  echo -n "$date: R$ "
  aws s3 cp s3://$BUCKET_NAME/monitoring/costs/dt=$date/costs_*.json - 2>/dev/null | jq -r '.total_cost // "N/A"'
done
```

### 6.2 Identificar Componentes Caros

```bash
# Ver breakdown por serviço
aws s3 cp s3://$BUCKET_NAME/monitoring/costs/dt=$(date +%Y-%m-%d)/costs_*.json - | jq '.costs_by_service | to_entries | sort_by(.value) | reverse'

# Ver custos de SageMaker especificamente
aws s3 cp s3://$BUCKET_NAME/monitoring/costs/dt=$(date +%Y-%m-%d)/costs_*.json - | jq '.costs_by_service.SageMaker'
```

### 6.3 Otimizar Custos

**Lambda**:
```bash
# Reduzir memory size (se possível)
aws lambda update-function-configuration \
  --function-name InfraStack-Quotes5mIngest \
  --memory-size 512

# Reduzir timeout (se possível)
aws lambda update-function-configuration \
  --function-name InfraStack-Quotes5mIngest \
  --timeout 300
```

**S3**:
```bash
# Verificar tamanho do bucket
aws s3 ls s3://$BUCKET_NAME --recursive --summarize | grep "Total Size"

# Forçar transição para Glacier (dados antigos)
aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET_NAME \
  --lifecycle-configuration file://lifecycle.json
```

**SageMaker**:
```bash
# Listar endpoints ativos
aws sagemaker list-endpoints

# Deletar endpoint se não usado
aws sagemaker delete-endpoint --endpoint-name b3tr-ensemble-endpoint

# Usar batch transform em vez de endpoint real-time
```

---

## 7. Backup e Recuperação

### 7.1 Backup de Dados

```bash
# Backup completo do bucket S3
aws s3 sync s3://$BUCKET_NAME/ ./backup-$(date +%Y%m%d)/ \
  --exclude "*.pyc" \
  --exclude "__pycache__/*"

# Backup apenas de dados críticos
aws s3 sync s3://$BUCKET_NAME/recommendations/ ./backup-recommendations-$(date +%Y%m%d)/
aws s3 sync s3://$BUCKET_NAME/monitoring/ ./backup-monitoring-$(date +%Y%m%d)/
```

### 7.2 Backup de Configuração

```bash
# Exportar stack CDK
cd infra
cdk synth > cloudformation-template-$(date +%Y%m%d).yaml

# Backup de secrets
aws secretsmanager get-secret-value --secret-id brapi/pro/token > brapi-token-backup.json

# Backup de configurações
cp config/universe.txt universe-backup-$(date +%Y%m%d).txt
cp config/b3_holidays_2026.json holidays-backup-$(date +%Y%m%d).json
```

### 7.3 Recuperação de Dados

```bash
# Restaurar de backup
aws s3 sync ./backup-20260310/ s3://$BUCKET_NAME/ --delete

# Restaurar apenas recomendações
aws s3 sync ./backup-recommendations-20260310/ s3://$BUCKET_NAME/recommendations/

# Verificar integridade
aws s3 ls s3://$BUCKET_NAME/ --recursive | wc -l
```

---

## 8. Manutenção Preventiva

### 8.1 Semanal

- [ ] Verificar alarms ativos
- [ ] Revisar custos da semana
- [ ] Verificar performance do modelo (MAPE, Sharpe)
- [ ] Limpar logs antigos do CloudWatch (se necessário)

### 8.2 Mensal

- [ ] Executar validação histórica completa
- [ ] Revisar e atualizar universe.txt (adicionar/remover tickers)
- [ ] Backup completo de dados
- [ ] Revisar e otimizar custos
- [ ] Atualizar documentação (se necessário)

### 8.3 Trimestral

- [ ] Avaliar necessidade de retreinamento
- [ ] Revisar e atualizar feriados B3
- [ ] Atualizar dependências (CDK, Lambda layers)
- [ ] Revisar e otimizar infraestrutura

---

## 9. Contatos e Escalação

### 9.1 Níveis de Suporte

**Nível 1 - Operador**:
- Monitoramento diário
- Resposta a alertas simples
- Execução de checklists

**Nível 2 - Engenheiro**:
- Troubleshooting avançado
- Correção de erros de código
- Otimização de performance

**Nível 3 - Arquiteto**:
- Mudanças de arquitetura
- Retreinamento de modelos
- Disaster recovery

### 9.2 Procedimento de Escalação

1. **Alerta recebido** → Operador verifica logs e métricas
2. **Problema não resolvido em 1h** → Escalar para Engenheiro
3. **Problema crítico ou não resolvido em 4h** → Escalar para Arquiteto

### 9.3 Contatos

- **Operador**: operador@example.com
- **Engenheiro**: engenheiro@example.com
- **Arquiteto**: arquiteto@example.com
- **GitHub Issues**: https://github.com/uesleisutil/b3-tactical-ranking/issues

---

## 10. Referências Rápidas

### 10.1 Comandos Úteis

```bash
# Ver status geral
aws cloudwatch describe-alarms --state-value ALARM

# Executar Lambda manualmente
aws lambda invoke --function-name <name> --payload '{}' response.json

# Ver logs em tempo real
aws logs tail /aws/lambda/<name> --follow

# Ver custos
aws s3 cp s3://$BUCKET_NAME/monitoring/costs/dt=$(date +%Y-%m-%d)/costs_*.json - | jq .

# Ver recomendações
aws s3 cp s3://$BUCKET_NAME/recommendations/dt=$(date +%Y-%m-%d)/recommendations_*.json - | jq .
```

### 10.2 Links Importantes

- Dashboard: https://uesleisutil.github.io/b3-tactical-ranking
- CloudWatch: https://console.aws.amazon.com/cloudwatch/
- S3 Console: https://s3.console.aws.amazon.com/s3/buckets/$BUCKET_NAME
- Lambda Console: https://console.aws.amazon.com/lambda/
- BRAPI Docs: https://brapi.dev/docs

---

**Última atualização**: 2026-03-10  
**Versão do Sistema**: 3.0.0

