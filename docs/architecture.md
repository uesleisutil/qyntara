# Arquitetura B3TR

## 🏗️ Visão Geral

O B3 Tactical Ranking é um sistema MLOps completo na AWS que automatiza:

1. **Ingestão** de dados de cotações da B3 via BRAPI Pro
2. **Processamento** e preparação de dados para ML
3. **Treinamento** de modelos DeepAR no SageMaker
4. **Geração** de rankings diários de ações
5. **Monitoramento** e alertas de qualidade
6. **Visualização** via dashboard web hospedado no GitHub Pages

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
                              │
                              ▼
                    ┌─────────────────┐
                    │  GitHub Pages   │
                    │   (Dashboard)   │
                    └─────────────────┘
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
    ├── model_quality/       # Métricas de qualidade do modelo
    └── ingestion/           # Status de ingestão
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

### Dashboard Web (GitHub Pages)
- **Framework**: React 18.2 com Recharts para visualizações
- **Hospedagem**: GitHub Pages (gratuito)
- **Acesso a Dados**: Leitura direta do S3 via AWS SDK
- **Atualização**: Auto-refresh a cada 5 minutos
- **Funcionalidades**:
  - Visualização de recomendações diárias (top 10 ações)
  - Gráficos de qualidade do modelo (MAPE, cobertura)
  - Monitoramento de ingestão de dados
  - Indicadores de saúde do sistema
- **Deploy**: Automático via GitHub Actions

### Monitoramento
- **CloudWatch Metrics**: IngestionOK, ModelMAPE
- **CloudWatch Alarms**: Falhas de ingestão
- **SNS**: Alertas por email
- **Dashboard**: Visualização em tempo real via GitHub Pages

## 🔐 Segurança

- **IAM Roles**: Princípio do menor privilégio
- **Secrets Manager**: Token BRAPI criptografado
- **VPC**: Não necessário (serviços gerenciados)
- **Encryption**: S3 server-side encryption
- **Dashboard**: Credenciais AWS com acesso somente leitura ao S3
- **CORS**: Configurado no S3 para permitir acesso do GitHub Pages

## 📈 Escalabilidade

- **Lambda**: Auto-scaling automático
- **S3**: Ilimitado
- **SageMaker**: Instâncias sob demanda
- **EventBridge**: Até 300 invocações/segundo
- **Dashboard**: CDN global do GitHub Pages

## 🌐 Fluxo de Dados para Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│                    Navegador do Usuário                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Dashboard React (GitHub Pages)                 │ │
│  │  - Auto-refresh a cada 5 minutos                       │ │
│  │  - Leitura direta do S3 via AWS SDK                    │ │
│  │  - Visualizações com Recharts                          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS (AWS SDK)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    AWS S3 Bucket (CORS)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  recommendations/YYYY-MM-DD.json                       │ │
│  │  monitoring/model_quality/YYYY-MM-DD.json              │ │
│  │  monitoring/ingestion/YYYY-MM-DD-HH-MM.json            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

O dashboard é uma aplicação React estática que:
1. É servida pelo GitHub Pages (CDN global)
2. Faz requisições diretas ao S3 usando credenciais AWS
3. Processa e visualiza os dados no navegador do usuário
4. Não requer servidor backend (100% serverless)