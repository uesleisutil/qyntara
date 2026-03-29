"""
Portfolio Tracker — DynamoDB storage.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key

from .database import _get_dynamodb

logger = logging.getLogger(__name__)

TABLE_NAME = "predikt-positions"


def _table():
    return _get_dynamodb().Table(TABLE_NAME)


def init_portfolio_db():
    client = boto3.client("dynamodb", region_name="us-east-1")
    existing = client.list_tables()["TableNames"]
    if TABLE_NAME not in existing:
        client.create_table(
            TableName=TABLE_NAME,
            KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
            AttributeDefinitions=[
                {"AttributeName": "id", "AttributeType": "S"},
                {"AttributeName": "user_id", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[{
                "IndexName": "user-index",
                "KeySchema": [{"AttributeName": "user_id", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            }],
            BillingMode="PAY_PER_REQUEST",
        )
        logger.info(f"Created table {TABLE_NAME}")


def add_position(user_id: str, market_id: str, source: str, question: str,
                 side: str, shares: float, avg_price: float) -> dict:
    pos_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": pos_id, "user_id": user_id, "market_id": market_id,
        "source": source, "question": question, "side": side.upper(),
        "shares": str(shares), "avg_price": str(avg_price),
        "current_price": None, "created_at": now, "updated_at": now, "closed": False,
    }
    _table().put_item(Item=item)
    return item


def get_position(pos_id: str) -> dict | None:
    resp = _table().get_item(Key={"id": pos_id})
    return resp.get("Item")


def get_user_positions(user_id: str, include_closed: bool = False) -> list[dict]:
    resp = _table().query(IndexName="user-index", KeyConditionExpression=Key("user_id").eq(user_id))
    items = resp.get("Items", [])
    if not include_closed:
        items = [p for p in items if not p.get("closed")]
    # Convert numeric strings back
    for p in items:
        p["shares"] = float(p.get("shares", 0))
        p["avg_price"] = float(p.get("avg_price", 0))
        cp = p.get("current_price")
        p["current_price"] = float(cp) if cp else None
    items.sort(key=lambda p: p.get("created_at", ""), reverse=True)
    return items


def update_position(pos_id: str, user_id: str, updates: dict) -> bool:
    allowed = {"shares", "avg_price", "current_price", "closed"}
    filtered = {k: v for k, v in updates.items() if k in allowed}
    if not filtered:
        return False
    now = datetime.now(timezone.utc).isoformat()
    expr_parts = ["updated_at = :u"]
    values: dict = {":u": now}
    for i, (k, v) in enumerate(filtered.items()):
        expr_parts.append(f"{k} = :v{i}")
        values[f":v{i}"] = str(v) if isinstance(v, (int, float)) else v
    _table().update_item(
        Key={"id": pos_id},
        UpdateExpression="SET " + ", ".join(expr_parts),
        ExpressionAttributeValues=values,
    )
    return True


def delete_position(pos_id: str, user_id: str) -> bool:
    _table().delete_item(Key={"id": pos_id})
    return True


def calculate_portfolio_risk(positions: list[dict], market_cache: list[dict] | None = None) -> dict:
    if not positions:
        return {"total_invested": 0, "total_current": 0, "pnl": 0, "pnl_pct": 0,
                "max_loss": 0, "max_gain": 0, "concentration": 0, "positions_count": 0}
    if market_cache:
        price_map = {m["market_id"]: m["yes_price"] for m in market_cache}
        for pos in positions:
            if pos["current_price"] is None and pos["market_id"] in price_map:
                mp = price_map[pos["market_id"]]
                pos["current_price"] = mp if pos["side"] == "YES" else 1.0 - mp
    invested_values = []
    current_values = []
    for pos in positions:
        inv = pos["shares"] * pos["avg_price"]
        invested_values.append(inv)
        cp = pos.get("current_price") or pos["avg_price"]
        current_values.append(pos["shares"] * cp)
    total_inv = sum(invested_values)
    total_cur = sum(current_values)
    pnl = total_cur - total_inv
    return {
        "total_invested": round(total_inv, 2), "total_current": round(total_cur, 2),
        "pnl": round(pnl, 2), "pnl_pct": round(pnl / total_inv * 100, 2) if total_inv > 0 else 0,
        "max_loss": round(total_inv, 2), "max_gain": round(sum(p["shares"] for p in positions) - total_inv, 2),
        "concentration": round(max(invested_values) / total_inv * 100, 1) if total_inv > 0 else 0,
        "positions_count": len(positions),
    }


def simulate_scenarios(positions: list[dict]) -> list[dict]:
    if not positions:
        return []
    total_inv = sum(p["shares"] * p["avg_price"] for p in positions)
    scenarios = []
    pnl_yes = sum(p["shares"] * (1.0 if p["side"] == "YES" else 0.0) - p["shares"] * p["avg_price"] for p in positions)
    scenarios.append({"name": "Tudo YES", "pnl": round(pnl_yes, 2), "pnl_pct": round(pnl_yes / total_inv * 100, 2) if total_inv else 0})
    pnl_no = sum(p["shares"] * (0.0 if p["side"] == "YES" else 1.0) - p["shares"] * p["avg_price"] for p in positions)
    scenarios.append({"name": "Tudo NO", "pnl": round(pnl_no, 2), "pnl_pct": round(pnl_no / total_inv * 100, 2) if total_inv else 0})
    return scenarios
