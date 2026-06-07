"""
Billing API routes for subscription management.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, EmailStr

from ...services.billing import (
    BillingService,
    PlanTier,
    SubscriptionPlan,
    get_billing_service,
    get_plan_features,
    get_plan_tier_str,
    PLAN_NAMES,
)
from ...middleware.auth import get_current_user, get_db_session
from ...models import User, SessionLocal

router = APIRouter()


def _require_user(request: Request):
    """Return the current authenticated user or raise 401."""
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def _require_user_owns_id(request: Request, user_id: str):
    """Return current user after verifying they own the given user_id (string or int)."""
    user = _require_user(request)
    if str(user.id) != str(user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    return user


def _get_db(request: Request):
    """Get DB session from request state (set by auth middleware)."""
    db = get_db_session(request)
    if db is None:
        db = SessionLocal()
    return db


class PlanResponse(BaseModel):
    tier: str
    name: str
    price_monthly: int
    price_yearly: int
    price_monthly_display: str
    price_yearly_display: str
    features: Dict[str, Any]


class CheckoutRequest(BaseModel):
    plan_tier: str
    billing_cycle: str = "monthly"
    user_email: EmailStr
    user_id: Optional[str] = None


class UsageResponse(BaseModel):
    generation_count: int
    generations_limit: int
    remaining: int
    extra_studios_used: int
    logo_branding_used: int
    premium_ai_uses: int
    four_k_exports: int


@router.get("/plans", response_model=List[PlanResponse])
def list_plans():
    """List all available subscription plans."""
    billing_service = get_billing_service()
    plans = billing_service.get_all_plans()

    return [
        PlanResponse(
            tier=plan.tier.value,
            name=plan.name,
            price_monthly=plan.price_monthly,
            price_yearly=plan.price_yearly,
            price_monthly_display=f"{plan.price_monthly / 100:.0f} SEK",
            price_yearly_display=f"{plan.price_yearly / 100:.0f} SEK",
            features=plan.features,
        )
        for plan in plans
    ]


@router.get("/plans/{tier}")
def get_plan(tier: str):
    """Get details for a specific plan."""
    billing_service = get_billing_service()

    try:
        plan_tier = PlanTier(tier.lower())
    except ValueError:
        raise HTTPException(status_code=404, detail="Plan not found")

    plan = billing_service.get_plan(plan_tier)

    return {
        "tier": plan.tier.value,
        "name": plan.name,
        "price_monthly": plan.price_monthly,
        "price_yearly": plan.price_yearly,
        "price_monthly_display": f"{plan.price_monthly / 100:.0f} SEK",
        "price_yearly_display": f"{plan.price_yearly / 100:.0f} SEK",
        "features": plan.features,
    }


@router.post("/checkout")
def create_checkout_session(request: CheckoutRequest):
    """Create a Stripe Checkout session for subscription."""
    billing_service = get_billing_service()

    try:
        plan_tier = PlanTier(request.plan_tier.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid plan tier")

    if request.billing_cycle not in ["monthly", "yearly"]:
        raise HTTPException(status_code=400, detail="Invalid billing cycle")

    result = billing_service.create_checkout_session(
        customer_email=request.user_email,
        plan_tier=plan_tier,
        billing_cycle=request.billing_cycle,
        user_id=request.user_id,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to create checkout session"),
        )

    return {
        "checkout_url": result["url"],
        "session_id": result["session_id"],
    }


@router.get("/portal")
def get_portal_session(
    request: Request,
    stripe_customer_id: Optional[str] = None,
):
    """Create a Stripe Customer Portal session — resolved from the authenticated user's subscription."""
    current_user = _require_user(request)
    db = _get_db(request)

    db_user = db.query(User).filter(User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prefer the stripe_customer_id stored on the user's subscription over any query param
    customer_id = None
    if db_user.subscription:
        customer_id = db_user.subscription.stripe_customer_id

    # Allow explicit param only if it matches the authenticated user's stored id
    if stripe_customer_id:
        if customer_id and stripe_customer_id != customer_id:
            raise HTTPException(status_code=403, detail="stripe_customer_id does not belong to your account")
        customer_id = customer_id or stripe_customer_id

    if not customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer ID found for this account")

    billing_service = get_billing_service()
    result = billing_service.create_customer_portal_session(stripe_customer_id=customer_id)

    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to create portal session"),
        )

    return {"portal_url": result["url"]}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook events.

    This endpoint receives events from Stripe about:
    - Subscription changes
    - Payment successes/failures
    - Customer updates
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    billing_service = get_billing_service()
    result = billing_service.handle_webhook_event(payload, sig_header)

    if not result["success"]:
        raise HTTPException(
            status_code=400, detail=result.get("error", "Webhook processing failed")
        )

    return JSONResponse(content={"status": "success", "event": result})


@router.get("/usage/{user_id}", response_model=UsageResponse)
def get_user_usage(user_id: str, request: Request):
    """Get current usage statistics for a user (authenticated, owner-only)."""
    db_user = _require_user_owns_id(request, user_id)
    db = _get_db(request)

    # Reload with relationships
    db_user = db.query(User).filter(User.id == db_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    features = get_plan_features(db_user)
    generations_limit = features["generations_per_month"]

    u = db_user.usage
    if u:
        remaining = max(0, generations_limit - u.generation_count) if generations_limit >= 0 else -1
        return UsageResponse(
            generation_count=u.generation_count,
            generations_limit=generations_limit,
            remaining=remaining,
            extra_studios_used=u.extra_studios_used,
            logo_branding_used=u.logo_branding_used,
            premium_ai_uses=u.premium_ai_uses,
            four_k_exports=u.four_k_exports,
        )

    return UsageResponse(
        generation_count=0,
        generations_limit=generations_limit,
        remaining=generations_limit if generations_limit >= 0 else -1,
        extra_studios_used=0,
        logo_branding_used=0,
        premium_ai_uses=0,
        four_k_exports=0,
    )


@router.post("/usage/{user_id}/record")
def record_usage(
    user_id: str,
    request: Request,
    generation: bool = False,
    extra_studio: bool = False,
    logo_branding: bool = False,
    premium_ai: bool = False,
    export_4k: bool = False,
):
    """Record usage for billing purposes (authenticated, owner-only)."""
    _require_user_owns_id(request, user_id)
    billing_service = get_billing_service()

    usage = billing_service.record_usage(
        user_id=user_id,
        generation=generation,
        logo_branding=logo_branding,
        export_4k=export_4k,
    )

    return {
        "user_id": user_id,
        "generation_count": usage.generation_count,
        "extra_studios_used": usage.extra_studios_used,
        "logo_branding_used": usage.logo_branding_used,
        "premium_ai_uses": usage.premium_ai_uses,
        "four_k_exports": usage.four_k_exports,
    }


@router.post("/calculate-cost")
def calculate_usage_cost(
    request: Request,
    user_id: str,
    extra_studios: int = 0,
    logo_branding: bool = False,
    premium_ai: bool = False,
    export_4k: bool = False,
):
    """Calculate additional costs for usage beyond plan limits (authenticated, owner-only)."""
    _require_user_owns_id(request, user_id)
    # Placeholder until calculate_usage_cost is implemented server-side
    return {"message": "Cost calculation not yet implemented"}


@router.get("/check-limits/{user_id}")
def check_usage_limits(user_id: str, request: Request):
    """Check if user has exceeded their plan limits (authenticated, owner-only)."""
    db_user = _require_user_owns_id(request, user_id)
    db = _get_db(request)

    db_user = db.query(User).filter(User.id == db_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    billing_service = get_billing_service()
    limits = billing_service.check_usage_limits(db_user)
    return limits
