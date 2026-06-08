"""
Stripe payment and subscription management for AutoStudio AI.
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import stripe
from pydantic import BaseModel

logger = logging.getLogger(__name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_placeholder")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_placeholder")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# In production, Stripe keys must be real — validated at startup via main.py

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


class PlanInfo:
    """Lightweight plan descriptor returned by BillingService.get_all_plans()."""

    def __init__(self, tier_str: str):
        self._tier_str = tier_str
        features = PLAN_FEATURES[tier_str]
        self.name = PLAN_NAMES.get(tier_str, tier_str.title())
        price_sek = features.get("price_monthly_sek", 0)
        self.price_monthly = price_sek * 100  # store in öre like Stripe convention
        self.price_yearly = price_sek * 100 * 10  # simple 2-month discount
        self.features = features

    class _TierWrapper:
        def __init__(self, value):
            self.value = value

    @property
    def tier(self):
        return self._TierWrapper(self._tier_str)


_CANONICAL_TIERS = ["free", "starter", "pro", "enterprise"]


class BillingService:
    """Service for handling all billing-related operations."""

    def __init__(self):
        self.usage_cache: Dict[str, UsageRecord] = {}

    def get_all_plans(self) -> List["PlanInfo"]:
        return [PlanInfo(t) for t in _CANONICAL_TIERS]

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

    # ── Stripe price-ID → plan tier reverse lookup ────────────────────────────
    @staticmethod
    def _price_to_tier() -> Dict[str, str]:
        """Build a mapping from Stripe price ID → plan tier string."""
        mapping: Dict[str, str] = {}
        for tier in ("starter", "pro", "enterprise"):
            for cycle in ("monthly", "yearly"):
                env_key = f"STRIPE_PRICE_{tier.upper()}_{cycle.upper()}"
                price_id = os.getenv(env_key, "")
                if price_id and not price_id.startswith("price_"):
                    # Only add real (non-placeholder) price IDs
                    mapping[price_id] = tier
                elif price_id.startswith("price_") and not price_id.endswith("_placeholder"):
                    mapping[price_id] = tier
        return mapping

    def handle_webhook_event(self, payload: bytes, sig_header: str, db=None) -> Dict[str, Any]:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            return {"success": False, "error": f"Invalid webhook: {str(e)}"}

        handlers = {
            "checkout.session.completed": self._handle_checkout_completed,
            "customer.subscription.created": self._handle_subscription_upsert,
            "customer.subscription.updated": self._handle_subscription_upsert,
            "customer.subscription.deleted": self._handle_subscription_deleted,
            "invoice.payment_succeeded": self._handle_payment_succeeded,
            "invoice.payment_failed": self._handle_payment_failed,
        }
        handler = handlers.get(event.type)
        if handler:
            return handler(event.data.object, db=db)
        return {"success": True, "message": f"Event {event.type} received"}

    def _handle_checkout_completed(self, session, db=None) -> Dict[str, Any]:
        """Link Stripe customer_id to the user when checkout completes."""
        if db is None:
            return {"success": True, "action": "skipped_no_db"}

        user_id = session.metadata.get("user_id") if session.metadata else None
        customer_id = getattr(session, "customer", None)
        plan_tier = session.metadata.get("plan_tier", "free") if session.metadata else "free"

        if not user_id or not customer_id:
            logger.warning(
                "checkout.session.completed: missing user_id or customer_id in metadata: %s",
                session.id,
            )
            return {"success": True, "action": "checkout_completed_no_user"}

        from app.models import Subscription as SubscriptionModel

        try:
            sub_row = (
                db.query(SubscriptionModel)
                .filter(SubscriptionModel.user_id == int(user_id))
                .first()
            )
            if sub_row:
                sub_row.stripe_customer_id = customer_id
                sub_row.plan_tier = plan_tier
                sub_row.status = "active"
                sub_row.updated_at = datetime.utcnow()
                db.commit()
                logger.info(
                    "checkout.session.completed: linked customer_id=%s to user_id=%s plan=%s",
                    customer_id, user_id, plan_tier,
                )
            return {"success": True, "action": "checkout_completed", "user_id": user_id}
        except Exception:
            db.rollback()
            logger.exception("Webhook: DB error on checkout.session.completed for user %s", user_id)
            return {"success": False, "error": "DB error on checkout completed"}

    def _handle_subscription_upsert(self, subscription, db=None) -> Dict[str, Any]:
        """Sync a Stripe subscription (created or updated) into the database."""
        if db is None:
            logger.warning("Webhook handler called without DB session — skipping DB sync")
            return {"success": True, "action": "skipped_no_db", "subscription_id": subscription.id}

        from app.models import User, Subscription as SubscriptionModel

        customer_id = subscription.customer
        stripe_sub_id = subscription.id
        status = subscription.status  # active, past_due, canceled, trialing, etc.

        # Determine plan tier from the first price item
        price_to_tier = self._price_to_tier()
        plan_tier = "free"
        items = getattr(subscription, "items", None)
        if items and items.data:
            price_id = items.data[0].price.id
            plan_tier = price_to_tier.get(price_id, "free")

        period_start = None
        period_end = None
        if subscription.current_period_start:
            period_start = datetime.utcfromtimestamp(subscription.current_period_start)
        if subscription.current_period_end:
            period_end = datetime.utcfromtimestamp(subscription.current_period_end)

        try:
            # Find the user by stripe_customer_id (set on checkout completion)
            sub_row = (
                db.query(SubscriptionModel)
                .filter(SubscriptionModel.stripe_customer_id == customer_id)
                .first()
            )
            if sub_row is None:
                # Try matching by stripe_subscription_id for updates
                sub_row = (
                    db.query(SubscriptionModel)
                    .filter(SubscriptionModel.stripe_subscription_id == stripe_sub_id)
                    .first()
                )
            if sub_row is None:
                logger.warning(
                    "Webhook: no subscription row found for customer_id=%s sub_id=%s",
                    customer_id, stripe_sub_id,
                )
                return {"success": True, "action": "no_user_found", "customer_id": customer_id}

            sub_row.stripe_subscription_id = stripe_sub_id
            sub_row.stripe_customer_id = customer_id
            sub_row.plan_tier = plan_tier
            sub_row.status = status
            sub_row.current_period_start = period_start
            sub_row.current_period_end = period_end
            sub_row.updated_at = datetime.utcnow()
            db.commit()
            logger.info(
                "Webhook: synced subscription %s → user_id=%s plan=%s status=%s",
                stripe_sub_id, sub_row.user_id, plan_tier, status,
            )
            return {
                "success": True,
                "action": "subscription_synced",
                "subscription_id": stripe_sub_id,
                "plan_tier": plan_tier,
                "status": status,
            }
        except Exception:
            db.rollback()
            logger.exception("Webhook: DB error syncing subscription %s", stripe_sub_id)
            return {"success": False, "error": "DB error during subscription sync"}

    def _handle_subscription_deleted(self, subscription, db=None) -> Dict[str, Any]:
        """Downgrade user to free when their Stripe subscription is cancelled."""
        if db is None:
            return {"success": True, "action": "skipped_no_db", "subscription_id": subscription.id}

        from app.models import Subscription as SubscriptionModel

        stripe_sub_id = subscription.id
        try:
            sub_row = (
                db.query(SubscriptionModel)
                .filter(SubscriptionModel.stripe_subscription_id == stripe_sub_id)
                .first()
            )
            if sub_row:
                sub_row.plan_tier = "free"
                sub_row.status = "canceled"
                sub_row.stripe_subscription_id = None
                sub_row.current_period_end = None
                sub_row.updated_at = datetime.utcnow()
                db.commit()
                logger.info(
                    "Webhook: subscription %s canceled — user_id=%s downgraded to free",
                    stripe_sub_id, sub_row.user_id,
                )
            return {"success": True, "action": "subscription_canceled", "subscription_id": stripe_sub_id}
        except Exception:
            db.rollback()
            logger.exception("Webhook: DB error canceling subscription %s", stripe_sub_id)
            return {"success": False, "error": "DB error during subscription cancellation"}

    def _handle_payment_succeeded(self, invoice, db=None) -> Dict[str, Any]:
        """Mark subscription as active after a successful payment."""
        stripe_sub_id = getattr(invoice, "subscription", None)
        if not stripe_sub_id or db is None:
            return {"success": True, "action": "payment_succeeded_no_sync"}

        from app.models import Subscription as SubscriptionModel

        try:
            sub_row = (
                db.query(SubscriptionModel)
                .filter(SubscriptionModel.stripe_subscription_id == stripe_sub_id)
                .first()
            )
            if sub_row and sub_row.status == "past_due":
                sub_row.status = "active"
                sub_row.updated_at = datetime.utcnow()
                db.commit()
                logger.info("Webhook: payment succeeded for sub %s — status → active", stripe_sub_id)
            return {"success": True, "action": "payment_succeeded", "subscription_id": stripe_sub_id}
        except Exception:
            db.rollback()
            logger.exception("Webhook: DB error on payment_succeeded for sub %s", stripe_sub_id)
            return {"success": False, "error": "DB error on payment succeeded"}

    def _handle_payment_failed(self, invoice, db=None) -> Dict[str, Any]:
        """Mark subscription as past_due after a failed payment."""
        stripe_sub_id = getattr(invoice, "subscription", None)
        if not stripe_sub_id or db is None:
            return {"success": True, "action": "payment_failed_no_sync"}

        from app.models import Subscription as SubscriptionModel

        try:
            sub_row = (
                db.query(SubscriptionModel)
                .filter(SubscriptionModel.stripe_subscription_id == stripe_sub_id)
                .first()
            )
            if sub_row:
                sub_row.status = "past_due"
                sub_row.updated_at = datetime.utcnow()
                db.commit()
                logger.info("Webhook: payment failed for sub %s — status → past_due", stripe_sub_id)
            return {"success": True, "action": "payment_failed", "subscription_id": stripe_sub_id}
        except Exception:
            db.rollback()
            logger.exception("Webhook: DB error on payment_failed for sub %s", stripe_sub_id)
            return {"success": False, "error": "DB error on payment failed"}

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
