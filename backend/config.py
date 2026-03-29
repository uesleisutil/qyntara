"""Configuração centralizada — Secrets Manager em prod, env vars em dev."""

from __future__ import annotations

import json
import logging
import os
import secrets

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Load secrets from AWS Secrets Manager in production
_secrets_cache: dict = {}


def _load_aws_secrets() -> dict:
    global _secrets_cache
    if _secrets_cache:
        return _secrets_cache
    if os.getenv("APP_ENV") != "production":
        return {}
    try:
        import boto3
        client = boto3.client("secretsmanager", region_name="us-east-1")
        resp = client.get_secret_value(SecretId="qyntara/prod")
        _secrets_cache = json.loads(resp["SecretString"])
        logger.info("Loaded secrets from Secrets Manager")
    except Exception as e:
        logger.warning(f"Could not load secrets from Secrets Manager: {e}")
    return _secrets_cache


def _get(key: str, default: str = "") -> str:
    """Get config value: Secrets Manager > env var > default."""
    sm = _load_aws_secrets()
    return sm.get(key, os.getenv(key, default))


class Settings:
    # JWT
    JWT_SECRET: str = _get("JWT_SECRET", secrets.token_hex(32))
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

    # Stripe
    STRIPE_SECRET_KEY: str = _get("STRIPE_SECRET_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = _get("STRIPE_WEBHOOK_SECRET", "")
    STRIPE_PRICE_PRO: str = os.getenv("STRIPE_PRICE_PRO", "")
    STRIPE_PRICE_QUANT: str = os.getenv("STRIPE_PRICE_QUANT", "")

    # App
    APP_ENV: str = os.getenv("APP_ENV", "development")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # SMTP
    SMTP_HOST: str = _get("SMTP_HOST", "smtplw.com.br")
    SMTP_PORT: int = int(_get("SMTP_PORT", "587"))
    SMTP_USER: str = _get("SMTP_USER", "")
    SMTP_PASSWORD: str = _get("SMTP_PASSWORD", "")
    SMTP_FROM: str = _get("SMTP_FROM", "noreply@qyntara.tech")

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def cors_origins(self) -> list[str]:
        if self.is_production:
            return [self.FRONTEND_URL]
        return ["*"]


settings = Settings()
