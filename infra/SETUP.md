# Setup de Infraestrutura - B3 Tactical Ranking

Este documento descreve como configurar a infraestrutura AWS para o sistema de monitoramento, governança e dashboard.

## Pré-requisitos

- AWS CLI configurado com credenciais válidas
- Node.js 18+ e npm instalados
- AWS CDK instalado: `npm install -g aws-cdk`
- Token BRAPI Pro (obtenha em https://brapi.dev)

## 1. Configurar AWS Secrets Manager

O sistema usa AWS Secrets Manager para armazenar o token BRAPI de forma segura.

```bash
# Configurar o token BRAPI
./infra/scripts/setup-secrets.sh "seu-token-brapi-aqui"
```

Isso criará um secret chamado `brapi/pro/token` com o formato:
```json
{
  "token": "seu-token-brapi-aqui"
}
```

## 2. Validar Segurança

Antes de fazer commit, sempre valide que não há credenciais expostas:

```bash
./infra/scripts/validate-no-secrets.sh
```

Este script verifica:
- ✅ Nenhuma AWS Access Key hardcoded
- ✅ Nenhum token ou senha hardcoded
- ✅ Nenhum arquivo `.env` commitado (exceto `.env.example`)

## 3. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo e configure suas variáveis:

```bash
cp .env.example .env
cp infra/.env.example infra/.env
```

Edite `infra/.env` com suas configurações:

```bash
# AWS
AWS_REGION=us-east-1

# BRAPI Secret
BRAPI_SECRET_ID=brapi/pro/token

# Bucket
B3TR_BUCKET_PREFIX=b3tr

# Alertas
ALERT_EMAIL=seu-email@example.com
```

**IMPORTANTE**: Nunca commite o arquivo `.env`! Ele está no `.gitignore`.

## 4. Deploy da Infraestrutura

```bash
cd infra

# Instalar dependências
npm install

# Bootstrap CDK (primeira vez apenas)
cdk bootstrap

# Deploy
cdk deploy
```

O deploy criará:

### S3 Bucket
- Nome: `b3tr-{account-id}-{region}`
- Estrutura de pastas:
  ```
  config/                          # Configurações
  quotes_5m/dt=YYYY-MM-DD/        # Dados brutos
  recommendations/dt=YYYY-MM-DD/   # Recomendações
  monitoring/
    ├── ingestion/dt=YYYY-MM-DD/
    ├── data_quality/dt=YYYY-MM-DD/
    ├── lineage/dt=YYYY-MM-DD/
    ├── performance/dt=YYYY-MM-DD/
    ├── drift/dt=YYYY-MM-DD/
    ├── costs/dt=YYYY-MM-DD/
    ├── ensemble_weights/dt=YYYY-MM-DD/
    ├── api_latency/dt=YYYY-MM-DD/
    ├── completeness/dt=YYYY-MM-DD/
    ├── errors/dt=YYYY-MM-DD/
    └── validation/
  ```

### Lambda Functions
- `Quotes5mIngest`: Coleta dados da BRAPI
- `DataQuality`: Valida qualidade dos dados
- `HistoricalValidator`: Valida dados históricos
- `PerformanceMonitor`: Monitora performance do modelo
- `DriftMonitor`: Detecta drift
- `CostMonitor`: Monitora custos AWS
- `DashboardAPI`: API para o dashboard

### EventBridge Schedules
- Ingestão: A cada 5 minutos durante pregão (10:00-18:00 BRT)
- Data Quality: Diário às 19:00 BRT
- Performance Monitor: Diário às 20:00 BRT
- Drift Monitor: Diário às 20:30 BRT
- Cost Monitor: Diário às 21:00 BRT

### IAM Roles e Policies
- Lambdas com acesso ao S3 (read/write)
- Lambdas com acesso ao Secrets Manager (read-only)
- Lambdas com permissão para publicar métricas no CloudWatch
- SageMaker role para training e inference

### CloudWatch Alarms
- Alerta de falha de ingestão
- Alerta de drift detectado
- Alerta de custo acima do threshold (R$500/mês)

## 5. Verificar Deploy

Após o deploy, verifique os outputs:

```bash
cdk deploy --outputs-file outputs.json
cat outputs.json
```

Outputs esperados:
- `BucketName`: Nome do bucket S3
- `AlertsTopicArn`: ARN do tópico SNS para alertas
- `SageMakerRoleArn`: ARN da role do SageMaker
- `DashboardApiUrl`: URL da API do dashboard
- `DashboardApiKeyId`: ID da API key

## 6. Configurar Alertas

Se você configurou `ALERT_EMAIL` no `.env`, confirme a inscrição no SNS:

1. Verifique seu email
2. Clique no link de confirmação do AWS SNS
3. Você receberá alertas quando:
   - Ingestão falhar
   - Drift for detectado
   - Custos ultrapassarem o threshold

## 7. Estrutura de Custos

Custos estimados (região us-east-1):

| Serviço | Uso Mensal | Custo Estimado |
|---------|------------|----------------|
| Lambda | ~50k invocações | $0.10 |
| S3 | ~10 GB storage | $0.23 |
| CloudWatch | Logs + métricas | $5.00 |
| Secrets Manager | 1 secret | $0.40 |
| **Total** | | **~$5.73/mês** |

**Limite configurado**: R$500/mês (~$100/mês)

## 8. Troubleshooting

### Secret não encontrado
```bash
# Verificar se o secret existe
aws secretsmanager describe-secret --secret-id brapi/pro/token

# Recriar o secret
./infra/scripts/setup-secrets.sh "seu-token"
```

### Lambda sem permissão
```bash
# Verificar IAM role da Lambda
aws lambda get-function --function-name <function-name>

# Redeploy para atualizar permissões
cdk deploy
```

### Bucket não criado
```bash
# Verificar se o bucket existe
aws s3 ls | grep b3tr

# Verificar CloudFormation stack
aws cloudformation describe-stacks --stack-name InfraStack
```

## 9. Limpeza

Para remover toda a infraestrutura:

```bash
cd infra

# ATENÇÃO: Isso deletará TODOS os recursos!
cdk destroy

# Remover o secret manualmente (não é deletado pelo CDK)
aws secretsmanager delete-secret --secret-id brapi/pro/token --force-delete-without-recovery
```

## 10. Próximos Passos

Após o setup da infraestrutura:

1. ✅ Infraestrutura configurada
2. ⏭️ Implementar Lambdas de ingestão e governança (Task 2)
3. ⏭️ Implementar monitoramento de modelo (Task 8-9)
4. ⏭️ Implementar monitoramento de custos (Task 11)
5. ⏭️ Implementar Dashboard API (Task 13)
6. ⏭️ Implementar Dashboard React (Task 14-18)

## Referências

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [BRAPI Documentation](https://brapi.dev/docs)
