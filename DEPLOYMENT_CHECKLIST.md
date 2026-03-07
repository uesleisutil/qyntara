# 📋 Checklist de Deploy - Funcionalidades Avançadas

**Data**: 07/03/2026  
**Versão**: 2.1.0

---

## ✅ Pré-Deploy

### 1. Validar Código

- [x] Backtesting implementado
- [x] Portfolio Optimizer implementado
- [x] Stop Loss Calculator implementado
- [x] Sentiment Analyzer implementado
- [x] Interactive Charts implementado
- [x] Lambdas criadas
- [x] CDK atualizado
- [x] Dependências adicionadas (requirements.txt)
- [x] Sem erros de diagnóstico no TypeScript

### 2. Revisar Configurações

- [ ] Verificar schedules das Lambdas (horários corretos?)
- [ ] Verificar timeouts (suficientes?)
- [ ] Verificar memory size (adequada?)
- [ ] Verificar IAM permissions (todas necessárias?)

---

## 🚀 Deploy

### 1. Instalar Dependências Python

```bash
cd ml
pip install -r requirements.txt
```

**Verificar instalação**:
```bash
python -c "import scipy; import requests; import textblob; print('OK')"
```

### 2. Validar CDK

```bash
cd infra
npm install  # Se necessário
cdk synth
```

**Verificar output**:
- [ ] Template gerado sem erros
- [ ] 4 novas Lambdas no template
- [ ] 4 novos EventBridge rules
- [ ] 4 novos CloudWatch alarms

### 3. Deploy Infraestrutura

```bash
cdk deploy --all
```

**Aguardar**:
- Criação das Lambdas (~5 min)
- Criação dos EventBridge rules
- Criação dos CloudWatch alarms
- Atualização do dashboard

**Outputs esperados**:
```
B3TRStack.BacktestingLambda = B3TRStack-Backtesting-XXXXX
B3TRStack.PortfolioOptimizerLambda = B3TRStack-PortfolioOptimizer-XXXXX
B3TRStack.SentimentAnalysisLambda = B3TRStack-SentimentAnalysis-XXXXX
B3TRStack.StopLossCalculatorLambda = B3TRStack-StopLossCalculator-XXXXX
```

---

## 🧪 Pós-Deploy - Testes

### 1. Testar Backtesting Lambda

```bash
aws lambda invoke \
  --function-name $(aws cloudformation describe-stacks \
    --stack-name B3TRStack \
    --query 'Stacks[0].Outputs[?OutputKey==`BacktestingLambda`].OutputValue' \
    --output text) \
  --payload '{"bucket":"b3tr-200093399689-us-east-1","rolling_days":7}' \
  response.json

cat response.json
```

**Verificar**:
- [ ] statusCode: 200
- [ ] Mensagem de sucesso
- [ ] Arquivo criado no S3: `backtesting/dt=YYYY-MM-DD/results.json`

### 2. Testar Portfolio Optimizer Lambda

```bash
aws lambda invoke \
  --function-name $(aws cloudformation describe-stacks \
    --stack-name B3TRStack \
    --query 'Stacks[0].Outputs[?OutputKey==`PortfolioOptimizerLambda`].OutputValue' \
    --output text) \
  --payload '{"bucket":"b3tr-200093399689-us-east-1","capital":10000,"strategy":"max_sharpe"}' \
  response.json

cat response.json
```

**Verificar**:
- [ ] statusCode: 200
- [ ] Alocação gerada
- [ ] Arquivo criado no S3: `portfolio/dt=YYYY-MM-DD/allocation_max_sharpe.json`

### 3. Testar Stop Loss Calculator Lambda

```bash
aws lambda invoke \
  --function-name $(aws cloudformation describe-stacks \
    --stack-name B3TRStack \
    --query 'Stacks[0].Outputs[?OutputKey==`StopLossCalculatorLambda`].OutputValue' \
    --output text) \
  --payload '{"bucket":"b3tr-200093399689-us-east-1","account_balance":10000}' \
  response.json

cat response.json
```

**Verificar**:
- [ ] statusCode: 200
- [ ] Recomendações geradas
- [ ] Arquivo criado no S3: `risk_management/dt=YYYY-MM-DD/stop_loss_recommendations.json`

### 4. Testar Sentiment Analysis Lambda

**Nota**: Requer News API key

```bash
# Criar secret (se ainda não existe)
aws secretsmanager create-secret \
  --name news-api/key \
  --secret-string '{"api_key":"YOUR_NEWS_API_KEY"}'

# Invocar Lambda
aws lambda invoke \
  --function-name $(aws cloudformation describe-stacks \
    --stack-name B3TRStack \
    --query 'Stacks[0].Outputs[?OutputKey==`SentimentAnalysisLambda`].OutputValue' \
    --output text) \
  --payload '{"bucket":"b3tr-200093399689-us-east-1","ticker":"MGLU3"}' \
  response.json

cat response.json
```

**Verificar**:
- [ ] statusCode: 200
- [ ] Sentimento calculado
- [ ] Arquivo criado no S3: `sentiment/dt=YYYY-MM-DD/MGLU3.json`

---

## 📊 Verificar CloudWatch

### 1. Verificar Logs

```bash
# Backtesting
aws logs tail /aws/lambda/B3TRStack-Backtesting-XXXXX --follow

# Portfolio Optimizer
aws logs tail /aws/lambda/B3TRStack-PortfolioOptimizer-XXXXX --follow

# Sentiment Analysis
aws logs tail /aws/lambda/B3TRStack-SentimentAnalysis-XXXXX --follow

# Stop Loss Calculator
aws logs tail /aws/lambda/B3TRStack-StopLossCalculator-XXXXX --follow
```

**Verificar**:
- [ ] Sem erros nos logs
- [ ] Mensagens de sucesso
- [ ] Dados salvos no S3

### 2. Verificar Métricas

Acessar CloudWatch Dashboard:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=B3TR-ModelOptimization
```

**Verificar**:
- [ ] Invocations > 0 para cada Lambda
- [ ] Errors = 0
- [ ] Duration < timeout

### 3. Verificar Alarmes

```bash
aws cloudwatch describe-alarms \
  --alarm-names \
    B3TRStack-BacktestingFailedAlarm \
    B3TRStack-PortfolioOptimizerFailedAlarm \
    B3TRStack-SentimentAnalysisFailedAlarm \
    B3TRStack-StopLossCalculatorFailedAlarm
```

**Verificar**:
- [ ] Todos os alarmes em estado OK
- [ ] Nenhum alarme disparado

---

## 📁 Verificar S3

### 1. Verificar Estrutura de Pastas

```bash
aws s3 ls s3://b3tr-200093399689-us-east-1/ --recursive | grep -E "(backtesting|portfolio|risk_management|sentiment)"
```

**Estrutura esperada**:
```
backtesting/dt=2026-03-07/results.json
portfolio/dt=2026-03-07/allocation_max_sharpe.json
portfolio/dt=2026-03-07/allocation_min_variance.json
portfolio/dt=2026-03-07/allocation_risk_parity.json
risk_management/dt=2026-03-07/stop_loss_recommendations.json
sentiment/dt=2026-03-07/MGLU3.json
sentiment/dt=2026-03-07/PETR4.json
sentiment/dt=2026-03-07/aggregate_sentiment.json
```

### 2. Verificar Conteúdo dos Arquivos

```bash
# Backtesting
aws s3 cp s3://b3tr-200093399689-us-east-1/backtesting/dt=2026-03-07/results.json - | jq .

# Portfolio
aws s3 cp s3://b3tr-200093399689-us-east-1/portfolio/dt=2026-03-07/allocation_max_sharpe.json - | jq .

# Stop Loss
aws s3 cp s3://b3tr-200093399689-us-east-1/risk_management/dt=2026-03-07/stop_loss_recommendations.json - | jq .

# Sentiment
aws s3 cp s3://b3tr-200093399689-us-east-1/sentiment/dt=2026-03-07/aggregate_sentiment.json - | jq .
```

**Verificar**:
- [ ] JSON válido
- [ ] Dados completos
- [ ] Sem erros

---

## 🔔 Verificar EventBridge Rules

```bash
aws events list-rules --name-prefix B3TRStack
```

**Verificar regras criadas**:
- [ ] B3TRStack-BacktestingDaily
- [ ] B3TRStack-PortfolioOptimizerDaily
- [ ] B3TRStack-SentimentAnalysisDaily
- [ ] B3TRStack-StopLossCalculatorDaily

**Verificar schedules**:
```bash
aws events describe-rule --name B3TRStack-BacktestingDaily
aws events describe-rule --name B3TRStack-PortfolioOptimizerDaily
aws events describe-rule --name B3TRStack-SentimentAnalysisDaily
aws events describe-rule --name B3TRStack-StopLossCalculatorDaily
```

**Horários esperados (UTC)**:
- Backtesting: `cron(0 1 ? * MON-FRI *)` = 22:00 BRT
- Portfolio: `cron(50 21 ? * MON-FRI *)` = 18:50 BRT
- Sentiment: `cron(0 12 ? * MON-FRI *)` = 09:00 BRT
- Stop Loss: `cron(45 21 ? * MON-FRI *)` = 18:45 BRT

---

## 📱 Atualizar Dashboard (Opcional)

### 1. Adicionar Novos Componentes

Editar `dashboard/src/App.js`:

```javascript
import InteractiveCandlestickChart from './components/charts/InteractiveCandlestickChart';

// Adicionar nova aba "Análise Técnica"
// Adicionar seção "Portfolio Sugerido"
// Adicionar seção "Stop Loss/Take Profit"
// Adicionar seção "Sentimento do Mercado"
```

### 2. Deploy Dashboard

```bash
cd dashboard
npm run build
npm run deploy
```

**Verificar**:
- [ ] Build sem erros
- [ ] Deploy para GitHub Pages
- [ ] Dashboard acessível: https://uesleisutil.github.io/b3-tactical-ranking

---

## 🎉 Conclusão

### Checklist Final

- [ ] Todas as Lambdas deployadas
- [ ] Todos os testes passaram
- [ ] CloudWatch sem erros
- [ ] S3 com dados corretos
- [ ] EventBridge rules configuradas
- [ ] Alarmes funcionando
- [ ] Dashboard atualizado (opcional)

### Próximos Passos

1. **Monitorar por 24h**: Verificar se as Lambdas executam nos horários agendados
2. **Validar Dados**: Verificar qualidade dos dados gerados
3. **Ajustar Parâmetros**: Se necessário, ajustar timeouts, memory, schedules
4. **Documentar**: Atualizar documentação com resultados reais

---

## 🆘 Troubleshooting

### Lambda Timeout

**Problema**: Lambda excede timeout  
**Solução**: Aumentar timeout no CDK

```typescript
timeout: cdk.Duration.minutes(20),  // Era 15
```

### Lambda Out of Memory

**Problema**: Lambda fica sem memória  
**Solução**: Aumentar memory size no CDK

```typescript
memorySize: 3008,  // Era 2048
```

### News API Limit

**Problema**: Sentiment analysis falha por limite de API  
**Solução**: 
1. Usar plano pago do News API
2. Ou reduzir frequência (semanal ao invés de diário)

### Backtesting Sem Dados

**Problema**: Backtesting não encontra predições antigas  
**Solução**: Aguardar 20 dias para ter dados históricos suficientes

---

**Preparado por**: Kiro AI  
**Data**: 07/03/2026  
**Versão**: 2.1.0

✅ Sistema pronto para deploy!
