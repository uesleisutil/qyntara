# Predikt — AI-Powered Prediction Market Intelligence

Bundle de inteligência para prediction markets (Polymarket, Kalshi) com Deep Learning.

## Produtos

| Produto | Tier |
|---------|------|
| Market Scanner | Free |
| AI Edge Finder | Pro ($29/mês) |
| Arbitrage & Correlation Engine | Pro |
| Portfolio Tracker & Risk Manager | Quant ($79/mês) |
| Autopilot (auto-trade) | Enterprise ($199/mês) |

## Stack

- **Backend**: Python 3.11, FastAPI, PyTorch, SageMaker
- **Frontend**: React 18, TypeScript, Recharts, Vite
- **Infra**: AWS (Lambda, SageMaker, S3, API Gateway, WebSocket)
- **Data**: Polymarket API (free), Kalshi API (free), Google News RSS, Yahoo Finance
- **Agent**: OpenClaw (coleta + ações autônomas)

## Arquitetura

```
OpenClaw Agent (24/7)
  ├── Polymarket WebSocket → raw market data
  ├── Kalshi API polling → raw market data
  ├── Google News RSS → raw news
  └── Yahoo Finance → macro data
         ↓
    Data Pipeline (Lambda + S3)
         ↓
    DL Models (SageMaker GPU)
  ├── Edge Estimator (Transformer)
  ├── Correlation Engine (GNN)
  ├── Anomaly Detector (Autoencoder)
  └── Sentiment Analyzer (FinBERT)
         ↓
    API (FastAPI + WebSocket)
         ↓
    Frontend (React + Vite)
```
