"""
Predikt API — FastAPI server com auth, billing e security.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .auth import (
    RegisterRequest, LoginRequest, TokenResponse,
    register_user, login_user, refresh_tokens,
    get_current_user, get_optional_user, require_tier, require_admin,
)
from .billing import create_checkout_session, create_portal_session, handle_webhook
from .admin import (
    list_users, get_user_detail, update_user_admin, get_user_stats,
    get_model_performance, get_infra_status,
)
from .portfolio import (
    init_portfolio_db, add_position, get_user_positions,
    update_position, delete_position, calculate_portfolio_risk, simulate_scenarios,
)
from .notifications import (
    init_notifications_db, get_user_notifications, mark_read, mark_all_read, get_unread_count,
)
from .config import settings
from .data.polymarket_client import PolymarketClient, parse_market
from .data.kalshi_client import KalshiClient, parse_kalshi_market
from .data.news_client import NewsClient
from .database import init_db
from .database import get_user_by_id
from .models.sentiment_scorer import SentimentScorer
from .security import (
    add_security_middleware, limiter,
    check_brute_force, record_login_attempt, clear_login_attempts,
    sanitize_string,
)
from .storage import (
    ensure_bucket, save_market_cache, load_market_cache,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── State ──
_cache: dict[str, Any] = {
    "markets": [], "signals": [], "arbitrage": [],
    "last_refresh": None, "stats": {},
}
_ws_clients: set[WebSocket] = set()
poly_client: PolymarketClient | None = None
kalshi_client: KalshiClient | None = None
news_client: NewsClient | None = None
sentiment = SentimentScorer()
_initialized = False


def _ensure_init():
    """Lazy init — funciona tanto em uvicorn quanto em Lambda."""
    global poly_client, kalshi_client, news_client, _initialized, _cache
    if _initialized:
        return
    init_db()
    init_portfolio_db()
    init_notifications_db()
    ensure_bucket()
    poly_client = PolymarketClient()
    kalshi_client = KalshiClient()
    news_client = NewsClient()
    # Carregar cache do S3 (sobrevive cold starts)
    cached = load_market_cache()
    if cached.get("markets"):
        _cache.update(cached)
        logger.info(f"Loaded {len(cached['markets'])} markets from S3 cache")
    _initialized = True


# ── Data refresh ──

async def _refresh_markets():
    _ensure_init()
    try:
        markets = []
        if poly_client:
            raw = await poly_client.get_active_markets(limit=100)
            for r in raw:
                m = parse_market(r)
                if m["volume"] > 1000:
                    markets.append(m)
        if kalshi_client:
            try:
                raw_k = await kalshi_client.get_markets(limit=100)
                for r in raw_k:
                    m = parse_kalshi_market(r)
                    if m["volume"] > 100:
                        markets.append(m)
            except Exception as e:
                logger.warning(f"Kalshi: {e}")

        markets.sort(key=lambda m: m.get("volume_24h", 0), reverse=True)
        _cache["markets"] = markets
        _cache["last_refresh"] = datetime.now(timezone.utc).isoformat()
        _cache["stats"] = {
            "total_markets": len(markets),
            "polymarket": len([m for m in markets if m["source"] == "polymarket"]),
            "kalshi": len([m for m in markets if m["source"] == "kalshi"]),
            "volume_24h": sum(m.get("volume_24h", 0) for m in markets),
            "last_refresh": _cache["last_refresh"],
        }
        _cache["arbitrage"] = _find_arbitrage(markets)
        _cache["signals"] = _generate_signals(markets)
        await _broadcast({"type": "markets_updated", "count": len(markets)})

        # Persistir cache no S3 (sobrevive cold starts)
        try:
            save_market_cache(markets, _cache["signals"], _cache["arbitrage"], _cache["stats"])
        except Exception as e:
            logger.warning(f"Failed to save cache to S3: {e}")

        logger.info(f"Refreshed: {len(markets)} markets")
    except Exception as e:
        logger.error(f"Refresh error: {e}")


async def _periodic_refresh():
    while True:
        await _refresh_markets()
        await asyncio.sleep(60)


# ── App lifecycle ──

@asynccontextmanager
async def lifespan(app: FastAPI):
    _ensure_init()
    task = asyncio.create_task(_periodic_refresh())
    yield
    task.cancel()
    if poly_client:
        await poly_client.close()
    if kalshi_client:
        await kalshi_client.close()
    if news_client:
        await news_client.close()


app = FastAPI(title="Predikt API", version="0.1.0", lifespan=lifespan, docs_url=None if settings.is_production else "/docs")
app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)
add_security_middleware(app)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    rid = getattr(request.state, "request_id", "unknown")
    logger.error(f"[{rid}] Unhandled error: {exc}", exc_info=True)
    # Em produção, nunca vazar stack trace pro cliente
    if settings.is_production:
        return JSONResponse(status_code=500, content={"detail": "Internal server error", "request_id": rid})
    return JSONResponse(status_code=500, content={"detail": str(exc), "request_id": rid})


# ══════════════════════════════════════
# AUTH ENDPOINTS
# ══════════════════════════════════════

@app.post("/auth/register", response_model=TokenResponse)
async def register(request: Request, data: RegisterRequest = Body(...)):
    return register_user(data)


@app.post("/auth/login", response_model=TokenResponse)
async def login(request: Request, data: LoginRequest = Body(...)):
    ip = request.client.host if request.client else "unknown"
    if not check_brute_force(ip):
        from .security import audit_log
        audit_log("login_blocked_brute_force", ip=ip)
        raise HTTPException(429, "Too many login attempts. Try again in 5 minutes.")
    try:
        result = login_user(data)
        clear_login_attempts(ip)
        from .security import audit_log
        audit_log("login_success", user_id=result.user.get("id"), ip=ip)
        return result
    except HTTPException:
        record_login_attempt(ip)
        from .security import audit_log
        audit_log("login_failed", ip=ip, detail=data.email)
        raise


@app.post("/auth/refresh", response_model=TokenResponse)
async def refresh(request: Request, body: dict = Body(...)):
    token = body.get("refresh_token", "")
    if not token:
        raise HTTPException(400, "refresh_token required")
    return refresh_tokens(token)


@app.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@app.post("/auth/verify-email")
async def verify_email(request: Request, body: dict = Body(...)):
    token = body.get("token", "")
    if not token:
        raise HTTPException(400, "Token required")

    from .email_service import verify_token
    result = verify_token(token)
    if not result:
        raise HTTPException(400, "Invalid or expired verification token")

    user_id, email = result
    from .database import get_db
    with get_db() as db:
        db.execute("UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ? AND email = ?",
                   (datetime.now(timezone.utc).isoformat(), user_id, email))

    # Enviar welcome email
    try:
        from .email_service import send_welcome_email
        user = get_user_by_id(user_id)
        if user:
            send_welcome_email(email, user.get("name", ""))
    except Exception:
        pass

    from .security import audit_log
    audit_log("email_verified", user_id=user_id, detail=email)
    return {"ok": True, "message": "Email verified successfully"}


@app.post("/auth/resend-verification")
async def resend_verification(request: Request, user: dict = Depends(get_current_user)):
    if user.get("email_verified"):
        raise HTTPException(400, "Email already verified")

    from .email_service import generate_verification_token, send_verification_email
    full_user = get_user_by_id(user["id"])
    if not full_user:
        raise HTTPException(404, "User not found")

    token = generate_verification_token(full_user["id"], full_user["email"])
    send_verification_email(full_user["email"], full_user.get("name", ""), token)
    return {"ok": True, "message": "Verification email sent"}


# ══════════════════════════════════════
# BILLING ENDPOINTS
# ══════════════════════════════════════

@app.post("/billing/checkout")
async def checkout(body: dict = Body(...), user: dict = Depends(get_current_user)):
    tier = body.get("tier", "pro")
    url = create_checkout_session(user, tier)
    return {"url": url}


@app.post("/billing/portal")
async def portal(user: dict = Depends(get_current_user)):
    url = create_portal_session(user)
    return {"url": url}


@app.post("/billing/webhook")
async def webhook(request: Request):
    return await handle_webhook(request)


# ══════════════════════════════════════
# MARKET ENDPOINTS (public + tiered)
# ══════════════════════════════════════

@app.get("/markets")
async def list_markets(
    source: str | None = Query(None),
    category: str | None = Query(None),
    search: str | None = Query(None),
    sort: str = Query("volume_24h"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: dict | None = Depends(get_optional_user),
):
    _ensure_init()
    if not _cache.get("markets"):
        await _refresh_markets()
    markets = list(_cache.get("markets", []))
    if source:
        markets = [m for m in markets if m["source"] == source]
    if category:
        cat = sanitize_string(category, 50).lower()
        markets = [m for m in markets if cat in m.get("category", "").lower()]
    if search:
        q = sanitize_string(search, 100).lower()
        markets = [m for m in markets if q in m.get("question", "").lower()]

    markets.sort(key=lambda m: m.get(sort, 0), reverse=(sort != "yes_price"))
    total = len(markets)
    page = [{k: v for k, v in m.items() if k != "raw"} for m in markets[offset:offset + limit]]
    return {"markets": page, "total": total, "offset": offset, "limit": limit}


@app.get("/markets/{market_id}")
async def get_market_detail(market_id: str, user: dict | None = Depends(get_optional_user)):
    market = next((m for m in _cache.get("markets", []) if m["market_id"] == market_id), None)
    if not market:
        raise HTTPException(404, "Market not found")
    result = {k: v for k, v in market.items() if k != "raw"}
    # Sentiment (disponível pra todos, mas limitado pra free)
    if news_client:
        try:
            articles = await news_client.get_market_news(market["question"])
            result["sentiment"] = sentiment.score_articles(articles)
            if user and user.get("tier") in ("pro", "quant", "enterprise"):
                result["sentiment"]["articles"] = articles[:5]
        except Exception:
            pass
    return result


@app.get("/signals")
async def get_signals(
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(require_tier("pro")),
):
    return {"signals": _cache.get("signals", [])[:limit]}


@app.get("/signals/preview")
async def get_signals_preview(user: dict | None = Depends(get_optional_user)):
    """Preview gratuito — 3 sinais sem detalhes completos."""
    signals = _cache.get("signals", [])[:3]
    preview = [{"question": s["question"], "direction": s["direction"], "source": s["source"]} for s in signals]
    return {"signals": preview, "total_available": len(_cache.get("signals", [])), "tier_required": "pro"}


@app.get("/arbitrage")
async def get_arbitrage(user: dict = Depends(require_tier("pro"))):
    return {"opportunities": _cache.get("arbitrage", [])}


@app.get("/anomalies")
async def get_anomalies(user: dict = Depends(require_tier("quant"))):
    return {"anomalies": _cache.get("anomalies", [])}


@app.get("/stats")
async def get_stats():
    _ensure_init()
    # Se cache vazio, fazer refresh
    if not _cache.get("markets"):
        await _refresh_markets()
    return _cache.get("stats", {})


# ══════════════════════════════════════
# ADMIN ENDPOINTS
# ══════════════════════════════════════

@app.get("/admin/users")
async def admin_list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: str = Query(""),
    tier: str = Query(""),
    admin: dict = Depends(require_admin),
):
    return list_users(page, per_page, sanitize_string(search, 100), tier)


@app.get("/admin/users/stats")
async def admin_user_stats(admin: dict = Depends(require_admin)):
    return get_user_stats()


@app.get("/admin/users/{user_id}")
async def admin_get_user(user_id: str, admin: dict = Depends(require_admin)):
    user = get_user_detail(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user


@app.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: dict = Body(...), admin: dict = Depends(require_admin)):
    ok = update_user_admin(user_id, body)
    if not ok:
        raise HTTPException(400, "No valid fields to update")
    return {"ok": True}


@app.get("/admin/models")
async def admin_model_performance(admin: dict = Depends(require_admin)):
    return get_model_performance()


@app.get("/admin/infra")
async def admin_infra_status(admin: dict = Depends(require_admin)):
    return get_infra_status()


@app.get("/admin/audit")
async def admin_audit_log(
    limit: int = Query(100, ge=1, le=500),
    admin: dict = Depends(require_admin),
):
    from .security import get_audit_log
    return {"events": get_audit_log(limit)}


# ══════════════════════════════════════
# PORTFOLIO ENDPOINTS
# ══════════════════════════════════════

@app.get("/portfolio")
async def get_portfolio(user: dict = Depends(get_current_user)):
    positions = get_user_positions(user["id"])
    risk = calculate_portfolio_risk(positions, _cache.get("markets"))
    return {"positions": positions, "risk": risk}


@app.post("/portfolio")
async def create_position(body: dict = Body(...), user: dict = Depends(get_current_user)):
    required = ["market_id", "side", "shares", "avg_price"]
    for field in required:
        if field not in body:
            raise HTTPException(400, f"Missing field: {field}")
    # Tier limits
    tier = user.get("tier", "free")
    positions = get_user_positions(user["id"])
    limits = {"free": 5, "pro": 50, "quant": 500, "enterprise": 9999}
    if len(positions) >= limits.get(tier, 5):
        raise HTTPException(403, f"Position limit reached for {tier} tier ({limits[tier]})")
    pos = add_position(
        user["id"], body["market_id"], body.get("source", "polymarket"),
        body.get("question", ""), body["side"], float(body["shares"]), float(body["avg_price"]),
    )
    return pos


@app.put("/portfolio/{pos_id}")
async def update_pos(pos_id: str, body: dict = Body(...), user: dict = Depends(get_current_user)):
    ok = update_position(pos_id, user["id"], body)
    if not ok:
        raise HTTPException(400, "No valid fields to update")
    return {"ok": True}


@app.delete("/portfolio/{pos_id}")
async def delete_pos(pos_id: str, user: dict = Depends(get_current_user)):
    delete_position(pos_id, user["id"])
    return {"ok": True}


@app.get("/portfolio/scenarios")
async def portfolio_scenarios(user: dict = Depends(require_tier("pro"))):
    positions = get_user_positions(user["id"])
    return {"scenarios": simulate_scenarios(positions)}


# ══════════════════════════════════════
# NOTIFICATIONS ENDPOINTS
# ══════════════════════════════════════

@app.get("/notifications")
async def get_notifs(
    limit: int = Query(50, ge=1, le=200),
    unread: bool = Query(False),
    user: dict = Depends(get_current_user),
):
    notifs = get_user_notifications(user["id"], limit, unread)
    count = get_unread_count(user["id"])
    return {"notifications": notifs, "unread_count": count}


@app.post("/notifications/{nid}/read")
async def read_notif(nid: str, user: dict = Depends(get_current_user)):
    mark_read(nid, user["id"])
    return {"ok": True}


@app.post("/notifications/read-all")
async def read_all_notifs(user: dict = Depends(get_current_user)):
    mark_all_read(user["id"])
    return {"ok": True}


# ══════════════════════════════════════
# WEBSOCKET
# ══════════════════════════════════════

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    _ws_clients.add(ws)
    try:
        await ws.send_json({"type": "snapshot", "stats": _cache.get("stats", {})})
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        _ws_clients.discard(ws)


async def _broadcast(msg: dict):
    global _ws_clients
    dead = set()
    for ws in _ws_clients:
        try:
            await ws.send_json(msg)
        except Exception:
            dead.add(ws)
    _ws_clients -= dead


# ══════════════════════════════════════
# HELPERS
# ══════════════════════════════════════

def _find_arbitrage(markets: list[dict]) -> list[dict]:
    poly = [m for m in markets if m["source"] == "polymarket"]
    kalshi = [m for m in markets if m["source"] == "kalshi"]
    opps = []
    for p in poly:
        for k in kalshi:
            ratio = SequenceMatcher(None, p["question"].lower(), k["question"].lower()).ratio()
            if ratio > 0.6:
                spread = abs(p["yes_price"] - k["yes_price"])
                if spread > 0.03:
                    opps.append({
                        "polymarket": {"id": p["market_id"], "question": p["question"], "yes_price": p["yes_price"]},
                        "kalshi": {"id": k["market_id"], "question": k["question"], "yes_price": k["yes_price"]},
                        "spread": round(spread, 4),
                        "similarity": round(ratio, 2),
                        "direction": "buy_poly" if p["yes_price"] < k["yes_price"] else "buy_kalshi",
                    })
    opps.sort(key=lambda x: x["spread"], reverse=True)
    return opps[:20]


def _generate_signals(markets: list[dict]) -> list[dict]:
    signals = []
    for m in markets:
        v24 = m.get("volume_24h", 0)
        vtot = max(m.get("volume", 1), 1)
        yp = m.get("yes_price", 0.5)
        vol_ratio = v24 / vtot
        extremity = abs(yp - 0.5) * 2
        score = vol_ratio * 0.6 + extremity * 0.4
        if score > 0.1 and v24 > 5000:
            signals.append({
                "market_id": m["market_id"], "source": m["source"],
                "question": m["question"], "yes_price": yp,
                "volume_24h": v24, "signal_score": round(score, 4),
                "signal_type": "momentum" if vol_ratio > 0.3 else "value",
                "direction": "YES" if yp < 0.4 else "NO" if yp > 0.6 else "NEUTRAL",
            })
    signals.sort(key=lambda s: s["signal_score"], reverse=True)
    return signals[:30]
