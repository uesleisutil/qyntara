# B3 Tactical Ranking — MLOps Dashboard

A machine learning-powered stock recommendation system for the Brazilian stock exchange (B3), featuring an 8-tab monitoring dashboard, automated model training, drift detection, and cost optimization.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                         │
│  React 18 + TypeScript │ Recharts + D3.js │ TanStack Table      │
│  React Query │ Tailwind CSS │ Service Worker                    │
└──────────┬──────────────────────┬───────────────────────────────┘
           │ HTTPS                │ WebSocket
┌──────────▼──────────┐  ┌───────▼──────────┐
│   API Gateway       │  │  WebSocket GW    │
│   (REST + Auth)     │  │  (Real-time)     │
└──────────┬──────────┘  └───────┬──────────┘
           │                     │
┌──────────▼─────────────────────▼────────────────────────────────┐
│                     AWS Lambda (Python 3.11)                     │
│  dashboard_api │ rest_api │ backtesting_api │ data_quality       │
│  monitor_drift │ monitor_costs │ rank_sagemaker │ train_sagemaker│
│  webhook_management │ security_middleware │ auth_service         │
└──────┬──────────┬──────────┬──────────┬─────────────────────────┘
       │          │          │          │
┌──────▼───┐ ┌───▼────┐ ┌──▼───┐ ┌───▼──────────┐
│    S3    │ │DynamoDB│ │Redis │ │  SageMaker   │
│  (Data)  │ │(Config)│ │(Cache)│ │  (Training)  │
└──────────┘ └────────┘ └──────┘ └──────────────┘
```

## Dashboard Tabs

| Tab | Description |
|-----|-------------|
| **Recommendations** | Top-ranked stock picks with filtering, export, comparison, and alerts |
| **Performance** | Model metrics (MAPE, accuracy, Sharpe), confusion matrix, benchmarks |
| **Validation** | Predicted vs actual scatter plots, temporal accuracy, outlier analysis |
| **Costs** | AWS cost trends, cost-per-prediction, budget alerts, ROI calculator |
| **Data Quality** | Completeness rates, anomaly detection, freshness indicators, coverage |
| **Drift Detection** | Data drift (KS test), concept drift, performance degradation, retrain recommendations |
| **Explainability** | SHAP values, sensitivity analysis, feature impact, decision paths |
| **Backtesting** | Historical strategy simulation, walk-forward analysis, risk metrics |

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- AWS CLI configured (`aws configure`)
- AWS CDK (`npm install -g aws-cdk`)

### 1. Clone and Install

```bash
git clone https://github.com/uesleisutil/b3-tactical-ranking.git
cd b3-tactical-ranking
```

### 2. Deploy Infrastructure

```bash
cd infra
npm install
cdk deploy --all
```

This deploys: Lambda functions, API Gateway, S3 buckets, DynamoDB tables, ElastiCache Redis, CloudFront CDN, monitoring alarms, and disaster recovery resources.

### 3. Start the Dashboard (Development)

```bash
cd dashboard
npm install
npm start
```

The dashboard opens at `http://localhost:3000`.

### 4. Train the Initial Model

```bash
aws lambda invoke \
  --function-name <TrainSageMaker> \
  --payload '{"lookback_days": 365}' \
  output.json
```

Training takes 5–15 minutes. The system bootstraps historical data automatically.

### 5. Generate First Recommendations

Recommendations run daily at 18:10 BRT. To trigger manually:

```bash
aws lambda invoke \
  --function-name <RankSageMaker> \
  --payload '{}' \
  output.json
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `us-east-1` |
| `BRAPI_SECRET_ID` | Secrets Manager key for BRAPI token | `brapi/pro/token` |
| `B3TR_PREDICTION_LENGTH` | Prediction horizon in days | `20` |
| `B3TR_TOP_N` | Number of top recommendations | `10` |
| `ALERT_EMAIL` | Email for SNS alerts | — |
| `MODEL_QUALITY_MAPE_THRESHOLD` | MAPE threshold for retrain alerts | `0.20` |

See `.env.example` for the full list.

## Project Structure

```
.
├── dashboard/               # React 18 + TypeScript frontend
│   ├── src/
│   │   ├── components/      # UI components by feature
│   │   │   ├── recommendations/  # Recommendations tab
│   │   │   ├── charts/           # Shared chart components
│   │   │   ├── backtesting/      # Backtesting tab
│   │   │   ├── costs/            # Costs tab
│   │   │   ├── dataQuality/      # Data Quality tab
│   │   │   ├── driftDetection/   # Drift Detection tab
│   │   │   ├── explainability/   # Explainability tab
│   │   │   ├── validation/       # Validation tab
│   │   │   ├── monitoring/       # Monitoring components
│   │   │   ├── filters/          # Filter components
│   │   │   ├── export/           # Export (CSV, Excel, PDF)
│   │   │   ├── auth/             # Authentication
│   │   │   ├── help/             # FAQ, glossary, guided tour
│   │   │   ├── settings/         # User preferences
│   │   │   ├── shared/           # Reusable UI components
│   │   │   └── panels/           # Dashboard panels
│   │   ├── contexts/        # React Context providers
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API client, cache, WebSocket
│   │   └── utils/           # Utilities (accessibility, code splitting)
│   └── package.json
├── ml/                      # Python ML backend
│   └── src/
│       ├── lambdas/         # Lambda function handlers
│       ├── features/        # Feature engineering
│       └── sagemaker/       # SageMaker training scripts
├── infra/                   # AWS CDK infrastructure
│   └── lib/
│       ├── infra-stack.ts          # Core infrastructure
│       ├── monitoring-stack.ts     # CloudWatch monitoring
│       ├── security-stack.ts       # Security (WAF, auth)
│       ├── optimization-stack.ts   # Performance optimization
│       └── disaster-recovery-stack.ts  # DR resources
├── config/                  # Universe definition, holidays
├── scripts/                 # Utility scripts
├── docs/                    # Documentation
│   ├── API.md               # API reference
│   ├── COMPONENTS.md        # React component docs
│   ├── ARCHITECTURE.md      # Architecture decisions
│   └── runbooks/            # Operational runbooks
├── CHANGELOG.md             # Release changelog
├── DEPLOYMENT_GUIDE.md      # Deployment instructions
├── OPERATIONS_GUIDE.md      # Operations guide
└── TROUBLESHOOTING_RUNBOOK.md  # Troubleshooting
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 18 + TypeScript |
| Charts | Recharts, D3.js, Plotly.js |
| Tables | TanStack Table v8 |
| State Management | React Context + React Query + URL state |
| Styling | Tailwind CSS, MUI |
| Animations | Framer Motion |
| Testing | Jest, React Testing Library, fast-check, Playwright |
| Backend | AWS Lambda (Python 3.11) |
| API | API Gateway (REST + WebSocket) |
| Storage | S3, DynamoDB |
| Caching | ElastiCache Redis |
| CDN | CloudFront |
| ML Training | SageMaker |
| Monitoring | CloudWatch, Sentry |
| Auth | AWS Cognito (SAML/OAuth) |

## Daily Operations

The system runs automatically:

| Schedule | Task |
|----------|------|
| Every 5 min | Monitor SageMaker instances |
| 18:10 BRT | Generate top-50 ranking |
| 19:30 BRT | Validate 20-day-old predictions |
| 20:00 BRT | Monitor AWS costs |

### Retraining Criteria

The system alerts when retraining is needed:
- MAPE > 20%
- Drift detected (performance degraded 50%)
- Performance 2× worse than training baseline

## Estimated Monthly Cost

| Service | Cost |
|---------|------|
| Lambda (all functions) | ~$0.75 |
| S3 Storage | ~$0.10 |
| CloudWatch | ~$0.10 |
| **Total** | **~$0.95/month** |

SageMaker training: ~$0.06 per run (on-demand).

## Documentation

- [API Reference](docs/API.md) — All REST endpoints with examples
- [Component Guide](docs/COMPONENTS.md) — React components, contexts, hooks
- [Architecture Decisions](docs/ARCHITECTURE.md) — ADRs and design rationale
- [Deployment Guide](DEPLOYMENT_GUIDE.md) — Full deployment instructions
- [Operations Guide](OPERATIONS_GUIDE.md) — Day-to-day operations
- [Troubleshooting](TROUBLESHOOTING_RUNBOOK.md) — Common issues and fixes
- [Disaster Recovery](docs/DISASTER_RECOVERY.md) — DR procedures and runbooks
- [Changelog](CHANGELOG.md) — Release history

## License

MIT License — see [LICENSE](LICENSE).
