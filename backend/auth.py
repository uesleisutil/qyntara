"""
Auth module — JWT access/refresh tokens + password hashing.

Security:
- Passwords hashed with bcrypt (cost factor 12)
- Access tokens: short-lived (15 min), in memory
- Refresh tokens: long-lived (30 days), hashed in DB, rotated on use
- Token rotation: old refresh token revoked when new one is issued
"""

from __future__ import annotations

import hashlib
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from pydantic import BaseModel, field_validator

from .config import settings
from .database import (
    create_user, get_user_by_email, get_user_by_id,
    store_refresh_token, verify_refresh_token, revoke_refresh_token,
)

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
bearer_scheme = HTTPBearer(auto_error=False)

# ── Schemas ──

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.lower().strip()
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", v):
            raise ValueError("Invalid email format")
        if len(v) > 255:
            raise ValueError("Email too long")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password too long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain a number")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return v.strip()[:100]


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


# ── Password ──

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ──

def create_access_token(user_id: str, tier: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "tier": tier, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """Gera refresh token aleatório, salva hash no DB."""
    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
    store_refresh_token(user_id, token_hash, expires_at)
    return raw_token


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise jwt.InvalidTokenError("Not an access token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")


# ── Auth Flow ──

def register_user(req: RegisterRequest) -> TokenResponse:
    existing = get_user_by_email(req.email)
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    password_hash = hash_password(req.password)
    user = create_user(req.email, password_hash, req.name)

    access = create_access_token(user["id"], user["tier"])
    refresh = create_refresh_token(user["id"])

    # Enviar email de verificação (async, não bloqueia)
    try:
        from .email_service import generate_verification_token, send_verification_email
        token = generate_verification_token(user["id"], user["email"])
        send_verification_email(user["email"], user["name"], token)
    except Exception as e:
        logger.warning(f"Failed to send verification email: {e}")

    return TokenResponse(
        access_token=access, refresh_token=refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_safe_user(user),
    )


def login_user(req: LoginRequest) -> TokenResponse:
    user = get_user_by_email(req.email)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user["is_active"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account disabled")

    access = create_access_token(user["id"], user["tier"])
    refresh = create_refresh_token(user["id"])

    return TokenResponse(
        access_token=access, refresh_token=refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_safe_user(user),
    )


def refresh_tokens(raw_refresh_token: str) -> TokenResponse:
    token_hash = hashlib.sha256(raw_refresh_token.encode()).hexdigest()
    token_row = verify_refresh_token(token_hash)
    if not token_row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")

    # Rotate: revoke old, issue new
    revoke_refresh_token(token_hash)

    user = get_user_by_id(token_row["user_id"])
    if not user or not user["is_active"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or disabled")

    access = create_access_token(user["id"], user["tier"])
    new_refresh = create_refresh_token(user["id"])

    return TokenResponse(
        access_token=access, refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_safe_user(user),
    )


# ── Dependencies ──

async def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict:
    """FastAPI dependency — extracts and validates user from JWT."""
    if not credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = decode_access_token(credentials.credentials)
    user = get_user_by_id(payload["sub"])
    if not user or not user["is_active"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return _safe_user(user)


async def get_optional_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict | None:
    """Returns user if authenticated, None otherwise (for free endpoints)."""
    if not credentials:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        user = get_user_by_id(payload["sub"])
        return _safe_user(user) if user and user["is_active"] else None
    except Exception:
        return None


def require_tier(minimum: str):
    """Dependency factory — requires minimum subscription tier."""
    tier_levels = {"free": 0, "pro": 1, "quant": 2, "enterprise": 3}

    async def check(user: dict = Depends(get_current_user)):
        user_level = tier_levels.get(user.get("tier", "free"), 0)
        required_level = tier_levels.get(minimum, 0)
        if user_level < required_level:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"This feature requires {minimum} tier or above. Current: {user.get('tier', 'free')}",
            )
        return user
    return check


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Dependency — requires admin role."""
    if not user.get("is_admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user


def _safe_user(user: dict) -> dict:
    """Remove campos sensíveis do user dict."""
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "tier": user["tier"],
        "is_admin": bool(user.get("is_admin", 0)),
        "email_verified": bool(user.get("email_verified", 0)),
        "created_at": user["created_at"],
    }
