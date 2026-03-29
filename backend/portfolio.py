"""
Portfolio Tracker — gerencia posições do usuário e calcula risco.

Posições são armazenadas no SQLite (manual input ou API key futura).
Calcula: exposição total, correlação, risco de ruína, cenários.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone


from .database import get_db

logger = logging.getLogger(__name__)

# ── DB Schema (adicionar na init_db) ──

PORTFOLIO_SCHEMA = """
CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'polymarket',
    question TEXT NOT NULL DEFAULT '',
    side TEXT NOT NULL DEFAULT 'YES',
    shares REAL NOT NULL DEFAULT 0,
    avg_price REAL NOT NULL DEFAULT 0,
    current_price REAL DEFAULT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    closed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
"""


def init_portfolio_db():
    with get_db() as db:
        db.executescript(PORTFOLIO_SCHEMA)


# ── CRUD ──

def add_position(user_id: str, market_id: str, source: str, question: str,
                 side: str, shares: float, avg_price: float) -> dict:
    pos_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as db:
        db.execute(
            """INSERT INTO positions (id, user_id, market_id, source, question, side, shares, avg_price, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (pos_id, user_id, market_id, source, question, side.upper(), shares, avg_price, now, now),
        )
    return get_position(pos_id)


def get_position(pos_id: str) -> dict | None:
    with get_db() as db:
        row = db.execute("SELECT * FROM positions WHERE id = ?", (pos_id,)).fetchone()
    return dict(row) if row else None


def get_user_positions(user_id: str, include_closed: bool = False) -> list[dict]:
    with get_db() as db:
        if include_closed:
            rows = db.execute(
                "SELECT * FROM positions WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM positions WHERE user_id = ? AND closed = 0 ORDER BY created_at DESC", (user_id,)
            ).fetchall()
    return [dict(r) for r in rows]


def update_position(pos_id: str, user_id: str, updates: dict) -> bool:
    allowed = {"shares", "avg_price", "current_price", "closed"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        return False
    now = datetime.now(timezone.utc).isoformat()
    sets = ", ".join(f"{k} = ?" for k in filtered)
    values = list(filtered.values()) + [now, pos_id, user_id]
    with get_db() as db:
        db.execute(f"UPDATE positions SET {sets}, updated_at = ? WHERE id = ? AND user_id = ?", values)
    return True


def delete_position(pos_id: str, user_id: str) -> bool:
    with get_db() as db:
        db.execute("DELETE FROM positions WHERE id = ? AND user_id = ?", (pos_id, user_id))
    return True


# ── Risk Analysis ──

def calculate_portfolio_risk(positions: list[dict], market_cache: list[dict] | None = None) -> dict:
    """
    Calcula métricas de risco do portfolio.

    Returns:
    - total_invested: valor total investido
    - total_current: valor atual estimado
    - pnl: profit/loss
    - pnl_pct: P&L percentual
    - max_loss: perda máxima possível (todas resolvem contra)
    - max_gain: ganho máximo possível (todas resolvem a favor)
    - concentration: % do portfolio no maior mercado
    - positions_count: número de posições abertas
    """
    if not positions:
        return {
            "total_invested": 0, "total_current": 0, "pnl": 0, "pnl_pct": 0,
            "max_loss": 0, "max_gain": 0, "concentration": 0, "positions_count": 0,
        }

    # Atualizar current_price do cache se disponível
    if market_cache:
        price_map = {m["market_id"]: m["yes_price"] for m in market_cache}
        for pos in positions:
            if pos["current_price"] is None and pos["market_id"] in price_map:
                mp = price_map[pos["market_id"]]
                pos["current_price"] = mp if pos["side"] == "YES" else 1.0 - mp

    invested_values = []
    current_values = []
    max_losses = []
    max_gains = []

    for pos in positions:
        invested = pos["shares"] * pos["avg_price"]
        invested_values.append(invested)

        cp = pos.get("current_price") or pos["avg_price"]
        current = pos["shares"] * cp
        current_values.append(current)

        # Max loss: mercado resolve contra (YES→0, NO→0)
        max_losses.append(invested)
        # Max gain: mercado resolve a favor (YES→1, NO→1)
        max_gains.append(pos["shares"] * 1.0 - invested)

    total_invested = sum(invested_values)
    total_current = sum(current_values)
    pnl = total_current - total_invested

    # Concentração: maior posição / total
    concentration = max(invested_values) / total_invested if total_invested > 0 else 0

    return {
        "total_invested": round(total_invested, 2),
        "total_current": round(total_current, 2),
        "pnl": round(pnl, 2),
        "pnl_pct": round(pnl / total_invested * 100, 2) if total_invested > 0 else 0,
        "max_loss": round(sum(max_losses), 2),
        "max_gain": round(sum(max_gains), 2),
        "concentration": round(concentration * 100, 1),
        "positions_count": len(positions),
    }


def simulate_scenarios(positions: list[dict]) -> list[dict]:
    """
    Simula cenários: o que acontece se cada mercado resolve YES ou NO.
    Retorna lista de cenários com P&L estimado.
    """
    if not positions:
        return []

    scenarios = []
    total_invested = sum(p["shares"] * p["avg_price"] for p in positions)

    # Cenário 1: Tudo resolve YES
    pnl_all_yes = sum(
        p["shares"] * (1.0 if p["side"] == "YES" else 0.0) - p["shares"] * p["avg_price"]
        for p in positions
    )
    scenarios.append({"name": "All YES", "pnl": round(pnl_all_yes, 2),
                      "pnl_pct": round(pnl_all_yes / total_invested * 100, 2) if total_invested else 0})

    # Cenário 2: Tudo resolve NO
    pnl_all_no = sum(
        p["shares"] * (0.0 if p["side"] == "YES" else 1.0) - p["shares"] * p["avg_price"]
        for p in positions
    )
    scenarios.append({"name": "All NO", "pnl": round(pnl_all_no, 2),
                      "pnl_pct": round(pnl_all_no / total_invested * 100, 2) if total_invested else 0})

    # Cenário 3: Cada posição individual resolve a favor
    for pos in positions[:10]:  # Limitar a 10
        pnl = pos["shares"] * 1.0 - pos["shares"] * pos["avg_price"]
        q = pos["question"][:60] + "..." if len(pos["question"]) > 60 else pos["question"]
        scenarios.append({
            "name": f"{q} → {pos['side']}",
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl / (pos["shares"] * pos["avg_price"]) * 100, 2) if pos["avg_price"] > 0 else 0,
        })

    return scenarios
