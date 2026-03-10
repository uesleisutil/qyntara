# B3 Tactical Ranking

Sistema de recomendação de ações da B3 usando Machine Learning com SageMaker.

## Arquitetura

```
TREINO (1x)                    INFERÊNCIA (Diária)
───────────                    ────────────────────

Lambda Train                   Lambda Rank
    │                              │
    ▼                              ▼
SageMaker Training            Carregar Modelo S3
    │                              │
    ▼                              ▼
model.tar.gz ──────────────▶  Predições In-Memory
    │                              │
    ▼                              ▼
S3: models/                   S3: recommendations/
```

## Features

- ✅ 50+ features técnicas avançadas (RSI, MACD, Bollinger Bands, ATR, etc)
- ✅ Walk-forward validation temporal (5 splits)
- ✅ Feature selection automática (top 30)
- ✅ Inferência in-memory (sem endpoint 24/7)
- ✅ Monitoramento contínuo de performance
- ✅ Detecção automática de drift
- ✅ Alertas SNS para re-treino
- ✅ Monitoramento de custos em tempo real
- ✅ Monitoramento de instâncias SageMaker
- ✅ Dashboard completo com métricas
- ✅ Custo < $1/mês

## Deployment

### 1. Pré-requisitos

```bash
# AWS CLI configurado
aws configure

# Node.js e CDK
npm install -g aws-cdk

# Python 3.11+
python --version
```

### 2. Deploy da Infraestrutura

```bash
cd infra
npm install
cdk deploy
```

### 3. Aguardar Bootstrap de Dados

O sistema automaticamente faz bootstrap dos dados históricos (roda a cada 30 min).

```bash
# Verificar progresso
aws logs tail /aws/lambda/*BootstrapHistory* --follow

# Verificar dados disponíveis
aws s3 ls s3://BUCKET/curated/daily_monthly/ --recursive | wc -l
# Deve ter 120+ dias por ticker
```

### 4. Treinar Modelo Inicial

```bash
aws lambda invoke \
  --function-name <TrainSageMaker> \
  --payload '{
    "lookback_days": 365,
    "hyperparameters": {
      "max_depth": "6",
      "learning_rate": "0.1",
      "n_estimators": "100",
      "n_features": "30",
      "cv_splits": "5"
    }
  }' \
  output.json

# Aguardar conclusão (5-15 min)
cat output.json | jq
```

### 5. Verificar Primeira Recomendação

O ranking roda automaticamente às 18:10 BRT. Para forçar manualmente:

```bash
aws lambda invoke \
  --function-name <RankSageMaker> \
  --payload '{}' \
  output.json

# Ver recomendações
aws s3 cp s3://BUCKET/recommendations/dt=$(date +%Y-%m-%d)/top50.json - | jq
```

## Operação Diária

O sistema roda automaticamente:

- **A cada 5 min**: Monitora instâncias SageMaker (detecta endpoints ativos)
- **18:10 BRT**: Gera ranking top 50
- **19:30 BRT**: Valida predições de 20 dias atrás
- **20:00 BRT**: Monitora custos

### ⚠️ Alerta Importante: Endpoints SageMaker

O sistema foi projetado para **inferência in-memory** (sem endpoints).

Se o dashboard mostrar endpoints ativos:
```bash
# Deletar endpoint imediatamente
aws sagemaker delete-endpoint --endpoint-name <ENDPOINT_NAME>

# Economia: ~$47/mês por endpoint
```

## Monitoramento

### Métricas CloudWatch

- `B3TR/ModelMAPE` - Erro percentual do modelo
- `B3TR/DirectionalAccuracy` - Acurácia direcional
- `B3TR/ModelMAE` - Erro absoluto médio

### Dashboard Web

Acesse: `https://uesleisutil.github.io/b3-tactical-ranking`

**Abas disponíveis**:
- **Visão Geral**: Recomendações, qualidade, ingestão
- **Performance do Modelo**: MAPE, acurácia, drift
- **Monitoramento**: Drift, features, alertas
- **Avançado**: Hiperparâmetros, explicabilidade
- **Custos & Performance**: 
  - Monitoramento de instâncias SageMaker (training jobs, endpoints, transform jobs)
  - Performance do modelo (MAPE, acurácia direcional)
  - Custos operacionais (diário, mensal, por serviço)
  - Alertas automáticos

### Comandos Úteis

```bash
# Ver performance do modelo
aws s3 cp s3://BUCKET/monitoring/performance/dt=$(date +%Y-%m-%d)/metrics.json - | jq

# Ver feature importance
aws s3 cp s3://BUCKET/models/ensemble/latest/feature_importance.csv -

# Ver logs
aws logs tail /aws/lambda/<RankSageMaker> --follow

# Forçar modo momentum (sem modelo)
aws lambda invoke \
  --function-name <RankSageMaker> \
  --payload '{"force_momentum": true}' \
  output.json
```

## Re-treino

O sistema alerta automaticamente quando re-treino é necessário:

### Critérios
- MAPE > 20%
- Drift detectado (performance degradou 50%)
- Performance 2x pior que treino

### Como Re-treinar

```bash
# Verificar se necessário
aws s3 cp s3://BUCKET/monitoring/performance/dt=$(date +%Y-%m-%d)/metrics.json - | jq '.needs_retrain'

# Re-treinar
aws lambda invoke \
  --function-name <TrainSageMaker> \
  --payload '{"lookback_days": 365}' \
  output.json
```

## Custos

### Operação Mensal
- Lambda Rank: $0.15
- Lambda Ingest: $0.50
- Lambda Monitor: $0.10
- S3 Storage: $0.10
- CloudWatch: $0.10

**Total: ~$0.95/mês**

### Re-treino (Ocasional)
- SageMaker Training: $0.06/treino

## Estrutura do Projeto

```
.
├── config/                    # Configurações (universe, holidays)
├── dashboard/                 # Dashboard React (GitHub Pages)
├── infra/                     # CDK Infrastructure
├── ml/
│   └── src/
│       ├── features/          # Feature engineering
│       ├── lambdas/           # Lambda functions
│       ├── sagemaker/         # SageMaker scripts
│       └── runtime_config.py  # Runtime configuration
├── scripts/                   # Utility scripts
├── MODEL_MONITORING_RETRAIN.md  # Monitoramento detalhado
├── PRODUCTION_DEPLOYMENT.md     # Guia de deployment
└── SAGEMAKER_ENSEMBLE.md        # Arquitetura SageMaker
```

## Documentação Adicional

- [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) - Guia completo de deployment
- [SAGEMAKER_ENSEMBLE.md](SAGEMAKER_ENSEMBLE.md) - Arquitetura e custos
- [MODEL_MONITORING_RETRAIN.md](MODEL_MONITORING_RETRAIN.md) - Monitoramento e re-treino

## Validação

```bash
# Executar script de validação
./scripts/validate-production-ready.sh
```

## Troubleshooting

### Sem dados históricos
```bash
# Verificar bootstrap
aws logs tail /aws/lambda/*BootstrapHistory* --follow
```

### Modelo não encontrado
```bash
# Verificar modelos disponíveis
aws s3 ls s3://BUCKET/models/ensemble/

# Treinar novo modelo
aws lambda invoke --function-name <TrainSageMaker> --payload '{}' output.json
```

### MAPE alto
```bash
# Verificar performance
aws s3 cp s3://BUCKET/monitoring/performance/dt=$(date +%Y-%m-%d)/metrics.json - | jq

# Re-treinar se necessário
aws lambda invoke --function-name <TrainSageMaker> --payload '{}' output.json
```

## Licença

MIT License - Ver [LICENSE](LICENSE)

## Contato

Para dúvidas ou sugestões, abra uma issue no GitHub.
