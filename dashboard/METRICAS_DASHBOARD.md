# 📊 Métricas do Dashboard v2.0.1

**Data:** 07/03/2026  
**Versão:** 2.0.1 - Dashboard Completo com Todas as Métricas

---

## 🎯 Visão Geral

O dashboard agora possui **4 seções principais** com métricas completas de monitoramento e performance do pipeline MLOps:

### 1. 📈 Visão Geral (Overview)
Métricas essenciais para acompanhamento diário

### 2. 🎯 Performance do Modelo
Análise detalhada da performance dos modelos de ML

### 3. 📡 Monitoramento
Detecção de drift e análise de features

### 4. ⚙️ Avançado
Hiperparâmetros e explicabilidade

---

## 📊 Seção 1: Visão Geral

### Top 10 Recomendações
- **Fonte**: `s3://bucket/recommendations/YYYY-MM-DD.json`
- **Atualização**: Diária
- **Métricas**:
  - Ranking das ações
  - Score de confiança
  - Retorno previsto
  - Setor

### Qualidade do Modelo
- **Fonte**: `s3://bucket/monitoring/model_quality/YYYY-MM-DD.json`
- **Atualização**: Diária
- **Métricas**:
  - MAPE (Mean Absolute Percentage Error)
  - Cobertura das predições
  - Status (good/warning/critical)
  - Tendência histórica

### Ingestão de Dados
- **Fonte**: `s3://bucket/monitoring/ingestion/YYYY-MM-DD-HH-MM.json`
- **Atualização**: A cada 5 minutos
- **Métricas**:
  - Taxa de sucesso (últimas 24h)
  - Volume de dados processados
  - Erros e falhas
  - Histórico de execuções

### Status do Sistema
- **Métricas**:
  - Saúde geral do sistema
  - Status de cada subsistema
  - Alertas ativos
  - Última atualização

---

## 🎯 Seção 2: Performance do Modelo

### Performance Geral dos Modelos
- **Fonte**: `s3://bucket/models/metrics/*.json`
- **Métricas**:
  - MAPE por modelo
  - RMSE (Root Mean Square Error)
  - MAE (Mean Absolute Error)
  - R² Score
  - Tempo de treinamento
  - Número de parâmetros

### MAPE ao Longo do Tempo
- **Visualização**: Gráfico de linha temporal
- **Período**: Últimos 30 dias
- **Métricas**:
  - MAPE diário
  - Tendência
  - Limites de alerta (15%)
  - Média móvel

### Comparação de Modelos
- **Fonte**: `s3://bucket/models/metrics/*.json`
- **Visualização**: Gráfico de barras comparativo
- **Métricas**:
  - MAPE por modelo
  - Tempo de inferência
  - Acurácia
  - Ranking de performance

### Intervalos de Predição
- **Fonte**: `s3://bucket/predictions/intervals/*.json`
- **Visualização**: Gráfico com bandas de confiança
- **Métricas**:
  - Predição central
  - Intervalo de 80% de confiança
  - Intervalo de 95% de confiança
  - Valores reais vs preditos

### Insights do Ensemble
- **Fonte**: `s3://bucket/models/ensemble/*.json`
- **Métricas**:
  - Número de modelos no ensemble
  - Método de combinação
  - Performance do ensemble vs modelos individuais
  - Ganho de performance

### Pesos do Ensemble
- **Visualização**: Gráfico de pizza/barras
- **Métricas**:
  - Peso de cada modelo
  - Contribuição relativa
  - Modelos ativos/inativos
  - Histórico de pesos

---

## 📡 Seção 3: Monitoramento

### Detecção de Drift
- **Fonte**: `s3://bucket/monitoring/drift/*.json`
- **Atualização**: Diária
- **Métricas**:
  - Drift Score (0-1)
  - Status (no drift/warning/critical)
  - Features com drift detectado
  - Severidade do drift
  - Recomendações de ação

### Drift ao Longo do Tempo
- **Visualização**: Gráfico temporal com threshold
- **Período**: Últimos 30 dias
- **Métricas**:
  - Drift score diário
  - Threshold de alerta (0.3)
  - Threshold crítico (0.5)
  - Eventos de drift

### Importância das Features
- **Fonte**: `s3://bucket/features/importance/*.json`
- **Visualização**: Gráfico de barras horizontal
- **Métricas**:
  - Top 20 features mais importantes
  - Score de importância (0-1)
  - Tipo de feature (técnica, fundamental, etc)
  - Variação ao longo do tempo

### Análise de Features
- **Métricas Detalhadas**:
  - Distribuição de valores
  - Correlação com target
  - Missing values
  - Outliers
  - Estatísticas descritivas

---

## ⚙️ Seção 4: Avançado

### Hiperparâmetros Otimizados
- **Fonte**: `s3://bucket/hyperparameters/best_params*.json`
- **Atualização**: Mensal (após otimização)
- **Métricas**:
  - Hiperparâmetros atuais
  - Método de otimização (Optuna)
  - Número de trials
  - Melhor score obtido
  - Histórico de otimizações

**Hiperparâmetros Monitorados**:
- `context_length`: Janela histórica
- `prediction_length`: Horizonte de predição
- `num_layers`: Camadas da rede
- `num_cells`: Células por camada
- `dropout_rate`: Taxa de dropout
- `learning_rate`: Taxa de aprendizado
- `batch_size`: Tamanho do batch
- `epochs`: Número de épocas

### Explicabilidade das Predições
- **Métricas**:
  - SHAP values por feature
  - Contribuição de cada feature para predição
  - Features mais influentes por ação
  - Análise de sensibilidade
  - Casos de uso e exemplos

**Visualizações**:
- Waterfall plot (contribuição acumulada)
- Force plot (predição individual)
- Summary plot (visão geral)
- Dependence plot (relação feature-predição)

---

## 📈 Estrutura de Dados no S3

### Recomendações
```json
{
  "date": "2026-03-07",
  "recommendations": [
    {
      "ticker": "PETR4.SA",
      "rank": 1,
      "score": 0.85,
      "predicted_return": 0.12,
      "sector": "Energia"
    }
  ]
}
```

### Qualidade do Modelo
```json
{
  "dt": "2026-03-07",
  "mape": 4.2,
  "coverage": 88.5,
  "status": "good",
  "rmse": 0.05,
  "mae": 0.03
}
```

### Drift
```json
{
  "timestamp": "2026-03-07T10:00:00Z",
  "drift_score": 0.15,
  "status": "no_drift",
  "features_with_drift": [],
  "severity": "low"
}
```

### Ensemble
```json
{
  "timestamp": "2026-03-07",
  "models": [
    {
      "name": "deepar_1",
      "weight": 0.35,
      "mape": 4.1
    },
    {
      "name": "deepar_2",
      "weight": 0.40,
      "mape": 3.9
    },
    {
      "name": "deepar_3",
      "weight": 0.25,
      "mape": 4.5
    }
  ],
  "ensemble_mape": 4.0
}
```

### Feature Importance
```json
{
  "timestamp": "2026-03-07",
  "features": [
    {
      "name": "rsi_14",
      "importance": 0.15,
      "type": "technical"
    },
    {
      "name": "volume_ma_20",
      "importance": 0.12,
      "type": "volume"
    }
  ]
}
```

### Hiperparâmetros
```json
{
  "timestamp": "2026-03-07",
  "optimization_method": "optuna",
  "n_trials": 100,
  "best_score": 4.0,
  "params": {
    "context_length": 60,
    "prediction_length": 20,
    "num_layers": 3,
    "num_cells": 40,
    "dropout_rate": 0.1,
    "learning_rate": 0.001
  }
}
```

---

## 🎨 Indicadores Visuais

### Status Colors
- 🟢 **Verde (Good)**: MAPE < 5%, Drift < 0.3, Success Rate > 90%
- 🟡 **Amarelo (Warning)**: MAPE 5-15%, Drift 0.3-0.5, Success Rate 70-90%
- 🔴 **Vermelho (Critical)**: MAPE > 15%, Drift > 0.5, Success Rate < 70%

### Badges
- **Rank**: Posição no ranking (1-10)
- **Status**: Estado do sistema/modelo
- **Trend**: Tendência (↑ subindo, ↓ descendo, → estável)

---

## 🔄 Atualização dos Dados

### Frequência de Atualização

| Métrica | Frequência | Fonte |
|---------|-----------|-------|
| Recomendações | Diária (18:40 BRT) | Lambda rank_finalize |
| Qualidade do Modelo | Diária (19:00 BRT) | Lambda monitor_model_quality |
| Ingestão | A cada 5min (pregão) | Lambda ingest_quotes |
| Drift | Diária (20:00 BRT) | Lambda monitoring |
| Ensemble | Diária (19:30 BRT) | Lambda ensemble_predict |
| Feature Importance | Diária (19:00 BRT) | Lambda feature_engineering |
| Hiperparâmetros | Mensal | Lambda optimize_hyperparameters |

### Auto-Refresh
- **Intervalo**: 5 minutos
- **Manual**: Botão "Atualizar"
- **Timestamp**: Exibido no rodapé

---

## 📱 Responsividade

O dashboard é totalmente responsivo:

- **Desktop (1920x1080+)**: Grid de 2 colunas
- **Laptop (1280x800)**: Grid adaptativo
- **Tablet (768x1024)**: Grid de 1-2 colunas
- **Mobile (375x667)**: Stack vertical

---

## 🎯 KPIs Principais

### Performance do Modelo
- **Target MAPE**: < 5%
- **Target Coverage**: > 85%
- **Target R²**: > 0.7

### Operacional
- **Target Success Rate**: > 95%
- **Target Latency**: < 1 minuto
- **Target Uptime**: > 99.9%

### Drift
- **Warning Threshold**: 0.3
- **Critical Threshold**: 0.5
- **Action Required**: > 0.5

---

## 🔍 Como Interpretar as Métricas

### MAPE (Mean Absolute Percentage Error)
- **< 5%**: Excelente
- **5-10%**: Bom
- **10-15%**: Aceitável
- **> 15%**: Requer atenção

### Drift Score
- **< 0.3**: Sem drift
- **0.3-0.5**: Drift moderado (monitorar)
- **> 0.5**: Drift severo (retreinar modelo)

### Success Rate
- **> 95%**: Sistema saudável
- **90-95%**: Monitorar
- **< 90%**: Investigar problemas

---

## 📞 Suporte

Para dúvidas sobre as métricas:
1. Consulte a documentação técnica em `docs/`
2. Verifique os logs no CloudWatch
3. Abra uma issue no GitHub

---

**Dashboard v2.0.1 - Todas as Métricas de Performance e Monitoramento** 🚀
