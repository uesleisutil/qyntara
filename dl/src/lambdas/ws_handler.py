"""
WebSocket handler for real-time dashboard updates.

Routes:
  $connect    → salva connectionId no DynamoDB
  $disconnect → remove connectionId do DynamoDB
  $default    → ignora (server-push only)

Broadcast:
  broadcast_event(topic, payload) → envia para todos os clients conectados
"""

import json
import logging
import os
from datetime import UTC, datetime

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("WS_CONNECTIONS_TABLE", "B3Dashboard-WsConnections")
WS_ENDPOINT = os.environ.get("WS_ENDPOINT", "")

table = dynamodb.Table(TABLE_NAME)


def handler(event, context):
    """Handle WebSocket $connect, $disconnect, $default."""
    rc = event.get("requestContext", {})
    route = rc.get("routeKey")
    connection_id = rc.get("connectionId")

    if route == "$connect":
        return _on_connect(connection_id)
    elif route == "$disconnect":
        return _on_disconnect(connection_id)
    else:
        return {"statusCode": 200}


def _on_connect(connection_id: str):
    """Save connection."""
    try:
        table.put_item(Item={
            "connectionId": connection_id,
            "connectedAt": datetime.now(UTC).isoformat(),
        })
        logger.info(f"Connected: {connection_id}")
    except Exception as e:
        logger.error(f"Connect error: {e}")
        return {"statusCode": 500}
    return {"statusCode": 200}


def _on_disconnect(connection_id: str):
    """Remove connection."""
    try:
        table.delete_item(Key={"connectionId": connection_id})
        logger.info(f"Disconnected: {connection_id}")
    except Exception as e:
        logger.error(f"Disconnect error: {e}")
    return {"statusCode": 200}


def broadcast_event(topic: str, payload: dict, endpoint_url: str = None):
    """
    Broadcast an event to all connected WebSocket clients.

    Args:
        topic: Event topic (e.g. "recommendations", "performance", "ensemble_weights", "feature_store")
        payload: Data to send
        endpoint_url: WebSocket API management endpoint (https://xxx.execute-api.region.amazonaws.com/prod)
    """
    endpoint = endpoint_url or WS_ENDPOINT
    if not endpoint:
        logger.warning("WS_ENDPOINT not set, skipping broadcast")
        return

    apigw = boto3.client(
        "apigatewaymanagementapi",
        endpoint_url=endpoint,
    )

    message = json.dumps({"topic": topic, "data": payload, "ts": datetime.now(UTC).isoformat()})

    # Scan all connections
    connections = table.scan(ProjectionExpression="connectionId").get("Items", [])
    stale = []

    for conn in connections:
        cid = conn["connectionId"]
        try:
            apigw.post_to_connection(ConnectionId=cid, Data=message.encode("utf-8"))
        except apigw.exceptions.GoneException:
            stale.append(cid)
        except Exception as e:
            logger.warning(f"Failed to send to {cid}: {e}")
            stale.append(cid)

    # Cleanup stale connections
    for cid in stale:
        try:
            table.delete_item(Key={"connectionId": cid})
        except Exception:
            pass

    logger.info(f"Broadcast '{topic}' to {len(connections) - len(stale)} clients ({len(stale)} stale removed)")
