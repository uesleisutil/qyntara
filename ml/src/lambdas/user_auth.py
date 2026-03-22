"""
User Authentication Service - Register/Login with DynamoDB + bcrypt + JWT

Stores users in DynamoDB with bcrypt-hashed passwords.
Issues JWT tokens for session management.
Zero cost beyond DynamoDB free tier.
"""

import hashlib
import hmac
import json
import logging
import os
import time
import uuid
import base64
from datetime import datetime, UTC, timedelta
from typing import Any, Dict, Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
USERS_TABLE = os.environ.get("USERS_TABLE", "B3Dashboard-Users")
AUTH_LOGS_TABLE = os.environ.get("AUTH_LOGS_TABLE", "B3Dashboard-AuthLogs")
JWT_SECRET = os.environ.get("JWT_SECRET", "")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")

# Session config
SESSION_HOURS = 24
BCRYPT_ROUNDS = 12


# --- Simple bcrypt-compatible password hashing using hashlib (no external deps) ---

def _hash_password(password: str) -> str:
    """Hash password with PBKDF2-SHA256 (available in stdlib, no bcrypt needed)."""
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return base64.b64encode(salt + key).decode()


def _verify_password(password: str, stored_hash: str) -> bool:
    """Verify password against stored PBKDF2 hash."""
    try:
        decoded = base64.b64decode(stored_hash)
        salt = decoded[:32]
        stored_key = decoded[32:]
        key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
        return hmac.compare_digest(key, stored_key)
    except Exception:
        return False


# --- Simple JWT implementation (no PyJWT dependency needed) ---

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def _create_jwt(payload: dict) -> str:
    """Create a simple HS256 JWT."""
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _b64url_encode(json.dumps(header).encode())
    payload_b64 = _b64url_encode(json.dumps(payload).encode())
    signing_input = f"{header_b64}.{payload_b64}"
    signature = hmac.new(
        JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256
    ).digest()
    sig_b64 = _b64url_encode(signature)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def _verify_jwt(token: str) -> Optional[dict]:
    """Verify and decode a JWT. Returns payload or None."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(
            JWT_SECRET.encode(), signing_input.encode(), hashlib.sha256
        ).digest()
        actual_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


# --- Auth log ---

def _log_auth(user_id: str, action: str, success: bool, ip: str = "unknown"):
    try:
        table = dynamodb.Table(AUTH_LOGS_TABLE)
        table.put_item(Item={
            "userId": user_id,
            "timestamp": datetime.now(UTC).isoformat(),
            "authType": action,
            "success": success,
            "ipAddress": ip,
            "ttl": int((datetime.now(UTC) + timedelta(days=90)).timestamp()),
        })
    except Exception as e:
        logger.warning(f"Failed to log auth: {e}")


# --- Handlers ---

def _get_ip(event: dict) -> str:
    headers = event.get("headers", {}) or {}
    return (
        headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or event.get("requestContext", {}).get("identity", {}).get("sourceIp", "unknown")
    )


def _cors_response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Api-Key",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
        "body": json.dumps(body),
    }


def _handle_register(event: dict) -> dict:
    """Register a new user."""
    try:
        body = json.loads(event.get("body", "{}"))
    except (json.JSONDecodeError, TypeError):
        return _cors_response(400, {"message": "Invalid JSON"})

    email = (body.get("email") or "").strip().lower()
    password = body.get("password", "")
    name = (body.get("name") or "").strip()

    if not email or not password:
        return _cors_response(400, {"message": "Email e senha são obrigatórios"})
    if len(password) < 8:
        return _cors_response(400, {"message": "Senha deve ter no mínimo 8 caracteres"})
    if "@" not in email:
        return _cors_response(400, {"message": "Email inválido"})

    table = dynamodb.Table(USERS_TABLE)
    ip = _get_ip(event)

    # Check if user exists
    try:
        existing = table.get_item(Key={"email": email})
        if "Item" in existing:
            _log_auth(email, "register", False, ip)
            return _cors_response(409, {"message": "Email já cadastrado"})
    except ClientError as e:
        logger.error(f"DynamoDB error: {e}")
        return _cors_response(500, {"message": "Erro interno"})

    # Determine role
    role = "admin" if email == ADMIN_EMAIL.lower() else "viewer"

    user_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()

    table.put_item(Item={
        "email": email,
        "userId": user_id,
        "name": name,
        "passwordHash": _hash_password(password),
        "role": role,
        "plan": "free",
        "createdAt": now,
        "updatedAt": now,
        "enabled": True,
    })

    # Issue JWT
    token = _create_jwt({
        "sub": user_id,
        "email": email,
        "role": role,
        "name": name,
        "exp": int(time.time()) + SESSION_HOURS * 3600,
    })

    _log_auth(email, "register", True, ip)
    logger.info(f"User registered: {email} (role={role})")

    return _cors_response(201, {
        "accessToken": token,
        "userId": user_id,
        "email": email,
        "name": name,
        "role": role,
    })


def _handle_login(event: dict) -> dict:
    """Authenticate user with email + password."""
    try:
        body = json.loads(event.get("body", "{}"))
    except (json.JSONDecodeError, TypeError):
        return _cors_response(400, {"message": "Invalid JSON"})

    email = (body.get("email") or "").strip().lower()
    password = body.get("password", "")
    ip = _get_ip(event)

    if not email or not password:
        return _cors_response(400, {"message": "Email e senha são obrigatórios"})

    table = dynamodb.Table(USERS_TABLE)

    try:
        result = table.get_item(Key={"email": email})
    except ClientError as e:
        logger.error(f"DynamoDB error: {e}")
        return _cors_response(500, {"message": "Erro interno"})

    item = result.get("Item")
    if not item:
        _log_auth(email, "login", False, ip)
        return _cors_response(401, {"message": "Email ou senha inválidos"})

    if not item.get("enabled", True):
        _log_auth(email, "login", False, ip)
        return _cors_response(403, {"message": "Conta desativada"})

    if not _verify_password(password, item.get("passwordHash", "")):
        _log_auth(email, "login", False, ip)
        return _cors_response(401, {"message": "Email ou senha inválidos"})

    # Issue JWT
    token = _create_jwt({
        "sub": item["userId"],
        "email": email,
        "role": item.get("role", "viewer"),
        "name": item.get("name", ""),
        "exp": int(time.time()) + SESSION_HOURS * 3600,
    })

    # Update last login
    table.update_item(
        Key={"email": email},
        UpdateExpression="SET lastLoginAt = :now",
        ExpressionAttributeValues={":now": datetime.now(UTC).isoformat()},
    )

    _log_auth(email, "login", True, ip)

    return _cors_response(200, {
        "accessToken": token,
        "userId": item["userId"],
        "email": email,
        "name": item.get("name", ""),
        "role": item.get("role", "viewer"),
    })


def _handle_me(event: dict) -> dict:
    """Get current user info from JWT."""
    headers = event.get("headers", {}) or {}
    auth = headers.get("Authorization", headers.get("authorization", ""))

    if not auth.startswith("Bearer "):
        return _cors_response(401, {"message": "Token não fornecido"})

    payload = _verify_jwt(auth[7:])
    if not payload:
        return _cors_response(401, {"message": "Token inválido ou expirado"})

    return _cors_response(200, {
        "userId": payload.get("sub"),
        "email": payload.get("email"),
        "name": payload.get("name"),
        "role": payload.get("role"),
    })


def handler(event: dict, context: Any = None) -> dict:
    """Lambda handler - routes to register/login/me based on path."""
    # Handle OPTIONS (CORS preflight)
    method = event.get("httpMethod", "")
    if method == "OPTIONS":
        return _cors_response(200, {})

    path = event.get("path", "") or event.get("resource", "")
    
    # Normalize path
    path = path.rstrip("/")

    if path.endswith("/auth/register") and method == "POST":
        return _handle_register(event)
    elif path.endswith("/auth/login") and method == "POST":
        return _handle_login(event)
    elif path.endswith("/auth/me") and method == "GET":
        return _handle_me(event)
    else:
        return _cors_response(404, {"message": f"Route not found: {method} {path}"})
