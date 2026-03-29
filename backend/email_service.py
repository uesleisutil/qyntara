"""
Email service — verificação de email via SMTP.

Fluxo:
1. User registra → gera token de verificação → envia email
2. User clica no link → POST /auth/verify-email → marca email_verified=1
3. Endpoints Pro+ exigem email verificado

Suporta qualquer SMTP (Gmail, SES, Zoho, etc.)
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import smtplib
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from .config import settings

logger = logging.getLogger(__name__)


def generate_verification_token(user_id: str, email: str) -> str:
    """Gera token HMAC de verificação (expira em 24h, sem estado no DB)."""
    expires = int(time.time()) + 86400  # 24h
    payload = f"{user_id}:{email}:{expires}"
    sig = hmac.new(settings.JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{payload}:{sig}"


def verify_token(token: str) -> tuple[str, str] | None:
    """Valida token de verificação. Retorna (user_id, email) ou None."""
    try:
        parts = token.split(":")
        if len(parts) != 4:
            return None
        user_id, email, expires_str, sig = parts
        expires = int(expires_str)
        if time.time() > expires:
            return None
        payload = f"{user_id}:{email}:{expires_str}"
        expected = hmac.new(settings.JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:32]
        if not hmac.compare_digest(sig, expected):
            return None
        return user_id, email
    except Exception:
        return None


def send_verification_email(to_email: str, user_name: str, token: str):
    """Envia email de verificação via SMTP."""
    verify_url = f"{settings.FRONTEND_URL}/verify?token={token}"

    html = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 2rem;">
        <div style="text-align: center; margin-bottom: 2rem;">
            <span style="font-size: 1.5rem; font-weight: 700; color: #6366f1;">📊 Predikt</span>
        </div>
        <h2 style="color: #1a202c; font-size: 1.2rem;">Verify your email</h2>
        <p style="color: #64748b; line-height: 1.6;">
            Hi {user_name or 'there'},<br><br>
            Click the button below to verify your email and unlock all features.
        </p>
        <div style="text-align: center; margin: 2rem 0;">
            <a href="{verify_url}" style="
                display: inline-block; padding: 0.75rem 2rem; border-radius: 8px;
                background: #6366f1; color: #fff; text-decoration: none;
                font-weight: 600; font-size: 0.95rem;
            ">Verify Email</a>
        </div>
        <p style="color: #94a3b8; font-size: 0.78rem;">
            Or copy this link: <a href="{verify_url}" style="color: #6366f1;">{verify_url}</a>
        </p>
        <p style="color: #94a3b8; font-size: 0.72rem; margin-top: 2rem;">
            This link expires in 24 hours. If you didn't create an account, ignore this email.
        </p>
    </div>
    """

    _send_email(to_email, "Verify your Predikt account", html)


def send_welcome_email(to_email: str, user_name: str):
    """Envia email de boas-vindas após verificação."""
    html = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 2rem;">
        <div style="text-align: center; margin-bottom: 2rem;">
            <span style="font-size: 1.5rem; font-weight: 700; color: #6366f1;">📊 Predikt</span>
        </div>
        <h2 style="color: #1a202c;">Welcome to Predikt, {user_name or 'trader'}! 🎉</h2>
        <p style="color: #64748b; line-height: 1.6;">
            Your email is verified. Here's what you can do now:
        </p>
        <ul style="color: #64748b; line-height: 2;">
            <li><strong>Market Scanner</strong> — browse all Polymarket + Kalshi markets</li>
            <li><strong>AI Signals</strong> — upgrade to Pro for edge detection</li>
            <li><strong>Portfolio</strong> — track your positions and risk</li>
        </ul>
        <div style="text-align: center; margin: 2rem 0;">
            <a href="{settings.FRONTEND_URL}" style="
                display: inline-block; padding: 0.75rem 2rem; border-radius: 8px;
                background: #6366f1; color: #fff; text-decoration: none; font-weight: 600;
            ">Open Predikt</a>
        </div>
    </div>
    """
    _send_email(to_email, "Welcome to Predikt!", html)


def _send_email(to: str, subject: str, html_body: str):
    """Envia email via SMTP."""
    if not settings.SMTP_HOST:
        logger.warning(f"SMTP not configured, skipping email to {to}")
        return

    msg = MIMEMultipart("alternative")
    msg["From"] = f"Predikt <{settings.SMTP_FROM}>"
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    try:
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
            server.starttls()

        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, to, msg.as_string())
        server.quit()
        logger.info(f"Email sent to {to}: {subject}")
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
