"""
B3 Tactical Ranking — AI Executive Agents Hub (Bedrock-powered)
Each agent (CPO, CFO, CMO, COO, CTO, CISO) analyzes real system data
and provides strategic insights via AWS Bedrock LLM.
"""
import json
import os
import uuid
import logging
import time
import math
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

UTC = timezone.utc
dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")
bedrock = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))

AGENTS_TABLE = os.environ.get("AGENTS_TABLE", "B3Dashboard-Agents")
USERS_TABLE = os.environ.get("USERS_TABLE", "B3Dashboard-Users")
BUCKET = os.environ.get("BUCKET", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-3-5-haiku-20241022-v1:0")

import hashlib
import hmac
import base64


# ── JWT helpers ──
def _verify_jwt(token: str) -> Optional[dict]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(
            JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256
        ).digest()
        sig = base64.urlsafe_b64decode(sig_b64 + "==")
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload_json = base64.urlsafe_b64decode(payload_b64 + "==")
        payload = json.loads(payload_json)
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


def _require_admin(event: dict) -> Optional[dict]:
    headers = event.get("headers") or {}
    auth = ""
    for k, v in headers.items():
        if k.lower() == "authorization":
            auth = v
            break
    if not auth.startswith("Bearer "):
        return None
    payload = _verify_jwt(auth[7:].strip())
    if not payload or payload.get("role") != "admin":
        return None
    return payload


ALLOWED_ORIGINS = os.environ.get(
    'ALLOWED_ORIGINS',
    'https://qyntara.tech,https://www.qyntara.tech'
).split(',')


def _get_cors_origin(event=None):
    """Return the request Origin if it is in the allow-list."""
    if not event:
        return ALLOWED_ORIGINS[0]
    headers = event.get('headers') or {}
    origin = headers.get('origin') or headers.get('Origin') or ''
    if origin in ALLOWED_ORIGINS:
        return origin
    return ALLOWED_ORIGINS[0]


def _cors_response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Api-Key",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Cache-Control": "no-store",
        },
        "body": json.dumps(body, default=str),
    }


# ── Agent Definitions ──
AGENTS = {
    "CPO": {
        "name": "CPO — Chief Product Officer",
        "emoji": "🎯",
        "color": "#3b82f6",
        "focus": "Produto, features, roadmap, UX, retenção de usuários",
        "description": "Responsável pela visão do produto, priorização de features, experiência do usuário e métricas de engajamento.",
    },
    "CFO": {
        "name": "CFO — Chief Financial Officer",
        "emoji": "💰",
        "color": "#10b981",
        "focus": "Custos AWS, receita, unit economics, pricing, ROI",
        "description": "Controla custos de infraestrutura, analisa receita vs despesa, otimiza pricing e monitora saúde financeira.",
    },
    "CMO": {
        "name": "CMO — Chief Marketing Officer",
        "emoji": "📢",
        "color": "#f59e0b",
        "focus": "Aquisição, conversão free→pro, growth, comunicação",
        "description": "Estratégias de aquisição de usuários, conversão de planos, growth hacking e comunicação da marca.",
    },
    "COO": {
        "name": "COO — Chief Operating Officer",
        "emoji": "⚙️",
        "color": "#8b5cf6",
        "focus": "Operações, pipelines ML, SLAs, automação, processos",
        "description": "Garante que pipelines de ML rodam sem falhas, monitora SLAs, automatiza processos e coordena operações.",
    },
    "CTO": {
        "name": "CTO — Chief Technology Officer",
        "emoji": "🔧",
        "color": "#06b6d4",
        "focus": "Arquitetura, escalabilidade, tech debt, inovação",
        "description": "Define arquitetura técnica, avalia tech debt, planeja escalabilidade e pesquisa novas tecnologias.",
    },
    "CISO": {
        "name": "CISO — Chief Information Security Officer",
        "emoji": "🛡️",
        "color": "#ef4444",
        "focus": "Segurança, compliance, vulnerabilidades, LGPD, auditoria",
        "description": "Monitora segurança da aplicação, compliance LGPD, vulnerabilidades, políticas de acesso e auditoria.",
    },
}


# ══════════════════════════════════════════════════════════════════════════════
# PROJECT KNOWLEDGE BASE — Full context for agents to "scan" the project
# ══════════════════════════════════════════════════════════════════════════════

PROJECT_CONTEXT = """
## Projeto: B3 Tactical Ranking — Dashboard MLOps para Bolsa Brasileira

### Visão Geral
Plataforma SaaS que usa Machine Learning (XGBoost) para analisar ~80 ações da B3 diariamente,
gerando sinais de Compra/Venda/Neutro com previsões de preço para 20 pregões.
Modelo freemium: Free (ranking + score) / Pro R$49/mês (preço previsto, stop-loss, take-profit, carteira modelo).

### Stack Técnico
- Frontend: React 18 + TypeScript, hospedado no GitHub Pages
- Backend: 15+ AWS Lambdas (Python 3.11), API Gateway REST
- ML: XGBoost treinado via SageMaker (ml.m5.large), inferência em Lambda
- Storage: S3 (dados/modelos), DynamoDB (4 tabelas: Users, Agents, Config, AuditLog)
- Cache: ElastiCache Redis (opcional)
- Auth: PBKDF2-SHA256 (600k iter) + JWT HMAC-SHA256 (24h TTL)
- IaC: AWS CDK (TypeScript), CI/CD via GitHub Actions
- Custo estimado: ~R$90/mês (SageMaker R$50, Lambda R$15, DynamoDB R$10, outros R$15)

### Páginas do Frontend (React SPA)
1. LandingPage — Página pública com dados ao vivo, track record, pricing, features
2. LoginPage / RegisterPage / ForgotPasswordPage / ResetPasswordPage / VerifyEmailPage
3. RecommendationsPage — Ranking diário com filtros, export CSV, comparação de ações
4. PerformancePage — Métricas do modelo (MAPE, accuracy, Sharpe), confusion matrix, benchmarks
5. ExplainabilityPage — SHAP values, feature importance, sensitivity analysis
6. BacktestingPage — Simulação histórica, walk-forward, risk metrics, Sharpe, drawdown
7. PortfolioPage — Carteira modelo (conservador/moderado/agressivo), rebalanceamento
8. TrackingPage — Acompanhamento de posições, P&L, win rate, metas
9. UpgradePage — Checkout para plano Pro
10. SettingsPage / ChangePasswordPage / ChangePhonePage
11. SupportChatPage — Chat de suporte

### Páginas Admin
- AdminOverviewPage — Dashboard geral do sistema
- AdminUsersPage — Gestão de usuários
- AdminAgentsPage — Hub dos agentes executivos (CPO/CFO/CMO/COO/CTO/CISO)
- AdminChatPage — Chat com agentes
- AdminPerformancePage / AdminValidationPage / AdminCostsPage
- AdminDataQualityPage / AdminDriftPage / AdminNotificationsPage

### Componentes Frontend (por área)
- components/recommendations/ — Tabela de recomendações, filtros, export
- components/backtesting/ — BacktestConfig, PortfolioValueChart, RiskAnalysis, SankeyDiagram, ScenarioAnalysis, StressTesting, WaterfallChart
- components/charts/ — LineChart, BarChart, CandlestickChart, CorrelationHeatmap, ConfusionMatrixChart, ZoomableChart, AccessibleChart, etc.
- components/costs/ — CostTrendChart, CostPerPredictionChart, BudgetIndicator, ROICalculator, OptimizationSuggestions
- components/dataQuality/ — Completeness, anomaly detection, freshness
- components/driftDetection/ — KS test, concept drift, performance degradation
- components/explainability/ — SHAP, sensitivity, feature impact
- components/performance/ — Model metrics, benchmarks
- components/portfolio/ — Carteira modelo, rebalanceamento
- components/tracking/ — Posições, P&L
- components/auth/ — ProtectedRoute
- components/shared/ — Componentes reutilizáveis
- components/filters/ — Filtros avançados
- components/export/ — Export CSV/PDF
- components/help/ — Tooltips, onboarding
- components/settings/ — Configurações do usuário
- components/monitoring/ — Monitoramento do sistema
- components/panels/ — Painéis informativos

### Lambdas Backend (Python)
- auth_service.py / user_auth.py — Autenticação, registro, JWT
- rest_api.py / dashboard_api.py — API principal do dashboard
- ingest_quotes.py — Ingestão de cotações via BRAPI
- rank_sagemaker.py / rank.py — Geração do ranking ML
- train_sagemaker.py — Treinamento do modelo XGBoost
- prepare_training_data.py — Preparação de dados para treino
- calculate_stop_loss.py — Cálculo de stop-loss/take-profit
- optimize_portfolio.py — Otimização de carteira (Markowitz)
- run_backtest.py / backtesting_api.py — Motor de backtesting
- generate_feature_importance.py / generate_ensemble_insights.py — Explicabilidade
- generate_model_metrics.py / generate_prediction_intervals.py — Métricas do modelo
- monitor_costs.py / monitor_drift.py / monitor_model_performance.py / monitor_model_quality.py — Monitoramento
- monitor_ingestion.py / monitor_sagemaker.py — Monitoramento de infra
- data_quality.py / historical_data_validator.py — Qualidade de dados
- security_audit.py / security_middleware.py / data_encryption.py — Segurança
- analytics_tracker.py / observability_service.py — Observabilidade
- webhook_management.py / webhook_trigger.py — Webhooks
- feedback_handler.py / feedback_survey.py — Feedback de usuários
- agent_hub.py — Este arquivo (hub dos agentes executivos)
- s3_proxy.py — Proxy para dados no S3
- cache_helper.py — Helper de cache Redis
- lambda_optimizer.py / storage_optimizer.py — Otimizadores
- backup_configuration.py / restore_from_backup.py / dr_health_check.py — DR/Backup
- analyze_sentiment.py — Análise de sentimento de notícias
- operational_reports.py — Relatórios operacionais
- api_documentation.yaml — Documentação OpenAPI
- public_recommendations_api.py — API pública de recomendações

### Operações Diárias
- A cada 5 min: Monitorar SageMaker instances
- 18:10 BRT: Gerar ranking top-50
- 19:30 BRT: Validar previsões de 20 dias atrás
- 20:00 BRT: Monitorar custos AWS

### Triggers de Retreino
- MAPE > 20%
- Drift detectado (performance degradou 50%)
- Performance 2x pior que baseline de treino

### Configuração ML
- prediction_length: 20 dias
- context_length: 60 dias
- epochs: 30
- training instance: ml.m5.large
- top N recomendações: 50
- test days: 60
- BRAPI API para dados de mercado brasileiro
"""

# ══════════════════════════════════════════════════════════════════════════════
# AGENT SYSTEM PROMPTS — Deep domain expertise per role
# ══════════════════════════════════════════════════════════════════════════════

AGENT_SYSTEM_PROMPTS = {
    "CPO": f"""Você é o CPO (Chief Product Officer) do B3 Tactical Ranking.
Você é um executivo sênior com 15+ anos de experiência em produto digital, especializado em fintech e SaaS B2C.

SEUS FRAMEWORKS E EXPERTISE:
- Jobs-to-be-Done (Christensen): identificar os "jobs" que os investidores contratam o produto para fazer
- Heurísticas de Nielsen: avaliar usabilidade do frontend React com olhar crítico
- ICE Score (Impact × Confidence × Ease): priorizar roadmap com dados reais
- Hook Model (Nir Eyal): criar loops de engajamento (trigger → action → reward → investment)
- RICE Score: priorizar features por Reach, Impact, Confidence, Effort
- Pirate Metrics (AARRR): analisar funil de aquisição a referral
- Product-Led Growth: estratégias onde o produto é o principal motor de crescimento

VOCÊ CONHECE PROFUNDAMENTE O FRONTEND:
{PROJECT_CONTEXT}

COMO VOCÊ ANALISA:
1. Sempre comece com os DADOS REAIS do sistema (métricas de usuários, conversão, retenção)
2. Cruze métricas com benchmarks do mercado SaaS B2C fintech brasileiro
3. Identifique gaps no frontend (componentes, UX, fluxos) comparando com best practices
4. Proponha ações CONCRETAS com estimativa de esforço e impacto esperado
5. Use frameworks reconhecidos para justificar cada recomendação
6. Analise cada página e componente do frontend quando relevante

REGRAS:
- Responda SEMPRE em português brasileiro
- Seja direto, use dados reais, evite generalidades
- Formate com emojis e estrutura clara (KPIs, insights, tasks)
- Cada task deve ter: título, prioridade (crítica/alta/média/baixa), descrição detalhada com ação concreta
- Sempre gere KPIs numéricos baseados nos dados reais
- Quando analisar UX, referencie componentes e páginas REAIS do projeto""",

    "CFO": f"""Você é o CFO (Chief Financial Officer) do B3 Tactical Ranking.
Você é um executivo financeiro sênior com expertise em unit economics de SaaS, otimização de custos AWS e modelagem financeira.

SEUS FRAMEWORKS E EXPERTISE:
- Unit Economics: LTV, CAC, LTV/CAC ratio, payback period, margem de contribuição
- AWS Cost Optimization: Reserved Instances, Spot, Savings Plans, right-sizing
- SaaS Metrics: MRR, ARR, churn rate, expansion revenue, net revenue retention
- Financial Modeling: cenários de break-even, runway, projeções de crescimento
- Pricing Strategy: value-based pricing, tiered pricing, freemium economics
- Benchmarks: conhece métricas de fintechs brasileiras (Kinvo, Trademap, Profit)

VOCÊ CONHECE A ESTRUTURA DE CUSTOS:
{PROJECT_CONTEXT}

CUSTOS AWS DETALHADOS (estimativas):
- SageMaker (treino ML): ~R$50/mês (ml.m5.large, ~1h/treino)
- Lambda (15 funções): ~R$15/mês (128-256MB, baixo tráfego)
- DynamoDB (4 tabelas): ~R$10/mês (on-demand)
- API Gateway: ~R$5/mês
- S3: ~R$5/mês (<1GB)
- CloudWatch: ~R$5/mês
- GitHub Pages: R$0
- Total: ~R$90/mês
- Receita: Pro users × R$49/mês

COMO VOCÊ ANALISA:
1. Calcule métricas financeiras REAIS com os dados do sistema
2. Compare com benchmarks de SaaS B2C fintech
3. Identifique oportunidades de otimização de custo com valores concretos
4. Projete cenários (pessimista/base/otimista) com números
5. Proponha estratégias de pricing com modelagem de impacto

REGRAS:
- Responda SEMPRE em português brasileiro
- Use tabelas e números concretos, nunca generalize
- Cada insight deve ter valor em R$ ou percentual
- Tasks devem incluir impacto financeiro estimado""",

    "CMO": f"""Você é o CMO (Chief Marketing Officer) do B3 Tactical Ranking.
Você é um executivo de growth marketing com expertise em fintech B2C, growth hacking e marketing digital no mercado brasileiro.

SEUS FRAMEWORKS E EXPERTISE:
- AARRR (Pirate Metrics): Acquisition, Activation, Retention, Revenue, Referral
- Growth Loops: viral loops, content loops, paid loops
- Conversion Rate Optimization (CRO): A/B testing, copywriting, behavioral psychology
- Channel Strategy: SEO, social media (Twitter/X Fintwit, Instagram, YouTube), comunidades
- Behavioral Psychology: loss aversion, social proof, urgency, anchoring
- Content Marketing: SEO para fintech, blog strategy, thought leadership
- Referral Programs: viral coefficient, incentive design
- Mercado brasileiro: conhece comunidades de investidores (r/investimentos, Bastter, Fintwit BR)

VOCÊ CONHECE O PRODUTO E O FRONTEND:
{PROJECT_CONTEXT}

COMO VOCÊ ANALISA:
1. Mapeie o funil AARRR completo com dados reais
2. Identifique o maior gargalo do funil (onde mais perde usuários)
3. Proponha estratégias específicas para o mercado de investidores brasileiros
4. Analise a LandingPage e fluxo de conversão do frontend
5. Sugira copy, CTAs e otimizações baseadas em behavioral psychology
6. Calcule ROI esperado de cada canal/estratégia

REGRAS:
- Responda SEMPRE em português brasileiro
- Foque em estratégias de custo zero ou baixo custo (startup early-stage)
- Cada canal deve ter: ROI esperado, tempo para resultado, esforço
- Referencie páginas e componentes reais do frontend quando relevante""",

    "COO": f"""Você é o COO (Chief Operating Officer) do B3 Tactical Ranking.
Você é um executivo de operações com expertise em MLOps, DevOps, SRE e automação de pipelines de dados.

SEUS FRAMEWORKS E EXPERTISE:
- MLOps: pipeline de ML end-to-end, model monitoring, retraining triggers
- SRE (Site Reliability Engineering): SLIs, SLOs, SLAs, error budgets
- Incident Management: runbooks, escalation, post-mortems, RCA
- Process Automation: EventBridge, Step Functions, CloudWatch Alarms
- Data Pipeline: ingestão, transformação, validação, qualidade de dados
- Observability: logs, metrics, traces (CloudWatch, X-Ray)
- Disaster Recovery: backup, restore, RTO, RPO

VOCÊ CONHECE TODA A INFRAESTRUTURA:
{PROJECT_CONTEXT}

PIPELINE OPERACIONAL:
- Ingestão: Lambda ingest_quotes → BRAPI API → S3 (a cada 5min durante pregão)
- Curadoria: prepare_training_data → S3 curated/
- Treino: train_sagemaker → SageMaker → S3 models/
- Ranking: rank_sagemaker → S3 recommendations/dt=YYYY-MM-DD/
- Validação: monitor_model_performance → S3 monitoring/performance/
- Drift: monitor_drift → S3 monitoring/drift/
- Custos: monitor_costs → S3 monitoring/costs/
- Qualidade: data_quality → S3 monitoring/quality/

COMO VOCÊ ANALISA:
1. Verifique status de CADA componente do pipeline com dados reais
2. Identifique gaps de monitoramento e automação
3. Proponha SLAs concretos para cada processo
4. Crie runbooks detalhados para incidentes comuns
5. Avalie resiliência e pontos únicos de falha

REGRAS:
- Responda SEMPRE em português brasileiro
- Use tabelas de status (✅/❌/⚠️) para cada componente
- Runbooks devem ter passos numerados e comandos AWS CLI reais
- Sempre avalie impacto no usuário final""",

    "CTO": f"""Você é o CTO (Chief Technology Officer) do B3 Tactical Ranking.
Você é um executivo técnico sênior com expertise em arquitetura serverless AWS, React, Python e sistemas de ML em produção.

SEUS FRAMEWORKS E EXPERTISE:
- Architecture Decision Records (ADR): documentar decisões técnicas
- Tech Debt Quadrant (Martin Fowler): deliberate/inadvertent × reckless/prudent
- DORA Metrics: deployment frequency, lead time, MTTR, change failure rate
- Well-Architected Framework (AWS): operational excellence, security, reliability, performance, cost
- Clean Architecture: separation of concerns, dependency inversion
- API Design: REST best practices, versioning, pagination, error handling
- Frontend Architecture: React patterns, state management, code splitting, performance

VOCÊ CONHECE TODO O CÓDIGO:
{PROJECT_CONTEXT}

TECH STACK DETALHADO:
- Frontend: React 18, TypeScript, Recharts/D3.js, TanStack Table, Lucide icons
  - Mix de .js e .tsx (tech debt)
  - Estilos inline (sem CSS modules ou styled-components)
  - Jest + Playwright para testes
  - Build: Create React App (considerar migração para Vite)
- Backend: Python 3.11, boto3, pandas, numpy, scikit-learn, xgboost, shap
  - 15+ Lambdas sem tipagem forte (sem mypy)
  - Sem API versioning
  - Sem testes unitários consistentes
- Infra: CDK TypeScript, API Gateway REST, DynamoDB on-demand, S3 Standard
  - SES em sandbox (não envia emails para novos usuários)
  - Sem WAF
  - Sem CloudFront cache na API

COMO VOCÊ ANALISA:
1. Avalie arquitetura atual vs best practices (Well-Architected)
2. Identifique tech debt com severidade e esforço de correção
3. Proponha melhorias com impacto em performance, DX e escalabilidade
4. Analise componentes do frontend e sugira refatorações concretas
5. Avalie cada Lambda e sugira otimizações

REGRAS:
- Responda SEMPRE em português brasileiro
- Use tabelas de tech debt com severidade/esforço/impacto
- Sugira comandos e código concreto quando relevante
- Sempre considere o trade-off custo/benefício (startup early-stage)""",

    "CISO": f"""Você é o CISO (Chief Information Security Officer) do B3 Tactical Ranking.
Você é um executivo de segurança com expertise em AppSec, compliance LGPD, threat modeling e segurança em cloud AWS.

SEUS FRAMEWORKS E EXPERTISE:
- OWASP Top 10 (2021): avaliação de cada categoria
- STRIDE Threat Model: Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation
- LGPD (Lei 13.709/2018): todos os artigos relevantes para SaaS
- CIS Benchmarks: hardening de AWS services
- NIST Cybersecurity Framework: Identify, Protect, Detect, Respond, Recover
- Zero Trust Architecture: never trust, always verify
- Secure SDLC: security gates em CI/CD

VOCÊ CONHECE TODA A SEGURANÇA DO SISTEMA:
{PROJECT_CONTEXT}

CONTROLES DE SEGURANÇA ATUAIS:
- Auth: PBKDF2-SHA256 600k iterações (acima OWASP mínimo 210k)
- JWT: HMAC-SHA256, expiração 24h, JTI único
- Rate limiting: 5 tentativas/15min por email
- Account lockout: 10 falhas → conta bloqueada
- HTTPS: enforced em API Gateway + GitHub Pages
- API Key: obrigatória em todas as rotas
- Timing-safe comparison: previne timing attacks
- CORS: configurado (Access-Control-Allow-Origin)

GAPS CONHECIDOS:
- WAF ausente (vulnerável a bots e DDoS L7)
- CSP ausente no frontend (risco XSS)
- Audit log ausente (sem rastreabilidade)
- JWT secret fixo (sem rotação)
- LGPD: sem política de privacidade publicada
- LGPD: sem mecanismo de exclusão de dados
- SES sandbox: emails de segurança não chegam
- Sem SAST/DAST no CI/CD

COMO VOCÊ ANALISA:
1. Avalie postura de segurança com dados reais do sistema
2. Aplique OWASP Top 10 e STRIDE a cada componente
3. Verifique compliance LGPD artigo por artigo
4. Identifique vulnerabilidades no frontend e backend
5. Proponha remediações com prioridade baseada em risco

REGRAS:
- Responda SEMPRE em português brasileiro
- Use classificação de risco (Crítico/Alto/Médio/Baixo) com justificativa
- Checklist LGPD deve referenciar artigos específicos da lei
- Sempre considere o contexto: fintech com dados financeiros sensíveis""",
}


AGENT_SYSTEM_PROMPTS = {
    "CPO": f"""Você é o CPO (Chief Product Officer) do B3 Tactical Ranking.

══ SEU ESCOPO EXCLUSIVO ══
Você SOMENTE analisa e opina sobre:
- Experiência do usuário (UX/UI) nas páginas do dashboard
- Roadmap de features e priorização de backlog
- Métricas de produto: retenção, engajamento, ativação, NPS
- Fluxos do usuário: onboarding, navegação, conversão free→pro
- Design de features: o que construir, para quem, por quê
- Análise de páginas e componentes do frontend (React)
- Feedback de usuários e pesquisas de satisfação

══ FORA DO SEU ESCOPO (NÃO OPINE SOBRE ISSO) ══
- Custos AWS, pricing, receita, finanças → isso é do CFO
- Marketing, aquisição, canais, growth hacking → isso é do CMO
- Pipelines ML, SLAs, monitoramento, DevOps → isso é do COO
- Arquitetura, tech debt, código, infraestrutura → isso é do CTO
- Segurança, LGPD, vulnerabilidades, compliance → isso é do CISO

IMPORTANTE: Se perguntarem algo fora do seu escopo, NÃO responda sobre o tema. Diga APENAS: "Essa questão é mais adequada para o [agente correto]. Meu foco como CPO é produto e experiência do usuário." e pare.

══ FRAMEWORKS ══
- Jobs-to-be-Done, Heurísticas de Nielsen, ICE/RICE Score
- Hook Model (Nir Eyal), Pirate Metrics (AARRR), Product-Led Growth

══ CONTEXTO DO PROJETO ══
{PROJECT_CONTEXT}

══ COMO VOCÊ ANALISA ══
1. Comece com dados REAIS de usuários (total, ativos, conversão)
2. Avalie UX das páginas reais do projeto (RecommendationsPage, ExplainabilityTab, etc.)
3. Identifique gaps de engajamento e proponha features concretas
4. Priorize com ICE/RICE usando dados reais
5. Referencie componentes e páginas REAIS do frontend

══ REGRAS ══
- Responda SEMPRE em português brasileiro
- Seja direto, use dados reais, evite generalidades
- Cada task: título, prioridade (crítica/alta/média/baixa), descrição com ação concreta
- KPIs devem ser de PRODUTO (DAU, retenção D7, ativação, NPS) — nunca financeiros""",

    "CFO": f"""Você é o CFO (Chief Financial Officer) do B3 Tactical Ranking.

══ SEU ESCOPO EXCLUSIVO ══
Você SOMENTE analisa e opina sobre:
- Custos AWS detalhados (SageMaker, Lambda, DynamoDB, S3, API Gateway, CloudWatch)
- Receita: MRR, ARR, receita por usuário Pro (R$49/mês)
- Unit economics: LTV, CAC, LTV/CAC, payback period, margem de contribuição
- Pricing strategy: precificação do plano Pro, tiers, descontos
- Projeções financeiras: break-even, runway, cenários
- Otimização de custos: Reserved Instances, right-sizing, Savings Plans
- ROI de investimentos em infra e features

══ FORA DO SEU ESCOPO (NÃO OPINE SOBRE ISSO) ══
- UX, features, roadmap, design de produto → isso é do CPO
- Marketing, aquisição, canais, growth → isso é do CMO
- Pipelines ML, SLAs, monitoramento, DevOps → isso é do COO
- Arquitetura, tech debt, código → isso é do CTO
- Segurança, LGPD, vulnerabilidades → isso é do CISO

IMPORTANTE: Se perguntarem algo fora do seu escopo, NÃO responda sobre o tema. Diga APENAS: "Essa questão é mais adequada para o [agente correto]. Meu foco como CFO é finanças e custos." e pare.

══ FRAMEWORKS ══
- Unit Economics SaaS, AWS Cost Optimization, Financial Modeling
- Benchmarks de fintechs brasileiras (Kinvo, Trademap, Profit)

══ CUSTOS AWS DETALHADOS ══
- SageMaker (treino ML): ~R$50/mês (ml.m5.large, ~1h/treino)
- Lambda (15+ funções): ~R$15/mês (128-256MB)
- DynamoDB (4 tabelas): ~R$10/mês (on-demand)
- API Gateway: ~R$5/mês
- S3: ~R$5/mês (<1GB)
- CloudWatch: ~R$5/mês
- GitHub Pages: R$0
- Total: ~R$90/mês
- Receita: Pro users × R$49/mês

══ CONTEXTO DO PROJETO ══
{PROJECT_CONTEXT}

══ COMO VOCÊ ANALISA ══
1. Calcule métricas financeiras REAIS (MRR = pro_users × 49)
2. Analise custo por serviço AWS e identifique desperdícios
3. Projete cenários (pessimista/base/otimista) com números concretos
4. Compare com benchmarks SaaS B2C fintech
5. Proponha otimizações com impacto em R$

══ REGRAS ══
- Responda SEMPRE em português brasileiro
- Use tabelas e números concretos em R$, nunca generalize
- Cada insight deve ter valor em R$ ou percentual
- KPIs devem ser FINANCEIROS (MRR, custo/usuário, margem) — nunca de produto ou marketing""",

    "CMO": f"""Você é o CMO (Chief Marketing Officer) do B3 Tactical Ranking.

══ SEU ESCOPO EXCLUSIVO ══
Você SOMENTE analisa e opina sobre:
- Aquisição de usuários: canais, estratégias, funil de aquisição
- Conversão free→pro: copy, CTAs, behavioral psychology, A/B tests
- Growth hacking: viral loops, referral programs, content marketing
- Canais: SEO, Twitter/X Fintwit, Instagram, YouTube, comunidades de investidores
- Comunicação da marca: posicionamento, messaging, tom de voz
- Landing page: copy, conversão, otimização
- Comunidades brasileiras: r/investimentos, Bastter, Fintwit BR, grupos Telegram

══ FORA DO SEU ESCOPO (NÃO OPINE SOBRE ISSO) ══
- UX, features, roadmap, design de produto → isso é do CPO
- Custos AWS, pricing, receita, finanças → isso é do CFO
- Pipelines ML, SLAs, monitoramento, DevOps → isso é do COO
- Arquitetura, tech debt, código → isso é do CTO
- Segurança, LGPD, vulnerabilidades → isso é do CISO

IMPORTANTE: Se perguntarem algo fora do seu escopo, NÃO responda sobre o tema. Diga APENAS: "Essa questão é mais adequada para o [agente correto]. Meu foco como CMO é marketing e growth." e pare.

══ FRAMEWORKS ══
- AARRR (Pirate Metrics), Growth Loops, CRO
- Behavioral Psychology (loss aversion, social proof, urgency, anchoring)
- Content Marketing, Referral Programs, Channel Strategy

══ CONTEXTO DO PROJETO ══
{PROJECT_CONTEXT}

══ COMO VOCÊ ANALISA ══
1. Mapeie o funil AARRR com dados reais (cadastros, ativação, retenção, conversão)
2. Identifique o maior gargalo do funil
3. Proponha estratégias de baixo custo para o mercado brasileiro de investidores
4. Analise a LandingPage e sugira otimizações de copy/CTA
5. Calcule ROI esperado de cada canal

══ REGRAS ══
- Responda SEMPRE em português brasileiro
- Foque em estratégias de custo zero ou baixo custo (startup early-stage)
- Cada canal: ROI esperado, tempo para resultado, esforço
- KPIs devem ser de MARKETING (CAC, conversão, viral coefficient) — nunca de infra ou produto""",

    "COO": f"""Você é o COO (Chief Operating Officer) do B3 Tactical Ranking.

══ SEU ESCOPO EXCLUSIVO ══
Você SOMENTE analisa e opina sobre:
- Pipeline de ML end-to-end: ingestão → curadoria → treino → ranking → validação
- Monitoramento: drift detection, model performance, data quality, custos
- SLAs e SLOs: uptime, latência, freshness dos dados
- Automação: EventBridge schedules, Step Functions, CloudWatch Alarms
- Incident management: runbooks, escalation, post-mortems, RCA
- Observabilidade: logs, métricas, traces (CloudWatch, X-Ray)
- Disaster recovery: backup, restore, RTO, RPO
- Qualidade de dados: completeness, freshness, anomalias

══ FORA DO SEU ESCOPO (NÃO OPINE SOBRE ISSO) ══
- UX, features, roadmap, design de produto → isso é do CPO
- Custos AWS, pricing, receita, finanças → isso é do CFO
- Marketing, aquisição, canais, growth → isso é do CMO
- Arquitetura de código, tech debt, refatoração → isso é do CTO
- Segurança, LGPD, vulnerabilidades → isso é do CISO

IMPORTANTE: Se perguntarem algo fora do seu escopo, NÃO responda sobre o tema. Diga APENAS: "Essa questão é mais adequada para o [agente correto]. Meu foco como COO é operações e pipelines." e pare.

══ FRAMEWORKS ══
- MLOps, SRE (SLIs/SLOs/SLAs), Incident Management
- Data Pipeline best practices, Observability, DR

══ PIPELINE OPERACIONAL ══
- Ingestão: Lambda ingest_quotes → BRAPI API → S3 (a cada 5min durante pregão)
- Curadoria: prepare_training_data → S3 curated/
- Treino: train_sagemaker → SageMaker → S3 models/
- Ranking: rank_sagemaker → S3 recommendations/dt=YYYY-MM-DD/
- Validação: monitor_model_performance → S3 monitoring/performance/
- Drift: monitor_drift → S3 monitoring/drift/
- Custos: monitor_costs → S3 monitoring/costs/
- Qualidade: data_quality → S3 monitoring/quality/

══ CONTEXTO DO PROJETO ══
{PROJECT_CONTEXT}

══ COMO VOCÊ ANALISA ══
1. Verifique status de CADA etapa do pipeline com dados reais
2. Identifique gaps de monitoramento e automação
3. Proponha SLAs concretos para cada processo
4. Crie runbooks com passos numerados e comandos AWS CLI
5. Avalie resiliência e pontos únicos de falha

══ REGRAS ══
- Responda SEMPRE em português brasileiro
- Use tabelas de status (✅/❌/⚠️) para cada componente do pipeline
- KPIs devem ser OPERACIONAIS (uptime, latência, freshness, MTTR) — nunca financeiros ou de produto""",

    "CTO": f"""Você é o CTO (Chief Technology Officer) do B3 Tactical Ranking.

══ SEU ESCOPO EXCLUSIVO ══
Você SOMENTE analisa e opina sobre:
- Arquitetura técnica: serverless AWS, API design, data modeling
- Tech debt: código legado, refatorações necessárias, padrões de código
- Escalabilidade: como o sistema aguenta crescimento de 10x, 100x
- Performance: latência de APIs, bundle size do frontend, cold starts Lambda
- Stack técnico: React 18, TypeScript, Python 3.11, CDK, XGBoost
- Qualidade de código: tipagem, testes, linting, CI/CD pipeline
- Decisões de arquitetura (ADRs): trade-offs técnicos
- Inovação técnica: novas tecnologias, migrações (CRA→Vite, etc.)

══ FORA DO SEU ESCOPO (NÃO OPINE SOBRE ISSO) ══
- UX, features, roadmap, design de produto → isso é do CPO
- Custos AWS, pricing, receita, finanças → isso é do CFO
- Marketing, aquisição, canais, growth → isso é do CMO
- Pipelines ML, SLAs, monitoramento operacional → isso é do COO
- Segurança, LGPD, vulnerabilidades, compliance → isso é do CISO

IMPORTANTE: Se perguntarem algo fora do seu escopo, NÃO responda sobre o tema. Diga APENAS: "Essa questão é mais adequada para o [agente correto]. Meu foco como CTO é arquitetura e tecnologia." e pare.
EXEMPLOS DO QUE NÃO É SEU ESCOPO:
- "Quais features lançar?" → CPO (produto)
- "Como melhorar retenção?" → CPO (produto) ou CMO (marketing)
- "Quanto custa o SageMaker?" → CFO (finanças)
- "O pipeline está rodando?" → COO (operações)
- "Temos vulnerabilidades?" → CISO (segurança)
Você só responde sobre: código, arquitetura, tech debt, performance técnica, stack, escalabilidade, refatoração.

══ FRAMEWORKS ══
- Architecture Decision Records (ADR), Tech Debt Quadrant (Fowler)
- DORA Metrics, AWS Well-Architected Framework, Clean Architecture

══ TECH STACK DETALHADO ══
- Frontend: React 18, TypeScript, Recharts, Lucide icons, inline styles
  - Mix de .js e .tsx (tech debt), sem CSS modules
  - Jest + Playwright, Create React App
- Backend: Python 3.11, boto3, pandas, numpy, scikit-learn, xgboost
  - 15+ Lambdas sem tipagem forte (sem mypy), sem API versioning
- Infra: CDK TypeScript, API Gateway REST, DynamoDB on-demand, S3
  - SES sandbox, sem WAF, sem CloudFront cache

══ CONTEXTO DO PROJETO ══
{PROJECT_CONTEXT}

══ COMO VOCÊ ANALISA ══
1. Avalie arquitetura vs AWS Well-Architected Framework
2. Identifique tech debt com severidade/esforço/impacto
3. Proponha melhorias de performance e escalabilidade
4. Sugira refatorações concretas com código quando relevante
5. Considere trade-off custo/benefício (startup early-stage)

══ REGRAS ══
- Responda SEMPRE em português brasileiro
- Use tabelas de tech debt com severidade/esforço/impacto
- KPIs devem ser TÉCNICOS (latência p95, bundle size, test coverage, deploy frequency) — nunca de produto, marketing ou finanças
- Sugira código concreto quando relevante""",

    "CISO": f"""Você é o CISO (Chief Information Security Officer) do B3 Tactical Ranking.

══ SEU ESCOPO EXCLUSIVO ══
Você SOMENTE analisa e opina sobre:
- Segurança da aplicação: autenticação, autorização, criptografia
- Vulnerabilidades: OWASP Top 10, injection, XSS, CSRF, SSRF
- Compliance LGPD: artigos específicos da Lei 13.709/2018
- Threat modeling: STRIDE, attack surface, threat vectors
- Políticas de acesso: IAM, API keys, JWT, RBAC
- Auditoria: logs de acesso, rastreabilidade, forensics
- Segurança AWS: WAF, Security Groups, KMS, Secrets Manager
- Hardening: CSP headers, HSTS, rate limiting, account lockout

══ FORA DO SEU ESCOPO (NÃO OPINE SOBRE ISSO) ══
- UX, features, roadmap, design de produto → isso é do CPO
- Custos AWS, pricing, receita, finanças → isso é do CFO
- Marketing, aquisição, canais, growth → isso é do CMO
- Pipelines ML, SLAs, monitoramento operacional → isso é do COO
- Arquitetura de código, tech debt, refatoração → isso é do CTO

IMPORTANTE: Se perguntarem algo fora do seu escopo, NÃO responda sobre o tema. Diga APENAS: "Essa questão é mais adequada para o [agente correto]. Meu foco como CISO é segurança e compliance." e pare.

══ FRAMEWORKS ══
- OWASP Top 10 (2021), STRIDE, LGPD (Lei 13.709/2018)
- CIS Benchmarks, NIST Cybersecurity Framework, Zero Trust

══ CONTROLES ATUAIS ══
- Auth: PBKDF2-SHA256 600k iterações (acima OWASP mínimo 210k)
- JWT: HMAC-SHA256, expiração 24h, JTI único
- Rate limiting: 5 tentativas/15min por email
- Account lockout: 10 falhas → conta bloqueada
- HTTPS enforced, API Key obrigatória, timing-safe comparison

══ GAPS CONHECIDOS ══
- WAF ausente (vulnerável a bots e DDoS L7)
- CSP ausente no frontend (risco XSS)
- Audit log ausente (sem rastreabilidade)
- JWT secret fixo (sem rotação)
- LGPD: sem política de privacidade, sem exclusão de dados
- SES sandbox: emails de segurança não chegam
- Sem SAST/DAST no CI/CD

══ CONTEXTO DO PROJETO ══
{PROJECT_CONTEXT}

══ COMO VOCÊ ANALISA ══
1. Avalie postura de segurança com dados reais
2. Aplique OWASP Top 10 e STRIDE a cada componente
3. Verifique compliance LGPD artigo por artigo
4. Classifique vulnerabilidades por risco (Crítico/Alto/Médio/Baixo)
5. Proponha remediações priorizadas por risco

══ REGRAS ══
- Responda SEMPRE em português brasileiro
- Use classificação de risco com justificativa
- KPIs devem ser de SEGURANÇA (vulnerabilidades abertas, compliance %, tempo de patch) — nunca de produto, marketing ou finanças
- Checklist LGPD deve referenciar artigos específicos da lei
- Contexto: fintech com dados financeiros sensíveis""",
}


# ══════════════════════════════════════════════════════════════════════════════
# SYSTEM DATA COLLECTORS
# ══════════════════════════════════════════════════════════════════════════════

def _get_system_metrics() -> dict:
    """Collect real metrics from the system for agents to analyze."""
    metrics = {}
    now = datetime.now(UTC)

    # User stats from DynamoDB
    try:
        table = dynamodb.Table(USERS_TABLE)
        result = table.scan(
            ProjectionExpression="email, #r, #p, createdAt, emailVerified, #e, lastLogin, loginCount, phone",
            ExpressionAttributeNames={"#r": "role", "#p": "plan", "#e": "enabled"},
        )
        users = result.get("Items", [])
        total = len(users)
        verified = sum(1 for u in users if u.get("emailVerified", False))
        pro = sum(1 for u in users if u.get("plan") == "pro")
        free = total - pro
        admins = sum(1 for u in users if u.get("role") == "admin")
        enabled = sum(1 for u in users if u.get("enabled", True))
        with_phone = sum(1 for u in users if u.get("phone"))

        recent_7d = 0
        recent_30d = 0
        active_7d = 0
        for u in users:
            try:
                created = datetime.fromisoformat(u.get("createdAt", "").replace("Z", "+00:00"))
                age_days = (now - created).days
                if age_days <= 7:
                    recent_7d += 1
                if age_days <= 30:
                    recent_30d += 1
            except Exception:
                pass
            try:
                last = u.get("lastLogin", "")
                if last:
                    last_dt = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
                    if (now - last_dt).days <= 7:
                        active_7d += 1
            except Exception:
                pass

        avg_logins = 0
        if users:
            total_logins = sum(int(u.get("loginCount", 0)) for u in users)
            avg_logins = round(total_logins / max(total, 1), 1)

        metrics["users"] = {
            "total": total, "verified": verified, "pro": pro, "free": free,
            "admins": admins, "enabled": enabled, "with_phone": with_phone,
            "recent_7d": recent_7d, "recent_30d": recent_30d,
            "active_7d": active_7d,
            "avg_logins": avg_logins,
            "conversion_rate": round(pro / max(total, 1) * 100, 1),
            "verification_rate": round(verified / max(total, 1) * 100, 1),
            "activation_rate": round(active_7d / max(total, 1) * 100, 1),
        }
    except Exception as e:
        logger.warning(f"Error fetching user metrics: {e}")
        metrics["users"] = {"error": str(e)}

    # S3 data freshness + recommendation quality
    try:
        today = now.strftime("%Y-%m-%d")
        yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
        resp = s3.list_objects_v2(Bucket=BUCKET, Prefix=f"recommendations/dt={today}/", MaxKeys=5)
        has_today = resp.get("KeyCount", 0) > 0
        if not has_today:
            resp2 = s3.list_objects_v2(Bucket=BUCKET, Prefix=f"recommendations/dt={yesterday}/", MaxKeys=5)
            has_yesterday = resp2.get("KeyCount", 0) > 0
        else:
            has_yesterday = True

        resp_all = s3.list_objects_v2(Bucket=BUCKET, Prefix="recommendations/dt=", Delimiter="/", MaxKeys=100)
        rec_days = len(resp_all.get("CommonPrefixes", []))

        monitoring = {}
        for prefix in ["monitoring/performance/", "monitoring/drift/", "monitoring/costs/"]:
            resp3 = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix, MaxKeys=1)
            monitoring[prefix.split("/")[1]] = resp3.get("KeyCount", 0) > 0

        from datetime import datetime as _dt
        _current_year = _dt.utcnow().year
        resp_curated = s3.list_objects_v2(
            Bucket=BUCKET, Prefix=f"curated/daily_monthly/year={_current_year}/",
            Delimiter="/", MaxKeys=20,
        )
        curated_months = len(resp_curated.get("CommonPrefixes", []))

        metrics["data"] = {
            "has_today_recommendations": has_today,
            "has_yesterday_recommendations": has_yesterday,
            "total_recommendation_days": rec_days,
            "curated_months": curated_months,
            "date_checked": today,
            **monitoring,
        }
    except Exception as e:
        logger.warning(f"Error fetching S3 metrics: {e}")
        metrics["data"] = {"error": str(e)}

    # Infrastructure estimates
    metrics["infra"] = {
        "lambda_count": 15,
        "dynamodb_tables": 4,
        "s3_bucket": BUCKET,
        "region": os.environ.get("AWS_REGION", "us-east-1"),
        "stack": "B3TacticalRankingStackV2",
        "frontend": "GitHub Pages (React SPA)",
        "ml_model": "XGBoost via SageMaker",
        "auth": "PBKDF2-SHA256 600k iter + JWT",
    }

    return metrics


# ══════════════════════════════════════════════════════════════════════════════
# BEDROCK LLM INTEGRATION
# ══════════════════════════════════════════════════════════════════════════════

def _call_bedrock(system_prompt: str, user_message: str, max_tokens: int = 4096) -> str:
    """Call AWS Bedrock with the agent's system prompt and user message."""
    try:
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": 0.7,
            "top_p": 0.9,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_message}],
        })

        response = bedrock.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=body,
        )

        result = json.loads(response["body"].read())
        return result.get("content", [{}])[0].get("text", "Erro ao gerar resposta.")

    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        logger.error(f"Bedrock error: {error_code} — {e}")
        if error_code == "ThrottlingException":
            return "⚠️ Limite de requisições atingido. Tente novamente em alguns segundos."
        elif error_code == "AccessDeniedException":
            return "⚠️ Acesso ao Bedrock não configurado. Verifique as permissões IAM e habilite o modelo no console AWS Bedrock."
        elif error_code == "ValidationException":
            return "⚠️ Erro de validação na chamada ao Bedrock. Verifique o modelo configurado."
        return f"⚠️ Erro ao chamar Bedrock: {error_code}"
    except Exception as e:
        logger.error(f"Unexpected Bedrock error: {e}")
        return f"⚠️ Erro inesperado: {str(e)[:200]}"


def _build_metrics_context(metrics: dict) -> str:
    """Build a structured text representation of system metrics for the LLM."""
    u = metrics.get("users", {})
    d = metrics.get("data", {})
    infra = metrics.get("infra", {})

    if "error" in u:
        user_section = f"  ERRO ao coletar métricas de usuários: {u['error']}"
    else:
        user_section = f"""  Total de usuários: {u.get('total', 0)}
  Usuários Pro (pagantes): {u.get('pro', 0)}
  Usuários Free: {u.get('free', 0)}
  Verificados (email): {u.get('verified', 0)} ({u.get('verification_rate', 0)}%)
  Ativos últimos 7 dias: {u.get('active_7d', 0)} ({u.get('activation_rate', 0)}%)
  Cadastros últimos 7 dias: {u.get('recent_7d', 0)}
  Cadastros últimos 30 dias: {u.get('recent_30d', 0)}
  Taxa de conversão Free→Pro: {u.get('conversion_rate', 0)}%
  Média de logins por usuário: {u.get('avg_logins', 0)}
  Admins: {u.get('admins', 0)}
  Com telefone: {u.get('with_phone', 0)}
  Habilitados: {u.get('enabled', 0)}"""

    if "error" in d:
        data_section = f"  ERRO ao coletar métricas de dados: {d['error']}"
    else:
        data_section = f"""  Recomendações geradas hoje: {'SIM ✅' if d.get('has_today_recommendations') else 'NÃO ❌'}
  Recomendações geradas ontem: {'SIM ✅' if d.get('has_yesterday_recommendations') else 'NÃO ❌'}
  Total de dias com recomendações: {d.get('total_recommendation_days', 0)}
  Meses de dados curados: {d.get('curated_months', 0)}
  Monitor de performance: {'Ativo ✅' if d.get('performance') else 'Inativo ❌'}
  Monitor de drift: {'Ativo ✅' if d.get('drift') else 'Inativo ❌'}
  Monitor de custos: {'Ativo ✅' if d.get('costs') else 'Inativo ❌'}
  Data verificada: {d.get('date_checked', 'N/A')}"""

    infra_section = f"""  Lambdas: {infra.get('lambda_count', 'N/A')}
  Tabelas DynamoDB: {infra.get('dynamodb_tables', 'N/A')}
  Bucket S3: {infra.get('s3_bucket', 'N/A')}
  Região AWS: {infra.get('region', 'N/A')}
  Stack: {infra.get('stack', 'N/A')}
  Frontend: {infra.get('frontend', 'N/A')}
  Modelo ML: {infra.get('ml_model', 'N/A')}
  Auth: {infra.get('auth', 'N/A')}"""

    return f"""
═══ MÉTRICAS DO SISTEMA EM TEMPO REAL ═══
Data/hora: {datetime.now(UTC).strftime('%d/%m/%Y %H:%M UTC')}

📊 USUÁRIOS:
{user_section}

📦 DADOS E PIPELINE:
{data_section}

🏗️ INFRAESTRUTURA:
{infra_section}
"""


# ══════════════════════════════════════════════════════════════════════════════
# AGENT ANALYSIS — Bedrock-powered deep analysis
# ══════════════════════════════════════════════════════════════════════════════

def _generate_agent_analysis(agent_id: str, metrics: dict, directive: str = "") -> dict:
    """Generate deep analysis using Bedrock LLM with real system data."""
    system_prompt = AGENT_SYSTEM_PROMPTS.get(agent_id, "")
    metrics_context = _build_metrics_context(metrics)

    scope_map = {
        "CPO": "produto, UX, features, roadmap, engajamento de usuários",
        "CFO": "finanças, custos AWS, receita, pricing, unit economics",
        "CMO": "marketing, aquisição de usuários, growth, canais, conversão",
        "COO": "operações, pipelines ML, SLAs, monitoramento, automação",
        "CTO": "arquitetura de código, tech debt, performance técnica, escalabilidade, stack",
        "CISO": "segurança, LGPD, vulnerabilidades, compliance, auditoria",
    }
    agent_scope = scope_map.get(agent_id, "sua área")

    analysis_prompt = f"""{metrics_context}

ESCOPO DA SUA ANÁLISE: Analise SOMENTE sob a ótica de {agent_scope}. NÃO gere insights, tasks ou KPIs sobre áreas de outros agentes.

Com base nos dados REAIS acima, gere uma análise completa DENTRO DO SEU ESCOPO.

Responda EXATAMENTE neste formato JSON (sem markdown, sem ```):
{{
  "insights": ["insight 1 com dados reais", "insight 2 com dados reais", ...],
  "tasks": [
    {{"title": "Título da tarefa", "priority": "crítica|alta|média|baixa", "description": "Descrição detalhada com ação concreta e impacto esperado"}},
    ...
  ],
  "kpis": {{"Nome KPI": "valor", "Nome KPI 2": "valor", ...}},
  "risk_level": "low|medium|high",
  "status": "active"
}}

REGRAS PARA A ANÁLISE:
- Gere 5-8 insights profundos baseados nos dados reais (não genéricos)
- Gere 5-7 tasks priorizadas com ações concretas
- Gere 6-8 KPIs relevantes para sua área com valores reais
- risk_level deve refletir a situação real dos dados
- Cada insight deve referenciar um número/métrica real
- Cada task deve ter impacto estimado"""

    if directive:
        analysis_prompt += f"\n\nDIRETIVA DO CEO para considerar na análise: \"{directive}\""

    raw = _call_bedrock(system_prompt, analysis_prompt, max_tokens=3000)

    # Parse JSON response
    try:
        # Try to extract JSON from the response
        json_str = raw.strip()
        # Handle case where LLM wraps in markdown
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0].strip()
        # Find the JSON object
        start = json_str.find("{")
        end = json_str.rfind("}") + 1
        if start >= 0 and end > start:
            json_str = json_str[start:end]
        analysis = json.loads(json_str)
        # Validate structure
        if not isinstance(analysis.get("insights"), list):
            analysis["insights"] = [raw[:500]]
        if not isinstance(analysis.get("tasks"), list):
            analysis["tasks"] = []
        if not isinstance(analysis.get("kpis"), dict):
            analysis["kpis"] = {}
        analysis.setdefault("risk_level", "medium")
        analysis.setdefault("status", "active")
        return analysis
    except (json.JSONDecodeError, ValueError, KeyError) as e:
        logger.warning(f"Failed to parse Bedrock JSON for {agent_id}: {e}")
        # Fallback: return raw text as single insight
        return {
            "insights": [raw[:2000] if raw else "Análise indisponível no momento."],
            "tasks": [],
            "kpis": {},
            "risk_level": "medium",
            "status": "active",
        }


def _build_agent_response(agent_id: str, agent_def: dict, analysis: dict, directive: str, metrics: dict) -> str:
    """Build a deeply contextual response using Bedrock LLM."""
    system_prompt = AGENT_SYSTEM_PROMPTS.get(agent_id, "")
    metrics_context = _build_metrics_context(metrics)

    # Include recent analysis context
    insights_text = "\n".join(f"- {i}" for i in analysis.get("insights", [])[:5])
    tasks_text = "\n".join(f"- [{t.get('priority', 'média')}] {t.get('title', '')}" for t in analysis.get("tasks", [])[:5])
    kpis_text = "\n".join(f"- {k}: {v}" for k, v in analysis.get("kpis", {}).items())

    # Build scope reminder based on agent role
    scope_map = {
        "CPO": "produto, UX, features, roadmap, engajamento",
        "CFO": "finanças, custos AWS, receita, pricing, unit economics",
        "CMO": "marketing, aquisição, growth, canais, conversão",
        "COO": "operações, pipelines ML, SLAs, monitoramento, automação",
        "CTO": "arquitetura, tech debt, código, performance técnica, escalabilidade",
        "CISO": "segurança, LGPD, vulnerabilidades, compliance, auditoria",
    }
    agent_scope = scope_map.get(agent_id, "sua área de especialidade")

    chat_prompt = f"""{metrics_context}

═══ SUA ANÁLISE ATUAL ═══
KPIs:
{kpis_text}

Insights recentes:
{insights_text}

Tasks priorizadas:
{tasks_text}

═══ MENSAGEM DO CEO ═══
"{directive}"

═══ REGRA CRÍTICA DE ESCOPO ═══
Você é o {agent_def['name']}. Seu escopo é EXCLUSIVAMENTE: {agent_scope}.
Se a mensagem do CEO for sobre um tema FORA do seu escopo, responda APENAS:
"{agent_def['emoji']} {agent_def['name']}: Essa questão está fora da minha área de atuação. Recomendo consultar o agente responsável por esse tema."
NÃO tente responder sobre temas de outros agentes. Seja rigoroso com seu escopo.

Se a mensagem ESTIVER no seu escopo, responda normalmente seguindo o formato abaixo.

FORMATO DA RESPOSTA:
- Comece com seu emoji {agent_def['emoji']} e nome
- Analise APENAS sob a ótica da sua especialidade ({agent_scope})
- Referencie métricas e dados REAIS do sistema
- Proponha ações concretas dentro da sua área
- Use emojis para organizar seções
- Termine com timestamp
- Máximo 800 palavras, seja direto e acionável
- NUNCA invente dados — use apenas os fornecidos acima"""

    response = _call_bedrock(system_prompt, chat_prompt, max_tokens=2000)

    # Ensure response starts with agent header
    header = f"{agent_def['emoji']} {agent_def['name']}"
    if not response.startswith(header):
        response = f"{header}\n\n{response}"

    # Add timestamp
    timestamp = f"\n\n🕐 {datetime.now(UTC).strftime('%d/%m/%Y %H:%M')} UTC"
    if "🕐" not in response:
        response += timestamp

    return response


# ══════════════════════════════════════════════════════════════════════════════
# DYNAMODB PERSISTENCE
# ══════════════════════════════════════════════════════════════════════════════

def _get_agent_state(agent_id: str) -> dict:
    try:
        table = dynamodb.Table(AGENTS_TABLE)
        result = table.get_item(Key={"agentId": agent_id})
        item = result.get("Item", {})
        return json.loads(json.dumps(item, default=str))
    except Exception as e:
        logger.warning(f"Error getting agent state: {e}")
        return {}


def _save_agent_state(agent_id: str, state: dict):
    try:
        table = dynamodb.Table(AGENTS_TABLE)
        state["agentId"] = agent_id
        state["updatedAt"] = datetime.now(UTC).isoformat()
        table.put_item(Item=json.loads(json.dumps(state), parse_float=Decimal))
    except Exception as e:
        logger.error(f"Error saving agent state: {e}")


def _add_chat_message(agent_id: str, role: str, content: str):
    state = _get_agent_state(agent_id)
    chat = state.get("chat", [])
    chat.append({
        "id": str(uuid.uuid4())[:8],
        "role": role,
        "content": content,
        "timestamp": datetime.now(UTC).isoformat(),
    })
    if len(chat) > 50:
        chat = chat[-50:]
    state["chat"] = chat
    _save_agent_state(agent_id, state)


# ══════════════════════════════════════════════════════════════════════════════
# HANDLERS
# ══════════════════════════════════════════════════════════════════════════════

def _handle_get_agents(event: dict) -> dict:
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    system_metrics = _get_system_metrics()
    agents_list = []

    for agent_id, agent_def in AGENTS.items():
        state = _get_agent_state(agent_id)
        # Return saved analysis from DynamoDB (don't call Bedrock on list)
        analysis = state.get("analysis", {
            "insights": ["Envie uma mensagem para ativar este agente."],
            "tasks": [],
            "kpis": {},
            "risk_level": "medium",
            "status": "active",
        })
        agents_list.append({
            "id": agent_id,
            **agent_def,
            "analysis": analysis,
            "chat": state.get("chat", [])[-10:],
            "last_directive": state.get("last_directive", ""),
            "updatedAt": state.get("updatedAt", ""),
        })

    return _cors_response(200, {"agents": agents_list, "system_metrics": system_metrics})


def _handle_get_agent(event: dict, agent_id: str) -> dict:
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    if agent_id not in AGENTS:
        return _cors_response(404, {"message": "Agente não encontrado"})

    system_metrics = _get_system_metrics()
    state = _get_agent_state(agent_id)
    # Return saved analysis from DynamoDB (don't call Bedrock on GET)
    analysis = state.get("analysis", {
        "insights": ["Envie uma mensagem para ativar este agente."],
        "tasks": [],
        "kpis": {},
        "risk_level": "medium",
        "status": "active",
    })

    return _cors_response(200, {
        "agent": {
            "id": agent_id,
            **AGENTS[agent_id],
            "analysis": analysis,
            "chat": state.get("chat", []),
            "last_directive": state.get("last_directive", ""),
            "updatedAt": state.get("updatedAt", ""),
        },
        "system_metrics": system_metrics,
    })


def _handle_chat(event: dict, agent_id: str) -> dict:
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    if agent_id not in AGENTS:
        return _cors_response(404, {"message": "Agente não encontrado"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors_response(400, {"message": "JSON inválido"})

    message = (body.get("message", "") or "").strip()
    if not message or len(message) > 2000:
        return _cors_response(400, {"message": "Mensagem inválida (1-2000 caracteres)"})

    _add_chat_message(agent_id, "user", message)

    system_metrics = _get_system_metrics()
    state = _get_agent_state(agent_id)
    state["last_directive"] = message
    _save_agent_state(agent_id, state)

    analysis = _generate_agent_analysis(agent_id, system_metrics, message)
    agent_def = AGENTS[agent_id]
    response = _build_agent_response(agent_id, agent_def, analysis, message, system_metrics)

    # Save analysis to DynamoDB so GET /agents returns it without calling Bedrock
    state = _get_agent_state(agent_id)
    state["analysis"] = analysis
    _save_agent_state(agent_id, state)

    _add_chat_message(agent_id, "agent", response)

    return _cors_response(200, {"response": response, "analysis": analysis})


def _handle_update_task(event: dict, agent_id: str) -> dict:
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    if agent_id not in AGENTS:
        return _cors_response(404, {"message": "Agente não encontrado"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors_response(400, {"message": "JSON inválido"})

    task_index = body.get("taskIndex", -1)
    new_status = body.get("status", "")

    if new_status not in ("pending", "in_progress", "done"):
        return _cors_response(400, {"message": "Status inválido"})

    state = _get_agent_state(agent_id)
    task_statuses = state.get("task_statuses", {})
    task_statuses[str(task_index)] = new_status
    state["task_statuses"] = task_statuses
    _save_agent_state(agent_id, state)

    return _cors_response(200, {"message": "Task atualizada", "task_statuses": task_statuses})


# ══════════════════════════════════════════════════════════════════════════════
# MAIN HANDLER
# ══════════════════════════════════════════════════════════════════════════════

def handler(event: dict, context: Any = None) -> dict:
    method = event.get("httpMethod", "")
    if method == "OPTIONS":
        return _cors_response(200, {})

    path = (event.get("path", "") or event.get("resource", "")).rstrip("/")

    if path.endswith("/admin/agents") and method == "GET":
        return _handle_get_agents(event)

    if "/admin/agents/" in path and method == "GET" and not path.endswith("/chat"):
        agent_id = path.split("/admin/agents/")[-1].split("/")[0].upper()
        return _handle_get_agent(event, agent_id)

    if path.endswith("/chat") and method == "POST":
        parts = path.split("/")
        agent_id = parts[-2].upper() if len(parts) >= 2 else ""
        return _handle_chat(event, agent_id)

    if path.endswith("/tasks") and method == "PUT":
        parts = path.split("/")
        agent_id = parts[-2].upper() if len(parts) >= 2 else ""
        return _handle_update_task(event, agent_id)

    return _cors_response(404, {"message": "Not found"})
