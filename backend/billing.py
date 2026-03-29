"""
Stripe billing — gerencia assinaturas e webhooks.

Tiers:
- free: sem cobrança
- pro: $29/mês (STRIPE_PRICE_PRO)
- quant: $79/mês (STRIPE_PRICE_QUANT)

Fluxo:
1. User clica "Upgrade" → POST /billing/checkout → Stripe Checkout URL
2. Stripe redireciona de volta → webhook atualiza tier no DB
3. Cancelamento/downgrade via webhook
"""

from __future__ import annotations

import logging

import stripe
from fastapi import HTTPException, Request

from .config import settings
from .database import update_user_tier, update_user_stripe_customer

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY

TIER_PRICES = {
    "pro": settings.STRIPE_PRICE_PRO,
    "quant": settings.STRIPE_PRICE_QUANT,
}


def create_checkout_session(user: dict, tier: str) -> str:
    """Cria Stripe Checkout session e retorna URL."""
    if tier not in TIER_PRICES:
        raise HTTPException(400, f"Invalid tier: {tier}")

    price_id = TIER_PRICES[tier]
    if not price_id:
        raise HTTPException(500, "Stripe price not configured for this tier")

    # Criar ou reusar Stripe customer
    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        customer = stripe.Customer.create(
            email=user["email"],
            metadata={"user_id": user["id"]},
        )
        customer_id = customer.id
        update_user_stripe_customer(user["id"], customer_id)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.FRONTEND_URL}/billing?status=success",
        cancel_url=f"{settings.FRONTEND_URL}/billing?status=cancelled",
        metadata={"user_id": user["id"], "tier": tier},
    )
    return session.url


def create_portal_session(user: dict) -> str:
    """Cria Stripe Customer Portal session (gerenciar assinatura)."""
    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(400, "No active subscription")

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{settings.FRONTEND_URL}/billing",
    )
    return session.url


async def handle_webhook(request: Request) -> dict:
    """Processa webhooks do Stripe."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid webhook signature")
    except Exception as e:
        raise HTTPException(400, f"Webhook error: {e}")

    event_type = event["type"]
    data = event["data"]["object"]

    logger.info(f"Stripe webhook: {event_type}")

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(data)
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(data)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data)
    elif event_type == "invoice.payment_failed":
        _handle_payment_failed(data)

    return {"status": "ok"}


def _handle_checkout_completed(session: dict):
    """Checkout concluído — ativar tier."""
    user_id = session.get("metadata", {}).get("user_id")
    tier = session.get("metadata", {}).get("tier", "pro")
    sub_id = session.get("subscription")

    if user_id:
        update_user_tier(user_id, tier, sub_id)
        logger.info(f"User {user_id} upgraded to {tier}")


def _handle_subscription_updated(subscription: dict):
    """Assinatura atualizada (upgrade/downgrade)."""
    customer_id = subscription.get("customer")
    sub_id = subscription.get("id")
    status = subscription.get("status")
    price_id = subscription.get("items", {}).get("data", [{}])[0].get("price", {}).get("id", "")

    # Mapear price_id → tier
    tier = "free"
    for t, pid in TIER_PRICES.items():
        if pid == price_id:
            tier = t
            break

    if status != "active":
        tier = "free"

    # Encontrar user pelo customer_id
    from .database import get_db
    with get_db() as db:
        row = db.execute("SELECT id FROM users WHERE stripe_customer_id = ?", (customer_id,)).fetchone()
    if row:
        update_user_tier(row["id"], tier, sub_id)
        logger.info(f"Subscription updated: user={row['id']} tier={tier}")


def _handle_subscription_deleted(subscription: dict):
    """Assinatura cancelada — voltar pra free."""
    customer_id = subscription.get("customer")
    from .database import get_db
    with get_db() as db:
        row = db.execute("SELECT id FROM users WHERE stripe_customer_id = ?", (customer_id,)).fetchone()
    if row:
        update_user_tier(row["id"], "free", None)
        logger.info(f"Subscription cancelled: user={row['id']}")


def _handle_payment_failed(invoice: dict):
    """Pagamento falhou — logar (não downgrade imediato, Stripe tenta de novo)."""
    customer_id = invoice.get("customer")
    logger.warning(f"Payment failed for customer {customer_id}")
