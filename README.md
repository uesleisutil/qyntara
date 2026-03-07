# 📈 B3 Tactical Ranking (B3TR)

<div align="center">

![License](https://img.shields.io/badge/License-MIT-yellow.svg)
![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)
![AWS](https://img.shields.io/badge/AWS-Cloud-orange.svg)
![CDK](https://img.shields.io/badge/AWS_CDK-TypeScript-green.svg)
![React](https://img.shields.io/badge/React-18.2-61DAFB.svg)
![Status](https://img.shields.io/badge/Status-Production-success.svg)

**Sistema MLOps automatizado para ranking tático de ações da B3 usando Machine Learning**

[Documentação](docs/) • [Deploy Guide](DEPLOY_GUIDE.md) • [Arquitetura](docs/architecture.md) • [Dashboard](https://uesleisutil.github.io/b3-tactical-ranking)

</div>

---

## 🎯 Visão Geral

O **B3 Tactical Ranking** é uma plataforma completa de MLOps que automatiza todo o ciclo de vida de análise quantitativa de ações da B3 (Bolsa de Valores Brasileira). O sistema utiliza modelos de Deep Learning (DeepAR) para prever movimentos de preços e gerar rankings diários das ações mais promissoras.

### 🌟 Principais Características

- **🤖 Machine Learning Automatizado**: Treinamento e inferência automáticos usando Amazon SageMaker DeepAR
- **📊 Ingestão em Tempo Real**: Coleta de cotações a cada 5 minutos durante o pregão via BRAPI Pro
- **🔄 Pipeline MLOps Completo**: Feature engineering, otimização de hiperparâmetros, treinamento e monitoramento
- **📈 Dashboard Interativo**: Visualização em tempo real hospedada no GitHub Pages (gratuito)
- **🔔 Alertas Inteligentes**: Monitoramento contínuo com notificações via SNS
- **💰 Custo-Efetivo**: ~$27-43/mês na AWS (sem QuickSight)
- **🚀 Deploy Automatizado**: Infraestrutura como código com AWS CDK

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INGESTÃO DE DADOS                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  BRAPI Pro   │───▶│   Lambda     │───▶│    S3 Data Lake      │  │
│  │  (Cotações)  │    │  (Ingestão)  │    │  (Raw/Curated/...)   │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PIPELINE DE ML                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Feature    │───▶│ Hyperparameter│───▶│   Model Training     │  │
│  │ Engineering  │    │ Optimization  │    │   (SageMaker)        │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│                                │                                     │
│                                ▼                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Ensemble   │───▶│  Monitoring  │───▶│   Drift Detection    │  │
│  │  Prediction  │    │  & Metrics   │    │   & Alerting         │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    RANKING & VISUALIZAÇÃO                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │   Ranking    │───▶│  Dashboard   │───▶│   GitHub Pages       │  │
│  │  Generation  │    │  (React)     │    │   (Gratuito)         │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 🔧 Componentes Principais

#### AWS Lambda Functions
| Função | Descrição | Frequência |
|--------|-----------|------------|
| **bootstrap_history_daily** | Download inicial de 10 anos de dados históricos | A cada 30min (até completar) |
| **ingest_quotes** | Ingestão incremental de cotações em tempo real | A cada 5min (durante pregão) |
| **feature_engineering** | Criação de features para ML | Diário + trigger S3 |
| **optimize_hyperparameters** | Otimização de hiperparâmetros | Mensal |
| **train_models** | Treinamento de modelos DeepAR | Semanal |
| **ensemble_predict** | Predições usando ensemble de modelos | Diário |
| **rank_start** | Inicia processo de ranking | Diário 18:10 BRT |
| **rank_finalize** | Finaliza e publica ranking | Diário 18:40 BRT |
| **monitor_ingestion** | Monitora qualidade da ingestão | A cada 5min |
| **monitor_model_quality** | Monitora performance dos modelos | Diário |
| **monitoring** | Monitoramento geral e drift detection | Diário |

#### Amazon S3 (Data Lake)
```
s3://bucket/
├── raw/quotes_5m/              # Dados brutos da BRAPI (5min)
├── curated/daily_monthly/      # Dados históricos organizados
├── training/deepar/            # Datasets para treinamento
├── models/                     # Modelos treinados
├── predictions/                # Previsões do modelo
├── recommendations/            # Rankings finais (top 10)
├── features/                   # Features engineered
├── hyperparameters/            # Melhores hiperparâmetros
└── monitoring/                 # Relatórios de monitoramento
    ├── model_quality/          # Métricas de qualidade (MAPE, etc)
    ├── ingestion/              # Status de ingestão
    └── drift/                  # Detecção de drift
```

#### Amazon SageMaker
- **Algoritmo**: DeepAR (Deep Autoregressive Recurrent Network)
- **Tipo de Instância**: ml.m5.large (configurável)
- **Treinamento**: Automático via Lambda + EventBridge
- **Inferência**: Batch Transform Jobs
- **Ensemble**: Múltiplos modelos com pesos otimizados

#### Dashboard Web (GitHub Pages)
- **Framework**: React 18.2 + Recharts
- **Hospedagem**: GitHub Pages (CDN global, gratuito)
- **Acesso a Dados**: Leitura direta do S3 via AWS SDK
- **Atualização**: Auto-refresh a cada 5 minutos
- **URL**: https://uesleisutil.github.io/b3-tactical-ranking

**Funcionalidades do Dashboard:**
- ✅ Visualização de recomendações diárias (top 10 ações)
- ✅ Gráficos de qualidade do modelo (MAPE, cobertura, intervalos de predição)
- ✅ Monitoramento de ingestão de dados em tempo real
- ✅ Indicadores de saúde do sistema
- ✅ Análise de feature importance
- ✅ Detecção de drift
- ✅ Pesos do ensemble
- ✅ Design responsivo (mobile-friendly)

## 🚀 Quick Start

### Pré-requisitos

- ✅ **AWS CLI** configurado (`aws configure`)
- ✅ **Node.js 18+** e **AWS CDK** (`npm i -g aws-cdk`)
- ✅ **Python 3.11+**
- ✅ **Token BRAPI Pro** ([brapi.dev](https://brapi.dev))
- ✅ **Conta AWS** (região us-east-1 recomendada)

### Deploy em 5 Minutos

```bash
# 1. Clone o repositório
git clone https://github.com/uesleisutil/b3-tactical-ranking.git
cd b3-tactical-ranking

# 2. Configure suas credenciais
cp .env.example .env
# Edite .env com suas configurações AWS

# 3. Deploy da infraestrutura
cd infra
npm ci
cdk bootstrap  # Apenas primeira vez
cdk deploy --require-approval never

# 4. Configure o token BRAPI
aws secretsmanager create-secret \
  --name "brapi/pro/token" \
  --secret-string '{"token":"SEU_TOKEN_BRAPI"}'

# 5. Configure email de alertas (opcional)
aws sns subscribe \
  --topic-arn $(aws cloudformation describe-stacks \
    --stack-name B3TacticalRankingStackV2 \
    --query 'Stacks[0].Outputs[?OutputKey==`AlertsTopicArn`].OutputValue' \
    --output text) \
  --protocol email \
  --notification-endpoint seu-email@example.com

# 6. Teste o sistema
cd ..
./scripts/test-system.sh
```

**Pronto!** 🎉 Seu sistema está rodando automaticamente na AWS.

## � Estrutura do Projeto

```
b3-tactical-ranking/
├── 📄 README.md                    # Este arquivo
├── 📄 LICENSE                      # Licença MIT
├── 📄 DEPLOY_GUIDE.md             # Guia detalhado de deploy
├── 📄 QUICKSIGHT_REMOVAL.md       # Documentação remoção QuickSight
│
├── 📁 docs/                       # Documentação técnica
│   ├── README.md                  # Índice da documentação
│   ├── architecture.md            # Arquitetura detalhada
│   ├── deployment.md              # Processo de deployment
│   └── troubleshooting.md         # Solução de problemas
│
├── 📁 dashboard/                  # Dashboard React
│   ├── src/                       # Código fonte React
│   ├── public/                    # Assets públicos
│   ├── package.json               # Dependências Node.js
│   └── README.md                  # Documentação do dashboard
│
├── 📁 infra/                      # Infraestrutura AWS CDK
│   ├── lib/                       # Stacks CDK
│   │   └── infra-stack.ts        # Stack principal
│   ├── bin/                       # Entry point CDK
│   │   └── infra.ts              # App CDK
│   ├── package.json               # Dependências CDK
│   └── cdk.json                   # Configuração CDK
│
├── 📁 ml/                         # Código Machine Learning
│   └── src/
│       ├── lambdas/               # Funções Lambda
│       │   ├── ingest_quotes.py
│       │   ├── feature_engineering.py
│       │   ├── optimize_hyperparameters.py
│       │   ├── train_models.py
│       │   ├── ensemble_predict.py
│       │   ├── rank_start.py
│       │   ├── rank_finalize.py
│       │   └── monitoring.py
│       ├── models/                # Modelos ML
│       │   ├── deepar_trainer.py
│       │   ├── ensemble.py
│       │   └── walk_forward_validator.py
│       └── utils/                 # Utilitários
│           ├── s3_utils.py
│           ├── brapi_client.py
│           └── metrics.py
│
├── 📁 scripts/                    # Scripts operacionais
│   ├── setup.sh                   # Setup completo
│   ├── test-system.sh             # Testes do sistema
│   ├── check-quicksight-resources.sh
│   └── cleanup-quicksight.sh
│
├── 📁 config/                     # Configurações
│   ├── universe.txt               # Lista de tickers
│   └── b3_holidays_2026.json      # Feriados B3
│
└── 📁 .github/                    # GitHub configs
    ├── workflows/                 # GitHub Actions
    │   ├── deploy-dashboard.yml   # Deploy automático dashboard
    │   └── cdk-deploy.yml         # Deploy automático infra
    └── ISSUE_TEMPLATE/            # Templates de issues
```

## ⚙️ Configuração

### Variáveis de Ambiente Principais

Edite o arquivo `.env` na raiz do projeto:

```bash
# AWS
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# BRAPI
BRAPI_SECRET_ID=brapi/pro/token

# Alertas
ALERT_EMAIL=seu-email@example.com

# Modelo ML
B3TR_CONTEXT_LENGTH=60          # Janela histórica (dias)
B3TR_PREDICTION_LENGTH=20       # Horizonte de previsão (dias)
B3TR_TOP_N=10                   # Top N ações no ranking

# Horários (UTC - pregão B3)
B3_OPEN_HOUR_UTC=13             # 10:00 BRT
B3_CLOSE_HOUR_UTC=20            # 17:00 BRT
B3TR_SCHEDULE_MINUTES=5         # Intervalo de ingestão

# Bootstrap
B3TR_HISTORY_RANGE=10y          # Histórico inicial
BOOTSTRAP_TICKERS_PER_RUN=10    # Tickers por execução
```

### Customização do Universe

Edite `config/universe.txt` com os tickers desejados:

```
PETR4.SA
VALE3.SA
ITUB4.SA
BBDC4.SA
ABEV3.SA
MGLU3.SA
WEGE3.SA
RENT3.SA
LREN3.SA
GGBR4.SA
```

## 📈 Como Funciona

### 1. Ingestão de Dados
- **Bootstrap**: Download inicial de 10 anos de dados históricos
- **Incremental**: Coleta de cotações a cada 5 minutos durante o pregão
- **Fonte**: BRAPI Pro API (dados da B3)
- **Armazenamento**: S3 em formato Parquet otimizado

### 2. Feature Engineering
- Criação de features técnicas (médias móveis, RSI, MACD, etc)
- Features de volume e volatilidade
- Features de momentum e tendência
- Normalização e tratamento de missing values

### 3. Treinamento de Modelos
- **Algoritmo**: DeepAR (Amazon SageMaker)
- **Validação**: Walk-forward validation
- **Otimização**: Hyperparameter tuning automático
- **Ensemble**: Múltiplos modelos com pesos otimizados

### 4. Geração de Rankings
- Predições para horizonte de 20 dias
- Cálculo de retorno esperado
- Análise de risco (volatilidade, drawdown)
- Ranking final baseado em score composto

### 5. Monitoramento
- **Qualidade do Modelo**: MAPE, RMSE, cobertura de intervalos
- **Drift Detection**: Monitoramento de mudanças na distribuição
- **Alertas**: Notificações automáticas via SNS
- **Dashboard**: Visualização em tempo real

## 📊 Métricas e KPIs

### Qualidade do Modelo
- **MAPE (Mean Absolute Percentage Error)**: < 5% (target)
- **Cobertura de Intervalos**: 80-95%
- **Sharpe Ratio**: Monitorado continuamente
- **Maximum Drawdown**: Alertas configuráveis

### Performance Operacional
- **Latência de Ingestão**: < 1 minuto
- **Tempo de Treinamento**: ~15-30 minutos
- **Disponibilidade**: 99.9% (SLA AWS)
- **Custo Mensal**: $27-43

## 💰 Custos Estimados

### Infraestrutura AWS (Mensal)

| Serviço | Custo Estimado | Descrição |
|---------|----------------|-----------|
| **Lambda** | $5-10 | Execuções das funções |
| **S3** | $0.50 | Armazenamento de dados |
| **SageMaker** | $20-30 | Treinamento e inferência |
| **CloudWatch** | $1-2 | Logs e métricas |
| **SNS** | $0.10 | Notificações |
| **EventBridge** | $0.10 | Agendamento |
| **Total** | **$27-43** | **Por mês** |

### Dashboard
- **GitHub Pages**: **Gratuito** ✅
- **S3 GET Requests**: ~$0.01/mês

### Economia vs QuickSight
- **QuickSight**: $18-24/mês
- **GitHub Pages**: $0/mês
- **Economia**: **$18-24/mês** (~$216-288/ano) 💰

## 🔐 Segurança

- **IAM Roles**: Princípio do menor privilégio
- **Secrets Manager**: Tokens criptografados
- **S3 Encryption**: Server-side encryption (SSE-S3)
- **VPC**: Não necessário (serviços gerenciados)
- **SSL/TLS**: Todas as comunicações criptografadas
- **CORS**: Configurado para GitHub Pages apenas

## 📚 Documentação

- **[Arquitetura Detalhada](docs/architecture.md)** - Visão técnica completa
- **[Guia de Deployment](docs/deployment.md)** - Deploy passo a passo
- **[Troubleshooting](docs/troubleshooting.md)** - Solução de problemas
- **[Deploy Guide](DEPLOY_GUIDE.md)** - Guia rápido de deploy
- **[QuickSight Removal](QUICKSIGHT_REMOVAL.md)** - Documentação da remoção

## 🧪 Testes

```bash
# Testar sistema completo
./scripts/test-system.sh

# Testar ingestão
aws lambda invoke \
  --function-name $(aws lambda list-functions \
    --query "Functions[?contains(FunctionName, 'Ingest')].FunctionName" \
    --output text) \
  --payload '{}' /tmp/test.json

# Verificar dados no S3
aws s3 ls s3://SEU-BUCKET/recommendations/ --recursive | tail -5

# Monitorar logs
aws logs tail "/aws/lambda/B3TacticalRankingStackV2-Quotes5mIngest*" --follow
```

## 🔄 Atualizações

### Atualizar Infraestrutura
```bash
cd infra
cdk deploy
```

### Atualizar Dashboard
```bash
# Automático via GitHub Actions
git push origin main

# Ou manual
cd dashboard
npm run deploy
```

## 🤝 Contribuição

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📝 Roadmap

- [ ] Suporte para mais exchanges (NASDAQ, NYSE)
- [ ] Modelos adicionais (LSTM, Transformer)
- [ ] Backtesting automatizado
- [ ] API REST para acesso externo
- [ ] Mobile app (React Native)
- [ ] Integração com brokers
- [ ] Análise de sentimento (NLP)
- [ ] Portfolio optimization

## ⚠️ Disclaimer

**Este projeto é apenas para fins educacionais e de pesquisa.**

- ❌ **NÃO constitui recomendação de investimento**
- ❌ **NÃO deve ser usado como única fonte de decisão**
- ❌ **Investimentos em ações envolvem riscos**
- ✅ **Sempre consulte um profissional certificado**
- ✅ **Faça sua própria análise (DYOR)**

O autor não se responsabiliza por perdas financeiras decorrentes do uso deste sistema.

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 👨‍💻 Autor

**Ueslei Sutil**

- GitHub: [@uesleisutil](https://github.com/uesleisutil)
- LinkedIn: [uesleisutil](https://linkedin.com/in/uesleisutil)

## 🙏 Agradecimentos

- [BRAPI](https://brapi.dev) - API de dados da B3
- [AWS](https://aws.amazon.com) - Infraestrutura cloud
- [Amazon SageMaker](https://aws.amazon.com/sagemaker/) - Plataforma de ML
- Comunidade open source

## 📞 Suporte

- 📖 **Documentação**: [docs/](docs/)
- 🐛 **Issues**: [GitHub Issues](https://github.com/uesleisutil/b3-tactical-ranking/issues)
- 💬 **Discussões**: [GitHub Discussions](https://github.com/uesleisutil/b3-tactical-ranking/discussions)

---

<div align="center">

**Desenvolvido com ❤️ para a comunidade de investidores brasileiros**

⭐ Se este projeto foi útil, considere dar uma estrela!

</div>
