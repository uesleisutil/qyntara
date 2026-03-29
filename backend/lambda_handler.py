"""
Lambda handler — adapta o FastAPI app pra rodar no AWS Lambda via Mangum.

API Gateway HTTP v2 → Mangum → FastAPI
"""

from mangum import Mangum
from .api import app

# Mangum adapta ASGI (FastAPI) pra Lambda handler
# api_gateway_base_path="" garante que o path matching funciona
handler = Mangum(app, lifespan="off", api_gateway_base_path="")
