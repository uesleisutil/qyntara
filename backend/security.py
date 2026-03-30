"""
Security middleware e utilities.

- Rate limiting por IP e por user
- Security headers (HSTS, CSP, X-Frame-Options, etc.)
- Request ID tracking
- Input sanitization
- Brute force protection no login
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from collections import defaultdict
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import settings

logger = logging.getLogger(__name__)

# ── Rate Limiter ──

limiter = Limiter(key_func=get_remote_address)


def get_tier_limit(request: Request) -> str:
    """Retorna rate limit baseado no tier do user."""
    # Tenta extrair tier do JWT
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        try:
            import jwt
            payload = jwt.decode(auth[7:], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            tier = payload.get("tier", "free")
            if tier == "quant" or tier == "enterprise":
                return "1000/minute"
            if tier == "pro":
                return "300/minute"
        except Exception:
            pass
    return "60/minute"


# ── Brute Force Protection ──

_login_attempts: dict[str, list[float]] = defaultdict(list)
MAX_LOGIN_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 300  # 5 minutos


def check_brute_force(ip: str):
    """Bloqueia IP após muitas tentativas de login."""
    now = time.time()
    attempts = _login_attempts[ip]
    # Limpar tentativas antigas
    _login_attempts[ip] = [t for t in attempts if now - t < LOGIN_WINDOW_SECONDS]
    if len(_login_attempts[ip]) >= MAX_LOGIN_ATTEMPTS:
        return False
    return True


def record_login_attempt(ip: str):
    _login_attempts[ip].append(time.time())


def clear_login_attempts(ip: str):
    _login_attempts.pop(ip, None)


# ── Security Headers Middleware ──

def add_security_middleware(app: FastAPI):
    """Adiciona middleware de segurança ao app."""

    @app.middleware("http")
    async def security_headers(request: Request, call_next: Callable) -> Response:
        # Request ID pra tracking
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        response = await call_next(request)

        # Security headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Remover headers que vazam info
        if "server" in response.headers:
            del response.headers["server"]
        if "x-powered-by" in response.headers:
            del response.headers["x-powered-by"]

        return response

    @app.middleware("http")
    async def request_size_limit(request: Request, call_next: Callable) -> Response:
        """Limita tamanho do body a 1MB (previne abuse)."""
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 1_048_576:
            return JSONResponse(status_code=413, content={"detail": "Request too large"})
        return await call_next(request)


# ── Input Sanitization ──

def sanitize_string(value: str, max_length: int = 500) -> str:
    """Remove caracteres perigosos e limita tamanho."""
    if not value:
        return ""
    # Remove null bytes
    value = value.replace("\x00", "")
    # Limita tamanho
    value = value[:max_length]
    # Remove tags HTML básicas
    value = re.sub(r"<[^>]+>", "", value)
    return value.strip()


# ── Audit Logger ──

def audit_log(event: str, user_id: str | None = None, ip: str = "", detail: str = ""):
    """Registra evento de segurança para auditoria (S3 persistente)."""
    entry = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "event": event,
        "user_id": user_id,
        "ip": ip,
        "detail": detail,
    }
    logger.info(f"AUDIT: {event} user={user_id} ip={ip} {detail}")
    try:
        from .storage import append_audit_log
        append_audit_log(entry)
    except Exception:
        pass


def get_audit_log(limit: int = 100) -> list[dict]:
    try:
        from .storage import load_audit_log
        return load_audit_log(limit)
    except Exception:
        return []
