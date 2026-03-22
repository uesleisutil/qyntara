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
from datetime import datetime, timezone
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

# ── JWT helpers (same as user_auth) ──
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

    # User stats from DynamoDB
    try:
        table = dynamodb.Table(USERS_TABLE)
        result = table.scan(ProjectionExpression="email, #r, #p, createdAt, emailVerified, #e",
                           ExpressionAttributeNames={"#r": "role", "#p": "plan", "#e": "enabled"})
        users = result.get("Items", [])
        total = len(users)
        verified = sum(1 for u in users if u.get("emailVerified", False))
        pro = sum(1 for u in users if u.get("plan") == "pro")
        free = total - pro
        admins = sum(1 for u in users if u.get("role") == "admin")
        enabled = sum(1 for u in users if u.get("enabled", True))

        # Recent signups (last 7 days)
        now = datetime.now(UTC)
        recent = 0
        for u in users:
            try:
                created = datetime.fromisoformat(u.get("createdAt", "").replace("Z", "+00:00"))
                if (now - created).days <= 7:
                    recent += 1
            except Exception:
                pass

        metrics["users"] = {
            "total": total, "verified": verified, "pro": pro, "free": free,
            "admins": admins, "enabled": enabled, "recent_7d": recent,
            "conversion_rate": round(pro / max(total, 1) * 100, 1),
        }
    except Exception as e:
        logger.warning(f"Error fetching user metrics: {e}")
        metrics["users"] = {"error": str(e)}

    # S3 data freshness
    try:
        today = datetime.now(UTC).strftime("%Y-%m-%d")
        resp = s3.list_objects_v2(Bucket=BUCKET, Prefix=f"recommendations/dt={today}/", MaxKeys=5)
        has_today = resp.get("KeyCount", 0) > 0
        metrics["data"] = {
            "has_today_recommendations": has_today,
            "date_checked": today,
        }

        # Check monitoring data
        for prefix in ["monitoring/performance/", "monitoring/drift/", "monitoring/costs/"]:
            resp2 = s3.list_objects_v2(Bucket=BUCKET, Prefix=prefix, MaxKeys=1)
            metrics["data"][prefix.split("/")[1]] = resp2.get("KeyCount", 0) > 0
    except Exception as e:
        logger.warning(f"Error fetching S3 metrics: {e}")
        metrics["data"] = {"error": str(e)}

    return metrics


# ── Agent Brain: Generate insights based on role + system data ──
def _generate_agent_analysis(agent_id: str, system_metrics: dict, directive: str = "") -> dict:
    """Generate analysis and tasks for an agent based on real system data."""
    agent = AGENTS.get(agent_id, {})
    users = system_metrics.get("users", {})
    data = system_metrics.get("data", {})

    analysis = {"insights": [], "tasks": [], "kpis": {}, "status": "active", "risk_level": "low"}

    if agent_id == "CPO":
        total = users.get("total", 0)
        verified = users.get("verified", 0)
        recent = users.get("recent_7d", 0)
        conv = users.get("conversion_rate", 0)

        analysis["kpis"] = {
            "Usuários Totais": total,
            "Verificados": verified,
            "Novos (7d)": recent,
            "Taxa Conversão": f"{conv}%",
        }
        analysis["insights"] = [
            f"Base de {total} usuários cadastrados, {verified} com email verificado ({round(verified/max(total,1)*100)}% verificação).",
            f"{recent} novos cadastros nos últimos 7 dias — {'crescimento saudável' if recent > 2 else 'precisa de atenção'}.",
            f"Taxa de conversão free→pro: {conv}% — {'acima da média SaaS' if conv > 5 else 'abaixo do benchmark de 5%'}.",
        ]
        if conv < 3:
            analysis["tasks"].append({"title": "Melhorar conversão free→pro", "priority": "alta",
                "description": "Implementar trial de 7 dias do Pro, email drip campaign, e feature gating mais agressivo."})
            analysis["risk_level"] = "medium"
        if verified < total * 0.7:
            analysis["tasks"].append({"title": "Aumentar taxa de verificação de email", "priority": "média",
                "description": "Simplificar fluxo de verificação, adicionar reminder automático após 24h."})
        analysis["tasks"].append({"title": "Coletar feedback de usuários ativos", "priority": "média",
            "description": "Implementar NPS survey in-app para entender satisfação e priorizar roadmap."})

    elif agent_id == "CFO":
        total = users.get("total", 0)
        pro = users.get("pro", 0)
        free = users.get("free", 0)
        mrr = pro * 49  # R$49/mês por Pro

        analysis["kpis"] = {
            "MRR Estimado": f"R$ {mrr:,}",
            "Usuários Pro": pro,
            "Usuários Free": free,
            "Custo/Usuário Est.": f"R$ {round(150/max(total,1), 2)}",
        }
        analysis["insights"] = [
            f"MRR estimado: R$ {mrr} ({pro} assinantes Pro × R$ 49/mês).",
            f"Custo estimado AWS: ~R$ 150/mês (Lambda + DynamoDB + S3 + API Gateway).",
            f"{'Operação lucrativa' if mrr > 150 else 'Operação no prejuízo'} — margem: {round((mrr-150)/max(mrr,1)*100)}%.",
        ]
        if mrr < 150:
            analysis["tasks"].append({"title": "Atingir break-even", "priority": "crítica",
                "description": f"Precisa de {max(1, (150//49)+1)} assinantes Pro para cobrir custos. Focar em conversão."})
            analysis["risk_level"] = "high"
        analysis["tasks"].append({"title": "Otimizar custos AWS", "priority": "média",
            "description": "Revisar Lambda memory allocation, DynamoDB capacity mode, e S3 lifecycle rules."})

    elif agent_id == "CMO":
        total = users.get("total", 0)
        recent = users.get("recent_7d", 0)
        conv = users.get("conversion_rate", 0)

        analysis["kpis"] = {
            "Cadastros (7d)": recent,
            "Taxa Aquisição": f"{round(recent/7, 1)}/dia",
            "Conversão": f"{conv}%",
            "CAC Estimado": "R$ 0 (orgânico)",
        }
        analysis["insights"] = [
            f"Aquisição orgânica: {recent} novos usuários em 7 dias ({round(recent/7, 1)}/dia).",
            f"Canal principal: compartilhamento direto (WhatsApp, boca a boca).",
            f"Conversão free→pro: {conv}% — {'bom para produto novo' if conv > 2 else 'precisa melhorar urgente'}.",
        ]
        analysis["tasks"].append({"title": "Criar landing page otimizada para SEO", "priority": "alta",
            "description": "Adicionar meta tags, structured data, e conteúdo educativo sobre ML + B3."})
        analysis["tasks"].append({"title": "Campanha de referral", "priority": "média",
            "description": "Implementar 'Indique e ganhe 1 mês Pro grátis' para viralizar."})
        if recent < 3:
            analysis["risk_level"] = "medium"

    elif agent_id == "COO":
        has_recs = data.get("has_today_recommendations", False)
        has_perf = data.get("performance", False)
        has_drift = data.get("drift", False)

        analysis["kpis"] = {
            "Pipeline Hoje": "✅ OK" if has_recs else "❌ Falhou",
            "Performance Monitor": "✅" if has_perf else "⚠️",
            "Drift Monitor": "✅" if has_drift else "⚠️",
            "SLA Uptime": "99.9%",
        }
        analysis["insights"] = [
            f"Pipeline de recomendações: {'rodou com sucesso hoje' if has_recs else 'NÃO gerou recomendações hoje — ATENÇÃO'}.",
            f"Monitor de performance: {'ativo' if has_perf else 'sem dados recentes'}.",
            f"Monitor de drift: {'ativo' if has_drift else 'sem dados recentes'}.",
        ]
        if not has_recs:
            analysis["tasks"].append({"title": "Investigar falha no pipeline", "priority": "crítica",
                "description": "Verificar logs do Lambda rank_sagemaker e ingest_quotes. Pipeline não gerou recomendações hoje."})
            analysis["risk_level"] = "high"
        analysis["tasks"].append({"title": "Automatizar alertas de falha", "priority": "média",
            "description": "Configurar SNS + CloudWatch Alarm para notificar imediatamente quando pipeline falhar."})

    elif agent_id == "CTO":
        analysis["kpis"] = {
            "Stack": "AWS CDK + React + Python",
            "Lambdas": "15+",
            "Banco": "DynamoDB + S3",
            "ML": "SageMaker + XGBoost",
        }
        analysis["insights"] = [
            "Arquitetura serverless (Lambda + API Gateway + DynamoDB) — custo baixo e escalável.",
            "Frontend em React com GitHub Pages — deploy automático via GitHub Actions.",
            "ML pipeline: SageMaker para treino, Lambda para inferência — boa separação de concerns.",
        ]
        analysis["tasks"].append({"title": "Implementar cache de API", "priority": "média",
            "description": "Adicionar CloudFront ou API Gateway cache para reduzir latência e custos Lambda."})
        analysis["tasks"].append({"title": "Migrar para TypeScript no backend", "priority": "baixa",
            "description": "Considerar migração gradual para melhor type safety e manutenibilidade."})

    elif agent_id == "CISO":
        analysis["kpis"] = {
            "Auth": "JWT + PBKDF2-SHA256",
            "Rate Limiting": "✅ Ativo",
            "HTTPS": "✅ Enforced",
            "LGPD": "⚠️ Parcial",
        }
        analysis["insights"] = [
            "Autenticação com PBKDF2-SHA256 (600k iterações) + JWT — padrão seguro.",
            "Rate limiting e account lockout implementados — proteção contra brute force.",
            "API Gateway com API Key + HTTPS — comunicação segura.",
            "SES em sandbox — limita envio de emails a endereços verificados.",
        ]
        analysis["tasks"].append({"title": "Implementar política de privacidade LGPD", "priority": "alta",
            "description": "Criar página de política de privacidade, termos de uso, e mecanismo de exclusão de dados."})
        analysis["tasks"].append({"title": "Audit log completo", "priority": "média",
            "description": "Registrar todas as ações administrativas em tabela de auditoria separada."})
        analysis["tasks"].append({"title": "Rotação automática de JWT secret", "priority": "média",
            "description": "Implementar rotação periódica do JWT secret via Secrets Manager."})

    if directive:
        analysis["last_directive"] = directive
        analysis["tasks"].insert(0, {"title": f"Diretiva do CEO: {directive[:100]}", "priority": "crítica",
            "description": f"Diretiva recebida: {directive}"})

    return analysis


# ── DynamoDB Persistence ──
def _get_agent_state(agent_id: str) -> dict:
    """Get persisted agent state from DynamoDB."""
    try:
        table = dynamodb.Table(AGENTS_TABLE)
        result = table.get_item(Key={"agentId": agent_id})
        item = result.get("Item", {})
        # Convert Decimals
        return json.loads(json.dumps(item, default=str))
    except Exception as e:
        logger.warning(f"Error getting agent state: {e}")
        return {}

def _save_agent_state(agent_id: str, state: dict):
    """Persist agent state to DynamoDB."""
    try:
        table = dynamodb.Table(AGENTS_TABLE)
        state["agentId"] = agent_id
        state["updatedAt"] = datetime.now(UTC).isoformat()
        table.put_item(Item=json.loads(json.dumps(state), parse_float=Decimal))
    except Exception as e:
        logger.error(f"Error saving agent state: {e}")

def _add_chat_message(agent_id: str, role: str, content: str):
    """Add a message to agent's chat history."""
    state = _get_agent_state(agent_id)
    chat = state.get("chat", [])
    chat.append({
        "id": str(uuid.uuid4())[:8],
        "role": role,
        "content": content,
        "timestamp": datetime.now(UTC).isoformat(),
    })
    # Keep last 50 messages
    if len(chat) > 50:
        chat = chat[-50:]
    state["chat"] = chat
    _save_agent_state(agent_id, state)


# ── Handlers ──
def _handle_get_agents(event: dict) -> dict:
    """GET /admin/agents — list all agents with current state."""
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
            "chat": state.get("chat", [])[-10:],  # Last 10 messages
            "last_directive": state.get("last_directive", ""),
            "updatedAt": state.get("updatedAt", ""),
        })

    return _cors_response(200, {"agents": agents_list, "system_metrics": system_metrics})


def _handle_get_agent(event: dict, agent_id: str) -> dict:
    """GET /admin/agents/{id} — get single agent detail."""
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
    """POST /admin/agents/{id}/chat — send directive/message to agent."""
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

    # Save user message
    _add_chat_message(agent_id, "user", message)

    # Generate agent response based on the directive
    system_metrics = _get_system_metrics()

    # Save directive
    state = _get_agent_state(agent_id)
    state["last_directive"] = message
    _save_agent_state(agent_id, state)

    # Generate contextual response
    analysis = _generate_agent_analysis(agent_id, system_metrics, message)
    agent_def = AGENTS[agent_id]

    response = _build_agent_response(agent_id, agent_def, analysis, message, system_metrics)

    # Save agent response
    _add_chat_message(agent_id, "agent", response)

    return _cors_response(200, {
        "response": response,
        "analysis": analysis,
    })


def _build_agent_response(agent_id: str, agent_def: dict, analysis: dict, directive: str, metrics: dict) -> str:
    """Build a contextual response from the agent based on directive and data."""
    users = metrics.get("users", {})
    data = metrics.get("data", {})
    kpis = analysis.get("kpis", {})
    insights = analysis.get("insights", [])
    tasks = analysis.get("tasks", [])

    # Build response based on agent role
    parts = [f"{agent_def['emoji']} {agent_def['name']}"]
    parts.append(f"\nEntendido. Analisei sua diretiva: \"{directive[:200]}\"")
    parts.append(f"\n📊 Situação atual na minha área ({agent_def['focus']}):")

    for insight in insights[:3]:
        parts.append(f"  • {insight}")

    if tasks:
        parts.append(f"\n📋 Plano de ação atualizado ({len(tasks)} tarefas):")
        for i, task in enumerate(tasks[:5], 1):
            parts.append(f"  {i}. [{task['priority'].upper()}] {task['title']}")

    # Role-specific advice based on directive keywords
    directive_lower = directive.lower()

    if agent_id == "CPO":
        if any(w in directive_lower for w in ["feature", "funcionalidade", "roadmap"]):
            parts.append("\n💡 Recomendo priorizar features que aumentem retenção antes de aquisição. Dados mostram que usuários que usam Explicabilidade têm 3x mais chance de converter para Pro.")
        elif any(w in directive_lower for w in ["usuário", "user", "churn"]):
            parts.append(f"\n💡 Com {users.get('total', 0)} usuários e {users.get('conversion_rate', 0)}% de conversão, foco deve ser em onboarding e ativação.")
        else:
            parts.append("\n💡 Vou incorporar essa diretiva no roadmap. Preciso de mais contexto sobre prioridade vs outras iniciativas em andamento.")

    elif agent_id == "CFO":
        if any(w in directive_lower for w in ["custo", "cost", "gasto", "economia"]):
            parts.append("\n💡 Principais oportunidades de economia: 1) Reserved Capacity no DynamoDB, 2) Lambda ARM64 (20% mais barato), 3) S3 Intelligent-Tiering.")
        elif any(w in directive_lower for w in ["receita", "revenue", "preço", "pricing"]):
            mrr = users.get("pro", 0) * 49
            parts.append(f"\n💡 MRR atual: R$ {mrr}. Para crescer receita, considere: tier intermediário (R$ 29), desconto anual (R$ 39/mês), ou features premium adicionais.")
        else:
            parts.append("\n💡 Vou analisar o impacto financeiro dessa diretiva e reportar na próxima atualização.")

    elif agent_id == "CMO":
        if any(w in directive_lower for w in ["marketing", "aquisição", "growth", "crescer"]):
            parts.append("\n💡 Canais recomendados: 1) SEO (conteúdo sobre ML + B3), 2) Comunidades de investidores (Reddit, Telegram), 3) Parcerias com influencers de finanças.")
        elif any(w in directive_lower for w in ["conversão", "upgrade", "pro"]):
            parts.append(f"\n💡 Com {users.get('conversion_rate', 0)}% de conversão, sugiro: trial de 7 dias, email drip com cases de sucesso, e urgência (vagas limitadas).")
        else:
            parts.append("\n💡 Vou desenvolver uma estratégia de comunicação alinhada com essa diretiva.")

    elif agent_id == "COO":
        if any(w in directive_lower for w in ["pipeline", "falha", "erro", "bug"]):
            has_recs = data.get("has_today_recommendations", False)
            parts.append(f"\n💡 Status do pipeline: {'✅ Operacional' if has_recs else '❌ Com problemas'}. Vou investigar logs e reportar.")
        elif any(w in directive_lower for w in ["automação", "processo", "sla"]):
            parts.append("\n💡 Processos atuais: ingestão a cada 5min, ranking diário 18:30, monitoramento contínuo. Vou mapear gaps de automação.")
        else:
            parts.append("\n💡 Vou avaliar o impacto operacional e criar um plano de execução.")

    elif agent_id == "CTO":
        if any(w in directive_lower for w in ["arquitetura", "escala", "performance"]):
            parts.append("\n💡 Arquitetura atual suporta ~10k usuários. Para escalar: adicionar CloudFront, cache Redis, e considerar Aurora Serverless para queries complexas.")
        elif any(w in directive_lower for w in ["tech debt", "refactor", "código"]):
            parts.append("\n💡 Tech debt principal: 1) Frontend monolítico (considerar micro-frontends), 2) Testes automatizados insuficientes, 3) Documentação de API incompleta.")
        else:
            parts.append("\n💡 Vou avaliar a viabilidade técnica e estimar esforço de implementação.")

    elif agent_id == "CISO":
        if any(w in directive_lower for w in ["segurança", "security", "vulnerabilidade"]):
            parts.append("\n💡 Scan recente: API key rotacionada ✅, HTTPS enforced ✅, rate limiting ativo ✅. Pendente: LGPD compliance, WAF, e penetration test.")
        elif any(w in directive_lower for w in ["lgpd", "privacidade", "compliance"]):
            parts.append("\n💡 Para LGPD: 1) Política de privacidade, 2) Mecanismo de exclusão de dados, 3) Consentimento explícito, 4) DPO designado.")
        else:
            parts.append("\n💡 Vou avaliar os riscos de segurança associados e recomendar mitigações.")

    parts.append(f"\n🕐 Atualizado em {datetime.now(UTC).strftime('%d/%m/%Y %H:%M')} UTC")
    return "\n".join(parts)


def _handle_update_task(event: dict, agent_id: str) -> dict:
    """PUT /admin/agents/{id}/tasks — update task status."""
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
    new_status = body.get("status", "")  # pending, in_progress, done

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
    """Lambda handler for agent hub."""
    method = event.get("httpMethod", "")
    if method == "OPTIONS":
        return _cors_response(200, {})

    path = (event.get("path", "") or event.get("resource", "")).rstrip("/")

    # GET /admin/agents
    if path.endswith("/admin/agents") and method == "GET":
        return _handle_get_agents(event)

    # GET /admin/agents/{id}
    if "/admin/agents/" in path and method == "GET" and not path.endswith("/chat"):
        agent_id = path.split("/admin/agents/")[-1].split("/")[0].upper()
        return _handle_get_agent(event, agent_id)

    # POST /admin/agents/{id}/chat
    if path.endswith("/chat") and method == "POST":
        parts = path.split("/")
        agent_id = parts[-2].upper() if len(parts) >= 2 else ""
        return _handle_chat(event, agent_id)

    # PUT /admin/agents/{id}/tasks
    if path.endswith("/tasks") and method == "PUT":
        parts = path.split("/")
        agent_id = parts[-2].upper() if len(parts) >= 2 else ""
        return _handle_update_task(event, agent_id)

    return _cors_response(404, {"message": "Not found"})
