# 🔧 GitHub Actions Setup Guide

Este guia explica como configurar os secrets e variáveis necessários para os workflows do B3TR funcionarem corretamente.

## 🔑 Secrets Obrigatórios

Configure estes secrets no GitHub: **Settings → Secrets and variables → Actions → New repository secret**

### AWS Credentials

```bash
# Role ARN para OIDC authentication
AWS_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsRole
AWS_ACCOUNT_ID=YOUR_AWS_ACCOUNT_ID
```

### B3TR Configuration

```bash
# DeepAR image URI (AWS SageMaker)
DEEPAR_IMAGE_URI=382416733822.dkr.ecr.us-east-1.amazonaws.com/forecasting-deepar:1

# BRAPI Pro secret name
BRAPI_SECRET_ID=brapi/pro/token

# Email para alertas
ALERT_EMAIL=your-email@example.com
```

## 🏗️ Como Criar AWS Role para GitHub Actions

### 1. Criar Role IAM

```bash
# 1. Vá para AWS IAM Console
# 2. Create Role → Web identity
# 3. Identity provider: token.actions.githubusercontent.com
# 4. Audience: sts.amazonaws.com
# 5. GitHub organization: YOUR_GITHUB_USERNAME
# 6. GitHub repository: YOUR_REPOSITORY_NAME
```

### 2. Attach Policies

Anexe estas policies ao role:

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
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "*"
    }
  ]
}
```

### 3. Trust Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME:*"
        }
      }
    }
  ]
}
```

## 🧪 Testar Configuração

### 1. Verificar Secrets

```bash
# No GitHub Actions, os secrets aparecem como ***
echo "AWS_ROLE_ARN: ${{ secrets.AWS_ROLE_ARN }}"
echo "DEEPAR_IMAGE_URI: ${{ secrets.DEEPAR_IMAGE_URI }}"
```

### 2. Executar Workflow Manual

```bash
# Vá para Actions → Deploy to AWS → Run workflow
# Ou faça um push para main
```

### 3. Verificar Logs

```bash
# Se der erro, verifique:
# 1. Role ARN está correto
# 2. Trust policy permite o repositório
# 3. Policies têm permissões suficientes
```

## 🔄 Workflows Disponíveis

### Automáticos (Push/PR)
- **CI**: Lint, tests, validation
- **Deploy**: Deploy automático na AWS
- **CodeQL**: Security scanning

### Agendados
- **Monitoring**: A cada 6h
- **Data Quality**: Diário 19:00 UTC
- **Performance**: Semanal domingo 02:00 UTC

### Manuais
- **Deploy**: Workflow dispatch
- **Monitoring**: Workflow dispatch
- **Performance**: Workflow dispatch

## 🚨 Troubleshooting

### Deploy Falhando?

```bash
# 1. Verificar role ARN
aws sts get-caller-identity

# 2. Verificar permissões
aws iam get-role --role-name GitHubActionsRole

# 3. Verificar trust policy
aws iam get-role --role-name GitHubActionsRole --query 'Role.AssumeRolePolicyDocument'
```

### CI Falhando?

```bash
# 1. Verificar formatação
black --check .

# 2. Verificar lint
ruff check .

# 3. Verificar CDK
cd infra && npx cdk synth
```

### Monitoring Falhando?

```bash
# 1. Verificar AWS credentials
aws sts get-caller-identity

# 2. Verificar S3 bucket
aws s3 ls s3://YOUR-BUCKET-NAME/

# 3. Verificar Lambda functions
aws lambda list-functions --query 'Functions[?contains(FunctionName, `B3Tactical`)].FunctionName'
```

## 📋 Checklist de Setup

- [ ] AWS Role criado com trust policy correto
- [ ] Policies anexadas ao role
- [ ] Secrets configurados no GitHub
- [ ] BRAPI Pro token configurado no AWS Secrets Manager
- [ ] Primeiro deploy manual executado com sucesso
- [ ] Workflows de monitoramento funcionando
- [ ] Alertas por email configurados

## 🔗 Links Úteis

- [GitHub OIDC with AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS CDK GitHub Actions](https://github.com/aws-actions/configure-aws-credentials)
- [B3TR Documentation](../docs/)
- [Troubleshooting Guide](./TROUBLESHOOTING.md) 🔧

---

**Após configurar tudo, os workflows executarão automaticamente e você terá um sistema MLOps completamente automatizado! 🚀**

**❗ Se algo der errado, consulte o [Guia de Troubleshooting](./TROUBLESHOOTING.md) para soluções rápidas.**