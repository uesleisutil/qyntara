# Atualizações do Dashboard - Monitoramento de Performance e Custos

## Novos Componentes Adicionados

### 1. ModelPerformancePanel.jsx
**Localização**: `dashboard/src/components/panels/ModelPerformancePanel.jsx`

**Funcionalidades**:
- ✅ MAPE diário (últimos 30 dias)
- ✅ Acurácia direcional
- ✅ MAE (Mean Absolute Error)
- ✅ Detecção automática de drift
- ✅ Alerta visual quando re-treino é necessário
- ✅ Gráficos de tendência de performance
- ✅ Informações do modelo atual (data de treino, métricas)
- ✅ Comparação com métricas de treino

**Métricas Monitoradas**:
- MAPE < 10%: Excelente ✅
- MAPE 10-15%: Bom 👍
- MAPE 15-20%: Aceitável ⚠️
- MAPE > 20%: Crítico - Re-treinar ❌

### 2. CostMonitoringPanel.jsx
**Localização**: `dashboard/src/components/panels/CostMonitoringPanel.jsx`

**Funcionalidades**:
- ✅ Custo total diário
- ✅ Estimativa mensal
- ✅ Uso do orçamento (% e barra de progresso)
- ✅ Breakdown por serviço (Lambda, S3, SageMaker, CloudWatch)
- ✅ Gráfico de pizza com distribuição de custos
- ✅ Tendência de custos (últimos 30 dias)
- ✅ Alertas automáticos quando orçamento é ultrapassado
- ✅ Recomendações de otimização

**Alertas de Custo**:
- < 80% do orçamento: Verde ✅
- 80-100% do orçamento: Amarelo ⚠️
- > 100% do orçamento: Vermelho ❌

## Nova Aba no Dashboard

### "Custos & Performance"
Aba dedicada para monitoramento em tempo real de:
1. Performance do modelo (MAPE, acurácia, drift)
2. Custos operacionais (diário, mensal, por serviço)
3. Alertas e recomendações

## Integração com S3

Os painéis carregam dados diretamente do S3:

### Performance
```
s3://bucket/monitoring/performance/dt=YYYY-MM-DD/metrics.json
s3://bucket/models/ensemble/YYYY-MM-DD/metrics.json
```

### Custos
```
s3://bucket/monitoring/costs/dt=YYYY-MM-DD/costs.json
```

## Estrutura de Dados

### Performance Metrics (metrics.json)
```json
{
  "date": "2026-03-30",
  "prediction_date": "2026-03-10",
  "n_predictions": 50,
  "mape": 14.5,
  "mae": 2.3,
  "directional_accuracy": 62.0,
  "needs_retrain": false,
  "drift_detected": false,
  "model_metadata": {
    "model_date": "2026-03-09",
    "train_mape": 12.0,
    "cv_avg_mape": 13.5
  }
}
```

### Cost Metrics (costs.json)
```json
{
  "date": "2026-03-30",
  "total_cost": 0.0234,
  "monthly_estimate": 0.95,
  "budget": 10.0,
  "breakdown": {
    "Lambda": 0.015,
    "S3": 0.005,
    "CloudWatch": 0.003
  },
  "alerts": [
    {
      "service": "Lambda",
      "message": "Uso acima do esperado",
      "severity": "warning"
    }
  ]
}
```

## Como Usar

### 1. Acessar Dashboard
```
https://uesleisutil.github.io/b3-tactical-ranking
```

### 2. Navegar para "Custos & Performance"
Clique na aba "Custos & Performance" no menu superior

### 3. Monitorar Métricas
- **MAPE**: Deve estar < 15% para boa performance
- **Acurácia Direcional**: Deve estar > 55%
- **Custo Mensal**: Deve estar < $10

### 4. Agir em Alertas
Se aparecer alerta de re-treino:
```bash
aws lambda invoke \
  --function-name TrainSageMaker \
  --payload '{"lookback_days": 365}' \
  output.json
```

## Benefícios

### Visibilidade
- ✅ Monitoramento em tempo real
- ✅ Histórico de 30 dias
- ✅ Alertas visuais claros

### Proatividade
- ✅ Detecta problemas antes de impactar
- ✅ Recomenda ações específicas
- ✅ Previne custos excessivos

### Decisões Informadas
- ✅ Dados consolidados em um lugar
- ✅ Gráficos intuitivos
- ✅ Métricas acionáveis

## Próximos Passos

1. Deploy do dashboard atualizado
2. Validar carregamento de dados do S3
3. Configurar alertas SNS
4. Monitorar por 1 semana
5. Ajustar thresholds se necessário

## Comandos Úteis

```bash
# Build do dashboard
cd dashboard
npm install
npm run build

# Deploy no GitHub Pages
git add .
git commit -m "feat: add performance and cost monitoring panels"
git push origin main

# Verificar dados no S3
aws s3 ls s3://BUCKET/monitoring/performance/ --recursive
aws s3 ls s3://BUCKET/monitoring/costs/ --recursive
```

## Troubleshooting

### Painel não carrega dados
1. Verificar credenciais AWS no `.env`
2. Verificar permissões S3
3. Verificar se Lambda `monitor_model_performance` está rodando
4. Verificar se Lambda `monitor_costs` está rodando

### Métricas desatualizadas
1. Verificar EventBridge rules
2. Verificar logs das Lambdas
3. Forçar execução manual das Lambdas

### Custos não aparecem
1. Lambda `monitor_costs` precisa de permissões Cost Explorer
2. Verificar se relatório foi gerado hoje
3. Aguardar próxima execução (08:00 UTC diariamente)
