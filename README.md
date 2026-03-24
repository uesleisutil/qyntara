<p align="center">
  <img src="https://img.shields.io/badge/status-production-brightgreen" alt="Status" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/react-18-61dafb" alt="React 18" />
  <img src="https://img.shields.io/badge/python-3.11-3776ab" alt="Python 3.11" />
  <img src="https://img.shields.io/badge/aws-cdk-ff9900" alt="AWS CDK" />
</p>

# Qyntara

Plataforma de recomendações de ações para a B3 baseada em machine learning, com dashboard de monitoramento MLOps, treinamento automatizado, detecção de drift e otimização de custos.

> **[qyntara.tech](https://qyntara.tech)**

---

## Visão Geral

O Qyntara combina um ensemble de modelos ML (XGBoost + DeepAR) com 50+ features técnicas para gerar um ranking diário das melhores oportunidades na bolsa brasileira. O sistema roda 100% serverless na AWS, com custo operacional inferior a US$ 1/mês.

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                        │
│  React 18 + TypeScript │ Recharts + D3 │ TanStack Table    │
└──────────┬──────────────────────────────────────────────────┘
           │ HTTPS
┌──────────▼──────────────────────────────────────────────────┐
│              API Gateway (REST + WAF + API Key)             │
└──────────┬──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│                  AWS Lambda (Python 3.11)                    │
│  28 funções: ingest, rank, train, monitor, backtest, auth  │
└─────┬──────────┬──────────┬──────────┬──────────────────────┘
      │          │          │          │
┌─────▼───┐ ┌───▼────┐ ┌──▼───────┐ ┌▼────────────┐
│   S3    │ │DynamoDB│ │ Secrets  │ │  SageMaker  │
│ (dados) │ │(users) │ │ Manager  │ │ (training)  │
└─────────┘ └────────┘ └──────────┘ └─────────────┘
```

## Funcionalidades

| Área | Descrição |
|------|-----------|
| Recomendações | Top-50 ações ranqueadas por score, com filtros, comparação e alertas |
| Performance | MAPE, acurácia direcional, Sharpe ratio, confusion matrix, benchmarks |
| Backtesting | Simulação histórica walk-forward, análise de risco (VaR, CVaR, drawdown) |
| Explainability | SHAP values, análise de sensibilidade, impacto de features |
| Carteiras | Carteiras personalizadas e carteira modelo por perfil de risco |
| Data Quality | Completude, anomalias, freshness, cobertura do universo |
| Drift Detection | Data drift (KS test), concept drift, alertas de degradação |
| Custos | Tendência de custos AWS, custo por predição, ROI calculator |

## Quick Start

### Pré-requisitos

- Node.js 20+, Python 3.11+, AWS CLI configurado, AWS CDK

### Setup

```bash
# Clone
git clone https://github.com/uesleisutil/qyntara.git
cd qyntara

# Infra
cp .env.example .env   # configure suas variáveis
cd infra && npm install && cdk deploy --all && cd ..

# Dashboard (dev)
cd dashboard && npm install && npm start
```

### Primeiro ranking

```bash
# Treinar modelo (~10 min)
aws lambda invoke --function-name <TrainSageMaker> --payload '{}' /dev/null

# Gerar ranking manualmente (roda automaticamente 18:10 BRT)
aws lambda invoke --function-name <RankSageMaker> --payload '{}' /dev/null
```


## Estrutura do Projeto

```
qyntara/
├── dashboard/           # Frontend React 18 + TypeScript
│   └── src/
│       ├── components/  # Componentes por feature
│       ├── contexts/    # React Context providers
│       ├── hooks/       # Custom hooks
│       ├── pages/       # Páginas (dashboard + admin)
│       ├── services/    # API client, cache, WebSocket
│       └── lib/         # Utilitários e formatters
├── ml/                  # Backend ML (Python 3.11)
│   └── src/
│       ├── lambdas/     # 28 Lambda handlers (deployed)
│       ├── features/    # Feature engineering (50+ features)
│       ├── monitoring/  # Drift, métricas, alertas
│       ├── explainability/ # SHAP, ensemble analysis
│       ├── backtesting/ # Motor de backtesting
│       ├── portfolio/   # Otimizador de carteira
│       ├── retraining/  # Versionamento e orquestração
│       ├── sentiment/   # Análise de sentimento
│       └── sagemaker/   # Scripts de treino SageMaker
├── infra/               # AWS CDK (5 stacks)
│   └── lib/
│       ├── infra-stack.ts             # Core (Lambda, API GW, S3, DynamoDB)
│       ├── monitoring-stack.ts        # CloudWatch dashboards e alarmes
│       ├── security-stack.ts          # WAF, auth, encryption
│       ├── optimization-stack.ts      # Performance tuning
│       └── disaster-recovery-stack.ts # DR cross-region
├── config/              # Universo de ações e feriados B3
├── scripts/             # Scripts de deploy e operação
└── docs/                # Documentação e runbooks
```

## Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

| Variável | Descrição | Default |
|----------|-----------|---------|
| `AWS_REGION` | Região AWS | `us-east-1` |
| `BRAPI_SECRET_ID` | Secret Manager key para token BRAPI | `brapi/pro/token` |
| `B3TR_PREDICTION_LENGTH` | Horizonte de predição (dias) | `20` |
| `B3TR_TOP_N` | Número de recomendações | `10` |
| `ALERT_EMAIL` | Email para alertas SNS | — |
| `JWT_SECRET` | Secret para autenticação JWT | — |

Veja `.env.example` para a lista completa.

## Operação Diária

O sistema roda automaticamente via EventBridge:

| Horário (BRT) | Tarefa |
|----------------|--------|
| 10:00–17:55 | Ingestão de cotações (a cada 5 min) |
| 09:00 | Análise de sentimento |
| 17:00 | Preparação de dados de treino |
| 18:00 | Ingestão de features |
| 18:10 | Ranking diário (top-50) |
| 18:25–18:35 | Feature importance, prediction intervals, model metrics |
| 18:45 | Cálculo de stop-loss |
| 18:50 | Otimização de carteira |
| 19:30 | Validação de predições (20 dias atrás) |
| 20:00 | Monitoramento de custos |
| 20:30 | Detecção de drift |
| Domingo 19:00 | Retreino semanal |

## Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18, TypeScript, Recharts, D3.js, TanStack Table v8 |
| State | React Context + React Query + Zustand |
| Backend | AWS Lambda (Python 3.11), API Gateway |
| ML | SageMaker (XGBoost + DeepAR ensemble) |
| Storage | S3 (dados), DynamoDB (users, carteiras, agents) |
| Auth | JWT + Stripe (planos Pro) |
| Infra | AWS CDK, WAF, CloudWatch, SNS |
| CI/CD | GitHub Actions, GitHub Pages |

## Custo Estimado

| Serviço | Custo/mês |
|---------|-----------|
| Lambda (28 funções) | ~$0.75 |
| S3 + DynamoDB | ~$0.15 |
| CloudWatch + SNS | ~$0.10 |
| **Total** | **~$1.00** |

SageMaker training: ~$0.06 por execução (on-demand).

## Documentação

- [API Reference](docs/API.md)
- [Componentes](docs/COMPONENTS.md)
- [Arquitetura (ADRs)](docs/ARCHITECTURE.md)
- [Disaster Recovery](docs/DISASTER_RECOVERY.md)
- [Runbooks](docs/runbooks/)
- [Changelog](CHANGELOG.md)

## Contribuindo

Veja [CONTRIBUTING.md](CONTRIBUTING.md) para guidelines de contribuição.

## Segurança

Para reportar vulnerabilidades, veja [SECURITY.md](SECURITY.md).

## Licença

MIT — veja [LICENSE](LICENSE).

---

> **Disclaimer:** Este projeto é apenas para fins educacionais e não constitui recomendação de investimento.
