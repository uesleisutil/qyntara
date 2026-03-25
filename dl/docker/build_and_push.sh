#!/bin/bash
# Script para build e push da imagem Docker para ECR

set -e

# Configurações
REGION=${AWS_REGION:-us-east-1}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPOSITORY_NAME="b3tr-ensemble-training"
IMAGE_TAG=${1:-latest}

# Nome completo da imagem
FULL_IMAGE_NAME="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY_NAME}:${IMAGE_TAG}"

echo "=========================================="
echo "Build e Push Docker Image para SageMaker"
echo "=========================================="
echo "Region: ${REGION}"
echo "Account: ${ACCOUNT_ID}"
echo "Repository: ${REPOSITORY_NAME}"
echo "Tag: ${IMAGE_TAG}"
echo "Full Image: ${FULL_IMAGE_NAME}"
echo "=========================================="

# Criar repositório ECR se não existir
echo "Verificando repositório ECR..."
aws ecr describe-repositories --repository-names ${REPOSITORY_NAME} --region ${REGION} 2>/dev/null || \
    aws ecr create-repository --repository-name ${REPOSITORY_NAME} --region ${REGION}

# Login no ECR
echo "Fazendo login no ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

# Copiar script de treino para o diretório docker
echo "Copiando script de treino..."
cp ../src/sagemaker/train_ensemble.py ./train_ensemble.py

# Build da imagem
echo "Building Docker image..."
docker build -t ${REPOSITORY_NAME}:${IMAGE_TAG} .

# Tag da imagem
echo "Tagging image..."
docker tag ${REPOSITORY_NAME}:${IMAGE_TAG} ${FULL_IMAGE_NAME}

# Push para ECR
echo "Pushing to ECR..."
docker push ${FULL_IMAGE_NAME}

# Limpar arquivo temporário
rm -f ./train_ensemble.py

echo "=========================================="
echo "✅ Imagem publicada com sucesso!"
echo "=========================================="
echo "Image URI: ${FULL_IMAGE_NAME}"
echo ""
echo "Para usar no Lambda, atualize a variável de ambiente:"
echo "DEEPAR_IMAGE_URI=${FULL_IMAGE_NAME}"
echo ""
echo "Ou atualize no SSM:"
echo "aws ssm put-parameter --name /b3tr/ensemble_image_uri --value ${FULL_IMAGE_NAME} --type String --overwrite"
echo "=========================================="
