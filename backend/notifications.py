"""
Notification system — DynamoDB storage.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key

from .database import _get_dynamodb

logger = logging.getLogger(__name__)

TABLE_NAME = "predikt-notifications"


def _table():
    return _get_dynamodb().Table(TABLE_NAME)


def init_notifications_db():
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


def create_notification(user_id: str, ntype: str, title: str, body: str = "", data: dict | None = None) -> dict:
    nid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": nid, "user_id": user_id, "type": ntype,
        "title": title, "body": body, "data": json.dumps(data or {}),
        "read": False, "created_at": now,
    }
    _table().put_item(Item=item)
    return {"id": nid, "type": ntype, "title": title, "body": body, "created_at": now}


def get_user_notifications(user_id: str, limit: int = 50, unread_only: bool = False) -> list[dict]:
    resp = _table().query(IndexName="user-index", KeyConditionExpression=Key("user_id").eq(user_id))
    items = resp.get("Items", [])
    if unread_only:
        items = [n for n in items if not n.get("read")]
    items.sort(key=lambda n: n.get("created_at", ""), reverse=True)
    return items[:limit]


def mark_read(notification_id: str, user_id: str):
    _table().update_item(Key={"id": notification_id}, UpdateExpression="SET #r = :r", ExpressionAttributeNames={"#r": "read"}, ExpressionAttributeValues={":r": True})


def mark_all_read(user_id: str):
    items = get_user_notifications(user_id, limit=200, unread_only=True)
    for item in items:
        mark_read(item["id"], user_id)


def get_unread_count(user_id: str) -> int:
    items = get_user_notifications(user_id, limit=200, unread_only=True)
    return len(items)
