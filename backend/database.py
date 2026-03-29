"""
Database layer — DynamoDB (persistente, serverless, free tier 25GB).

Tabelas:
- predikt-users: auth + perfil + subscription
- predikt-tokens: refresh tokens ativos
- predikt-positions: portfolio positions
- predikt-notifications: in-app notifications
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key, Attr


logger = logging.getLogger(__name__)

_dynamodb = None
_tables: dict[str, Any] = {}


def _get_dynamodb():
    global _dynamodb
    if not _dynamodb:
        _dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
    return _dynamodb


def _table(name: str):
    if name not in _tables:
        _tables[name] = _get_dynamodb().Table(name)
    return _tables[name]


USERS_TABLE = "predikt-users"
TOKENS_TABLE = "predikt-tokens"


def init_db():
    """Cria tabelas DynamoDB se não existirem."""
    client = boto3.client("dynamodb", region_name="us-east-1")
    existing = client.list_tables()["TableNames"]

    if USERS_TABLE not in existing:
        client.create_table(
            TableName=USERS_TABLE,
            KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
            AttributeDefinitions=[
                {"AttributeName": "id", "AttributeType": "S"},
                {"AttributeName": "email", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[{
                "IndexName": "email-index",
                "KeySchema": [{"AttributeName": "email", "KeyType": "HASH"}],
                "Projection": {"ProjectionType": "ALL"},
            }],
            BillingMode="PAY_PER_REQUEST",
        )
        logger.info(f"Created table {USERS_TABLE}")

    if TOKENS_TABLE not in existing:
        client.create_table(
            TableName=TOKENS_TABLE,
            KeySchema=[{"AttributeName": "token_hash", "KeyType": "HASH"}],
            AttributeDefinitions=[
                {"AttributeName": "token_hash", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        logger.info(f"Created table {TOKENS_TABLE}")


# ── User CRUD ──

def create_user(email: str, password_hash: str, name: str = "",
                phone: str = "", country: str = "", referral_source: str = "") -> dict:
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": user_id,
        "email": email.lower().strip(),
        "password_hash": password_hash,
        "name": name,
        "phone": phone,
        "country": country,
        "referral_source": referral_source,
        "tier": "free",
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "created_at": now,
        "updated_at": now,
        "is_active": True,
        "email_verified": False,
        "is_admin": False,
    }
    _table(USERS_TABLE).put_item(Item=item)
    return item


def get_user_by_email(email: str) -> dict | None:
    resp = _table(USERS_TABLE).query(
        IndexName="email-index",
        KeyConditionExpression=Key("email").eq(email.lower().strip()),
    )
    items = resp.get("Items", [])
    return items[0] if items else None


def get_user_by_id(user_id: str) -> dict | None:
    resp = _table(USERS_TABLE).get_item(Key={"id": user_id})
    return resp.get("Item")


def update_user_tier(user_id: str, tier: str, stripe_sub_id: str | None = None):
    now = datetime.now(timezone.utc).isoformat()
    _table(USERS_TABLE).update_item(
        Key={"id": user_id},
        UpdateExpression="SET tier = :t, stripe_subscription_id = :s, updated_at = :u",
        ExpressionAttributeValues={":t": tier, ":s": stripe_sub_id, ":u": now},
    )


def update_user_stripe_customer(user_id: str, customer_id: str):
    now = datetime.now(timezone.utc).isoformat()
    _table(USERS_TABLE).update_item(
        Key={"id": user_id},
        UpdateExpression="SET stripe_customer_id = :c, updated_at = :u",
        ExpressionAttributeValues={":c": customer_id, ":u": now},
    )


# ── Refresh Tokens ──

def store_refresh_token(user_id: str, token_hash: str, expires_at: str):
    _table(TOKENS_TABLE).put_item(Item={
        "token_hash": token_hash,
        "user_id": user_id,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "revoked": False,
    })


def verify_refresh_token(token_hash: str) -> dict | None:
    resp = _table(TOKENS_TABLE).get_item(Key={"token_hash": token_hash})
    item = resp.get("Item")
    if not item or item.get("revoked"):
        return None
    if datetime.fromisoformat(item["expires_at"]) < datetime.now(timezone.utc):
        return None
    return item


def revoke_refresh_token(token_hash: str):
    _table(TOKENS_TABLE).update_item(
        Key={"token_hash": token_hash},
        UpdateExpression="SET revoked = :r",
        ExpressionAttributeValues={":r": True},
    )


def revoke_all_user_tokens(user_id: str):
    # Scan tokens for user (não ideal, mas tokens são poucos)
    resp = _table(TOKENS_TABLE).scan(
        FilterExpression=Attr("user_id").eq(user_id) & Attr("revoked").eq(False),
    )
    for item in resp.get("Items", []):
        revoke_refresh_token(item["token_hash"])


# ── Helper pra admin ──

def get_db():
    """Compatibility — retorna context manager fake pra código que usa 'with get_db() as db'."""
    class FakeDB:
        def execute(self, *args, **kwargs):
            return FakeDB()
        def fetchone(self):
            return None
        def fetchall(self):
            return []
        def executescript(self, *args):
            pass
        def __getitem__(self, key):
            return 0
    class FakeCtx:
        def __enter__(self):
            return FakeDB()
        def __exit__(self, *args):
            pass
    return FakeCtx()
