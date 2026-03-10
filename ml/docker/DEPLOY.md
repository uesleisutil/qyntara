# Deploy do Docker Image - Ensemble Training

## Pré-requisitos

- Docker instalado e rodando
- AWS CLI configurado
- Permissões ECR

## Passo 1: Build e Push da Imagem

Execute no seu terminal local (com Docker instalado):

```bash
cd ml/docker
./build_and_push.sh
```

Ou manualmente:

```bash
# Variáveis
REGION=us-east-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPOSITORY_NAME=b3tr-ensemble-training
IMAGE_TAG=latest

# Criar repositório ECR
aws ecr create-repository --repository-name ${REPOSITORY_NAME} --region ${REGION} || true

# Login no ECR
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

# Copiar script
cp ../src/sagemaker/train_ensemble.py ./train_ensemble.py

# Build
docker build -t ${REPOSITORY_NAME}:${IMAGE_TAG} .

# Tag
docker tag ${REPOSITORY_NAME}:${IMAGE_TAG} ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY_NAME}:${IMAGE_TAG}

# Push
docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY_NAME}:${IMAGE_TAG}

# Limpar
rm -f ./train_ensemble.py
```

## Passo 2: Atualizar Lambda para Usar Nova Imagem

Após o push, você terá o Image URI:
```
200093399689.dkr.ecr.us-east-1.amazonaws.com/b3tr-ensemble-training:latest
```

Atualize o arquivo `ml/src/lambdas/train_sagemaker.py`:

```python
# Linha ~140
# Trocar de:
image_uri = f"683313688378.dkr.ecr.{region}.amazonaws.com/sagemaker-xgboost:1.7-1"

# Para:
image_uri = f"{account_id}.dkr.ecr.{region}.amazonaws.com/b3tr-ensemble-training:latest"
```

Ou melhor ainda, adicionar como variável de ambiente no CDK:

```typescript
// infra/lib/infra-stack.ts
const ensembleImageUri = envOr("ENSEMBLE_IMAGE_URI", 
  `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com/b3tr-ensemble-training:latest`
);

// Adicionar ao commonEnv
ENSEMBLE_IMAGE_URI: ensembleImageUri,
```

## Passo 3: Deploy da Infra

```bash
cd infra
npx cdk deploy
```

## Passo 4: Treinar Ensemble Completo

```bash
aws lambda invoke \
  --function-name B3TacticalRankingStackV2-TrainSageMakerA8FDC1C0-Os8Sjm4TW7lt \
  --cli-binary-format raw-in-base64-out \
  --payload '{"lookback_days": 3650, "instance_type": "ml.m5.2xlarge"}' \
  output.json

cat output.json | jq
```

## Passo 5: Monitorar Training Job

```bash
# Pegar nome do job
TRAINING_JOB=$(cat output.json | jq -r '.training_job_name')

# Monitorar status
watch -n 10 "aws sagemaker describe-training-job --training-job-name $TRAINING_JOB --query '{Status:TrainingJobStatus,Duration:TrainingTimeInSeconds}' --output table"

# Ver logs
aws logs tail /aws/sagemaker/TrainingJobs --log-stream-name-prefix $TRAINING_JOB --follow
```

## Passo 6: Verificar Resultados

```bash
# Baixar métricas
aws s3 cp s3://b3tr-200093399689-us-east-1/models/ensemble/$(date +%Y-%m-%d)/*/output/model.tar.gz /tmp/

# Extrair e ver métricas
tar -xzf /tmp/model.tar.gz -C /tmp metrics.json
cat /tmp/metrics.json | jq '.ensemble'
```

## Métricas Esperadas

Com o ensemble completo (XGBoost + LSTM + Prophet), esperamos:

- **Ensemble Val RMSE**: < 9% (vs 10.43% só XGBoost)
- **Ensemble Val MAE**: < 7% (vs 8.13% só XGBoost)
- **Pesos**: Distribuídos entre os 3 modelos
- **Modelos**: ["xgboost", "lstm", "prophet"]

## Troubleshooting

### Docker não instalado

Instale Docker:
- **Mac**: https://docs.docker.com/desktop/install/mac-install/
- **Linux**: `sudo apt-get install docker.io`
- **Windows**: https://docs.docker.com/desktop/install/windows-install/

### Erro de permissão ECR

```bash
# Adicionar permissões ECR à role do SageMaker
aws iam attach-role-policy \
  --role-name B3TacticalRankingStackV2-B3TRSageMakerRole* \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
```

### Imagem muito grande

A imagem tem ~2GB devido ao TensorFlow. Para reduzir:
- Usar `tensorflow-cpu` ao invés de `tensorflow`
- Usar imagem base `python:3.11-slim`
- Multi-stage build

### Training job falha

Verifique logs:
```bash
aws logs tail /aws/sagemaker/TrainingJobs --follow
```

Erros comuns:
- Falta de memória: Aumentar instância (ml.m5.4xlarge)
- Timeout: Aumentar `MaxRuntimeInSeconds`
- Dependências: Verificar Dockerfile

## Custos

- **ECR Storage**: ~$0.20/mês (2GB)
- **Training Job**: ml.m5.2xlarge × 3min = $0.03
- **Total**: ~$0.23/mês + treinos

## Próximos Passos

1. ✅ Build e push da imagem
2. ✅ Atualizar Lambda
3. ✅ Deploy CDK
4. ✅ Treinar ensemble
5. ⏳ Verificar métricas melhoradas
6. ⏳ Atualizar Lambda de ranking para usar ensemble
7. ⏳ Testar predições
