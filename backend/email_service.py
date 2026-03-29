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
            <span style="font-size: 1.5rem; font-weight: 700; color: #6366f1;">📊 Qyntara</span>
        </div>
        <h2 style="color: #1a202c; font-size: 1.2rem;">Verifique seu email</h2>
        <p style="color: #64748b; line-height: 1.6;">
            Olá {user_name or ''},<br><br>
            Clique no botão abaixo para verificar seu email e desbloquear todos os recursos.
        </p>
        <div style="text-align: center; margin: 2rem 0;">
            <a href="{verify_url}" style="
                display: inline-block; padding: 0.75rem 2rem; border-radius: 8px;
                background: #6366f1; color: #fff; text-decoration: none;
                font-weight: 600; font-size: 0.95rem;
            ">Verificar Email</a>
        </div>
        <p style="color: #94a3b8; font-size: 0.78rem;">
            Ou copie este link: <a href="{verify_url}" style="color: #6366f1;">{verify_url}</a>
        </p>
        <p style="color: #94a3b8; font-size: 0.72rem; margin-top: 2rem;">
            Este link expira em 24 horas. Se você não criou uma conta, ignore este email.
        </p>
    </div>
    """

    _send_email(to_email, "Verifique sua conta Qyntara", html)


def send_welcome_email(to_email: str, user_name: str):
    """Envia email de boas-vindas após verificação."""
    html = f"""
    <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 2rem;">
        <div style="text-align: center; margin-bottom: 2rem;">
            <span style="font-size: 1.5rem; font-weight: 700; color: #6366f1;">📊 Qyntara</span>
        </div>
        <h2 style="color: #1a202c;">Bem-vindo ao Qyntara, {user_name or 'trader'}! 🎉</h2>
        <p style="color: #64748b; line-height: 1.6;">
            Seu email foi verificado. Veja o que você pode fazer agora:
        </p>
        <ul style="color: #64748b; line-height: 2;">
            <li><strong>Scanner de Mercados</strong> — navegue por todos os mercados do Polymarket + Kalshi</li>
            <li><strong>Sinais de IA</strong> — faça upgrade para Pro para detecção de edge</li>
            <li><strong>Portfólio</strong> — acompanhe suas posições e risco</li>
        </ul>
        <div style="text-align: center; margin: 2rem 0;">
            <a href="{settings.FRONTEND_URL}" style="
                display: inline-block; padding: 0.75rem 2rem; border-radius: 8px;
                background: #6366f1; color: #fff; text-decoration: none; font-weight: 600;
            ">Abrir Qyntara</a>
        </div>
    </div>
    """
    _send_email(to_email, "Bem-vindo ao Qyntara!", html)


def _send_email(to: str, subject: str, html_body: str):
    """Envia email via SMTP."""
    if not settings.SMTP_HOST:
        logger.warning(f"SMTP not configured, skipping email to {to}")
        return

    msg = MIMEMultipart("alternative")
    msg["From"] = f"Qyntara <{settings.SMTP_FROM}>"
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
