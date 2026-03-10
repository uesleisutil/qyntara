# Setup AWS CodeBuild (Alternativa sem Docker local)

Se você não tem Docker instalado localmente, pode usar AWS CodeBuild para fazer o build da imagem.

## Passo 1: Criar Projeto CodeBuild

```bash
# Criar role para CodeBuild
aws iam create-role \
  --role-name B3TRCodeBuildRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "codebuild.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Adicionar políticas
aws iam attach-role-policy \
  --role-name B3TRCodeBuildRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

aws iam attach-role-policy \
  --role-name B3TRCodeBuildRole \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess

# Criar projeto CodeBuild
aws codebuild create-project \
  --name b3tr-ensemble-docker-build \
  --source type=GITHUB,location=https://github.com/uesleisutil/b3-tactical-ranking.git,buildspec=ml/docker/buildspec.yml \
  --artifacts type=NO_ARTIFACTS \
  --environment type=LINUX_CONTAINER,image=aws/codebuild/standard:7.0,computeType=BUILD_GENERAL1_SMALL,privilegedMode=true \
  --service-role arn:aws:iam::200093399689:role/B3TRCodeBuildRole
```

## Passo 2: Iniciar Build

```bash
# Iniciar build
aws codebuild start-build --project-name b3tr-ensemble-docker-build

# Monitorar
BUILD_ID=$(aws codebuild list-builds-for-project --project-name b3tr-ensemble-docker-build --query 'ids[0]' --output text)
watch -n 5 "aws codebuild batch-get-builds --ids $BUILD_ID --query 'builds[0].{Status:buildStatus,Phase:currentPhase}' --output table"
```

## Passo 3: Verificar Imagem

```bash
# Listar imagens
aws ecr describe-images --repository-name b3tr-ensemble-training

# Pegar URI
IMAGE_URI=$(aws ecr describe-repositories --repository-names b3tr-ensemble-training --query 'repositories[0].repositoryUri' --output text)
echo "Image URI: ${IMAGE_URI}:latest"
```

## Passo 4: Configurar e Deploy

```bash
# Configurar
echo "ENSEMBLE_IMAGE_URI=${IMAGE_URI}:latest" >> infra/.env

# Deploy
cd infra
npx cdk deploy
```

## Passo 5: Treinar

```bash
aws lambda invoke \
  --function-name B3TacticalRankingStackV2-TrainSageMakerA8FDC1C0-Os8Sjm4TW7lt \
  --cli-binary-format raw-in-base64-out \
  --payload '{"lookback_days": 3650, "instance_type": "ml.m5.2xlarge"}' \
  output.json
```

## Custos

- CodeBuild: $0.005/min × 10min = $0.05 por build
- ECR Storage: $0.20/mês
- **Total: $0.25/mês**

## Vantagens

✅ Não precisa Docker local
✅ Build na nuvem
✅ Logs no CloudWatch
✅ Integração com GitHub

## Desvantagens

❌ Mais complexo que Docker local
❌ Precisa configurar IAM roles
❌ Custo adicional (pequeno)
