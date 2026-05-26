"""
Stripe payment and subscription management for AutoStudio AI.

Handles:
- Subscription plans (Basic, Professional, Enterprise)
- Usage-based billing (extra studios, 4K exports, premium AI)
- Stripe Checkout sessions
- Webhook handling for payment events
- Customer portal for subscription management
"""

import os
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

import stripe
from pydantic import BaseModel

# Stripe configuration
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_placeholder")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_placeholder")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


class PlanTier(str, Enum):
    BASIC = "basic"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class SubscriptionPlan(BaseModel):
    """Subscription plan definition."""

    tier: PlanTier
    name: str
    price_monthly: int  # In cents
    price_yearly: int  # In cents
    stripe_price_id_monthly: str
    stripe_price_id_yearly: str
    features: Dict[str, Any]


# Plan configurations
PLANS: Dict[PlanTier, SubscriptionPlan] = {
    PlanTier.BASIC: SubscriptionPlan(
        tier=PlanTier.BASIC,
        name="Basic",
        price_monthly=2900,  # $29/month
        price_yearly=29000,  # $290/year (save ~17%)
        stripe_price_id_monthly="price_basic_monthly",  # Replace with actual Stripe price IDs
        stripe_price_id_yearly="price_basic_yearly",
        features={
            "generations_per_month": 20,
            "max_resolution": "hd",
            "studios_included": ["white_studio"],
            "extra_studio_price": 500,  # $5 per extra studio
            "logo_branding": False,
            "logo_branding_price": 0,
            "premium_ai": False,
            "premium_ai_price_per_use": 200,  # $2 per premium AI use
            "priority_processing": False,
            "support_level": "email",
        },
    ),
    PlanTier.PROFESSIONAL: SubscriptionPlan(
        tier=PlanTier.PROFESSIONAL,
        name="Professional",
        price_monthly=7900,  # $79/month
        price_yearly=79000,  # $790/year
        stripe_price_id_monthly="price_pro_monthly",
        stripe_price_id_yearly="price_pro_yearly",
        features={
            "generations_per_month": 100,
            "max_resolution": "4k",
            "studios_included": ["white_studio", "luxury_showroom", "dark_cinematic"],
            "extra_studio_price": 300,  # $3 per extra studio
            "logo_branding": True,
            "logo_branding_price": 0,
            "premium_ai": True,
            "premium_ai_price_per_use": 0,
            "priority_processing": True,
            "support_level": "priority",
        },
    ),
    PlanTier.ENTERPRISE: SubscriptionPlan(
        tier=PlanTier.ENTERPRISE,
        name="Enterprise",
        price_monthly=19900,  # $199/month
        price_yearly=199000,  # $1990/year
        stripe_price_id_monthly="price_enterprise_monthly",
        stripe_price_id_yearly="price_enterprise_yearly",
        features={
            "generations_per_month": -1,  # Unlimited
            "max_resolution": "4k",
            "studios_included": [
                "white_studio",
                "luxury_showroom",
                "dark_cinematic",
                "outdoor_dealership",
            ],
            "extra_studio_price": 0,  # All studios included
            "logo_branding": True,
            "logo_branding_price": 0,
            "premium_ai": True,
            "premium_ai_price_per_use": 0,
            "priority_processing": True,
            "support_level": "dedicated",
            "custom_studios": True,
            "api_access": True,
            "batch_processing": True,
        },
    ),
}


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

    def get_plan(self, tier: PlanTier) -> SubscriptionPlan:
        """Get plan details by tier."""
        return PLANS[tier]

    def get_all_plans(self) -> List[SubscriptionPlan]:
        """Get all available plans."""
        return list(PLANS.values())

    def calculate_usage_cost(
        self,
        user_plan: SubscriptionPlan,
        usage: UsageRecord,
        extra_studios: int = 0,
        logo_branding: bool = False,
        premium_ai: bool = False,
        export_4k: bool = False,
    ) -> Dict[str, Any]:
        """
        Calculate additional costs based on usage.

        Returns breakdown of charges.
        """
        features = user_plan.features
        charges = []
        total_cents = 0

        # Extra studios (beyond included)
        if extra_studios > 0:
            included_studios = len(features["studios_included"])
            if extra_studios > included_studios:
                extra_count = extra_studios - included_studios
                extra_cost = extra_count * features["extra_studio_price"]
                charges.append(
                    {
                        "item": "Extra Studios",
                        "quantity": extra_count,
                        "unit_price": features["extra_studio_price"],
                        "total": extra_cost,
                    }
                )
                total_cents += extra_cost

        # Logo branding
        if logo_branding and not features["logo_branding"]:
            logo_cost = 1000  # $10 per generation with logo
            charges.append(
                {
                    "item": "Logo Branding",
                    "quantity": 1,
                    "unit_price": logo_cost,
                    "total": logo_cost,
                }
            )
            total_cents += logo_cost

        # Premium AI processing
        if premium_ai and not features["premium_ai"]:
            ai_cost = features["premium_ai_price_per_use"]
            charges.append(
                {
                    "item": "Premium AI Processing",
                    "quantity": 1,
                    "unit_price": ai_cost,
                    "total": ai_cost,
                }
            )
            total_cents += ai_cost

        # 4K export (if not included in plan)
        if export_4k and features["max_resolution"] != "4k":
            four_k_cost = 500  # $5 per 4K export
            charges.append(
                {
                    "item": "4K Export",
                    "quantity": 1,
                    "unit_price": four_k_cost,
                    "total": four_k_cost,
                }
            )
            total_cents += four_k_cost

        return {
            "charges": charges,
            "total_cents": total_cents,
            "total_dollars": total_cents / 100,
        }

    def check_usage_limits(
        self,
        user_plan: SubscriptionPlan,
        usage: UsageRecord,
    ) -> Dict[str, Any]:
        """
        Check if user has exceeded their plan limits.

        Returns whether action is allowed and any overage info.
        """
        features = user_plan.features
        generations_limit = features["generations_per_month"]

        # Check if unlimited
        if generations_limit < 0:
            return {
                "allowed": True,
                "remaining": -1,
                "limit": -1,
                "overage": False,
            }

        # Check if reset is needed (monthly reset)
        now = datetime.utcnow()
        if now - usage.last_reset > timedelta(days=30):
            usage.generation_count = 0
            usage.last_reset = now

        remaining = generations_limit - usage.generation_count
        allowed = remaining > 0

        return {
            "allowed": allowed,
            "remaining": max(0, remaining),
            "limit": generations_limit,
            "overage": not allowed,
            "overage_price": 300 if not allowed else 0,  # $3 per extra generation
        }

    def create_checkout_session(
        self,
        customer_email: str,
        plan_tier: PlanTier,
        billing_cycle: str = "monthly",
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a Stripe Checkout session for subscription."""
        plan = self.get_plan(plan_tier)

        price_id = (
            plan.stripe_price_id_monthly
            if billing_cycle == "monthly"
            else plan.stripe_price_id_yearly
        )

        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[
                    {
                        "price": price_id,
                        "quantity": 1,
                    },
                ],
                mode="subscription",
                success_url=f"{FRONTEND_URL}/dashboard/billing?success=true&session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{FRONTEND_URL}/dashboard/billing?canceled=true",
                customer_email=customer_email,
                metadata={
                    "user_id": user_id or "",
                    "plan_tier": plan_tier.value,
                    "billing_cycle": billing_cycle,
                },
            )

            return {
                "success": True,
                "session_id": session.id,
                "url": session.url,
            }
        except stripe.error.StripeError as e:
            return {
                "success": False,
                "error": str(e),
            }

    def create_customer_portal_session(
        self,
        stripe_customer_id: str,
    ) -> Dict[str, Any]:
        """Create a customer portal session for subscription management."""
        try:
            session = stripe.billing_portal.Session.create(
                customer=stripe_customer_id,
                return_url=f"{FRONTEND_URL}/dashboard/billing",
            )

            return {
                "success": True,
                "url": session.url,
            }
        except stripe.error.StripeError as e:
            return {
                "success": False,
                "error": str(e),
            }

    def handle_webhook_event(
        self,
        payload: bytes,
        sig_header: str,
    ) -> Dict[str, Any]:
        """
        Handle Stripe webhook events.

        Events handled:
        - customer.subscription.created
        - customer.subscription.updated
        - customer.subscription.deleted
        - invoice.payment_succeeded
        - invoice.payment_failed
        """
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            return {
                "success": False,
                "error": f"Invalid webhook: {str(e)}",
            }

        # Handle specific event types
        event_handlers = {
            "customer.subscription.created": self._handle_subscription_created,
            "customer.subscription.updated": self._handle_subscription_updated,
            "customer.subscription.deleted": self._handle_subscription_deleted,
            "invoice.payment_succeeded": self._handle_payment_succeeded,
            "invoice.payment_failed": self._handle_payment_failed,
        }

        handler = event_handlers.get(event.type)
        if handler:
            return handler(event.data.object)

        return {
            "success": True,
            "message": f"Event {event.type} received",
        }

    def _handle_subscription_created(
        self, subscription: stripe.Subscription
    ) -> Dict[str, Any]:
        """Handle new subscription creation."""
        # In production: Update user's subscription in database
        return {
            "action": "subscription_created",
            "subscription_id": subscription.id,
            "customer_id": subscription.customer,
            "status": subscription.status,
        }

    def _handle_subscription_updated(
        self, subscription: stripe.Subscription
    ) -> Dict[str, Any]:
        """Handle subscription updates (plan changes, cancellations, etc.)."""
        # In production: Update user's subscription in database
        return {
            "action": "subscription_updated",
            "subscription_id": subscription.id,
            "customer_id": subscription.customer,
            "status": subscription.status,
        }

    def _handle_subscription_deleted(
        self, subscription: stripe.Subscription
    ) -> Dict[str, Any]:
        """Handle subscription cancellation."""
        # In production: Downgrade user to free tier
        return {
            "action": "subscription_deleted",
            "subscription_id": subscription.id,
            "customer_id": subscription.customer,
        }

    def _handle_payment_succeeded(self, invoice: stripe.Invoice) -> Dict[str, Any]:
        """Handle successful payment."""
        # In production: Add credits, update usage limits
        return {
            "action": "payment_succeeded",
            "amount_paid": invoice.amount_paid,
            "customer_id": invoice.customer,
        }

    def _handle_payment_failed(self, invoice: stripe.Invoice) -> Dict[str, Any]:
        """Handle failed payment."""
        # In production: Notify user, potentially suspend account
        return {
            "action": "payment_failed",
            "amount_due": invoice.amount_due,
            "customer_id": invoice.customer,
        }

    def record_usage(
        self,
        user_id: str,
        generation: bool = False,
        extra_studio: bool = False,
        logo_branding: bool = False,
        premium_ai: bool = False,
        export_4k: bool = False,
    ) -> UsageRecord:
        """Record usage for billing purposes."""
        if user_id not in self.usage_cache:
            self.usage_cache[user_id] = UsageRecord(user_id=user_id)

        usage = self.usage_cache[user_id]

        if generation:
            usage.generation_count += 1
        if extra_studio:
            usage.extra_studios_used += 1
        if logo_branding:
            usage.logo_branding_used += 1
        if premium_ai:
            usage.premium_ai_uses += 1
        if export_4k:
            usage.four_k_exports += 1

        return usage

    def get_usage(self, user_id: str) -> UsageRecord:
        """Get current usage for a user."""
        if user_id not in self.usage_cache:
            self.usage_cache[user_id] = UsageRecord(user_id=user_id)
        return self.usage_cache[user_id]


# Singleton instance
billing_service = BillingService()


def get_billing_service() -> BillingService:
    """Get the billing service singleton."""
    return billing_service
