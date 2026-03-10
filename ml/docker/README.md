# Docker Image para Ensemble Training

Esta imagem Docker contém todos os modelos do ensemble:
- **XGBoost** 2.0.3
- **TensorFlow** 2.15.0 (para LSTM)
- **Prophet** 1.1.5

## Build e Push

```bash
cd ml/docker
./build_and_push.sh
```

Isso irá:
1. Criar repositório ECR (se não existir)
2. Build da imagem Docker
3. Push para ECR
4. Exibir o Image URI

## Uso no SageMaker

Após o build, atualize o Lambda `train_sagemaker.py` para usar a nova imagem:

```python
# Usar imagem customizada ao invés da AWS XGBoost
image_uri = "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/b3tr-ensemble-training:latest"
```

Ou configure via SSM:

```bash
aws ssm put-parameter \
  --name /b3tr/ensemble_image_uri \
  --value "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/b3tr-ensemble-training:latest" \
  --type String \
  --overwrite
```

## Testar Localmente

```bash
# Build
docker build -t b3tr-ensemble-training .

# Testar
docker run --rm \
  -v $(pwd)/test_data:/opt/ml/input/data/train \
  -v $(pwd)/test_output:/opt/ml/model \
  b3tr-ensemble-training \
  --max-depth 6 \
  --learning-rate 0.1 \
  --n-estimators 100
```

## Atualizar Imagem

Para atualizar a imagem após mudanças no código:

```bash
./build_and_push.sh v2
```

Isso criará uma nova tag `v2`.

## Custos

- **ECR Storage**: ~$0.10/GB/mês
- **Imagem**: ~2GB = $0.20/mês
- **Transfer**: Grátis dentro da mesma região

## Troubleshooting

### Erro de permissão ECR

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
```

### Erro de build

Verifique se o Docker está rodando:
```bash
docker ps
```

### Logs do SageMaker

```bash
aws logs tail /aws/sagemaker/TrainingJobs --follow
```
