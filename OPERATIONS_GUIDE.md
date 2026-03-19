# Guia de Operações - B3 Tactical Ranking MLOps System

**Versão**: 4.0.0  
**Data**: 2026-03-15  
**Status**: 📋 PRODUÇÃO

## Visão Geral

Este guia fornece instruções para operação diária, monitoramento, resposta a alertas, segurança, cache, CDN e disaster recovery do sistema ML Monitoring, Governance & Dashboard da B3. O sistema inclui 8 abas de dashboard (Recommendations, Performance, Validation, Costs, Data Quality, Drift Detection, Explainability, Backtesting), infraestrutura com 5 CDK stacks (InfraStack, MonitoringStack, SecurityStack, OptimizationStack, DisasterRecoveryStack), ElastiCache Redis, CloudFront CDN e backups cross-region.

---

## Índice

1. [Operações Diárias](#1-operações-diárias)
2. [Monitoramento do Dashboard (8 Abas)](#2-monitoramento-do-dashboard-8-abas)
3. [Operações de Data Quality](#3-operações-de-data-quality)
4. [Operações de Drift Detection](#4-operações-de-drift-detection)
5. [Operações de Segurança](#5-operações-de-segurança)
6. [Gerenciamento de Cache (ElastiCache)](#6-gerenciamento-de-cache-elasticache)
7. [Gerenciamento de CDN (CloudFront)](#7-gerenciamento-de-cdn-cloudfront)
8. [Monitoramento Contínuo](#8-monitoramento-contínuo)
9. [Interpretação de Alertas](#9-interpretação-de-alertas)
10. [Resposta a Incidentes](#10-resposta-a-incidentes)
11. [Disaster Recovery](#11-disaster-recovery)
12. [Manutenção Programada](#12-manutenção-programada)
13. [Monitoramento de Custos](#13-monitoramento-de-custos)
14. [Backup e Recuperação](#14-backup-e-recuperação)
15. [Contatos e Escalação](#15-contatos-e-escalação)
16. [Referências Rápidas](#16-referências-rápidas)

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

# 2. Verificar alarms ativos (todos os stacks)
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --alarm-name-prefix B3Dashboard

# 3. Verificar últimas recomendações geradas
aws s3 ls s3://$BUCKET_NAME/recommendations/dt=$(date -d '1 day ago' +%Y-%m-%d)/ --recursive

# 4. Verificar completude de dados de ontem
aws s3 cp s3://$BUCKET_NAME/monitoring/completeness/dt=$(date -d '1 day ago' +%Y-%m-%d)/completeness_*.json - | jq '.completeness_percentage'

# 5. Verificar data quality score
aws s3 cp s3://$BUCKET_NAME/monitoring/data_quality/dt=$(date -d '1 day ago' +%Y-%m-%d)/quality_*.json - | jq '{completeness, quality_score, anomaly_count}'

# 6. Verificar drift detection
aws s3 cp s3://$BUCKET_NAME/monitoring/drift/dt=$(date -d '1 day ago' +%Y-%m-%d)/drift_*.json - | jq '{drift_detected, drift_score, features_drifted_count}'

# 7. Verificar cache hit rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CacheHitRate \
  --dimensions Name=CacheClusterId,Value=b3-dashboard-cache \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average

# 8. Verificar DR health check
aws s3 cp s3://b3tr-backup-$ACCOUNT_ID-us-west-2/health/latest.json - | jq '{status, last_backup, backup_age_hours}'
```

**Ações esperadas:**
- ✅ IngestionOK = 1 nas últimas 24h
- ✅ Nenhum alarm ativo
- ✅ Recomendações de ontem geradas
- ✅ Completude > 90%
- ✅ Data quality score > 90%
- ✅ Drift score < 0.5
- ✅ Cache hit rate > 70%
- ✅ DR health check OK

### 1.2 Checklist Pós-Pregão (18:00 BRT)

```bash
# 1. Verificar ingestão do dia
aws s3 ls s3://$BUCKET_NAME/quotes_5m/dt=$(date +%Y-%m-%d)/ --recursive | wc -l

# 2. Verificar qualidade dos dados
aws s3 cp s3://$BUCKET_NAME/monitoring/data_quality/dt=$(date +%Y-%m-%d)/quality_*.json - | jq '{completeness, quality_score, validation_errors_count}'

# 3. Verificar anomalias detectadas
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/anomalies.json - | jq '.anomaly_count, .high_severity_count'

# 4. Verificar freshness dos dados
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/freshness.json - | jq '.sources[] | {source: .source, age_hours: .age, status: .status}'

# 5. Aguardar geração de recomendações (18:30 BRT)
aws s3 ls s3://$BUCKET_NAME/recommendations/dt=$(date +%Y-%m-%d)/ --recursive
```

**Ações esperadas:**
- ✅ Dados de cotações salvos (> 500 arquivos)
- ✅ Qualidade > 90%
- ✅ Zero anomalias de alta severidade
- ✅ Todos os data sources com status "current"
- ✅ Recomendações geradas às 18:30 BRT

### 1.3 Checklist Noturno (21:00 BRT)

```bash
# 1. Verificar custos do dia
aws s3 cp s3://$BUCKET_NAME/monitoring/costs/dt=$(date +%Y-%m-%d)/costs_*.json - | jq '{total_cost, monthly_projection, alert_generated}'

# 2. Verificar drift detectado
aws s3 cp s3://$BUCKET_NAME/monitoring/drift/dt=$(date +%Y-%m-%d)/drift_*.json - | jq '{drift_detected, drift_score, retrain_recommended}'

# 3. Verificar performance do modelo
aws s3 cp s3://$BUCKET_NAME/monitoring/performance/dt=$(date +%Y-%m-%d)/performance_*.json - | jq '{mape, directional_accuracy, sharpe_ratio}'

# 4. Verificar explainability (SHAP values gerados)
aws s3 ls s3://$BUCKET_NAME/explainability/$(date +%Y-%m-%d)/ --recursive | wc -l

# 5. Verificar backups cross-region
aws s3 ls s3://b3tr-backup-$ACCOUNT_ID-us-west-2/backups/$(date +%Y-%m-%d)/ --recursive | wc -l

# 6. Verificar security audit logs
aws dynamodb query \
  --table-name B3Dashboard-AuthLogs \
  --index-name TimestampIndex \
  --key-condition-expression "#ts > :today" \
  --expression-attribute-names '{"#ts":"timestamp"}' \
  --expression-attribute-values '{":today":{"S":"'"$(date +%Y-%m-%d)"'"}}' \
  --select COUNT
```

**Ações esperadas:**
- ✅ Custos dentro do limite (< R$500/mês projetado)
- ✅ Drift monitorado
- ✅ Performance do modelo aceitável (MAPE < 20%)
- ✅ SHAP values gerados para todas as recomendações
- ✅ Backup cross-region executado
- ✅ Nenhuma tentativa de autenticação suspeita

---

## 2. Monitoramento do Dashboard (8 Abas)

### 2.1 Dashboard Web

**Acessar**: https://uesleisutil.github.io/b3-tactical-ranking

**Verificações por aba:**

| Aba | O que verificar | Frequência |
|-----|----------------|------------|
| **Recommendations** | Top 50 ações exibidas, filtros funcionando, export operacional | Diário |
| **Performance** | MAPE < 20%, Sharpe > 0.5, confusion matrix atualizada | Diário |
| **Validation** | Scatter plot atualizado, outliers < 5%, temporal accuracy estável | Diário |
| **Costs** | Projeção mensal < budget, cost per prediction estável | Diário |
| **Data Quality** | Completude > 95%, zero anomalias high severity, freshness OK | Diário |
| **Drift Detection** | Drift score < 0.5, < 30% features drifted, sem degradação | Diário |
| **Explainability** | SHAP values disponíveis, top features consistentes | Semanal |
| **Backtesting** | Resultados de simulação coerentes, Sharpe > benchmark | Semanal |

### 2.2 CloudWatch Dashboards

**Dashboard principal**: Console AWS > CloudWatch > Dashboards > B3TR-AdvancedFeatures

**Métricas importantes por stack:**

**InfraStack:**
- Lambda Invocations, Errors, Duration
- IngestionOK, RecordsIngested
- DataCompleteness, DataQualityScore

**MonitoringStack:**
- APIResponseTime, APIErrors, ActiveUsers
- ModelMAPE, DirectionalAccuracy, SharpeRatio
- DriftScore, AnomalyCount

**SecurityStack:**
- AuthenticationAttempts (by type and success)
- RateLimitExceeded, CSRFValidationFailures
- APIKeyRotationNeeded

**OptimizationStack:**
- ElastiCache CPU, Memory, CacheHitRate
- CloudFront Requests, BytesDownloaded, ErrorRate
- StorageSizeGB, EstimatedMonthlyCost

**DisasterRecoveryStack:**
- BackupSuccess, BackupAge
- DRHealthCheck, PITRStatus

---

## 3. Operações de Data Quality

### 3.1 Monitoramento de Completude

```bash
# Ver completude por ticker
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/completeness.json - | \
  jq '.tickers[] | select(.rate < 95) | {ticker, rate, missing_features}'

# Ver completude geral
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/completeness.json - | \
  jq '{overall_rate, tickers_below_95: [.tickers[] | select(.rate < 95) | .ticker]}'

# Ver tendência de completude (últimos 7 dias)
for i in {0..6}; do
  date=$(date -d "$i days ago" +%Y-%m-%d)
  echo -n "$date: "
  aws s3 cp s3://$BUCKET_NAME/data_quality/$date/completeness.json - 2>/dev/null | jq -r '.overall_rate // "N/A"'
done
```

**Quando completude < 95%:**
1. Identificar tickers com dados faltantes
2. Verificar se tickers estão ativos na B3
3. Verificar API BRAPI para os tickers afetados
4. Atualizar `config/universe.txt` se necessário
5. Re-executar ingestão

### 3.2 Resposta a Anomalias

```bash
# Listar anomalias de alta severidade
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/anomalies.json - | \
  jq '.anomalies[] | select(.severity == "high") | {ticker, date, type, description}'

# Verificar gaps de dados
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/anomalies.json - | \
  jq '[.anomalies[] | select(.type == "gap")] | length'

# Verificar outliers (> 5 std devs)
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/anomalies.json - | \
  jq '[.anomalies[] | select(.type == "outlier")] | {count: length, tickers: [.[].ticker] | unique}'
```

**Ações corretivas para anomalias:**
- **Gaps**: Re-executar bootstrap para preencher dados faltantes
- **Outliers**: Verificar se são dados reais (ex: stock split) ou erros de API
- **Inconsistências**: Deletar dados inconsistentes e re-ingerir

### 3.3 Monitoramento de Freshness

```bash
# Ver freshness de todas as fontes
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/freshness.json - | \
  jq '.sources[] | {source, last_update, age_hours, status}'

# Verificar fontes com warning (> 24h)
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/freshness.json - | \
  jq '[.sources[] | select(.status == "warning" or .status == "critical")]'
```

**Quando freshness > 24h (warning):**
1. Verificar se a fonte de dados está operacional
2. Verificar logs da Lambda de ingestão correspondente
3. Executar ingestão manual se necessário

**Quando freshness > 48h (critical):**
1. Escalar para Engenheiro imediatamente
2. Verificar se há problema na API externa
3. Considerar usar dados cached enquanto resolve

### 3.4 Monitoramento de Coverage

```bash
# Ver cobertura do universo
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/coverage.json - | \
  jq '{universe_size, covered, excluded_count, coverage_rate}'

# Ver tickers excluídos e motivos
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/coverage.json - | \
  jq '.excluded_tickers[] | {ticker, reason}'
```

**Quando coverage < 90%:**
1. Revisar tickers excluídos e motivos
2. Atualizar `config/universe.txt` removendo tickers inativos
3. Adicionar novos tickers se necessário

---

## 4. Operações de Drift Detection

### 4.1 Resposta a Data Drift

```bash
# Ver features com drift (p-value < 0.05)
aws s3 cp s3://$BUCKET_NAME/monitoring/drift/dt=$(date +%Y-%m-%d)/drift_*.json - | \
  jq '.features_with_drift[] | {feature, ks_statistic, p_value, magnitude}'

# Ver percentual de features com drift
aws s3 cp s3://$BUCKET_NAME/monitoring/drift/dt=$(date +%Y-%m-%d)/drift_*.json - | \
  jq '{total_features, drifted_features, drift_percentage}'

# Ver tendência de drift (últimos 30 dias)
for i in {0..29}; do
  date=$(date -d "$i days ago" +%Y-%m-%d)
  echo -n "$date: "
  aws s3 cp s3://$BUCKET_NAME/monitoring/drift/dt=$date/drift_*.json - 2>/dev/null | jq -r '.drift_score // "N/A"'
done
```

**Níveis de resposta:**
- **< 10% features drifted**: Monitorar, sem ação imediata
- **10-30% features drifted**: Investigar causa, preparar retreinamento
- **> 30% features drifted**: Retreinamento recomendado, escalar para Engenheiro

### 4.2 Resposta a Concept Drift

```bash
# Ver concept drift (mudança de correlação > 0.2)
aws s3 cp s3://$BUCKET_NAME/drift/$(date +%Y-%m-%d)/concept_drift.json - | \
  jq '.features[] | select(.drifted == true) | {feature, current_correlation, baseline_correlation, change}'

# Ver concept drift score geral
aws s3 cp s3://$BUCKET_NAME/drift/$(date +%Y-%m-%d)/concept_drift.json - | \
  jq '{overall_score, drifted_features_count}'
```

**Quando concept drift detectado:**
1. Verificar se mudança é temporária (evento de mercado) ou persistente
2. Se persistente (> 7 dias), iniciar processo de retreinamento
3. Documentar mudança no regime de mercado

### 4.3 Resposta a Performance Degradation

```bash
# Ver alertas de degradação ativos
aws s3 cp s3://$BUCKET_NAME/monitoring/drift/dt=$(date +%Y-%m-%d)/drift_*.json - | \
  jq '.performance_degradation[] | select(.degraded == true) | {metric, current, baseline, change, duration_days}'
```

**Thresholds de degradação:**
- MAPE aumentou > 20% vs baseline → Alerta
- Accuracy caiu > 10 pontos percentuais → Alerta
- Sharpe Ratio caiu > 0.5 → Alerta

**Ações:**
1. Correlacionar com eventos de drift
2. Se degradação persiste > 7 dias → Retreinamento
3. Se degradação é severa → Considerar desabilitar recomendações temporariamente

### 4.4 Processo de Retreinamento

```bash
# Ver recomendação de retreinamento
aws s3 cp s3://$BUCKET_NAME/monitoring/retrain_recommendations/retrain_*.json - | jq .

# Preparar dados de treino
aws lambda invoke \
  --function-name InfraStack-PrepareTrainingData \
  --payload '{}' \
  response.json

# Executar retreinamento (2-4 horas)
aws lambda invoke \
  --function-name InfraStack-TrainSageMaker \
  --payload '{}' \
  response.json

# Monitorar progresso
aws logs tail /aws/lambda/InfraStack-TrainSageMaker --follow

# Validar novo modelo (aguardar 20 dias para validação completa)
```

---

## 5. Operações de Segurança

### 5.1 Rotação de API Keys

```bash
# Listar API keys e verificar expiração
aws dynamodb scan \
  --table-name B3Dashboard-APIKeys \
  --projection-expression "apiKeyHash, #n, #r, createdAt, expiresAt, enabled" \
  --expression-attribute-names '{"#n":"name","#r":"role"}' | \
  jq '.Items[] | {name: .name.S, role: .role.S, expires: .expiresAt.S, enabled: .enabled.BOOL}'

# Verificar keys próximas de expirar (< 7 dias)
aws cloudwatch get-metric-statistics \
  --namespace B3Dashboard/Authentication \
  --metric-name APIKeyRotationNeeded \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 86400 \
  --statistics Maximum

# Rotacionar API key via API
curl -X POST https://$API_URL/api/keys/{keyHash}/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Política de rotação:**
- API keys expiram a cada 90 dias
- Alerta automático 7 dias antes da expiração
- Rotação gera nova key e invalida a anterior

### 5.2 Revisão de Security Audit

```bash
# Executar audit de segurança manualmente
aws lambda invoke \
  --function-name SecurityAudit \
  --payload '{"bucket":"'"$BUCKET_NAME"'","userPoolId":"'"$USER_POOL_ID"'"}' \
  audit-response.json

cat audit-response.json | jq '.findings_by_severity'

# Verificar último audit agendado
aws events describe-rule --name quarterly-security-audit
```

**Frequência de audits:**
- Automático: Trimestral (EventBridge)
- Manual: Após incidentes de segurança ou mudanças de infraestrutura

### 5.3 Monitoramento de Auth Logs

```bash
# Ver tentativas de autenticação falhadas (últimas 24h)
aws dynamodb scan \
  --table-name B3Dashboard-AuthLogs \
  --filter-expression "#s = :false AND #ts > :yesterday" \
  --expression-attribute-names '{"#s":"success","#ts":"timestamp"}' \
  --expression-attribute-values '{":false":{"BOOL":false},":yesterday":{"S":"'"$(date -d '1 day ago' +%Y-%m-%dT%H:%M:%S)"'"}}' \
  --select COUNT

# Ver detalhes de falhas
aws dynamodb scan \
  --table-name B3Dashboard-AuthLogs \
  --filter-expression "#s = :false AND #ts > :yesterday" \
  --expression-attribute-names '{"#s":"success","#ts":"timestamp"}' \
  --expression-attribute-values '{":false":{"BOOL":false},":yesterday":{"S":"'"$(date -d '1 day ago' +%Y-%m-%dT%H:%M:%S)"'"}}' | \
  jq '.Items[] | {userId: .userId.S, timestamp: .timestamp.S, reason: .reason.S, ip: .ipAddress.S}'

# Verificar rate limit exceeded
aws cloudwatch get-metric-statistics \
  --namespace B3Dashboard/Authentication \
  --metric-name RateLimitExceeded \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

**Alertas de segurança:**
- > 10 falhas de autenticação/minuto → Investigar possível brute force
- > 100 rate limit exceeded/minuto → Investigar possível DDoS
- > 5 CSRF validation failures/minuto → Investigar possível ataque CSRF

---

## 6. Gerenciamento de Cache (ElastiCache)

### 6.1 Monitoramento do Redis

```bash
# Status do cluster
aws elasticache describe-cache-clusters \
  --cache-cluster-id b3-dashboard-cache \
  --show-cache-node-info | \
  jq '.CacheClusters[0] | {status: .CacheClusterStatus, engine: .Engine, node_type: .CacheNodeType}'

# CPU utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CPUUtilization \
  --dimensions Name=CacheClusterId,Value=b3-dashboard-cache \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# Memory usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name DatabaseMemoryUsagePercentage \
  --dimensions Name=CacheClusterId,Value=b3-dashboard-cache \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum

# Cache hit rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CacheHitRate \
  --dimensions Name=CacheClusterId,Value=b3-dashboard-cache \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

### 6.2 Cache Invalidation

```bash
# Invalidar cache específico via Lambda
aws lambda invoke \
  --function-name B3Dashboard-CacheInvalidate \
  --payload '{"pattern": "recommendations:*"}' \
  response.json

# Invalidar todo o cache (usar com cautela)
aws lambda invoke \
  --function-name B3Dashboard-CacheInvalidate \
  --payload '{"pattern": "*"}' \
  response.json
```

**Quando invalidar cache:**
- Após re-ingestão manual de dados
- Após retreinamento de modelo
- Quando dados stale são detectados
- Após correção de bugs que afetam dados

### 6.3 Troubleshooting de Cache

**Cache hit rate < 70%:**
1. Verificar se TTLs estão adequados (short: 60s, medium: 300s, long: 3600s)
2. Verificar se Lambda functions estão usando cache corretamente
3. Verificar se cluster tem memória suficiente

**Cache connection errors:**
```bash
# Verificar security group
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=*CacheSecurityGroup*" | \
  jq '.SecurityGroups[0].IpPermissions'

# Verificar se Lambda está na mesma VPC
aws lambda get-function-configuration \
  --function-name B3Dashboard-DashboardAPI | \
  jq '.VpcConfig'
```

**Alarms:**
- CPU > 75% → Considerar upgrade de instância
- Memory > 80% → Revisar TTLs ou upgrade de instância
- Hit rate < 70% → Revisar estratégia de cache

---

## 7. Gerenciamento de CDN (CloudFront)

### 7.1 Monitoramento do CloudFront

```bash
# Status da distribuição
aws cloudfront get-distribution \
  --id $CLOUDFRONT_DISTRIBUTION_ID | \
  jq '.Distribution | {status: .Status, domain: .DomainName, enabled: .DistributionConfig.Enabled}'

# Métricas de requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=$CLOUDFRONT_DISTRIBUTION_ID Name=Region,Value=Global \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# Error rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name 4xxErrorRate \
  --dimensions Name=DistributionId,Value=$CLOUDFRONT_DISTRIBUTION_ID Name=Region,Value=Global \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average
```

### 7.2 Cache Invalidation (CloudFront)

```bash
# Invalidar assets estáticos (após deploy)
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/index.html" "/static/*" "/manifest.json"

# Invalidar tudo (emergência)
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*"

# Verificar status da invalidação
aws cloudfront list-invalidations \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID | \
  jq '.InvalidationList.Items[0] | {id: .Id, status: .Status, created: .CreateTime}'
```

**Cache policies configuradas:**
- Static assets: TTL 24h (min 1h, max 7d)
- API responses: TTL 5min (min 0s, max 1h)
- Compression: Gzip + Brotli habilitados

### 7.3 Troubleshooting de CDN

**High error rate:**
1. Verificar se origin (S3/API Gateway) está respondendo
2. Verificar logs de acesso do CloudFront
3. Verificar se certificado SSL está válido

**Stale content:**
1. Criar invalidação para os paths afetados
2. Verificar se cache-control headers estão corretos no origin
3. Verificar se API cache policy está com TTL adequado

---

## 8. Monitoramento Contínuo

### 8.1 CloudWatch Logs

```bash
# Ver logs em tempo real de uma Lambda
aws logs tail /aws/lambda/InfraStack-Quotes5mIngest --follow

# Buscar erros nas últimas 24h (todas as Lambdas)
for lambda in $(aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `B3Dashboard`)].FunctionName' --output text); do
  echo "=== $lambda ==="
  aws logs filter-log-events \
    --log-group-name /aws/lambda/$lambda \
    --start-time $(($(date +%s) - 86400))000 \
    --filter-pattern "ERROR" \
    --max-items 5
done

# Buscar erros de segurança
aws logs filter-log-events \
  --log-group-name /aws/lambda/B3Dashboard-AuthService \
  --start-time $(($(date +%s) - 86400))000 \
  --filter-pattern "SECURITY"
```

### 8.2 Métricas S3

```bash
# Tamanho total do bucket
aws s3 ls s3://$BUCKET_NAME --recursive --summarize | grep "Total Size"

# Número de objetos por prefixo
for prefix in quotes_5m recommendations monitoring data_quality drift explainability backtesting; do
  echo "$prefix: $(aws s3 ls s3://$BUCKET_NAME/$prefix/ --recursive | wc -l) objects"
done
```

### 8.3 Health Check Endpoints

```bash
# Test API health
curl -s https://$API_URL/health | jq .

# Test com API key
curl -s -H "X-Api-Key: $API_KEY" https://$API_URL/api/recommendations/latest | jq '.metadata.timestamp'

# Test data quality endpoint
curl -s -H "X-Api-Key: $API_KEY" https://$API_URL/api/data-quality/completeness | jq '.data.overall_rate'

# Test drift endpoint
curl -s -H "X-Api-Key: $API_KEY" https://$API_URL/api/drift/data-drift | jq '.data.overall_drift_score'
```

---

## 9. Interpretação de Alertas

### 9.1 Alerta: Ingestão Falhando

**Sintoma**: Email/SNS "ALARM: InfraStack-IngestionFailedAlarm"

**Diagnóstico**:
```bash
aws logs tail /aws/lambda/InfraStack-Quotes5mIngest --since 1h
aws secretsmanager get-secret-value --secret-id brapi/pro/token
curl "https://brapi.dev/api/quote/PETR4?range=1d&interval=5m&token=$BRAPI_TOKEN"
```

**Ação corretiva**:
```bash
# Se token expirado
aws secretsmanager update-secret \
  --secret-id brapi/pro/token \
  --secret-string '{"token":"NOVO_TOKEN"}'

# Re-executar ingestão
aws lambda invoke --function-name InfraStack-Quotes5mIngest --payload '{}' response.json
```

### 9.2 Alerta: Completude Baixa (< 90%)

**Diagnóstico**:
```bash
aws s3 cp s3://$BUCKET_NAME/monitoring/completeness/dt=$(date +%Y-%m-%d)/completeness_*.json - | jq '.missing_tickers'
```

**Ação corretiva**:
```bash
# Remover tickers inativos
vim config/universe.txt
aws s3 cp config/universe.txt s3://$BUCKET_NAME/config/universe.txt
aws lambda invoke --function-name InfraStack-Quotes5mIngest --payload '{}' response.json
```

### 9.3 Alerta: Custos Acima do Limite

**Diagnóstico**:
```bash
aws s3 cp s3://$BUCKET_NAME/monitoring/costs/dt=$(date +%Y-%m-%d)/costs_*.json - | jq '.costs_by_service'
```

**Ação corretiva**:
```bash
# Desligar SageMaker endpoint se não usado
aws sagemaker delete-endpoint --endpoint-name b3tr-ensemble-endpoint

# Limpar logs antigos
for log_group in $(aws logs describe-log-groups --log-group-name-prefix /aws/lambda/ --query 'logGroups[].logGroupName' --output text); do
  aws logs put-retention-policy --log-group-name $log_group --retention-in-days 7
done
```

### 9.4 Alerta: Drift Detectado

**Diagnóstico**:
```bash
aws s3 cp s3://$BUCKET_NAME/monitoring/drift/dt=$(date +%Y-%m-%d)/drift_*.json - | jq '{drift_score, features_with_drift, retrain_recommended}'
```

**Ação**: Ver seção [4. Operações de Drift Detection](#4-operações-de-drift-detection)

### 9.5 Alerta: Performance Degradada

**Sintoma**: MAPE > 20% ou Sharpe Ratio < 0.5

**Diagnóstico**:
```bash
# Histórico de performance (últimos 30 dias)
for i in {0..29}; do
  date=$(date -d "$i days ago" +%Y-%m-%d)
  echo -n "$date: MAPE="
  aws s3 cp s3://$BUCKET_NAME/monitoring/performance/dt=$date/performance_*.json - 2>/dev/null | jq -r '.mape // "N/A"'
done
```

**Ação**: Verificar qualidade dos dados → Verificar drift → Considerar retreinamento

### 9.6 Alerta: Cache Hit Rate Baixo

**Sintoma**: CloudWatch alarm "B3Dashboard-LowCacheHitRate"

**Diagnóstico**:
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ElastiCache \
  --metric-name CacheHitRate \
  --dimensions Name=CacheClusterId,Value=b3-dashboard-cache \
  --start-time $(date -u -d '6 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average
```

**Ação**: Revisar TTLs → Verificar memória do cluster → Verificar padrões de acesso

### 9.7 Alerta: Tentativas de Autenticação Suspeitas

**Sintoma**: > 10 falhas de auth/minuto

**Diagnóstico**:
```bash
aws dynamodb scan \
  --table-name B3Dashboard-AuthLogs \
  --filter-expression "#s = :false AND #ts > :recent" \
  --expression-attribute-names '{"#s":"success","#ts":"timestamp"}' \
  --expression-attribute-values '{":false":{"BOOL":false},":recent":{"S":"'"$(date -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)"'"}}' | \
  jq '.Items[] | {ip: .ipAddress.S, reason: .reason.S}' | sort | uniq -c | sort -rn | head -10
```

**Ação**: Bloquear IP se necessário → Verificar se é brute force → Escalar para Security team

### 9.8 Alerta: DR Backup Falhou

**Sintoma**: CloudWatch alarm "B3Dashboard-BackupFailure"

**Diagnóstico**:
```bash
aws logs tail /aws/lambda/B3Dashboard-BackupConfiguration --since 6h
aws s3 ls s3://b3tr-backup-$ACCOUNT_ID-us-west-2/backups/ --recursive | tail -5
```

**Ação**: Re-executar backup manualmente → Verificar permissões cross-region → Escalar se persistir

---

## 10. Resposta a Incidentes

### 10.1 Níveis de Severidade

| Severidade | Descrição | Exemplos | Tempo de Resposta |
|------------|-----------|----------|-------------------|
| **P1 - Crítico** | Sistema indisponível ou perda de dados | Region failure, S3 bucket deletado, API Gateway down | 15 minutos |
| **P2 - Alto** | Funcionalidade principal degradada | Ingestão falhando, drift severo, performance degradada | 1 hora |
| **P3 - Médio** | Funcionalidade secundária afetada | Cache down, CDN lento, completude < 90% | 4 horas |
| **P4 - Baixo** | Problema cosmético ou menor | Dashboard lento, logs excessivos, alerta falso positivo | 24 horas |

### 10.2 Procedimento de Escalação

```
Tempo 0min   → Alerta recebido, Operador verifica
Tempo 15min  → Se P1: Escalar para Engenheiro + CTO imediatamente
Tempo 30min  → Se P2: Escalar para Engenheiro
Tempo 1h     → Se não resolvido: Escalar para Arquiteto
Tempo 2h     → Se não resolvido: Abrir AWS Support (Priority 1 para P1)
Tempo 4h     → Se não resolvido: Notificar Executive Team
```

### 10.3 Template de Incidente

```
INCIDENTE: [Descrição breve]
SEVERIDADE: P1/P2/P3/P4
INÍCIO: [Timestamp]
IMPACTO: [O que está afetado]
STATUS: Investigando / Em progresso / Resolvido
RESPONSÁVEL: [Nome]
PRÓXIMA ATUALIZAÇÃO: [Timestamp]

AÇÕES TOMADAS:
1. [Ação 1]
2. [Ação 2]

CAUSA RAIZ: [Se identificada]
```

### 10.4 Post-Mortem

Após resolução de incidentes P1 e P2:
1. Agendar post-mortem em até 48h
2. Documentar timeline completa
3. Identificar causa raiz
4. Definir ações preventivas
5. Atualizar runbooks se necessário

---

## 11. Disaster Recovery

### 11.1 Visão Geral

| Métrica | Target |
|---------|--------|
| **RTO** (Recovery Time Objective) | 4 horas |
| **RPO** (Recovery Point Objective) | 24 horas |
| **Região primária** | us-east-1 |
| **Região de backup** | us-west-2 |
| **Frequência de backup** | Diário (2:00 AM UTC) |
| **DR Health Check** | A cada 6 horas |

### 11.2 Runbooks Disponíveis

Para procedimentos detalhados de recuperação, consultar:

| Cenário | Runbook | RTO |
|---------|---------|-----|
| S3 Bucket inacessível | [docs/runbooks/s3-failure-recovery.md](docs/runbooks/s3-failure-recovery.md) | 2h |
| DynamoDB indisponível | [docs/runbooks/dynamodb-failure-recovery.md](docs/runbooks/dynamodb-failure-recovery.md) | 2h |
| Lambda falhando | [docs/runbooks/lambda-failure-recovery.md](docs/runbooks/lambda-failure-recovery.md) | 1h |
| API Gateway down | [docs/runbooks/api-gateway-failure-recovery.md](docs/runbooks/api-gateway-failure-recovery.md) | 1h |
| Falha completa de região | [docs/runbooks/complete-region-failure.md](docs/runbooks/complete-region-failure.md) | 4h |

### 11.3 DR Específico do Dashboard

**Recuperação de dados do dashboard (8 abas):**

```bash
# 1. Verificar backup mais recente
aws s3 ls s3://b3tr-backup-$ACCOUNT_ID-us-west-2/backups/ --recursive | tail -10

# 2. Restaurar dados de recomendações
aws s3 sync s3://b3tr-backup-$ACCOUNT_ID-us-west-2/backups/$(date +%Y-%m-%d)/recommendations/ \
  s3://$BUCKET_NAME/recommendations/

# 3. Restaurar dados de data quality
aws s3 sync s3://b3tr-backup-$ACCOUNT_ID-us-west-2/backups/$(date +%Y-%m-%d)/data_quality/ \
  s3://$BUCKET_NAME/data_quality/

# 4. Restaurar dados de drift
aws s3 sync s3://b3tr-backup-$ACCOUNT_ID-us-west-2/backups/$(date +%Y-%m-%d)/drift/ \
  s3://$BUCKET_NAME/drift/

# 5. Restaurar dados de explainability
aws s3 sync s3://b3tr-backup-$ACCOUNT_ID-us-west-2/backups/$(date +%Y-%m-%d)/explainability/ \
  s3://$BUCKET_NAME/explainability/

# 6. Restaurar DynamoDB tables (API keys, auth logs, alerts)
aws lambda invoke \
  --function-name B3Dashboard-RestoreFromBackup \
  --payload '{"restore_type": "full"}' \
  response.json

# 7. Invalidar cache (dados restaurados podem ser diferentes)
aws lambda invoke \
  --function-name B3Dashboard-CacheInvalidate \
  --payload '{"pattern": "*"}' \
  response.json

# 8. Invalidar CloudFront
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*"

# 9. Verificar todas as abas do dashboard
curl -s -H "X-Api-Key: $API_KEY" https://$API_URL/api/recommendations/latest | jq '.metadata.timestamp'
curl -s -H "X-Api-Key: $API_KEY" https://$API_URL/api/data-quality/completeness | jq '.data.overall_rate'
curl -s -H "X-Api-Key: $API_KEY" https://$API_URL/api/drift/data-drift | jq '.data.overall_drift_score'
```

### 11.4 DR Health Check Manual

```bash
# Executar health check
aws lambda invoke \
  --function-name B3Dashboard-DRHealthCheck \
  --region us-west-2 \
  --payload '{}' \
  health-response.json

cat health-response.json | jq '{
  backup_freshness: .backup_freshness_ok,
  pitr_status: .pitr_enabled,
  backup_bucket_accessible: .backup_bucket_ok,
  overall_status: .status
}'
```

### 11.5 DR Drill (Trimestral)

Procedimento para drill de DR:
1. Agendar com 2 semanas de antecedência
2. Simular cenário de falha (ex: S3 inacessível)
3. Executar runbook correspondente
4. Medir tempo de recuperação
5. Documentar resultados e lições aprendidas
6. Atualizar runbooks se necessário

Consultar [docs/DISASTER_RECOVERY.md](docs/DISASTER_RECOVERY.md) para procedimentos completos.

---

## 12. Manutenção Programada

### 12.1 Janelas de Manutenção

| Tipo | Horário | Duração | Impacto |
|------|---------|---------|---------|
| **ElastiCache** | Domingo 03:00-05:00 UTC | 2h | Cache indisponível temporariamente |
| **CDK Deploy** | Sábado 22:00-00:00 BRT | 2h | Possível downtime breve |
| **Security Patches** | Conforme necessidade | 1h | Mínimo |
| **Model Retraining** | Sexta 21:00 BRT | 2-4h | Sem impacto no dashboard |

### 12.2 Checklist Semanal

- [ ] Verificar alarms ativos e histórico
- [ ] Revisar custos da semana
- [ ] Verificar performance do modelo (MAPE, Sharpe)
- [ ] Verificar data quality trends
- [ ] Verificar drift trends
- [ ] Verificar cache hit rate
- [ ] Revisar auth logs para atividade suspeita
- [ ] Limpar logs antigos do CloudWatch (se necessário)

### 12.3 Checklist Mensal

- [ ] Executar validação histórica completa
- [ ] Revisar e atualizar `config/universe.txt`
- [ ] Backup completo de dados
- [ ] Revisar e otimizar custos
- [ ] Revisar API key expirations
- [ ] Verificar storage lifecycle policies
- [ ] Gerar relatório operacional mensal
- [ ] Revisar CloudFront access logs

### 12.4 Checklist Trimestral

- [ ] Executar security audit completo
- [ ] Executar DR drill
- [ ] Avaliar necessidade de retreinamento
- [ ] Revisar e atualizar feriados B3
- [ ] Atualizar dependências (CDK, Lambda layers, npm packages)
- [ ] Revisar e otimizar infraestrutura
- [ ] Revisar cache TTLs e ajustar
- [ ] Atualizar documentação

### 12.5 Procedimento de Deploy

```bash
# 1. Deploy em staging primeiro
cd infra
npm run build
cdk deploy --all --context env=staging

# 2. Executar smoke tests em staging
./scripts/smoke-test.sh staging

# 3. Deploy em produção (blue-green)
cdk deploy --all --context env=production

# 4. Invalidar CloudFront
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*"

# 5. Invalidar ElastiCache
aws lambda invoke \
  --function-name B3Dashboard-CacheInvalidate \
  --payload '{"pattern": "*"}' \
  response.json

# 6. Verificar health
curl -s https://$API_URL/health | jq .

# 7. Monitorar por 30 minutos
watch -n 30 'aws cloudwatch describe-alarms --state-value ALARM --alarm-name-prefix B3Dashboard'
```

---

## 13. Monitoramento de Custos

### 13.1 Verificar Custos Diários

```bash
# Custos de hoje
aws s3 cp s3://$BUCKET_NAME/monitoring/costs/dt=$(date +%Y-%m-%d)/costs_*.json - | jq '{
  total_cost,
  monthly_projection,
  costs_by_service,
  cost_per_recommendation
}'

# Tendência (últimos 7 dias)
for i in {0..6}; do
  date=$(date -d "$i days ago" +%Y-%m-%d)
  echo -n "$date: R$ "
  aws s3 cp s3://$BUCKET_NAME/monitoring/costs/dt=$date/costs_*.json - 2>/dev/null | jq -r '.total_cost // "N/A"'
done
```

### 13.2 Custos por Componente

```bash
# Custos reais via Cost Explorer
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=SERVICE
```

**Custos esperados (pós-otimização):**
- S3 Storage: $25-50/mês
- Lambda: $10-20/mês
- Data Transfer: $5-15/mês
- ElastiCache: $15-20/mês
- CloudFront: $10-15/mês
- **Total estimado: $65-120/mês**

### 13.3 Otimização de Custos

```bash
# Executar storage optimizer
aws lambda invoke --function-name StorageOptimizer --payload '{}' response.json

# Verificar lifecycle policies
aws s3api get-bucket-lifecycle-configuration --bucket $BUCKET_NAME

# Verificar Lambda memory allocation
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `B3Dashboard`)].{Name:FunctionName,Memory:MemorySize,Timeout:Timeout}' --output table
```

---

## 14. Backup e Recuperação

### 14.1 Backup Automático

Backups são executados automaticamente:
- **S3 data**: Diário às 2:00 AM UTC → `s3://b3tr-backup-$ACCOUNT_ID-us-west-2/`
- **DynamoDB**: PITR contínuo (35 dias) + on-demand diário
- **Configuração**: Via Git (versionado)

### 14.2 Backup Manual

```bash
# Backup completo do bucket
aws s3 sync s3://$BUCKET_NAME/ ./backup-$(date +%Y%m%d)/ \
  --exclude "*.pyc" --exclude "__pycache__/*"

# Backup de configuração
cd infra && cdk synth > cloudformation-template-$(date +%Y%m%d).yaml
aws secretsmanager get-secret-value --secret-id brapi/pro/token > brapi-token-backup.json
cp config/universe.txt universe-backup-$(date +%Y%m%d).txt
```

### 14.3 Restauração

```bash
# Restaurar de backup cross-region
aws lambda invoke \
  --function-name B3Dashboard-RestoreFromBackup \
  --payload '{"restore_type": "full"}' \
  response.json

# Restaurar DynamoDB via PITR
aws lambda invoke \
  --function-name B3Dashboard-RestoreFromBackup \
  --payload '{"restore_type": "point_in_time", "point_in_time": "2026-03-10T10:00:00Z"}' \
  response.json

# Verificar integridade
aws s3 ls s3://$BUCKET_NAME/ --recursive | wc -l
```

---

## 15. Contatos e Escalação

### 15.1 Níveis de Suporte

**Nível 1 - Operador**:
- Monitoramento diário (checklists matinal, pós-pregão, noturno)
- Resposta a alertas simples (completude, freshness, custos)
- Execução de invalidação de cache
- Verificação de data quality e drift

**Nível 2 - Engenheiro**:
- Troubleshooting avançado (Lambda errors, cache issues, CDN problems)
- Correção de erros de código
- Otimização de performance
- Rotação de API keys e security operations
- Execução de DR drills

**Nível 3 - Arquiteto**:
- Mudanças de arquitetura
- Retreinamento de modelos
- Disaster recovery (region failover)
- Security incident response
- Infrastructure scaling decisions

### 15.2 Contatos

- **Operador**: operador@example.com
- **Engenheiro**: engenheiro@example.com
- **Arquiteto**: arquiteto@example.com
- **Security Team**: security@example.com
- **AWS Support**: [Support Portal]
- **GitHub Issues**: https://github.com/uesleisutil/b3-tactical-ranking/issues

---

## 16. Referências Rápidas

### 16.1 Comandos Úteis

```bash
# Status geral
aws cloudwatch describe-alarms --state-value ALARM --alarm-name-prefix B3Dashboard

# Executar Lambda manualmente
aws lambda invoke --function-name <name> --payload '{}' response.json

# Ver logs em tempo real
aws logs tail /aws/lambda/<name> --follow

# Ver custos
aws s3 cp s3://$BUCKET_NAME/monitoring/costs/dt=$(date +%Y-%m-%d)/costs_*.json - | jq .

# Ver recomendações
aws s3 cp s3://$BUCKET_NAME/recommendations/dt=$(date +%Y-%m-%d)/recommendations_*.json - | jq .

# Ver data quality
aws s3 cp s3://$BUCKET_NAME/data_quality/$(date +%Y-%m-%d)/completeness.json - | jq .

# Ver drift
aws s3 cp s3://$BUCKET_NAME/monitoring/drift/dt=$(date +%Y-%m-%d)/drift_*.json - | jq .

# Cache status
aws elasticache describe-cache-clusters --cache-cluster-id b3-dashboard-cache --show-cache-node-info

# CloudFront status
aws cloudfront get-distribution --id $CLOUDFRONT_DISTRIBUTION_ID | jq '.Distribution.Status'

# DR health
aws lambda invoke --function-name B3Dashboard-DRHealthCheck --region us-west-2 --payload '{}' health.json
```

### 16.2 Variáveis de Ambiente

```bash
export BUCKET_NAME="b3tr-<account>-us-east-1"
export ACCOUNT_ID="<aws-account-id>"
export API_URL="https://<api-id>.execute-api.us-east-1.amazonaws.com/prod"
export API_KEY="<your-api-key>"
export CLOUDFRONT_DISTRIBUTION_ID="<distribution-id>"
export USER_POOL_ID="us-east-1_XXXXXXXXX"
export BRAPI_TOKEN="<brapi-token>"
```

### 16.3 Links Importantes

- Dashboard: https://uesleisutil.github.io/b3-tactical-ranking
- CloudWatch: https://console.aws.amazon.com/cloudwatch/
- S3 Console: https://s3.console.aws.amazon.com/s3/buckets/$BUCKET_NAME
- Lambda Console: https://console.aws.amazon.com/lambda/
- ElastiCache Console: https://console.aws.amazon.com/elasticache/
- CloudFront Console: https://console.aws.amazon.com/cloudfront/
- DynamoDB Console: https://console.aws.amazon.com/dynamodb/
- BRAPI Docs: https://brapi.dev/docs

### 16.4 Documentação Relacionada

- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Security Configuration](SECURITY_CONFIGURATION.md)
- [Monitoring Quick Start](MONITORING_QUICK_START.md)
- [Disaster Recovery Plan](docs/DISASTER_RECOVERY.md)
- [S3 Failure Recovery](docs/runbooks/s3-failure-recovery.md)
- [DynamoDB Failure Recovery](docs/runbooks/dynamodb-failure-recovery.md)
- [Lambda Failure Recovery](docs/runbooks/lambda-failure-recovery.md)
- [API Gateway Failure Recovery](docs/runbooks/api-gateway-failure-recovery.md)
- [Complete Region Failure](docs/runbooks/complete-region-failure.md)

---

**Última atualização**: 2026-03-15  
**Versão do Sistema**: 4.0.0
