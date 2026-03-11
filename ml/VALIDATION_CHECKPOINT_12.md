# Checkpoint 12 - Validação de Monitoramento de Custos

Este documento descreve como validar o monitoramento de custos implementado na Task 11.

## Componente Implementado

### Task 11: Cost Monitoring
- **Lambda**: `monitor_costs.py`
- **Schedule**: Diário às 21:00 BRT (00:00 UTC do dia seguinte)
- **Outputs**:
  - `monitoring/costs/dt={date}/costs_{time}.json`
- **Funcionalidades**:
  - Coleta de custos via AWS Cost Explorer API
  - Cálculo de custos por serviço (Lambda, S3, SageMaker, CloudWatch)
  - Cálculo de custos por componente (training, inference, storage, compute, monitoring)
  - Projeção mensal baseada em últimos 7 dias
  - Alertas quando projeção > R$500 (crítico) ou > R$400 (warning)
  - Cálculo de custo por recomendação
  - Detecção de anomalias (aumento > 50% vs média de 7 dias)

## Validações

### 1. Validar Cost Monitor Lambda

**Objetivo**: Verificar que custos são coletados e calculados corretamente.

**Comandos**:
```bash
# 1. Invocar Lambda manualmente
aws lambda invoke \
  --function-name <STACK_NAME>-MonitorCosts-<ID> \
  --payload '{}' \
  /tmp/costs_response.json

# 2. Ver resultado
cat /tmp/costs_response.json | jq .

# 3. Verificar arquivo no S3
TODAY=$(date +%Y-%m-%d)
aws s3 ls s3://<BUCKET>/monitoring/costs/dt=${TODAY}/ --recursive

# 4. Baixar e inspecionar relatório
aws s3 cp s3://<BUCKET>/monitoring/costs/dt=${TODAY}/ . --recursive
cat costs_*.json | jq .
```

**Critérios de Sucesso**:
- ✅ Lambda executa sem erros (`ok: true`)
- ✅ Arquivo salvo em `monitoring/costs/dt={date}/`
- ✅ JSON contém todas as seções obrigatórias:
  - `timestamp`: ISO timestamp
  - `date`: data do relatório
  - `period`: período analisado (últimos 7 dias)
  - `costs_by_service`: custos por serviço AWS
  - `costs_by_component`: custos por componente (training, inference, storage, compute, monitoring)
  - `total_7_days`: total dos últimos 7 dias (USD e BRL)
  - `monthly_projection`: projeção mensal (USD e BRL)
  - `threshold`: informações sobre limite de custo
  - `recommendations`: custo por recomendação
  - `anomalies`: lista de anomalias detectadas
  - `exchange_rate`: taxa de câmbio USD/BRL
- ✅ CloudWatch Metrics publicadas: `TotalCostUSD`, `MonthlyProjectionBRL`, `CostPerRecommendationBRL`, `CostThresholdExceeded`, `CostAnomaliesDetected`

**Exemplo de Output Esperado**:
```json
{
  "timestamp": "2026-03-10T00:00:00Z",
  "date": "2026-03-10",
  "period": {
    "start_date": "2026-03-03",
    "end_date": "2026-03-10",
    "days": 7
  },
  "costs_by_service": {
    "AWS Lambda": 2.50,
    "Amazon Simple Storage Service": 1.20,
    "Amazon SageMaker": 15.00,
    "AmazonCloudWatch": 0.80
  },
  "costs_by_component": {
    "training": 7.50,
    "inference": 7.50,
    "storage": 1.20,
    "compute": 2.50,
    "monitoring": 0.80,
    "other": 0.00
  },
  "total_7_days": {
    "usd": 19.50,
    "brl": 97.50
  },
  "monthly_projection": {
    "usd": 83.57,
    "brl": 417.85
  },
  "threshold": {
    "limit_brl": 500.0,
    "exceeded": false,
    "warning": true,
    "percentage": 83.57,
    "alert_level": "warning"
  },
  "recommendations": {
    "count": 50,
    "cost_per_recommendation_usd": 1.67,
    "cost_per_recommendation_brl": 8.36
  },
  "anomalies": [],
  "exchange_rate": 5.0
}
```

---

### 2. Validar Coleta de Custos por Serviço

**Objetivo**: Verificar que custos são coletados de todos os serviços AWS.

**Comandos**:
```bash
# 1. Verificar custos no Cost Explorer diretamente
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  | jq '.ResultsByTime[].Groups[] | {service: .Keys[0], cost: .Metrics.UnblendedCost.Amount}'

# 2. Comparar com relatório da Lambda
cat costs_*.json | jq '.costs_by_service'
```

**Critérios de Sucesso**:
- ✅ Custos coletados para Lambda, S3, SageMaker, CloudWatch
- ✅ Valores consistentes com Cost Explorer
- ✅ Custos em USD (moeda padrão do Cost Explorer)

---

### 3. Validar Categorização por Componente

**Objetivo**: Verificar que custos são categorizados corretamente.

**Comandos**:
```bash
# Verificar categorização no relatório
cat costs_*.json | jq '.costs_by_component'
```

**Critérios de Sucesso**:
- ✅ 5 componentes principais: `training`, `inference`, `storage`, `compute`, `monitoring`
- ✅ SageMaker dividido entre training e inference
- ✅ Lambda mapeado para compute
- ✅ S3 mapeado para storage
- ✅ CloudWatch mapeado para monitoring
- ✅ Soma dos componentes = total de custos

---

### 4. Validar Projeção Mensal

**Objetivo**: Verificar que projeção mensal é calculada corretamente.

**Comandos**:
```bash
# Verificar cálculo de projeção
cat costs_*.json | jq '{
  total_7_days: .total_7_days.usd,
  daily_average: (.total_7_days.usd / 7),
  monthly_projection: .monthly_projection.usd,
  expected_projection: ((.total_7_days.usd / 7) * 30)
}'
```

**Critérios de Sucesso**:
- ✅ Projeção mensal = (total_7_days / 7) * 30
- ✅ Valores em USD e BRL
- ✅ Taxa de câmbio aplicada corretamente (USD * 5.0 = BRL)

---

### 5. Validar Alertas de Threshold

**Objetivo**: Verificar que alertas são gerados quando projeção ultrapassa limites.

**Comandos**:
```bash
# Verificar threshold no relatório
cat costs_*.json | jq '.threshold'
```

**Critérios de Sucesso**:
- ✅ `limit_brl` = 500.0 (R$500)
- ✅ `exceeded` = true quando projeção > R$500
- ✅ `warning` = true quando projeção > R$400 (80% do limite)
- ✅ `percentage` calculado corretamente: (projeção / limite) * 100
- ✅ `alert_level`:
  - `"critical"` quando exceeded = true
  - `"warning"` quando warning = true
  - `null` quando abaixo de 80%

**Exemplo de Alerta Crítico**:
```json
{
  "threshold": {
    "limit_brl": 500.0,
    "exceeded": true,
    "warning": true,
    "percentage": 110.5,
    "alert_level": "critical"
  }
}
```

---

### 6. Validar Custo por Recomendação

**Objetivo**: Verificar que custo por recomendação é calculado corretamente.

**Comandos**:
```bash
# Verificar cálculo
cat costs_*.json | jq '{
  monthly_projection: .monthly_projection.usd,
  num_recommendations: .recommendations.count,
  cost_per_recommendation: .recommendations.cost_per_recommendation_usd,
  expected: (.monthly_projection.usd / .recommendations.count)
}'
```

**Critérios de Sucesso**:
- ✅ `count` = número de recomendações geradas hoje
- ✅ `cost_per_recommendation_usd` = monthly_projection / count
- ✅ `cost_per_recommendation_brl` = cost_per_recommendation_usd * exchange_rate
- ✅ Se count = 0, cost_per_recommendation = 0 (sem divisão por zero)

---

### 7. Validar Detecção de Anomalias

**Objetivo**: Verificar que anomalias de custo são detectadas corretamente.

**Comandos**:
```bash
# Verificar anomalias no relatório
cat costs_*.json | jq '.anomalies'
```

**Critérios de Sucesso**:
- ✅ Anomalia detectada quando custo de um serviço aumenta > 50% vs média de 7 dias
- ✅ Cada anomalia contém:
  - `service`: nome do serviço AWS
  - `current_cost_usd`: custo atual
  - `average_cost_usd`: média dos últimos 7 dias
  - `change_percentage`: mudança percentual
  - `severity`: "critical" (> 100%) ou "warning" (> 50%)
- ✅ Array vazio quando não há anomalias

**Exemplo de Anomalia**:
```json
{
  "anomalies": [
    {
      "service": "Amazon SageMaker",
      "current_cost_usd": 30.0,
      "average_cost_usd": 15.0,
      "change_percentage": 100.0,
      "severity": "critical"
    }
  ]
}
```

---

### 8. Validar CloudWatch Metrics

**Objetivo**: Verificar que métricas são publicadas no CloudWatch.

**Comandos**:
```bash
# 1. Verificar métrica de custo total
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name TotalCostUSD \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# 2. Verificar métrica de projeção mensal
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name MonthlyProjectionBRL \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# 3. Verificar métrica de threshold excedido
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name CostThresholdExceeded \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# 4. Verificar métrica de anomalias
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name CostAnomaliesDetected \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

**Critérios de Sucesso**:
- ✅ Métricas publicadas: `TotalCostUSD`, `MonthlyProjectionBRL`, `CostPerRecommendationBRL`, `CostThresholdExceeded`, `CostAnomaliesDetected`
- ✅ Valores consistentes com relatório JSON no S3
- ✅ Namespace correto: `B3TR`

---

### 9. Validar EventBridge Schedule

**Objetivo**: Verificar que schedule está configurado corretamente.

**Comandos**:
```bash
# 1. Ver detalhes do schedule
aws events describe-rule --name <STACK_NAME>-MonitorCostsDaily-<ID>

# 2. Ver targets da rule
aws events list-targets-by-rule --rule <STACK_NAME>-MonitorCostsDaily-<ID>
```

**Critérios de Sucesso**:
- ✅ Rule existe com schedule `cron(0 0 * * ? *)` (21:00 BRT = 00:00 UTC do dia seguinte)
- ✅ Target aponta para Lambda `monitor_costs.py`
- ✅ Rule está habilitada (`State: ENABLED`)
- ✅ Executa diariamente (todos os dias da semana)

---

## Checklist Final

Antes de prosseguir para a Task 13, verifique:

- [ ] Cost Monitor Lambda executa sem erros
- [ ] Custos coletados de todos os serviços (Lambda, S3, SageMaker, CloudWatch)
- [ ] Custos categorizados por componente (training, inference, storage, compute, monitoring)
- [ ] Projeção mensal calculada corretamente: (total_7_days / 7) * 30
- [ ] Alerta crítico gerado quando projeção > R$500
- [ ] Alerta warning gerado quando projeção > R$400 (80% do limite)
- [ ] Custo por recomendação calculado corretamente
- [ ] Anomalias detectadas quando custo aumenta > 50% vs média de 7 dias
- [ ] Relatórios salvos no S3 com estrutura correta
- [ ] CloudWatch Metrics publicadas corretamente
- [ ] EventBridge schedule configurado para 21:00 BRT (00:00 UTC)
- [ ] Logs no CloudWatch não mostram erros críticos

## Troubleshooting

### Cost Explorer retorna erro de permissão

**Problema**: Lambda retorna erro "AccessDeniedException" ao chamar Cost Explorer.

**Solução**:
1. Verificar permissões IAM da Lambda
2. Adicionar policy `ce:GetCostAndUsage` e `ce:GetCostForecast`
3. Aguardar alguns minutos para propagação de permissões

### Custos aparecem como zero

**Problema**: Todos os custos aparecem como $0.00.

**Solução**:
1. Verificar se Cost Explorer está habilitado na conta AWS
2. Aguardar 24 horas após habilitar (dados levam tempo para aparecer)
3. Verificar se há recursos ativos gerando custos
4. Verificar período de consulta (últimos 7 dias)

### Projeção mensal incorreta

**Problema**: Projeção mensal não bate com cálculo manual.

**Solução**:
1. Verificar fórmula: (total_7_days / 7) * 30
2. Verificar se total_7_days está correto
3. Verificar taxa de câmbio (USD_TO_BRL = 5.0)
4. Verificar logs da Lambda para erros de cálculo

### Anomalias não são detectadas

**Problema**: Custos aumentaram mas nenhuma anomalia foi detectada.

**Solução**:
1. Verificar se há pelo menos 3 dias de histórico
2. Verificar se aumento foi > 50% vs média
3. Verificar logs da Lambda para erros ao carregar histórico
4. Verificar estrutura de pastas: `monitoring/costs/dt={date}/`

### CloudWatch Metrics não aparecem

**Problema**: Métricas não são visíveis no CloudWatch.

**Solução**:
1. Verificar permissões IAM (`cloudwatch:PutMetricData`)
2. Verificar logs da Lambda para erros ao publicar métricas
3. Aguardar alguns minutos (métricas podem ter delay)
4. Verificar namespace correto: `B3TR`

---

## Próximos Passos

Após validar todos os itens acima, você está pronto para:
- **Task 13**: Implementar Dashboard API
- **Task 14-18**: Implementar React Dashboard
- **Task 19**: Checkpoint - Validar dashboard completo

---

**Data de Criação**: 2026-03-10  
**Última Atualização**: 2026-03-10
