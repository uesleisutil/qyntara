"""
Notification system — alertas via WebSocket push + in-app.

Tipos de notificação:
- signal: novo sinal do Edge Estimator
- arbitrage: nova oportunidade de arbitragem
- anomaly: movimento anômalo detectado (smart money)
- portfolio: posição atingiu threshold
- system: manutenção, updates
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from .database import get_db

logger = logging.getLogger(__name__)

NOTIFICATIONS_SCHEMA = """
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    data TEXT DEFAULT '{}',
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
"""


def init_notifications_db():
    with get_db() as db:
        db.executescript(NOTIFICATIONS_SCHEMA)


def create_notification(user_id: str, ntype: str, title: str, body: str = "", data: dict | None = None) -> dict:
    nid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    import json
    with get_db() as db:
        db.execute(
            "INSERT INTO notifications (id, user_id, type, title, body, data, created_at) VALUES (?,?,?,?,?,?,?)",
            (nid, user_id, ntype, title, body, json.dumps(data or {}), now),
        )
    return {"id": nid, "type": ntype, "title": title, "body": body, "created_at": now}


def get_user_notifications(user_id: str, limit: int = 50, unread_only: bool = False) -> list[dict]:
    with get_db() as db:
        if unread_only:
            rows = db.execute(
                "SELECT * FROM notifications WHERE user_id = ? AND read = 0 ORDER BY created_at DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
    return [dict(r) for r in rows]


def mark_read(notification_id: str, user_id: str):
    with get_db() as db:
        db.execute("UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?", (notification_id, user_id))


def mark_all_read(user_id: str):
    with get_db() as db:
        db.execute("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0", (user_id,))


def get_unread_count(user_id: str) -> int:
    with get_db() as db:
        return db.execute(
            "SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read = 0", (user_id,)
        ).fetchone()[0]


# ── Broadcast helpers ──

def notify_signal(signal: dict):
    """Cria notificação de sinal pra todos os users Pro+."""
    with get_db() as db:
        pro_users = db.execute(
            "SELECT id FROM users WHERE tier IN ('pro', 'quant', 'enterprise') AND is_active = 1"
        ).fetchall()
    for row in pro_users:
        create_notification(
            row["id"], "signal",
            f"New signal: {signal.get('direction', '?')} on {signal.get('question', '')[:50]}",
            f"Score: {signal.get('signal_score', 0):.0%}",
            signal,
        )


def notify_anomaly(anomaly: dict):
    """Cria notificação de anomalia pra users Quant+."""
    with get_db() as db:
        quant_users = db.execute(
            "SELECT id FROM users WHERE tier IN ('quant', 'enterprise') AND is_active = 1"
        ).fetchall()
    for row in quant_users:
        create_notification(
            row["id"], "anomaly",
            f"Smart money alert: {anomaly.get('market_id', '')}",
            f"Anomaly score: {anomaly.get('score', 0):.4f}",
            anomaly,
        )
