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
TICKETS_TABLE = "predikt-tickets"


def _table_exists(client, table_name: str) -> bool:
    """Verifica se tabela existe sem precisar de ListTables."""
    try:
        client.describe_table(TableName=table_name)
        return True
    except client.exceptions.ResourceNotFoundException:
        return False
    except Exception:
        return True  # Assume que existe se não conseguir verificar


def init_db():
    """Cria tabelas DynamoDB se não existirem."""
    client = boto3.client("dynamodb", region_name="us-east-1")

    if not _table_exists(client, USERS_TABLE):
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

    if not _table_exists(client, TOKENS_TABLE):
        client.create_table(
            TableName=TOKENS_TABLE,
            KeySchema=[{"AttributeName": "token_hash", "KeyType": "HASH"}],
            AttributeDefinitions=[
                {"AttributeName": "token_hash", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        logger.info(f"Created table {TOKENS_TABLE}")

    if not _table_exists(client, TICKETS_TABLE):
        client.create_table(
            TableName=TICKETS_TABLE,
            KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
            AttributeDefinitions=[
                {"AttributeName": "id", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        logger.info(f"Created table {TICKETS_TABLE}")


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


def delete_user_data(user_id: str):
    """Exclui todos os dados do usuário (LGPD compliance)."""
    # Delete user record
    _table(USERS_TABLE).delete_item(Key={"id": user_id})

    # Revoke all refresh tokens
    revoke_all_user_tokens(user_id)

    # Delete positions
    try:
        positions_table = _table("predikt-positions")
        resp = positions_table.scan(FilterExpression=Attr("user_id").eq(user_id))
        for item in resp.get("Items", []):
            positions_table.delete_item(Key={"id": item["id"]})
    except Exception as e:
        logger.warning(f"Error deleting positions for {user_id}: {e}")

    # Delete notifications
    try:
        notifs_table = _table("predikt-notifications")
        resp = notifs_table.scan(FilterExpression=Attr("user_id").eq(user_id))
        for item in resp.get("Items", []):
            notifs_table.delete_item(Key={"id": item["id"]})
    except Exception as e:
        logger.warning(f"Error deleting notifications for {user_id}: {e}")

    logger.info(f"All data deleted for user {user_id}")


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


def get_user_by_stripe_customer(customer_id: str) -> dict | None:
    """Busca user pelo stripe_customer_id (scan com filtro)."""
    resp = _table(USERS_TABLE).scan(
        FilterExpression=Attr("stripe_customer_id").eq(customer_id),
        Limit=1,
    )
    items = resp.get("Items", [])
    return items[0] if items else None


def get_users_by_tier(tiers: list[str]) -> list[dict]:
    """Busca users por tier (pro, quant) pra alertas."""
    all_users: list[dict] = []
    for tier in tiers:
        resp = _table(USERS_TABLE).scan(
            FilterExpression=Attr("tier").eq(tier) & Attr("is_active").eq(True) & Attr("email_verified").eq(True),
        )
        all_users.extend(resp.get("Items", []))
    return all_users


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


# ── Support Tickets ──

def create_ticket(user_id: str, user_email: str, user_name: str, user_tier: str,
                  subject: str, message: str, channel: str = "email",
                  category: str = "geral") -> dict:
    ticket_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": ticket_id,
        "user_id": user_id,
        "user_email": user_email,
        "user_name": user_name,
        "user_tier": user_tier,
        "subject": subject,
        "category": category,
        "channel": channel,  # "email" or "chat"
        "status": "open",  # open, in_progress, closed
        "messages": [{"role": "user", "text": message, "at": now}],
        "created_at": now,
        "updated_at": now,
    }
    _table(TICKETS_TABLE).put_item(Item=item)
    return item


def get_tickets_by_user(user_id: str) -> list[dict]:
    resp = _table(TICKETS_TABLE).scan(
        FilterExpression=Attr("user_id").eq(user_id),
    )
    items = resp.get("Items", [])
    return sorted(items, key=lambda x: x.get("updated_at", ""), reverse=True)


def get_all_tickets(status_filter: str = "") -> list[dict]:
    if status_filter:
        resp = _table(TICKETS_TABLE).scan(
            FilterExpression=Attr("status").eq(status_filter),
        )
    else:
        resp = _table(TICKETS_TABLE).scan()
    items = resp.get("Items", [])
    return sorted(items, key=lambda x: x.get("updated_at", ""), reverse=True)


def get_ticket_by_id(ticket_id: str) -> dict | None:
    resp = _table(TICKETS_TABLE).get_item(Key={"id": ticket_id})
    return resp.get("Item")


def add_ticket_message(ticket_id: str, role: str, text: str) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    ticket = get_ticket_by_id(ticket_id)
    if not ticket:
        return False
    messages = ticket.get("messages", [])
    messages.append({"role": role, "text": text, "at": now})
    _table(TICKETS_TABLE).update_item(
        Key={"id": ticket_id},
        UpdateExpression="SET messages = :m, updated_at = :u, #s = :st",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":m": messages, ":u": now,
            ":st": "in_progress" if role == "admin" else ticket.get("status", "open"),
        },
    )
    return True


def update_ticket_status(ticket_id: str, status: str) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    _table(TICKETS_TABLE).update_item(
        Key={"id": ticket_id},
        UpdateExpression="SET #s = :s, updated_at = :u",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": status, ":u": now},
    )
    return True


def delete_ticket(ticket_id: str):
    _table(TICKETS_TABLE).delete_item(Key={"id": ticket_id})


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
