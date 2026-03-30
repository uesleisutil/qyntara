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
    allowed = {"tier", "is_active", "is_admin", "name"}
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
    from .storage import load_model_metrics, load_json

    # Métricas salvas pelo admin/update_model_trained
    metrics = load_model_metrics() or {}

    # Métricas do último treino (salvas pelo train_local)
    training = load_json("models/training_metrics.json") or {}

    edge = metrics.get("edge_estimator", {})
    anomaly = metrics.get("anomaly_detector", {})
    sentiment = metrics.get("sentiment_scorer", {})

    # Merge com dados do treino
    if training.get("edge_estimator"):
        t = training["edge_estimator"]
        edge.setdefault("brier_score", t.get("brier_score"))
        edge.setdefault("live_accuracy", t.get("val_accuracy"))
        edge["last_trained"] = edge.get("last_trained") or training.get("trained_at")
    if training.get("anomaly_detector"):
        t = training["anomaly_detector"]
        edge_threshold = t.get("threshold")
        if edge_threshold:
            anomaly["threshold"] = edge_threshold
        anomaly["last_trained"] = anomaly.get("last_trained") or training.get("trained_at")

    trained_count = sum(1 for m in [edge, anomaly] if m.get("last_trained"))

    return {
        "edge_estimator": {
            "version": edge.get("version", "0.1.0"),
            "last_trained": edge.get("last_trained"),
            "brier_score": edge.get("brier_score"),
            "live_accuracy": edge.get("live_accuracy"),
            "total_predictions": edge.get("total_predictions", 0),
            "correct_predictions": edge.get("correct_predictions", 0),
            "train_samples": training.get("n_samples", 0),
        },
        "anomaly_detector": {
            "version": anomaly.get("version", "0.1.0"),
            "last_trained": anomaly.get("last_trained"),
            "threshold": anomaly.get("threshold"),
            "total_detections": anomaly.get("total_detections", 0),
            "true_positives": anomaly.get("true_positives", 0),
            "precision": anomaly.get("precision"),
        },
        "sentiment_scorer": {
            "version": sentiment.get("version", "0.1.0"),
            "method": sentiment.get("method", "keyword"),
            "total_scored": sentiment.get("total_scored", 0),
            "avg_magnitude": sentiment.get("avg_magnitude"),
        },
        "summary": {
            "total_models": 3,
            "models_trained": trained_count,
            "total_predictions": edge.get("total_predictions", 0),
            "last_training": training.get("trained_at"),
        },
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


# ── CloudWatch Metrics ──

def get_cloudwatch_metrics() -> dict:
    """Puxa métricas do CloudWatch pra monitoria."""
    import boto3
    cw = boto3.client("cloudwatch", region_name="us-east-1")
    now = datetime.now(timezone.utc)
    start_24h = now - timedelta(hours=24)
    start_7d = now - timedelta(days=7)

    def _get_metric(namespace: str, metric: str, dimensions: list, stat: str = "Sum",
                    period: int = 3600, start: datetime | None = None) -> list[dict]:
        try:
            resp = cw.get_metric_statistics(
                Namespace=namespace, MetricName=metric,
                Dimensions=dimensions, StartTime=start or start_24h, EndTime=now,
                Period=period, Statistics=[stat],
            )
            points = resp.get("Datapoints", [])
            points.sort(key=lambda p: p["Timestamp"])
            return [{"t": p["Timestamp"].isoformat(), "v": p[stat]} for p in points]
        except Exception as e:
            logger.debug(f"CloudWatch metric {metric}: {e}")
            return []

    lambda_dims = [{"Name": "FunctionName", "Value": "predikt-api"}]

    # Lambda invocations (hourly, 24h)
    invocations = _get_metric("AWS/Lambda", "Invocations", lambda_dims)

    # Lambda errors (hourly, 24h)
    errors = _get_metric("AWS/Lambda", "Errors", lambda_dims)

    # Lambda duration (hourly avg, 24h)
    duration = _get_metric("AWS/Lambda", "Duration", lambda_dims, stat="Average")

    # Lambda throttles
    throttles = _get_metric("AWS/Lambda", "Throttles", lambda_dims)

    # Lambda concurrent executions
    concurrent = _get_metric("AWS/Lambda", "ConcurrentExecutions", lambda_dims, stat="Maximum")

    # DynamoDB — read/write capacity (all tables)
    dynamo_reads = []
    dynamo_writes = []
    for table in ["predikt-users", "predikt-tokens", "predikt-positions", "predikt-notifications", "predikt-tickets"]:
        dims = [{"Name": "TableName", "Value": table}]
        r = _get_metric("AWS/DynamoDB", "ConsumedReadCapacityUnits", dims)
        w = _get_metric("AWS/DynamoDB", "ConsumedWriteCapacityUnits", dims)
        dynamo_reads.extend(r)
        dynamo_writes.extend(w)

    # API Gateway — requests and latency
    api_dims = [{"Name": "ApiId", "Value": "ldt4wmwolk"}]
    api_requests = _get_metric("AWS/ApiGateway", "Count", api_dims)
    api_4xx = _get_metric("AWS/ApiGateway", "4xx", api_dims)
    api_5xx = _get_metric("AWS/ApiGateway", "5xx", api_dims)
    api_latency = _get_metric("AWS/ApiGateway", "Latency", api_dims, stat="Average")
    api_latency_p95 = _get_metric("AWS/ApiGateway", "Latency", api_dims, stat="p95")

    # S3 bucket size
    s3_size = _get_metric(
        "AWS/S3", "BucketSizeBytes",
        [{"Name": "BucketName", "Value": "predikt-data-200093399689"}, {"Name": "StorageType", "Value": "StandardStorage"}],
        stat="Average", period=86400, start=start_7d,
    )

    # Totals
    total_invocations = sum(p["v"] for p in invocations)
    total_errors = sum(p["v"] for p in errors)
    avg_duration = sum(p["v"] for p in duration) / len(duration) if duration else 0

    return {
        "lambda": {
            "invocations": invocations,
            "errors": errors,
            "duration": duration,
            "throttles": throttles,
            "concurrent": concurrent,
            "totals": {
                "invocations_24h": int(total_invocations),
                "errors_24h": int(total_errors),
                "error_rate": round(total_errors / total_invocations * 100, 2) if total_invocations else 0,
                "avg_duration_ms": round(avg_duration, 1),
            },
        },
        "api": {
            "requests": api_requests,
            "errors_4xx": api_4xx,
            "errors_5xx": api_5xx,
            "latency_avg": api_latency,
            "latency_p95": api_latency_p95,
        },
        "dynamodb": {
            "reads": dynamo_reads,
            "writes": dynamo_writes,
        },
        "s3": {
            "size_bytes": s3_size,
        },
    }


def get_service_health() -> dict:
    """Verifica status dos serviços externos."""
    import httpx
    results = {}

    # Polymarket
    try:
        r = httpx.get("https://gamma-api.polymarket.com/markets?limit=1", timeout=5)
        results["polymarket"] = {"status": "up" if r.status_code == 200 else "degraded", "latency_ms": int(r.elapsed.total_seconds() * 1000)}
    except Exception:
        results["polymarket"] = {"status": "down", "latency_ms": 0}

    # Kalshi
    try:
        r = httpx.get("https://api.elections.kalshi.com/trade-api/v2/events?limit=1", timeout=5)
        results["kalshi"] = {"status": "up" if r.status_code == 200 else "degraded", "latency_ms": int(r.elapsed.total_seconds() * 1000)}
    except Exception:
        results["kalshi"] = {"status": "down", "latency_ms": 0}

    # SMTP
    try:
        import smtplib
        s = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=5)
        s.quit()
        results["smtp"] = {"status": "up", "latency_ms": 0}
    except Exception:
        results["smtp"] = {"status": "down", "latency_ms": 0}

    return results


def get_training_history() -> list[dict]:
    """Retorna histórico de treinos dos modelos."""
    from .storage import load_json
    # Carregar métricas de treino
    metrics = load_json("models/training_metrics.json")
    if not metrics:
        return []

    history = []
    if metrics.get("trained_at"):
        history.append({
            "date": metrics["trained_at"],
            "edge_brier": metrics.get("edge_estimator", {}).get("brier_score"),
            "edge_accuracy": metrics.get("edge_estimator", {}).get("val_accuracy"),
            "anomaly_threshold": metrics.get("anomaly_detector", {}).get("threshold"),
            "n_samples": metrics.get("n_samples", 0),
        })

    # Carregar histórico acumulado
    all_history = load_json("models/training_history.json") or []
    return all_history + history


def get_signal_distribution() -> dict:
    """Distribuição dos sinais gerados."""
    from .storage import load_json
    signals = load_json("cache/signals.json") or []

    by_direction = {"YES": 0, "NO": 0, "NEUTRAL": 0}
    by_type = {}
    by_category = {}
    score_ranges = {"0-25": 0, "25-50": 0, "50-75": 0, "75-100": 0}

    for s in signals:
        d = s.get("direction", "NEUTRAL")
        by_direction[d] = by_direction.get(d, 0) + 1

        t = s.get("signal_type", "unknown")
        by_type[t] = by_type.get(t, 0) + 1

        c = s.get("category", "Outros")
        by_category[c] = by_category.get(c, 0) + 1

        score = s.get("signal_score", 0) * 100
        if score < 25:
            score_ranges["0-25"] += 1
        elif score < 50:
            score_ranges["25-50"] += 1
        elif score < 75:
            score_ranges["50-75"] += 1
        else:
            score_ranges["75-100"] += 1

    return {
        "total": len(signals),
        "by_direction": by_direction,
        "by_type": by_type,
        "by_category": by_category,
        "by_score_range": score_ranges,
    }
