# Arquitetura B3TR

## 🏗️ Visão Geral

O B3 Tactical Ranking é um sistema MLOps completo na AWS que automatiza:

1. **Ingestão** de dados de cotações da B3 via BRAPI Pro
2. **Processamento** e preparação de dados para ML
3. **Treinamento** de modelos DeepAR no SageMaker
4. **Geração** de rankings diários de ações
5. **Monitoramento** e alertas de qualidade

## 📊 Diagrama de Arquitetura

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   BRAPI Pro     │───▶│   Lambda     │───▶│      S3         │
│   (Cotações)    │    │  (Ingestão)  │    │  (Data Lake)    │
└─────────────────┘    └──────────────┘    └─────────────────┘
                              │                       │
                              ▼                       ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│  EventBridge    │───▶│   Lambda     │───▶│   SageMaker     │
│  (Scheduler)    │    │  (Ranking)   │    │   (DeepAR)      │
└─────────────────┘    └──────────────┘    └─────────────────┘
                              │                       │
                              ▼                       ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   CloudWatch    │◀───│   Lambda     │◀───│      SNS        │
│  (Monitoring)   │    │ (Monitoring) │    │   (Alertas)     │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

## 🔧 Componentes

### AWS Lambda Functions
- **bootstrap_history_daily**: Download inicial de 10 anos de dados
- **ingest_quotes**: Ingestão incremental a cada 5 minutos
- **rank_start**: Inicia treinamento do modelo DeepAR
- **rank_finalize**: Gera ranking final das ações
- **monitor_ingestion**: Monitora qualidade da ingestão
- **monitor_model_quality**: Monitora performance do modelo

### Amazon S3 (Data Lake)
```
bucket/
├── raw/quotes_5m/           # Dados brutos da BRAPI
├── curated/daily_monthly/   # Dados históricos organizados
├── training/deepar/         # Datasets para treinamento
├── models/                  # Modelos treinados
├── predictions/             # Previsões do modelo
├── recommendations/         # Rankings finais
└── monitoring/              # Relatórios de monitoramento
```

### Amazon EventBridge
- **Ingestão**: `cron(0/5 13-20 ? * MON-FRI *)` - A cada 5min durante pregão
- **Bootstrap**: `cron(0/30 * ? * * *)` - A cada 30min (até completar)
- **Ranking Start**: `cron(10 21 ? * MON-FRI *)` - Diário às 18:10 BRT
- **Ranking Finalize**: `cron(40 21 ? * MON-FRI *)` - Diário às 18:40 BRT
- **Monitor Quality**: `cron(0 22 ? * MON-FRI *)` - Diário às 19:00 BRT

### Amazon SageMaker
- **DeepAR**: Modelo de forecasting para séries temporais
- **Instance Type**: ml.m5.large (configurável)
- **Training**: Automático via Lambda
- **Inference**: Batch Transform

### Monitoramento
- **CloudWatch Metrics**: IngestionOK, ModelMAPE
- **CloudWatch Alarms**: Falhas de ingestão
- **SNS**: Alertas por email

## 🔐 Segurança

- **IAM Roles**: Princípio do menor privilégio
- **Secrets Manager**: Token BRAPI criptografado
- **VPC**: Não necessário (serviços gerenciados)
- **Encryption**: S3 server-side encryption

## 📈 Escalabilidade

- **Lambda**: Auto-scaling automático
- **S3**: Ilimitado
- **SageMaker**: Instâncias sob demanda
- **EventBridge**: Até 300 invocações/segundo