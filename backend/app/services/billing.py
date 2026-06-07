"""
Stripe payment and subscription management for AutoStudio AI.
"""

import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import stripe
from pydantic import BaseModel

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_placeholder")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_placeholder")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Re-export PlanTier from models so existing billing route imports continue to work
from app.models import PlanTier  # noqa: E402

# Backwards-compat alias — billing routes import this name but never use it
SubscriptionPlan = PlanTier

# ─────────────────────────────────────────────────────────────────────────────
# Plan tier definitions — single source of truth for ALL feature entitlements.
# Import PlanTier from models to avoid circular imports.
# ─────────────────────────────────────────────────────────────────────────────

# Feature entitlement matrix — keyed by plan_tier string value so it works
# whether plan_tier is a PlanTier enum instance or a plain string from the DB.
PLAN_FEATURES: Dict[str, Dict[str, Any]] = {
    "free": {
        "generations_per_month": 5,
        "max_resolution": "hd",
        "studios_included": ["white_corner_light_epoxy"],
        "watermark": True,          # AutoStudio watermark baked into every render
        "logo_branding": False,     # Cannot upload custom wall logo
        "custom_branding": False,
        "premium_ai": False,
        "four_k_exports": False,
        "priority_processing": False,
        "support_level": "none",
        "price_monthly_sek": 0,
    },
    "starter": {
        "generations_per_month": 20,
        "max_resolution": "hd",
        "studios_included": ["white_corner_light_epoxy", "white_corner_ceramic_tile"],
        "watermark": False,
        "logo_branding": False,
        "custom_branding": False,
        "premium_ai": False,
        "four_k_exports": False,
        "priority_processing": False,
        "support_level": "email",
        "price_monthly_sek": 49,
    },
    "pro": {
        "generations_per_month": 100,
        "max_resolution": "4k",
        "studios_included": [
            "white_corner_light_epoxy",
            "white_corner_ceramic_tile",
            "light_gray_corner_medium_epoxy",
        ],
        "watermark": False,
        "logo_branding": True,      # Custom wall logo enabled
        "custom_branding": False,
        "premium_ai": True,
        "four_k_exports": True,
        "priority_processing": True,
        "support_level": "priority",
        "price_monthly_sek": 199,
    },
    "enterprise": {
        "generations_per_month": -1,   # Unlimited
        "max_resolution": "4k",
        "studios_included": [],         # All studios
        "watermark": False,
        "logo_branding": True,
        "custom_branding": True,        # Full branding controls
        "premium_ai": True,
        "four_k_exports": True,
        "priority_processing": True,
        "support_level": "dedicated",
        "price_monthly_sek": 999,
    },
    # Legacy aliases — map to nearest equivalent
    "basic": {  # → starter
        "generations_per_month": 20,
        "max_resolution": "hd",
        "studios_included": ["white_corner_light_epoxy", "white_corner_ceramic_tile"],
        "watermark": False,
        "logo_branding": False,
        "custom_branding": False,
        "premium_ai": False,
        "four_k_exports": False,
        "priority_processing": False,
        "support_level": "email",
        "price_monthly_sek": 49,
    },
    "professional": {  # → pro
        "generations_per_month": 100,
        "max_resolution": "4k",
        "studios_included": [
            "white_corner_light_epoxy",
            "white_corner_ceramic_tile",
            "light_gray_corner_medium_epoxy",
        ],
        "watermark": False,
        "logo_branding": True,
        "custom_branding": False,
        "premium_ai": True,
        "four_k_exports": True,
        "priority_processing": True,
        "support_level": "priority",
        "price_monthly_sek": 199,
    },
}

# Human-readable plan names
PLAN_NAMES: Dict[str, str] = {
    "free": "Free",
    "starter": "Starter",
    "pro": "Pro",
    "enterprise": "Enterprise",
    # Legacy
    "basic": "Starter",
    "professional": "Pro",
}


def get_plan_features(user) -> Dict[str, Any]:
    """Return the feature dict for the given user based on subscription tier.

    This is the ONLY function that should be called to determine what a user
    can do. Never check user.role for entitlements.
    """
    tier = "free"
    if user.subscription and user.subscription.plan_tier:
        tier = user.subscription.plan_tier
        if hasattr(tier, "value"):
            tier = tier.value
    return PLAN_FEATURES.get(tier, PLAN_FEATURES["free"])


def get_plan_tier_str(user) -> str:
    """Return the normalized plan tier string for a user."""
    if user.subscription and user.subscription.plan_tier:
        tier = user.subscription.plan_tier
        return tier.value if hasattr(tier, "value") else str(tier)
    return "free"


class UsageRecord(BaseModel):
    """Track user usage for billing."""

    user_id: str
    generation_count: int = 0
    extra_studios_used: int = 0
    logo_branding_used: int = 0
    premium_ai_uses: int = 0
    four_k_exports: int = 0
    last_reset: datetime = datetime.utcnow()


class BillingService:
    """Service for handling all billing-related operations."""

    def __init__(self):
        self.usage_cache: Dict[str, UsageRecord] = {}

    def get_plan_features(self, tier: str) -> Dict[str, Any]:
        return PLAN_FEATURES.get(tier, PLAN_FEATURES["free"])

    def get_plan(self, tier) -> Dict[str, Any]:
        """Return plan feature dict for a PlanTier enum or string tier."""
        if hasattr(tier, "value"):
            tier = tier.value
        return PLAN_FEATURES.get(str(tier), PLAN_FEATURES["free"])

    def check_usage_limits(self, user) -> Dict[str, Any]:
        features = get_plan_features(user)
        generations_limit = features["generations_per_month"]

        if generations_limit < 0:
            return {"allowed": True, "remaining": -1, "limit": -1, "overage": False}

        u = user.usage
        if u is None:
            return {
                "allowed": True,
                "remaining": generations_limit,
                "limit": generations_limit,
                "overage": False,
            }

        now = datetime.utcnow()
        if now - u.last_reset > timedelta(days=30):
            u.generation_count = 0
            u.last_reset = now

        remaining = generations_limit - u.generation_count
        allowed = remaining > 0

        return {
            "allowed": allowed,
            "remaining": max(0, remaining),
            "limit": generations_limit,
            "overage": not allowed,
        }

    def create_checkout_session(
        self,
        customer_email: str,
        plan_tier: str,
        billing_cycle: str = "monthly",
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        stripe_price_ids = {
            ("starter", "monthly"): os.getenv("STRIPE_PRICE_STARTER_MONTHLY", "price_starter_monthly"),
            ("starter", "yearly"): os.getenv("STRIPE_PRICE_STARTER_YEARLY", "price_starter_yearly"),
            ("pro", "monthly"): os.getenv("STRIPE_PRICE_PRO_MONTHLY", "price_pro_monthly"),
            ("pro", "yearly"): os.getenv("STRIPE_PRICE_PRO_YEARLY", "price_pro_yearly"),
            ("enterprise", "monthly"): os.getenv("STRIPE_PRICE_ENTERPRISE_MONTHLY", "price_enterprise_monthly"),
            ("enterprise", "yearly"): os.getenv("STRIPE_PRICE_ENTERPRISE_YEARLY", "price_enterprise_yearly"),
        }
        price_id = stripe_price_ids.get((plan_tier, billing_cycle), "price_placeholder")

        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{"price": price_id, "quantity": 1}],
                mode="subscription",
                success_url=f"{FRONTEND_URL}/dashboard/billing?success=true&session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{FRONTEND_URL}/dashboard/billing?canceled=true",
                customer_email=customer_email,
                metadata={
                    "user_id": user_id or "",
                    "plan_tier": plan_tier,
                    "billing_cycle": billing_cycle,
                },
            )
            return {"success": True, "session_id": session.id, "url": session.url}
        except stripe.error.StripeError as e:
            return {"success": False, "error": str(e)}

    def create_customer_portal_session(self, stripe_customer_id: str) -> Dict[str, Any]:
        try:
            session = stripe.billing_portal.Session.create(
                customer=stripe_customer_id,
                return_url=f"{FRONTEND_URL}/dashboard/billing",
            )
            return {"success": True, "url": session.url}
        except stripe.error.StripeError as e:
            return {"success": False, "error": str(e)}

    def handle_webhook_event(self, payload: bytes, sig_header: str) -> Dict[str, Any]:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            return {"success": False, "error": f"Invalid webhook: {str(e)}"}

        handlers = {
            "customer.subscription.created": self._handle_subscription_created,
            "customer.subscription.updated": self._handle_subscription_updated,
            "customer.subscription.deleted": self._handle_subscription_deleted,
            "invoice.payment_succeeded": self._handle_payment_succeeded,
            "invoice.payment_failed": self._handle_payment_failed,
        }
        handler = handlers.get(event.type)
        if handler:
            return handler(event.data.object)
        return {"success": True, "message": f"Event {event.type} received"}

    def _handle_subscription_created(self, subscription) -> Dict[str, Any]:
        return {"action": "subscription_created", "subscription_id": subscription.id}

    def _handle_subscription_updated(self, subscription) -> Dict[str, Any]:
        return {"action": "subscription_updated", "subscription_id": subscription.id}

    def _handle_subscription_deleted(self, subscription) -> Dict[str, Any]:
        return {"action": "subscription_deleted", "subscription_id": subscription.id}

    def _handle_payment_succeeded(self, invoice) -> Dict[str, Any]:
        return {"action": "payment_succeeded", "amount_paid": invoice.amount_paid}

    def _handle_payment_failed(self, invoice) -> Dict[str, Any]:
        return {"action": "payment_failed", "amount_due": invoice.amount_due}

    def record_usage(
        self,
        user_id: str,
        generation: bool = False,
        logo_branding: bool = False,
        export_4k: bool = False,
    ) -> UsageRecord:
        if user_id not in self.usage_cache:
            self.usage_cache[user_id] = UsageRecord(user_id=user_id)
        usage = self.usage_cache[user_id]
        if generation:
            usage.generation_count += 1
        if logo_branding:
            usage.logo_branding_used += 1
        if export_4k:
            usage.four_k_exports += 1
        return usage

    def get_usage(self, user_id: str) -> UsageRecord:
        if user_id not in self.usage_cache:
            self.usage_cache[user_id] = UsageRecord(user_id=user_id)
        return self.usage_cache[user_id]


billing_service = BillingService()


def get_billing_service() -> BillingService:
    return billing_service
