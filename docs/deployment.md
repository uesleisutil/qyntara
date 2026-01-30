# Guia de Deployment

## 🚀 Deploy Rápido (5 minutos)

### Pré-requisitos
- AWS CLI configurado
- Node.js 18+
- Token BRAPI Pro

### 1. Clone e Configure
```bash
git clone <repo-url>
cd b3-tactical-ranking
cp .env.example .env
# Edite .env com suas configurações
```

### 2. Deploy da Infraestrutura
```bash
cd infra
npm ci
cdk bootstrap
cdk deploy --require-approval never
```

### 3. Configure o Token BRAPI
```bash
aws secretsmanager create-secret \
  --name "brapi/pro/token" \
  --secret-string '{"token":"SEU_TOKEN_AQUI"}'
```

### 4. Configure Email de Alertas
```bash
aws sns subscribe \
  --topic-arn $(aws cloudformation describe-stacks \
    --stack-name B3TacticalRankingStack \
    --query 'Stacks[0].Outputs[?OutputKey==`AlertsTopicArn`].OutputValue' \
    --output text) \
  --protocol email \
  --notification-endpoint your-email@example.com
```

### 5. Verifique o Sistema
```bash
# Teste o bootstrap
aws lambda invoke \
  --function-name $(aws lambda list-functions \
    --query "Functions[?contains(FunctionName, 'Bootstrap')].FunctionName" \
    --output text) \
  --payload '{}' /tmp/test.json

cat /tmp/test.json
```

## ⚙️ Configurações Avançadas

### Variáveis de Ambiente Importantes

| Variável | Descrição | Padrão |
|----------|-----------|---------|
| `B3TR_SCHEDULE_MINUTES` | Intervalo de ingestão | 5 |
| `B3TR_CONTEXT_LENGTH` | Janela do modelo | 60 |
| `B3TR_PREDICTION_LENGTH` | Horizonte de previsão | 20 |
| `B3TR_TOP_N` | Top N do ranking | 10 |
| `ALERT_EMAIL` | Email para alertas | - |

### Customização do Universe
Edite `config/universe.txt` com os tickers desejados:
```
PETR4.SA
VALE3.SA
ITUB4.SA
BBDC4.SA
ABEV3.SA
```

### Horários de Execução
O sistema usa UTC. Para BRT (UTC-3):
- Pregão: 10:00-17:55 BRT = 13:00-20:55 UTC
- Ranking: 18:10 BRT = 21:10 UTC

## 🔧 Troubleshooting

### Erro: "Unable to import module pandas"
**Solução**: O sistema usa AWS managed layer. Verifique se está na região us-east-1.

### Erro: "AccessDenied on brapi/pro/token"
**Solução**: 
```bash
aws secretsmanager put-secret-value \
  --secret-id brapi/pro/token \
  --secret-string '{"token":"SEU_TOKEN"}'
```

### Lambda timeout
**Solução**: Aumente o timeout no CDK (padrão: 10 minutos).

### Dados não aparecem no S3
**Solução**: Verifique se está no horário de pregão e se o token BRAPI está válido.

## 📊 Monitoramento

### CloudWatch Dashboards
Acesse: AWS Console > CloudWatch > Dashboards

### Métricas Importantes
- `B3TR/IngestionOK`: 1 = sucesso, 0 = falha
- `B3TR/ModelMAPE`: Erro percentual do modelo

### Logs
- `/aws/lambda/B3TacticalRankingStack-*`

## 🔄 Atualizações

### Deploy de Mudanças
```bash
cd infra
cdk deploy
```

### Rollback
```bash
cd infra
cdk deploy --previous-parameters
```

### Backup
O S3 mantém versionamento automático dos dados críticos.