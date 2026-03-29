"""
Admin endpoints — gestão de usuários, métricas de modelo e infra.
"""

from __future__ import annotations

import logging
import platform
from datetime import datetime, timezone, timedelta

import psutil  # type: ignore

from .config import settings
from .database import _table, USERS_TABLE

logger = logging.getLogger(__name__)


# ── User Management ──

def list_users(page: int = 1, per_page: int = 50, search: str = "", tier: str = "") -> dict:
    table = _table(USERS_TABLE)
    resp = table.scan()
    items = resp.get("Items", [])

    # Filtrar
    if search:
        q = search.lower()
        items = [u for u in items if q in u.get("email", "").lower() or q in u.get("name", "").lower()]
    if tier:
        items = [u for u in items if u.get("tier") == tier]

    # Ordenar por data de criação (mais recente primeiro)
    items.sort(key=lambda u: u.get("created_at", ""), reverse=True)

    total = len(items)
    offset = (page - 1) * per_page
    page_items = items[offset:offset + per_page]

    # Remover password_hash
    safe = [{k: v for k, v in u.items() if k != "password_hash"} for u in page_items]
    return {"users": safe, "total": total, "page": page, "per_page": per_page}


def get_user_detail(user_id: str) -> dict | None:
    from .database import get_user_by_id
    user = get_user_by_id(user_id)
    if not user:
        return None
    return {k: v for k, v in user.items() if k != "password_hash"}


def update_user_admin(user_id: str, updates: dict) -> bool:
    allowed = {"tier", "is_active", "name"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        return False

    now = datetime.now(timezone.utc).isoformat()
    expr_parts = ["updated_at = :u"]
    values: dict = {":u": now}
    for i, (k, v) in enumerate(filtered.items()):
        expr_parts.append(f"{k} = :v{i}")
        values[f":v{i}"] = v

    _table(USERS_TABLE).update_item(
        Key={"id": user_id},
        UpdateExpression="SET " + ", ".join(expr_parts),
        ExpressionAttributeValues=values,
    )
    return True


def get_user_stats() -> dict:
    table = _table(USERS_TABLE)
    resp = table.scan()
    items = resp.get("Items", [])

    total = len(items)
    active = sum(1 for u in items if u.get("is_active"))
    by_tier: dict[str, int] = {}
    for u in items:
        t = u.get("tier", "free")
        by_tier[t] = by_tier.get(t, 0) + 1

    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    new_7d = sum(1 for u in items if u.get("created_at", "") > week_ago)
    new_30d = sum(1 for u in items if u.get("created_at", "") > month_ago)

    # Daily signups (últimos 30 dias)
    daily: dict[str, int] = {}
    for u in items:
        ca = u.get("created_at", "")
        if ca > month_ago:
            day = ca[:10]
            daily[day] = daily.get(day, 0) + 1

    return {
        "total_users": total,
        "active_users": active,
        "by_tier": by_tier,
        "new_7d": new_7d,
        "new_30d": new_30d,
        "daily_signups": [{"date": d, "count": c} for d, c in sorted(daily.items())],
    }


# ── Model Performance ──

def get_model_performance() -> dict:
    from .storage import load_model_metrics
    metrics = load_model_metrics()
    return metrics or {
        "edge_estimator": {"version": "0.1.0", "last_trained": None, "brier_score": None, "accuracy": None, "total_predictions": 0},
        "anomaly_detector": {"version": "0.1.0", "last_trained": None, "threshold": None, "total_detections": 0},
        "sentiment_scorer": {"version": "0.1.0", "method": "keyword", "total_scored": 0},
        "summary": {"total_models": 3, "models_trained": 0, "total_predictions": 0},
    }


def update_model_trained(model_name: str, metrics: dict):
    from .storage import load_model_metrics, save_model_metrics
    all_metrics = load_model_metrics() or {}
    if model_name not in all_metrics:
        all_metrics[model_name] = {}
    all_metrics[model_name].update(metrics)
    all_metrics[model_name]["last_trained"] = datetime.now(timezone.utc).isoformat()
    save_model_metrics(all_metrics)


# ── Infrastructure Monitoring ──

def get_infra_status() -> dict:
    try:
        cpu_percent = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        net = psutil.net_io_counters()
        boot = datetime.fromtimestamp(psutil.boot_time(), tz=timezone.utc)
        uptime_seconds = (datetime.now(timezone.utc) - boot).total_seconds()
    except Exception:
        cpu_percent = 0
        mem = disk = net = None
        uptime_seconds = 0

    return {
        "server": {
            "platform": platform.platform(),
            "python": platform.python_version(),
            "hostname": platform.node(),
            "uptime_hours": round(uptime_seconds / 3600, 1),
        },
        "cpu": {"percent": cpu_percent, "cores": psutil.cpu_count() if hasattr(psutil, "cpu_count") else 0},
        "memory": {
            "total_gb": round(mem.total / 1e9, 1) if mem else 0,
            "used_gb": round(mem.used / 1e9, 1) if mem else 0,
            "percent": mem.percent if mem else 0,
        },
        "disk": {
            "total_gb": round(disk.total / 1e9, 1) if disk else 0,
            "used_gb": round(disk.used / 1e9, 1) if disk else 0,
            "percent": disk.percent if disk else 0,
        },
        "network": {
            "bytes_sent_mb": round(net.bytes_sent / 1e6, 1) if net else 0,
            "bytes_recv_mb": round(net.bytes_recv / 1e6, 1) if net else 0,
        },
        "database": {"type": "DynamoDB", "tables": ["predikt-users", "predikt-tokens"]},
        "storage": {"type": "S3", "bucket": "predikt-data-200093399689"},
        "api": {
            "env": settings.APP_ENV,
            "stripe_configured": bool(settings.STRIPE_SECRET_KEY),
            "jwt_configured": len(settings.JWT_SECRET) >= 32,
            "smtp_configured": bool(settings.SMTP_HOST),
        },
    }
