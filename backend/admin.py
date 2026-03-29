"""
Admin endpoints — gestão de usuários, métricas de modelo e infra.

Protegido por role admin (campo is_admin no user).
"""

from __future__ import annotations

import logging
import os
import platform
from datetime import datetime, timezone, timedelta

import psutil  # type: ignore

from .config import settings
from .database import get_db, DB_PATH

logger = logging.getLogger(__name__)

# ── User Management ──


def list_users(
    page: int = 1, per_page: int = 50, search: str = "", tier: str = ""
) -> dict:
    offset = (page - 1) * per_page
    conditions = ["1=1"]
    params: list = []

    if search:
        conditions.append("(email LIKE ? OR name LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])
    if tier:
        conditions.append("tier = ?")
        params.append(tier)

    where = " AND ".join(conditions)

    with get_db() as db:
        total = db.execute(f"SELECT COUNT(*) FROM users WHERE {where}", params).fetchone()[0]
        rows = db.execute(
            f"""SELECT id, email, name, tier, stripe_customer_id, stripe_subscription_id,
                       created_at, updated_at, is_active, email_verified
                FROM users WHERE {where}
                ORDER BY created_at DESC LIMIT ? OFFSET ?""",
            params + [per_page, offset],
        ).fetchall()

    users = [dict(r) for r in rows]
    return {"users": users, "total": total, "page": page, "per_page": per_page}


def get_user_detail(user_id: str) -> dict | None:
    with get_db() as db:
        row = db.execute(
            """SELECT id, email, name, tier, stripe_customer_id, stripe_subscription_id,
                      created_at, updated_at, is_active, email_verified
               FROM users WHERE id = ?""",
            (user_id,),
        ).fetchone()
        if not row:
            return None
        user = dict(row)

        # Contar refresh tokens ativos
        tokens = db.execute(
            "SELECT COUNT(*) FROM refresh_tokens WHERE user_id = ? AND revoked = 0",
            (user_id,),
        ).fetchone()[0]
        user["active_sessions"] = tokens

    return user


def update_user_admin(user_id: str, updates: dict) -> bool:
    allowed = {"tier", "is_active", "name"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        return False

    now = datetime.now(timezone.utc).isoformat()
    sets = ", ".join(f"{k} = ?" for k in filtered)
    values = list(filtered.values()) + [now, user_id]

    with get_db() as db:
        db.execute(f"UPDATE users SET {sets}, updated_at = ? WHERE id = ?", values)
    return True


def get_user_stats() -> dict:
    with get_db() as db:
        total = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        by_tier = db.execute(
            "SELECT tier, COUNT(*) as cnt FROM users GROUP BY tier"
        ).fetchall()
        active = db.execute(
            "SELECT COUNT(*) FROM users WHERE is_active = 1"
        ).fetchone()[0]

        # Novos últimos 7 dias
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        new_7d = db.execute(
            "SELECT COUNT(*) FROM users WHERE created_at > ?", (week_ago,)
        ).fetchone()[0]

        # Novos últimos 30 dias
        month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        new_30d = db.execute(
            "SELECT COUNT(*) FROM users WHERE created_at > ?", (month_ago,)
        ).fetchone()[0]

        # Signups por dia (últimos 30 dias)
        daily = db.execute(
            """SELECT DATE(created_at) as day, COUNT(*) as cnt
               FROM users WHERE created_at > ?
               GROUP BY DATE(created_at) ORDER BY day""",
            (month_ago,),
        ).fetchall()

    return {
        "total_users": total,
        "active_users": active,
        "by_tier": {r["tier"]: r["cnt"] for r in by_tier},
        "new_7d": new_7d,
        "new_30d": new_30d,
        "daily_signups": [{"date": r["day"], "count": r["cnt"]} for r in daily],
    }


# ── Model Performance ──

# In-memory store para métricas do modelo (populado pelo pipeline de treino)
_model_metrics: dict = {
    "edge_estimator": {
        "version": "0.1.0",
        "last_trained": None,
        "brier_score": None,
        "accuracy": None,
        "total_predictions": 0,
        "correct_predictions": 0,
        "calibration_data": [],  # [{predicted, actual, bucket}]
        "daily_performance": [],  # [{date, accuracy, brier, predictions}]
    },
    "anomaly_detector": {
        "version": "0.1.0",
        "last_trained": None,
        "threshold": None,
        "total_detections": 0,
        "true_positives": 0,
        "false_positives": 0,
        "precision": None,
    },
    "sentiment_scorer": {
        "version": "0.1.0",
        "method": "keyword",
        "total_scored": 0,
        "avg_magnitude": 0.0,
    },
}


def get_model_performance() -> dict:
    """Retorna métricas de performance de todos os modelos."""
    edge = _model_metrics["edge_estimator"]
    total = edge["total_predictions"]
    correct = edge["correct_predictions"]

    return {
        "edge_estimator": {
            **edge,
            "live_accuracy": correct / total if total > 0 else None,
        },
        "anomaly_detector": _model_metrics["anomaly_detector"],
        "sentiment_scorer": _model_metrics["sentiment_scorer"],
        "summary": {
            "total_models": 3,
            "models_trained": sum(
                1 for m in _model_metrics.values() if m.get("last_trained")
            ),
            "total_predictions": total,
        },
    }


def record_prediction(predicted_prob: float, actual_outcome: bool):
    """Registra uma predição resolvida para tracking de performance."""
    edge = _model_metrics["edge_estimator"]
    edge["total_predictions"] += 1
    predicted_yes = predicted_prob > 0.5
    if predicted_yes == actual_outcome:
        edge["correct_predictions"] += 1

    # Calibration bucket (0-10%, 10-20%, ..., 90-100%)
    bucket = min(int(predicted_prob * 10), 9)
    edge["calibration_data"].append({
        "predicted": round(predicted_prob, 3),
        "actual": 1 if actual_outcome else 0,
        "bucket": bucket,
    })
    # Manter só últimos 1000
    if len(edge["calibration_data"]) > 1000:
        edge["calibration_data"] = edge["calibration_data"][-1000:]


def update_model_trained(model_name: str, metrics: dict):
    """Atualiza métricas após treino de um modelo."""
    if model_name in _model_metrics:
        _model_metrics[model_name].update(metrics)
        _model_metrics[model_name]["last_trained"] = datetime.now(timezone.utc).isoformat()


# ── Infrastructure Monitoring ──


def get_infra_status() -> dict:
    """Coleta métricas de infraestrutura do servidor."""
    try:
        cpu_percent = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        # Processos Python
        py_procs = []
        for p in psutil.process_iter(["pid", "name", "memory_percent", "cpu_percent"]):
            if "python" in (p.info.get("name") or "").lower():
                py_procs.append(p.info)

        # Network
        net = psutil.net_io_counters()

        # Uptime
        boot = datetime.fromtimestamp(psutil.boot_time(), tz=timezone.utc)
        uptime_seconds = (datetime.now(timezone.utc) - boot).total_seconds()

    except Exception as e:
        logger.warning(f"psutil error: {e}")
        cpu_percent = 0
        mem = None
        disk = None
        py_procs = []
        net = None
        uptime_seconds = 0

    # DB size
    db_size = 0
    try:
        db_size = os.path.getsize(DB_PATH)
    except Exception:
        pass

    return {
        "server": {
            "platform": platform.platform(),
            "python": platform.python_version(),
            "hostname": platform.node(),
            "uptime_hours": round(uptime_seconds / 3600, 1),
        },
        "cpu": {
            "percent": cpu_percent,
            "cores": psutil.cpu_count() if hasattr(psutil, "cpu_count") else 0,
        },
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
        "database": {
            "path": DB_PATH,
            "size_mb": round(db_size / 1e6, 2),
        },
        "python_processes": py_procs[:10],
        "api": {
            "env": settings.APP_ENV,
            "stripe_configured": bool(settings.STRIPE_SECRET_KEY),
            "jwt_configured": len(settings.JWT_SECRET) >= 32,
        },
    }
