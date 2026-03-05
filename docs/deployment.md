# Guia de Deployment

## 🚀 Deploy Rápido (5 minutos)

### Pré-requisitos
- AWS CLI configurado
- Node.js 18+
- Token BRAPI Pro
- Conta GitHub (para dashboard)

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

### 6. Configure e Deploy o Dashboard
Veja a seção "Deploy do Dashboard" abaixo para instruções detalhadas.

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

## 📊 Deploy do Dashboard

O dashboard é uma aplicação React hospedada no GitHub Pages que fornece visualização em tempo real dos dados do sistema.

### Pré-requisitos

- Repositório GitHub
- Node.js 18+
- Credenciais AWS com acesso de leitura ao S3

### Configuração Inicial

1. **Configure o GitHub Pages no repositório**:
   - Vá em Settings > Pages
   - Source: GitHub Actions
   - Salve as configurações

2. **Configure os GitHub Secrets** (Settings > Secrets and variables > Actions):
   
   Adicione os seguintes secrets:
   - `AWS_REGION`: Região AWS do bucket (ex: `us-east-1`)
   - `AWS_ACCESS_KEY_ID`: Access Key ID da AWS
   - `AWS_SECRET_ACCESS_KEY`: Secret Access Key da AWS
   - `S3_BUCKET`: Nome do bucket S3 (ex: `b3tr-200093399689-us-east-1`)

3. **Crie um usuário IAM para o dashboard** (recomendado):
   
   ```bash
   # Crie um usuário IAM com acesso somente leitura ao S3
   aws iam create-user --user-name b3tr-dashboard-readonly
   
   # Crie uma policy com permissões mínimas
   cat > dashboard-policy.json <<EOF
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::b3tr-*",
           "arn:aws:s3:::b3tr-*/recommendations/*",
           "arn:aws:s3:::b3tr-*/monitoring/*"
         ]
       }
     ]
   }
   EOF
   
   # Anexe a policy ao usuário
   aws iam put-user-policy \
     --user-name b3tr-dashboard-readonly \
     --policy-name B3TRDashboardReadOnly \
     --policy-document file://dashboard-policy.json
   
   # Crie as credenciais de acesso
   aws iam create-access-key --user-name b3tr-dashboard-readonly
   ```
   
   Use as credenciais geradas nos GitHub Secrets.

4. **Configure CORS no bucket S3**:
   
   O bucket S3 precisa permitir requisições do GitHub Pages:
   
   ```bash
   # Obtenha o nome do bucket
   BUCKET_NAME=$(aws s3 ls | grep b3tr | awk '{print $3}')
   
   # Configure CORS
   cat > cors.json <<EOF
   {
     "CORSRules": [
       {
         "AllowedOrigins": ["https://<seu-usuario>.github.io"],
         "AllowedMethods": ["GET", "HEAD"],
         "AllowedHeaders": ["*"],
         "MaxAgeSeconds": 3600
       }
     ]
   }
   EOF
   
   aws s3api put-bucket-cors \
     --bucket $BUCKET_NAME \
     --cors-configuration file://cors.json
   ```
   
   **Importante**: Substitua `<seu-usuario>` pelo seu nome de usuário do GitHub.

### Deploy Automático

O dashboard é deployado automaticamente via GitHub Actions quando você faz push para a branch `main`:

```bash
# Faça alterações no dashboard
cd dashboard
# ... suas alterações ...

# Commit e push
git add .
git commit -m "Update dashboard"
git push origin main
```

O workflow `.github/workflows/deploy-dashboard.yml` irá:
1. Instalar dependências do Node.js
2. Fazer build da aplicação React com as variáveis de ambiente dos secrets
3. Fazer deploy para GitHub Pages

### Deploy Manual (Desenvolvimento)

Para testar o deploy localmente antes de fazer push:

```bash
cd dashboard

# Configure as variáveis de ambiente localmente
cp .env.example .env
# Edite .env com suas credenciais

# Instale dependências
npm install

# Teste localmente
npm start

# Build de produção
npm run build

# Deploy manual para GitHub Pages
npm run deploy
```

### Verificar Deploy

Após o deploy (automático ou manual), o dashboard estará disponível em:
```
https://<seu-usuario>.github.io/<nome-do-repositorio>/
```

Exemplo: `https://uesleisutil.github.io/b3-tactical-ranking/`

### Monitorar Deploy

1. Vá em Actions no GitHub para ver o status do workflow
2. Clique no workflow "Deploy Dashboard to GitHub Pages"
3. Verifique os logs de cada step

### Atualizar Configurações

Para atualizar as credenciais AWS ou outras configurações:

1. Vá em Settings > Secrets and variables > Actions
2. Edite os secrets necessários
3. Faça um novo deploy (push ou workflow manual)

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

### Dashboard: "Unable to connect to data source"
**Solução**: 
1. Verifique a configuração CORS do bucket S3
2. Verifique se os GitHub Secrets estão configurados corretamente
3. Verifique se o bucket S3 existe e tem dados

### Dashboard: "Authentication failed"
**Solução**:
1. Verifique se as credenciais AWS nos GitHub Secrets estão corretas
2. Verifique se o usuário IAM tem permissões de leitura no S3
3. Recrie as credenciais se necessário

### Dashboard não atualiza
**Solução**:
1. Verifique se há novos arquivos sendo gerados no S3
2. Clique no botão "Atualizar" manualmente
3. Verifique os logs do navegador (F12 > Console)

## 📊 Monitoramento

### CloudWatch Dashboards
Acesse: AWS Console > CloudWatch > Dashboards

### Métricas Importantes
- `B3TR/IngestionOK`: 1 = sucesso, 0 = falha
- `B3TR/ModelMAPE`: Erro percentual do modelo

### Logs
- `/aws/lambda/B3TacticalRankingStack-*`

### Dashboard Web
- Acesse o dashboard no GitHub Pages para visualização em tempo real
- Monitore recomendações, qualidade do modelo e ingestão de dados
- Verifique indicadores de saúde do sistema

## 🔄 Atualizações

### Deploy de Mudanças na Infraestrutura
```bash
cd infra
cdk deploy
```

### Deploy de Mudanças no Dashboard
```bash
# Automático: apenas faça push
git push origin main

# Manual:
cd dashboard
npm run deploy
```

### Rollback da Infraestrutura
```bash
cd infra
cdk deploy --previous-parameters
```

### Rollback do Dashboard
```bash
# Via GitHub:
# 1. Vá em Actions
# 2. Selecione um workflow anterior bem-sucedido
# 3. Clique em "Re-run jobs"
```

### Backup
O S3 mantém versionamento automático dos dados críticos.

## 💰 Custos Estimados

### Infraestrutura AWS
- **Lambda**: ~$5-10/mês (execuções)
- **S3**: ~$0.50/mês (armazenamento)
- **SageMaker**: ~$20-30/mês (treinamento diário)
- **CloudWatch**: ~$1-2/mês (logs e métricas)
- **Total AWS**: ~$27-43/mês

### Dashboard
- **GitHub Pages**: Gratuito (repositórios públicos)
- **S3 GET Requests**: ~$0.01/mês (requisições do dashboard)
- **Total Dashboard**: Praticamente gratuito

### Total Geral
~$27-43/mês (infraestrutura AWS) + gratuito (dashboard)