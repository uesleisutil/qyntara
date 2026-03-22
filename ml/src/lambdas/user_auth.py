"""
User Authentication Service — Hardened

Security measures:
1. PBKDF2-SHA256 with 600k iterations (OWASP 2024 recommendation)
2. 32-byte random salt per password
3. Rate limiting per IP (DynamoDB-backed, 10 attempts/15min)
4. Account lockout after 5 failed attempts (30min cooldown)
5. JWT secret from AWS Secrets Manager (not env var)
6. Timing-safe comparisons everywhere (hmac.compare_digest)
7. Generic error messages (no user enumeration)
8. Input sanitization + email normalization
9. Password strength enforcement (length, complexity)
10. Request body size limit (16KB)
11. Security headers (no-cache, no-store on auth responses)
12. Detailed audit logging with IP, user-agent, failure reason
13. JWT with jti (unique ID) for future token revocation
14. No sensitive data in logs (passwords never logged)
"""

import hashlib
import hmac
import json
import logging
import os
import re
import time
import uuid
import base64
from datetime import datetime, UTC, timedelta
from decimal import Decimal
from typing import Any, Dict, Optional

import random
import string

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
secrets_client = boto3.client("secretsmanager")
ses_client = boto3.client("ses", region_name="us-east-1")

USERS_TABLE = os.environ.get("USERS_TABLE", "B3Dashboard-Users")
AUTH_LOGS_TABLE = os.environ.get("AUTH_LOGS_TABLE", "B3Dashboard-AuthLogs")
RATE_LIMITS_TABLE = os.environ.get("RATE_LIMITS_TABLE", "B3Dashboard-RateLimits")
JWT_SECRET_ID = os.environ.get("JWT_SECRET_ID", "")
JWT_SECRET_ENV = os.environ.get("JWT_SECRET", "")  # Fallback only
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")
SES_SENDER_EMAIL = os.environ.get("SES_SENDER_EMAIL", os.environ.get("ADMIN_EMAIL", ""))

# Stripe
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID = os.environ.get("STRIPE_PRICE_ID", "")  # price_xxx for R$49/mo
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://uesleisutil.github.io/b3-tactical-ranking")

# ── Security constants ──
SESSION_HOURS = 24
PBKDF2_ITERATIONS = 600_000  # OWASP 2024 recommendation for SHA-256
SALT_BYTES = 32
MAX_BODY_SIZE = 16 * 1024  # 16KB
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 30
RATE_LIMIT_WINDOW = 15 * 60  # 15 minutes
RATE_LIMIT_MAX = 10  # max attempts per IP per window
EMAIL_MAX_LENGTH = 254
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
NAME_MAX_LENGTH = 100
VERIFICATION_CODE_LENGTH = 6
VERIFICATION_CODE_EXPIRY = 15 * 60  # 15 minutes
RESET_CODE_EXPIRY = 30 * 60  # 30 minutes

# Cached JWT secret (loaded once per Lambda cold start)
_jwt_secret_cache: Optional[str] = None


# ── JWT Secret from Secrets Manager ──

def _get_jwt_secret() -> str:
    """Load JWT secret from Secrets Manager, with env var fallback."""
    global _jwt_secret_cache
    if _jwt_secret_cache:
        return _jwt_secret_cache

    if JWT_SECRET_ID:
        try:
            resp = secrets_client.get_secret_value(SecretId=JWT_SECRET_ID)
            secret_str = resp.get("SecretString", "")
            # Support JSON format {"jwt_secret": "..."} or plain string
            try:
                parsed = json.loads(secret_str)
                _jwt_secret_cache = parsed.get("jwt_secret", secret_str)
            except (json.JSONDecodeError, TypeError):
                _jwt_secret_cache = secret_str
            if _jwt_secret_cache:
                return _jwt_secret_cache
        except ClientError as e:
            logger.error(f"Failed to load JWT secret from Secrets Manager: {e}")

    # Fallback to env var
    _jwt_secret_cache = JWT_SECRET_ENV
    if not _jwt_secret_cache:
        raise RuntimeError("JWT_SECRET not configured — cannot issue tokens")
    return _jwt_secret_cache


# ── Password hashing (PBKDF2-SHA256, 600k iterations) ──

def _hash_password(password: str) -> str:
    """Hash with PBKDF2-SHA256, 600k iterations, 32-byte random salt."""
    salt = os.urandom(SALT_BYTES)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    # Store: iterations|salt|key (all base64)
    payload = json.dumps({
        "alg": "pbkdf2_sha256",
        "iter": PBKDF2_ITERATIONS,
        "salt": base64.b64encode(salt).decode(),
        "hash": base64.b64encode(key).decode(),
    })
    return base64.b64encode(payload.encode()).decode()


def _verify_password(password: str, stored_hash: str) -> bool:
    """Verify password — timing-safe, supports iteration upgrade detection."""
    try:
        payload = json.loads(base64.b64decode(stored_hash))
        salt = base64.b64decode(payload["salt"])
        stored_key = base64.b64decode(payload["hash"])
        iterations = payload.get("iter", 100_000)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(key, stored_key)
    except Exception:
        # Fallback: try legacy format (raw salt+key)
        try:
            decoded = base64.b64decode(stored_hash)
            salt = decoded[:32]
            stored_key = decoded[32:]
            key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
            return hmac.compare_digest(key, stored_key)
        except Exception:
            return False


def _needs_rehash(stored_hash: str) -> bool:
    """Check if password hash needs upgrade to current iteration count."""
    try:
        payload = json.loads(base64.b64decode(stored_hash))
        return payload.get("iter", 0) < PBKDF2_ITERATIONS
    except Exception:
        return True  # Legacy format needs rehash


# ── JWT (HS256 with jti) ──

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def _create_jwt(payload: dict) -> str:
    """Create HS256 JWT with unique jti."""
    secret = _get_jwt_secret()
    payload["jti"] = str(uuid.uuid4())  # Unique token ID for revocation
    payload["iat"] = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_b64}.{payload_b64}"
    signature = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(signature)}"


def _verify_jwt(token: str) -> Optional[dict]:
    """Verify JWT — timing-safe signature check."""
    try:
        if not token or not isinstance(token, str):
            return None
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        secret = _get_jwt_secret()
        signing_input = f"{header_b64}.{payload_b64}"
        expected = hmac.new(secret.encode(), signing_input.encode(), hashlib.sha256).digest()
        actual = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected, actual):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


# ── Rate limiting (DynamoDB-backed) ──

def _check_rate_limit(ip: str) -> bool:
    """Check if IP is rate-limited. Returns True if BLOCKED."""
    try:
        table = dynamodb.Table(RATE_LIMITS_TABLE)
        key = f"auth_ip:{ip}"
        now = int(time.time())
        window_start = now - RATE_LIMIT_WINDOW

        result = table.get_item(Key={"identifier": key})
        item = result.get("Item")

        if item:
            last_reset = int(item.get("windowStart", 0))
            count = int(item.get("count", 0))
            if last_reset > window_start and count >= RATE_LIMIT_MAX:
                logger.warning(f"Rate limit exceeded for IP {ip}: {count} attempts")
                return True

        return False
    except Exception as e:
        logger.warning(f"Rate limit check failed: {e}")
        return False  # Fail open — don't block on DynamoDB errors


def _increment_rate_limit(ip: str):
    """Increment rate limit counter for IP."""
    try:
        table = dynamodb.Table(RATE_LIMITS_TABLE)
        key = f"auth_ip:{ip}"
        now = int(time.time())
        ttl = now + RATE_LIMIT_WINDOW + 60

        table.update_item(
            Key={"identifier": key},
            UpdateExpression="SET #c = if_not_exists(#c, :zero) + :inc, windowStart = if_not_exists(windowStart, :now), #t = :ttl",
            ExpressionAttributeNames={"#c": "count", "#t": "ttl"},
            ExpressionAttributeValues={":inc": 1, ":zero": 0, ":now": now, ":ttl": ttl},
        )
    except Exception as e:
        logger.warning(f"Rate limit increment failed: {e}")


# ── Account lockout ──

def _check_account_locked(email: str) -> bool:
    """Check if account is locked due to failed attempts."""
    try:
        table = dynamodb.Table(USERS_TABLE)
        result = table.get_item(
            Key={"email": email},
            ProjectionExpression="failedAttempts, lockedUntil",
        )
        item = result.get("Item")
        if not item:
            return False

        locked_until = item.get("lockedUntil", "")
        if locked_until:
            if datetime.fromisoformat(locked_until.replace("Z", "+00:00")) > datetime.now(UTC):
                return True

        return False
    except Exception:
        return False


def _record_failed_attempt(email: str):
    """Increment failed attempts, lock account if threshold exceeded."""
    try:
        table = dynamodb.Table(USERS_TABLE)
        now = datetime.now(UTC).isoformat()

        result = table.update_item(
            Key={"email": email},
            UpdateExpression="SET failedAttempts = if_not_exists(failedAttempts, :zero) + :inc, lastFailedAt = :now",
            ExpressionAttributeValues={":inc": 1, ":zero": 0, ":now": now},
            ReturnValues="UPDATED_NEW",
        )

        failed = int(result.get("Attributes", {}).get("failedAttempts", 0))
        if failed >= MAX_LOGIN_ATTEMPTS:
            lock_until = (datetime.now(UTC) + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
            table.update_item(
                Key={"email": email},
                UpdateExpression="SET lockedUntil = :lock",
                ExpressionAttributeValues={":lock": lock_until},
            )
            logger.warning(f"Account locked: {email} after {failed} failed attempts")
    except Exception as e:
        logger.warning(f"Failed to record failed attempt: {e}")


def _reset_failed_attempts(email: str):
    """Reset failed attempts on successful login."""
    try:
        table = dynamodb.Table(USERS_TABLE)
        table.update_item(
            Key={"email": email},
            UpdateExpression="SET failedAttempts = :zero REMOVE lockedUntil, lastFailedAt",
            ExpressionAttributeValues={":zero": 0},
        )
    except Exception:
        pass


# ── Input validation ──

def _sanitize_string(s: str, max_len: int) -> str:
    """Sanitize input string — strip, truncate, remove control chars."""
    if not isinstance(s, str):
        return ""
    # Remove control characters
    s = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", s)
    return s.strip()[:max_len]


def _normalize_email(email: str) -> str:
    """Normalize email — lowercase, strip, validate format."""
    email = _sanitize_string(email, EMAIL_MAX_LENGTH).lower()
    # Remove dots in gmail local part (anti-bypass)
    # Basic RFC 5322 validation
    if not re.match(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$", email):
        return ""
    return email


def _validate_password(password: str) -> Optional[str]:
    """Validate password strength. Returns error message or None."""
    if len(password) < PASSWORD_MIN_LENGTH:
        return f"Senha deve ter no mínimo {PASSWORD_MIN_LENGTH} caracteres"
    if len(password) > PASSWORD_MAX_LENGTH:
        return f"Senha deve ter no máximo {PASSWORD_MAX_LENGTH} caracteres"
    if not re.search(r"[A-Z]", password):
        return "Senha deve conter pelo menos uma letra maiúscula"
    if not re.search(r"[a-z]", password):
        return "Senha deve conter pelo menos uma letra minúscula"
    if not re.search(r"\d", password):
        return "Senha deve conter pelo menos um número"
    # Check common passwords
    common = {"password", "12345678", "qwerty123", "abc12345", "password1"}
    if password.lower() in common:
        return "Senha muito comum, escolha outra"
    return None


# ── Audit logging ──

def _log_auth(user_id: str, action: str, success: bool, ip: str = "unknown",
              user_agent: str = "unknown", reason: str = ""):
    """Log auth event to DynamoDB with full context."""
    try:
        table = dynamodb.Table(AUTH_LOGS_TABLE)
        table.put_item(Item={
            "userId": user_id,
            "timestamp": datetime.now(UTC).isoformat(),
            "authType": action,
            "success": success,
            "ipAddress": ip,
            "userAgent": _sanitize_string(user_agent, 256),
            "reason": reason,
            "ttl": int((datetime.now(UTC) + timedelta(days=90)).timestamp()),
        })
    except Exception as e:
        logger.warning(f"Failed to log auth: {e}")

    # Always log to CloudWatch too
    level = logging.INFO if success else logging.WARNING
    logger.log(level,
        f"AUTH {action} {'OK' if success else 'FAIL'} user={user_id} ip={ip}"
        + (f" reason={reason}" if reason else "")
    )


# ── Response helpers ──

def _get_ip(event: dict) -> str:
    headers = event.get("headers", {}) or {}
    return (
        headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or event.get("requestContext", {}).get("identity", {}).get("sourceIp", "unknown")
    )


def _get_user_agent(event: dict) -> str:
    headers = event.get("headers", {}) or {}
    return headers.get("User-Agent", headers.get("user-agent", "unknown"))


def _cors_response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Api-Key",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            # Security headers
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        },
        "body": json.dumps(body),
    }


# Generic error to prevent user enumeration
_GENERIC_LOGIN_ERROR = "Email ou senha inválidos"


# ── Email verification codes ──

def _generate_code() -> str:
    """Generate a 6-digit numeric verification code."""
    return "".join(random.choices(string.digits, k=VERIFICATION_CODE_LENGTH))


def _store_verification_code(email: str, code: str, purpose: str = "email_verify") -> None:
    """Store verification code in RateLimits table (reuse for simplicity)."""
    table = dynamodb.Table(RATE_LIMITS_TABLE)
    now = int(time.time())
    expiry = VERIFICATION_CODE_EXPIRY if purpose == "email_verify" else RESET_CODE_EXPIRY
    hashed_code = hashlib.sha256(code.encode()).hexdigest()
    table.put_item(Item={
        "identifier": f"{purpose}:{email}",
        "code": hashed_code,
        "createdAt": now,
        "ttl": now + expiry + 60,
        "attempts": 0,
    })


def _verify_code(email: str, code: str, purpose: str = "email_verify") -> bool:
    """Verify a code — timing-safe, max 5 attempts."""
    table = dynamodb.Table(RATE_LIMITS_TABLE)
    key = f"{purpose}:{email}"
    try:
        result = table.get_item(Key={"identifier": key})
        item = result.get("Item")
        if not item:
            return False

        # Check max attempts
        attempts = int(item.get("attempts", 0))
        if attempts >= 5:
            return False

        # Increment attempts
        table.update_item(
            Key={"identifier": key},
            UpdateExpression="SET attempts = attempts + :inc",
            ExpressionAttributeValues={":inc": 1},
        )

        # Check expiry
        expiry = VERIFICATION_CODE_EXPIRY if purpose == "email_verify" else RESET_CODE_EXPIRY
        created = int(item.get("createdAt", 0))
        if int(time.time()) - created > expiry:
            return False

        # Timing-safe comparison
        hashed_input = hashlib.sha256(code.encode()).hexdigest()
        return hmac.compare_digest(hashed_input, item.get("code", ""))
    except Exception as e:
        logger.warning(f"Code verification failed: {e}")
        return False


def _delete_code(email: str, purpose: str = "email_verify") -> None:
    """Delete used verification code."""
    try:
        table = dynamodb.Table(RATE_LIMITS_TABLE)
        table.delete_item(Key={"identifier": f"{purpose}:{email}"})
    except Exception:
        pass


def _send_verification_email(email: str, code: str, purpose: str = "email_verify") -> bool:
    """Send verification code via SES."""
    sender = SES_SENDER_EMAIL
    if not sender:
        logger.error("SES_SENDER_EMAIL not configured")
        return False

    if purpose == "email_verify":
        subject = "B3 Tactical Ranking — Código de Verificação"
        body_html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
            <h2 style="color:#2563eb;">B3 Tactical Ranking</h2>
            <p>Seu código de verificação é:</p>
            <div style="background:#f1f5f9;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
                <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;">{code}</span>
            </div>
            <p style="color:#64748b;font-size:14px;">Este código expira em 15 minutos.</p>
            <p style="color:#64748b;font-size:14px;">Se você não solicitou este código, ignore este email.</p>
        </div>
        """
        body_text = f"Seu código de verificação B3 Tactical Ranking: {code}\nExpira em 15 minutos."
    else:
        subject = "B3 Tactical Ranking — Redefinir Senha"
        body_html = f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
            <h2 style="color:#2563eb;">B3 Tactical Ranking</h2>
            <p>Você solicitou a redefinição de senha. Use o código abaixo:</p>
            <div style="background:#f1f5f9;border-radius:8px;padding:20px;text-align:center;margin:20px 0;">
                <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;">{code}</span>
            </div>
            <p style="color:#64748b;font-size:14px;">Este código expira em 30 minutos.</p>
            <p style="color:#64748b;font-size:14px;">Se você não solicitou, ignore este email. Sua senha não será alterada.</p>
        </div>
        """
        body_text = f"Código para redefinir senha B3 Tactical Ranking: {code}\nExpira em 30 minutos."

    try:
        ses_client.send_email(
            Source=sender,
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Html": {"Data": body_html, "Charset": "UTF-8"},
                    "Text": {"Data": body_text, "Charset": "UTF-8"},
                },
            },
        )
        return True
    except ClientError as e:
        logger.error(f"SES send failed for {email}: {e}")
        return False


# ── Route handlers ──

def _handle_register(event: dict) -> dict:
    """Register a new user with full validation."""
    ip = _get_ip(event)
    ua = _get_user_agent(event)

    # Rate limit check
    if _check_rate_limit(ip):
        _log_auth("unknown", "register", False, ip, ua, "rate_limited")
        return _cors_response(429, {"message": "Muitas tentativas. Aguarde 15 minutos."})
    _increment_rate_limit(ip)

    # Parse body with size limit
    raw_body = event.get("body", "") or ""
    if len(raw_body) > MAX_BODY_SIZE:
        return _cors_response(413, {"message": "Request muito grande"})
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return _cors_response(400, {"message": "JSON inválido"})

    email = _normalize_email(body.get("email", ""))
    password = body.get("password", "")
    name = _sanitize_string(body.get("name", ""), NAME_MAX_LENGTH)

    if not email:
        return _cors_response(400, {"message": "Email inválido"})

    pwd_error = _validate_password(password)
    if pwd_error:
        return _cors_response(400, {"message": pwd_error})

    table = dynamodb.Table(USERS_TABLE)

    # Check if user exists
    try:
        existing = table.get_item(Key={"email": email}, ProjectionExpression="email")
        if "Item" in existing:
            _log_auth(email, "register", False, ip, ua, "email_exists")
            # Generic message to prevent enumeration
            return _cors_response(409, {"message": "Não foi possível criar a conta. Tente outro email."})
    except ClientError as e:
        logger.error(f"DynamoDB error checking user: {e}")
        return _cors_response(500, {"message": "Erro interno"})

    # Determine role
    role = "admin" if email == ADMIN_EMAIL.strip().lower() else "viewer"

    user_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()

    try:
        table.put_item(
            Item={
                "email": email,
                "userId": user_id,
                "name": name,
                "passwordHash": _hash_password(password),
                "role": role,
                "plan": "free",
                "createdAt": now,
                "updatedAt": now,
                "enabled": True,
                "emailVerified": False,
                "failedAttempts": 0,
            },
            ConditionExpression="attribute_not_exists(email)",  # Prevent race condition
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return _cors_response(409, {"message": "Não foi possível criar a conta. Tente outro email."})
        logger.error(f"DynamoDB error creating user: {e}")
        return _cors_response(500, {"message": "Erro interno"})

    # Send verification code
    code = _generate_code()
    _store_verification_code(email, code, "email_verify")
    _send_verification_email(email, code, "email_verify")

    # Issue JWT (limited — emailVerified=false)
    token = _create_jwt({
        "sub": user_id,
        "email": email,
        "role": role,
        "name": name,
        "emailVerified": False,
        "exp": int(time.time()) + SESSION_HOURS * 3600,
    })

    _log_auth(email, "register", True, ip, ua)

    return _cors_response(201, {
        "accessToken": token,
        "userId": user_id,
        "email": email,
        "name": name,
        "role": role,
        "emailVerified": False,
        "message": "Conta criada. Verifique seu email para ativar.",
    })


def _handle_login(event: dict) -> dict:
    """Authenticate user — rate limited, lockout protected."""
    ip = _get_ip(event)
    ua = _get_user_agent(event)

    # Rate limit check
    if _check_rate_limit(ip):
        _log_auth("unknown", "login", False, ip, ua, "rate_limited")
        return _cors_response(429, {"message": "Muitas tentativas. Aguarde 15 minutos."})
    _increment_rate_limit(ip)

    # Parse body
    raw_body = event.get("body", "") or ""
    if len(raw_body) > MAX_BODY_SIZE:
        return _cors_response(413, {"message": "Request muito grande"})
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return _cors_response(400, {"message": "JSON inválido"})

    email = _normalize_email(body.get("email", ""))
    password = body.get("password", "")

    if not email or not password:
        return _cors_response(400, {"message": "Email e senha são obrigatórios"})

    # Account lockout check
    if _check_account_locked(email):
        _log_auth(email, "login", False, ip, ua, "account_locked")
        return _cors_response(423, {"message": f"Conta bloqueada por {LOCKOUT_MINUTES} minutos após múltiplas tentativas."})

    table = dynamodb.Table(USERS_TABLE)

    try:
        result = table.get_item(Key={"email": email})
    except ClientError as e:
        logger.error(f"DynamoDB error: {e}")
        return _cors_response(500, {"message": "Erro interno"})

    item = result.get("Item")

    # Timing-safe: always verify even if user doesn't exist (prevent timing oracle)
    if not item:
        _hash_password("dummy-password-to-prevent-timing-attack")
        _log_auth(email, "login", False, ip, ua, "user_not_found")
        return _cors_response(401, {"message": _GENERIC_LOGIN_ERROR})

    if not item.get("enabled", True):
        _log_auth(email, "login", False, ip, ua, "account_disabled")
        return _cors_response(401, {"message": _GENERIC_LOGIN_ERROR})

    if not _verify_password(password, item.get("passwordHash", "")):
        _record_failed_attempt(email)
        _log_auth(email, "login", False, ip, ua, "wrong_password")
        return _cors_response(401, {"message": _GENERIC_LOGIN_ERROR})

    # Success — reset failed attempts
    _reset_failed_attempts(email)

    # Rehash if using old iteration count
    if _needs_rehash(item.get("passwordHash", "")):
        try:
            table.update_item(
                Key={"email": email},
                UpdateExpression="SET passwordHash = :h, updatedAt = :now",
                ExpressionAttributeValues={
                    ":h": _hash_password(password),
                    ":now": datetime.now(UTC).isoformat(),
                },
            )
            logger.info(f"Rehashed password for {email} to {PBKDF2_ITERATIONS} iterations")
        except Exception:
            pass  # Non-critical

    # Issue JWT
    token = _create_jwt({
        "sub": item["userId"],
        "email": email,
        "role": item.get("role", "viewer"),
        "name": item.get("name", ""),
        "plan": item.get("plan", "free"),
        "exp": int(time.time()) + SESSION_HOURS * 3600,
    })

    # Update last login
    try:
        table.update_item(
            Key={"email": email},
            UpdateExpression="SET lastLoginAt = :now",
            ExpressionAttributeValues={":now": datetime.now(UTC).isoformat()},
        )
    except Exception:
        pass

    _log_auth(email, "login", True, ip, ua)

    return _cors_response(200, {
        "accessToken": token,
        "userId": item["userId"],
        "email": email,
        "name": item.get("name", ""),
        "role": item.get("role", "viewer"),
        "plan": item.get("plan", "free"),
        "emailVerified": item.get("emailVerified", True),
    })


def _handle_me(event: dict) -> dict:
    """Get current user info from JWT."""
    headers = event.get("headers", {}) or {}
    auth = headers.get("Authorization", headers.get("authorization", ""))

    if not auth.startswith("Bearer "):
        return _cors_response(401, {"message": "Token não fornecido"})

    token = auth[7:].strip()
    if len(token) > 4096:  # Sanity check
        return _cors_response(401, {"message": "Token inválido"})

    payload = _verify_jwt(token)
    if not payload:
        return _cors_response(401, {"message": "Token inválido ou expirado"})

    email = payload.get("email", "")

    # Fetch fresh data from DB (plan may have changed or expired)
    table = dynamodb.Table(USERS_TABLE)
    try:
        result = table.get_item(Key={"email": email})
        item = result.get("Item", {})
        plan = item.get("plan", "free")
        plan_expires = item.get("planExpiresAt", "")

        # Auto-downgrade if plan expired
        if plan == "pro" and plan_expires:
            try:
                exp_dt = datetime.fromisoformat(plan_expires.replace("Z", "+00:00"))
                if datetime.now(UTC) > exp_dt:
                    plan = "free"
                    table.update_item(
                        Key={"email": email},
                        UpdateExpression="SET #p = :free, updatedAt = :now REMOVE planExpiresAt",
                        ExpressionAttributeNames={"#p": "plan"},
                        ExpressionAttributeValues={":free": "free", ":now": datetime.now(UTC).isoformat()},
                    )
                    logger.info(f"Auto-downgraded expired plan for {email}")
            except Exception:
                pass

        return _cors_response(200, {
            "userId": item.get("userId", payload.get("sub")),
            "email": email,
            "name": item.get("name", payload.get("name")),
            "role": item.get("role", payload.get("role")),
            "plan": plan,
            "planExpiresAt": plan_expires if plan == "pro" else "",
        })
    except Exception:
        # Fallback to JWT data
        return _cors_response(200, {
            "userId": payload.get("sub"),
            "email": payload.get("email"),
            "name": payload.get("name"),
            "role": payload.get("role"),
            "plan": payload.get("plan", "free"),
        })


def _handle_verify_email(event: dict) -> dict:
    """Verify email with 6-digit code."""
    ip = _get_ip(event)
    ua = _get_user_agent(event)

    if _check_rate_limit(ip):
        return _cors_response(429, {"message": "Muitas tentativas. Aguarde 15 minutos."})
    _increment_rate_limit(ip)

    raw_body = event.get("body", "") or ""
    if len(raw_body) > MAX_BODY_SIZE:
        return _cors_response(413, {"message": "Request muito grande"})
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return _cors_response(400, {"message": "JSON inválido"})

    email = _normalize_email(body.get("email", ""))
    code = _sanitize_string(body.get("code", ""), 10)

    if not email or not code:
        return _cors_response(400, {"message": "Email e código são obrigatórios"})

    if not _verify_code(email, code, "email_verify"):
        _log_auth(email, "verify_email", False, ip, ua, "invalid_code")
        return _cors_response(400, {"message": "Código inválido ou expirado"})

    # Mark email as verified
    table = dynamodb.Table(USERS_TABLE)
    try:
        result = table.update_item(
            Key={"email": email},
            UpdateExpression="SET emailVerified = :v, updatedAt = :now",
            ExpressionAttributeValues={":v": True, ":now": datetime.now(UTC).isoformat()},
            ReturnValues="ALL_NEW",
        )
        item = result.get("Attributes", {})
    except ClientError as e:
        logger.error(f"DynamoDB error verifying email: {e}")
        return _cors_response(500, {"message": "Erro interno"})

    _delete_code(email, "email_verify")

    # Issue fresh JWT with emailVerified=true
    token = _create_jwt({
        "sub": item.get("userId", ""),
        "email": email,
        "role": item.get("role", "viewer"),
        "name": item.get("name", ""),
        "emailVerified": True,
        "exp": int(time.time()) + SESSION_HOURS * 3600,
    })

    _log_auth(email, "verify_email", True, ip, ua)

    return _cors_response(200, {
        "message": "Email verificado com sucesso",
        "accessToken": token,
        "emailVerified": True,
    })


def _handle_resend_code(event: dict) -> dict:
    """Resend verification code."""
    ip = _get_ip(event)
    ua = _get_user_agent(event)

    if _check_rate_limit(ip):
        return _cors_response(429, {"message": "Muitas tentativas. Aguarde 15 minutos."})
    _increment_rate_limit(ip)

    raw_body = event.get("body", "") or ""
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return _cors_response(400, {"message": "JSON inválido"})

    email = _normalize_email(body.get("email", ""))
    if not email:
        return _cors_response(400, {"message": "Email inválido"})

    # Always return success to prevent enumeration
    table = dynamodb.Table(USERS_TABLE)
    try:
        result = table.get_item(Key={"email": email}, ProjectionExpression="email, emailVerified")
        item = result.get("Item")
        if item and not item.get("emailVerified", True):
            code = _generate_code()
            _store_verification_code(email, code, "email_verify")
            _send_verification_email(email, code, "email_verify")
    except Exception as e:
        logger.warning(f"Resend code error: {e}")

    _log_auth(email, "resend_code", True, ip, ua)
    return _cors_response(200, {"message": "Se o email existir, um novo código foi enviado."})


def _handle_forgot_password(event: dict) -> dict:
    """Send password reset code to email."""
    ip = _get_ip(event)
    ua = _get_user_agent(event)

    if _check_rate_limit(ip):
        return _cors_response(429, {"message": "Muitas tentativas. Aguarde 15 minutos."})
    _increment_rate_limit(ip)

    raw_body = event.get("body", "") or ""
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return _cors_response(400, {"message": "JSON inválido"})

    email = _normalize_email(body.get("email", ""))
    if not email:
        return _cors_response(400, {"message": "Email inválido"})

    # Always return success to prevent enumeration
    table = dynamodb.Table(USERS_TABLE)
    try:
        result = table.get_item(Key={"email": email}, ProjectionExpression="email, enabled")
        item = result.get("Item")
        if item and item.get("enabled", True):
            code = _generate_code()
            _store_verification_code(email, code, "password_reset")
            _send_verification_email(email, code, "password_reset")
    except Exception as e:
        logger.warning(f"Forgot password error: {e}")

    _log_auth(email, "forgot_password", True, ip, ua)
    return _cors_response(200, {"message": "Se o email existir, um código de redefinição foi enviado."})


def _handle_reset_password(event: dict) -> dict:
    """Reset password with verification code."""
    ip = _get_ip(event)
    ua = _get_user_agent(event)

    if _check_rate_limit(ip):
        return _cors_response(429, {"message": "Muitas tentativas. Aguarde 15 minutos."})
    _increment_rate_limit(ip)

    raw_body = event.get("body", "") or ""
    if len(raw_body) > MAX_BODY_SIZE:
        return _cors_response(413, {"message": "Request muito grande"})
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return _cors_response(400, {"message": "JSON inválido"})

    email = _normalize_email(body.get("email", ""))
    code = _sanitize_string(body.get("code", ""), 10)
    new_password = body.get("newPassword", "")

    if not email or not code or not new_password:
        return _cors_response(400, {"message": "Email, código e nova senha são obrigatórios"})

    pwd_error = _validate_password(new_password)
    if pwd_error:
        return _cors_response(400, {"message": pwd_error})

    if not _verify_code(email, code, "password_reset"):
        _log_auth(email, "reset_password", False, ip, ua, "invalid_code")
        return _cors_response(400, {"message": "Código inválido ou expirado"})

    # Update password
    table = dynamodb.Table(USERS_TABLE)
    try:
        table.update_item(
            Key={"email": email},
            UpdateExpression="SET passwordHash = :h, updatedAt = :now, failedAttempts = :zero REMOVE lockedUntil",
            ExpressionAttributeValues={
                ":h": _hash_password(new_password),
                ":now": datetime.now(UTC).isoformat(),
                ":zero": 0,
            },
        )
    except ClientError as e:
        logger.error(f"DynamoDB error resetting password: {e}")
        return _cors_response(500, {"message": "Erro interno"})

    _delete_code(email, "password_reset")
    _log_auth(email, "reset_password", True, ip, ua)

    return _cors_response(200, {"message": "Senha redefinida com sucesso. Faça login com a nova senha."})


def _handle_change_password(event: dict) -> dict:
    """Change password for authenticated user (requires current password)."""
    ip = _get_ip(event)
    ua = _get_user_agent(event)

    if _check_rate_limit(ip):
        return _cors_response(429, {"message": "Muitas tentativas. Aguarde 15 minutos."})
    _increment_rate_limit(ip)

    # Verify JWT
    headers = event.get("headers", {}) or {}
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return _cors_response(401, {"message": "Token não fornecido"})

    token = auth[7:].strip()
    if len(token) > 4096:
        return _cors_response(401, {"message": "Token inválido"})

    payload = _verify_jwt(token)
    if not payload:
        return _cors_response(401, {"message": "Token inválido ou expirado"})

    email = payload.get("email", "")
    if not email:
        return _cors_response(401, {"message": "Token inválido"})

    # Parse body
    raw_body = event.get("body", "") or ""
    if len(raw_body) > MAX_BODY_SIZE:
        return _cors_response(413, {"message": "Request muito grande"})
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return _cors_response(400, {"message": "JSON inválido"})

    current_password = body.get("currentPassword", "")
    new_password = body.get("newPassword", "")

    if not current_password or not new_password:
        return _cors_response(400, {"message": "Senha atual e nova senha são obrigatórias"})

    # Validate new password strength
    pwd_error = _validate_password(new_password)
    if pwd_error:
        return _cors_response(400, {"message": pwd_error})

    # Fetch user
    table = dynamodb.Table(USERS_TABLE)
    try:
        result = table.get_item(Key={"email": email})
    except ClientError as e:
        logger.error(f"DynamoDB error: {e}")
        return _cors_response(500, {"message": "Erro interno"})

    user = result.get("Item")
    if not user:
        return _cors_response(401, {"message": "Credenciais inválidas"})

    # Verify current password
    if not _verify_password(current_password, user.get("passwordHash", "")):
        _log_auth(email, "change_password", False, ip, ua, "wrong_current_password")
        return _cors_response(400, {"message": "Senha atual incorreta"})

    # Hash new password and update
    new_hash = _hash_password(new_password)
    try:
        table.update_item(
            Key={"email": email},
            UpdateExpression="SET passwordHash = :h, updatedAt = :now",
            ExpressionAttributeValues={
                ":h": new_hash,
                ":now": datetime.now(UTC).isoformat(),
            },
        )
    except ClientError as e:
        logger.error(f"DynamoDB error changing password: {e}")
        return _cors_response(500, {"message": "Erro interno"})

    _log_auth(email, "change_password", True, ip, ua)
    return _cors_response(200, {"message": "Senha alterada com sucesso."})


# ── Notifications (Admin) ──

NOTIFICATIONS_TABLE = os.environ.get("NOTIFICATIONS_TABLE", "B3Dashboard-Notifications")
CHAT_TABLE = os.environ.get("CHAT_TABLE", "B3Dashboard-Chat")


def _require_admin(event: dict) -> Optional[dict]:
    """Verify JWT and check admin role. Returns user dict or None."""
    auth_header = ""
    headers = event.get("headers") or {}
    for k, v in headers.items():
        if k.lower() == "authorization":
            auth_header = v
            break
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]
    payload = _verify_jwt(token)
    if not payload:
        return None
    if payload.get("role") != "admin":
        return None
    return payload


def _handle_get_notifications(event: dict) -> dict:
    """GET /admin/notifications — list all notifications."""
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    try:
        table = dynamodb.Table(NOTIFICATIONS_TABLE)
        result = table.scan()
        items = result.get("Items", [])
        # Convert Decimal to float
        for item in items:
            for k, v in item.items():
                if isinstance(v, Decimal):
                    item[k] = float(v)
        items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return _cors_response(200, {"notifications": items})
    except Exception as e:
        logger.error(f"Error listing notifications: {e}")
        return _cors_response(500, {"message": "Erro ao listar notificações"})


def _handle_create_notification(event: dict) -> dict:
    """POST /admin/notifications — create a notification."""
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors_response(400, {"message": "JSON inválido"})

    title = _sanitize_string(body.get("title", ""), 200)
    message = _sanitize_string(body.get("message", ""), 1000)
    notif_type = body.get("type", "manual")  # manual, auto_model_run, auto_recommendations, auto_strong_signals, auto_history
    target = body.get("target", "all")  # all, free, pro
    enabled = body.get("enabled", True)

    if not title or not message:
        return _cors_response(400, {"message": "Título e mensagem são obrigatórios"})

    if notif_type not in ("manual", "auto_model_run", "auto_recommendations", "auto_strong_signals", "auto_history"):
        return _cors_response(400, {"message": "Tipo inválido"})

    if target not in ("all", "free", "pro"):
        return _cors_response(400, {"message": "Target inválido"})

    notif_id = str(uuid.uuid4())[:8]
    now = datetime.now(UTC).isoformat()

    item = {
        "id": notif_id,
        "title": title,
        "message": message,
        "type": notif_type,
        "target": target,
        "enabled": enabled,
        "created_at": now,
        "created_by": admin.get("email", "admin"),
    }

    try:
        table = dynamodb.Table(NOTIFICATIONS_TABLE)
        table.put_item(Item=item)
        return _cors_response(201, {"message": "Notificação criada", "notification": item})
    except Exception as e:
        logger.error(f"Error creating notification: {e}")
        return _cors_response(500, {"message": "Erro ao criar notificação"})


def _handle_update_notification(event: dict) -> dict:
    """PUT /admin/notifications — update a notification."""
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors_response(400, {"message": "JSON inválido"})

    notif_id = body.get("id", "")
    if not notif_id:
        return _cors_response(400, {"message": "ID obrigatório"})

    update_expr_parts = []
    expr_values = {}
    expr_names = {}

    if "title" in body:
        update_expr_parts.append("#t = :t")
        expr_names["#t"] = "title"
        expr_values[":t"] = _sanitize_string(body["title"], 200)
    if "message" in body:
        update_expr_parts.append("#m = :m")
        expr_names["#m"] = "message"
        expr_values[":m"] = _sanitize_string(body["message"], 1000)
    if "enabled" in body:
        update_expr_parts.append("#e = :e")
        expr_names["#e"] = "enabled"
        expr_values[":e"] = bool(body["enabled"])
    if "target" in body:
        update_expr_parts.append("#tg = :tg")
        expr_names["#tg"] = "target"
        expr_values[":tg"] = body["target"]

    if not update_expr_parts:
        return _cors_response(400, {"message": "Nenhum campo para atualizar"})

    try:
        table = dynamodb.Table(NOTIFICATIONS_TABLE)
        table.update_item(
            Key={"id": notif_id},
            UpdateExpression="SET " + ", ".join(update_expr_parts),
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
        )
        return _cors_response(200, {"message": "Notificação atualizada"})
    except Exception as e:
        logger.error(f"Error updating notification: {e}")
        return _cors_response(500, {"message": "Erro ao atualizar notificação"})


def _handle_delete_notification(event: dict) -> dict:
    """DELETE /admin/notifications — delete a notification."""
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors_response(400, {"message": "JSON inválido"})

    notif_id = body.get("id", "")
    if not notif_id:
        return _cors_response(400, {"message": "ID obrigatório"})

    try:
        table = dynamodb.Table(NOTIFICATIONS_TABLE)
        table.delete_item(Key={"id": notif_id})
        return _cors_response(200, {"message": "Notificação removida"})
    except Exception as e:
        logger.error(f"Error deleting notification: {e}")
        return _cors_response(500, {"message": "Erro ao remover notificação"})


def _handle_get_user_notifications(event: dict) -> dict:
    """GET /notifications — get notifications for the current user (based on plan)."""
    auth_header = ""
    headers = event.get("headers") or {}
    for k, v in headers.items():
        if k.lower() == "authorization":
            auth_header = v
            break
    if not auth_header.startswith("Bearer "):
        return _cors_response(401, {"message": "Token obrigatório"})
    token = auth_header[7:]
    payload = _verify_jwt(token)
    if not payload:
        return _cors_response(401, {"message": "Token inválido"})

    user_plan = payload.get("plan", "free")

    try:
        table = dynamodb.Table(NOTIFICATIONS_TABLE)
        result = table.scan()
        items = result.get("Items", [])

        # Filter: enabled + target matches user plan
        filtered = []
        for item in items:
            if not item.get("enabled", True):
                continue
            target = item.get("target", "all")
            if target == "all" or target == user_plan:
                for k, v in item.items():
                    if isinstance(v, Decimal):
                        item[k] = float(v)
                filtered.append(item)

        filtered.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return _cors_response(200, {"notifications": filtered})
    except Exception as e:
        logger.error(f"Error fetching user notifications: {e}")
        return _cors_response(200, {"notifications": []})


def _handle_update_phone(event: dict) -> dict:
    """Update phone number for authenticated user (for WhatsApp alerts)."""
    ip = _get_ip(event)
    ua = _get_user_agent(event)

    if _check_rate_limit(ip):
        return _cors_response(429, {"message": "Muitas tentativas. Aguarde 15 minutos."})
    _increment_rate_limit(ip)

    # Verify JWT
    headers = event.get("headers", {}) or {}
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return _cors_response(401, {"message": "Token não fornecido"})

    token = auth[7:].strip()
    payload = _verify_jwt(token)
    if not payload:
        return _cors_response(401, {"message": "Token inválido ou expirado"})

    email = payload.get("email", "")
    if not email:
        return _cors_response(401, {"message": "Token inválido"})

    raw_body = event.get("body", "") or ""
    if len(raw_body) > MAX_BODY_SIZE:
        return _cors_response(413, {"message": "Request muito grande"})
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return _cors_response(400, {"message": "JSON inválido"})

    phone = _sanitize_string(body.get("phone", ""), 20)
    # Strip non-digit except leading +
    phone_clean = ""
    if phone:
        phone_clean = re.sub(r"[^\d+]", "", phone)
        # Validate: must be +55XXXXXXXXXXX (Brazilian) or similar international
        if not re.match(r"^\+?\d{10,15}$", phone_clean):
            return _cors_response(400, {"message": "Número inválido. Use formato: +5511999999999"})

    whatsapp_enabled = body.get("whatsappEnabled", False)

    table = dynamodb.Table(USERS_TABLE)
    try:
        table.update_item(
            Key={"email": email},
            UpdateExpression="SET phone = :p, whatsappEnabled = :w, updatedAt = :now",
            ExpressionAttributeValues={
                ":p": phone_clean,
                ":w": bool(whatsapp_enabled),
                ":now": datetime.now(UTC).isoformat(),
            },
        )
    except ClientError as e:
        logger.error(f"DynamoDB error updating phone: {e}")
        return _cors_response(500, {"message": "Erro interno"})

    _log_auth(email, "update_phone", True, ip, ua)
    return _cors_response(200, {"message": "Telefone atualizado com sucesso.", "phone": phone_clean, "whatsappEnabled": whatsapp_enabled})


def _handle_get_phone(event: dict) -> dict:
    """Get phone number for authenticated user."""
    headers = event.get("headers", {}) or {}
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return _cors_response(401, {"message": "Token não fornecido"})

    token = auth[7:].strip()
    payload = _verify_jwt(token)
    if not payload:
        return _cors_response(401, {"message": "Token inválido ou expirado"})

    email = payload.get("email", "")
    if not email:
        return _cors_response(401, {"message": "Token inválido"})

    table = dynamodb.Table(USERS_TABLE)
    try:
        result = table.get_item(Key={"email": email}, ProjectionExpression="phone, whatsappEnabled")
        item = result.get("Item", {})
        return _cors_response(200, {
            "phone": item.get("phone", ""),
            "whatsappEnabled": bool(item.get("whatsappEnabled", False)),
        })
    except ClientError as e:
        logger.error(f"DynamoDB error: {e}")
        return _cors_response(500, {"message": "Erro interno"})


def _handle_send_whatsapp_notification(event: dict) -> dict:
    """Admin: send WhatsApp notification to eligible users via WhatsApp API link generation."""
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors_response(400, {"message": "JSON inválido"})

    message = _sanitize_string(body.get("message", ""), 1000)
    target = body.get("target", "pro")  # default to pro users

    if not message:
        return _cors_response(400, {"message": "Mensagem é obrigatória"})

    # Scan users with whatsappEnabled=true and phone set
    table = dynamodb.Table(USERS_TABLE)
    try:
        result = table.scan(
            FilterExpression="whatsappEnabled = :w AND attribute_exists(phone) AND phone <> :empty",
            ExpressionAttributeValues={":w": True, ":empty": ""},
        )
        users = result.get("Items", [])

        # Filter by target plan
        if target != "all":
            users = [u for u in users if u.get("plan", "free") == target]

        phones = [u.get("phone", "") for u in users if u.get("phone")]

        logger.info(f"WhatsApp notification: {len(phones)} recipients, target={target}")

        return _cors_response(200, {
            "message": f"Lista de {len(phones)} destinatários gerada.",
            "recipientCount": len(phones),
            "phones": phones,
            "whatsappMessage": message,
        })
    except Exception as e:
        logger.error(f"Error fetching WhatsApp recipients: {e}")
        return _cors_response(500, {"message": "Erro ao buscar destinatários"})


def _handle_stats(event: dict) -> dict:
    """Public endpoint: return user count and last recommendation date."""
    try:
        table = dynamodb.Table(USERS_TABLE)
        # Use scan with Select=COUNT for efficiency (no data returned)
        result = table.scan(Select="COUNT")
        user_count = result.get("Count", 0)
        return _cors_response(200, {"userCount": user_count})
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        return _cors_response(200, {"userCount": 0})


# ── Stripe helpers ──

def _stripe_request(method: str, endpoint: str, data: dict = None) -> dict:
    """Make a request to Stripe API using urllib (no external deps)."""
    import urllib.request
    import urllib.parse
    import urllib.error

    url = f"https://api.stripe.com/v1/{endpoint}"
    headers_dict = {
        "Authorization": f"Bearer {STRIPE_SECRET_KEY}",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    body = None
    if data:
        body = urllib.parse.urlencode(_flatten_dict(data)).encode("utf-8")

    req = urllib.request.Request(url, data=body, headers=headers_dict, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        logger.error(f"Stripe API error {e.code}: {error_body}")
        raise Exception(f"Stripe error {e.code}: {error_body}")


def _flatten_dict(d: dict, parent_key: str = "") -> list:
    """Flatten nested dict for Stripe's form-encoded API. Returns list of (key, value) tuples."""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}[{k}]" if parent_key else k
        if isinstance(v, dict):
            items.extend(_flatten_dict(v, new_key))
        elif isinstance(v, list):
            for i, item in enumerate(v):
                if isinstance(item, dict):
                    items.extend(_flatten_dict(item, f"{new_key}[{i}]"))
                else:
                    items.append((f"{new_key}[{i}]", str(item)))
        else:
            items.append((new_key, str(v)))
    return items


def _verify_stripe_signature(payload: str, sig_header: str) -> bool:
    """Verify Stripe webhook signature (v1)."""
    if not STRIPE_WEBHOOK_SECRET or not sig_header:
        return False
    try:
        elements = {}
        for part in sig_header.split(","):
            k, v = part.strip().split("=", 1)
            elements.setdefault(k, []).append(v)

        timestamp = elements.get("t", [None])[0]
        signatures = elements.get("v1", [])
        if not timestamp or not signatures:
            return False

        # Check timestamp tolerance (5 min)
        if abs(int(time.time()) - int(timestamp)) > 300:
            return False

        signed_payload = f"{timestamp}.{payload}"
        expected = hmac.new(
            STRIPE_WEBHOOK_SECRET.encode("utf-8"),
            signed_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return any(hmac.compare_digest(expected, s) for s in signatures)
    except Exception as e:
        logger.error(f"Stripe signature verification failed: {e}")
        return False


def _handle_create_checkout(event: dict) -> dict:
    """POST /auth/create-checkout — create Stripe Checkout Session for Pro upgrade."""
    ip = _get_ip(event)
    ua = _get_user_agent(event)

    if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
        return _cors_response(503, {"message": "Pagamento não configurado. Entre em contato pelo WhatsApp."})

    # Verify JWT
    headers = event.get("headers", {}) or {}
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return _cors_response(401, {"message": "Token não fornecido"})

    payload = _verify_jwt(auth[7:].strip())
    if not payload:
        return _cors_response(401, {"message": "Token inválido ou expirado"})

    email = payload.get("email", "")
    user_id = payload.get("sub", "")

    if not email:
        return _cors_response(401, {"message": "Token inválido"})

    # Check if already pro
    table = dynamodb.Table(USERS_TABLE)
    try:
        result = table.get_item(Key={"email": email}, ProjectionExpression="#p, stripeCustomerId", ExpressionAttributeNames={"#p": "plan"})
        item = result.get("Item", {})
        if item.get("plan") == "pro":
            return _cors_response(400, {"message": "Você já é Pro!"})
    except Exception:
        pass

    try:
        # Check if user already has a Stripe customer ID
        stripe_customer_id = item.get("stripeCustomerId", "")

        if not stripe_customer_id:
            # Create Stripe customer
            customer = _stripe_request("POST", "customers", {
                "email": email,
                "metadata": {"userId": user_id, "source": "b3tactical"},
            })
            stripe_customer_id = customer["id"]

            # Save customer ID
            table.update_item(
                Key={"email": email},
                UpdateExpression="SET stripeCustomerId = :cid",
                ExpressionAttributeValues={":cid": stripe_customer_id},
            )

        # Create Checkout Session
        session = _stripe_request("POST", "checkout/sessions", {
            "customer": stripe_customer_id,
            "mode": "subscription",
            "payment_method_types": {"0": "card"},
            "line_items": {"0": {"price": STRIPE_PRICE_ID, "quantity": "1"}},
            "success_url": f"{FRONTEND_URL}/#/dashboard/upgrade?session_id={{CHECKOUT_SESSION_ID}}&status=success",
            "cancel_url": f"{FRONTEND_URL}/#/dashboard/upgrade?status=cancelled",
            "metadata": {"userId": user_id, "email": email},
            "subscription_data": {"metadata": {"userId": user_id, "email": email}},
            "allow_promotion_codes": "true",
        })

        _log_auth(email, "create_checkout", True, ip, ua)

        return _cors_response(200, {
            "checkoutUrl": session["url"],
            "sessionId": session["id"],
        })

    except Exception as e:
        logger.error(f"Stripe checkout creation failed: {e}")
        _log_auth(email, "create_checkout", False, ip, ua, str(e))
        return _cors_response(500, {"message": "Erro ao criar sessão de pagamento. Tente novamente."})


def _handle_stripe_webhook(event: dict) -> dict:
    """POST /auth/stripe-webhook — handle Stripe webhook events."""
    raw_body = event.get("body", "") or ""
    headers = event.get("headers", {}) or {}
    sig = headers.get("Stripe-Signature", headers.get("stripe-signature", ""))

    if not _verify_stripe_signature(raw_body, sig):
        logger.warning("Stripe webhook: invalid signature")
        return _cors_response(400, {"message": "Invalid signature"})

    try:
        evt = json.loads(raw_body)
    except json.JSONDecodeError:
        return _cors_response(400, {"message": "Invalid JSON"})

    evt_type = evt.get("type", "")
    data_obj = evt.get("data", {}).get("object", {})

    logger.info(f"Stripe webhook: {evt_type}")

    table = dynamodb.Table(USERS_TABLE)

    if evt_type == "checkout.session.completed":
        # Payment successful — upgrade user
        email = (data_obj.get("metadata", {}).get("email", "") or
                 data_obj.get("customer_details", {}).get("email", ""))
        subscription_id = data_obj.get("subscription", "")
        customer_id = data_obj.get("customer", "")

        if email:
            email = email.lower().strip()
            try:
                now = datetime.now(UTC).isoformat()
                table.update_item(
                    Key={"email": email},
                    UpdateExpression="SET #p = :pro, stripeSubscriptionId = :sid, stripeCustomerId = :cid, upgradedAt = :now, updatedAt = :now",
                    ExpressionAttributeNames={"#p": "plan"},
                    ExpressionAttributeValues={
                        ":pro": "pro",
                        ":sid": subscription_id,
                        ":cid": customer_id,
                        ":now": now,
                    },
                )
                logger.info(f"User upgraded to Pro: {email}")
                _log_auth(email, "upgrade_pro", True, "stripe", "webhook")

                # Send confirmation email
                _send_upgrade_email(email)

            except Exception as e:
                logger.error(f"Failed to upgrade user {email}: {e}")
                return _cors_response(500, {"message": "Failed to process"})

    elif evt_type in ("customer.subscription.deleted", "customer.subscription.paused"):
        # Subscription cancelled — set expiry to current_period_end so user keeps Pro until paid period ends
        email = data_obj.get("metadata", {}).get("email", "")
        customer_id = data_obj.get("customer", "")

        # If no email in metadata, look up by customer ID
        if not email and customer_id:
            try:
                result = table.scan(
                    FilterExpression="stripeCustomerId = :cid",
                    ExpressionAttributeValues={":cid": customer_id},
                    ProjectionExpression="email",
                )
                items = result.get("Items", [])
                if items:
                    email = items[0].get("email", "")
            except Exception:
                pass

        if email:
            email = email.lower().strip()
            try:
                now = datetime.now(UTC).isoformat()
                # Get current_period_end from subscription — user keeps Pro until then
                period_end_ts = data_obj.get("current_period_end")
                if period_end_ts:
                    expires_at = datetime.fromtimestamp(int(period_end_ts), tz=UTC).isoformat()
                    table.update_item(
                        Key={"email": email},
                        UpdateExpression="SET planExpiresAt = :exp, updatedAt = :now REMOVE stripeSubscriptionId",
                        ExpressionAttributeValues={":exp": expires_at, ":now": now},
                    )
                    logger.info(f"Subscription cancelled for {email}, Pro until {expires_at}")
                else:
                    # No period end — downgrade immediately
                    table.update_item(
                        Key={"email": email},
                        UpdateExpression="SET #p = :free, updatedAt = :now REMOVE stripeSubscriptionId, planExpiresAt",
                        ExpressionAttributeNames={"#p": "plan"},
                        ExpressionAttributeValues={":free": "free", ":now": now},
                    )
                    logger.info(f"User downgraded to Free (no period end): {email}")
                _log_auth(email, "subscription_cancelled", True, "stripe", "webhook")
            except Exception as e:
                logger.error(f"Failed to handle cancellation for {email}: {e}")

    elif evt_type == "invoice.payment_failed":
        # Payment failed — notify but don't downgrade yet (Stripe retries)
        email = data_obj.get("customer_email", "")
        if email:
            logger.warning(f"Payment failed for {email}")
            _log_auth(email, "payment_failed", False, "stripe", "webhook")

    return _cors_response(200, {"received": True})


def _send_upgrade_email(email: str) -> None:
    """Send Pro upgrade confirmation email."""
    sender = SES_SENDER_EMAIL
    if not sender:
        return
    try:
        ses_client.send_email(
            Source=sender,
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": "🎉 Bem-vindo ao Pro — B3 Tactical Ranking", "Charset": "UTF-8"},
                "Body": {
                    "Html": {
                        "Data": f"""
                        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;">
                            <h2 style="color:#f59e0b;">🎉 Você agora é Pro!</h2>
                            <p>Seu plano Pro do B3 Tactical Ranking foi ativado com sucesso.</p>
                            <p>Agora você tem acesso a:</p>
                            <ul>
                                <li>Todas as colunas desbloqueadas (Confiança, Stop-Loss, Take-Profit)</li>
                                <li>Carteira Modelo otimizada</li>
                                <li>Tracking por Safra</li>
                                <li>Alertas de preço</li>
                            </ul>
                            <p style="color:#64748b;font-size:14px;">Qualquer dúvida, responda este email.</p>
                        </div>
                        """,
                        "Charset": "UTF-8",
                    },
                    "Text": {
                        "Data": "Você agora é Pro! Seu plano foi ativado. Acesse: https://uesleisutil.github.io/b3-tactical-ranking/",
                        "Charset": "UTF-8",
                    },
                },
            },
        )
    except Exception as e:
        logger.warning(f"Failed to send upgrade email to {email}: {e}")


def _handle_check_session(event: dict) -> dict:
    """GET /auth/check-session — check if checkout session completed and return updated plan."""
    headers = event.get("headers", {}) or {}
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return _cors_response(401, {"message": "Token não fornecido"})

    payload = _verify_jwt(auth[7:].strip())
    if not payload:
        return _cors_response(401, {"message": "Token inválido ou expirado"})

    email = payload.get("email", "")
    if not email:
        return _cors_response(401, {"message": "Token inválido"})

    # Fetch current plan from DB
    table = dynamodb.Table(USERS_TABLE)
    try:
        result = table.get_item(Key={"email": email}, ProjectionExpression="#p, stripeSubscriptionId, planExpiresAt", ExpressionAttributeNames={"#p": "plan"})
        item = result.get("Item", {})
        plan = item.get("plan", "free")
        has_subscription = bool(item.get("stripeSubscriptionId"))
        plan_expires = item.get("planExpiresAt", "")

        # Auto-downgrade if expired
        if plan == "pro" and plan_expires:
            try:
                exp_dt = datetime.fromisoformat(plan_expires.replace("Z", "+00:00"))
                if datetime.now(UTC) > exp_dt:
                    plan = "free"
                    plan_expires = ""
                    table.update_item(
                        Key={"email": email},
                        UpdateExpression="SET #p = :free, updatedAt = :now REMOVE planExpiresAt",
                        ExpressionAttributeNames={"#p": "plan"},
                        ExpressionAttributeValues={":free": "free", ":now": datetime.now(UTC).isoformat()},
                    )
            except Exception:
                pass

        # Issue fresh JWT with updated plan
        new_token = _create_jwt({
            "sub": payload.get("sub"),
            "email": email,
            "role": payload.get("role", "viewer"),
            "name": payload.get("name", ""),
            "plan": plan,
            "exp": int(time.time()) + SESSION_HOURS * 3600,
        })

        return _cors_response(200, {
            "plan": plan,
            "hasSubscription": has_subscription,
            "planExpiresAt": plan_expires,
            "accessToken": new_token,
        })
    except Exception as e:
        logger.error(f"Error checking session: {e}")
        return _cors_response(500, {"message": "Erro interno"})


def _handle_manage_billing(event: dict) -> dict:
    """POST /auth/manage-billing — create Stripe Customer Portal session."""
    if not STRIPE_SECRET_KEY:
        return _cors_response(503, {"message": "Pagamento não configurado."})

    headers = event.get("headers", {}) or {}
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return _cors_response(401, {"message": "Token não fornecido"})

    payload = _verify_jwt(auth[7:].strip())
    if not payload:
        return _cors_response(401, {"message": "Token inválido ou expirado"})

    email = payload.get("email", "")
    if not email:
        return _cors_response(401, {"message": "Token inválido"})

    table = dynamodb.Table(USERS_TABLE)
    try:
        result = table.get_item(Key={"email": email}, ProjectionExpression="stripeCustomerId")
        customer_id = result.get("Item", {}).get("stripeCustomerId", "")
        if not customer_id:
            return _cors_response(400, {"message": "Nenhuma assinatura encontrada."})

        session = _stripe_request("POST", "billing_portal/sessions", {
            "customer": customer_id,
            "return_url": f"{FRONTEND_URL}/#/dashboard/upgrade",
        })

        return _cors_response(200, {"portalUrl": session["url"]})
    except Exception as e:
        logger.error(f"Stripe portal error: {e}")
        return _cors_response(500, {"message": "Erro ao abrir portal de pagamento."})


# ── Admin user management ──

def _get_authenticated_user(event: dict) -> Optional[dict]:
    """Verify JWT and return payload. Returns None if invalid."""
    headers = event.get("headers", {}) or {}
    auth = headers.get("Authorization", headers.get("authorization", ""))
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    if len(token) > 4096:
        return None
    return _verify_jwt(token)


# ── Support Chat ──

def _handle_chat_send(event: dict) -> dict:
    """POST /chat/messages — user sends a message (creates ticket if needed)."""
    user = _get_authenticated_user(event)
    if not user:
        return _cors_response(401, {"message": "Token inválido"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors_response(400, {"message": "JSON inválido"})

    message = _sanitize_string(body.get("message", ""), 2000)
    if not message:
        return _cors_response(400, {"message": "Mensagem obrigatória"})

    email = user.get("email", "")
    user_name = user.get("name", "") or email.split("@")[0]
    now = datetime.now(UTC).isoformat()
    table = dynamodb.Table(CHAT_TABLE)

    # Check if user has an open ticket
    ticket_id = body.get("ticketId", "")

    if not ticket_id:
        # Look for existing open ticket
        try:
            result = table.scan(
                FilterExpression="userEmail = :e AND #s <> :closed",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={":e": email, ":closed": "closed"},
            )
            items = result.get("Items", [])
            if items:
                # Use most recent open ticket
                items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
                ticket_id = items[0].get("ticketId", "")
        except Exception:
            pass

    if not ticket_id:
        # Create new ticket
        ticket_id = str(uuid.uuid4())[:12]
        table.put_item(Item={
            "ticketId": ticket_id,
            "userEmail": email,
            "userName": user_name,
            "status": "open",  # open, answered, closed
            "subject": message[:80],
            "createdAt": now,
            "updatedAt": now,
            "messages": [{
                "id": str(uuid.uuid4())[:8],
                "sender": "user",
                "senderName": user_name,
                "message": message,
                "timestamp": now,
            }],
            "ttl": int((datetime.now(UTC) + timedelta(days=180)).timestamp()),
        })
        return _cors_response(201, {"ticketId": ticket_id, "message": "Chamado criado"})

    # Append message to existing ticket
    try:
        msg_item = {
            "id": str(uuid.uuid4())[:8],
            "sender": "user",
            "senderName": user_name,
            "message": message,
            "timestamp": now,
        }
        table.update_item(
            Key={"ticketId": ticket_id},
            UpdateExpression="SET messages = list_append(messages, :msg), updatedAt = :now, #s = :open",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":msg": [msg_item],
                ":now": now,
                ":open": "open",
            },
        )
        return _cors_response(200, {"ticketId": ticket_id, "message": "Mensagem enviada"})
    except Exception as e:
        logger.error(f"Error sending chat message: {e}")
        return _cors_response(500, {"message": "Erro ao enviar mensagem"})


def _handle_chat_get_user_tickets(event: dict) -> dict:
    """GET /chat/tickets — get current user's tickets."""
    user = _get_authenticated_user(event)
    if not user:
        return _cors_response(401, {"message": "Token inválido"})

    email = user.get("email", "")
    table = dynamodb.Table(CHAT_TABLE)

    try:
        result = table.scan(
            FilterExpression="userEmail = :e",
            ExpressionAttributeValues={":e": email},
        )
        items = result.get("Items", [])
        for item in items:
            for k, v in item.items():
                if isinstance(v, Decimal):
                    item[k] = float(v)
        items.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
        return _cors_response(200, {"tickets": items})
    except Exception as e:
        logger.error(f"Error fetching user tickets: {e}")
        return _cors_response(500, {"message": "Erro ao carregar chamados"})


def _handle_admin_chat_list(event: dict) -> dict:
    """GET /admin/chat — list all tickets (admin)."""
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    table = dynamodb.Table(CHAT_TABLE)
    try:
        result = table.scan()
        items = result.get("Items", [])
        for item in items:
            for k, v in item.items():
                if isinstance(v, Decimal):
                    item[k] = float(v)
            # Add unread count (messages from user after last admin reply)
            msgs = item.get("messages", [])
            last_admin_idx = -1
            for i, m in enumerate(msgs):
                if m.get("sender") == "admin":
                    last_admin_idx = i
            item["unreadCount"] = len([m for i, m in enumerate(msgs) if i > last_admin_idx and m.get("sender") == "user"])
        items.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
        return _cors_response(200, {"tickets": items})
    except Exception as e:
        logger.error(f"Error listing tickets: {e}")
        return _cors_response(500, {"message": "Erro ao listar chamados"})


def _handle_admin_chat_reply(event: dict) -> dict:
    """POST /admin/chat/reply — admin replies to a ticket."""
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors_response(400, {"message": "JSON inválido"})

    ticket_id = body.get("ticketId", "")
    message = _sanitize_string(body.get("message", ""), 2000)

    if not ticket_id or not message:
        return _cors_response(400, {"message": "ticketId e message obrigatórios"})

    now = datetime.now(UTC).isoformat()
    admin_name = admin.get("name", "") or admin.get("email", "Admin")
    table = dynamodb.Table(CHAT_TABLE)

    try:
        msg_item = {
            "id": str(uuid.uuid4())[:8],
            "sender": "admin",
            "senderName": admin_name,
            "message": message,
            "timestamp": now,
        }
        table.update_item(
            Key={"ticketId": ticket_id},
            UpdateExpression="SET messages = list_append(messages, :msg), updatedAt = :now, #s = :answered",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":msg": [msg_item],
                ":now": now,
                ":answered": "answered",
            },
        )
        return _cors_response(200, {"message": "Resposta enviada"})
    except Exception as e:
        logger.error(f"Error replying to ticket: {e}")
        return _cors_response(500, {"message": "Erro ao responder"})


def _handle_admin_chat_close(event: dict) -> dict:
    """POST /admin/chat/close — admin closes a ticket."""
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors_response(400, {"message": "JSON inválido"})

    ticket_id = body.get("ticketId", "")
    if not ticket_id:
        return _cors_response(400, {"message": "ticketId obrigatório"})

    now = datetime.now(UTC).isoformat()
    table = dynamodb.Table(CHAT_TABLE)

    try:
        table.update_item(
            Key={"ticketId": ticket_id},
            UpdateExpression="SET #s = :closed, closedAt = :now, updatedAt = :now",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":closed": "closed", ":now": now},
        )
        return _cors_response(200, {"message": "Chamado encerrado"})
    except Exception as e:
        logger.error(f"Error closing ticket: {e}")
        return _cors_response(500, {"message": "Erro ao encerrar chamado"})

def _handle_admin_list_users(event: dict) -> dict:
    """GET /admin/users — list all users with plan info."""
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    table = dynamodb.Table(USERS_TABLE)
    try:
        result = table.scan(
            ProjectionExpression="email, #n, userId, #r, #p, planExpiresAt, planSource, createdAt, lastLoginAt, emailVerified, stripeSubscriptionId, enabled",
            ExpressionAttributeNames={"#n": "name", "#r": "role", "#p": "plan"},
        )
        users = result.get("Items", [])

        now = datetime.now(UTC)
        for u in users:
            # Convert Decimal
            for k, v in u.items():
                if isinstance(v, Decimal):
                    u[k] = float(v)
            # Check if plan expired
            plan_expires = u.get("planExpiresAt", "")
            if u.get("plan") == "pro" and plan_expires:
                try:
                    exp_dt = datetime.fromisoformat(plan_expires.replace("Z", "+00:00"))
                    if now > exp_dt:
                        u["plan"] = "free"
                        u["planExpired"] = True
                except Exception:
                    pass

        users.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
        return _cors_response(200, {"users": users})
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        return _cors_response(500, {"message": "Erro ao listar usuários"})


def _handle_admin_set_plan(event: dict) -> dict:
    """POST /admin/users/set-plan — admin sets a user's plan and duration."""
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors_response(400, {"message": "JSON inválido"})

    email = _normalize_email(body.get("email", ""))
    plan = body.get("plan", "")  # "pro" or "free"
    duration_days = body.get("durationDays", 0)  # 0 = indefinido

    if not email:
        return _cors_response(400, {"message": "Email obrigatório"})
    if plan not in ("pro", "free"):
        return _cors_response(400, {"message": "Plano deve ser 'pro' ou 'free'"})

    table = dynamodb.Table(USERS_TABLE)

    # Verify user exists
    try:
        result = table.get_item(Key={"email": email}, ProjectionExpression="email")
        if "Item" not in result:
            return _cors_response(404, {"message": "Usuário não encontrado"})
    except Exception:
        return _cors_response(500, {"message": "Erro interno"})

    now = datetime.now(UTC).isoformat()

    try:
        if plan == "pro":
            update_expr = "SET #p = :plan, planSource = :src, updatedAt = :now"
            expr_values: dict = {":plan": "pro", ":src": "admin", ":now": now}
            expr_names = {"#p": "plan"}

            if duration_days and int(duration_days) > 0:
                expires_at = (datetime.now(UTC) + timedelta(days=int(duration_days))).isoformat()
                update_expr += ", planExpiresAt = :exp"
                expr_values[":exp"] = expires_at
            else:
                # Indefinido — remove expiry
                update_expr += " REMOVE planExpiresAt"

            table.update_item(
                Key={"email": email},
                UpdateExpression=update_expr,
                ExpressionAttributeNames=expr_names,
                ExpressionAttributeValues=expr_values,
            )

            _log_auth(email, "admin_set_pro", True, "admin", admin.get("email", "admin"),
                       f"duration={duration_days or 'indefinido'} by {admin.get('email')}")

            return _cors_response(200, {
                "message": f"Plano Pro ativado para {email}" + (f" por {duration_days} dias" if duration_days else " (indefinido)"),
                "plan": "pro",
                "planExpiresAt": expires_at if duration_days and int(duration_days) > 0 else "",
            })
        else:
            # Downgrade to free
            table.update_item(
                Key={"email": email},
                UpdateExpression="SET #p = :free, updatedAt = :now REMOVE planExpiresAt, planSource",
                ExpressionAttributeNames={"#p": "plan"},
                ExpressionAttributeValues={":free": "free", ":now": now},
            )

            _log_auth(email, "admin_set_free", True, "admin", admin.get("email", "admin"),
                       f"by {admin.get('email')}")

            return _cors_response(200, {"message": f"Plano Free ativado para {email}", "plan": "free"})

    except Exception as e:
        logger.error(f"Error setting plan for {email}: {e}")
        return _cors_response(500, {"message": "Erro ao alterar plano"})


def _handle_admin_set_role(event: dict) -> dict:
    """POST /admin/users/set-role — admin toggles a user's role (admin/viewer)."""
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors_response(400, {"message": "JSON inválido"})

    email = _normalize_email(body.get("email", ""))
    role = body.get("role", "")

    if not email:
        return _cors_response(400, {"message": "Email obrigatório"})
    if role not in ("admin", "viewer"):
        return _cors_response(400, {"message": "Role deve ser 'admin' ou 'viewer'"})

    # Prevent removing own admin
    if email == admin.get("email", "") and role != "admin":
        return _cors_response(400, {"message": "Você não pode remover seu próprio acesso admin."})

    table = dynamodb.Table(USERS_TABLE)

    try:
        result = table.get_item(Key={"email": email}, ProjectionExpression="email")
        if "Item" not in result:
            return _cors_response(404, {"message": "Usuário não encontrado"})
    except Exception:
        return _cors_response(500, {"message": "Erro interno"})

    now = datetime.now(UTC).isoformat()

    try:
        table.update_item(
            Key={"email": email},
            UpdateExpression="SET #r = :role, updatedAt = :now",
            ExpressionAttributeNames={"#r": "role"},
            ExpressionAttributeValues={":role": role, ":now": now},
        )
        label = "Administrador" if role == "admin" else "Usuário"
        _log_auth(email, f"admin_set_role_{role}", True, "admin", admin.get("email", "admin"),
                   f"by {admin.get('email')}")
        return _cors_response(200, {"message": f"{email} agora é {label}", "role": role})
    except Exception as e:
        logger.error(f"Error setting role for {email}: {e}")
        return _cors_response(500, {"message": "Erro ao alterar role"})


def handler(event: dict, context: Any = None) -> dict:
    """Lambda handler — routes to register/login/me/verify/reset/change-password/notifications."""
    method = event.get("httpMethod", "")
    if method == "OPTIONS":
        return _cors_response(200, {})

    path = (event.get("path", "") or event.get("resource", "")).rstrip("/")

    if path.endswith("/auth/register") and method == "POST":
        return _handle_register(event)
    elif path.endswith("/auth/login") and method == "POST":
        return _handle_login(event)
    elif path.endswith("/auth/me") and method == "GET":
        return _handle_me(event)
    elif path.endswith("/auth/verify-email") and method == "POST":
        return _handle_verify_email(event)
    elif path.endswith("/auth/resend-code") and method == "POST":
        return _handle_resend_code(event)
    elif path.endswith("/auth/forgot-password") and method == "POST":
        return _handle_forgot_password(event)
    elif path.endswith("/auth/reset-password") and method == "POST":
        return _handle_reset_password(event)
    elif path.endswith("/auth/change-password") and method == "POST":
        return _handle_change_password(event)
    elif path.endswith("/auth/phone") and method == "POST":
        return _handle_update_phone(event)
    elif path.endswith("/auth/phone") and method == "GET":
        return _handle_get_phone(event)
    elif path.endswith("/admin/notifications") and method == "GET":
        return _handle_get_notifications(event)
    elif path.endswith("/admin/notifications") and method == "POST":
        return _handle_create_notification(event)
    elif path.endswith("/admin/notifications") and method == "PUT":
        return _handle_update_notification(event)
    elif path.endswith("/admin/notifications") and method == "DELETE":
        return _handle_delete_notification(event)
    elif path.endswith("/admin/whatsapp") and method == "POST":
        return _handle_send_whatsapp_notification(event)
    elif path.endswith("/admin/users") and method == "GET":
        return _handle_admin_list_users(event)
    elif path.endswith("/admin/users/set-plan") and method == "POST":
        return _handle_admin_set_plan(event)
    elif path.endswith("/admin/users/set-role") and method == "POST":
        return _handle_admin_set_role(event)
    elif path.endswith("/admin/chat") and method == "GET":
        return _handle_admin_chat_list(event)
    elif path.endswith("/admin/chat/reply") and method == "POST":
        return _handle_admin_chat_reply(event)
    elif path.endswith("/admin/chat/close") and method == "POST":
        return _handle_admin_chat_close(event)
    elif path.endswith("/chat/messages") and method == "POST":
        return _handle_chat_send(event)
    elif path.endswith("/chat/tickets") and method == "GET":
        return _handle_chat_get_user_tickets(event)
    elif path.endswith("/notifications") and method == "GET" and not path.endswith("/admin/notifications"):
        return _handle_get_user_notifications(event)
    elif path.endswith("/auth/stats") and method == "GET":
        return _handle_stats(event)
    elif path.endswith("/auth/create-checkout") and method == "POST":
        return _handle_create_checkout(event)
    elif path.endswith("/auth/stripe-webhook") and method == "POST":
        return _handle_stripe_webhook(event)
    elif path.endswith("/auth/check-session") and method == "GET":
        return _handle_check_session(event)
    elif path.endswith("/auth/manage-billing") and method == "POST":
        return _handle_manage_billing(event)
    else:
        return _cors_response(404, {"message": "Not found"})
