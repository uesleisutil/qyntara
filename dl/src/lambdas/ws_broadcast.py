"""
Helper para broadcast de eventos via WebSocket.
Importado pelas Lambdas que geram dados novos.

Uso:
    from dl.src.lambdas.ws_broadcast import notify
    notify("recommendations", {"dt": "2026-03-26", "count": 50})
"""

import logging
import os

logger = logging.getLogger(__name__)


def notify(topic: str, payload: dict):
    """
    Notifica todos os clients WebSocket conectados sobre dados novos.
    Silencioso se WS não estiver configurado (não quebra nada).
    """
    endpoint = os.environ.get("WS_ENDPOINT", "")
    table_name = os.environ.get("WS_CONNECTIONS_TABLE", "")

    if not endpoint or not table_name:
        return  # WS não configurado, skip silencioso

    try:
        from dl.src.lambdas.ws_handler import broadcast_event
        broadcast_event(topic, payload, endpoint_url=endpoint)
    except Exception as e:
        # Nunca quebra a Lambda principal por causa do WS
        logger.warning(f"WS broadcast failed (non-fatal): {e}")
