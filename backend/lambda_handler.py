"""
Lambda handler — adapta o FastAPI app pra rodar no AWS Lambda via Mangum.

API Gateway HTTP → Mangum → FastAPI
"""

from mangum import Mangum
from .api import app

# Mangum adapta ASGI (FastAPI) pra Lambda handler
handler = Mangum(app, lifespan="off")
