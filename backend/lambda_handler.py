"""
Lambda handler — adapta o FastAPI app pra rodar no AWS Lambda via Mangum.

API Gateway HTTP v2 → Mangum → FastAPI
Async invoke com {"action": "train"} → treina modelos diretamente
"""

import logging

from mangum import Mangum
from .api import app

logger = logging.getLogger(__name__)

_mangum = Mangum(app, lifespan="off", api_gateway_base_path="")


def handler(event, context):
    # Check if this is an async training invoke (not API Gateway)
    if isinstance(event, dict) and event.get("action") == "train":
        logger.info("Training invoked via async Lambda event")
        try:
            from .sagemaker.train_job import train_local
            result = train_local(epochs=20)
            logger.info(f"Training completed: {result}")
            return {"ok": True, "result": str(result)}
        except Exception as e:
            logger.error(f"Training failed: {e}")
            return {"ok": False, "error": str(e)}

    # Normal API Gateway request
    return _mangum(event, context)
