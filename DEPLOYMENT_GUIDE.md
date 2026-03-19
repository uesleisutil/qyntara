# Guia de Deployment - B3 Tactical Ranking MLOps System

**Versão**: 4.0.0 | **Data**: 2026-03-10 | **Status**: PRODUÇÃO

## Visão Geral

O sistema inclui 5 CDK stacks, um dashboard React com 8 abas, e infraestrutura completa de monitoramento, segurança, otimização e disaster recovery.

| Stack | Descrição | Recursos |
|-------|-----------|----------|
| InfraStack | Core | Lambda, API Gateway, S3, DynamoDB, SNS |
| MonitoringStack | Observabilidade | CloudWatch dashboards, alarms, SNS |
| SecurityStack | Segurança | KMS, DynamoDB (API keys, auth, rate limits) |
| OptimizationStack | Performance | ElastiCache Redis, CloudFront CDN |
| DisasterRecoveryStack | DR | Cross-region backups, health checks |

| Aba | Funcionalidade |
|-----|----------------|
| Recommendations | Filtros, export CSV/Excel, comparação, alertas |
| Performance | Model breakdown, confusion matrix, benchmarks |
| Validation | Scatter plots, temporal accuracy, outliers |
| Costs | Cost trends, optimization, budget alerts, ROI |
| Data Quality | Completeness, anomalies, freshness, coverage |
| Drift Detection | Data/concept drift, retraining recommendations |
| Explainability | SHAP values, sensitivity, feature impact |
| Backtesting | Portfolio simulation, risk, stress testing |

---

## Pré-requisitos

```bash
aws --version       # >= 2.0.0
node --version      # >= 18.0.0
cdk --version       # >= 2.0.0 (npm install -g aws-cdk)
python3 --version   # >= 3.11
```

```bash
aws configure && aws sts get-caller-identity
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
```

---

## Parte 1: Configuração Inicial

### 1.1 Clonar Repositório

```bash
git clone https://github.com/uesleisutil/b3-tactical-ranking.git
cd b3-tactical-ranking
```

### 1.2 Configurar Token BRAPI

```bash
aws secretsmanager create-secret \
  --name brapi/pro/token \
  --description "BRAPI Pro API Token" \
  --secret-string '{"token":"SEU_TOKEN_AQUI"}'
```

**Alternativa**: `cd infra/scripts && chmod +x setup-secrets.sh && ./setup-secrets.sh`

### 1.3 Configurar Universo e Feriados

```bash
vim config/universe.txt          # Adicionar tickers: PETR4, VALE3, ITUB4, ...
cat config/b3_holidays_2026.json # Formato: { "holidays": ["2026-01-01", ...] }
```

---

## Parte 2: Deploy da Infraestrutura AWS (5 Stacks)

### 2.1 Instalar Dependências CDK

```bash
cd infra
npm install
```

### 2.2 Configurar Variáveis de Ambiente (infra/.env)

```bash
cat > .env << 'EOF'
# ===== AWS / CDK =====
AWS_REGION=us-east-1
AWS_DEFAULT_REGION=us-east-1

# ===== BRAPI =====
BRAPI_SECRET_ID=brapi/pro/token

# ===== CONFIGURAÇÕES B3TR =====
B3TR_SSM_PREFIX=/b3tr
B3TR_UNIVERSE_S3_KEY=config/universe.txt
B3TR_SCHEDULE_MINUTES=5
B3TR_PREDICTION_LENGTH=20
B3TR_CONTEXT_LENGTH=60
B3TR_MIN_POINTS=252
B3TR_BUCKET_PREFIX=b3tr
B3TR_TOP_N=50
B3TR_TEST_DAYS=60

# ===== AWS RESOURCES =====
DEEPAR_IMAGE_URI=382416733822.dkr.ecr.us-east-1.amazonaws.com/forecasting-deepar:1
ENSEMBLE_IMAGE_URI=

# ===== ALERTAS =====
ALERT_EMAIL=seu-email@example.com
MODEL_QUALITY_MAPE_THRESHOLD=0.20

# ===== HORÁRIO B3 (UTC) =====
B3_OPEN_HOUR_UTC=13
B3_CLOSE_HOUR_UTC=20
B3_CLOSE_MINUTE_UTC=55

# ===== MONITORAMENTO =====
HOLIDAYS_S3_KEY=config/b3_holidays_2026.json
INGEST_LOOKBACK_MINUTES=15

# ===== BOOTSTRAP =====
B3TR_HISTORY_RANGE=10y
BOOTSTRAP_TICKERS_PER_RUN=10
BOOTSTRAP_SLEEP_S=0.2
EOF
```

### 2.3 Bootstrap CDK (primeira vez apenas)

```bash
cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION
```

### 2.4 Deploy Stack 1: InfraStack (Core)

Lambda functions, API Gateway, S3 buckets, DynamoDB tables, SNS topics.

```bash
cdk synth InfraStack
cdk diff InfraStack
cdk deploy InfraStack --require-approval never --outputs-file outputs.json
```

**Tempo estimado**: 10-15 minutos

**Salvar outputs**:
```bash
export BUCKET_NAME=$(jq -r '.InfraStack.BucketName' outputs.json)
export API_URL=$(jq -r '.InfraStack.DashboardApiUrl' outputs.json)
export API_KEY_ID=$(jq -r '.InfraStack.DashboardApiKeyId' outputs.json)
```

### 2.5 Deploy Stack 2: MonitoringStack

CloudWatch dashboards (`B3-Dashboard-System-Health`), alarms, SNS topics.

**Alarms criados automaticamente:**
- `B3Dashboard-HighAPIResponseTime` — API response time > 1s
- `B3Dashboard-HighPageLoadTime` — Page load > 3s
- `B3Dashboard-HighTimeToInteractive` — TTI > 5s
- `B3Dashboard-HighErrorRate` — Error rate > 5%
- `B3Dashboard-CriticalErrors` — Critical errors in logs
- `B3Dashboard-NoActiveUsers` — No active users in 1h
- `B3Dashboard-HighModelMAPE` — Model MAPE > 15%
- `B3Dashboard-LowDirectionalAccuracy` — Accuracy < 50%
- `B3Dashboard-LowSharpeRatio` — Sharpe Ratio < 0.5

```bash
cdk deploy MonitoringStack --require-approval never
```

**Tempo estimado**: 3-5 minutos

### 2.6 Deploy Stack 3: SecurityStack

KMS encryption key (`b3-dashboard-encryption-key` com auto-rotation), DynamoDB tables (`B3Dashboard-APIKeys`, `B3Dashboard-AuthLogs`, `B3Dashboard-RateLimits`), security audit Lambda.

```bash
cdk deploy SecurityStack --require-approval never
```

**Tempo estimado**: 3-5 minutos

### 2.7 Deploy Stack 4: OptimizationStack

ElastiCache Redis cluster, CloudFront CDN distribution, S3 lifecycle policies.

```bash
cdk deploy OptimizationStack --require-approval never
```

**Tempo estimado**: 10-15 minutos (ElastiCache cluster creation takes time)

### 2.8 Deploy Stack 5: DisasterRecoveryStack

Cross-region S3 replication, DynamoDB point-in-time recovery, health check Lambda. RTO: 4h, RPO: 24h.

```bash
cdk deploy DisasterRecoveryStack --require-approval never
```

**Tempo estimado**: 5-10 minutos

### 2.9 Deploy Completo (Todas as Stacks)

```bash
cdk deploy --all --require-approval never --outputs-file outputs.json
```

**Tempo estimado total**: 25-40 minutos

---

## Parte 3: Configuração de EventBridge Schedules

```bash
# Verificar schedules
aws events list-rules --name-prefix InfraStack
aws events list-targets-by-rule --rule InfraStack-IngestDuringB3

# Habilitar/Desabilitar
aws events disable-rule --name InfraStack-IngestDuringB3
aws events enable-rule --name InfraStack-IngestDuringB3

# Testar manualmente
aws lambda invoke --function-name InfraStack-Quotes5mIngest --payload '{}' response.json
cat response.json
```

---

## Parte 4: Configuração do Dashboard

### 4.1 Obter API Key

```bash
export API_KEY=$(aws apigateway get-api-key \
  --api-key $API_KEY_ID \
  --include-value \
  --query 'value' \
  --output text)
```

### 4.2 Configurar Variáveis de Ambiente do Dashboard

**dashboard/.env.production** (build de produção):

```bash
cd dashboard
cat > .env.production << EOF
REACT_APP_API_URL=$API_URL
REACT_APP_API_KEY=$API_KEY
REACT_APP_AWS_REGION=us-east-1
REACT_APP_S3_BUCKET=$BUCKET_NAME
REACT_APP_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
REACT_APP_ENVIRONMENT=production
REACT_APP_SENTRY_SAMPLE_RATE=0.1
REACT_APP_VERSION=4.0.0
EOF
```

**dashboard/.env.local** (desenvolvimento local):

```bash
cat > .env.local << EOF
REACT_APP_AWS_REGION=us-east-1
REACT_APP_S3_BUCKET=$BUCKET_NAME
REACT_APP_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
REACT_APP_ENVIRONMENT=development
REACT_APP_SENTRY_SAMPLE_RATE=1.0
REACT_APP_VERSION=4.0.0
EOF
```

> **Segurança**: Nunca commite credenciais AWS reais. Use AWS CLI profiles ou IAM roles.

### 4.3 Build e Deploy

```bash
npm install
npm run build
```

**Opção 1: GitHub Pages (Recomendado)**

O projeto inclui `.github/workflows/deploy-dashboard.yml` que faz deploy automático ao push na branch `main`. O workflow faz checkout, instala Node.js 20, builda com variáveis de ambiente, e deploya para GitHub Pages.

**Configurar GitHub Secrets** (Settings > Secrets and variables > Actions):
- `REACT_APP_API_KEY`: Valor da API Key

Deploy manual: `npm run deploy`

**Opção 2: S3 + CloudFront**

```bash
aws s3 mb s3://b3tr-dashboard-$AWS_ACCOUNT_ID
aws s3 website s3://b3tr-dashboard-$AWS_ACCOUNT_ID \
  --index-document index.html --error-document index.html
aws s3 sync build/ s3://b3tr-dashboard-$AWS_ACCOUNT_ID/ \
  --delete --cache-control "max-age=31536000"
```

Se a OptimizationStack foi deployada, o CloudFront distribution já aponta para o bucket S3.

**Opção 3: Local** — `npx serve -s build -p 3000`

---

## Parte 5: Configuração de Segurança

### 5.1 KMS Encryption

A SecurityStack cria uma KMS key com alias `b3-dashboard-encryption-key` e auto-rotation habilitado.

```bash
aws kms describe-key --key-id alias/b3-dashboard-encryption-key
aws kms get-key-rotation-status --key-id alias/b3-dashboard-encryption-key
```

### 5.2 API Key Management

API keys armazenadas em DynamoDB (`B3Dashboard-APIKeys`) com hash SHA-256.

```bash
aws dynamodb scan --table-name B3Dashboard-APIKeys --select COUNT
aws dynamodb scan --table-name B3Dashboard-RateLimits --select COUNT
```

### 5.3 Security Audit

```bash
aws lambda invoke \
  --function-name SecurityStack-SecurityAuditFunction \
  --payload '{}' \
  audit-response.json
cat audit-response.json
```

### 5.4 Auth Logs

```bash
aws dynamodb query \
  --table-name B3Dashboard-AuthLogs \
  --limit 10 \
  --scan-index-forward false
```

---

## Parte 6: Configuração de Monitoramento

### 6.1 CloudWatch Dashboards

A MonitoringStack cria o dashboard `B3-Dashboard-System-Health` com widgets:

- **API Performance**: Response time (avg/max)
- **Frontend Performance**: Page load time, Time to Interactive
- **Error Rate**: Percentage of failed API calls
- **Business Metrics**: Recommendations generated, predictions made, API calls
- **Model Performance**: MAPE, directional accuracy, Sharpe Ratio

```bash
# Acessar via Console
echo "https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#dashboards:name=B3-Dashboard-System-Health"

# Via CLI
aws cloudwatch get-dashboard --dashboard-name B3-Dashboard-System-Health
```

### 6.2 CloudWatch Alarms

```bash
aws cloudwatch describe-alarms \
  --alarm-name-prefix B3Dashboard \
  --query 'MetricAlarms[].{Name:AlarmName,State:StateValue}' \
  --output table
```

### 6.3 Configurar Alertas por Email

```bash
ALARM_TOPIC_ARN=$(aws cloudformation describe-stacks \
  --stack-name MonitoringStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AlarmTopicArn`].OutputValue' \
  --output text)

aws sns subscribe \
  --topic-arn $ALARM_TOPIC_ARN \
  --protocol email \
  --notification-endpoint outro-email@example.com
# Confirmar subscription no email recebido
```

### 6.4 Sentry (Frontend Error Tracking)

O dashboard usa `@sentry/react` para error tracking.

1. Criar projeto no [Sentry](https://sentry.io)
2. Obter o DSN do projeto
3. Configurar no `.env.production`:

```bash
REACT_APP_SENTRY_DSN=https://your-key@sentry.io/project-id
REACT_APP_ENVIRONMENT=production
REACT_APP_SENTRY_SAMPLE_RATE=0.1  # 10% em produção
```

### 6.5 Métricas Customizadas

```bash
aws cloudwatch list-metrics --namespace B3Dashboard

aws cloudwatch get-metric-statistics \
  --namespace B3Dashboard \
  --metric-name APIResponseTime \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average Maximum
```

### 6.6 Testar Alertas

```bash
aws sns publish \
  --topic-arn $ALARM_TOPIC_ARN \
  --subject "Teste de Alerta B3TR" \
  --message "Este é um teste de alerta do sistema B3TR"
```

---

## Parte 7: Performance e Otimização

### 7.1 ElastiCache Redis

A OptimizationStack cria um cluster ElastiCache Redis para caching de API responses.

```bash
aws elasticache describe-cache-clusters \
  --query 'CacheClusters[?starts_with(CacheClusterId, `b3`)].{Id:CacheClusterId,Status:CacheClusterStatus,Engine:Engine}' \
  --output table

aws elasticache describe-cache-clusters \
  --show-cache-node-info \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint'
```

### 7.2 CloudFront CDN

```bash
aws cloudfront list-distributions \
  --query 'DistributionList.Items[].{Id:Id,Domain:DomainName,Status:Status}' \
  --output table

# Invalidar cache após deploy
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

### 7.3 S3 Lifecycle Policies

A OptimizationStack configura lifecycle policies:
- Dados > 30 dias → S3 Infrequent Access
- Dados > 90 dias → S3 Glacier
- Logs temporários → Expiram em 7 dias

---

## Parte 8: Disaster Recovery

### 8.1 Configuração DR

A DisasterRecoveryStack implementa:
- **RTO**: 4 horas | **RPO**: 24 horas
- S3 Cross-Region Replication
- DynamoDB Point-in-Time Recovery
- Health Check Lambda (scheduled)

```bash
aws lambda invoke \
  --function-name DisasterRecoveryStack-HealthCheckFunction \
  --payload '{}' \
  health-response.json
cat health-response.json
```

### 8.2 Verificar Backups

```bash
aws dynamodb list-backups --table-name B3Dashboard-APIKeys
aws s3api get-bucket-replication --bucket $BUCKET_NAME
```

---

## Parte 9: Bootstrap de Dados Históricos

### 9.1 Executar Bootstrap Inicial

```bash
aws lambda invoke \
  --function-name InfraStack-BootstrapHistoryDaily \
  --payload '{}' \
  response.json
cat response.json
```

O bootstrap roda automaticamente a cada 30 minutos via EventBridge. Idempotente e incremental.

### 9.2 Monitorar Progresso

```bash
aws logs tail /aws/lambda/InfraStack-BootstrapHistoryDaily --follow
aws s3 ls s3://$BUCKET_NAME/quotes_5m/ --recursive | wc -l
```

### 9.3 Validação Histórica

```bash
aws lambda invoke \
  --function-name InfraStack-HistoricalDataValidator \
  --payload '{}' \
  response.json

aws s3 cp s3://$BUCKET_NAME/monitoring/validation/historical_data_report_$(date +%Y-%m-%d).json - | jq .
```

---

## Parte 10: Validação do Deployment

### 10.1 Verificar Lambdas

```bash
aws lambda list-functions \
  --query 'Functions[?starts_with(FunctionName, `InfraStack`) || starts_with(FunctionName, `SecurityStack`) || starts_with(FunctionName, `MonitoringStack`) || starts_with(FunctionName, `DisasterRecovery`)].FunctionName'
```

### 10.2 Verificar API Gateway

```bash
# Recomendações
curl -H "X-Api-Key: $API_KEY" ${API_URL}api/recommendations/latest | jq .

# Data Quality
curl -H "X-Api-Key: $API_KEY" "${API_URL}api/data-quality/completeness" | jq .

# Drift Detection
curl -H "X-Api-Key: $API_KEY" "${API_URL}api/drift/data-drift" | jq .

# Explainability
curl -H "X-Api-Key: $API_KEY" "${API_URL}api/explainability/shap?ticker=PETR4" | jq .
```

### 10.3 Verificar CloudWatch

```bash
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name IngestionOK \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Minimum

aws cloudwatch describe-alarms --alarm-name-prefix B3Dashboard --state-value ALARM
```

### 10.4 Verificar Todas as Stacks

```bash
for stack in InfraStack MonitoringStack SecurityStack OptimizationStack DisasterRecoveryStack; do
  echo "=== $stack ==="
  aws cloudformation describe-stacks --stack-name $stack \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT DEPLOYED"
done
```

---

## Parte 11: CI/CD Pipeline

### 11.1 GitHub Actions

| Workflow | Trigger | Descrição |
|----------|---------|-----------|
| `deploy-dashboard.yml` | Push to `main` (dashboard/**) | Build e deploy para GitHub Pages |
| `security-codeql.yml` | PR/Push | Análise CodeQL |
| `security-dependency-scan.yml` | PR/Push | Scan de dependências |
| `security-sast.yml` | PR/Push | Static Application Security Testing |
| `security-secrets-scan.yml` | PR/Push | Detecção de secrets |
| `security-compliance.yml` | PR/Push | Verificação de compliance |
| `security-container-scan.yml` | PR/Push | Scan de containers |

### 11.2 GitHub Secrets

Configure em **Settings > Secrets and variables > Actions**:

| Secret | Descrição |
|--------|-----------|
| `REACT_APP_API_KEY` | API Key do API Gateway |
| `AWS_ACCESS_KEY_ID` | (Opcional) Para deploy de infra via CI |
| `AWS_SECRET_ACCESS_KEY` | (Opcional) Para deploy de infra via CI |

### 11.3 Ambientes

| Ambiente | Branch | Deploy | Aprovação |
|----------|--------|--------|-----------|
| Development | `feature/*` | Manual | Não |
| Staging | `main` | Automático | Não |
| Production | `main` (tag) | Manual | Sim |

### 11.4 Versionamento (Semantic Versioning)

```bash
git tag -a v4.0.0 -m "Release 4.0.0: Dashboard Complete Enhancement"
git push origin v4.0.0
```

---

## Parte 12: Troubleshooting

### 12.1 Lambda Timeout

```bash
aws lambda update-function-configuration \
  --function-name InfraStack-Quotes5mIngest \
  --timeout 900
```

### 12.2 Erro de Permissão S3

```bash
aws iam get-role-policy \
  --role-name InfraStack-Quotes5mIngestRole \
  --policy-name InfraStack-Quotes5mIngestRoleDefaultPolicy
# Re-deploy se necessário: cd infra && cdk deploy InfraStack
```

### 12.3 API Gateway 403 Forbidden

```bash
export API_KEY=$(aws apigateway get-api-key \
  --api-key $API_KEY_ID \
  --include-value \
  --query 'value' \
  --output text)
curl -H "X-Api-Key: $API_KEY" ${API_URL}api/recommendations/latest
```

### 12.4 Dashboard Não Carrega Dados

```bash
cat dashboard/.env.production
curl -H "X-Api-Key: $API_KEY" ${API_URL}api/recommendations/latest
cd dashboard && npm run build
```

### 12.5 ElastiCache Connection Refused

```bash
aws elasticache describe-cache-clusters --show-cache-node-info
aws lambda get-function-configuration \
  --function-name InfraStack-DashboardApiHandler \
  --query 'VpcConfig'
```

### 12.6 CloudWatch Alarms em INSUFFICIENT_DATA

Normal após deploy recente. Aguarde 10+ minutos para métricas serem publicadas.

```bash
aws cloudwatch list-metrics --namespace B3Dashboard
```

### 12.7 Custos Elevados

```bash
aws events disable-rule --name InfraStack-BootstrapHistorySchedule
# Editar infra/.env: B3TR_SCHEDULE_MINUTES=10
cd infra && cdk deploy InfraStack
```

### 12.8 Drift Detection Sem Resultados

Requer mínimo 30 dias de baseline:

```bash
aws s3 ls s3://$BUCKET_NAME/drift/ --recursive
curl -H "X-Api-Key: $API_KEY" "${API_URL}api/drift/data-drift?recalculate=true" | jq .
```

---

## Parte 13: Manutenção

### 13.1 Atualizar Lambdas

```bash
cd infra && cdk deploy InfraStack
```

### 13.2 Atualizar Dashboard

Push para `main` faz deploy automático via GitHub Actions. Ou manualmente:

```bash
cd dashboard && npm run build && npm run deploy
```

### 13.3 Atualizar Stacks Individualmente

```bash
cdk deploy MonitoringStack    # Apenas monitoring
cdk deploy SecurityStack      # Apenas security
cdk deploy --all              # Todas
```

### 13.4 Backup de Dados

```bash
aws s3 sync s3://$BUCKET_NAME/ ./backup-$(date +%Y%m%d)/ --exclude "*.pyc"
```

---

## Parte 14: Rollback e Destruição

### 14.1 Rollback

```bash
aws cloudformation describe-stack-events --stack-name InfraStack
aws cloudformation cancel-update-stack --stack-name InfraStack
```

### 14.2 Destruir Stacks (CUIDADO!)

Destruir na ordem inversa de dependência:

```bash
cdk destroy DisasterRecoveryStack
cdk destroy OptimizationStack
cdk destroy SecurityStack
cdk destroy MonitoringStack
aws s3 rm s3://$BUCKET_NAME/ --recursive
cdk destroy InfraStack
```

**ATENÇÃO**: Isso irá deletar TODOS os recursos, incluindo dados históricos!

---

## Parte 15: Referência de Variáveis de Ambiente

### Infraestrutura (infra/.env)

| Variável | Descrição | Default |
|----------|-----------|---------|
| `AWS_REGION` | Região AWS | `us-east-1` |
| `BRAPI_SECRET_ID` | Secret ID do token BRAPI | `brapi/pro/token` |
| `B3TR_SSM_PREFIX` | Prefixo SSM Parameter Store | `/b3tr` |
| `B3TR_UNIVERSE_S3_KEY` | S3 key do arquivo de universo | `config/universe.txt` |
| `B3TR_SCHEDULE_MINUTES` | Intervalo de ingestão (minutos) | `5` |
| `B3TR_PREDICTION_LENGTH` | Horizonte de predição | `20` |
| `B3TR_CONTEXT_LENGTH` | Janela de contexto | `60` |
| `B3TR_MIN_POINTS` | Mínimo de data points | `252` |
| `B3TR_BUCKET_PREFIX` | Prefixo do bucket S3 | `b3tr` |
| `B3TR_TOP_N` | Top N tickers | `50` |
| `B3TR_TEST_DAYS` | Dias de teste | `60` |
| `DEEPAR_IMAGE_URI` | URI da imagem DeepAR | (ECR URI) |
| `ENSEMBLE_IMAGE_URI` | URI da imagem Ensemble | (vazio) |
| `ALERT_EMAIL` | Email para alertas | — |
| `MODEL_QUALITY_MAPE_THRESHOLD` | Threshold MAPE | `0.20` |
| `B3_OPEN_HOUR_UTC` | Hora abertura B3 (UTC) | `13` |
| `B3_CLOSE_HOUR_UTC` | Hora fechamento B3 (UTC) | `20` |
| `B3_CLOSE_MINUTE_UTC` | Minuto fechamento B3 (UTC) | `55` |
| `HOLIDAYS_S3_KEY` | S3 key do arquivo de feriados | `config/b3_holidays_2026.json` |
| `INGEST_LOOKBACK_MINUTES` | Lookback de ingestão | `15` |
| `B3TR_HISTORY_RANGE` | Range de dados históricos | `10y` |
| `BOOTSTRAP_TICKERS_PER_RUN` | Tickers por execução de bootstrap | `10` |
| `BOOTSTRAP_SLEEP_S` | Sleep entre requests (segundos) | `0.2` |

### Dashboard (dashboard/.env.production)

| Variável | Descrição | Default |
|----------|-----------|---------|
| `REACT_APP_API_URL` | URL do API Gateway | — |
| `REACT_APP_API_KEY` | API Key do API Gateway | — |
| `REACT_APP_AWS_REGION` | Região AWS | `us-east-1` |
| `REACT_APP_S3_BUCKET` | Nome do bucket S3 | — |
| `REACT_APP_SENTRY_DSN` | Sentry DSN para error tracking | — |
| `REACT_APP_ENVIRONMENT` | Ambiente (development/staging/production) | `development` |
| `REACT_APP_SENTRY_SAMPLE_RATE` | Taxa de amostragem Sentry (0.0-1.0) | `1.0` |
| `REACT_APP_VERSION` | Versão da aplicação | — |

---

## Checklist de Deployment

### Pré-Deployment
- [ ] AWS CLI configurado
- [ ] Node.js 18+ e CDK instalados
- [ ] Python 3.11 instalado
- [ ] Token BRAPI configurado no Secrets Manager
- [ ] Arquivo universe.txt configurado
- [ ] Arquivo b3_holidays_2026.json configurado

### Deploy da Infraestrutura (5 Stacks)
- [ ] Dependências CDK instaladas (`cd infra && npm install`)
- [ ] Arquivo infra/.env configurado
- [ ] CDK bootstrap executado (primeira vez)
- [ ] InfraStack deployada com sucesso
- [ ] MonitoringStack deployada com sucesso
- [ ] SecurityStack deployada com sucesso
- [ ] OptimizationStack deployada com sucesso
- [ ] DisasterRecoveryStack deployada com sucesso
- [ ] Outputs salvos em outputs.json

### Configuração de Segurança
- [ ] KMS key criada e rotation habilitado
- [ ] DynamoDB tables criadas (APIKeys, AuthLogs, RateLimits)
- [ ] Security audit Lambda funcional

### Configuração de Monitoramento
- [ ] CloudWatch dashboard `B3-Dashboard-System-Health` criado
- [ ] Alarms configurados e em estado OK/INSUFFICIENT_DATA
- [ ] Email de alertas configurado e confirmado
- [ ] Sentry DSN configurado no dashboard

### Deploy do Dashboard
- [ ] API Key obtida
- [ ] Arquivo .env.production configurado
- [ ] Build executado com sucesso
- [ ] Dashboard deployado (GitHub Pages ou S3+CloudFront)
- [ ] GitHub Secrets configurados (para CI/CD)

### Validação
- [ ] Todas as Lambdas listadas e funcionais
- [ ] S3 bucket criado com estrutura correta
- [ ] API endpoints testados (recommendations, data-quality, drift, explainability)
- [ ] CloudWatch metrics sendo publicadas
- [ ] ElastiCache cluster operacional
- [ ] CloudFront distribution ativa

### Bootstrap e Dados
- [ ] Bootstrap histórico iniciado
- [ ] Progresso monitorado
- [ ] Validação histórica executada

### Dashboard (8 Abas)
- [ ] Dashboard acessível
- [ ] Recommendations: filtros, export, comparação funcionando
- [ ] Performance: model breakdown, confusion matrix, benchmarks
- [ ] Validation: scatter plots, temporal accuracy, outliers
- [ ] Costs: trends, optimization suggestions, budget alerts
- [ ] Data Quality: completeness, anomalies, freshness
- [ ] Drift Detection: data drift, concept drift, retraining
- [ ] Explainability: SHAP values, sensitivity analysis
- [ ] Backtesting: portfolio simulation, risk analysis
- [ ] Auto-refresh funcionando

---

## Suporte e Recursos

### Documentação Adicional
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [BRAPI Documentation](https://brapi.dev/docs)
- [Sentry React Documentation](https://docs.sentry.io/platforms/javascript/guides/react/)
- [ElastiCache Documentation](https://docs.aws.amazon.com/elasticache/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)

### Logs e Monitoramento
- CloudWatch Logs: `/aws/lambda/InfraStack-*`, `/aws/lambda/SecurityStack-*`
- CloudWatch Dashboard: `B3-Dashboard-System-Health`
- S3 Monitoring: `s3://$BUCKET_NAME/monitoring/`
- Sentry: `https://sentry.io` (frontend errors)

### Contato
- GitHub Issues: https://github.com/uesleisutil/b3-tactical-ranking/issues
- Email: seu-email@example.com

---

**Última atualização**: 2026-03-10  
**Versão do Sistema**: 4.0.0
