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
)

router = APIRouter()


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
    stripe_customer_id: str,
):
    """Create a Stripe Customer Portal session for subscription management."""
    billing_service = get_billing_service()

    result = billing_service.create_customer_portal_session(
        stripe_customer_id=stripe_customer_id,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to create portal session"),
        )

    return {
        "portal_url": result["url"],
    }


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
def get_user_usage(user_id: str):
    """Get current usage statistics for a user."""
    billing_service = get_billing_service()

    # In production, get user's plan from database
    # For now, assume Professional plan
    user_plan = billing_service.get_plan(PlanTier.PROFESSIONAL)
    usage = billing_service.get_usage(user_id)

    limits = billing_service.check_usage_limits(user_plan, usage)

    return UsageResponse(
        generation_count=usage.generation_count,
        generations_limit=limits["limit"],
        remaining=limits["remaining"],
        extra_studios_used=usage.extra_studios_used,
        logo_branding_used=usage.logo_branding_used,
        premium_ai_uses=usage.premium_ai_uses,
        four_k_exports=usage.four_k_exports,
    )


@router.post("/usage/{user_id}/record")
def record_usage(
    user_id: str,
    generation: bool = False,
    extra_studio: bool = False,
    logo_branding: bool = False,
    premium_ai: bool = False,
    export_4k: bool = False,
):
    """Record usage for billing purposes."""
    billing_service = get_billing_service()

    usage = billing_service.record_usage(
        user_id=user_id,
        generation=generation,
        extra_studio=extra_studio,
        logo_branding=logo_branding,
        premium_ai=premium_ai,
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
    user_id: str,
    plan_tier: str = "professional",
    extra_studios: int = 0,
    logo_branding: bool = False,
    premium_ai: bool = False,
    export_4k: bool = False,
):
    """Calculate additional costs for usage beyond plan limits."""
    billing_service = get_billing_service()

    try:
        plan_tier_enum = PlanTier(plan_tier.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid plan tier")

    user_plan = billing_service.get_plan(plan_tier_enum)
    usage = billing_service.get_usage(user_id)

    cost_breakdown = billing_service.calculate_usage_cost(
        user_plan=user_plan,
        usage=usage,
        extra_studios=extra_studios,
        logo_branding=logo_branding,
        premium_ai=premium_ai,
        export_4k=export_4k,
    )

    return cost_breakdown


@router.get("/check-limits/{user_id}")
def check_usage_limits(user_id: str, plan_tier: str = "professional"):
    """Check if user has exceeded their plan limits."""
    billing_service = get_billing_service()

    try:
        plan_tier_enum = PlanTier(plan_tier.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid plan tier")

    user_plan = billing_service.get_plan(plan_tier_enum)
    usage = billing_service.get_usage(user_id)

    limits = billing_service.check_usage_limits(user_plan, usage)

    return limits
