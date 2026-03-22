"""
B3 Tactical Ranking — AI Executive Agents Hub
Each agent (CPO, CFO, CMO, COO, CTO, CISO) analyzes real system data
and provides strategic insights, plans, and recommendations.
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

AGENTS_TABLE = os.environ.get("AGENTS_TABLE", "B3Dashboard-Agents")
USERS_TABLE = os.environ.get("USERS_TABLE", "B3Dashboard-Users")
BUCKET = os.environ.get("BUCKET", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "")

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

def _cors_response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Api-Key",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
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


# ── System Data Collectors ──
def _get_system_metrics() -> dict:
    """Collect real metrics from the system for agents to analyze."""
    metrics = {}
    now = datetime.now(UTC)

    # User stats from DynamoDB
    try:
        table = dynamodb.Table(USERS_TABLE)
        result = table.scan(ProjectionExpression="email, #r, #p, createdAt, emailVerified, #e, lastLogin, loginCount, phone",
                           ExpressionAttributeNames={"#r": "role", "#p": "plan", "#e": "enabled"})
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

        # Count total recommendation days available
        resp_all = s3.list_objects_v2(Bucket=BUCKET, Prefix="recommendations/dt=", Delimiter="/", MaxKeys=100)
        rec_days = len(resp_all.get("CommonPrefixes", []))

        # Check monitoring data
        monitoring = {}
        for prefix in ["monitoring/performance/", "monitoring/drift/", "monitoring/costs/"]:
            resp3 = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix, MaxKeys=1)
            monitoring[prefix.split("/")[1]] = resp3.get("KeyCount", 0) > 0

        # Check curated data months (dynamic year)
        from datetime import datetime as _dt
        _current_year = _dt.utcnow().year
        resp_curated = s3.list_objects_v2(Bucket=BUCKET, Prefix=f"curated/daily_monthly/year={_current_year}/", Delimiter="/", MaxKeys=20)
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


# ── Agent Brain: Deep domain expertise per role ──
def _generate_agent_analysis(agent_id: str, sm: dict, directive: str = "") -> dict:
    """Generate deep, actionable analysis for each agent based on real data."""
    u = sm.get("users", {})
    d = sm.get("data", {})
    infra = sm.get("infra", {})
    total = u.get("total", 0)
    pro = u.get("pro", 0)
    free = u.get("free", 0)
    conv = u.get("conversion_rate", 0)
    ver = u.get("verification_rate", 0)
    active = u.get("active_7d", 0)
    recent7 = u.get("recent_7d", 0)
    recent30 = u.get("recent_30d", 0)
    has_recs = d.get("has_today_recommendations", False)
    rec_days = d.get("total_recommendation_days", 0)

    a = {"insights": [], "tasks": [], "kpis": {}, "status": "active", "risk_level": "low"}

    if agent_id == "CPO":
        a = _analyze_cpo(u, d, total, pro, free, conv, ver, active, recent7, recent30, rec_days)
    elif agent_id == "CFO":
        a = _analyze_cfo(u, d, infra, total, pro, free, conv)
    elif agent_id == "CMO":
        a = _analyze_cmo(u, d, total, pro, free, conv, active, recent7, recent30)
    elif agent_id == "COO":
        a = _analyze_coo(u, d, infra, has_recs, rec_days)
    elif agent_id == "CTO":
        a = _analyze_cto(u, d, infra, total, rec_days)
    elif agent_id == "CISO":
        a = _analyze_ciso(u, d, infra, total, ver)

    if directive:
        a["last_directive"] = directive
        a["tasks"].insert(0, {
            "title": f"Diretiva do CEO: {directive[:80]}",
            "priority": "crítica",
            "description": f"Diretiva recebida: {directive}",
        })

    return a


def _analyze_cpo(u, d, total, pro, free, conv, ver, active, recent7, recent30, rec_days):
    """CPO: Product vision, UX heuristics, retention, roadmap prioritization."""
    activation = u.get("activation_rate", 0)
    avg_logins = u.get("avg_logins", 0)

    # Retention proxy: active users / total
    retention_7d = round(active / max(total, 1) * 100, 1)
    # Engagement score (0-100)
    engagement = min(100, round(avg_logins * 10 + retention_7d * 0.5))

    kpis = {
        "Usuários": total,
        "Ativos (7d)": f"{active} ({retention_7d}%)",
        "Conversão": f"{conv}%",
        "Engajamento": f"{engagement}/100",
        "Verificação": f"{ver}%",
        "Rec. Dias": rec_days,
    }

    insights = []
    tasks = []
    risk = "low"

    # ── UX Heuristics Analysis (Nielsen) ──
    ux_issues = []
    if ver < 70:
        ux_issues.append(f"Verificação de email em {ver}% — fricção no onboarding. Heurística de Nielsen #7 (Flexibilidade): permitir uso limitado sem verificação, verificar depois.")
    if retention_7d < 30:
        ux_issues.append(f"Retenção 7d em {retention_7d}% — problema de 'Aha moment'. Usuários não estão encontrando valor rápido o suficiente.")
        risk = "high"
    elif retention_7d < 60:
        ux_issues.append(f"Retenção 7d em {retention_7d}% — aceitável mas abaixo do benchmark SaaS B2C (60-70%).")
        risk = "medium"

    if conv < 3:
        ux_issues.append(f"Conversão {conv}% abaixo do benchmark (3-5% para freemium B2C). O valor do Pro não está claro o suficiente na jornada do usuário.")
        risk = "high" if risk != "high" else risk
    elif conv < 5:
        ux_issues.append(f"Conversão {conv}% dentro da faixa aceitável. Otimizar com A/B testing nos CTAs de upgrade.")

    if ux_issues:
        insights.append("🔍 Análise de UX (Heurísticas de Nielsen):")
        insights.extend(ux_issues)

    # ── Jobs-to-be-Done Framework ──
    insights.append("📋 Jobs-to-be-Done identificados:")
    insights.append("  JTBD #1: 'Quero saber quais ações comprar/vender hoje' → Recomendações (core, funciona)")
    insights.append("  JTBD #2: 'Quero entender POR QUE o modelo recomenda' → Explicabilidade (diferencial)")
    insights.append("  JTBD #3: 'Quero acompanhar se as previsões acertaram' → Tracking/Performance (prova social)")
    insights.append("  JTBD #4: 'Quero montar minha carteira com base nos sinais' → Carteira Modelo (monetização)")

    # ── Roadmap Prioritization (ICE Score) ──
    roadmap = []
    if retention_7d < 50:
        roadmap.append({
            "title": "Onboarding guiado com tour interativo",
            "priority": "crítica",
            "description": f"Retenção 7d em {retention_7d}%. Implementar tour de 3 passos: (1) Mostrar recomendações do dia, (2) Explicar o score, (3) Criar primeiro alerta de preço. Benchmark: tours aumentam ativação em 25-40%. ICE: 9/8/7 = 504.",
        })
    if conv < 5:
        roadmap.append({
            "title": "Redesign do paywall com prova social",
            "priority": "alta",
            "description": f"Conversão em {conv}%. Substituir paywall genérico por: (1) Mostrar retorno que o usuário PERDEU por não ter Pro, (2) Depoimentos de usuários Pro, (3) Countdown de oferta. Benchmark: paywalls contextuais convertem 2-3x mais. ICE: 9/7/8 = 504.",
        })
    if ver < 80:
        roadmap.append({
            "title": "Simplificar verificação de email",
            "priority": "alta",
            "description": f"Apenas {ver}% verificaram email. Implementar: (1) Magic link em vez de código, (2) Permitir uso por 24h sem verificar, (3) Reminder automático com deep link. ICE: 7/9/8 = 504.",
        })

    roadmap.append({
        "title": "Push notifications de sinais fortes",
        "priority": "alta",
        "description": "Enviar notificação quando surgir ação com score > 4.0. Cria hábito de retorno diário. Usar Web Push API (gratuito). Benchmark: push aumenta DAU em 20-30%. ICE: 8/7/9 = 504.",
    })
    roadmap.append({
        "title": "Histórico de acertos do modelo (track record)",
        "priority": "alta",
        "description": f"Com {rec_days} dias de recomendações, já é possível mostrar: 'Das últimas X recomendações de Compra, Y% acertaram a direção'. Isso é a prova social mais poderosa para converter. ICE: 10/6/7 = 420.",
    })
    roadmap.append({
        "title": "Comparador de ações lado a lado",
        "priority": "média",
        "description": "Permitir selecionar 2-3 ações e comparar score, volatilidade, retorno previsto em cards lado a lado. Feature de alto engajamento e baixo esforço. ICE: 7/8/6 = 336.",
    })
    roadmap.append({
        "title": "Widget de resumo diário por email",
        "priority": "média",
        "description": "Email diário às 9h com top 3 sinais de compra e resumo do mercado. Mantém usuários engajados mesmo sem abrir o app. Requer sair do SES sandbox. ICE: 8/5/7 = 280.",
    })

    tasks = roadmap

    # ── Product Health Score ──
    health = round((retention_7d * 0.3 + conv * 5 + ver * 0.2 + engagement * 0.2) / 1.0, 0)
    health = min(100, max(0, health))
    insights.append(f"📊 Product Health Score: {health}/100 ({'🟢 Saudável' if health >= 60 else '🟡 Atenção' if health >= 40 else '🔴 Crítico'})")

    return {"insights": insights, "tasks": tasks, "kpis": kpis, "status": "active", "risk_level": risk}


def _analyze_cfo(u, d, infra, total, pro, free, conv):
    """CFO: Unit economics, LTV, CAC, runway, break-even scenarios."""
    mrr = pro * 49
    arr = mrr * 12

    # Cost estimation (serverless)
    lambda_cost = 15  # ~15 Lambdas, low traffic
    dynamo_cost = 10  # 4 tables, on-demand
    s3_cost = 5       # < 1GB storage
    apigw_cost = 5    # low request volume
    sagemaker_cost = 50  # training jobs
    ses_cost = 0       # sandbox = free
    cloudwatch_cost = 5
    total_aws = lambda_cost + dynamo_cost + s3_cost + apigw_cost + sagemaker_cost + ses_cost + cloudwatch_cost
    github_cost = 0  # free tier

    total_cost = total_aws + github_cost
    margin = round((mrr - total_cost) / max(mrr, 1) * 100, 1) if mrr > 0 else -100
    ltv = mrr * 12  # assuming 12 month avg lifetime per pro user (simplified)
    ltv_per_user = round(ltv / max(pro, 1), 0)
    cac = 0  # organic only
    ltv_cac_ratio = "∞" if cac == 0 else f"{round(ltv_per_user / max(cac, 1), 1)}x"

    # Break-even
    breakeven_users = math.ceil(total_cost / 49) if total_cost > 0 else 0
    months_to_breakeven = "—"
    if recent_growth := u.get("recent_7d", 0):
        monthly_growth = recent_growth * 4  # extrapolate
        pro_growth = round(monthly_growth * conv / 100, 1)
        if pro_growth > 0 and pro < breakeven_users:
            months_to_breakeven = f"~{math.ceil((breakeven_users - pro) / max(pro_growth, 0.1))} meses"

    # Runway (if burning cash)
    burn = total_cost - mrr
    runway = "∞" if burn <= 0 else f"Custo excede receita em R$ {burn}/mês"

    kpis = {
        "MRR": f"R$ {mrr}",
        "Custo AWS": f"R$ {total_cost}/mês",
        "Margem": f"{margin}%",
        "LTV/CAC": ltv_cac_ratio,
        "Break-even": f"{breakeven_users} Pro",
        "ARR Projetado": f"R$ {arr}",
    }

    insights = []
    risk = "low"

    insights.append(f"💵 Demonstrativo mensal: Receita R$ {mrr} vs Custo R$ {total_cost} → {'Lucro' if mrr >= total_cost else 'Prejuízo'} R$ {abs(mrr - total_cost)}/mês")

    insights.append("📊 Breakdown de custos AWS estimado:")
    insights.append(f"  • SageMaker (treino ML): R$ {sagemaker_cost} (55% do custo)")
    insights.append(f"  • Lambda (15 funções): R$ {lambda_cost}")
    insights.append(f"  • DynamoDB (4 tabelas): R$ {dynamo_cost}")
    insights.append(f"  • API Gateway + S3 + CW: R$ {apigw_cost + s3_cost + cloudwatch_cost}")
    insights.append(f"  • GitHub Pages: R$ 0 (gratuito)")

    insights.append(f"📈 Unit Economics: LTV estimado R$ {ltv_per_user}/usuário Pro (12 meses × R$ 49). CAC = R$ 0 (orgânico). Ratio LTV/CAC = {ltv_cac_ratio}.")

    if mrr < total_cost:
        insights.append(f"⚠️ Operação no prejuízo. Precisa de {breakeven_users} assinantes Pro para break-even. Atualmente: {pro}.")
        risk = "high"
    else:
        insights.append(f"✅ Operação lucrativa com margem de {margin}%. Cada novo Pro adiciona R$ 49 de margem pura.")

    tasks = []
    if mrr < total_cost:
        tasks.append({
            "title": f"Atingir break-even ({breakeven_users} Pro)",
            "priority": "crítica",
            "description": f"Faltam {max(0, breakeven_users - pro)} assinantes Pro. Estratégias: (1) Trial 7 dias, (2) Desconto primeiro mês R$ 29, (3) Plano anual R$ 39/mês. {months_to_breakeven} para break-even no ritmo atual.",
        })

    tasks.append({
        "title": "Reduzir custo SageMaker",
        "priority": "alta",
        "description": f"SageMaker é {round(sagemaker_cost/max(total_cost,1)*100)}% do custo. Opções: (1) Usar Spot Instances (até 90% desconto), (2) Treinar com menor frequência (semanal vs diário), (3) Migrar inferência para Lambda com modelo serializado.",
    })
    tasks.append({
        "title": "Implementar plano anual com desconto",
        "priority": "alta",
        "description": "Plano anual R$ 39/mês (R$ 468/ano vs R$ 588). Reduz churn, aumenta LTV, melhora previsibilidade de receita. Benchmark: 30-40% dos Pro migram para anual.",
    })
    tasks.append({
        "title": "Criar tier intermediário (Básico R$ 29/mês)",
        "priority": "média",
        "description": "Tier entre Free e Pro: acesso a Confiança e Stop-Loss, sem Take-Profit e Carteira. Captura usuários sensíveis a preço. Benchmark: tier intermediário aumenta receita total em 15-25%.",
    })
    tasks.append({
        "title": "Dashboard de custos em tempo real",
        "priority": "baixa",
        "description": "Integrar AWS Cost Explorer API para mostrar custos reais no admin. Atualmente usando estimativas.",
    })

    return {"insights": insights, "tasks": tasks, "kpis": kpis, "status": "active", "risk_level": risk}


def _analyze_cmo(u, d, total, pro, free, conv, active, recent7, recent30):
    """CMO: AARRR funnel, channel strategy, conversion optimization."""
    activation = u.get("activation_rate", 0)
    ver = u.get("verification_rate", 0)
    daily_signups = round(recent7 / 7, 1) if recent7 else 0
    monthly_signups = recent30

    # AARRR Funnel
    funnel = {
        "Aquisição": f"{monthly_signups} cadastros/mês",
        "Ativação": f"{ver}% verificaram email",
        "Retenção": f"{activation}% ativos 7d",
        "Receita": f"{conv}% converteram Pro",
        "Referral": "Não medido",
    }

    kpis = {
        "Cadastros/dia": daily_signups,
        "Funil Ativação": f"{ver}%",
        "Funil Retenção": f"{activation}%",
        "Funil Conversão": f"{conv}%",
        "CAC": "R$ 0",
        "Cadastros (30d)": monthly_signups,
    }

    insights = []
    risk = "low"

    insights.append("📊 Funil AARRR (Pirate Metrics):")
    for stage, val in funnel.items():
        insights.append(f"  {stage}: {val}")

    # Identify biggest funnel leak
    stages = [100, ver, activation, conv]
    drops = [(stages[i] - stages[i+1], i) for i in range(len(stages)-1)]
    biggest_drop = max(drops, key=lambda x: x[0])
    stage_names = ["Aquisição→Ativação", "Ativação→Retenção", "Retenção→Conversão"]
    insights.append(f"🚨 Maior vazamento no funil: {stage_names[biggest_drop[1]]} (queda de {biggest_drop[0]:.0f}pp). Priorizar correção aqui.")

    if daily_signups < 1:
        insights.append(f"⚠️ Aquisição baixa: {daily_signups} cadastros/dia. Produto novo precisa de pelo menos 3-5/dia para validar product-market fit.")
        risk = "medium"

    insights.append("🎯 Canais recomendados para fintech B3:")
    insights.append("  1. SEO: conteúdo 'melhores ações para comprar hoje', 'ranking ações B3' (volume alto, competição média)")
    insights.append("  2. Comunidades: r/investimentos, grupos Telegram de day trade, fóruns Bastter")
    insights.append("  3. YouTube: vídeos curtos mostrando acertos do modelo (prova social)")
    insights.append("  4. Twitter/X Fintwit: posts diários com top 3 sinais (automático)")

    tasks = []
    if biggest_drop[1] == 0:  # Acquisition to Activation
        tasks.append({
            "title": "Otimizar fluxo de ativação pós-cadastro",
            "priority": "crítica",
            "description": f"Apenas {ver}% verificam email. Implementar: (1) Redirect automático para dashboard após cadastro (sem esperar verificação), (2) Banner persistente 'Verifique seu email', (3) Reenvio automático após 1h. Benchmark: 80-90% de verificação.",
        })
    elif biggest_drop[1] == 1:  # Activation to Retention
        tasks.append({
            "title": "Melhorar retenção com engagement loops",
            "priority": "crítica",
            "description": f"Apenas {activation}% retornam em 7 dias. Implementar: (1) Email diário 9h com resumo, (2) Push notification de sinais fortes, (3) Streak de dias consecutivos com badge. Benchmark: 40-60% retenção 7d.",
        })
    else:  # Retention to Conversion
        tasks.append({
            "title": "Otimizar conversão free→pro",
            "priority": "crítica",
            "description": f"Conversão em {conv}%. Implementar: (1) Trial 7 dias automático no cadastro, (2) Mostrar 'Você perdeu R$ X por não ter Pro' baseado em sinais reais, (3) Oferta limitada 'Primeiro mês R$ 19'. Benchmark: 3-7% para freemium.",
        })

    tasks.append({
        "title": "Automação de conteúdo social",
        "priority": "alta",
        "description": "Criar Lambda que posta automaticamente no Twitter/X: 'Top 3 sinais de compra hoje: PETR4 (+8.2%), VALE3 (+5.1%), ...' Custo zero, alcance orgânico alto no Fintwit.",
    })
    tasks.append({
        "title": "Programa de referral",
        "priority": "alta",
        "description": "Implementar 'Indique 3 amigos → ganhe 1 mês Pro'. Viral loop: cada Pro indica 1.5 novos em média. Custo: R$ 16/aquisição (1 mês grátis / 3 indicações).",
    })
    tasks.append({
        "title": "Landing page com SEO otimizado",
        "priority": "média",
        "description": "Criar páginas de conteúdo: '/blog/melhores-acoes-b3-hoje', '/blog/como-funciona-ml-acoes'. Meta descriptions, schema markup, sitemap. Target: 500 visitas orgânicas/mês em 3 meses.",
    })

    if daily_signups < 1:
        risk = "high"
    elif conv < 3:
        risk = "medium"

    return {"insights": insights, "tasks": tasks, "kpis": kpis, "status": "active", "risk_level": risk}


def _analyze_coo(u, d, infra, has_recs, rec_days):
    """COO: Operations, pipeline health, SLAs, incident management."""
    has_perf = d.get("performance", False)
    has_drift = d.get("drift", False)
    has_costs = d.get("costs", False)
    curated_months = d.get("curated_months", 0)
    has_yesterday = d.get("has_yesterday_recommendations", False)

    # Pipeline health score
    checks = [has_recs, has_yesterday, has_perf, has_drift, curated_months >= 2]
    health = round(sum(checks) / len(checks) * 100)

    kpis = {
        "Pipeline Hoje": "✅ OK" if has_recs else "❌ Falhou",
        "Saúde Ops": f"{health}%",
        "Dias de Dados": rec_days,
        "Meses Curados": curated_months,
        "Monitor Perf": "✅" if has_perf else "❌",
        "Monitor Drift": "✅" if has_drift else "❌",
    }

    insights = []
    risk = "low"

    insights.append(f"🏥 Saúde operacional: {health}% ({'🟢 Saudável' if health >= 80 else '🟡 Atenção' if health >= 60 else '🔴 Crítico'})")

    # Pipeline status
    if has_recs:
        insights.append("✅ Pipeline de recomendações rodou hoje com sucesso.")
    else:
        insights.append("❌ Pipeline NÃO gerou recomendações hoje. Verificar: (1) Lambda ingest_quotes executou? (2) Dados brapi disponíveis? (3) SageMaker endpoint ativo?")
        risk = "high"

    if not has_yesterday and not has_recs:
        insights.append("🚨 ALERTA: Sem recomendações por 2+ dias consecutivos. Possível falha sistêmica no pipeline.")
        risk = "high"

    insights.append(f"📦 Dados curados: {curated_months} meses disponíveis para backtesting. {rec_days} dias de recomendações históricas.")

    # Monitoring gaps
    gaps = []
    if not has_perf:
        gaps.append("Performance do modelo")
    if not has_drift:
        gaps.append("Drift detection")
    if not has_costs:
        gaps.append("Custos")
    if gaps:
        insights.append(f"⚠️ Monitoramento ausente: {', '.join(gaps)}. Dados podem estar desatualizados.")

    # SLA definition
    insights.append("📋 SLAs definidos:")
    insights.append("  • Recomendações diárias: até 19:00 BRT (SLA: 99%)")
    insights.append("  • API uptime: 99.9% (API Gateway + Lambda)")
    insights.append("  • Latência API: < 2s p95")
    insights.append(f"  • Dados históricos: {curated_months} meses (target: 6+)")

    tasks = []
    if not has_recs:
        tasks.append({
            "title": "🚨 Restaurar pipeline de recomendações",
            "priority": "crítica",
            "description": "Runbook: (1) Verificar CloudWatch Logs do Lambda ingest_quotes, (2) Testar endpoint brapi manualmente, (3) Verificar SageMaker endpoint status, (4) Se necessário, executar pipeline manualmente via Lambda invoke.",
        })

    tasks.append({
        "title": "Implementar alertas automáticos de falha",
        "priority": "alta",
        "description": "Criar CloudWatch Alarm: se Lambda ingest_quotes ou rank_sagemaker falhar, enviar SNS → email + WhatsApp. Custo: ~R$ 0.50/mês. Tempo de implementação: 2h.",
    })
    tasks.append({
        "title": "Criar runbook de incidentes",
        "priority": "alta",
        "description": "Documentar: (1) Pipeline não rodou → verificar X, Y, Z, (2) API lenta → verificar Lambda cold starts, (3) Dados incorretos → verificar ingestão brapi. Salvar no S3 como referência.",
    })
    tasks.append({
        "title": "Automatizar backfill de dados faltantes",
        "priority": "média",
        "description": f"Se pipeline falhar em um dia, Lambda de backfill deve rodar automaticamente no dia seguinte. Atualmente: {rec_days} dias de dados, gaps podem existir.",
    })
    tasks.append({
        "title": "Expandir dados curados para 12 meses",
        "priority": "média",
        "description": f"Atualmente {curated_months} meses. Backtesting precisa de pelo menos 6 meses para ser estatisticamente relevante. Ingerir dados históricos de 2025.",
    })

    if not has_recs:
        risk = "high"
    elif health < 80:
        risk = "medium"

    return {"insights": insights, "tasks": tasks, "kpis": kpis, "status": "active", "risk_level": risk}


def _analyze_cto(u, d, infra, total, rec_days):
    """CTO: Architecture, tech debt, scalability, innovation."""
    kpis = {
        "Stack": "Serverless AWS",
        "Frontend": "React 18 + TS",
        "Backend": "Python Lambda",
        "ML": "XGBoost/SageMaker",
        "DB": "DynamoDB + S3",
        "Deploy": "CDK + GH Actions",
    }

    insights = []
    risk = "low"

    # Architecture assessment
    insights.append("🏗️ Arquitetura atual (Serverless-first):")
    insights.append("  Frontend: React SPA → GitHub Pages (CDN global, custo zero)")
    insights.append("  API: API Gateway → Lambda (Python) → DynamoDB/S3")
    insights.append("  ML: SageMaker (treino) → Lambda (inferência) → S3 (resultados)")
    insights.append("  Auth: PBKDF2-SHA256 + JWT (stateless, escalável)")
    insights.append("  IaC: AWS CDK (TypeScript) — deploy reproduzível")

    # Scalability assessment
    if total < 100:
        insights.append(f"📈 Escalabilidade: arquitetura atual suporta até ~10.000 usuários sem mudanças. Com {total} usuários, estamos em 0.1% da capacidade.")
    elif total < 1000:
        insights.append(f"📈 Escalabilidade: com {total} usuários, considerar: (1) Cache CloudFront para API, (2) DynamoDB DAX para leituras frequentes.")
    else:
        insights.append(f"📈 Com {total} usuários, implementar: CloudFront cache, Lambda provisioned concurrency, DynamoDB auto-scaling.")
        risk = "medium"

    # Tech debt scoring
    tech_debt = []
    tech_debt.append({"item": "Frontend monolítico (App.tsx grande)", "severity": "média", "effort": "alto", "impact": "Dificulta manutenção e onboarding de devs"})
    tech_debt.append({"item": "Sem testes E2E automatizados no CI", "severity": "alta", "effort": "médio", "impact": "Regressões podem ir para produção"})
    tech_debt.append({"item": "Lambda handlers sem tipagem forte", "severity": "baixa", "effort": "médio", "impact": "Bugs de runtime em edge cases"})
    tech_debt.append({"item": "Sem API versioning", "severity": "média", "effort": "baixo", "impact": "Breaking changes afetam todos os clientes"})
    tech_debt.append({"item": "SES em sandbox", "severity": "alta", "effort": "baixo", "impact": "Não consegue enviar emails para novos usuários"})

    insights.append("🔧 Tech Debt Score: " + str(len(tech_debt)) + " itens identificados:")
    for td in tech_debt[:3]:
        insights.append(f"  [{td['severity'].upper()}] {td['item']} — Esforço: {td['effort']}")

    tasks = []
    tasks.append({
        "title": "Sair do SES Sandbox",
        "priority": "crítica",
        "description": "SES em sandbox impede envio de emails para novos usuários (verificação, reset senha). Solicitar production access via AWS Console → SES → Account Dashboard → Request Production Access. Tempo: 24-48h para aprovação.",
    })
    tasks.append({
        "title": "Implementar cache CloudFront na API",
        "priority": "alta",
        "description": "Recomendações mudam 1x/dia. Cache de 5min no CloudFront reduz invocações Lambda em ~95% e latência de 200ms para 20ms. Custo: ~R$ 5/mês. Implementar via CDK: new CloudFrontWebDistribution.",
    })
    tasks.append({
        "title": "Adicionar testes E2E no CI (Playwright)",
        "priority": "alta",
        "description": "Playwright já está configurado (playwright.config.ts existe). Adicionar step no GitHub Actions: (1) Build, (2) Serve estático, (3) Run Playwright. Cobrir: login, recomendações, backtesting. Tempo: 4h.",
    })
    tasks.append({
        "title": "API versioning (/v1/)",
        "priority": "média",
        "description": "Adicionar prefixo /v1/ nas rotas da API. Permite evolução sem breaking changes. Implementar no CDK com stage variable.",
    })
    tasks.append({
        "title": "Migrar Lambda para ARM64 (Graviton)",
        "priority": "média",
        "description": "Lambda ARM64 é 20% mais barato e 10-15% mais rápido. Mudar architecture: lambda.Architecture.ARM_64 no CDK. Testar compatibilidade de dependências Python.",
    })

    return {"insights": insights, "tasks": tasks, "kpis": kpis, "status": "active", "risk_level": risk}


def _analyze_ciso(u, d, infra, total, ver):
    """CISO: Security posture, OWASP, LGPD, threat model."""
    kpis = {
        "Auth": "PBKDF2 600k ✅",
        "HTTPS": "Enforced ✅",
        "Rate Limit": "Ativo ✅",
        "LGPD": "⚠️ Parcial",
        "WAF": "❌ Ausente",
        "Audit Log": "❌ Ausente",
    }

    insights = []
    risk = "medium"  # Security always has something to improve

    # Security posture
    secure = ["PBKDF2-SHA256 600k iterações (acima do OWASP mínimo de 210k)", "JWT com HMAC-SHA256 + expiração", "Rate limiting + account lockout (anti brute-force)", "HTTPS enforced via API Gateway + GitHub Pages", "API Key obrigatória em todas as rotas", "CORS configurado (Access-Control-Allow-Origin)"]
    gaps = ["WAF (Web Application Firewall) não configurado", "Sem audit log de ações administrativas", "LGPD: sem política de privacidade publicada", "LGPD: sem mecanismo de exclusão de dados (direito ao esquecimento)", "SES sandbox: emails de segurança não chegam a novos usuários", "JWT secret fixo (sem rotação automática)", "Sem Content Security Policy (CSP) no frontend"]

    insights.append("🔒 Postura de segurança — O que está BOM:")
    for s in secure[:4]:
        insights.append(f"  ✅ {s}")

    insights.append("⚠️ Gaps de segurança identificados:")
    for g in gaps[:5]:
        insights.append(f"  ❌ {g}")

    # OWASP Top 10 check
    insights.append("🔍 OWASP Top 10 (2021) — Avaliação:")
    owasp = [
        ("A01 Broken Access Control", "✅ JWT + role-based (admin/user). Verificar: endpoints admin protegidos."),
        ("A02 Cryptographic Failures", "✅ PBKDF2-SHA256, HTTPS. Atenção: JWT secret em env var (ok para Lambda)."),
        ("A03 Injection", "✅ DynamoDB SDK parametrizado. Sem SQL. Baixo risco."),
        ("A04 Insecure Design", "⚠️ Sem rate limit por IP no API Gateway (apenas por API key)."),
        ("A05 Security Misconfiguration", "⚠️ SES sandbox, sem WAF, sem CSP header."),
        ("A07 Auth Failures", "✅ Account lockout, timing-safe comparison, strong hashing."),
    ]
    for code, status in owasp[:4]:
        insights.append(f"  {code}: {status}")

    tasks = []
    tasks.append({
        "title": "Publicar Política de Privacidade (LGPD)",
        "priority": "crítica",
        "description": "LGPD Art. 9: obrigatório informar finalidade, forma e duração do tratamento de dados. Criar página /privacidade com: (1) Dados coletados (email, senha hash, IP), (2) Finalidade (autenticação, recomendações), (3) Retenção (enquanto conta ativa), (4) Direitos do titular (acesso, correção, exclusão). Prazo: 1 semana.",
    })
    tasks.append({
        "title": "Implementar exclusão de dados (LGPD Art. 18)",
        "priority": "crítica",
        "description": "Usuário deve poder solicitar exclusão total de seus dados. Criar endpoint DELETE /auth/me que: (1) Remove registro do DynamoDB, (2) Remove dados de tracking/favoritos, (3) Envia confirmação por email. Adicionar botão 'Excluir minha conta' nas configurações.",
    })
    tasks.append({
        "title": "Ativar AWS WAF no API Gateway",
        "priority": "alta",
        "description": "WAF protege contra: SQL injection, XSS, bad bots, DDoS layer 7. Usar AWS Managed Rules (AWSManagedRulesCommonRuleSet). Custo: ~R$ 25/mês. Implementar via CDK: new wafv2.CfnWebACL.",
    })
    tasks.append({
        "title": "Adicionar Content Security Policy (CSP)",
        "priority": "alta",
        "description": "Adicionar meta tag CSP no index.html: default-src 'self'; script-src 'self'; connect-src 'self' https://og8m3nnj60.execute-api.us-east-1.amazonaws.com; Previne XSS e data exfiltration.",
    })
    tasks.append({
        "title": "Implementar audit log",
        "priority": "média",
        "description": "Registrar em DynamoDB: login, logout, mudança de senha, ações admin, alteração de plano. Campos: userId, action, timestamp, IP, userAgent. Tabela: B3Dashboard-AuditLog. Retenção: 90 dias.",
    })
    tasks.append({
        "title": "Rotação automática de JWT secret",
        "priority": "média",
        "description": "Migrar JWT_SECRET de env var para AWS Secrets Manager com rotação a cada 30 dias. Lambda busca secret no boot (cache 5min). Tokens antigos expiram naturalmente (24h TTL).",
    })

    return {"insights": insights, "tasks": tasks, "kpis": kpis, "status": "active", "risk_level": risk}


# ── Smart Chat Response Builder ──
def _build_agent_response(agent_id: str, agent_def: dict, analysis: dict, directive: str, metrics: dict) -> str:
    """Build a deeply contextual, expert-level response from the agent."""
    u = metrics.get("users", {})
    d = metrics.get("data", {})
    kpis = analysis.get("kpis", {})
    insights = analysis.get("insights", [])
    tasks = analysis.get("tasks", [])
    dl = directive.lower()

    parts = [f"{agent_def['emoji']} {agent_def['name']}"]
    parts.append(f"\nAnalisei sua diretiva: \"{directive[:200]}\"")

    if agent_id == "CPO":
        _chat_cpo(parts, dl, u, d, kpis, tasks)
    elif agent_id == "CFO":
        _chat_cfo(parts, dl, u, d, kpis, tasks)
    elif agent_id == "CMO":
        _chat_cmo(parts, dl, u, d, kpis, tasks)
    elif agent_id == "COO":
        _chat_coo(parts, dl, u, d, kpis, tasks)
    elif agent_id == "CTO":
        _chat_cto(parts, dl, u, d, kpis, tasks)
    elif agent_id == "CISO":
        _chat_ciso(parts, dl, u, d, kpis, tasks)

    parts.append(f"\n🕐 {datetime.now(UTC).strftime('%d/%m/%Y %H:%M')} UTC")
    return "\n".join(parts)


def _chat_cpo(parts, dl, u, d, kpis, tasks):
    total = u.get("total", 0)
    conv = u.get("conversion_rate", 0)
    active = u.get("active_7d", 0)
    ver = u.get("verification_rate", 0)

    if any(w in dl for w in ["feature", "funcionalidade", "roadmap", "prioridade", "próximo", "fazer"]):
        parts.append("\n📋 Roadmap priorizado por ICE Score (Impact × Confidence × Ease):")
        parts.append("")
        parts.append("1. 🔴 PUSH NOTIFICATIONS de sinais fortes (ICE: 504)")
        parts.append("   → Quando score > 4.0, notificar via Web Push. Cria hábito diário.")
        parts.append("   → Benchmark: push aumenta DAU em 20-30%. Esforço: 2 dias.")
        parts.append("")
        parts.append("2. 🔴 TRACK RECORD público (ICE: 420)")
        parts.append(f"   → Com {d.get('total_recommendation_days', 0)} dias de dados, mostrar: 'X% dos sinais de Compra acertaram'.")
        parts.append("   → É a prova social mais poderosa para converter. Esforço: 3 dias.")
        parts.append("")
        parts.append("3. 🟡 EMAIL DIÁRIO com resumo (ICE: 336)")
        parts.append("   → Top 3 sinais às 9h. Mantém engajamento sem abrir o app.")
        parts.append("   → Requer sair do SES sandbox primeiro. Esforço: 1 dia (após SES).")
        parts.append("")
        parts.append("4. 🟡 TRIAL 7 DIAS automático (ICE: 280)")
        parts.append(f"   → Conversão atual: {conv}%. Trial aumenta conversão em 2-3x.")
        parts.append("   → Implementar: flag 'trialEndsAt' no DynamoDB. Esforço: 1 dia.")

    elif any(w in dl for w in ["ux", "usabilidade", "interface", "design", "experiência"]):
        parts.append("\n🎨 Análise de UX — Heurísticas de Nielsen aplicadas:")
        parts.append("")
        parts.append("H1 Visibilidade do status: ✅ Loading skeletons, timestamps de atualização")
        parts.append("H2 Correspondência com mundo real: ✅ Termos financeiros corretos (Compra/Venda/Neutro)")
        parts.append("H3 Controle do usuário: ⚠️ Falta 'desfazer' em ações (ex: remover alerta)")
        parts.append("H4 Consistência: ⚠️ Mix de .js e .tsx, estilos inline vs classes")
        parts.append("H5 Prevenção de erros: ⚠️ Backtesting permite datas inválidas antes de validar")
        parts.append("H7 Flexibilidade: ❌ Sem atalhos de teclado, sem modo compacto de tabela")
        parts.append("H10 Ajuda: ✅ InfoTooltips em todos os KPIs")
        parts.append("")
        parts.append("🔑 Quick wins de UX:")
        parts.append("  1. Adicionar skeleton loading em TODAS as páginas (algumas ainda usam spinner)")
        parts.append("  2. Feedback tátil: vibração no mobile ao seguir ação (navigator.vibrate)")
        parts.append("  3. Empty states com ilustração e CTA (ex: 'Nenhuma posição → Siga sua primeira ação')")
        parts.append("  4. Micro-animações nos KPI cards (counter animation ao carregar)")

    elif any(w in dl for w in ["retenção", "churn", "engajamento", "voltar", "ativo"]):
        retention = round(active / max(total, 1) * 100, 1)
        parts.append(f"\n📊 Análise de Retenção:")
        parts.append(f"  Retenção 7d: {retention}% ({active}/{total} ativos)")
        parts.append(f"  Benchmark SaaS B2C: 40-60% (semana 1)")
        parts.append("")
        parts.append("🧠 Framework de Retenção (Hook Model — Nir Eyal):")
        parts.append("  1. TRIGGER: Email/push diário com sinais → traz de volta")
        parts.append("  2. ACTION: Ver recomendações (baixa fricção, 1 clique)")
        parts.append("  3. REWARD: Descobrir ação com score alto (dopamina)")
        parts.append("  4. INVESTMENT: Seguir ação, criar alerta (aumenta switching cost)")
        parts.append("")
        parts.append("📋 Plano de ação para retenção:")
        parts.append("  Semana 1: Implementar Web Push para sinais fortes")
        parts.append("  Semana 2: Email diário com resumo (após SES production)")
        parts.append("  Semana 3: Streak de dias consecutivos com badge visual")
        parts.append("  Semana 4: Gamificação — 'Você acompanhou 10 ações este mês'")

    elif any(w in dl for w in ["conversão", "upgrade", "pro", "monetização", "pagar"]):
        parts.append(f"\n💰 Análise de Conversão Free→Pro:")
        parts.append(f"  Taxa atual: {conv}% | Benchmark: 3-7% (freemium B2C)")
        parts.append("")
        parts.append("🎯 Estratégias de conversão por prioridade:")
        parts.append("  1. LOSS AVERSION: Mostrar 'Você perdeu R$ X esta semana por não ter Pro'")
        parts.append("     → Calcular retorno das ações de Compra que tinham Stop-Loss/Take-Profit bloqueados")
        parts.append("  2. TRIAL AUTOMÁTICO: 7 dias de Pro no cadastro")
        parts.append("     → Benchmark: 15-25% dos trials convertem")
        parts.append("  3. SOCIAL PROOF: 'X usuários Pro esta semana' (mesmo que X seja pequeno)")
        parts.append("  4. URGÊNCIA: 'Oferta: primeiro mês R$ 19 (expira em 48h)'")
        parts.append("  5. PAYWALL CONTEXTUAL: Quando usuário tenta ver Stop-Loss, mostrar valor real")
        parts.append("     → 'PETR4 Stop-Loss: R$ 38.50 — Desbloqueie para proteger seu investimento'")

    else:
        parts.append(f"\n📊 Situação do produto:")
        parts.append(f"  {total} usuários, {active} ativos (7d), {conv}% conversão, {ver}% verificação")
        parts.append(f"\nVou incorporar essa diretiva no roadmap. Baseado nos dados atuais, recomendo focar em:")
        if conv < 5:
            parts.append(f"  → Conversão (atual {conv}%, target 5%): trial automático + paywall contextual")
        if ver < 80:
            parts.append(f"  → Verificação (atual {ver}%, target 90%): simplificar fluxo, magic link")
        parts.append(f"  → Engajamento: push notifications + email diário")
        if tasks:
            parts.append(f"\n📋 {len(tasks)} tarefas no backlog. Top prioridade: {tasks[0]['title']}")


def _chat_cfo(parts, dl, u, d, kpis, tasks):
    pro = u.get("pro", 0)
    total = u.get("total", 0)
    mrr = pro * 49

    if any(w in dl for w in ["custo", "cost", "gasto", "economia", "reduzir", "otimizar"]):
        parts.append("\n💵 Análise detalhada de custos AWS:")
        parts.append("")
        parts.append("  Serviço          | Custo/mês | % Total | Otimização")
        parts.append("  ─────────────────|───────────|─────────|──────────────")
        parts.append("  SageMaker        | R$ 50     | 55%     | Spot Instances (-90%)")
        parts.append("  Lambda (15)      | R$ 15     | 17%     | ARM64 (-20%)")
        parts.append("  DynamoDB (4)     | R$ 10     | 11%     | Reserved (-50%)")
        parts.append("  API Gateway      | R$ 5      | 6%     | Cache CloudFront")
        parts.append("  S3               | R$ 5      | 6%     | Intelligent-Tiering")
        parts.append("  CloudWatch       | R$ 5      | 6%     | Reduzir retenção logs")
        parts.append("  ─────────────────|───────────|─────────|")
        parts.append("  TOTAL            | R$ 90     | 100%    |")
        parts.append("")
        parts.append("🎯 Se aplicar todas as otimizações: R$ 90 → ~R$ 45/mês (-50%)")
        parts.append("  Prioridade #1: SageMaker Spot = economia de R$ 45/mês sozinho")

    elif any(w in dl for w in ["receita", "revenue", "preço", "pricing", "plano"]):
        parts.append(f"\n📈 Análise de receita e pricing:")
        parts.append(f"  MRR atual: R$ {mrr} ({pro} Pro × R$ 49)")
        parts.append("")
        parts.append("  Cenários de pricing:")
        parts.append(f"  Atual (R$ 49/mês):     MRR = R$ {mrr}")
        parts.append(f"  + Tier Básico (R$ 29): MRR potencial = R$ {mrr + max(1, total//4) * 29} (se 25% free migrar)")
        parts.append(f"  + Anual (R$ 39/mês):   ARR potencial = R$ {pro * 39 * 12} (se 40% Pro migrar)")
        parts.append("")
        parts.append("  📊 Benchmark de pricing fintech B2C Brasil:")
        parts.append("  • Kinvo Pro: R$ 39/mês")
        parts.append("  • Trademap Pro: R$ 49/mês")
        parts.append("  • Profit Pro: R$ 89/mês")
        parts.append(f"  → R$ 49 está bem posicionado. Tier R$ 29 capturaria segmento sensível a preço.")

    else:
        parts.append(f"\n📊 Resumo financeiro:")
        parts.append(f"  MRR: R$ {mrr} | Custo: ~R$ 90/mês | Margem: {round((mrr-90)/max(mrr,1)*100)}%")
        parts.append(f"\nVou analisar o impacto financeiro dessa diretiva.")
        if tasks:
            parts.append(f"📋 Prioridade financeira: {tasks[0]['title']}")


def _chat_cmo(parts, dl, u, d, kpis, tasks):
    conv = u.get("conversion_rate", 0)
    recent = u.get("recent_7d", 0)
    total = u.get("total", 0)

    if any(w in dl for w in ["marketing", "aquisição", "growth", "crescer", "canal", "tráfego"]):
        parts.append("\n📢 Estratégia de aquisição para fintech B3:")
        parts.append("")
        parts.append("🎯 Canais por ROI esperado:")
        parts.append("  1. SEO (ROI: 10x, tempo: 3-6 meses)")
        parts.append("     Keywords: 'melhores ações B3 hoje', 'ranking ações machine learning'")
        parts.append("     Ação: criar /blog com 5 artigos otimizados. Custo: R$ 0.")
        parts.append("  2. Twitter/X Fintwit (ROI: 5x, tempo: 1-2 meses)")
        parts.append("     Ação: bot que posta top 3 sinais diários + resultado de ontem")
        parts.append("     Audiência: 50k+ investidores BR ativos no Fintwit")
        parts.append("  3. Comunidades (ROI: 3x, tempo: 1 mês)")
        parts.append("     r/investimentos (80k), Telegram day trade, Discord investidores")
        parts.append("     Ação: post semanal com análise + link para dashboard")
        parts.append("  4. YouTube Shorts (ROI: 2x, tempo: 2-3 meses)")
        parts.append("     Vídeos de 60s: 'O modelo acertou PETR4 — veja como'")
        parts.append("")
        parts.append(f"  Meta: sair de {round(recent/7, 1)} cadastros/dia para 5/dia em 60 dias")

    elif any(w in dl for w in ["conversão", "upgrade", "funil", "aarrr"]):
        ver = u.get("verification_rate", 0)
        act = u.get("activation_rate", 0)
        parts.append(f"\n📊 Funil AARRR detalhado:")
        parts.append(f"  Aquisição:  100% ({total} cadastros)")
        parts.append(f"  Ativação:   {ver}% (verificaram email)")
        parts.append(f"  Retenção:   {act}% (ativos 7d)")
        parts.append(f"  Receita:    {conv}% (converteram Pro)")
        parts.append(f"  Referral:   ? (não medido)")
        parts.append("")
        parts.append("  🚨 Maior gargalo: " + (
            f"Ativação ({ver}%)" if ver < act else
            f"Retenção ({act}%)" if act < conv * 10 else
            f"Conversão ({conv}%)"
        ))
        parts.append("")
        parts.append("  Plano de otimização do funil:")
        parts.append("  1. Ativação: magic link + uso sem verificação por 24h")
        parts.append("  2. Retenção: push + email diário + streak")
        parts.append("  3. Conversão: trial 7d + loss aversion + urgência")

    else:
        parts.append(f"\n📊 Status marketing: {recent} cadastros/semana, {conv}% conversão")
        parts.append(f"Vou desenvolver estratégia alinhada com essa diretiva.")
        if tasks:
            parts.append(f"📋 Prioridade: {tasks[0]['title']}")


def _chat_coo(parts, dl, u, d, kpis, tasks):
    has_recs = d.get("has_today_recommendations", False)
    rec_days = d.get("total_recommendation_days", 0)

    if any(w in dl for w in ["pipeline", "falha", "erro", "bug", "problema"]):
        parts.append(f"\n⚙️ Status operacional:")
        parts.append(f"  Pipeline hoje: {'✅ OK' if has_recs else '❌ FALHOU'}")
        parts.append("")
        if not has_recs:
            parts.append("🚨 RUNBOOK DE EMERGÊNCIA:")
            parts.append("  1. Verificar CloudWatch Logs → Lambda ingest_quotes")
            parts.append("  2. Testar brapi endpoint: curl https://brapi.dev/api/quote/PETR4")
            parts.append("  3. Verificar SageMaker endpoint: aws sagemaker list-endpoints")
            parts.append("  4. Se dados brapi OK → executar Lambda manualmente:")
            parts.append("     aws lambda invoke --function-name B3TR-ingest-quotes /dev/null")
            parts.append("  5. Se SageMaker down → verificar billing/limits")
        else:
            parts.append("  Pipeline operacional. Verificando componentes:")
            parts.append(f"  • Dados curados: {d.get('curated_months', 0)} meses")
            parts.append(f"  • Recomendações históricas: {rec_days} dias")
            parts.append(f"  • Monitor performance: {'✅' if d.get('performance') else '❌'}")
            parts.append(f"  • Monitor drift: {'✅' if d.get('drift') else '❌'}")

    elif any(w in dl for w in ["automação", "processo", "sla", "monitoramento"]):
        parts.append("\n📋 Mapa de processos e SLAs:")
        parts.append("  Processo              | Frequência | SLA      | Status")
        parts.append("  ─────────────────────|────────────|──────────|────────")
        parts.append(f"  Ingestão de cotações  | 5min       | 99.5%    | {'✅' if has_recs else '❌'}")
        parts.append(f"  Ranking ML            | Diário 18h | 99%      | {'✅' if has_recs else '❌'}")
        parts.append(f"  Monitor performance   | Diário     | 95%      | {'✅' if d.get('performance') else '❌'}")
        parts.append(f"  Monitor drift         | Diário     | 95%      | {'✅' if d.get('drift') else '❌'}")
        parts.append(f"  Backup DynamoDB       | Não config | —        | ❌")
        parts.append("")
        parts.append("  ⚠️ Gaps identificados:")
        parts.append("  1. Sem alertas automáticos de falha (SNS/CloudWatch)")
        parts.append("  2. Sem backup automático do DynamoDB")
        parts.append("  3. Sem runbook documentado para incidentes")

    else:
        parts.append(f"\n⚙️ Operações: pipeline {'OK' if has_recs else 'COM PROBLEMAS'}, {rec_days} dias de dados")
        parts.append(f"Vou avaliar impacto operacional dessa diretiva.")
        if tasks:
            parts.append(f"📋 Prioridade: {tasks[0]['title']}")


def _chat_cto(parts, dl, u, d, kpis, tasks):
    total = u.get("total", 0)

    if any(w in dl for w in ["arquitetura", "escala", "performance", "infra"]):
        parts.append("\n🏗️ Arquitetura e escalabilidade:")
        parts.append("")
        parts.append("  Componente    | Atual           | Limite        | Ação p/ escalar")
        parts.append("  ─────────────|─────────────────|───────────────|────────────────")
        parts.append(f"  Usuários      | {total}            | ~10k          | Nenhuma")
        parts.append("  API Gateway   | On-demand       | 10k req/s     | Throttling")
        parts.append("  Lambda        | 128-256MB       | 1000 conc.    | Provisioned")
        parts.append("  DynamoDB      | On-demand       | Ilimitado     | DAX cache")
        parts.append("  S3            | Standard        | Ilimitado     | Nenhuma")
        parts.append("  Frontend      | GitHub Pages    | CDN global    | Nenhuma")
        parts.append("")
        parts.append(f"  📊 Com {total} usuários, estamos usando <1% da capacidade.")
        parts.append("  Próximo gargalo: Lambda cold starts (quando > 100 concurrent users)")
        parts.append("  Solução: CloudFront cache (95% das requests são GET idênticos)")

    elif any(w in dl for w in ["tech debt", "refactor", "código", "qualidade"]):
        parts.append("\n🔧 Tech Debt Assessment:")
        parts.append("")
        parts.append("  Item                              | Severidade | Esforço | Impacto")
        parts.append("  ─────────────────────────────────|────────────|─────────|────────")
        parts.append("  SES sandbox (emails não chegam)   | 🔴 Alta    | Baixo   | Bloqueia growth")
        parts.append("  Sem testes E2E no CI              | 🔴 Alta    | Médio   | Regressões")
        parts.append("  Frontend monolítico               | 🟡 Média   | Alto    | Manutenção")
        parts.append("  Mix .js/.tsx inconsistente        | 🟡 Média   | Médio   | DX ruim")
        parts.append("  Sem API versioning                | 🟡 Média   | Baixo   | Breaking changes")
        parts.append("  Lambda sem tipagem (Python)       | 🟢 Baixa   | Médio   | Bugs runtime")
        parts.append("")
        parts.append("  🎯 Quick wins (alto impacto, baixo esforço):")
        parts.append("  1. Solicitar SES production access (30 min)")
        parts.append("  2. Adicionar API versioning /v1/ (2h)")
        parts.append("  3. Migrar Lambda para ARM64 (1h, -20% custo)")

    else:
        parts.append(f"\n🔧 Stack: Serverless AWS + React + Python/XGBoost")
        parts.append(f"  {total} usuários, arquitetura suporta 10k+ sem mudanças.")
        parts.append(f"Vou avaliar viabilidade técnica dessa diretiva.")
        if tasks:
            parts.append(f"📋 Prioridade técnica: {tasks[0]['title']}")


def _chat_ciso(parts, dl, u, d, kpis, tasks):
    total = u.get("total", 0)
    ver = u.get("verification_rate", 0)

    if any(w in dl for w in ["segurança", "security", "vulnerabilidade", "ataque", "hack"]):
        parts.append("\n🛡️ Postura de segurança detalhada:")
        parts.append("")
        parts.append("  ✅ Controles implementados:")
        parts.append("  • Auth: PBKDF2-SHA256 600k iter (acima OWASP mínimo 210k)")
        parts.append("  • JWT: HMAC-SHA256, expiração 24h, JTI único")
        parts.append("  • Rate limiting: 5 tentativas/15min por email")
        parts.append("  • Account lockout: 10 falhas → conta bloqueada")
        parts.append("  • HTTPS: enforced em API Gateway + GitHub Pages")
        parts.append("  • API Key: obrigatória em todas as rotas")
        parts.append("  • Timing-safe comparison: previne timing attacks")
        parts.append("")
        parts.append("  ❌ Gaps críticos:")
        parts.append("  • WAF ausente → vulnerável a bots e DDoS L7")
        parts.append("  • CSP ausente → risco de XSS")
        parts.append("  • Audit log ausente → sem rastreabilidade")
        parts.append("  • JWT secret fixo → sem rotação")
        parts.append("")
        parts.append("  🔍 Threat Model (STRIDE):")
        parts.append("  Spoofing: ✅ Mitigado (JWT + PBKDF2)")
        parts.append("  Tampering: ✅ Mitigado (HMAC-SHA256)")
        parts.append("  Repudiation: ❌ Sem audit log")
        parts.append("  Info Disclosure: ⚠️ Error messages podem vazar info")
        parts.append("  DoS: ⚠️ Rate limit por email, mas sem WAF")
        parts.append("  Elevation: ✅ Role-based access (admin/user)")

    elif any(w in dl for w in ["lgpd", "privacidade", "compliance", "dados", "gdpr"]):
        parts.append("\n📜 Checklist LGPD (Lei 13.709/2018):")
        parts.append("")
        parts.append("  Requisito                          | Status | Ação")
        parts.append("  ──────────────────────────────────|────────|──────")
        parts.append("  Art. 7 - Base legal tratamento     | ⚠️     | Definir: consentimento ou legítimo interesse")
        parts.append("  Art. 9 - Política de privacidade   | ❌     | Criar página /privacidade")
        parts.append("  Art. 11 - Dados sensíveis          | ✅     | Não coletamos dados sensíveis")
        parts.append("  Art. 18 - Direitos do titular      | ❌     | Implementar exclusão de dados")
        parts.append("  Art. 37 - Registro de tratamento   | ❌     | Documentar fluxos de dados")
        parts.append("  Art. 41 - DPO (Encarregado)        | ❌     | Designar responsável")
        parts.append("  Art. 46 - Segurança dos dados      | ✅     | PBKDF2 + HTTPS + encryption at rest")
        parts.append("  Art. 48 - Notificação de incidente  | ❌     | Criar processo de resposta")
        parts.append("")
        parts.append(f"  📊 Compliance Score: 3/8 (37.5%) — RISCO ALTO")
        parts.append(f"  Com {total} usuários, LGPD já se aplica. Prioridade máxima.")

    else:
        parts.append(f"\n🛡️ Segurança: auth forte, HTTPS, rate limiting. Gaps: WAF, LGPD, audit log.")
        parts.append(f"Vou avaliar riscos de segurança dessa diretiva.")
        if tasks:
            parts.append(f"📋 Prioridade de segurança: {tasks[0]['title']}")


# ── DynamoDB Persistence ──
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


# ── Handlers ──
def _handle_get_agents(event: dict) -> dict:
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    system_metrics = _get_system_metrics()
    agents_list = []

    for agent_id, agent_def in AGENTS.items():
        state = _get_agent_state(agent_id)
        analysis = _generate_agent_analysis(agent_id, system_metrics, state.get("last_directive", ""))
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
    analysis = _generate_agent_analysis(agent_id, system_metrics, state.get("last_directive", ""))

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


# ── Main Handler ──
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
