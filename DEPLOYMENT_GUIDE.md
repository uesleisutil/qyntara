# Guia de Deployment - B3 Tactical Ranking MLOps System

**Versão**: 3.0.0  
**Data**: 2026-03-10  
**Status**: 📋 PRODUÇÃO

## Visão Geral

Este guia fornece instruções completas para fazer o deployment do sistema ML Monitoring, Governance & Dashboard da B3 na AWS.

---

## Pré-requisitos

### 1. Ferramentas Necessárias

```bash
# AWS CLI v2
aws --version  # >= 2.0.0

# Node.js e npm
node --version  # >= 18.0.0
npm --version   # >= 9.0.0

# AWS CDK
npm install -g aws-cdk
cdk --version   # >= 2.0.0

# Python
python3 --version  # >= 3.11

# jq (para processar JSON)
jq --version
```

### 2. Credenciais AWS

```bash
# Configurar credenciais AWS
aws configure

# Verificar acesso
aws sts get-caller-identity
```

### 3. Variáveis de Ambiente

```bash
# Definir região AWS
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
# Criar secret no Secrets Manager
aws secretsmanager create-secret \
  --name brapi/pro/token \
  --description "BRAPI Pro API Token" \
  --secret-string '{"token":"SEU_TOKEN_AQUI"}'

# Verificar
aws secretsmanager get-secret-value --secret-id brapi/pro/token
```

**Alternativa**: Usar script automatizado:

```bash
cd infra/scripts
chmod +x setup-secrets.sh
./setup-secrets.sh
```

### 1.3 Configurar Arquivo de Universo

```bash
# Editar lista de tickers
vim config/universe.txt

# Exemplo de conteúdo (50 tickers):
PETR4
VALE3
ITUB4
BBDC4
ABEV3
# ... (adicionar 45 tickers)
```

### 1.4 Configurar Feriados B3

```bash
# Verificar arquivo de feriados
cat config/b3_holidays_2026.json

# Formato esperado:
{
  "holidays": [
    "2026-01-01",
    "2026-02-16",
    "2026-02-17",
    ...
  ]
}
```

---

## Parte 2: Deploy da Infraestrutura AWS

### 2.1 Instalar Dependências CDK

```bash
cd infra
npm install
```

### 2.2 Configurar Variáveis de Ambiente

```bash
# Criar arquivo .env
cat > .env << EOF
# Bucket Configuration
B3TR_BUCKET_PREFIX=b3tr

# BRAPI Configuration
BRAPI_SECRET_ID=brapi/pro/token

# Schedule Configuration
B3TR_SCHEDULE_MINUTES=5
B3_OPEN_HOUR_UTC=13
B3_CLOSE_HOUR_UTC=20

# Model Configuration
B3TR_CONTEXT_LENGTH=60
B3TR_PREDICTION_LENGTH=20
B3TR_TEST_DAYS=60
B3TR_MIN_POINTS=252
B3TR_TOP_N=50

# SageMaker Configuration
DEEPAR_IMAGE_URI=382416733822.dkr.ecr.us-east-1.amazonaws.com/forecasting-deepar:1
ENSEMBLE_IMAGE_URI=

# Monitoring Configuration
INGEST_LOOKBACK_MINUTES=15

# SSM Configuration
B3TR_SSM_PREFIX=/b3tr

# Bootstrap Configuration
B3TR_HISTORY_RANGE=10y
BOOTSTRAP_TICKERS_PER_RUN=10
BOOTSTRAP_SLEEP_S=0.2

# Alerts Configuration (opcional)
ALERT_EMAIL=seu-email@example.com
EOF
```

### 2.3 Bootstrap CDK (primeira vez apenas)

```bash
cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION
```

### 2.4 Sintetizar Stack

```bash
# Verificar template CloudFormation
cdk synth

# Verificar diferenças (se já deployado)
cdk diff
```

### 2.5 Deploy da Stack

```bash
# Deploy completo
cdk deploy --require-approval never

# Ou com aprovação manual
cdk deploy
```

**Tempo estimado**: 10-15 minutos

**Outputs esperados**:
```
Outputs:
InfraStack.BucketName = b3tr-123456789012-us-east-1
InfraStack.AlertsTopicArn = arn:aws:sns:us-east-1:123456789012:b3tr-alerts
InfraStack.SageMakerRoleArn = arn:aws:iam::123456789012:role/InfraStack-B3TRSageMakerRole...
InfraStack.DashboardApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com/prod/
InfraStack.DashboardApiKeyId = abc123xyz
```

### 2.6 Salvar Outputs

```bash
# Salvar outputs em arquivo
cdk deploy --outputs-file outputs.json

# Extrair valores importantes
export BUCKET_NAME=$(jq -r '.InfraStack.BucketName' outputs.json)
export API_URL=$(jq -r '.InfraStack.DashboardApiUrl' outputs.json)
export API_KEY_ID=$(jq -r '.InfraStack.DashboardApiKeyId' outputs.json)

echo "BUCKET_NAME=$BUCKET_NAME"
echo "API_URL=$API_URL"
echo "API_KEY_ID=$API_KEY_ID"
```

---

## Parte 3: Configuração de EventBridge Schedules

### 3.1 Verificar Schedules Criados

```bash
# Listar todas as rules
aws events list-rules --name-prefix InfraStack

# Verificar targets de uma rule específica
aws events list-targets-by-rule --rule InfraStack-IngestDuringB3
```

### 3.2 Habilitar/Desabilitar Schedules

```bash
# Desabilitar schedule (para manutenção)
aws events disable-rule --name InfraStack-IngestDuringB3

# Habilitar schedule
aws events enable-rule --name InfraStack-IngestDuringB3
```

### 3.3 Testar Schedule Manualmente

```bash
# Invocar Lambda manualmente
aws lambda invoke \
  --function-name InfraStack-Quotes5mIngest \
  --payload '{}' \
  response.json

cat response.json
```

---

## Parte 4: Configuração do Dashboard

### 4.1 Obter API Key

```bash
# Obter valor da API Key
export API_KEY=$(aws apigateway get-api-key \
  --api-key $API_KEY_ID \
  --include-value \
  --query 'value' \
  --output text)

echo "API_KEY=$API_KEY"
```

### 4.2 Configurar Dashboard React

```bash
cd dashboard

# Criar arquivo .env.production
cat > .env.production << EOF
REACT_APP_API_URL=$API_URL
REACT_APP_API_KEY=$API_KEY
EOF
```

### 4.3 Instalar Dependências

```bash
npm install
```

### 4.4 Buildar Dashboard

```bash
# Build para produção
npm run build

# Verificar build
ls -lh build/
```

### 4.5 Deploy do Dashboard

**Opção 1: GitHub Pages (Recomendado)**

```bash
# Instalar gh-pages
npm install --save-dev gh-pages

# Adicionar scripts no package.json
# "predeploy": "npm run build",
# "deploy": "gh-pages -d build"

# Deploy
npm run deploy
```

**Opção 2: S3 + CloudFront**

```bash
# Criar bucket para dashboard
aws s3 mb s3://b3tr-dashboard-$AWS_ACCOUNT_ID

# Configurar como website
aws s3 website s3://b3tr-dashboard-$AWS_ACCOUNT_ID \
  --index-document index.html \
  --error-document index.html

# Upload dos arquivos
aws s3 sync build/ s3://b3tr-dashboard-$AWS_ACCOUNT_ID/ \
  --delete \
  --cache-control "max-age=31536000"

# Configurar CloudFront (opcional)
# ... (ver documentação AWS)
```

**Opção 3: Servir Localmente (Desenvolvimento)**

```bash
# Servir build localmente
npx serve -s build -p 3000

# Acessar: http://localhost:3000
```

---

## Parte 5: Validação do Deployment

### 5.1 Verificar Lambdas

```bash
# Listar todas as Lambdas
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `InfraStack`)].FunctionName'

# Verificar logs de uma Lambda
aws logs tail /aws/lambda/InfraStack-Quotes5mIngest --follow
```

### 5.2 Verificar S3 Bucket

```bash
# Listar conteúdo do bucket
aws s3 ls s3://$BUCKET_NAME/ --recursive

# Verificar estrutura de pastas
aws s3 ls s3://$BUCKET_NAME/
```

### 5.3 Verificar API Gateway

```bash
# Testar endpoint de recomendações
curl -H "X-Api-Key: $API_KEY" \
  ${API_URL}api/recommendations/latest | jq .

# Testar endpoint de qualidade
curl -H "X-Api-Key: $API_KEY" \
  "${API_URL}api/monitoring/data-quality?days=30" | jq .
```

### 5.4 Verificar CloudWatch Metrics

```bash
# Ver métricas de ingestão
aws cloudwatch get-metric-statistics \
  --namespace B3TR \
  --metric-name IngestionOK \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Minimum
```

### 5.5 Verificar Alarms

```bash
# Listar alarms
aws cloudwatch describe-alarms --alarm-name-prefix InfraStack

# Ver estado de um alarm
aws cloudwatch describe-alarms --alarm-names InfraStack-IngestionFailedAlarm
```

---

## Parte 6: Configuração de Alertas

### 6.1 Configurar Email para Alertas

```bash
# Obter ARN do SNS topic
TOPIC_ARN=$(aws cloudformation describe-stacks \
  --stack-name InfraStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AlertsTopicArn`].OutputValue' \
  --output text)

# Adicionar subscription de email
aws sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol email \
  --notification-endpoint seu-email@example.com

# Confirmar subscription no email recebido
```

### 6.2 Testar Alertas

```bash
# Publicar mensagem de teste
aws sns publish \
  --topic-arn $TOPIC_ARN \
  --subject "Teste de Alerta B3TR" \
  --message "Este é um teste de alerta do sistema B3TR"
```

---

## Parte 7: Bootstrap de Dados Históricos

### 7.1 Executar Bootstrap Inicial

```bash
# Invocar Lambda de bootstrap manualmente
aws lambda invoke \
  --function-name InfraStack-BootstrapHistoryDaily \
  --payload '{}' \
  response.json

cat response.json
```

**Nota**: O bootstrap roda automaticamente a cada 30 minutos via EventBridge. Ele é idempotente e incremental.

### 7.2 Monitorar Progresso do Bootstrap

```bash
# Ver logs do bootstrap
aws logs tail /aws/lambda/InfraStack-BootstrapHistoryDaily --follow

# Verificar dados no S3
aws s3 ls s3://$BUCKET_NAME/quotes_5m/ --recursive | wc -l
```

### 7.3 Executar Validação Histórica

```bash
# Invocar Lambda de validação histórica
aws lambda invoke \
  --function-name InfraStack-HistoricalDataValidator \
  --payload '{}' \
  response.json

# Ver relatório de validação
aws s3 cp s3://$BUCKET_NAME/monitoring/validation/historical_data_report_$(date +%Y-%m-%d).json - | jq .
```

---

## Parte 8: Troubleshooting

### 8.1 Lambda Timeout

**Problema**: Lambda timeout após 10 minutos

**Solução**:
```bash
# Aumentar timeout (máximo 15 minutos)
aws lambda update-function-configuration \
  --function-name InfraStack-Quotes5mIngest \
  --timeout 900
```

### 8.2 Erro de Permissão S3

**Problema**: AccessDenied ao acessar S3

**Solução**:
```bash
# Verificar policy da Lambda
aws iam get-role-policy \
  --role-name InfraStack-Quotes5mIngestRole \
  --policy-name InfraStack-Quotes5mIngestRoleDefaultPolicy

# Re-deploy se necessário
cd infra
cdk deploy
```

### 8.3 API Gateway 403 Forbidden

**Problema**: API retorna 403 Forbidden

**Solução**:
```bash
# Verificar se API Key está correta
echo $API_KEY

# Obter nova API Key
export API_KEY=$(aws apigateway get-api-key \
  --api-key $API_KEY_ID \
  --include-value \
  --query 'value' \
  --output text)

# Testar novamente
curl -H "X-Api-Key: $API_KEY" ${API_URL}api/recommendations/latest
```

### 8.4 Dashboard Não Carrega Dados

**Problema**: Dashboard exibe erro ao carregar dados

**Solução**:
```bash
# Verificar se API_URL e API_KEY estão corretos no .env.production
cat dashboard/.env.production

# Verificar logs do navegador (F12 > Console)

# Testar API diretamente
curl -H "X-Api-Key: $API_KEY" ${API_URL}api/recommendations/latest

# Re-buildar dashboard
cd dashboard
npm run build
```

### 8.5 Custos Acima do Esperado

**Problema**: Custos mensais > R$500

**Solução**:
```bash
# Ver relatório de custos
aws s3 cp s3://$BUCKET_NAME/monitoring/costs/dt=$(date +%Y-%m-%d)/costs_*.json - | jq .

# Desabilitar schedules não essenciais
aws events disable-rule --name InfraStack-BootstrapHistorySchedule

# Reduzir frequência de ingestão (editar infra/.env e re-deploy)
# B3TR_SCHEDULE_MINUTES=10  # De 5 para 10 minutos
```

---

## Parte 9: Manutenção

### 9.1 Atualizar Código das Lambdas

```bash
# Fazer alterações no código
vim ml/src/lambdas/ingest_quotes.py

# Re-deploy
cd infra
cdk deploy
```

### 9.2 Atualizar Dashboard

```bash
# Fazer alterações no código
vim dashboard/src/App.js

# Re-buildar e re-deploy
cd dashboard
npm run build
npm run deploy  # Se usando GitHub Pages
```

### 9.3 Backup de Dados

```bash
# Criar snapshot do bucket S3
aws s3 sync s3://$BUCKET_NAME/ ./backup-$(date +%Y%m%d)/ --exclude "*.pyc"

# Ou usar S3 Replication (configurar via Console)
```

### 9.4 Monitoramento Contínuo

```bash
# Ver dashboard do CloudWatch
aws cloudwatch get-dashboard \
  --dashboard-name B3TR-AdvancedFeatures

# Acessar via Console
echo "https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#dashboards:name=B3TR-AdvancedFeatures"
```

---

## Parte 10: Rollback e Destruição

### 10.1 Rollback de Deployment

```bash
# Ver histórico de deployments
aws cloudformation describe-stack-events --stack-name InfraStack

# Rollback para versão anterior (se deployment falhou)
aws cloudformation cancel-update-stack --stack-name InfraStack
```

### 10.2 Destruir Stack (CUIDADO!)

```bash
# Desabilitar proteção de deleção do bucket (se configurado)
aws s3api put-bucket-versioning \
  --bucket $BUCKET_NAME \
  --versioning-configuration Status=Suspended

# Esvaziar bucket
aws s3 rm s3://$BUCKET_NAME/ --recursive

# Destruir stack
cd infra
cdk destroy

# Confirmar: yes
```

**ATENÇÃO**: Isso irá deletar TODOS os recursos, incluindo dados históricos!

---

## Checklist de Deployment

### Pré-Deployment
- [ ] AWS CLI configurado
- [ ] Node.js e CDK instalados
- [ ] Python 3.11 instalado
- [ ] Token BRAPI configurado no Secrets Manager
- [ ] Arquivo universe.txt configurado
- [ ] Arquivo b3_holidays_2026.json configurado

### Deployment da Infraestrutura
- [ ] Dependências CDK instaladas
- [ ] Arquivo .env configurado
- [ ] CDK bootstrap executado (primeira vez)
- [ ] CDK synth executado sem erros
- [ ] CDK deploy executado com sucesso
- [ ] Outputs salvos

### Configuração de EventBridge
- [ ] Schedules criados e habilitados
- [ ] Targets apontando para Lambdas corretas
- [ ] Teste manual de Lambda executado

### Deployment do Dashboard
- [ ] API Key obtida
- [ ] Arquivo .env.production configurado
- [ ] Dependências instaladas
- [ ] Build executado com sucesso
- [ ] Dashboard deployado (GitHub Pages ou S3)

### Validação
- [ ] Lambdas listadas e funcionais
- [ ] S3 bucket criado com estrutura correta
- [ ] API Gateway endpoints testados
- [ ] CloudWatch metrics publicadas
- [ ] Alarms configurados
- [ ] Email de alertas configurado

### Bootstrap e Dados
- [ ] Bootstrap histórico iniciado
- [ ] Progresso monitorado
- [ ] Validação histórica executada

### Dashboard
- [ ] Dashboard acessível
- [ ] 3 abas carregando dados
- [ ] Auto-refresh funcionando
- [ ] Performance dentro dos requisitos

---

## Suporte e Recursos

### Documentação Adicional
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [BRAPI Documentation](https://brapi.dev/docs)

### Logs e Monitoramento
- CloudWatch Logs: `/aws/lambda/InfraStack-*`
- CloudWatch Dashboard: `B3TR-AdvancedFeatures`
- S3 Monitoring: `s3://$BUCKET_NAME/monitoring/`

### Contato
- GitHub Issues: https://github.com/uesleisutil/b3-tactical-ranking/issues
- Email: seu-email@example.com

---

**Última atualização**: 2026-03-10  
**Versão do Sistema**: 3.0.0

