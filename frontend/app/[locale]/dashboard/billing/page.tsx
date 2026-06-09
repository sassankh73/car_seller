"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import DashboardNav from "@/components/DashboardNav";
import { useAuth, authFetch } from "@/context/AuthContext";
import Spinner from "@/components/ui/Spinner";
import { formatLocaleNumber, toFormatLocale } from "@/utils/formatLocale";

interface Plan {
  tier: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  price_monthly_display: string;
  price_yearly_display: string;
  features: {
    generations_per_month: number;
    max_resolution: string;
    studios_included: string[];
    extra_studio_price: number;
    logo_branding: boolean;
    premium_ai: boolean;
    priority_processing: boolean;
    support_level: string;
  };
}

interface Usage {
  generation_count: number;
  generations_limit: number;
  remaining: number;
  extra_studios_used: number;
  logo_branding_used: number;
  premium_ai_uses: number;
  four_k_exports: number;
}

export default function BillingPage() {
  const t = useTranslations("billing");
  const commonT = useTranslations("common");
  const notificationT = useTranslations("notifications");
  const locale = useLocale();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [currentPlan, setCurrentPlan] = useState<string>("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);
  const { user, isAuthenticated } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(toFormatLocale(locale), {
      style: "currency",
      currency: "SEK",
      maximumFractionDigits: 0,
    }).format(amount);

  useEffect(() => {
    // Load plans (public endpoint)
    fetch("/api/billing/plans")
      .then((res) => res.json())
      .then((data) => setPlans(data))
      .catch(console.error);

    // Load usage and real plan tier for authenticated users
    if (isAuthenticated && user) {
      authFetch(`/api/billing/usage/${user.id}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Failed to load usage");
        })
        .then((data) => setUsage(data))
        .catch(console.error);

      authFetch("/api/auth/account")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.subscription?.plan_tier) {
            setCurrentPlan(data.subscription.plan_tier);
          }
        })
        .catch(console.error);
    }
    setLoading(false);
  }, [isAuthenticated, user]);

  const handleSubscribe = async (planTier: string) => {
    if (!isAuthenticated || !user) {
      setBillingError(notificationT("subscriptionLoginRequired"));
      return;
    }
    setBillingError(null);
    setCheckoutLoading(planTier);

    try {
      const response = await authFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_tier: planTier,
          billing_cycle: billingCycle,
          user_email: user.email,
          user_id: String(user.id),
        }),
      });

      if (!response.ok) throw new Error("Checkout failed");
      const data = await response.json();

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (error) {
      console.error("Checkout failed:", error);
      setBillingError(notificationT("subscriptionError"));
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setBillingError(null);
    try {
      const response = await authFetch("/api/billing/portal");
      if (!response.ok) throw new Error("Portal access failed");
      const data = await response.json();
      if (data.portal_url) {
        window.open(data.portal_url, "_blank");
      }
    } catch (error) {
      console.error("Portal access failed:", error);
      setBillingError(notificationT("portalError"));
    }
  };

  const getFeatureIcon = (included: boolean, featureLabel: string) =>
    included ? (
      <span className="text-green-500" role="img" aria-label={`${featureLabel} included`}>✓</span>
    ) : (
      <span className="text-gray-600" role="img" aria-label={`${featureLabel} not included`}>—</span>
    );

  const formatNumber = (num: number) => {
    if (num < 0) return t("unlimited");
    return formatLocaleNumber(locale, num);
  };

  const formatSupportLevel = (level: string) => {
    const map: Record<string, string> = {
      none: t("features.supportNone"),
      email: t("features.supportEmail"),
      priority: t("features.supportPriority"),
      dedicated: t("features.supportDedicated"),
    };
    return map[level] ?? level;
  };

  return (
    <div className="min-h-screen bg-warm-cream">
      <DashboardNav active="billing" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-stone-900 mb-2">{t("title")}</h1>
          <p className="text-stone-500">{t("subtitle")}</p>
        </header>

        {billingError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 text-sm">{billingError}</p>
          </div>
        )}

        {/* Current Usage */}
        {usage && (
          <section className="mb-12 bg-white rounded-xl p-6 border border-stone-200 shadow-sm">
            <h2 className="text-2xl font-semibold text-stone-900 mb-6">
              {t("currentUsage")}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-stone-900">
                  {usage.remaining < 0 ? "∞" : usage.remaining}
                </div>
                <div className="text-sm text-stone-500 mt-1">
                  {usage.generations_limit < 0
                    ? t("unlimited")
                    : `${usage.generation_count}/${usage.generations_limit}`}
                </div>
                <div className="text-xs text-stone-400 mt-1">
                  {t("generations")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-stone-900">{usage.extra_studios_used}</div>
                <div className="text-xs text-stone-400 mt-2">{t("extraStudios")}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-stone-900">{usage.logo_branding_used}</div>
                <div className="text-xs text-stone-400 mt-2">{t("logoBranding")}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-stone-900">{usage.premium_ai_uses}</div>
                <div className="text-xs text-stone-400 mt-2">{t("premiumAI")}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-stone-900">{usage.four_k_exports}</div>
                <div className="text-xs text-stone-400 mt-2">{t("fourKExports")}</div>
              </div>
            </div>

            {usage.generations_limit > 0 && (
              <div className="mt-6">
                <div className="flex justify-between text-sm text-stone-500 mb-2">
                  <span>{t("monthlyGenerations")}</span>
                  <span>{usage.generation_count} / {usage.generations_limit}</span>
                </div>
                <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      usage.generation_count / usage.generations_limit > 0.85 ? "bg-red-500" : "bg-[#CC2020]"
                    }`}
                    style={{ width: `${Math.min(100, (usage.generation_count / usage.generations_limit) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-stone-100 border border-stone-200 rounded-lg p-1 inline-flex">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-md font-medium transition ${
                billingCycle === "monthly" ? "bg-[#CC2020] text-white" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {t("billingCycle.monthly")}
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-6 py-2 rounded-md font-medium transition flex items-center ${
                billingCycle === "yearly" ? "bg-[#CC2020] text-white" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {t("billingCycle.yearly")}
              <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                {t("billingCycle.savePercent")}
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => {
            const isCurrentPlan = plan.tier === currentPlan;
            const isPopular = plan.tier === "professional";
            const price =
              billingCycle === "monthly"
                ? formatCurrency(plan.price_monthly / 100)
                : formatCurrency(plan.price_yearly / 100);

            return (
              <div
                key={plan.tier}
                className={`relative rounded-2xl p-8 border transition-all ${
                  isCurrentPlan
                    ? "bg-red-50 border-[#CC2020]/50"
                    : isPopular
                      ? "bg-white border-[#CC2020] shadow-xl shadow-red-100"
                      : "bg-white border-stone-200 shadow-sm"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-[#CC2020] text-white text-sm font-medium px-4 py-1 rounded-full">
                      {t("plans.professional.mostPopular")}
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-stone-900 mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-stone-900">{price}</span>
                    <span className="text-stone-500 ml-2">
                      /{billingCycle === "monthly" ? t("billingCycle.monthly").toLowerCase() : t("billingCycle.yearly").toLowerCase()}
                    </span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  <li className="flex items-center justify-between text-stone-700">
                    <span>{formatNumber(plan.features.generations_per_month)}{" "}{t("billingCycle.monthly").toLowerCase()}</span>
                    {getFeatureIcon(true, t("features.generationsPerMonth"))}
                  </li>
                  <li className="flex items-center justify-between text-stone-700">
                    <span>Max {plan.features.max_resolution.toUpperCase()}</span>
                    {getFeatureIcon(true, t("features.maxResolution"))}
                  </li>
                  <li className="flex items-center justify-between text-stone-700">
                    <span>
                      {t("plans.starter.studiosIncluded", { count: plan.features.studios_included.length })}
                    </span>
                    {getFeatureIcon(true, t("features.studiosIncluded"))}
                  </li>
                  <li className="flex items-center justify-between text-stone-700">
                    <span>{t("plans.starter.logoBranding")}</span>
                    {getFeatureIcon(plan.features.logo_branding, t("plans.starter.logoBranding"))}
                  </li>
                  <li className="flex items-center justify-between text-stone-700">
                    <span>{t("plans.starter.premiumAI")}</span>
                    {getFeatureIcon(plan.features.premium_ai, t("plans.starter.premiumAI"))}
                  </li>
                  <li className="flex items-center justify-between text-stone-700">
                    <span>{t("plans.starter.priorityProcessing")}</span>
                    {getFeatureIcon(plan.features.priority_processing, t("plans.starter.priorityProcessing"))}
                  </li>
                  <li className="flex items-center justify-between text-stone-700">
                    <span>{formatSupportLevel(plan.features.support_level)}</span>
                    {getFeatureIcon(true, t("features.support"))}
                  </li>
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.tier)}
                  disabled={isCurrentPlan || checkoutLoading !== null}
                  className={`w-full py-3 rounded-lg font-semibold transition ${
                    isCurrentPlan
                      ? "bg-stone-200 text-stone-400 cursor-not-allowed"
                      : "bg-[#CC2020] hover:bg-[#991818] text-white"
                  }`}
                >
                  {checkoutLoading === plan.tier ? (
                    <span className="flex items-center justify-center">
                      <Spinner size="sm" className="-ml-1 mr-2" />
                      {t("plans.starter.processing")}
                    </span>
                  ) : isCurrentPlan ? (
                    t("plans.starter.currentPlan")
                  ) : (
                    t("plans.starter.getStarted")
                  )}
                </button>
              </div>
            );
          })}
        </section>

        {/* Manage Subscription */}
        <section className="bg-white rounded-xl p-6 border border-stone-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-stone-900 mb-2">{t("manageSubscription.title")}</h3>
              <p className="text-stone-500">{t("manageSubscription.subtitle")}</p>
            </div>
            <button
              onClick={handleManageSubscription}
              className="mt-4 md:mt-0 px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-900 rounded-lg font-medium transition border border-stone-200"
            >
              {t("manageSubscription.openPortal")}
            </button>
          </div>
        </section>

        {/* Usage-Based Billing Info */}
        <section className="mt-8 bg-white rounded-xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-xl font-semibold text-stone-900 mb-4">{t("usageBasedBilling.title")}</h3>
          <p className="text-stone-500 mb-6">{t("usageBasedBilling.subtitle")}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { amount: 29, label: t("usageBasedBilling.perExtraGeneration") },
              { amount: null, label: t("usageBasedBilling.perExtraStudio"), display: `${formatCurrency(29)}–${formatCurrency(49)}` },
              { amount: 99, label: t("usageBasedBilling.perLogoBranding") },
              { amount: 49, label: t("usageBasedBilling.perFourKExport") },
            ].map((item, i) => (
              <div key={i} className="text-center p-4 bg-stone-50 rounded-lg border border-stone-100">
                <div className="text-2xl font-bold text-stone-900">
                  {item.display ?? formatCurrency(item.amount!)}
                </div>
                <div className="text-sm text-stone-500 mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-8">
          <h3 className="text-2xl font-semibold text-stone-900 mb-6">{t("faq.title")}</h3>
          <div className="space-y-4">
            {[
              { q: t("faq.changePlans.question"), a: t("faq.changePlans.answer") },
              { q: t("faq.exceedLimit.question"), a: t("faq.exceedLimit.answer") },
              { q: t("faq.rollover.question"), a: t("faq.rollover.answer") },
            ].map((item, i) => (
              <div key={i} className="bg-white rounded-lg p-6 border border-stone-200 shadow-sm">
                <h4 className="text-lg font-medium text-stone-900 mb-2">{item.q}</h4>
                <p className="text-stone-500">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
