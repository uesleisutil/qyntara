"""
Stripe billing — gerencia assinaturas e webhooks.

Tiers:
- free: sem cobrança
- pro: $29/mês (Payment Link ou Checkout Session)
- quant: $79/mês (STRIPE_PRICE_QUANT)

Fluxo:
1. User clica "Upgrade" → POST /billing/checkout → Stripe Checkout URL
   OU usa Payment Link com client_reference_id
2. Stripe envia webhook → atualiza tier no DynamoDB
3. Cancelamento/expiração via webhook → volta pra free
"""

from __future__ import annotations

import logging

import stripe
from fastapi import HTTPException, Request

from .config import settings
from .database import (
    update_user_tier,
    update_user_stripe_customer,
    get_user_by_stripe_customer,
    get_user_by_id,
)

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY

TIER_PRICES = {
    "pro": settings.STRIPE_PRICE_PRO,
    "quant": settings.STRIPE_PRICE_QUANT,
}

# Payment links
PAYMENT_LINK_PRO = "https://buy.stripe.com/5kQcN4fueabRaEi27I"
PAYMENT_LINK_QUANT = "https://buy.stripe.com/eVq9AS81M0BhbIm9Aa"


def create_checkout_session(user: dict, tier: str) -> str:
    """Cria Stripe Checkout session e retorna URL."""
    if tier not in TIER_PRICES:
        raise HTTPException(400, f"Plano inválido: {tier}")

    # Bloquear se email não verificado
    if not user.get("email_verified"):
        raise HTTPException(403, "Verifique seu email antes de assinar um plano.")

    price_id = TIER_PRICES.get(tier)

    # Se não tem price_id configurado, usar payment link
    if not price_id and tier == "pro":
        return f"{PAYMENT_LINK_PRO}?client_reference_id={user['id']}"
    if not price_id and tier == "quant":
        return f"{PAYMENT_LINK_QUANT}?client_reference_id={user['id']}"

    if not price_id:
        raise HTTPException(500, "Preço Stripe não configurado para este plano")

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
        success_url=f"{settings.FRONTEND_URL}?billing_status=success",
        cancel_url=f"{settings.FRONTEND_URL}?billing_status=cancelled",
        metadata={"user_id": user["id"], "tier": tier},
        client_reference_id=user["id"],
    )
    return session.url


def create_portal_session(user: dict) -> str:
    """Cria Stripe Customer Portal session (gerenciar assinatura)."""
    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(400, "Nenhuma assinatura ativa")

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{settings.FRONTEND_URL}",
    )
    return session.url


async def handle_webhook(request: Request) -> dict:
    """Processa webhooks do Stripe."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    # Se webhook secret configurado, validar assinatura
    if settings.STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig, settings.STRIPE_WEBHOOK_SECRET
            )
        except stripe.error.SignatureVerificationError:
            logger.error("Webhook: assinatura inválida")
            raise HTTPException(400, "Assinatura de webhook inválida")
        except Exception as e:
            logger.error(f"Webhook error: {e}")
            raise HTTPException(400, f"Erro no webhook: {e}")
    else:
        # Sem webhook secret — parse direto (dev mode)
        import json
        event = json.loads(payload)

    event_type = event["type"]
    data = event["data"]["object"]

    logger.info(f"Stripe webhook: {event_type}")

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(data)
    elif event_type == "customer.subscription.created":
        _handle_subscription_updated(data)
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(data)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data)
    elif event_type == "invoice.payment_failed":
        _handle_payment_failed(data)
    elif event_type == "invoice.payment_succeeded":
        _handle_payment_succeeded(data)

    return {"status": "ok"}


def _handle_checkout_completed(session: dict):
    """Checkout concluído — ativar tier."""
    # Tentar pegar user_id do metadata ou client_reference_id
    user_id = session.get("metadata", {}).get("user_id")
    if not user_id:
        user_id = session.get("client_reference_id")

    tier = session.get("metadata", {}).get("tier", "")
    sub_id = session.get("subscription")
    customer_id = session.get("customer")

    # Se tier não veio no metadata, inferir pelo price da subscription
    if not tier and sub_id:
        try:
            sub = stripe.Subscription.retrieve(sub_id)
            price_id = sub["items"]["data"][0]["price"]["id"] if sub.get("items", {}).get("data") else ""
            for t, pid in TIER_PRICES.items():
                if pid and pid == price_id:
                    tier = t
                    break
        except Exception as e:
            logger.warning(f"Could not retrieve subscription {sub_id}: {e}")

    if not tier:
        tier = "pro"  # fallback

    if not user_id and customer_id:
        # Tentar encontrar pelo customer_id
        user = get_user_by_stripe_customer(customer_id)
        if user:
            user_id = user["id"]

    if user_id:
        # Salvar customer_id se ainda não tiver
        if customer_id:
            user = get_user_by_id(user_id)
            if user and not user.get("stripe_customer_id"):
                update_user_stripe_customer(user_id, customer_id)

        update_user_tier(user_id, tier, sub_id)
        logger.info(f"✅ User {user_id} upgraded to {tier} (sub: {sub_id})")
    else:
        logger.warning(f"⚠️ Checkout completed but no user_id found. Session: {session.get('id')}")


def _handle_subscription_updated(subscription: dict):
    """Assinatura atualizada (upgrade/downgrade/renovação)."""
    customer_id = subscription.get("customer")
    sub_id = subscription.get("id")
    status = subscription.get("status")

    # Extrair price_id dos items
    items_data = subscription.get("items", {})
    if isinstance(items_data, dict):
        items_list = items_data.get("data", [])
    else:
        items_list = []

    price_id = ""
    if items_list:
        price_id = items_list[0].get("price", {}).get("id", "")

    # Mapear price_id → tier
    tier = ""
    for t, pid in TIER_PRICES.items():
        if pid and pid == price_id:
            tier = t
            break

    # Se não encontrou pelo price_id, inferir pelo amount
    if not tier and items_list:
        amount = items_list[0].get("price", {}).get("unit_amount", 0)
        if amount >= 7900:
            tier = "quant"
        elif amount >= 2900:
            tier = "pro"
        else:
            tier = "pro"  # fallback

    if not tier:
        tier = "pro"

    # Se subscription não está ativa, downgrade pra free
    if status not in ("active", "trialing"):
        tier = "free"

    # Encontrar user pelo customer_id no DynamoDB
    user = get_user_by_stripe_customer(customer_id)
    if user:
        update_user_tier(user["id"], tier, sub_id)
        logger.info(f"✅ Subscription updated: user={user['id']} tier={tier} status={status}")
    else:
        logger.warning(f"⚠️ Subscription updated but user not found for customer {customer_id}")


def _handle_subscription_deleted(subscription: dict):
    """Assinatura cancelada/expirada — voltar pra free."""
    customer_id = subscription.get("customer")

    user = get_user_by_stripe_customer(customer_id)
    if user:
        update_user_tier(user["id"], "free", None)
        logger.info(f"✅ Subscription cancelled: user={user['id']} → free")
    else:
        logger.warning(f"⚠️ Subscription deleted but user not found for customer {customer_id}")


def _handle_payment_failed(invoice: dict):
    """Pagamento falhou — logar (Stripe tenta de novo automaticamente)."""
    customer_id = invoice.get("customer")
    logger.warning(f"⚠️ Payment failed for customer {customer_id}")


def _handle_payment_succeeded(invoice: dict):
    """Pagamento bem-sucedido — garantir que tier está correto (renovação)."""
    customer_id = invoice.get("customer")
    sub_id = invoice.get("subscription")

    if not sub_id:
        return

    user = get_user_by_stripe_customer(customer_id)
    if user and user.get("tier") == "free":
        # Inferir tier pelo amount da invoice
        amount = invoice.get("amount_paid", 0)
        if amount >= 7900:
            tier = "quant"
        else:
            tier = "pro"
        update_user_tier(user["id"], tier, sub_id)
        logger.info(f"✅ Payment succeeded, restored tier: user={user['id']} → {tier}")
