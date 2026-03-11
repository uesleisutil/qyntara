# Checkpoint 10 - Validação de Monitoramento de Modelo

Este documento descreve como validar o monitoramento de modelo implementado nas Tasks 7, 8 e 9.

## Componentes Implementados

### Task 7: Model Ensemble - Geração de Recomendações
- **Lambda**: `rank.py` (ou `rank_sagemaker.py`)
- **Schedule**: Diário às 18:30 BRT (21:30 UTC)
- **Outputs**:
  - `recommendations/dt={date}/recommendations_{time}.json`
  - `monitoring/ensemble_weights/dt={date}/weights_{time}.json`

### Task 8: Performance Monitoring
- **Lambda**: `performance_monitor.py`
- **Schedule**: Diário às 20:00 BRT (23:00 UTC)
- **Outputs**:
  - `monitoring/performance/dt={date}/performance_{time}.json`
- **Métricas**: MAPE, Acurácia Direcional, MAE, Sharpe Ratio, Taxa de Acerto

### Task 9: Drift Detection
- **Lambda**: `monitor_drift.py`
- **Schedule**: Diário às 20:30 BRT (23:30 UTC)
- **Outputs**:
  - `monitoring/drift/dt={date}/drift_{time}.json`
  - `monitoring/retrain_recommendations/dt={date}/retrain_{time}.json` (quando necessário)

## Validações

### 1. Validar Performance Monitor Lambda

**Objetivo**: Verificar que métricas de performance são calculadas corretamente.

**Comandos**:
```bash
# 1. Invocar Lambda manualmente
aws lambda invoke \
  --function-name <STACK_NAME>-MonitorModelPerformance-<ID> \
  --payload '{}' \
  /tmp/performance_response.json

# 2. Ver resultado
cat /tmp/performance_response.json | jq .

# 3. Verificar arquivo no S3
TODAY=$(date +%Y-%m-%d)
aws s3 ls s3://<BUCKET>/monitoring/performance/dt=${TODAY}/ --recursive

# 4. Baixar e inspecionar métricas
aws s3 cp s3://<BUCKET>/monitoring/performance/dt=${TODAY}/ . --recursive
cat performance_*.json | jq .
```

**Critérios de Sucesso**:
- ✅ Lambda executa sem erros (`ok: true`)
- ✅ Arquivo salvo em `monitoring/performance/dt={date}/`
- ✅ JSON contém 5 métricas: `mape`, `directional_accuracy`, `mae`, `sharpe_ratio`, `hit_rate`
- ✅ Valores das métricas são numéricos e razoáveis (MAPE < 100%, acurácia entre 0-100%)
- ✅ CloudWatch Metrics publicadas: `ModelMAPE`, `DirectionalAccuracy`, `MAE`, `SharpeRatio`, `HitRate`

**Exemplo de Output Esperado**:
```json
{
  "timestamp": "2026-03-10T23:00:00Z",
  "date": "2026-03-10",
  "prediction_date": "2026-02-18",
  "actual_date": "2026-03-10",
  "mape": 12.5,
  "directional_accuracy": 65.0,
  "mae": 2.3,
  "sharpe_ratio": 1.2,
  "hit_rate": 58.0,
  "num_predictions": 50
}
```

---

### 2. Validar Drift Monitor Lambda

**Objetivo**: Verificar que drift de performance e features é detectado corretamente.

**Comandos**:
```bash
# 1. Invocar Lambda manualmente
aws lambda invoke \
  --function-name <STACK_NAME>-MonitorDrift-<ID> \
  --payload '{}' \
  /tmp/drift_response.json

# 2. Ver resultado
cat /tmp/drift_response.json | jq .

# 3. Verificar arquivo no S3
TODAY=$(date +%Y-%m-%d)
aws s3 ls s3://<BUCKET>/monitoring/drift/dt=${TODAY}/ --recursive

# 4. Baixar e inspecionar relatório de drift
aws s3 cp s3://<BUCKET>/monitoring/drift/dt=${TODAY}/ . --recursive
cat drift_*.json | jq .

# 5. Verificar se recomendação de retreinamento foi gerada (se aplicável)
aws s3 ls s3://<BUCKET>/monitoring/retrain_recommendations/dt=${TODAY}/ --recursive
```

**Critérios de Sucesso**:
- ✅ Lambda executa sem erros (`ok: true`)
- ✅ Arquivo salvo em `monitoring/drift/dt={date}/`
- ✅ JSON contém:
  - `drift_detected`: boolean
  - `drift_score`: número entre 0-1
  - `performance_drift`: boolean
  - `feature_drift_count`: número
  - `baseline_mape`: número
  - `current_mape`: número
  - `mape_change_percentage`: número
  - `features_drift`: objeto com scores por feature
  - `drifted_features`: array de features com drift
  - `drift_events`: array de eventos
  - `retrain_recommended`: boolean
  - `retrain_reason`: string (se retrain_recommended = true)
- ✅ CloudWatch Metrics publicadas: `DriftDetected`, `DriftScore`, `FeatureDriftCount`, `RetrainRecommended`

**Exemplo de Output Esperado (sem drift)**:
```json
{
  "timestamp": "2026-03-10T23:30:00Z",
  "date": "2026-03-10",
  "drift_detected": false,
  "drift_score": 0.15,
  "performance_drift": false,
  "feature_drift_count": 0,
  "baseline_mape": 12.0,
  "current_mape": 12.5,
  "mape_change_percentage": 4.2,
  "features_drift": {
    "confidence_score": 0.1,
    "expected_return": 0.15
  },
  "drifted_features": [
    {
      "feature": "confidence_score",
      "drift_score": 0.1,
      "status": "stable"
    },
    {
      "feature": "expected_return",
      "drift_score": 0.15,
      "status": "stable"
    }
  ],
  "drift_events": [],
  "retrain_recommended": false,
  "retrain_reason": null
}
```

**Exemplo de Output Esperado (com drift crítico)**:
```json
{
  "timestamp": "2026-03-10T23:30:00Z",
  "date": "2026-03-10",
  "drift_detected": true,
  "drift_score": 0.65,
  "performance_drift": true,
  "feature_drift_count": 1,
  "baseline_mape": 12.0,
  "current_mape": 22.5,
  "mape_change_percentage": 87.5,
  "features_drift": {
    "confidence_score": 0.45,
    "expected_return": 0.2
  },
  "drifted_features": [
    {
      "feature": "confidence_score",
      "drift_score": 0.45,
      "status": "drifted"
    },
    {
      "feature": "expected_return",
      "drift_score": 0.2,
      "status": "stable"
    }
  ],
  "drift_events": [
    {
      "date": "2026-03-10",
      "type": "performance_drift",
      "description": "MAPE aumentou 87.5%",
      "severity": "critical"
    }
  ],
  "retrain_recommended": true,
  "retrain_reason": "MAPE acima de 20% (22.50%); Drift score crítico (0.65)"
}
```

---

### 3. Validar Recomendações de Retreinamento

**Objetivo**: Verificar que recomendações de retreinamento são geradas quando necessário.

**Comandos**:
```bash
# 1. Verificar se existem recomendações de retreinamento
TODAY=$(date +%Y-%m-%d)
aws s3 ls s3://<BUCKET>/monitoring/retrain_recommendations/dt=${TODAY}/ --recursive

# 2. Baixar e inspecionar recomendação
aws s3 cp s3://<BUCKET>/monitoring/retrain_recommendations/dt=${TODAY}/ . --recursive
cat retrain_*.json | jq .
```

**Critérios de Sucesso**:
- ✅ Arquivo criado apenas quando `retrain_recommended = true`
- ✅ JSON contém:
  - `timestamp`: ISO timestamp
  - `date`: data da recomendação
  - `current_metrics`: objeto com MAPE, drift_score, feature_drift_count
  - `baseline_metrics`: objeto com MAPE baseline
  - `drift_score`: número entre 0-1
  - `retrain_command`: comando AWS CLI para retreinar
  - `reason`: justificativa detalhada
- ✅ Justificativa menciona pelo menos uma das condições:
  - MAPE > 20%
  - Drift score > 0.5
  - > 30% das features com drift

**Exemplo de Output Esperado**:
```json
{
  "timestamp": "2026-03-10T23:30:00Z",
  "date": "2026-03-10",
  "current_metrics": {
    "mape": 22.5,
    "drift_score": 0.65,
    "feature_drift_count": 1
  },
  "baseline_metrics": {
    "mape": 12.0
  },
  "drift_score": 0.65,
  "retrain_command": "aws sagemaker create-training-job --training-job-name b3tr-retrain-20260310",
  "reason": "MAPE acima de 20% (22.50%); Drift score crítico (0.65)"
}
```

---

### 4. Validar CloudWatch Metrics

**Objetivo**: Verificar que métricas são publicadas no CloudWatch.

**Comandos**:
```bash
# 1. Verificar métricas de performance
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name ModelMAPE \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# 2. Verificar métricas de drift
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name DriftScore \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# 3. Verificar métrica de recomendação de retreinamento
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name RetrainRecommended \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**Critérios de Sucesso**:
- ✅ Métricas de performance publicadas: `ModelMAPE`, `DirectionalAccuracy`, `MAE`, `SharpeRatio`, `HitRate`
- ✅ Métricas de drift publicadas: `DriftDetected`, `DriftScore`, `FeatureDriftCount`, `RetrainRecommended`
- ✅ Valores das métricas são consistentes com os arquivos JSON no S3

---

### 5. Validar EventBridge Schedules

**Objetivo**: Verificar que schedules estão configurados corretamente.

**Comandos**:
```bash
# 1. Listar todas as rules do EventBridge
aws events list-rules --name-prefix <STACK_NAME>

# 2. Ver detalhes do schedule de Performance Monitor
aws events describe-rule --name <STACK_NAME>-MonitorPerformanceDaily-<ID>

# 3. Ver detalhes do schedule de Drift Monitor
aws events describe-rule --name <STACK_NAME>-MonitorDriftDaily-<ID>

# 4. Ver targets das rules
aws events list-targets-by-rule --rule <STACK_NAME>-MonitorPerformanceDaily-<ID>
aws events list-targets-by-rule --rule <STACK_NAME>-MonitorDriftDaily-<ID>
```

**Critérios de Sucesso**:
- ✅ Rule `MonitorPerformanceDaily` existe com schedule `cron(0 23 ? * MON-FRI *)` (20:00 BRT)
- ✅ Rule `MonitorDriftDaily` existe com schedule `cron(30 23 ? * MON-FRI *)` (20:30 BRT)
- ✅ Ambas as rules têm target apontando para as Lambdas corretas
- ✅ Rules estão habilitadas (`State: ENABLED`)

---

## Checklist Final

Antes de prosseguir para a Task 11, verifique:

- [ ] Performance Monitor Lambda executa sem erros
- [ ] Métricas de performance são salvas no S3 com estrutura correta
- [ ] 5 métricas são calculadas: MAPE, Acurácia Direcional, MAE, Sharpe Ratio, Taxa de Acerto
- [ ] Drift Monitor Lambda executa sem erros
- [ ] Relatórios de drift são salvos no S3 com estrutura correta
- [ ] Drift de performance é detectado quando MAPE aumenta > 50%
- [ ] Drift de features é detectado quando > 30% das features apresentam drift
- [ ] Recomendações de retreinamento são geradas quando:
  - MAPE > 20% OU
  - Drift score > 0.5 OU
  - > 30% das features com drift
- [ ] Recomendações incluem comando AWS CLI e justificativa detalhada
- [ ] CloudWatch Metrics são publicadas corretamente
- [ ] EventBridge schedules estão configurados com horários corretos
- [ ] Logs no CloudWatch não mostram erros críticos

## Troubleshooting

### Performance Monitor não encontra predições de 20 dias atrás

**Problema**: Lambda retorna erro "No predictions found for date X".

**Solução**:
1. Verificar se Rank Lambda executou há 20 dias
2. Verificar estrutura de pastas: `recommendations/dt={date}/`
3. Executar Rank Lambda manualmente para gerar predições

### Drift Monitor não encontra métricas de performance

**Problema**: Lambda retorna erro "Insufficient metrics for drift detection".

**Solução**:
1. Verificar se Performance Monitor Lambda executou nos últimos 10 dias
2. Verificar estrutura de pastas: `monitoring/performance/dt={date}/`
3. Executar Performance Monitor Lambda manualmente para gerar métricas

### Recomendação de retreinamento não é gerada

**Problema**: Drift detectado mas arquivo `retrain_*.json` não é criado.

**Solução**:
1. Verificar logs do Drift Monitor Lambda
2. Verificar se condições de retreinamento foram atendidas:
   - MAPE > 20%
   - Drift score > 0.5
   - > 30% das features com drift
3. Verificar permissões S3 da Lambda

### CloudWatch Metrics não aparecem

**Problema**: Métricas não são visíveis no CloudWatch.

**Solução**:
1. Verificar permissões IAM da Lambda (`cloudwatch:PutMetricData`)
2. Verificar logs da Lambda para erros ao publicar métricas
3. Aguardar alguns minutos (métricas podem ter delay)
4. Verificar namespace correto: `B3TR`

---

## Próximos Passos

Após validar todos os itens acima, você está pronto para:
- **Task 11**: Implementar Cost Monitoring
- **Task 12**: Checkpoint - Validar monitoramento de custos
- **Task 13**: Implementar Dashboard API

---

**Data de Criação**: 2026-03-10  
**Última Atualização**: 2026-03-10
