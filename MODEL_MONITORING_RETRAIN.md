# Monitoramento e Re-treino do Modelo

## Visão Geral

O sistema monitora continuamente a performance do modelo em produção e decide automaticamente quando é necessário re-treinar.

## Arquitetura de Monitoramento

```
┌─────────────────────────────────────────────────────────────┐
│                  CICLO DE VIDA DO MODELO                     │
└─────────────────────────────────────────────────────────────┘

Dia 0: TREINO INICIAL
├─ Lambda: train_sagemaker
├─ SageMaker Training Job (5-15 min)
├─ Salva: s3://bucket/models/ensemble/2026-03-09/model.tar.gz
└─ Métricas: MAPE=12%, CV RMSE=0.05

Dia 1-20: PREDIÇÕES DIÁRIAS
├─ Lambda: rank_sagemaker (18:10 BRT)
├─ Carrega modelo do S3
├─ Gera predições para T+20
└─ Salva: s3://bucket/recommendations/dt=2026-03-10/top50.json

Dia 21+: VALIDAÇÃO CONTÍNUA
├─ Lambda: monitor_model_performance (19:30 BRT)
├─ Compara predições de 20 dias atrás com preços reais
├─ Calcula: MAPE, Acurácia Direcional, MAE
├─ Detecta: Drift, Degradação
└─ Decide: Re-treinar ou continuar

Se MAPE > 20% OU Drift detectado:
├─ Envia alerta SNS
├─ Recomenda re-treino
└─ Aguarda ação manual ou automática
```

## Métricas Monitoradas

### 1. MAPE (Mean Absolute Percentage Error)
**O que é**: Erro percentual médio entre predição e realidade

**Cálculo**:
```
MAPE = (1/n) * Σ |actual - predicted| / |actual| * 100
```

**Interpretação**:
- MAPE < 10%: Excelente
- MAPE 10-15%: Bom
- MAPE 15-20%: Aceitável
- MAPE > 20%: **Re-treinar necessário**

### 2. Acurácia Direcional
**O que é**: % de vezes que o modelo acertou a direção do movimento (subida/descida)

**Cálculo**:
```
Acurácia = (acertos / total) * 100
```

**Interpretação**:
- > 60%: Excelente
- 55-60%: Bom
- 50-55%: Aceitável
- < 50%: Pior que aleatório

### 3. MAE (Mean Absolute Error)
**O que é**: Erro absoluto médio em reais

**Cálculo**:
```
MAE = (1/n) * Σ |actual - predicted|
```

**Interpretação**:
- Depende do preço médio das ações
- Útil para entender magnitude do erro

## Detecção de Drift

### O que é Drift?
Drift ocorre quando a distribuição dos dados muda ao longo do tempo, fazendo o modelo perder performance.

### Como Detectamos
Comparamos MAPE dos últimos 5 dias com os 5 dias anteriores:

```python
recent_avg = mean(mape[-5:])      # Últimos 5 dias
baseline_avg = mean(mape[-10:-5])  # 5 dias anteriores

if recent_avg / baseline_avg > 1.5:
    # Drift detectado! Performance piorou 50%
    trigger_retrain()
```

### Causas Comuns de Drift
- Mudanças no regime de mercado (bull → bear)
- Eventos macroeconômicos (taxa de juros, inflação)
- Mudanças estruturais no mercado
- Novos padrões de trading

## Critérios para Re-treino

O sistema recomenda re-treino quando **qualquer** condição é atendida:

### 1. MAPE Alto (> 20%)
```
Performance atual muito ruim
```

### 2. Drift Detectado
```
Performance degradou 50% nos últimos 5 dias
```

### 3. Performance Pior que Treino
```
MAPE atual > 2x MAPE de treino
Exemplo: Treino=12%, Atual=25%
```

## Fluxo de Re-treino

### Automático (Recomendado)

```bash
# 1. Sistema detecta necessidade de re-treino
# 2. Envia alerta SNS
# 3. Lambda pode ser configurada para re-treinar automaticamente

# Configurar re-treino automático (futuro):
# Adicionar permissão para monitor_model_performance invocar train_sagemaker
```

### Manual (Atual)

```bash
# 1. Receber alerta SNS
# 2. Verificar métricas
aws s3 cp s3://BUCKET/monitoring/performance/dt=$(date +%Y-%m-%d)/metrics.json - | jq

# 3. Decidir re-treinar
aws lambda invoke \
  --function-name TrainSageMaker \
  --payload '{
    "lookback_days": 365,
    "hyperparameters": {
      "max_depth": "6",
      "learning_rate": "0.1",
      "n_estimators": "100"
    }
  }' \
  retrain_output.json

# 4. Aguardar conclusão (5-15 min)
TRAINING_JOB=$(cat retrain_output.json | jq -r '.training_job_name')
aws sagemaker wait training-job-completed-or-stopped \
  --training-job-name $TRAINING_JOB

# 5. Novo modelo automaticamente usado no próximo ranking
```

## Estrutura de Dados

### Métricas de Performance (S3)
```
s3://bucket/monitoring/performance/
└── dt=YYYY-MM-DD/
    └── metrics.json
        {
          "date": "2026-03-30",
          "prediction_date": "2026-03-10",
          "n_predictions": 50,
          "mape": 14.5,
          "mae": 2.3,
          "directional_accuracy": 62.0,
          "method": "xgboost_ensemble",
          "model_metadata": {
            "model_date": "2026-03-09",
            "train_mape": 12.0,
            "cv_avg_mape": 13.5
          }
        }
```

### CloudWatch Metrics
- `B3TR/ModelMAPE` - MAPE diário
- `B3TR/DirectionalAccuracy` - Acurácia direcional
- `B3TR/ModelMAE` - MAE diário

## Dashboard de Monitoramento

### CloudWatch Dashboard
```bash
# Ver métricas no console
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=B3TR-ModelOptimization
```

### Queries Úteis

```bash
# Ver performance dos últimos 30 dias
aws s3 ls s3://BUCKET/monitoring/performance/ --recursive | tail -30

# Ver MAPE dos últimos 7 dias
for i in {0..6}; do
  DATE=$(date -d "$i days ago" +%Y-%m-%d)
  aws s3 cp s3://BUCKET/monitoring/performance/dt=$DATE/metrics.json - 2>/dev/null | jq -r ".mape // \"N/A\""
done

# Ver se drift foi detectado
aws s3 cp s3://BUCKET/monitoring/performance/dt=$(date +%Y-%m-%d)/metrics.json - | jq '.needs_retrain'
```

## Alertas SNS

### Formato do Alerta
```
Subject: B3TR: Re-treino Necessário

Body:
B3 Tactical Ranking - Re-treino Necessário

Data: 2026-03-30
Predições validadas: 2026-03-10

Métricas Atuais:
- MAPE: 22.5%
- Acurácia Direcional: 48.0%
- MAE: 3.2

Modelo Atual:
- Data de treino: 2026-03-09
- MAPE de treino: 12.0%

Motivo:
- MAPE alto: True
- Drift detectado: True
- Performance degradada: True

Ação Recomendada:
aws lambda invoke --function-name TrainSageMaker \
  --payload '{"lookback_days": 365}' output.json
```

## Frequência de Monitoramento

- **Predições**: Diárias (18:10 BRT)
- **Validação**: Diárias (19:30 BRT) - valida predições de 20 dias atrás
- **Alertas**: Imediatos quando critérios atendidos
- **Re-treino**: Sob demanda (manual ou automático)

## Histórico de Modelos

Todos os modelos são versionados por data:

```
s3://bucket/models/ensemble/
├── 2026-03-09/  # Modelo inicial
│   ├── model.tar.gz
│   ├── metrics.json
│   └── feature_importance.csv
├── 2026-04-15/  # Re-treino 1
│   ├── model.tar.gz
│   ├── metrics.json
│   └── feature_importance.csv
└── 2026-05-20/  # Re-treino 2
    ├── model.tar.gz
    ├── metrics.json
    └── feature_importance.csv
```

O sistema sempre usa o modelo mais recente automaticamente.

## Rollback de Modelo

Se um novo modelo performar pior:

```bash
# 1. Identificar modelo anterior
aws s3 ls s3://BUCKET/models/ensemble/

# 2. Copiar modelo anterior para "latest"
aws s3 cp \
  s3://BUCKET/models/ensemble/2026-03-09/model.tar.gz \
  s3://BUCKET/models/ensemble/latest/model.tar.gz

# 3. Próximo ranking usará modelo anterior
```

## Custos de Monitoramento

- **Lambda monitor_model_performance**: $0.05/mês (22 execuções × 10s)
- **CloudWatch Metrics**: $0.30/mês (3 métricas × 22 dias)
- **S3 Storage**: $0.01/mês (métricas JSON)
- **SNS**: $0.01/mês (alertas ocasionais)

**Total: ~$0.37/mês**

## Melhores Práticas

1. **Não re-treinar muito frequentemente**
   - Mínimo 2 semanas entre re-treinos
   - Deixar modelo estabilizar

2. **Validar antes de usar novo modelo**
   - Comparar métricas de treino com modelo anterior
   - Fazer backtesting se possível

3. **Manter histórico de modelos**
   - Nunca deletar modelos antigos
   - Facilita rollback se necessário

4. **Monitorar custos**
   - Re-treino custa ~$0.06
   - Não re-treinar desnecessariamente

5. **Documentar mudanças**
   - Anotar motivo do re-treino
   - Registrar hiperparâmetros usados

## Próximos Passos

### Curto Prazo
- [x] Implementar monitoramento de performance
- [x] Detectar drift automaticamente
- [x] Enviar alertas SNS
- [ ] Validar com dados reais

### Médio Prazo
- [ ] Re-treino automático (sem intervenção manual)
- [ ] A/B testing de modelos
- [ ] Rollback automático se performance piorar

### Longo Prazo
- [ ] Ensemble com múltiplos modelos
- [ ] Meta-learner para combinar predições
- [ ] Otimização contínua de hiperparâmetros
