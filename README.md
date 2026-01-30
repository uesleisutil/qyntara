# 📈 B3 Tactical Ranking (B3TR)

> **Sistema MLOps automatizado para ranking tático de ações da B3**

[![AWS](https://img.shields.io/badge/AWS-Cloud-orange)](https://aws.amazon.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue)](https://python.org/)
[![CDK](https://img.shields.io/badge/AWS_CDK-TypeScript-green)](https://aws.amazon.com/cdk/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

## 🎯 O que é o B3TR?

O B3 Tactical Ranking é um **pipeline MLOps completo na AWS** que automatiza:

- 📊 **Ingestão automática** de cotações da B3 via BRAPI Pro (a cada 5 minutos)
- 🤖 **Treinamento de modelos** DeepAR no SageMaker para forecasting
- 🏆 **Geração de rankings** diários das melhores ações
- 📈 **Monitoramento contínuo** de qualidade e alertas inteligentes

> ⚠️ **Aviso**: Este é um projeto educacional. **Não constitui recomendação de investimento.**

## 🚀 Quick Start (5 minutos)

```bash
# 1. Clone o projeto
git clone <repo-url>
cd b3-tactical-ranking

# 2. Configure suas credenciais
cp .env.example .env
# Edite .env com suas configurações

# 3. Deploy automático
./scripts/setup.sh

# 4. Configure token BRAPI
aws secretsmanager create-secret \
  --name "brapi/pro/token" \
  --secret-string '{"token":"SEU_TOKEN_BRAPI"}'

# 5. Teste o sistema
./scripts/test-system.sh
```

**Pronto!** 🎉 Seu sistema está rodando automaticamente na AWS.

## 📋 Pré-requisitos

- ✅ **AWS CLI** configurado (`aws configure`)
- ✅ **Node.js 18+** e **AWS CDK** (`npm i -g aws-cdk`)
- ✅ **Python 3.11+**
- ✅ **Token BRAPI Pro** ([brapi.dev](https://brapi.dev))
- ✅ **Conta AWS** (região us-east-1)

## 🏗️ Arquitetura

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ BRAPI Pro   │───▶│   Lambda     │───▶│      S3         │
│ (Cotações)  │    │  (Ingestão)  │    │  (Data Lake)    │
└─────────────┘    └──────────────┘    └─────────────────┘
                          │                       │
                          ▼                       ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ EventBridge │───▶│   Lambda     │───▶│   SageMaker     │
│ (Scheduler) │    │  (Ranking)   │    │   (DeepAR)      │
└─────────────┘    └──────────────┘    └─────────────────┘
                          │                       │
                          ▼                       ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ CloudWatch  │◀───│   Lambda     │◀───│      SNS        │
│(Monitoring) │    │ (Monitoring) │    │   (Alertas)     │
└─────────────┘    └──────────────┘    └─────────────────┘
```

### 🔧 Componentes Principais

| Componente | Função | Frequência |
|------------|--------|------------|
| **Ingestão** | Coleta cotações BRAPI | A cada 5min (pregão) |
| **Bootstrap** | Download histórico 10 anos | Uma vez |
| **Ranking** | Treina modelo + gera ranking | Diário 18:10 BRT |
| **Monitor** | Verifica qualidade dos dados | Contínuo |
| **Alertas** | Notifica problemas por email | Quando necessário |

## 📊 Estrutura de Dados

```
s3://bucket/
├── 📁 raw/quotes_5m/              # Dados brutos BRAPI
├── 📁 curated/daily_monthly/      # Histórico organizado
├── 📁 training/deepar/            # Datasets ML
├── 📁 models/                     # Modelos treinados
├── 📁 predictions/                # Previsões
├── 📁 recommendations/            # Rankings finais
└── 📁 monitoring/                 # Relatórios qualidade
```

## ⚙️ Configuração

### Principais Variáveis (.env)

```bash
# Essenciais
AWS_REGION=us-east-1
BRAPI_SECRET_ID=brapi/pro/token
ALERT_EMAIL=your-email@example.com

# Modelo ML
B3TR_CONTEXT_LENGTH=60        # Janela histórica
B3TR_PREDICTION_LENGTH=20     # Horizonte previsão
B3TR_TOP_N=10                # Top N ranking

# Horários (UTC)
B3_OPEN_HOUR_UTC=13          # 10:00 BRT
B3_CLOSE_HOUR_UTC=20         # 17:00 BRT
```

### Universe de Ações

Edite `config/universe.txt`:
```
PETR4.SA
VALE3.SA
ITUB4.SA
BBDC4.SA
ABEV3.SA
```

## 📚 Documentação

| Documento | Descrição |
|-----------|-----------|
| [🏗️ Arquitetura](docs/architecture.md) | Visão técnica detalhada |
| [🚀 Deployment](docs/deployment.md) | Guia completo de deploy |
| [🔧 Troubleshooting](docs/troubleshooting.md) | Solução de problemas |

## 🔍 Monitoramento

### CloudWatch Dashboards
- **Métricas**: `B3TR/IngestionOK`, `B3TR/ModelMAPE`
- **Logs**: `/aws/lambda/B3TacticalRankingStack-*`
- **Alarmes**: Falhas de ingestão, qualidade do modelo

### Comandos Úteis

```bash
# Status geral do sistema
./scripts/test-system.sh

# Logs em tempo real
aws logs tail "/aws/lambda/B3TacticalRankingStack-Quotes5mIngest*" --follow

# Verificar dados recentes
aws s3 ls s3://SEU-BUCKET/recommendations/ --recursive | tail -5
```

## 🛠️ Scripts Úteis

| Script | Função |
|--------|--------|
| `./scripts/setup.sh` | Setup completo do projeto |
| `./scripts/test-system.sh` | Testa todas as funcionalidades |
| `./scripts/bootstrap_env.sh` | Extrai configs do CloudFormation |

## 📈 Resultados

### Ranking Diário
```json
{
  "date": "2026-01-29",
  "top_10": [
    {"ticker": "PETR4.SA", "score": 0.85, "predicted_return": 0.12},
    {"ticker": "VALE3.SA", "score": 0.78, "predicted_return": 0.09}
  ]
}
```

### Localização: `s3://bucket/recommendations/dt=YYYY-MM-DD/top10.json`

## 🔄 Atualizações

```bash
# Deploy de mudanças
cd infra && cdk deploy

# Verificar status
./scripts/test-system.sh
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🆘 Suporte

- 📖 **Documentação**: [docs/](docs/)
- 🐛 **Issues**: [GitHub Issues](../../issues)
- 🔧 **Troubleshooting**: [docs/troubleshooting.md](docs/troubleshooting.md)

---

**Desenvolvido com ❤️ para a comunidade de investidores brasileiros**