# 🔧 Troubleshooting GitHub Actions

## ✅ Principais Correções Aplicadas

### 1. Variáveis de Ambiente Obrigatórias
- **Problema:** `mustEnv("DEEPAR_IMAGE_URI")` causava falha quando variável não estava definida
- **Solução:** Mudado para `envOr()` com valor padrão da AWS

### 2. Dependências Pesadas Removidas
- **Problema:** `pandas`, `numpy`, `matplotlib` causavam timeouts e falhas de instalação
- **Solução:** Removidas dependências desnecessárias dos workflows

### 3. Workflows Simplificados
- **Problema:** Workflows complexos com muitas validações falhavam
- **Solução:** Deploy workflow simplificado, monitoramento temporariamente desabilitado

## 🚨 Problemas Comuns e Soluções

### 1. Deploy Workflow Falhando

#### ❌ Erro: "Could not assume role"
```
Error: Could not assume role with OIDC: Not authorized to perform sts:AssumeRoleWithWebIdentity
```

**Solução Passo a Passo:**

1. **Criar OIDC Provider (uma vez só):**
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --client-id-list sts.amazonaws.com
```

2. **Criar Role com Trust Policy correta:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::SEU_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:SEU_USUARIO/b3-tactical-ranking:*"
        }
      }
    }
  ]
}
```

3. **Anexar Policy de Permissões:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "lambda:*",
        "iam:*",
        "events:*",
        "logs:*",
        "sns:*",
        "sagemaker:*",
        "ssm:*",
        "secretsmanager:GetSecretValue",
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}
```

#### ❌ Erro: "Secret not found"
**Verificar se todos os secrets estão configurados:**
- `AWS_ROLE_ARN` = `arn:aws:iam::SEU_ACCOUNT_ID:role/GitHubActionsRole`
- `AWS_ACCOUNT_ID` = `SEU_ACCOUNT_ID`
- `DEEPAR_IMAGE_URI` = `382416733822.dkr.ecr.us-east-1.amazonaws.com/forecasting-deepar:1`
- `BRAPI_SECRET_ID` = `brapi/pro/token`
- `ALERT_EMAIL` = `your-email@example.com`

### 2. CDK Bootstrap Issues

#### ❌ Erro: "This stack uses assets, so the toolkit stack must be deployed"
```bash
# Execute uma vez manualmente:
npx cdk bootstrap aws://SEU_ACCOUNT_ID/us-east-1
```

### 3. Secrets Manager Setup

#### Criar o secret do BRAPI Pro:
```bash
aws secretsmanager create-secret \
  --name "brapi/pro/token" \
  --description "BRAPI Pro API Token" \
  --secret-string "SEU_TOKEN_AQUI"
```

### 4. Verificar Configuração

#### Testar Role ARN:
```bash
aws sts assume-role-with-web-identity \
  --role-arn arn:aws:iam::SEU_ACCOUNT_ID:role/GitHubActionsRole \
  --role-session-name test \
  --web-identity-token "fake-token"
# Deve retornar erro de token inválido, não de role inexistente
```

#### Testar CDK localmente:
```bash
cd infra
DEEPAR_IMAGE_URI="382416733822.dkr.ecr.us-east-1.amazonaws.com/forecasting-deepar:1" \
BRAPI_SECRET_ID="brapi/pro/token" \
ALERT_EMAIL="test@example.com" \
npx cdk synth
```

## 🔍 Debugging Steps

### 1. Verificar Logs do Workflow
1. Vá para **Actions** no GitHub
2. Clique no workflow que falhou
3. Expanda cada step para ver logs detalhados
4. Procure por mensagens de erro específicas

### 2. Validar AWS Setup
```bash
# Verificar se OIDC provider existe
aws iam list-open-id-connect-providers

# Verificar se role existe
aws iam get-role --role-name GitHubActionsRole

# Verificar trust policy
aws iam get-role --role-name GitHubActionsRole \
  --query 'Role.AssumeRolePolicyDocument'

# Verificar policies anexadas
aws iam list-attached-role-policies --role-name GitHubActionsRole
```

### 3. Testar Secrets
```bash
# Verificar se secret existe
aws secretsmanager describe-secret --secret-id brapi/pro/token

# Listar todos os secrets
aws secretsmanager list-secrets
```

## 📋 Checklist de Setup Completo

- [ ] ✅ OIDC Provider criado no AWS IAM
- [ ] ✅ Role GitHubActionsRole criado com trust policy correto
- [ ] ✅ Policies anexadas ao role (CloudFormation, S3, Lambda, etc.)
- [ ] ✅ Todos os 5 secrets configurados no GitHub
- [ ] ✅ BRAPI Pro token configurado no AWS Secrets Manager
- [ ] ✅ CDK bootstrap executado uma vez
- [ ] ✅ Primeiro deploy manual bem-sucedido

## 🚀 Após Correções

Com as correções aplicadas, o sistema deve:
1. ✅ Deploy automático funcionar sem erros
2. ✅ Infraestrutura AWS ser criada corretamente
3. ✅ Lambda functions serem deployadas
4. ✅ Sistema MLOps começar a funcionar automaticamente

## 📞 Suporte Adicional

Se ainda houver problemas:
1. Verifique se o AWS account ID está correto em todos os lugares
2. Confirme que o repositório GitHub está público ou que as permissões estão corretas
3. Teste o CDK synth localmente primeiro
4. Verifique os logs completos do workflow no GitHub Actions

**Lembre-se:** O primeiro deploy pode demorar 10-15 minutos para criar todos os recursos AWS.