# Sistema de Ensemble com SageMaker

## Arquitetura Simplificada (Produção)

```
┌─────────────────────────────────────────────────────────────┐
│              FASE 1: TREINO INICIAL (1x)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────┐    ┌──────────────────┐    ┌─────────────┐
│  Lambda: Train   │───▶│   SageMaker      │───▶│ S3: Models  │
│   SageMaker      │    │  Training Job    │    │ model.tar.gz│
└──────────────────┘    └──────────────────┘    └─────────────┘
                              │
                              │ (5-15 min)
                              ▼
                    ┌──────────────────┐
                    │  Modelo Treinado │
                    │   - XGBoost      │
                    │   - 30+ Features │
                    │   - CV Validated │
                    └──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         FASE 2: INFERÊNCIA DIÁRIA (Automático)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────┐    ┌──────────────────┐    ┌─────────────┐
│ EventBridge      │───▶│  Lambda: Rank    │───▶│ S3: Dados   │
│ 18:10 BRT Daily  │    │   SageMaker      │    │  Históricos │
└──────────────────┘    └──────────────────┘    └─────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Carregar Modelo  │
                    │ do S3 (in-memory)│
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Gerar Features   │
                    │ Avançadas        │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Predições        │
                    │ In-Memory        │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Ranking Top 50   │
                    │ Salvar S3        │
                    └──────────────────┘
```

## Vantagens da Nova Arquitetura

✅ **Sem Endpoint 24/7**: Economia de ~$47/mês
✅ **Inferência In-Memory**: < 10 segundos
✅ **Modelo Persistente**: Treina 1x, usa N vezes
✅ **Custo Mínimo**: ~$0.84/mês operacional
✅ **Simples**: Sem complexidade de endpoints
✅ **Confiável**: Fallback automático para momentum

## Componentes

### 1. Lambda: `train_sagemaker.py`
**Função**: Prepara dados e inicia training job no SageMaker

**Vantagens**:
- ✅ Escolhe tipo de instância (ml.m5.xlarge, ml.c5.2xlarge, ml.p3.2xlarge, etc)
- ✅ Escala automaticamente
- ✅ Paga apenas pelo tempo de treino
- ✅ Logs e métricas no CloudWatch

**Uso**:
```python
# Invocar Lambda para treinar
aws lambda invoke \
  --function-name train-sagemaker \
  --payload '{
    "instance_type": "ml.m5.xlarge",
    "hyperparameters": {
      "max_depth": "6",
      "learning_rate": "0.1",
      "n_estimators": "100"
    },
    "lookback_days": 365
  }' \
  output.json
```

**Tipos de Instância Recomendados**:
- `ml.m5.xlarge` - Uso geral, barato (~$0.23/hora)
- `ml.c5.2xlarge` - CPU otimizado (~$0.38/hora)
- `ml.c5.4xlarge` - CPU otimizado, mais rápido (~$0.77/hora)
- `ml.p3.2xlarge` - GPU para deep learning (~$3.82/hora)

### 2. Lambda: `rank_sagemaker.py`
**Função**: Gera ranking usando endpoint SageMaker

**Vantagens**:
- ✅ Inferência rápida e escalável
- ✅ Endpoint sempre disponível (ou on-demand)
- ✅ Fallback automático para momentum se endpoint não existir

**Uso**:
```python
# Invocar Lambda para ranking
aws lambda invoke \
  --function-name rank-sagemaker \
  --payload '{
    "endpoint_name": "b3tr-ensemble-endpoint"
  }' \
  output.json
```

### 3. Scripts SageMaker

#### `train_ensemble.py`
- Treina XGBoost com dados preparados
- Salva modelo e métricas
- Calcula feature importance

#### `inference.py`
- Carrega modelo treinado
- Processa requisições de inferência
- Retorna previsões

## Fluxo de Produção

### 1. Treinar Modelo Inicial (Uma vez)

```bash
# Invocar Lambda de treino
aws lambda invoke \
  --function-name B3TacticalRankingStackV2-TrainSageMaker-XXX \
  --payload '{
    "instance_type": "ml.m5.xlarge",
    "hyperparameters": {
      "max_depth": "6",
      "learning_rate": "0.1",
      "n_estimators": "100",
      "n_features": "30",
      "cv_splits": "5"
    },
    "lookback_days": 365
  }' \
  train_output.json

# Verificar resultado
cat train_output.json | jq

# Aguardar conclusão (5-15 min)
TRAINING_JOB=$(cat train_output.json | jq -r '.training_job_name')
aws sagemaker wait training-job-completed-or-stopped \
  --training-job-name $TRAINING_JOB

# Verificar modelo salvo
aws s3 ls s3://BUCKET/models/ensemble/YYYY-MM-DD/
# Deve ter: model.tar.gz, metrics.json, feature_importance.csv
```

### 2. Ranking Diário (Automático)

O Lambda `rank_sagemaker` roda automaticamente às 18:10 BRT:

1. Carrega dados históricos (últimos 260 dias)
2. Gera features avançadas (50+ features)
3. Carrega modelo do S3 (in-memory)
4. Faz predições (sem endpoint)
5. Gera ranking top 50
6. Salva no S3

**Sem custos de endpoint!**

### 3. Re-treino (Mensal ou quando necessário)

```bash
# Verificar performance
aws s3 cp s3://BUCKET/monitoring/quality/latest.json - | jq

# Se MAPE > 15%, re-treinar
aws lambda invoke \
  --function-name B3TacticalRankingStackV2-TrainSageMaker-XXX \
  --payload '{"lookback_days": 365}' \
  retrain_output.json
```

## Custos Estimados

### Treino Inicial (Uma vez)
- **SageMaker Training**: ml.m5.xlarge × 0.25h = $0.06

### Operação Diária (22 dias úteis/mês)
- **Lambda Rank**: 2048MB × 60s × 22 = $0.15/mês
- **Lambda Ingest**: 1024MB × 5min × 22 × 12/dia = $0.50/mês
- **S3 Storage**: 1GB = $0.023/mês
- **CloudWatch**: $0.10/mês

**Total: ~$0.84/mês** (após treino inicial)

### Comparação com Endpoint 24/7
- **Endpoint ml.t2.medium**: $47/mês
- **Economia: $46/mês (98%)**

## Modelo Treinado (model.tar.gz)

O arquivo `model.tar.gz` contém:
- `xgboost_model.json` - Modelo XGBoost serializado
- `metrics.json` - Métricas de validação (RMSE, MAPE, CV)
- `feature_importance.csv` - Importância das features
- `selected_features.json` - Lista de features selecionadas (top 30)

## Features Avançadas (50+)

O modelo usa features sofisticadas:
- **Técnicas**: RSI, MACD, Bollinger Bands, ATR
- **Momentum**: Retornos 1d, 5d, 10d, 20d, aceleração
- **Volatilidade**: Vol 5d, 10d, 20d, ratio
- **Reversão à Média**: Distância de MAs, Z-score
- **Tendência**: Slope, força, ADX simplificado
- **Regime**: Alta volatilidade, trending vs ranging
- **Médias Móveis**: MA 5, 10, 20, 50

## Walk-Forward Validation

O treino usa validação temporal:
- 5 splits crescentes
- Treina em janela crescente
- Valida no período seguinte
- Métricas agregadas (avg RMSE, avg MAPE)

## Feature Selection

Seleção automática das melhores features:
- F-statistic para ranking
- Top 30 features selecionadas
- Reduz overfitting
- Melhora generalização

## Monitoramento

### CloudWatch Metrics
- Training job: `TrainingJobStatus`, `TrainingTime`
- Endpoint: `ModelLatency`, `Invocations`, `ModelSetupTime`

### Logs
- Training: `/aws/sagemaker/TrainingJobs`
- Endpoint: `/aws/sagemaker/Endpoints/b3tr-ensemble-endpoint`

## Próximos Passos

1. ✅ Deploy Lambdas no CDK
2. ✅ Testar treinamento local
3. ✅ Criar training job no SageMaker
4. ✅ Criar endpoint
5. ✅ Testar inferência
6. ✅ Automatizar com EventBridge

## Comandos Úteis

```bash
# Ver últimas recomendações
aws s3 cp s3://BUCKET/recommendations/dt=$(date +%Y-%m-%d)/top50.json - | jq

# Ver métricas do modelo
aws s3 cp s3://BUCKET/models/ensemble/latest/metrics.json - | jq

# Ver feature importance
aws s3 cp s3://BUCKET/models/ensemble/latest/feature_importance.csv - | column -t -s,

# Ver logs do ranking
aws logs tail /aws/lambda/B3TacticalRankingStackV2-RankSageMaker-XXX --follow

# Forçar ranking manual
aws lambda invoke \
  --function-name B3TacticalRankingStackV2-RankSageMaker-XXX \
  --payload '{}' \
  rank_output.json

# Forçar modo momentum (sem modelo)
aws lambda invoke \
  --function-name B3TacticalRankingStackV2-RankSageMaker-XXX \
  --payload '{"force_momentum": true}' \
  rank_output.json

# Listar training jobs
aws sagemaker list-training-jobs --sort-by CreationTime --sort-order Descending

# Ver logs de treino
aws logs tail /aws/sagemaker/TrainingJobs --follow
```
