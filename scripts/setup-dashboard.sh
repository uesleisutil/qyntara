#!/bin/bash

# Script de configuração do Dashboard GitHub Pages
# Autor: Kiro AI
# Data: 2026-03-05

set -e

echo "🚀 Configuração do Dashboard GitHub Pages"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para printar com cor
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Verificar se AWS CLI está instalado
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI não está instalado!"
    echo "Instale com: brew install awscli (macOS) ou pip install awscli"
    exit 1
fi

print_success "AWS CLI encontrado"

# Verificar se está logado na AWS
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "Você não está autenticado na AWS!"
    echo "Execute: aws configure"
    exit 1
fi

print_success "Autenticado na AWS"

# Obter informações da conta
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_REGION:-us-east-1}
BUCKET_NAME="b3tr-${ACCOUNT_ID}-${REGION}"

echo ""
echo "Configurações detectadas:"
echo "  Conta AWS: $ACCOUNT_ID"
echo "  Região: $REGION"
echo "  Bucket S3: $BUCKET_NAME"
echo ""

# Perguntar se quer continuar
read -p "Continuar com estas configurações? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Operação cancelada"
    exit 0
fi

echo ""
echo "📋 Passo 1: Criar usuário IAM para o dashboard"
echo "=============================================="

IAM_USER="dashboard-readonly"

# Verificar se usuário já existe
if aws iam get-user --user-name $IAM_USER &> /dev/null; then
    print_warning "Usuário $IAM_USER já existe"
    read -p "Deseja recriar as credenciais? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Deletar access keys antigas
        print_info "Removendo access keys antigas..."
        aws iam list-access-keys --user-name $IAM_USER --query 'AccessKeyMetadata[*].AccessKeyId' --output text | \
        while read key; do
            aws iam delete-access-key --user-name $IAM_USER --access-key-id $key
        done
    else
        print_warning "Pulando criação de usuário"
        IAM_USER_EXISTS=true
    fi
else
    print_info "Criando usuário IAM: $IAM_USER"
    aws iam create-user --user-name $IAM_USER
    print_success "Usuário criado"
fi

# Criar política
if [ -z "$IAM_USER_EXISTS" ]; then
    print_info "Criando política de acesso..."
    
    cat > /tmp/dashboard-policy.json << EOF
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
        "arn:aws:s3:::${BUCKET_NAME}",
        "arn:aws:s3:::${BUCKET_NAME}/*"
      ]
    }
  ]
}
EOF

    aws iam put-user-policy \
        --user-name $IAM_USER \
        --policy-name DashboardReadOnlyPolicy \
        --policy-document file:///tmp/dashboard-policy.json
    
    print_success "Política criada"
    
    # Criar access keys
    print_info "Criando access keys..."
    CREDENTIALS=$(aws iam create-access-key --user-name $IAM_USER --output json)
    
    ACCESS_KEY_ID=$(echo $CREDENTIALS | jq -r '.AccessKey.AccessKeyId')
    SECRET_ACCESS_KEY=$(echo $CREDENTIALS | jq -r '.AccessKey.SecretAccessKey')
    
    print_success "Access keys criadas"
    
    echo ""
    echo "🔑 CREDENCIAIS AWS (GUARDE COM SEGURANÇA!):"
    echo "==========================================="
    echo "AWS_ACCESS_KEY_ID: $ACCESS_KEY_ID"
    echo "SECRET_ACCESS_KEY: $SECRET_ACCESS_KEY"
    echo ""
    print_warning "Você precisará adicionar estas credenciais nos GitHub Secrets!"
    echo ""
fi

echo ""
echo "📋 Passo 2: Configurar CORS no S3"
echo "=================================="

print_info "Configurando CORS no bucket $BUCKET_NAME..."

cat > /tmp/cors-config.json << 'EOF'
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://uesleisutil.github.io"],
    "ExposeHeaders": ["ETag", "x-amz-request-id"],
    "MaxAgeSeconds": 3600
  },
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": ["ETag", "x-amz-request-id"],
    "MaxAgeSeconds": 3600
  }
]
EOF

if aws s3api put-bucket-cors \
    --bucket $BUCKET_NAME \
    --cors-configuration file:///tmp/cors-config.json; then
    print_success "CORS configurado"
else
    print_error "Erro ao configurar CORS"
    print_info "Verifique se o bucket $BUCKET_NAME existe"
    exit 1
fi

echo ""
echo "📋 Passo 3: Criar arquivo .env local (opcional)"
echo "==============================================="

read -p "Deseja criar arquivo .env para desenvolvimento local? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -n "$ACCESS_KEY_ID" ]; then
        cat > dashboard/.env << EOF
VITE_AWS_REGION=$REGION
VITE_AWS_ACCESS_KEY_ID=$ACCESS_KEY_ID
VITE_AWS_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY
VITE_S3_BUCKET=$BUCKET_NAME
EOF
        print_success "Arquivo dashboard/.env criado"
        print_warning "ATENÇÃO: Não faça commit deste arquivo!"
    else
        print_warning "Credenciais não disponíveis. Crie o arquivo manualmente."
    fi
fi

echo ""
echo "✅ Configuração Concluída!"
echo "========================="
echo ""
echo "Próximos passos:"
echo ""
echo "1. Configure os GitHub Secrets:"
echo "   - Vá em: https://github.com/uesleisutil/qyntara/settings/secrets/actions"
echo "   - Adicione os seguintes secrets:"
echo "     • AWS_REGION: $REGION"
echo "     • AWS_ACCESS_KEY_ID: (veja acima)"
echo "     • AWS_SECRET_ACCESS_KEY: (veja acima)"
echo "     • S3_BUCKET: $BUCKET_NAME"
echo ""
echo "2. Habilite GitHub Pages:"
echo "   - Vá em: https://github.com/uesleisutil/qyntara/settings/pages"
echo "   - Em 'Source', selecione 'GitHub Actions'"
echo ""
echo "3. Faça push para disparar o deploy:"
echo "   git push origin main"
echo ""
echo "4. Acompanhe o deploy em:"
echo "   https://github.com/uesleisutil/qyntara/actions"
echo ""
echo "5. Acesse o dashboard em:"
echo "   https://qyntara.tech"
echo ""
print_success "Tudo pronto! 🎉"
