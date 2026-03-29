"""Configuração centralizada via env vars."""

from __future__ import annotations

import os
import secrets

from dotenv import load_dotenv

load_dotenv()


class Settings:
    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", secrets.token_hex(32))
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

    # Stripe
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    STRIPE_PRICE_PRO: str = os.getenv("STRIPE_PRICE_PRO", "")
    STRIPE_PRICE_QUANT: str = os.getenv("STRIPE_PRICE_QUANT", "")

    # App
    APP_ENV: str = os.getenv("APP_ENV", "development")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./predikt.db")

    # SMTP
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtplw.com.br")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "noreply@qyntara.tech")

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def cors_origins(self) -> list[str]:
        if self.is_production:
            return [self.FRONTEND_URL]
        return ["*"]


settings = Settings()
