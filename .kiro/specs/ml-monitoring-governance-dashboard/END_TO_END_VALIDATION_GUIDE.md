# Guia de Validação End-to-End - Tasks 20.2-20.5

**Data**: 2026-03-10  
**Status**: 📋 GUIA DE EXECUÇÃO

## Visão Geral

Este documento fornece instruções detalhadas para executar e validar os fluxos completos do sistema ML Monitoring, Governance & Dashboard da B3.

---

## 20.2 Executar Fluxo Completo de Ingestão

### Objetivo
Validar que o fluxo de ingestão funciona corretamente: Ingest Lambda → Data Quality Lambda → Dados salvos no S3.

### Pré-requisitos
1. ✅ Stack CDK deployada na AWS
2. ✅ Secret `brapi/pro/token` configurado no Secrets Manager
3. ✅ Arquivo `config/universe.txt` no S3 com lista de tickers
4. ✅ EventBridge schedules habilitados

### Passos de Execução

#### 1. Executar Ingest Lambda Manualmente

```bash
# Invocar Lambda via AWS CLI
aws lambda invoke \
  --function-name <IngestLambdaName> \
  --payload '{}' \
  response.json

# Ver resultado
cat response.json
```

**Resultado esperado:**
```json
{
  "ok": true,
  "records_saved": 500,
  "tickers_processed": 50,
  "errors_count": 0,
  "latency_p95_ms": 1234.56
}
```

#### 2. Verificar Dados no S3

```bash
# Listar dados de cotações de hoje
aws s3 ls s3://<bucket-name>/quotes_5m/dt=$(date +%Y-%m-%d)/ --recursive

# Verificar metadados de ingestão
aws s3 ls s3://<bucket-name>/monitoring/ingestion/dt=$(date +%Y-%m-%d)/ --recursive

# Verificar lineage tracking
aws s3 ls s3://<bucket-name>/monitoring/lineage/dt=$(date +%Y-%m-%d)/ --recursive

# Verificar latência da API
aws s3 ls s3://<bucket-name>/monitoring/api_latency/dt=$(date +%Y-%m-%d)/ --recursive
```

**Validações:**
- ✅ Arquivos de cotações existem em `quotes_5m/dt=YYYY-MM-DD/`
- ✅ Formato: `{ticker}_{HHMMSS}.json`
- ✅ Metadados de ingestão salvos em `monitoring/ingestion/`
- ✅ Registros de lineage salvos em `monitoring/lineage/`
- ✅ Métricas de latência salvas em `monitoring/api_latency/`

#### 3. Verificar Logs no CloudWatch

```bash
# Ver logs da Ingest Lambda
aws logs tail /aws/lambda/<IngestLambdaName> --follow

# Buscar por erros
aws logs filter-log-events \
  --log-group-name /aws/lambda/<IngestLambdaName> \
  --filter-pattern "ERROR"
```

**Validações:**
- ✅ Nenhum erro crítico nos logs
- ✅ Token BRAPI não aparece nos logs (Req 1.2)
- ✅ Retry logic funcionando para erros 429 e 5xx
- ✅ Latência p95 < 5 segundos

#### 4. Verificar Métricas no CloudWatch

```bash
# Ver métrica IngestionOK
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name IngestionOK \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Minimum

# Ver métrica RecordsIngested
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name RecordsIngested \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**Validações:**
- ✅ `IngestionOK` = 1 (sucesso)
- ✅ `RecordsIngested` > 0
- ✅ `IngestionLatencyP95` < 5000ms

#### 5. Executar Data Quality Lambda

```bash
# Invocar Lambda via AWS CLI
aws lambda invoke \
  --function-name <DataQualityLambdaName> \
  --payload '{}' \
  response.json

# Ver resultado
cat response.json
```

**Resultado esperado:**
```json
{
  "ok": true,
  "completeness": 98.5,
  "quality_score": 95.2,
  "validation_errors": 2,
  "anomalies": 0,
  "alert_generated": false
}
```

#### 6. Verificar Métricas de Qualidade no S3

```bash
# Listar métricas de qualidade
aws s3 ls s3://<bucket-name>/monitoring/data_quality/dt=$(date +%Y-%m-%d)/ --recursive

# Baixar e visualizar
aws s3 cp s3://<bucket-name>/monitoring/data_quality/dt=$(date +%Y-%m-%d)/quality_*.json - | jq .
```

**Validações:**
- ✅ Completude > 90% (Req 4.3)
- ✅ Quality score > 80
- ✅ Erros de validação documentados
- ✅ Anomalias detectadas (se houver)

### Checklist de Validação - Task 20.2

- [ ] Ingest Lambda executada com sucesso
- [ ] Dados salvos no S3 com particionamento correto
- [ ] Metadados de ingestão registrados
- [ ] Lineage tracking funcionando
- [ ] Latência medida e registrada
- [ ] Logs sem erros críticos
- [ ] Credenciais não expostas nos logs
- [ ] Data Quality Lambda executada automaticamente
- [ ] Métricas de qualidade calculadas
- [ ] CloudWatch metrics publicadas

---

## 20.3 Executar Fluxo Completo de Recomendações

### Objetivo
Validar que o fluxo de recomendações funciona: Rank Lambda → Performance Monitor → Drift Monitor → Recomendações salvas.

### Pré-requisitos
1. ✅ Dados de cotações disponíveis no S3 (últimos 60 dias)
2. ✅ SageMaker endpoint deployado e ativo
3. ✅ EventBridge schedules habilitados

### Passos de Execução

#### 1. Executar Rank Lambda Manualmente

```bash
# Invocar Lambda via AWS CLI
aws lambda invoke \
  --function-name <RankLambdaName> \
  --payload '{}' \
  response.json

# Ver resultado
cat response.json
```

**Resultado esperado:**
```json
{
  "ok": true,
  "recommendations_count": 50,
  "avg_expected_return": 5.2,
  "avg_confidence_score": 0.75,
  "recommendations_key": "recommendations/dt=2026-03-10/recommendations_183000.json"
}
```

#### 2. Verificar Recomendações no S3

```bash
# Listar recomendações de hoje
aws s3 ls s3://<bucket-name>/recommendations/dt=$(date +%Y-%m-%d)/ --recursive

# Baixar e visualizar
aws s3 cp s3://<bucket-name>/recommendations/dt=$(date +%Y-%m-%d)/recommendations_*.json - | jq .
```

**Validações:**
- ✅ 50 recomendações geradas (Req 6.5)
- ✅ Campos obrigatórios presentes (Req 6.4):
  - ticker
  - current_price
  - predicted_price
  - expected_return
  - confidence_score
  - rank
- ✅ Horizonte de predição = 20 dias (Req 6.3)
- ✅ Contribuições dos 4 modelos registradas (XGBoost, LSTM, Prophet, DeepAR)

#### 3. Verificar Pesos do Ensemble

```bash
# Listar pesos do ensemble
aws s3 ls s3://<bucket-name>/monitoring/ensemble_weights/dt=$(date +%Y-%m-%d)/ --recursive

# Baixar e visualizar
aws s3 cp s3://<bucket-name>/monitoring/ensemble_weights/dt=$(date +%Y-%m-%d)/weights_*.json - | jq .
```

**Validações:**
- ✅ Pesos dos 4 modelos registrados (Req 18.1, 18.2)
- ✅ Soma dos pesos = 1.0

#### 4. Executar Performance Monitor Lambda

```bash
# Invocar Lambda via AWS CLI (valida predições de 20 dias atrás)
aws lambda invoke \
  --function-name <PerformanceMonitorLambdaName> \
  --payload '{}' \
  response.json

# Ver resultado
cat response.json
```

**Resultado esperado:**
```json
{
  "ok": true,
  "mape": 12.5,
  "directional_accuracy": 65.0,
  "mae": 2.3,
  "sharpe_ratio": 1.2,
  "hit_rate": 68.0
}
```

#### 5. Verificar Métricas de Performance no S3

```bash
# Listar métricas de performance
aws s3 ls s3://<bucket-name>/monitoring/performance/dt=$(date +%Y-%m-%d)/ --recursive

# Baixar e visualizar
aws s3 cp s3://<bucket-name>/monitoring/performance/dt=$(date +%Y-%m-%d)/performance_*.json - | jq .
```

**Validações:**
- ✅ MAPE calculado (Req 7.1)
- ✅ Acurácia direcional calculada (Req 7.2)
- ✅ MAE calculado (Req 7.3)
- ✅ Sharpe Ratio calculado (Req 7.4)
- ✅ Taxa de acerto calculada (Req 7.5)

#### 6. Executar Drift Monitor Lambda

```bash
# Invocar Lambda via AWS CLI
aws lambda invoke \
  --function-name <DriftMonitorLambdaName> \
  --payload '{}' \
  response.json

# Ver resultado
cat response.json
```

**Resultado esperado:**
```json
{
  "ok": true,
  "drift_detected": false,
  "drift_score": 0.25,
  "features_with_drift": 5,
  "retrain_recommended": false
}
```

#### 7. Verificar Relatórios de Drift no S3

```bash
# Listar relatórios de drift
aws s3 ls s3://<bucket-name>/monitoring/drift/dt=$(date +%Y-%m-%d)/ --recursive

# Baixar e visualizar
aws s3 cp s3://<bucket-name>/monitoring/drift/dt=$(date +%Y-%m-%d)/drift_*.json - | jq .
```

**Validações:**
- ✅ Performance drift detectado (Req 8.1)
- ✅ Drift score calculado (Req 8.3)
- ✅ Features com drift identificadas (Req 8.5)
- ✅ Recomendação de retreinamento gerada se necessário (Req 15.1-15.5)

### Checklist de Validação - Task 20.3

- [ ] Rank Lambda executada com sucesso
- [ ] 50 recomendações geradas
- [ ] Campos obrigatórios presentes
- [ ] Pesos do ensemble registrados
- [ ] Performance Monitor executada
- [ ] Métricas de performance calculadas (MAPE, MAE, Sharpe, etc.)
- [ ] Drift Monitor executada
- [ ] Drift detectado e registrado
- [ ] Recomendação de retreinamento gerada (se aplicável)

---

## 20.4 Executar Fluxo Completo de Monitoramento

### Objetivo
Validar que o monitoramento de custos funciona corretamente.

### Passos de Execução

#### 1. Executar Cost Monitor Lambda

```bash
# Invocar Lambda via AWS CLI
aws lambda invoke \
  --function-name <CostMonitorLambdaName> \
  --payload '{}' \
  response.json

# Ver resultado
cat response.json
```

**Resultado esperado:**
```json
{
  "ok": true,
  "total_cost": 125.50,
  "monthly_projection": 375.00,
  "alert_generated": false,
  "alert_severity": null
}
```

#### 2. Verificar Relatórios de Custo no S3

```bash
# Listar relatórios de custo
aws s3 ls s3://<bucket-name>/monitoring/costs/dt=$(date +%Y-%m-%d)/ --recursive

# Baixar e visualizar
aws s3 cp s3://<bucket-name>/monitoring/costs/dt=$(date +%Y-%m-%d)/costs_*.json - | jq .
```

**Validações:**
- ✅ Custos por serviço calculados (Req 9.1, 9.4):
  - Lambda
  - S3
  - SageMaker
  - CloudWatch
- ✅ Projeção mensal calculada (Req 9.2)
- ✅ Alertas gerados se projeção > R$400 ou > R$500 (Req 9.3)
- ✅ Custo por recomendação calculado (Req 9.5)
- ✅ Anomalias de custo detectadas (Req 9.7)

#### 3. Verificar Alertas no SNS

```bash
# Listar mensagens do SNS topic (se alerta foi gerado)
aws sns list-subscriptions-by-topic \
  --topic-arn <AlertsTopicArn>
```

**Validações:**
- ✅ Alerta enviado se projeção > 80% do limite
- ✅ Email recebido (se configurado)

### Checklist de Validação - Task 20.4

- [ ] Cost Monitor Lambda executada com sucesso
- [ ] Custos coletados via Cost Explorer API
- [ ] Custos por serviço calculados
- [ ] Projeção mensal calculada
- [ ] Alertas gerados quando thresholds ultrapassados
- [ ] Custo por recomendação calculado
- [ ] Anomalias detectadas

---

## 20.5 Validar Dashboard com Dados Reais

### Objetivo
Validar que o dashboard carrega e exibe dados corretamente de todas as 3 abas.

### Pré-requisitos
1. ✅ Dashboard API deployada e acessível
2. ✅ API Key configurada
3. ✅ Dados disponíveis no S3 (ingestão, recomendações, monitoramento)
4. ✅ Dashboard React buildado e servido

### Passos de Execução

#### 1. Testar Dashboard API Endpoints

```bash
# Obter API Key
API_KEY=$(aws apigateway get-api-key --api-key <ApiKeyId> --include-value --query 'value' --output text)

# Testar endpoint de recomendações
curl -H "X-Api-Key: $API_KEY" \
  https://<api-id>.execute-api.<region>.amazonaws.com/prod/api/recommendations/latest

# Testar endpoint de qualidade de dados
curl -H "X-Api-Key: $API_KEY" \
  "https://<api-id>.execute-api.<region>.amazonaws.com/prod/api/monitoring/data-quality?days=30"

# Testar endpoint de performance
curl -H "X-Api-Key: $API_KEY" \
  "https://<api-id>.execute-api.<region>.amazonaws.com/prod/api/monitoring/model-performance?days=30"

# Testar endpoint de drift
curl -H "X-Api-Key: $API_KEY" \
  "https://<api-id>.execute-api.<region>.amazonaws.com/prod/api/monitoring/drift?days=30"

# Testar endpoint de custos
curl -H "X-Api-Key: $API_KEY" \
  "https://<api-id>.execute-api.<region>.amazonaws.com/prod/api/monitoring/costs?days=30"

# Testar endpoint de pesos do ensemble
curl -H "X-Api-Key: $API_KEY" \
  "https://<api-id>.execute-api.<region>.amazonaws.com/prod/api/monitoring/ensemble-weights?days=30"
```

**Validações:**
- ✅ Todos os endpoints retornam 200 OK
- ✅ Dados no formato JSON correto
- ✅ Campos obrigatórios presentes
- ✅ Sem erros de autenticação

#### 2. Configurar API Key no Dashboard

```bash
# Editar arquivo .env.local do dashboard
cd dashboard
echo "REACT_APP_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod" > .env.local
echo "REACT_APP_API_KEY=$API_KEY" >> .env.local
```

#### 3. Buildar e Servir Dashboard

```bash
# Instalar dependências
npm install

# Buildar para produção
npm run build

# Servir localmente para teste
npx serve -s build -p 3000
```

#### 4. Testar Aba de Recomendações

**Abrir**: http://localhost:3000

**Validações:**
- ✅ Aba "Recomendações" carrega sem erros
- ✅ KPIs exibidos:
  - Total de ações recomendadas
  - Retorno médio esperado
  - Score médio de confiança
- ✅ Tabela de recomendações exibida com:
  - 50 linhas (top recomendações)
  - Ordenação funcional
  - Paginação (se > 100 linhas)
- ✅ Gráfico de distribuição de retornos exibido
- ✅ Modal de detalhes abre ao clicar em ticker
- ✅ Contribuições dos 4 modelos exibidas no modal

#### 5. Testar Aba de Monitoramento

**Clicar**: Aba "Monitoramento"

**Validações:**
- ✅ Aba carrega sem erros
- ✅ Painel de Qualidade de Dados exibido:
  - Status da última ingestão
  - Score de qualidade
  - Gráfico de evolução (30 dias)
- ✅ Painel de Performance do Modelo exibido:
  - 5 métricas principais (MAPE, Acurácia, MAE, Sharpe, Taxa de Acerto)
  - Gráfico de evolução do MAPE
- ✅ Painel de Drift exibido:
  - Alerta visual (verde/amarelo/vermelho)
  - Lista de features com drift
  - Timeline de eventos
  - Gráfico de pesos do ensemble

#### 6. Testar Aba de Custos

**Clicar**: Aba "Custos"

**Validações:**
- ✅ Aba carrega sem erros
- ✅ Resumo de Custos exibido:
  - Custo total do mês
  - Projeção mensal
  - % do limite (R$500)
  - Alerta visual (verde/amarelo/vermelho)
  - Barra de progresso
- ✅ Gráfico de pizza por serviço exibido
- ✅ Gráfico de evolução diária exibido
- ✅ Tabela detalhada exibida:
  - Custos por componente
  - Custo por recomendação
  - Tendências
  - Anomalias

#### 7. Testar Features Globais

**Validações:**
- ✅ Auto-refresh funciona (5 minutos)
- ✅ Indicador visual de atualização exibido
- ✅ Botão de refresh manual funciona
- ✅ Timestamp de última atualização exibido no footer
- ✅ Formato correto: dd/MM/yyyy HH:mm:ss
- ✅ Troca de aba instantânea (< 1 segundo)
- ✅ Dados em cache preservados entre trocas
- ✅ Error handling funciona:
  - Banner de erro exibido quando falha
  - Dados anteriores preservados
  - Retry manual disponível

#### 8. Testar Performance

**Validações:**
- ✅ Carregamento inicial < 2 segundos (Req 20.3)
- ✅ Troca de aba < 1 segundo (Req 20.4)
- ✅ Lazy loading funciona (apenas aba ativa carrega)
- ✅ Cache funciona (4 minutos)
- ✅ Sem re-fetch desnecessário

### Checklist de Validação - Task 20.5

- [ ] Dashboard API endpoints funcionando
- [ ] API Key configurada corretamente
- [ ] Dashboard buildado e servido
- [ ] Aba de Recomendações funcional
- [ ] Aba de Monitoramento funcional
- [ ] Aba de Custos funcional
- [ ] Auto-refresh funciona (5 minutos)
- [ ] Refresh manual funciona
- [ ] Timestamp exibido corretamente
- [ ] Troca de aba instantânea
- [ ] Error handling funciona
- [ ] Performance dentro dos requisitos

---

## Resumo de Validação

### Task 20.2 - Fluxo de Ingestão
- [ ] Ingest Lambda → Dados no S3 → Data Quality Lambda
- [ ] Lineage tracking funcionando
- [ ] Métricas de latência registradas
- [ ] Logs sem erros críticos

### Task 20.3 - Fluxo de Recomendações
- [ ] Rank Lambda → Recomendações no S3
- [ ] Performance Monitor → Métricas calculadas
- [ ] Drift Monitor → Drift detectado
- [ ] Pesos do ensemble registrados

### Task 20.4 - Fluxo de Monitoramento
- [ ] Cost Monitor → Custos coletados
- [ ] Projeção mensal calculada
- [ ] Alertas gerados quando necessário

### Task 20.5 - Dashboard
- [ ] 3 abas funcionais
- [ ] Dados carregados corretamente
- [ ] Auto-refresh funciona
- [ ] Performance dentro dos requisitos

---

## Próximos Passos

Após completar todas as validações acima:

1. Marcar Tasks 20.2, 20.3, 20.4, 20.5 como completed
2. Prosseguir para Task 21: Documentação e Finalização
3. Executar Task 22: Final Checkpoint

