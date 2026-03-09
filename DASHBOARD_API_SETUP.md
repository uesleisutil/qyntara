# 🔐 Dashboard API Setup - Acesso Seguro e Proprietário

**Data**: 09/03/2026  
**Status**: Implementado com API Gateway + API Key

---

## 🎯 Solução Implementada

Sistema 100% proprietário com controle total de acesso:

- ✅ **API Gateway** com autenticação via API Key
- ✅ **Rate Limiting**: 100 req/s, burst 200
- ✅ **Quota**: 10.000 requests/dia
- ✅ **CORS** configurado para dashboard
- ✅ **Nenhum dado exposto publicamente**
- ✅ **Pronto para monetização futura**

---

## 📋 Após o Deploy

### 1. Obter a API Key

```bash
# Pegar o Key ID dos outputs do CDK
aws cloudformation describe-stacks \
  --stack-name B3TacticalRankingStackV2 \
  --query 'Stacks[0].Outputs[?OutputKey==`DashboardApiKeyId`].OutputValue' \
  --output text

# Usar o Key ID para obter o valor da API Key
aws apigateway get-api-key \
  --api-key YOUR_KEY_ID \
  --include-value \
  --query 'value' \
  --output text
```

### 2. Obter a URL da API

```bash
aws cloudformation describe-stacks \
  --stack-name B3TacticalRankingStackV2 \
  --query 'Stacks[0].Outputs[?OutputKey==`DashboardApiUrl`].OutputValue' \
  --output text
```

---

## 🔧 Configurar o Dashboard

### Opção 1: GitHub Secrets (Recomendado para produção)

```bash
# Adicionar secrets no GitHub
gh secret set REACT_APP_API_URL --body "https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod"
gh secret set REACT_APP_API_KEY --body "YOUR_API_KEY_VALUE"
```

### Opção 2: Arquivo .env.local (Desenvolvimento local)

Criar `dashboard/.env.local`:

```bash
# API Configuration
REACT_APP_API_URL=https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod
REACT_APP_API_KEY=YOUR_API_KEY_VALUE
```

---

## 📡 Endpoints Disponíveis

### 1. Recomendações
```
GET /recommendations
```

**Headers**:
```
X-Api-Key: YOUR_API_KEY
```

**Response**:
```json
{
  "recommendations": [
    {
      "ticker": "BBDC4",
      "score": 0.9422,
      "rank": 1,
      "predicted_return": 0.0348,
      "confidence": 0.847,
      "sector": "Bancos",
      "dt": "2026-03-08"
    }
  ],
  "last_updated": "2026-03-08T20:00:09Z",
  "file_key": "recommendations/dt=2026-03-08/top50.json"
}
```

### 2. Qualidade do Modelo
```
GET /quality
```

**Response**:
```json
{
  "quality_data": [
    {
      "dt": "2026-03-08",
      "mape": 0.15,
      "rmse": 0.023,
      "coverage": 0.95
    }
  ],
  "count": 30
}
```

### 3. Status de Ingestão
```
GET /ingestion
```

**Response**:
```json
{
  "ingestion_data": [...],
  "summary": {
    "total_records": 96,
    "successful": 96,
    "success_rate": 1.0,
    "last_48_hours": true
  }
}
```

---

## 🔒 Segurança

### Rate Limiting
- **Rate**: 100 requests/segundo
- **Burst**: 200 requests
- **Quota**: 10.000 requests/dia

### Proteções Implementadas
- ✅ API Key obrigatória
- ✅ CORS restrito
- ✅ Throttling configurado
- ✅ Logs de acesso no CloudWatch
- ✅ Métricas de uso

### Monitoramento
```bash
# Ver uso da API
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=B3TRDashboardAPI \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

---

## 💰 Custos

### API Gateway
- **Primeiros 333 milhões de requests/mês**: $3.50 por milhão
- **Próximos 667 milhões**: $2.80 por milhão
- **Acima de 1 bilhão**: $2.38 por milhão

### Estimativa para o Dashboard
- **Usuários**: 100 usuários/dia
- **Requests por usuário**: 10 requests
- **Total mensal**: ~30.000 requests
- **Custo**: ~$0.10/mês

**Praticamente grátis!**

---

## 🚀 Deploy

### 1. Deploy da Infraestrutura
```bash
cd infra
npm run build
cdk deploy --all
```

### 2. Configurar Dashboard
```bash
# Obter API Key
API_KEY=$(aws apigateway get-api-key \
  --api-key $(aws cloudformation describe-stacks \
    --stack-name B3TacticalRankingStackV2 \
    --query 'Stacks[0].Outputs[?OutputKey==`DashboardApiKeyId`].OutputValue' \
    --output text) \
  --include-value \
  --query 'value' \
  --output text)

# Obter API URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name B3TacticalRankingStackV2 \
  --query 'Stacks[0].Outputs[?OutputKey==`DashboardApiUrl`].OutputValue' \
  --output text)

# Configurar GitHub Secrets
gh secret set REACT_APP_API_URL --body "$API_URL"
gh secret set REACT_APP_API_KEY --body "$API_KEY"
```

### 3. Rebuild Dashboard
```bash
cd dashboard
npm run build
npm run deploy
```

---

## 🧪 Testar a API

### Com curl
```bash
API_KEY="your-api-key"
API_URL="https://your-api-id.execute-api.us-east-1.amazonaws.com/prod"

# Testar recomendações
curl -H "X-Api-Key: $API_KEY" "$API_URL/recommendations"

# Testar qualidade
curl -H "X-Api-Key: $API_KEY" "$API_URL/quality"

# Testar ingestão
curl -H "X-Api-Key: $API_KEY" "$API_URL/ingestion"
```

### Com JavaScript (Dashboard)
```javascript
const API_URL = process.env.REACT_APP_API_URL;
const API_KEY = process.env.REACT_APP_API_KEY;

const response = await fetch(`${API_URL}/recommendations`, {
  headers: {
    'X-Api-Key': API_KEY,
  },
});

const data = await response.json();
console.log(data.recommendations);
```

---

## 📊 Vantagens da Solução

### Para Desenvolvimento
- ✅ Controle total de acesso
- ✅ Fácil de testar localmente
- ✅ Logs detalhados no CloudWatch
- ✅ Métricas de uso

### Para Produção
- ✅ Escalável (milhões de requests)
- ✅ Seguro (API Key + Rate Limiting)
- ✅ Barato (~$0.10/mês)
- ✅ Monitorável

### Para Monetização Futura
- ✅ Múltiplas API Keys (diferentes clientes)
- ✅ Usage Plans customizados
- ✅ Billing por uso
- ✅ Analytics detalhados

---

## 🔄 Rotação de API Key

### Criar Nova Key
```bash
aws apigateway create-api-key \
  --name b3tr-dashboard-key-v2 \
  --enabled \
  --query 'value' \
  --output text
```

### Associar ao Usage Plan
```bash
USAGE_PLAN_ID=$(aws apigateway get-usage-plans \
  --query 'items[?name==`B3TR Dashboard Usage Plan`].id' \
  --output text)

aws apigateway create-usage-plan-key \
  --usage-plan-id $USAGE_PLAN_ID \
  --key-id NEW_KEY_ID \
  --key-type API_KEY
```

### Remover Key Antiga
```bash
aws apigateway delete-api-key --api-key OLD_KEY_ID
```

---

## ✅ Checklist de Configuração

- [ ] Deploy da infraestrutura executado
- [ ] API Key obtida
- [ ] API URL obtida
- [ ] GitHub Secrets configurados
- [ ] Dashboard rebuilded
- [ ] API testada com curl
- [ ] Dashboard acessando API com sucesso

---

**Status**: 🟢 Pronto para deploy  
**Segurança**: 🔒 100% proprietário  
**Custo**: 💰 ~$0.10/mês  
**Preparado por**: Kiro AI  
**Data**: 09/03/2026
