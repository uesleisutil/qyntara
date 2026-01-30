#!/bin/bash

# Script para configurar OIDC com GitHub Actions (método mais seguro)
# Execute: ./scripts/setup-oidc.sh

set -e

echo "🔐 Configurando OIDC para GitHub Actions"
echo "========================================"

# Verificar se AWS CLI está configurado
if ! aws sts get-caller-identity &>/dev/null; then
    echo "❌ AWS CLI não está configurado"
    echo "Execute: aws configure"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPO_OWNER="YOUR_GITHUB_USERNAME"
REPO_NAME="YOUR_REPO_NAME"

echo "✅ AWS Account ID: $ACCOUNT_ID"
echo "✅ GitHub Repo: $REPO_OWNER/$REPO_NAME"

# 1. Criar OIDC Identity Provider se não existir
echo ""
echo "🔍 Verificando OIDC Provider..."
OIDC_ARN="arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn $OIDC_ARN &>/dev/null; then
    echo "✅ OIDC Provider já existe"
else
    echo "📝 Criando OIDC Provider..."
    aws iam create-open-id-connect-provider \
        --url https://token.actions.githubusercontent.com \
        --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
        --client-id-list sts.amazonaws.com
    echo "✅ OIDC Provider criado"
fi

# 2. Criar Trust Policy
echo ""
echo "📝 Criando Trust Policy..."
cat > /tmp/trust-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Federated": "arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
            },
            "Action": "sts:AssumeRoleWithWebIdentity",
            "Condition": {
                "StringEquals": {
                    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
                },
                "StringLike": {
                    "token.actions.githubusercontent.com:sub": "repo:$REPO_OWNER/$REPO_NAME:*"
                }
            }
        }
    ]
}
EOF

# 3. Criar IAM Role
ROLE_NAME="GitHubActionsRole"
echo ""
echo "🔍 Verificando IAM Role..."

if aws iam get-role --role-name $ROLE_NAME &>/dev/null; then
    echo "⚠️  Role $ROLE_NAME já existe, atualizando trust policy..."
    aws iam update-assume-role-policy \
        --role-name $ROLE_NAME \
        --policy-document file:///tmp/trust-policy.json
else
    echo "📝 Criando IAM Role..."
    aws iam create-role \
        --role-name $ROLE_NAME \
        --assume-role-policy-document file:///tmp/trust-policy.json \
        --description "Role for GitHub Actions OIDC"
    echo "✅ Role criado"
fi

# 4. Criar e anexar política de permissões
echo ""
echo "📝 Criando política de permissões..."
cat > /tmp/permissions-policy.json << EOF
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
                "secretsmanager:*",
                "sts:GetCallerIdentity",
                "ec2:DescribeRegions",
                "ec2:DescribeAvailabilityZones"
            ],
            "Resource": "*"
        }
    ]
}
EOF

# Anexar política inline
aws iam put-role-policy \
    --role-name $ROLE_NAME \
    --policy-name GitHubActionsPolicy \
    --policy-document file:///tmp/permissions-policy.json

echo "✅ Política anexada"

# 5. Remover usuário IAM antigo (opcional)
echo ""
echo "🧹 Limpeza opcional..."
read -p "Deseja remover o usuário IAM 'github-actions-b3tr'? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removendo usuário antigo..."
    
    # Remover access keys
    OLD_KEYS=$(aws iam list-access-keys --user-name github-actions-b3tr --query 'AccessKeyMetadata[].AccessKeyId' --output text 2>/dev/null || echo "")
    for key in $OLD_KEYS; do
        echo "Removendo access key: $key"
        aws iam delete-access-key --user-name github-actions-b3tr --access-key-id $key
    done
    
    # Remover políticas
    aws iam delete-user-policy --user-name github-actions-b3tr --policy-name GitHubActionsPolicy 2>/dev/null || true
    
    # Remover usuário
    aws iam delete-user --user-name github-actions-b3tr 2>/dev/null || true
    echo "✅ Usuário removido"
else
    echo "⏭️  Mantendo usuário existente"
fi

echo ""
echo "🎉 OIDC Setup concluído!"
echo "======================="
echo ""
echo "✅ OIDC Provider: token.actions.githubusercontent.com"
echo "✅ IAM Role: arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"
echo "✅ Repositório autorizado: $REPO_OWNER/$REPO_NAME"
echo ""
echo "🔧 Próximos passos:"
echo "1. Remova os secrets AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY do GitHub"
echo "2. Execute o workflow 'Deploy with OIDC (Secure)'"
echo "3. Aproveite a segurança aprimorada sem credenciais permanentes!"
echo ""
echo "🔐 Vantagens do OIDC:"
echo "• Sem credenciais permanentes armazenadas"
echo "• Tokens temporários com duração limitada"
echo "• Controle granular por repositório"
echo "• Rotação automática de credenciais"
echo ""
echo "✅ Método mais seguro configurado!"

# Limpar arquivos temporários
rm -f /tmp/trust-policy.json /tmp/permissions-policy.json