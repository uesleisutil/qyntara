# Deployment de Produção - B3 Tactical Ranking

## Arquitetura de Produção

```
┌─────────────────────────────────────────────────────────────┐
│                    FASE 1: TREINO INICIAL                    │
│                      (Executar 1x)                           │
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
                    │   - Features     │
                    │   - Métricas     │
                    └──────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              FASE 2: INFERÊNCIA DIÁRIA                       │
│              (Automático às 18:10 BRT)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────┐    ┌──────────────────┐    ┌─────────────┐
│ EventBridge      │───▶│  Lambda: Rank    │───▶│ S3: Dados   │
│  Cron Daily      │    │   SageMaker      │    │  Históricos │
└──────────────────┘    └──────────────────┘    └─────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Gerar Features   │
                    │ (Advanced)       │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Carregar Modelo  │
                    │ do S3            │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Fazer Predições  │
                    │ (In-Memory)      │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Gerar Ranking    │
                    │ Top 50           │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Salvar S3        │
                    │ recommendations/ │
                    └──────────────────┘
```

## Fluxo de Deployment

### 1. Setup Inicial (Uma vez)

```bash
# 1. Deploy da infraestrutura
cd infra
npm install
cdk deploy

# 2. Aguardar bootstrap de dados históricos (automático)
# Lambda bootstrap_history_daily roda a cada 30 min até completar

# 3. Verificar dados disponíveis
aws s3 ls s3://BUCKET/curated/daily_monthly/ --recursive | wc -l
# Deve ter dados suficientes (120+ dias por ticker)
```

### 2. Treino Inicial do Modelo (Uma vez)

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

# Aguardar conclusão do training job (5-15 min)
TRAINING_JOB=$(cat train_output.json | jq -r '.training_job_name')
aws sagemaker describe-training-job --training-job-name $TRAINING_JOB

# Verificar modelo salvo no S3
aws s3 ls s3://BUCKET/models/ensemble/YYYY-MM-DD/
# Deve ter: model.tar.gz, metrics.json, feature_importance.csv
```

### 3. Operação Diária (Automático)

A partir de agora, o sistema roda automaticamente:

**18:10 BRT (21:10 UTC)** - Lambda `rank_sagemaker` é invocado:
1. Carrega dados históricos do S3 (últimos 260 dias)
2. Gera features avançadas para cada ticker
3. Carrega modelo treinado do S3
4. Faz predições in-memory (sem endpoint)
5. Gera ranking top 50
6. Salva recomendações no S3

**Sem custos de endpoint SageMaker!**

## Estrutura de Arquivos no S3

```
s3://BUCKET/
├── config/
│   ├── universe.txt              # Lista de tickers
│   └── b3_holidays_2026.json     # Feriados
│
├── curated/
│   └── daily_monthly/            # Dados históricos
│       └── year=YYYY/
│           └── month=MM/
│               └── YYYY-MM-DD.csv
│
├── models/
│   └── ensemble/
│       └── YYYY-MM-DD/           # Data do treino
│           ├── model.tar.gz      # Modelo XGBoost
│           ├── metrics.json      # Métricas de treino
│           ├── feature_importance.csv
│           ├── feature_scores.csv
│           └── selected_features.json
│
├── training/
│   └── ensemble/
│       └── YYYY-MM-DD/
│           └── train.csv         # Dados de treino
│
└── recommendations/
    └── dt=YYYY-MM-DD/
        └── top50.json            # Recomendações diárias
```

## Modelo Treinado (model.tar.gz)

O arquivo `model.tar.gz` contém:
- `xgboost_model.json` - Modelo XGBoost serializado
- `metrics.json` - Métricas de validação
- `feature_importance.csv` - Importância das features
- `selected_features.json` - Lista de features selecionadas

## Lambda: rank_sagemaker.py (Modificado)

```python
def handler(event, context):
    # 1. Carregar dados históricos
    series = load_monthly_data_for_ranking(bucket, 260)
    
    # 2. Gerar features avançadas
    features_df = prepare_features(series)
    
    # 3. Carregar modelo do S3 (in-memory)
    model = load_model_from_s3(bucket, model_key)
    
    # 4. Fazer predições (sem endpoint)
    predictions = model.predict(features_df)
    
    # 5. Gerar ranking
    ranking = generate_ranking(features_df, predictions, top_n=50)
    
    # 6. Salvar recomendações
    save_recommendations(bucket, ranking)
```

## Custos Mensais Estimados

### Treino Inicial (Uma vez)
- **SageMaker Training**: ml.m5.xlarge × 0.25h = $0.06
- **Lambda Train**: negligível

### Operação Diária (22 dias úteis/mês)
- **Lambda Rank**: 2048MB × 60s × 22 = $0.15/mês
- **Lambda Ingest**: 1024MB × 5min × 22 × 12/dia = $0.50/mês
- **S3 Storage**: 1GB = $0.023/mês
- **S3 Requests**: negligível
- **CloudWatch Logs**: 7 dias retention = $0.10/mês

**Total: ~$0.84/mês** (após treino inicial)

## Re-treino (Opcional)

Recomendado: 1x por mês ou quando performance degradar

```bash
# Verificar performance atual
aws s3 cp s3://BUCKET/monitoring/quality/latest.json - | jq

# Se MAPE > 15% ou drift detectado, re-treinar
aws lambda invoke \
  --function-name B3TacticalRankingStackV2-TrainSageMaker-XXX \
  --payload '{"lookback_days": 365}' \
  retrain_output.json
```

## Monitoramento

### Métricas Diárias
- **IngestionOK**: Ingestão funcionando
- **RankingGenerated**: Ranking gerado com sucesso
- **PredictionCount**: Número de predições
- **ModelMAPE**: Erro médio do modelo

### Alertas
- Falha na ingestão → SNS
- Falha no ranking → SNS
- MAPE > 20% → SNS
- Custos > $10/mês → SNS

## Comandos Úteis

```bash
# Ver últimas recomendações
aws s3 cp s3://BUCKET/recommendations/dt=$(date +%Y-%m-%d)/top50.json - | jq

# Ver métricas do modelo
aws s3 cp s3://BUCKET/models/ensemble/latest/metrics.json - | jq

# Ver logs do ranking
aws logs tail /aws/lambda/B3TacticalRankingStackV2-RankSageMaker-XXX --follow

# Forçar ranking manual
aws lambda invoke \
  --function-name B3TacticalRankingStackV2-RankSageMaker-XXX \
  --payload '{}' \
  rank_output.json

# Ver custos
aws ce get-cost-and-usage \
  --time-period Start=2026-03-01,End=2026-03-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://filter.json
```

## Vantagens desta Arquitetura

✅ **Custo mínimo**: Sem endpoint 24/7 (~$47/mês economizados)
✅ **Simples**: Treina 1x, usa N vezes
✅ **Rápido**: Inferência in-memory < 10s
✅ **Escalável**: Lambda escala automaticamente
✅ **Confiável**: Fallback para momentum se modelo falhar
✅ **Monitorado**: Alertas automáticos
✅ **Auditável**: Todas as predições salvas no S3

## Próximos Passos

1. ✅ Deploy da infraestrutura
2. ✅ Aguardar bootstrap de dados
3. ✅ Treinar modelo inicial
4. ✅ Verificar primeira recomendação
5. ⏳ Monitorar por 1 semana
6. ⏳ Ajustar hiperparâmetros se necessário
7. ⏳ Configurar re-treino mensal
