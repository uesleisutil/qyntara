# 🚀 Instruções de Deploy - B3 Tactical Ranking

## Status Atual

✅ Dashboard deployado no GitHub Pages  
❌ Infraestrutura AWS não deployada (por isso não há dados)

---

## Por que o Dashboard está vazio?

O dashboard está funcionando perfeitamente, mas não há dados porque:
1. A infraestrutura AWS (Lambdas, S3, EventBridge) ainda não foi deployada
2. Sem a infraestrutura, não há:
   - Ingestão de dados da B3
   - Treinamento de modelos
   - Geração de recomendações
   - Métricas de monitoramento

---

## 📋 Pré-requisitos para Deploy

### 1. Credenciais AWS
```bash
# Verificar se as credenciais estão configuradas
aws sts get-caller-identity

# Se não estiver configurado:
aws configure
# AWS Access Key ID: [sua chave]
# AWS Secret Access Key: [sua chave secreta]
# Default region: us-east-1
# Default output format: json
```

### 2. BRAPI Secret (API de dados da B3)
Você precisa criar um secret no AWS Secrets Manager com suas credenciais da BRAPI:

```bash
# Criar o secret
aws secretsmanager create-secret \
  --name brapi-credentials \
  --description "BRAPI API credentials for B3 data" \
  --secret-string '{"api_key":"SUA_CHAVE_BRAPI_AQUI"}'
```

**Como obter a chave BRAPI:**
1. Acesse: https://brapi.dev/
2. Crie uma conta gratuita
3. Copie sua API key

### 3. Node.js e CDK
```bash
# Verificar Node.js (precisa 18+)
node --version

# Instalar AWS CDK globalmente
npm install -g aws-cdk

# Verificar instalação
cdk --version
```

---

## 🚀 Deploy da Infraestrutura

### Opção 1: Deploy Automático (Recomendado)

```bash
# Executar script de deploy
./scripts/deploy-v2.sh
```

Este script vai:
1. Instalar dependências do CDK
2. Fazer bootstrap da conta AWS (se necessário)
3. Fazer deploy de toda a infraestrutura
4. Configurar EventBridge rules
5. Criar buckets S3
6. Deployar todas as Lambdas

### Opção 2: Deploy Manual

```bash
# 1. Instalar dependências
cd infra
npm install

# 2. Bootstrap (apenas primeira vez)
cdk bootstrap

# 3. Verificar o que será criado
cdk diff

# 4. Deploy
cdk deploy --all --require-approval never

# 5. Voltar para raiz
cd ..
```

---

## ⏱️ Tempo de Deploy

- **Deploy inicial**: 10-15 minutos
- **Primeira ingestão de dados**: 5-10 minutos após deploy
- **Primeiro treinamento**: 30-60 minutos
- **Primeiras recomendações**: ~2 horas após deploy

---

## 📊 Quando os Dados Aparecerão no Dashboard

### Timeline após deploy:

| Tempo | O que acontece | Dados no Dashboard |
|-------|----------------|-------------------|
| 0min | Deploy concluído | ❌ Vazio |
| 5min | Primeira ingestão | ✅ Ingestão de Dados |
| 30min | Feature engineering | ✅ Feature Importance |
| 60min | Primeiro treinamento | ✅ Qualidade do Modelo |
| 90min | Ensemble criado | ✅ Ensemble Insights |
| 120min | Primeiras recomendações | ✅ Top 10 Recomendações |

### Horários de Execução Automática:

- **Ingestão**: A cada 5 minutos (durante pregão: 10h-18h BRT)
- **Feature Engineering**: Diariamente às 18:30 BRT
- **Treinamento**: Diariamente às 19:00 BRT
- **Ranking**: Diariamente às 19:30 BRT
- **Monitoramento**: Diariamente às 20:00 BRT

---

## 🔍 Verificar Status do Deploy

### 1. Verificar Stacks no CloudFormation
```bash
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --query 'StackSummaries[?contains(StackName, `B3TR`)].StackName'
```

### 2. Verificar Lambdas
```bash
aws lambda list-functions \
  --query 'Functions[?contains(FunctionName, `b3tr`)].FunctionName'
```

### 3. Verificar Bucket S3
```bash
aws s3 ls | grep b3tr
```

### 4. Verificar EventBridge Rules
```bash
aws events list-rules \
  --query 'Rules[?contains(Name, `b3tr`)].Name'
```

---

## 🧪 Testar Sistema Após Deploy

### 1. Forçar Primeira Ingestão
```bash
# Invocar Lambda de ingestão manualmente
aws lambda invoke \
  --function-name b3tr-ingest-quotes \
  --payload '{}' \
  response.json

cat response.json
```

### 2. Verificar Dados no S3
```bash
# Listar dados de ingestão
aws s3 ls s3://SEU-BUCKET/monitoring/ingestion/ --recursive

# Listar recomendações (após ~2h)
aws s3 ls s3://SEU-BUCKET/recommendations/ --recursive
```

### 3. Verificar Logs
```bash
# Ver logs da Lambda de ingestão
aws logs tail /aws/lambda/b3tr-ingest-quotes --follow
```

---

## 💰 Custos Estimados

### Custos Mensais (uso normal):

| Serviço | Custo Mensal |
|---------|--------------|
| Lambda | $5-10 |
| S3 | $1-2 |
| EventBridge | $0.50 |
| CloudWatch | $2-3 |
| Secrets Manager | $0.40 |
| **Total** | **$9-16/mês** |

### Custos Iniciais:
- Primeiro mês pode ser um pouco maior devido ao treinamento inicial
- Free tier da AWS cobre boa parte se for conta nova

---

## 🐛 Troubleshooting

### Erro: "BRAPI_SECRET_NAME not found"
```bash
# Criar o secret
aws secretsmanager create-secret \
  --name brapi-credentials \
  --secret-string '{"api_key":"SUA_CHAVE"}'
```

### Erro: "Insufficient permissions"
```bash
# Verificar permissões
aws iam get-user

# Sua conta precisa de permissões para:
# - CloudFormation
# - Lambda
# - S3
# - EventBridge
# - IAM
# - Secrets Manager
```

### Dashboard continua vazio após 2h
```bash
# 1. Verificar se as Lambdas estão rodando
aws lambda list-functions

# 2. Verificar logs de erro
aws logs tail /aws/lambda/b3tr-ingest-quotes --since 1h

# 3. Verificar EventBridge rules
aws events list-rules

# 4. Forçar execução manual
./scripts/test-system.sh
```

---

## 📞 Próximos Passos

1. **Agora**: Fazer deploy da infraestrutura
   ```bash
   ./scripts/deploy-v2.sh
   ```

2. **Após deploy**: Aguardar ~2 horas para dados aparecerem

3. **Monitorar**: Acompanhar logs e dashboard

4. **Configurar alertas**: (opcional) Configurar SNS para receber alertas

---

## 📚 Documentação Adicional

- **Arquitetura**: `docs/architecture.md`
- **Troubleshooting**: `docs/troubleshooting.md`
- **Deployment**: `docs/deployment.md`
- **Segurança**: `SECURITY.md`

---

## ✅ Checklist de Deploy

- [ ] Credenciais AWS configuradas
- [ ] BRAPI secret criado
- [ ] CDK instalado
- [ ] Deploy executado (`./scripts/deploy-v2.sh`)
- [ ] Stacks criadas no CloudFormation
- [ ] Lambdas deployadas
- [ ] Bucket S3 criado
- [ ] EventBridge rules ativas
- [ ] Primeira ingestão executada
- [ ] Aguardar 2h para dados completos
- [ ] Dashboard mostrando dados reais

---

**Última atualização**: 07/03/2026  
**Versão**: 2.0.1

🚀 **Pronto para fazer o deploy? Execute: `./scripts/deploy-v2.sh`**
