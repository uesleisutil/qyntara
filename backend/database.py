"""
Database layer — SQLite para MVP.

Tabelas:
- users: auth + perfil
- refresh_tokens: tokens de refresh ativos
- subscriptions: tier do Stripe
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any

from .config import settings

logger = logging.getLogger(__name__)

DB_PATH = settings.DATABASE_URL.replace("sqlite:///", "")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    conn = _get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Cria tabelas se não existirem."""
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                tier TEXT NOT NULL DEFAULT 'free',
                stripe_customer_id TEXT,
                stripe_subscription_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                email_verified INTEGER NOT NULL DEFAULT 0,
                is_admin INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT UNIQUE NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                revoked INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
        """)
    logger.info("Database initialized")


# ── User CRUD ──

def create_user(email: str, password_hash: str, name: str = "") -> dict:
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute(
            "INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?,?,?,?,?,?)",
            (user_id, email.lower().strip(), password_hash, name, now, now),
        )
    return get_user_by_id(user_id)


def get_user_by_email(email: str) -> dict | None:
    with get_db() as db:
        row = db.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),)).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: str) -> dict | None:
    with get_db() as db:
        row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


def update_user_tier(user_id: str, tier: str, stripe_sub_id: str | None = None):
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute(
            "UPDATE users SET tier=?, stripe_subscription_id=?, updated_at=? WHERE id=?",
            (tier, stripe_sub_id, now, user_id),
        )


def update_user_stripe_customer(user_id: str, customer_id: str):
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute(
            "UPDATE users SET stripe_customer_id=?, updated_at=? WHERE id=?",
            (customer_id, now, user_id),
        )


# ── Refresh Tokens ──

def store_refresh_token(user_id: str, token_hash: str, expires_at: str):
    token_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        # Limitar a 5 tokens ativos por usuário (segurança)
        db.execute(
            """DELETE FROM refresh_tokens WHERE user_id = ? AND id NOT IN
               (SELECT id FROM refresh_tokens WHERE user_id = ? AND revoked = 0
                ORDER BY created_at DESC LIMIT 4)""",
            (user_id, user_id),
        )
        db.execute(
            "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?,?,?,?,?)",
            (token_id, user_id, token_hash, expires_at, now),
        )


def verify_refresh_token(token_hash: str) -> dict | None:
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0", (token_hash,)
        ).fetchone()
    if not row:
        return None
    token = dict(row)
    if datetime.fromisoformat(token["expires_at"]) < datetime.now(timezone.utc):
        return None
    return token


def revoke_refresh_token(token_hash: str):
    with get_db() as db:
        db.execute("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?", (token_hash,))


def revoke_all_user_tokens(user_id: str):
    with get_db() as db:
        db.execute("UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?", (user_id,))
