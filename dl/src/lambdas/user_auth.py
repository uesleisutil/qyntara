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
import smtplib
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
secrets_client = boto3.client("secretsmanager")
s3_client = boto3.client("s3")

BUCKET = os.environ.get("BUCKET", "")
USERS_TABLE = os.environ.get("USERS_TABLE", "B3Dashboard-Users")
AUTH_LOGS_TABLE = os.environ.get("AUTH_LOGS_TABLE", "B3Dashboard-AuthLogs")
RATE_LIMITS_TABLE = os.environ.get("RATE_LIMITS_TABLE", "B3Dashboard-RateLimits")
JWT_SECRET_ID = os.environ.get("JWT_SECRET_ID", "")
JWT_SECRET_ENV = os.environ.get("JWT_SECRET", "")  # Fallback only
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "")
SES_SENDER_EMAIL = os.environ.get("SES_SENDER_EMAIL", os.environ.get("ADMIN_EMAIL", ""))

# SMTP Configuration (Locaweb or other provider)
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", "") or SES_SENDER_EMAIL

# Stripe
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID = os.environ.get("STRIPE_PRICE_ID", "")  # price_xxx for R$49/mo
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://qyntara.tech")

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


def _format_display_name(name: str) -> str:
    """Format name for public display: 'João Silva' -> 'João S.'"""
    if not name:
        return "Anônimo"
    parts = name.strip().split()
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0]}."


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
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?~`]", password):
        return "Senha deve conter pelo menos um caractere especial (!@#$%...)"
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


ALLOWED_ORIGINS = os.environ.get(
    'ALLOWED_ORIGINS',
    'https://qyntara.tech,https://www.qyntara.tech'
).split(',')


def _cors_response(status: int, body: dict) -> dict:
    def _default(o):
        if isinstance(o, Decimal):
            return int(o) if o == int(o) else float(o)
        raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")

    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Api-Key",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            # Security headers
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        },
        "body": json.dumps(body, default=_default),
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


def _send_smtp_email(to: str, subject: str, body_html: str, body_text: str) -> bool:
    """Send email via SMTP (Locaweb or other provider)."""
    sender = SMTP_FROM_EMAIL
    if not sender or not SMTP_HOST or not SMTP_USER:
        logger.error("SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_FROM_EMAIL required)")
        return False

    logger.info(f"SMTP: sending to={to} from={sender} host={SMTP_HOST}:{SMTP_PORT}")

    msg = MIMEMultipart("alternative")
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.set_debuglevel(0)
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(sender, [to], msg.as_string())
        logger.info(f"SMTP: email sent successfully to {to}")
        return True
    except smtplib.SMTPResponseException as e:
        logger.error(f"SMTP response error for {to}: code={e.smtp_code} msg={e.smtp_error}")
        return False
    except Exception as e:
        logger.error(f"SMTP send failed for {to}: {type(e).__name__}: {e}")
        return False


def _email_wrapper(content: str) -> str:
    """Wrap email content in a consistent Qyntara branded template."""
    return f"""
    <div style="background:#f8fafc;padding:40px 0;">
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:24px 32px;text-align:center;">
          <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0;letter-spacing:1px;">Qyntara</h1>
          <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">Inteligência para o mercado financeiro</p>
        </div>
        <div style="padding:32px;">
          {content}
        </div>
        <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:11px;margin:0;">© Qyntara — qyntara.tech</p>
          <p style="color:#cbd5e1;font-size:11px;margin:4px 0 0;">Este é um email automático, não responda.</p>
        </div>
      </div>
    </div>
    """


def _send_verification_email(email: str, code: str, purpose: str = "email_verify") -> bool:
    """Send verification code via SMTP."""
    if not SMTP_FROM_EMAIL:
        logger.error("SMTP_FROM_EMAIL not configured")
        return False

    if purpose == "email_verify":
        subject = "Qyntara — Código de Verificação"
        content = f"""
          <p style="color:#334155;font-size:15px;line-height:1.6;">Olá! Obrigado por se cadastrar.</p>
          <p style="color:#334155;font-size:15px;line-height:1.6;">Use o código abaixo para verificar seu email:</p>
          <div style="background:#f1f5f9;border-radius:10px;padding:24px;text-align:center;margin:24px 0;border:1px solid #e2e8f0;">
            <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#0f172a;">{code}</span>
          </div>
          <p style="color:#64748b;font-size:13px;">Este código expira em <strong>15 minutos</strong>.</p>
          <p style="color:#64748b;font-size:13px;">Se você não criou uma conta na Qyntara, ignore este email.</p>
        """
        body_text = f"Seu código de verificação Qyntara: {code}\nExpira em 15 minutos."
    else:
        subject = "Qyntara — Redefinir Senha"
        content = f"""
          <p style="color:#334155;font-size:15px;line-height:1.6;">Você solicitou a redefinição de senha.</p>
          <p style="color:#334155;font-size:15px;line-height:1.6;">Use o código abaixo para criar uma nova senha:</p>
          <div style="background:#f1f5f9;border-radius:10px;padding:24px;text-align:center;margin:24px 0;border:1px solid #e2e8f0;">
            <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#0f172a;">{code}</span>
          </div>
          <p style="color:#64748b;font-size:13px;">Este código expira em <strong>30 minutos</strong>.</p>
          <p style="color:#64748b;font-size:13px;">Se você não solicitou, ignore este email. Sua senha não será alterada.</p>
        """
        body_text = f"Código para redefinir senha Qyntara: {code}\nExpira em 30 minutos."

    return _send_smtp_email(email, subject, _email_wrapper(content), body_text)


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
    referral_code = _sanitize_string(body.get("referralCode", ""), 20).upper()

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
        new_item = {
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
        }
        # Track referral
        referrer_email = ""
        if referral_code:
            try:
                scan = table.scan(
                    FilterExpression="referralCode = :c",
                    ExpressionAttributeValues={":c": referral_code},
                    ProjectionExpression="email",
                    Limit=1,
                )
                referrer_items = scan.get("Items", [])
                if referrer_items:
                    referrer_email = referrer_items[0]["email"]
                    new_item["referredBy"] = referrer_email
            except Exception:
                pass

        table.put_item(
            Item=new_item,
            ConditionExpression="attribute_not_exists(email)",
        )

        # Add to referrer's referrals list
        if referrer_email:
            try:
                referrer = table.get_item(Key={"email": referrer_email}).get("Item", {})
                referrals = referrer.get("referrals", [])
                referrals.append({
                    "name": name,
                    "email": email,
                    "status": "pending",
                    "createdAt": now,
                })
                table.update_item(
                    Key={"email": referrer_email},
                    UpdateExpression="SET referrals = :r, updatedAt = :now",
                    ExpressionAttributeValues={":r": referrals, ":now": now},
                )
            except Exception:
                pass
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
        "emailVerified": bool(item.get("emailVerified", False)),
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
        "freeTicker": item.get("freeTicker", ""),
    })


def _process_referral_rewards(table, email: str, item: dict) -> None:
    """Check if any referrals from this user's referrer should be qualified (7+ days as pro)."""
    try:
        now = datetime.now(UTC)
        # Check if THIS user was referred and has been pro for 7+ days
        referred_by = item.get("referredBy", "")
        referral_qualified = item.get("referralQualified", False)
        if referred_by and not referral_qualified and item.get("plan") == "pro":
            # Check when they became pro
            plan_start = item.get("planStartedAt", "")
            if plan_start:
                try:
                    start_dt = datetime.fromisoformat(plan_start.replace("Z", "+00:00"))
                    if (now - start_dt).days >= 7:
                        # Qualify this referral — grant 1 month pro to referrer
                        now_iso = now.isoformat()
                        # Mark this user as qualified
                        table.update_item(
                            Key={"email": email},
                            UpdateExpression="SET referralQualified = :t, updatedAt = :now",
                            ExpressionAttributeValues={":t": True, ":now": now_iso},
                        )
                        # Grant 1 month pro to referrer
                        referrer = table.get_item(Key={"email": referred_by}).get("Item", {})
                        if referrer:
                            ref_plan = referrer.get("plan", "free")
                            ref_expires = referrer.get("planExpiresAt", "")
                            if ref_plan == "pro" and ref_expires:
                                try:
                                    base = datetime.fromisoformat(ref_expires.replace("Z", "+00:00"))
                                except Exception:
                                    base = now
                            else:
                                base = now
                            new_expires = (base + timedelta(days=30)).isoformat()
                            table.update_item(
                                Key={"email": referred_by},
                                UpdateExpression="SET #p = :pro, planExpiresAt = :exp, updatedAt = :now",
                                ExpressionAttributeNames={"#p": "plan"},
                                ExpressionAttributeValues={":pro": "pro", ":exp": new_expires, ":now": now_iso},
                            )
                            # Also grant 1 month to the referred user
                            user_expires = item.get("planExpiresAt", "")
                            try:
                                user_base = datetime.fromisoformat(user_expires.replace("Z", "+00:00"))
                            except Exception:
                                user_base = now
                            user_new_expires = (user_base + timedelta(days=30)).isoformat()
                            table.update_item(
                                Key={"email": email},
                                UpdateExpression="SET planExpiresAt = :exp, updatedAt = :now",
                                ExpressionAttributeValues={":exp": user_new_expires, ":now": now_iso},
                            )
                            # Update referrer's referrals list
                            referrals = referrer.get("referrals", [])
                            for r in referrals:
                                if r.get("email") == email:
                                    r["status"] = "qualified"
                                    r["qualifiedAt"] = now_iso
                            if referrals:
                                table.update_item(
                                    Key={"email": referred_by},
                                    UpdateExpression="SET referrals = :r",
                                    ExpressionAttributeValues={":r": referrals},
                                )
                            logger.info(f"Referral reward granted: {referred_by} <- {email}")
                except Exception:
                    pass
    except Exception as e:
        logger.error(f"Error processing referral rewards for {email}: {e}")


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

        # Auto-process referral rewards: qualify referrals after 7 days
        _process_referral_rewards(table, email, item)

        return _cors_response(200, {
            "userId": item.get("userId", payload.get("sub")),
            "email": email,
            "name": item.get("name", payload.get("name")),
            "role": item.get("role", payload.get("role")),
            "plan": plan,
            "planExpiresAt": plan_expires if plan == "pro" else "",
            "freeTicker": item.get("freeTicker", ""),
            "canViewCosts": item.get("canViewCosts", False),
            "onboardingDone": item.get("onboardingDone", False),
            "investorProfile": item.get("investorProfile", ""),
            "avatar": item.get("avatar", ""),
            "notificationPreferences": item.get("notificationPreferences", {}),
        })
    except Exception:
        # Fallback to JWT data
        return _cors_response(200, {
            "userId": payload.get("sub"),
            "email": payload.get("email"),
            "name": payload.get("name"),
            "role": payload.get("role"),
            "plan": payload.get("plan", "free"),
            "freeTicker": "",
            "onboardingDone": False,
            "investorProfile": "",
            "notificationPreferences": {},
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
CARTEIRAS_TABLE = os.environ.get("CARTEIRAS_TABLE", "B3Dashboard-Carteiras")


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
    notif_type = body.get("type", "manual")  # manual, auto_model_run, auto_recommendations, auto_strong_signals, auto_history, auto_signal_change, auto_drift, auto_anomaly, auto_cost_alert, auto_degradation
    target = body.get("target", "all")  # all, free, pro
    enabled = body.get("enabled", True)

    if not title or not message:
        return _cors_response(400, {"message": "Título e mensagem são obrigatórios"})

    if notif_type not in ("manual", "auto_model_run", "auto_recommendations", "auto_strong_signals", "auto_history", "auto_signal_change", "auto_drift", "auto_anomaly", "auto_cost_alert", "auto_degradation"):
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
                    UpdateExpression="SET #p = :pro, stripeSubscriptionId = :sid, stripeCustomerId = :cid, upgradedAt = :now, updatedAt = :now, planStartedAt = :now",
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

                # Update referral status to "paid" if this user was referred
                try:
                    user_item = table.get_item(Key={"email": email}).get("Item", {})
                    referred_by = user_item.get("referredBy", "")
                    if referred_by:
                        referrer = table.get_item(Key={"email": referred_by}).get("Item", {})
                        referrals = referrer.get("referrals", [])
                        for r in referrals:
                            if r.get("email") == email and r.get("status") == "pending":
                                r["status"] = "paid"
                                r["paidAt"] = now
                        table.update_item(
                            Key={"email": referred_by},
                            UpdateExpression="SET referrals = :r",
                            ExpressionAttributeValues={":r": referrals},
                        )
                except Exception:
                    pass

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
    """Send Pro upgrade confirmation email via SMTP."""
    subject = "Qyntara — Bem-vindo ao Pro! 🎉"
    content = """
      <p style="color:#334155;font-size:15px;line-height:1.6;">Seu plano <strong style="color:#f59e0b;">Pro</strong> foi ativado com sucesso!</p>
      <p style="color:#334155;font-size:15px;line-height:1.6;">Agora você tem acesso completo:</p>
      <ul style="color:#334155;font-size:14px;line-height:2;padding-left:20px;">
        <li>Todas as colunas desbloqueadas (Confiança, Stop-Loss, Take-Profit)</li>
        <li>Carteira Modelo otimizada</li>
        <li>Tracking por Safra</li>
        <li>Alertas de preço</li>
      </ul>
      <div style="text-align:center;margin:28px 0;">
        <a href="https://qyntara.tech" style="background:linear-gradient(135deg,#0f172a,#1e293b);color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;display:inline-block;">Acessar Dashboard</a>
      </div>
      <p style="color:#64748b;font-size:13px;">Qualquer dúvida, entre em contato pelo chat do dashboard.</p>
    """
    body_text = "Você agora é Pro! Seu plano Qyntara foi ativado. Acesse: https://qyntara.tech"
    _send_smtp_email(email, subject, _email_wrapper(content), body_text)


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


def _get_verified_user(event: dict) -> Optional[dict]:
    """Verify JWT and ensure email is verified. Returns None if invalid or unverified."""
    user = _get_authenticated_user(event)
    if not user:
        return None
    if not user.get("emailVerified", False):
        return None
    return user


# ── Support Chat ──

def _handle_chat_send(event: dict) -> dict:
    """POST /chat/messages — user sends a message (creates ticket if needed)."""
    user = _get_verified_user(event)
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
        category = _sanitize_string(body.get("category", ""), 50)
        item = {
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
        }
        if category:
            item["category"] = category
        table.put_item(Item=item)
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
    user = _get_verified_user(event)
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

def _handle_admin_chat_delete(event: dict) -> dict:
    """POST /admin/chat/delete — admin deletes a ticket."""
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

    table = dynamodb.Table(CHAT_TABLE)

    try:
        table.delete_item(Key={"ticketId": ticket_id})
        return _cors_response(200, {"message": "Chamado excluído"})
    except Exception as e:
        logger.error(f"Error deleting ticket: {e}")
        return _cors_response(500, {"message": "Erro ao excluir chamado"})


def _handle_admin_list_users(event: dict) -> dict:
    """GET /admin/users — list all users with plan info."""
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    table = dynamodb.Table(USERS_TABLE)
    try:
        result = table.scan(
            ProjectionExpression="email, #n, userId, #r, #p, planExpiresAt, planSource, createdAt, lastLoginAt, emailVerified, stripeSubscriptionId, enabled, canViewCosts",
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


def _handle_admin_set_costs_access(event: dict) -> dict:
    """POST /admin/users/set-costs-access — admin toggles a user's canViewCosts flag."""
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors_response(400, {"message": "JSON inválido"})

    email = _normalize_email(body.get("email", ""))
    can_view = body.get("canViewCosts")

    if not email:
        return _cors_response(400, {"message": "Email obrigatório"})
    if not isinstance(can_view, bool):
        return _cors_response(400, {"message": "canViewCosts deve ser true ou false"})

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
            UpdateExpression="SET canViewCosts = :val, updatedAt = :now",
            ExpressionAttributeValues={":val": can_view, ":now": now},
        )
        status = "liberado" if can_view else "revogado"
        _log_auth(email, f"admin_set_costs_access_{can_view}", True, "admin", admin.get("email", "admin"),
                   f"by {admin.get('email')}")
        return _cors_response(200, {"message": f"Acesso a dados sensíveis {status} para {email}", "canViewCosts": can_view})
    except Exception as e:
        logger.error(f"Error setting canViewCosts for {email}: {e}")
        return _cors_response(500, {"message": "Erro ao alterar acesso"})


def _handle_admin_delete_user(event: dict) -> dict:
    """DELETE /admin/users/delete — admin deletes a user and all their data."""
    admin = _require_admin(event)
    if not admin:
        return _cors_response(403, {"message": "Acesso negado"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors_response(400, {"message": "JSON inválido"})

    email = _normalize_email(body.get("email", ""))
    if not email:
        return _cors_response(400, {"message": "Email obrigatório"})

    # Prevent admin self-deletion
    if email == admin.get("email", ""):
        return _cors_response(400, {"message": "Você não pode excluir sua própria conta por aqui."})

    users_table = dynamodb.Table(USERS_TABLE)

    try:
        result = users_table.get_item(Key={"email": email}, ProjectionExpression="email, stripeSubscriptionId")
        if "Item" not in result:
            return _cors_response(404, {"message": "Usuário não encontrado"})
        item = result["Item"]
    except Exception:
        return _cors_response(500, {"message": "Erro interno"})

    try:
        # 1. Cancel Stripe subscription if exists
        stripe_sub_id = item.get("stripeSubscriptionId", "")
        if stripe_sub_id and STRIPE_SECRET_KEY:
            try:
                _stripe_request("DELETE", f"subscriptions/{stripe_sub_id}")
            except Exception as e:
                logger.warning(f"Failed to cancel Stripe sub for {email}: {e}")

        # 2. Delete user
        users_table.delete_item(Key={"email": email})

        # 3. Delete auth logs
        try:
            logs_table = dynamodb.Table(AUTH_LOGS_TABLE)
            logs_result = logs_table.query(
                KeyConditionExpression="userId = :uid",
                ExpressionAttributeValues={":uid": email},
                ProjectionExpression="userId, #ts",
                ExpressionAttributeNames={"#ts": "timestamp"},
            )
            with logs_table.batch_writer() as batch:
                for log_item in logs_result.get("Items", []):
                    batch.delete_item(Key={"userId": log_item["userId"], "timestamp": log_item["timestamp"]})
        except Exception as e:
            logger.warning(f"Admin delete: failed to delete auth logs for {email}: {e}")

        # 4. Delete rate limit entries
        try:
            rl_table = dynamodb.Table(RATE_LIMITS_TABLE)
            for prefix in ["auth_ip:", "email_verify:", "password_reset:"]:
                try:
                    rl_table.delete_item(Key={"identifier": f"{prefix}{email}"})
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"Admin delete: failed to delete rate limits for {email}: {e}")

        # 5. Delete chat tickets
        try:
            chat_table = dynamodb.Table(CHAT_TABLE)
            chat_result = chat_table.scan(
                FilterExpression="userEmail = :e",
                ExpressionAttributeValues={":e": email},
                ProjectionExpression="ticketId",
            )
            for ticket in chat_result.get("Items", []):
                chat_table.delete_item(Key={"ticketId": ticket["ticketId"]})
        except Exception as e:
            logger.warning(f"Admin delete: failed to delete chat tickets for {email}: {e}")

        # 6. Delete carteiras
        try:
            cart_table = dynamodb.Table(CARTEIRAS_TABLE)
            cart_result = cart_table.query(
                KeyConditionExpression="userEmail = :e",
                ExpressionAttributeValues={":e": email},
                ProjectionExpression="userEmail, carteiraId",
            )
            for item in cart_result.get("Items", []):
                cart_table.delete_item(Key={"userEmail": email, "carteiraId": item["carteiraId"]})
        except Exception as e:
            logger.warning(f"Admin delete: failed to delete carteiras for {email}: {e}")

        _log_auth(email, "admin_delete_user", True, "admin", admin.get("email", "admin"),
                   f"deleted by {admin.get('email')}")
        return _cors_response(200, {"message": f"Usuário {email} excluído com sucesso."})

    except Exception as e:
        logger.error(f"Admin delete user failed for {email}: {e}")
        return _cors_response(500, {"message": "Erro ao excluir usuário."})


def _handle_delete_account(event: dict) -> dict:
    """DELETE /auth/me — LGPD Art. 18: delete all user data."""
    ip = _get_ip(event)
    ua = _get_user_agent(event)

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

    # Prevent admin self-deletion
    if email == ADMIN_EMAIL.strip().lower():
        return _cors_response(403, {"message": "Conta admin não pode ser excluída por esta via."})

    try:
        # 1. Cancel Stripe subscription if exists
        users_table = dynamodb.Table(USERS_TABLE)
        result = users_table.get_item(Key={"email": email})
        item = result.get("Item", {})
        stripe_sub_id = item.get("stripeSubscriptionId", "")
        if stripe_sub_id and STRIPE_SECRET_KEY:
            try:
                _stripe_request("DELETE", f"subscriptions/{stripe_sub_id}")
                logger.info(f"Cancelled Stripe subscription {stripe_sub_id} for {email}")
            except Exception as e:
                logger.warning(f"Failed to cancel Stripe sub for {email}: {e}")

        # 2. Delete user from Users table
        users_table.delete_item(Key={"email": email})
        logger.info(f"Deleted user record for {email}")

        # 3. Delete auth logs
        try:
            logs_table = dynamodb.Table(AUTH_LOGS_TABLE)
            logs_result = logs_table.query(
                KeyConditionExpression="userId = :uid",
                ExpressionAttributeValues={":uid": email},
                ProjectionExpression="userId, #ts",
                ExpressionAttributeNames={"#ts": "timestamp"},
            )
            with logs_table.batch_writer() as batch:
                for log_item in logs_result.get("Items", []):
                    batch.delete_item(Key={"userId": log_item["userId"], "timestamp": log_item["timestamp"]})
        except Exception as e:
            logger.warning(f"Failed to delete auth logs for {email}: {e}")

        # 4. Delete rate limit entries
        try:
            rl_table = dynamodb.Table(RATE_LIMITS_TABLE)
            for prefix in ["auth_ip:", "email_verify:", "password_reset:"]:
                try:
                    rl_table.delete_item(Key={"identifier": f"{prefix}{email}"})
                except Exception:
                    pass
        except Exception as e:
            logger.warning(f"Failed to delete rate limits for {email}: {e}")

        # 5. Delete chat tickets
        try:
            chat_table = dynamodb.Table(CHAT_TABLE)
            chat_result = chat_table.scan(
                FilterExpression="userEmail = :e",
                ExpressionAttributeValues={":e": email},
                ProjectionExpression="ticketId",
            )
            for ticket in chat_result.get("Items", []):
                chat_table.delete_item(Key={"ticketId": ticket["ticketId"]})
        except Exception as e:
            logger.warning(f"Failed to delete chat tickets for {email}: {e}")

        # 6. Delete carteiras
        try:
            cart_table = dynamodb.Table(CARTEIRAS_TABLE)
            cart_result = cart_table.query(
                KeyConditionExpression="userEmail = :e",
                ExpressionAttributeValues={":e": email},
                ProjectionExpression="userEmail, carteiraId",
            )
            for item in cart_result.get("Items", []):
                cart_table.delete_item(Key={"userEmail": email, "carteiraId": item["carteiraId"]})
        except Exception as e:
            logger.warning(f"Failed to delete carteiras for {email}: {e}")

        # 7. Send confirmation email
        try:
            deletion_content = """
              <p style="color:#334155;font-size:15px;line-height:1.6;">Sua conta e todos os dados associados foram excluídos com sucesso, conforme solicitado.</p>
              <p style="color:#64748b;font-size:13px;">Esta ação é irreversível. Se desejar utilizar o serviço novamente, será necessário criar uma nova conta.</p>
              <p style="color:#64748b;font-size:13px;">Obrigado por ter utilizado a Qyntara.</p>
            """
            _send_smtp_email(
                email,
                "Qyntara — Conta Excluída",
                _email_wrapper(deletion_content),
                "Sua conta Qyntara foi excluída com sucesso. Todos os dados foram removidos.",
            )
        except Exception as e:
            logger.warning(f"Failed to send deletion confirmation to {email}: {e}")

        _log_auth(email, "delete_account", True, ip, ua)
        return _cors_response(200, {"message": "Conta e dados excluídos com sucesso."})

    except Exception as e:
        logger.error(f"Failed to delete account for {email}: {e}")
        _log_auth(email, "delete_account", False, ip, ua, str(e))
        return _cors_response(500, {"message": "Erro ao excluir conta. Tente novamente."})


# ── Carteiras (User Portfolios) ──

MAX_CARTEIRAS_FREE = 1
MAX_CARTEIRAS_PRO = 50
MAX_TICKERS_PER_CARTEIRA = 30


def _handle_carteiras_list(event: dict) -> dict:
    """GET /carteiras — list user's carteiras."""
    user = _get_verified_user(event)
    if not user:
        return _cors_response(401, {"message": "Token inválido"})

    email = user.get("email", "")
    table = dynamodb.Table(CARTEIRAS_TABLE)

    try:
        result = table.query(
            KeyConditionExpression="userEmail = :e",
            ExpressionAttributeValues={":e": email},
        )
        items = result.get("Items", [])
        for item in items:
            for k, v in item.items():
                if isinstance(v, Decimal):
                    item[k] = float(v)
        items.sort(key=lambda x: x.get("createdAt", ""))
        return _cors_response(200, {"carteiras": items})
    except Exception as e:
        logger.error(f"Error listing carteiras: {e}")
        return _cors_response(500, {"message": "Erro ao carregar carteiras"})


def _handle_carteiras_create(event: dict) -> dict:
    """POST /carteiras — create a new carteira."""
    user = _get_verified_user(event)
    if not user:
        return _cors_response(401, {"message": "Token inválido"})

    email = user.get("email", "")
    plan = user.get("plan", "free")

    # Check limit
    table = dynamodb.Table(CARTEIRAS_TABLE)
    try:
        result = table.query(
            KeyConditionExpression="userEmail = :e",
            ExpressionAttributeValues={":e": email},
            Select="COUNT",
        )
        count = result.get("Count", 0)
        limit = MAX_CARTEIRAS_PRO if plan == "pro" else MAX_CARTEIRAS_FREE
        if count >= limit:
            msg = "Limite de carteiras atingido. Faça upgrade para o Pro." if plan == "free" else "Limite máximo de carteiras atingido."
            return _cors_response(403, {"message": msg})
    except Exception as e:
        logger.error(f"Error checking carteira count: {e}")
        return _cors_response(500, {"message": "Erro interno"})

    raw_body = event.get("body", "") or ""
    if len(raw_body) > MAX_BODY_SIZE:
        return _cors_response(413, {"message": "Request muito grande"})
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return _cors_response(400, {"message": "JSON inválido"})

    name = _sanitize_string(body.get("name", ""), 30)
    color = _sanitize_string(body.get("color", "#3b82f6"), 10)
    icon = body.get("icon", "💼")[:4]
    tickers = body.get("tickers", [])

    if not name:
        return _cors_response(400, {"message": "Nome é obrigatório"})

    if not isinstance(tickers, list):
        tickers = []
    tickers = [_sanitize_string(t, 10).upper() for t in tickers[:MAX_TICKERS_PER_CARTEIRA]]

    carteira_id = str(uuid.uuid4())[:8]
    now = datetime.now(UTC).isoformat()

    item = {
        "userEmail": email,
        "carteiraId": carteira_id,
        "name": name,
        "color": color,
        "icon": icon,
        "tickers": tickers,
        "createdAt": now,
        "updatedAt": now,
    }

    try:
        table.put_item(Item=item)
        return _cors_response(201, {"message": "Carteira criada", "carteira": item})
    except Exception as e:
        logger.error(f"Error creating carteira: {e}")
        return _cors_response(500, {"message": "Erro ao criar carteira"})


def _handle_carteiras_update(event: dict) -> dict:
    """PUT /carteiras — update a carteira (name, color, icon, tickers)."""
    user = _get_verified_user(event)
    if not user:
        return _cors_response(401, {"message": "Token inválido"})

    email = user.get("email", "")

    raw_body = event.get("body", "") or ""
    if len(raw_body) > MAX_BODY_SIZE:
        return _cors_response(413, {"message": "Request muito grande"})
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return _cors_response(400, {"message": "JSON inválido"})

    carteira_id = body.get("carteiraId", "")
    if not carteira_id:
        return _cors_response(400, {"message": "carteiraId obrigatório"})

    table = dynamodb.Table(CARTEIRAS_TABLE)

    # Build update expression dynamically
    update_parts = []
    attr_values = {}
    attr_names = {}

    if "name" in body:
        update_parts.append("#n = :name")
        attr_values[":name"] = _sanitize_string(body["name"], 30)
        attr_names["#n"] = "name"
    if "color" in body:
        update_parts.append("color = :color")
        attr_values[":color"] = _sanitize_string(body["color"], 10)
    if "icon" in body:
        update_parts.append("icon = :icon")
        attr_values[":icon"] = body["icon"][:4]
    if "tickers" in body:
        tickers = body["tickers"]
        if isinstance(tickers, list):
            tickers = [_sanitize_string(t, 10).upper() for t in tickers[:MAX_TICKERS_PER_CARTEIRA]]
            update_parts.append("tickers = :tickers")
            attr_values[":tickers"] = tickers

    if not update_parts:
        return _cors_response(400, {"message": "Nenhum campo para atualizar"})

    now = datetime.now(UTC).isoformat()
    update_parts.append("updatedAt = :now")
    attr_values[":now"] = now

    try:
        kwargs = {
            "Key": {"userEmail": email, "carteiraId": carteira_id},
            "UpdateExpression": "SET " + ", ".join(update_parts),
            "ExpressionAttributeValues": attr_values,
            "ReturnValues": "ALL_NEW",
        }
        if attr_names:
            kwargs["ExpressionAttributeNames"] = attr_names
        result = table.update_item(**kwargs)
        item = result.get("Attributes", {})
        for k, v in item.items():
            if isinstance(v, Decimal):
                item[k] = float(v)
        return _cors_response(200, {"message": "Carteira atualizada", "carteira": item})
    except Exception as e:
        logger.error(f"Error updating carteira: {e}")
        return _cors_response(500, {"message": "Erro ao atualizar carteira"})


def _handle_carteiras_delete(event: dict) -> dict:
    """DELETE /carteiras — delete a carteira."""
    user = _get_verified_user(event)
    if not user:
        return _cors_response(401, {"message": "Token inválido"})

    email = user.get("email", "")

    raw_body = event.get("body", "") or ""
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return _cors_response(400, {"message": "JSON inválido"})

    carteira_id = body.get("carteiraId", "")
    if not carteira_id:
        return _cors_response(400, {"message": "carteiraId obrigatório"})

    table = dynamodb.Table(CARTEIRAS_TABLE)

    try:
        table.delete_item(Key={"userEmail": email, "carteiraId": carteira_id})
        return _cors_response(200, {"message": "Carteira excluída"})
    except Exception as e:
        logger.error(f"Error deleting carteira: {e}")
        return _cors_response(500, {"message": "Erro ao excluir carteira"})


def _handle_set_free_ticker(event: dict) -> dict:
    """POST /auth/free-ticker — multi-purpose user action endpoint."""
    user = _get_verified_user(event)
    if not user:
        return _cors_response(401, {"message": "Token inválido"})

    email = user.get("email", "")
    if not email:
        return _cors_response(401, {"message": "Token inválido"})

    raw_body = event.get("body", "") or ""
    if len(raw_body) > MAX_BODY_SIZE:
        return _cors_response(413, {"message": "Request muito grande"})
    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return _cors_response(400, {"message": "JSON inválido"})

    action = body.get("action", "")

    # ── Generate referral code ──
    if action == "generate-referral":
        return _action_generate_referral(email)

    # ── Join challenge ──
    if action == "join-challenge":
        return _action_join_challenge(email, body)

    # ── Quit challenge ──
    if action == "quit-challenge":
        return _action_quit_challenge(email)

    # ── Update all challenge returns (admin or cron trigger) ──
    if action == "update-challenges":
        user_data = _get_authenticated_user(event)
        if user_data and user_data.get("role") == "admin":
            return _update_all_challenge_returns()
        return _cors_response(403, {"message": "Admin only"})

    # ── Set avatar ──
    if action == "set-avatar":
        avatar = _sanitize_string(body.get("avatar", ""), 4)
        if not avatar:
            return _cors_response(400, {"message": "Avatar é obrigatório"})
        try:
            dynamodb.Table(USERS_TABLE).update_item(
                Key={"email": email},
                UpdateExpression="SET avatar = :a, updatedAt = :now",
                ExpressionAttributeValues={":a": avatar, ":now": datetime.now(UTC).isoformat()},
            )
            return _cors_response(200, {"message": "Avatar atualizado", "avatar": avatar})
        except ClientError as e:
            logger.error(f"Error setting avatar for {email}: {e}")
            return _cors_response(500, {"message": "Erro ao salvar avatar"})

    # ── Default: update user preferences (ticker, onboarding, profile) ──

    ticker = _sanitize_string(body.get("ticker", ""), 10).upper()
    onboarding_done = body.get("onboardingDone", False) is True
    investor_profile = _sanitize_string(body.get("investorProfile", ""), 20).lower()
    valid_profiles = ("conservador", "moderado", "arrojado")
    if investor_profile and investor_profile not in valid_profiles:
        investor_profile = ""

    # Notification preferences
    notif_prefs_raw = body.get("notificationPreferences", None)
    notif_prefs = None
    if isinstance(notif_prefs_raw, dict):
        valid_categories = {"drift", "anomaly", "cost", "degradation", "system"}
        email_types = [c for c in notif_prefs_raw.get("emailTypes", []) if c in valid_categories]
        sms_types = [c for c in notif_prefs_raw.get("smsTypes", []) if c in valid_categories]
        quiet_raw = notif_prefs_raw.get("quietHours", {})
        quiet_hours = {
            "enabled": quiet_raw.get("enabled", False) is True,
            "start": _sanitize_string(str(quiet_raw.get("start", "22:00")), 5),
            "end": _sanitize_string(str(quiet_raw.get("end", "08:00")), 5),
        }
        notif_prefs = {
            "emailTypes": email_types,
            "smsTypes": sms_types,
            "quietHours": quiet_hours,
        }

    # At least one field must be provided
    if not ticker and not onboarding_done and not investor_profile and notif_prefs is None:
        return _cors_response(400, {"message": "Nenhum campo para atualizar"})

    table = dynamodb.Table(USERS_TABLE)
    now = datetime.now(UTC).isoformat()

    update_parts = ["updatedAt = :now"]
    expr_values: dict = {":now": now}

    if ticker:
        update_parts.append("freeTicker = :t")
        expr_values[":t"] = ticker
    if onboarding_done:
        update_parts.append("onboardingDone = :done")
        expr_values[":done"] = True
    if investor_profile:
        update_parts.append("investorProfile = :profile")
        expr_values[":profile"] = investor_profile
    if notif_prefs is not None:
        update_parts.append("notificationPreferences = :notifPrefs")
        expr_values[":notifPrefs"] = notif_prefs

    update_expr = "SET " + ", ".join(update_parts)

    try:
        table.update_item(
            Key={"email": email},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
        )
        resp: dict = {"message": "Atualizado"}
        if ticker:
            resp["freeTicker"] = ticker
        if onboarding_done:
            resp["onboardingDone"] = True
        if investor_profile:
            resp["investorProfile"] = investor_profile
        if notif_prefs is not None:
            resp["notificationPreferences"] = notif_prefs
        return _cors_response(200, resp)
    except ClientError as e:
        logger.error(f"Error updating user prefs for {email}: {e}")
        return _cors_response(500, {"message": "Erro ao salvar"})


def _action_generate_referral(email: str) -> dict:
    """Generate a unique referral code for the user."""
    import hashlib
    table = dynamodb.Table(USERS_TABLE)
    now = datetime.now(UTC).isoformat()
    try:
        result = table.get_item(Key={"email": email}, ProjectionExpression="referralCode")
        existing = result.get("Item", {}).get("referralCode", "")
        if existing:
            return _cors_response(200, {"referralCode": existing})
    except Exception:
        pass
    raw = hashlib.sha256(f"{email}-{now}".encode()).hexdigest()[:8].upper()
    code = f"QYN{raw}"
    try:
        table.update_item(
            Key={"email": email},
            UpdateExpression="SET referralCode = :c, updatedAt = :now",
            ExpressionAttributeValues={":c": code, ":now": now},
        )
        return _cors_response(200, {"referralCode": code})
    except ClientError as e:
        logger.error(f"Error generating referral code for {email}: {e}")
        return _cors_response(500, {"message": "Erro ao gerar código"})


def _action_join_challenge(email: str, body: dict) -> dict:
    """Join the monthly IBOV challenge with a specific carteira."""
    carteira_id = _sanitize_string(body.get("carteiraId", ""), 20)

    # Validate carteira exists and belongs to user + snapshot tickers
    snapshot_tickers = []
    if carteira_id:
        try:
            cart_table = dynamodb.Table(CARTEIRAS_TABLE)
            result = cart_table.get_item(Key={"userEmail": email, "carteiraId": carteira_id})
            if "Item" not in result:
                return _cors_response(400, {"message": "Carteira não encontrada"})
            snapshot_tickers = result["Item"].get("tickers", [])
            if len(snapshot_tickers) < 3:
                return _cors_response(400, {"message": "A carteira precisa ter pelo menos 3 ações para participar do desafio."})
        except Exception:
            return _cors_response(500, {"message": "Erro ao validar carteira"})

    table = dynamodb.Table(USERS_TABLE)
    now = datetime.now(UTC)
    now_iso = now.isoformat()
    month_key = now.strftime("%Y-%m")
    start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    if now.month == 12:
        end_date = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    else:
        end_date = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    challenge_data = {
        "active": True, "month": month_key, "startDate": start_date, "endDate": end_date,
        "joinedAt": now_iso, "carteiraId": carteira_id, "tickers": snapshot_tickers,
        "userReturn": 0, "ibovReturn": 0, "streak": 0, "bestStreak": 0,
    }

    try:
        # Save current challenge + append to history
        item = table.get_item(Key={"email": email}).get("Item", {})
        challenge_history = item.get("challengeHistory", [])

        # If there's an existing active challenge for a different month, archive it
        old_challenge = item.get("challenge")
        if old_challenge and old_challenge.get("month") and old_challenge.get("month") != month_key:
            challenge_history.append(old_challenge)

        table.update_item(
            Key={"email": email},
            UpdateExpression="SET challenge = :c, challengeHistory = :h, updatedAt = :now",
            ExpressionAttributeValues={":c": challenge_data, ":h": challenge_history, ":now": now_iso},
        )
        return _cors_response(200, {
            "active": True, "month": month_key, "startDate": start_date, "endDate": end_date,
            "carteiraId": carteira_id,
            "userReturn": 0, "ibovReturn": 0, "isBeating": False,
            "streak": 0, "bestStreak": 0, "rank": 1, "totalParticipants": 1,
            "portfolio": [], "history": [],
        })
    except ClientError as e:
        logger.error(f"Error joining challenge for {email}: {e}")
        return _cors_response(500, {"message": "Erro ao entrar no desafio"})


def _action_quit_challenge(email: str) -> dict:
    """Quit the current active challenge, archiving it."""
    table = dynamodb.Table(USERS_TABLE)
    now_iso = datetime.now(UTC).isoformat()
    try:
        item = table.get_item(Key={"email": email}).get("Item", {})
        challenge = item.get("challenge", {})
        if not challenge.get("active"):
            return _cors_response(400, {"message": "Você não está em um desafio ativo."})

        # Archive current challenge
        challenge["active"] = False
        challenge["quitAt"] = now_iso
        history = item.get("challengeHistory", [])
        history.append(challenge)

        table.update_item(
            Key={"email": email},
            UpdateExpression="SET challenge = :c, challengeHistory = :h, updatedAt = :now",
            ExpressionAttributeValues={
                ":c": {"active": False},
                ":h": history,
                ":now": now_iso,
            },
        )
        return _cors_response(200, {"message": "Desafio encerrado.", "active": False})
    except ClientError as e:
        logger.error(f"Error quitting challenge for {email}: {e}")
        return _cors_response(500, {"message": "Erro ao sair do desafio"})


def _handle_user_data(event: dict) -> dict:
    """GET /auth/stats?type=X — return referral stats, challenge status, leaderboard, or achievements."""
    qs = event.get("queryStringParameters") or {}
    data_type = qs.get("type", "")

    if not data_type:
        # Default: public stats
        try:
            table = dynamodb.Table(USERS_TABLE)
            result = table.scan(Select="COUNT")
            return _cors_response(200, {"userCount": result.get("Count", 0)})
        except Exception:
            return _cors_response(200, {"userCount": 0})

    # All typed requests require auth
    user = _get_verified_user(event)
    if not user:
        return _cors_response(401, {"message": "Token inválido"})
    email = user.get("email", "")
    if not email:
        return _cors_response(401, {"message": "Token inválido"})

    table = dynamodb.Table(USERS_TABLE)

    if data_type == "referral":
        try:
            result = table.get_item(Key={"email": email}, ProjectionExpression="referralCode, referrals")
            item = result.get("Item", {})
            code = item.get("referralCode", "")
            referrals = item.get("referrals", [])
            if not code:
                return _cors_response(200, {})
            qualified = [r for r in referrals if r.get("status") == "qualified"]
            pending = [r for r in referrals if r.get("status") in ("pending", "paid")]
            return _cors_response(200, {
                "referralCode": code,
                "totalReferred": len(referrals),
                "activePaid": len(qualified),
                "rewardsEarned": len(qualified),
                "pendingRewards": len(pending),
                "referrals": referrals,
            })
        except Exception as e:
            logger.error(f"Error fetching referral stats for {email}: {e}")
            return _cors_response(500, {"message": "Erro ao buscar dados"})

    if data_type == "challenge":
        try:
            result = table.get_item(Key={"email": email}, ProjectionExpression="challenge, challengeHistory")
            item = result.get("Item", {})
            challenge = item.get("challenge")
            if not challenge or not challenge.get("active"):
                return _cors_response(200, {"active": False})

            # Auto-reset if month changed
            current_month = datetime.now(UTC).strftime("%Y-%m")
            challenge_month = challenge.get("month", "")
            if challenge_month and challenge_month != current_month:
                # Archive old challenge and deactivate
                history = item.get("challengeHistory", [])
                history.append(challenge)
                table.update_item(
                    Key={"email": email},
                    UpdateExpression="SET challenge = :c, challengeHistory = :h, updatedAt = :now",
                    ExpressionAttributeValues={
                        ":c": {"active": False},
                        ":h": history,
                        ":now": datetime.now(UTC).isoformat(),
                    },
                )
                return _cors_response(200, {"active": False})

            challenge["isBeating"] = challenge.get("userReturn", 0) > challenge.get("ibovReturn", 0)
            challenge["portfolio"] = challenge.get("portfolio", [])
            challenge["history"] = challenge.get("history", [])
            challenge["tickers"] = challenge.get("tickers", [])

            # Count total participants for this month
            try:
                all_users = table.scan(
                    FilterExpression="attribute_exists(challenge)",
                    ProjectionExpression="challenge",
                ).get("Items", [])
                active_count = sum(1 for u in all_users if u.get("challenge", {}).get("active") and u.get("challenge", {}).get("month") == challenge.get("month"))
                challenge["totalParticipants"] = max(active_count, 1)
                # Calculate rank
                user_ret = float(challenge.get("userReturn", 0))
                better_count = sum(1 for u in all_users if u.get("challenge", {}).get("active") and u.get("challenge", {}).get("month") == challenge.get("month") and float(u.get("challenge", {}).get("userReturn", 0)) > user_ret)
                challenge["rank"] = better_count + 1
            except Exception:
                challenge["rank"] = 1
                challenge["totalParticipants"] = 1

            return _cors_response(200, challenge)
        except Exception as e:
            logger.error(f"Error fetching challenge for {email}: {e}")
            return _cors_response(200, {"active": False})

    if data_type == "leaderboard":
        filter_month = qs.get("month", datetime.now(UTC).strftime("%Y-%m"))
        try:
            result = table.scan(
                ProjectionExpression="#n, email, challenge, challengeHistory, avatar",
                ExpressionAttributeNames={"#n": "name"},
                FilterExpression="attribute_exists(challenge) OR attribute_exists(challengeHistory)",
            )
            cart_table = dynamodb.Table(os.environ.get("CARTEIRAS_TABLE", "B3Dashboard-Carteiras"))
            items = result.get("Items", [])
            entries = []
            for item in items:
                ch = item.get("challenge", {})
                matched_ch = None
                if ch.get("active") and ch.get("month") == filter_month:
                    matched_ch = ch
                else:
                    for hist in item.get("challengeHistory", []):
                        if hist.get("month") == filter_month:
                            matched_ch = hist
                            break
                if matched_ch:
                    # Get carteira name
                    cart_name = ""
                    cart_id = matched_ch.get("carteiraId", "")
                    if cart_id:
                        try:
                            cr = cart_table.get_item(Key={"userEmail": item["email"], "carteiraId": cart_id}, ProjectionExpression="#n, icon", ExpressionAttributeNames={"#n": "name"})
                            ci = cr.get("Item", {})
                            cart_name = ci.get("name", "")
                        except Exception:
                            pass
                    entries.append({
                        "name": item.get("name", "Anônimo"),
                        "email": item.get("email", ""),
                        "return": matched_ch.get("userReturn", 0),
                        "avatar": item.get("avatar", ""),
                        "carteiraName": cart_name,
                        "tickers": matched_ch.get("tickers", []),
                    })
            entries.sort(key=lambda x: x["return"], reverse=True)
            leaderboard = []
            for i, e in enumerate(entries):
                leaderboard.append({
                    "rank": i + 1,
                    "name": _format_display_name(e["name"]),
                    "return": e["return"],
                    "isCurrentUser": e["email"] == email,
                    "avatar": e["avatar"],
                    "carteiraName": e["carteiraName"],
                    "tickerCount": len(e["tickers"]),
                })
            return _cors_response(200, leaderboard)
        except Exception as e:
            logger.error(f"Error fetching leaderboard: {e}")
            return _cors_response(200, [])

    if data_type == "past-months":
        # Return list of months that have challenge data
        try:
            result = table.get_item(Key={"email": email}, ProjectionExpression="challenge, challengeHistory")
            item = result.get("Item", {})
            months = set()
            ch = item.get("challenge", {})
            if ch.get("month"):
                months.add(ch["month"])
            for hist in item.get("challengeHistory", []):
                if hist.get("month"):
                    months.add(hist["month"])
            return _cors_response(200, sorted(months, reverse=True))
        except Exception:
            return _cors_response(200, [])

    if data_type == "achievements":
        try:
            result = table.get_item(Key={"email": email}, ProjectionExpression="challenge, badges")
            item = result.get("Item", {})
            badges = item.get("badges", [])
            if not badges:
                # No persisted badges yet — show defaults (daily job will populate them)
                ch = item.get("challenge", {})
                badges = [
                    {"id": "first_challenge", "name": "Primeiro Desafio", "description": "Entrou no desafio pela primeira vez", "icon": "first_challenge", "earned": ch.get("active", False), "earnedAt": ch.get("joinedAt", "")},
                    {"id": "beat_ibov_week", "name": "Semana Vitoriosa", "description": "Bateu o IBOV por 5 dias seguidos", "icon": "beat_ibov_week", "earned": False, "earnedAt": ""},
                    {"id": "beat_ibov_month", "name": "Mês de Ouro", "description": "Bateu o IBOV no mês inteiro", "icon": "beat_ibov_month", "earned": False, "earnedAt": ""},
                    {"id": "streak_3", "name": "Sequência de 3", "description": "3 dias consecutivos batendo o IBOV", "icon": "streak_3", "earned": False, "earnedAt": ""},
                    {"id": "streak_7", "name": "Sequência de 7", "description": "7 dias consecutivos batendo o IBOV", "icon": "streak_7", "earned": False, "earnedAt": ""},
                    {"id": "top_10", "name": "Top 10", "description": "Ficou entre os 10 melhores do ranking", "icon": "top_10", "earned": False, "earnedAt": ""},
                    {"id": "top_3", "name": "Pódio", "description": "Ficou entre os 3 melhores do ranking", "icon": "top_3", "earned": False, "earnedAt": ""},
                    {"id": "consistent", "name": "Consistente", "description": "Participou de 3 desafios consecutivos", "icon": "consistent", "earned": False, "earnedAt": ""},
                ]
            return _cors_response(200, badges)
        except Exception as e:
            logger.error(f"Error fetching achievements for {email}: {e}")
            return _cors_response(200, [])

    return _cors_response(400, {"message": f"Tipo desconhecido: {data_type}"})


def _fetch_ibov_monthly_prices(month_start: str) -> dict:
    """Fetch real IBOV (^BVSP) daily prices for the current month via BRAPI."""
    import urllib.request
    brapi_secret_id = os.environ.get("BRAPI_SECRET_ID", "brapi/pro/token")
    try:
        resp = secrets_client.get_secret_value(SecretId=brapi_secret_id)
        secret_str = resp.get("SecretString", "")
        try:
            token = json.loads(secret_str).get("token", "")
        except (json.JSONDecodeError, TypeError):
            token = secret_str.strip()
        if not token:
            return {}
    except Exception as e:
        logger.error(f"Error loading BRAPI token: {e}")
        return {}

    # Fetch ^BVSP 1mo history
    url = f"https://brapi.dev/api/quote/%5EBVSP?range=1mo&interval=1d&token={token}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "QyntaraBot/1.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode("utf-8"))
        results = data.get("results", [{}])[0]
        hist = results.get("historicalDataPrice", [])
        ibov_prices: dict = {}
        for point in hist:
            ts = point.get("date", 0)
            close = point.get("close", 0)
            if ts and close:
                dt = datetime.fromtimestamp(ts, tz=UTC)
                date_str = dt.strftime("%Y-%m-%d")
                if date_str >= month_start:
                    ibov_prices[date_str] = float(close)
        logger.info(f"Fetched {len(ibov_prices)} IBOV daily prices")
        return ibov_prices
    except Exception as e:
        logger.error(f"Error fetching IBOV from BRAPI: {e}")
        return {}


def _persist_badges(users_table, email: str, challenge: dict, rank: int, total: int) -> list:
    """Evaluate and persist badges for a user. Returns the updated badge list."""
    now_iso = datetime.now(UTC).isoformat()
    streak = challenge.get("streak", 0)
    best_streak = challenge.get("bestStreak", 0)
    is_beating = challenge.get("userReturn", 0) > challenge.get("ibovReturn", 0)
    history = challenge.get("history", [])
    beating_days = sum(1 for h in history if h.get("userReturn", 0) > h.get("ibovReturn", 0))

    # Load existing badges
    try:
        result = users_table.get_item(Key={"email": email}, ProjectionExpression="badges")
        existing = result.get("Item", {}).get("badges", [])
    except Exception:
        existing = []

    earned_ids = {b["id"] for b in existing if b.get("earned")}

    badge_defs = [
        {"id": "first_challenge", "name": "Primeiro Desafio", "description": "Entrou no desafio pela primeira vez", "check": True},
        {"id": "beat_ibov_week", "name": "Semana Vitoriosa", "description": "Bateu o IBOV por 5 dias seguidos", "check": best_streak >= 5},
        {"id": "beat_ibov_month", "name": "Mês de Ouro", "description": "Bateu o IBOV no mês inteiro", "check": len(history) >= 15 and beating_days == len(history)},
        {"id": "streak_3", "name": "Sequência de 3", "description": "3 dias consecutivos batendo o IBOV", "check": best_streak >= 3},
        {"id": "streak_7", "name": "Sequência de 7", "description": "7 dias consecutivos batendo o IBOV", "check": best_streak >= 7},
        {"id": "top_10", "name": "Top 10", "description": "Ficou entre os 10 melhores do ranking", "check": rank <= 10 and total >= 10},
        {"id": "top_3", "name": "Pódio", "description": "Ficou entre os 3 melhores do ranking", "check": rank <= 3 and total >= 3},
        {"id": "consistent", "name": "Consistente", "description": "Participou de 3 desafios consecutivos", "check": False},
    ]

    badges = []
    changed = False
    for bd in badge_defs:
        already = bd["id"] in earned_ids
        newly_earned = not already and bd["check"]
        badges.append({
            "id": bd["id"], "name": bd["name"], "description": bd["description"],
            "icon": bd["id"], "earned": already or newly_earned,
            "earnedAt": now_iso if newly_earned else next((b.get("earnedAt", "") for b in existing if b.get("id") == bd["id"] and b.get("earned")), ""),
        })
        if newly_earned:
            changed = True

    if changed:
        try:
            users_table.update_item(
                Key={"email": email},
                UpdateExpression="SET badges = :b",
                ExpressionAttributeValues={":b": badges},
            )
        except Exception as e:
            logger.error(f"Error persisting badges for {email}: {e}")

    return badges


def _backfill_plan_started_at(users_table) -> int:
    """One-time backfill: set planStartedAt for existing Pro users who don't have it."""
    try:
        result = users_table.scan(
            FilterExpression="attribute_not_exists(planStartedAt) AND #p = :pro",
            ExpressionAttributeNames={"#p": "plan"},
            ExpressionAttributeValues={":pro": "pro"},
            ProjectionExpression="email, upgradedAt, createdAt",
        )
        items = result.get("Items", [])
        count = 0
        for item in items:
            email = item.get("email", "")
            started = item.get("upgradedAt") or item.get("createdAt") or datetime.now(UTC).isoformat()
            try:
                users_table.update_item(
                    Key={"email": email},
                    UpdateExpression="SET planStartedAt = :s",
                    ExpressionAttributeValues={":s": started},
                )
                count += 1
            except Exception:
                pass
        if count:
            logger.info(f"Backfilled planStartedAt for {count} Pro users")
        return count
    except Exception as e:
        logger.error(f"Error backfilling planStartedAt: {e}")
        return 0


def _update_all_challenge_returns() -> dict:
    """Daily job: calculate portfolio returns vs real IBOV, persist badges, backfill planStartedAt."""
    import csv as csv_mod
    from io import StringIO

    if not BUCKET:
        logger.error("BUCKET env var not set")
        return {"statusCode": 200, "body": "BUCKET not configured"}

    now = datetime.now(UTC)
    current_month = now.strftime("%Y-%m")
    year = now.year
    month = now.month
    month_start = f"{year}-{month:02d}-01"

    # Backfill planStartedAt for existing Pro users (runs once, then no-ops)
    users_table = dynamodb.Table(USERS_TABLE)
    _backfill_plan_started_at(users_table)

    # 1. Load price data from S3
    price_map: dict = {}
    for m_offset in range(2):
        dt_m = datetime(year, month, 1) - timedelta(days=m_offset * 30)
        key = f"curated/daily_monthly/year={dt_m.year}/month={dt_m.month:02d}/daily.csv"
        try:
            obj = s3_client.get_object(Bucket=BUCKET, Key=key)
            content = obj["Body"].read().decode("utf-8")
            for row in csv_mod.DictReader(StringIO(content)):
                t, d, c = row.get("ticker", ""), row.get("date", ""), row.get("close", "")
                if t and d and c:
                    price_map.setdefault(t, {})[d] = float(c)
        except Exception:
            continue

    if not price_map:
        logger.warning("No price data found")
        return {"statusCode": 200, "body": "No price data"}

    # 2. Fetch real IBOV prices
    ibov_prices = _fetch_ibov_monthly_prices(month_start)

    all_dates = sorted(set(d for td in price_map.values() for d in td))
    month_dates = [d for d in all_dates if d >= month_start]

    if len(month_dates) < 2:
        return {"statusCode": 200, "body": "Not enough data"}

    first_date = month_dates[0]
    last_date = month_dates[-1]

    # Real IBOV return (fallback to proxy if BRAPI fails)
    if ibov_prices and first_date in ibov_prices and last_date in ibov_prices and ibov_prices[first_date] > 0:
        ibov_return = (ibov_prices[last_date] - ibov_prices[first_date]) / ibov_prices[first_date]
        logger.info(f"Using real IBOV return: {ibov_return:.4f}")
    else:
        # Fallback: equal-weight proxy
        proxy_rets = []
        for ticker, dates in price_map.items():
            if first_date in dates and last_date in dates and dates[first_date] > 0:
                proxy_rets.append((dates[last_date] - dates[first_date]) / dates[first_date])
        ibov_return = sum(proxy_rets) / len(proxy_rets) if proxy_rets else 0.0
        logger.info(f"Using proxy IBOV return: {ibov_return:.4f}")

    # 3. Scan active challenges
    cart_table = dynamodb.Table(os.environ.get("CARTEIRAS_TABLE", "B3Dashboard-Carteiras"))
    try:
        result = users_table.scan(FilterExpression="attribute_exists(challenge)", ProjectionExpression="email, challenge")
        items = result.get("Items", [])
    except Exception as e:
        logger.error(f"Error scanning: {e}")
        return {"statusCode": 500, "body": str(e)}

    # First pass: calculate all returns for ranking
    user_returns: dict = {}
    for item in items:
        email = item.get("email", "")
        ch = item.get("challenge", {})
        if not ch.get("active") or ch.get("month") != current_month:
            continue

        tickers = ch.get("tickers", [])
        if not tickers and ch.get("carteiraId"):
            try:
                cr = cart_table.get_item(Key={"userEmail": email, "carteiraId": ch["carteiraId"]})
                tickers = cr.get("Item", {}).get("tickers", [])
            except Exception:
                continue

        if not tickers:
            continue

        rets = []
        detail = []
        for ticker in tickers:
            if ticker in price_map and first_date in price_map[ticker] and last_date in price_map[ticker]:
                p0 = price_map[ticker][first_date]
                p1 = price_map[ticker][last_date]
                if p0 > 0:
                    r = (p1 - p0) / p0
                    rets.append(r)
                    detail.append({"ticker": ticker, "weight": round(1.0 / len(tickers), 4), "return": round(r, 6)})

        if rets:
            ur = sum(rets) / len(rets)
            user_returns[email] = {"return": ur, "detail": detail, "tickers": tickers, "challenge": ch}

    # Sort for ranking
    sorted_users = sorted(user_returns.items(), key=lambda x: x[1]["return"], reverse=True)
    rank_map = {email: i + 1 for i, (email, _) in enumerate(sorted_users)}
    total_participants = len(sorted_users)

    # Second pass: update each user
    updated = 0
    for email, data in user_returns.items():
        ur = data["return"]
        detail = data["detail"]
        tickers = data["tickers"]
        ch = data["challenge"]
        rank = rank_map.get(email, 1)

        # Daily history with real IBOV
        history = []
        for d in month_dates:
            day_rets = []
            for ticker in tickers:
                if ticker in price_map and first_date in price_map[ticker] and d in price_map[ticker]:
                    p0 = price_map[ticker][first_date]
                    if p0 > 0:
                        day_rets.append((price_map[ticker][d] - p0) / p0)

            day_ibov = 0.0
            if ibov_prices and first_date in ibov_prices and d in ibov_prices and ibov_prices[first_date] > 0:
                day_ibov = (ibov_prices[d] - ibov_prices[first_date]) / ibov_prices[first_date]
            elif day_rets:
                # Proxy fallback for daily
                proxy = []
                for t, dates in price_map.items():
                    if first_date in dates and d in dates and dates[first_date] > 0:
                        proxy.append((dates[d] - dates[first_date]) / dates[first_date])
                day_ibov = sum(proxy) / len(proxy) if proxy else 0.0

            if day_rets:
                history.append({"date": d, "userReturn": round(sum(day_rets) / len(day_rets), 6), "ibovReturn": round(day_ibov, 6)})

        # Streak
        streak = 0
        for h in reversed(history):
            if h["userReturn"] > h["ibovReturn"]:
                streak += 1
            else:
                break
        best_streak = max(streak, int(ch.get("bestStreak", 0)))

        # Update challenge
        try:
            users_table.update_item(
                Key={"email": email},
                UpdateExpression="SET challenge.userReturn = :ur, challenge.ibovReturn = :ir, challenge.streak = :s, challenge.bestStreak = :bs, challenge.portfolio = :p, challenge.history = :h, updatedAt = :now",
                ExpressionAttributeValues={
                    ":ur": Decimal(str(round(ur, 6))),
                    ":ir": Decimal(str(round(ibov_return, 6))),
                    ":s": streak, ":bs": best_streak,
                    ":p": detail, ":h": history,
                    ":now": now.isoformat(),
                },
            )
            updated += 1
        except Exception as e:
            logger.error(f"Error updating challenge for {email}: {e}")
            continue

        # Persist badges
        _persist_badges(users_table, email, {
            "userReturn": ur, "ibovReturn": ibov_return,
            "streak": streak, "bestStreak": best_streak, "history": history,
        }, rank, total_participants)

    logger.info(f"Challenge update: {updated} users, IBOV: {ibov_return:.4f}, participants: {total_participants}")
    return {"statusCode": 200, "body": json.dumps({"updated": updated, "ibovReturn": round(ibov_return, 6)})}


def handler(event: dict, context: Any = None) -> dict:
    """Lambda handler — routes to register/login/me/verify/reset/change-password/notifications."""

    # EventBridge scheduled event — update challenge returns
    if event.get("action") == "update-challenges" or event.get("source") == "aws.events":
        return _update_all_challenge_returns()

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
    elif path.endswith("/auth/me") and method == "DELETE":
        return _handle_delete_account(event)
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
    elif path.endswith("/admin/users/set-costs-access") and method == "POST":
        return _handle_admin_set_costs_access(event)
    elif path.endswith("/admin/users/delete") and method == "POST":
        return _handle_admin_delete_user(event)
    elif path.endswith("/admin/chat") and method == "GET":
        return _handle_admin_chat_list(event)
    elif path.endswith("/admin/chat/reply") and method == "POST":
        return _handle_admin_chat_reply(event)
    elif path.endswith("/admin/chat/close") and method == "POST":
        return _handle_admin_chat_close(event)
    elif path.endswith("/admin/chat/delete") and method == "POST":
        return _handle_admin_chat_delete(event)
    elif path.endswith("/chat/messages") and method == "POST":
        return _handle_chat_send(event)
    elif path.endswith("/chat/tickets") and method == "GET":
        return _handle_chat_get_user_tickets(event)
    elif path.endswith("/notifications") and method == "GET" and not path.endswith("/admin/notifications"):
        return _handle_get_user_notifications(event)
    elif path.endswith("/auth/stats") and method == "GET":
        return _handle_user_data(event)
    elif path.endswith("/auth/create-checkout") and method == "POST":
        return _handle_create_checkout(event)
    elif path.endswith("/auth/stripe-webhook") and method == "POST":
        return _handle_stripe_webhook(event)
    elif path.endswith("/auth/check-session") and method == "GET":
        return _handle_check_session(event)
    elif path.endswith("/auth/manage-billing") and method == "POST":
        return _handle_manage_billing(event)
    elif path.endswith("/auth/free-ticker") and method == "POST":
        return _handle_set_free_ticker(event)
    elif path.endswith("/carteiras") and method == "GET":
        return _handle_carteiras_list(event)
    elif path.endswith("/carteiras") and method == "POST":
        return _handle_carteiras_create(event)
    elif path.endswith("/carteiras") and method == "PUT":
        return _handle_carteiras_update(event)
    elif path.endswith("/carteiras") and method == "DELETE":
        return _handle_carteiras_delete(event)
    else:
        return _cors_response(404, {"message": "Not found"})
