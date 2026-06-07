"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth, authFetch } from "@/context/AuthContext";
import Spinner from "@/components/ui/Spinner";

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
  const locale = useLocale();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [currentPlan, setCurrentPlan] = useState<string>("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Currency formatter based on locale
  const formatCurrency = (amount: number) => {
    if (locale === "sv") {
      return `${amount} kr`;
    }
    return `${amount} SEK`;
  };

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
      alert(t("manageSubscription.subtitle"));
      return;
    }
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

      // Redirect to Stripe Checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (error) {
      console.error("Checkout failed:", error);
      alert(commonT("error"));
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const response = await authFetch("/api/billing/portal");
      if (!response.ok) throw new Error("Portal access failed");
      const data = await response.json();
      if (data.portal_url) {
        window.open(data.portal_url, "_blank");
      }
    } catch (error) {
      console.error("Portal access failed:", error);
      alert(commonT("error"));
    }
  };

  const getFeatureIcon = (included: boolean) =>
    included ? (
      <span className="text-green-500">✓</span>
    ) : (
      <span className="text-gray-600">—</span>
    );

  const formatNumber = (num: number) => {
    if (num < 0) return t("unlimited");
    return num.toLocaleString(locale === "sv" ? "sv-SE" : "en-US");
  };

  return (
    <main className="min-h-screen bg-gray-900">
      {/* Navigation */}
      <nav className="border-b border-gray-700 bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href={`/${locale}`} className="text-xl font-bold text-white">
                AutoStudio AI
              </Link>
              <Link href={`/${locale}/dashboard`} className="text-gray-400 hover:text-white transition text-sm font-medium">
                {commonT("dashboard") || "Dashboard"}
              </Link>
              <span className="text-white font-medium text-sm border-b-2 border-indigo-400 pb-1">
                {t("title") || "Billing"}
              </span>
              <Link href={`/${locale}/dashboard/settings`} className="text-gray-400 hover:text-white transition text-sm font-medium">
                {commonT("settings") || "Settings"}
              </Link>
              <Link href={`/${locale}/dashboard/account`} className="text-gray-400 hover:text-white transition text-sm font-medium">
                {commonT("account") || "Account"}
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
              <Link href={`/${locale}/dashboard`} className="text-indigo-400 hover:text-indigo-300 transition text-sm">
                ← {commonT("backToHome")}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">{t("title")}</h1>
          <p className="text-gray-400">{t("subtitle")}</p>
        </header>

        {/* Current Usage */}
        {usage && (
          <section className="mb-12 bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-2xl font-semibold text-white mb-6">
              {t("currentUsage")}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-400">
                  {usage.remaining < 0 ? "∞" : usage.remaining}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  {usage.generations_limit < 0
                    ? t("unlimited")
                    : `${usage.generation_count}/${usage.generations_limit}`}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {t("generations")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-400">
                  {usage.extra_studios_used}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {t("extraStudios")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-400">
                  {usage.logo_branding_used}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {t("logoBranding")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-400">
                  {usage.premium_ai_uses}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {t("premiumAI")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-indigo-400">
                  {usage.four_k_exports}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {t("fourKExports")}
                </div>
              </div>
            </div>

            {/* Usage Progress Bar */}
            {usage.generations_limit > 0 && (
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>{t("monthlyGenerations")}</span>
                  <span>
                    {usage.generation_count} / {usage.generations_limit}
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      usage.generation_count / usage.generations_limit > 0.8
                        ? "bg-red-500"
                        : "bg-indigo-500"
                    }`}
                    style={{
                      width: `${Math.min(100, (usage.generation_count / usage.generations_limit) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-800 rounded-lg p-1 inline-flex">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-md font-medium transition ${
                billingCycle === "monthly"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t("billingCycle.monthly")}
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-6 py-2 rounded-md font-medium transition flex items-center ${
                billingCycle === "yearly"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
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
                    ? "bg-indigo-600/20 border-indigo-500"
                    : isPopular
                      ? "bg-gray-800 border-indigo-500 shadow-xl shadow-indigo-500/20"
                      : "bg-gray-800 border-gray-700"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-indigo-500 text-white text-sm font-medium px-4 py-1 rounded-full">
                      {t("plans.professional.mostPopular")}
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-white">
                      {price}
                    </span>
                    <span className="text-gray-400 ml-2">
                      /
                      {billingCycle === "monthly"
                        ? t("billingCycle.monthly").toLowerCase()
                        : t("billingCycle.yearly").toLowerCase()}
                    </span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  <li className="flex items-center justify-between text-gray-300">
                    <span>
                      {formatNumber(plan.features.generations_per_month)}{" "}
                      {t("billingCycle.monthly").toLowerCase()}
                    </span>
                    {getFeatureIcon(true)}
                  </li>
                  <li className="flex items-center justify-between text-gray-300">
                    <span>
                      Max {plan.features.max_resolution.toUpperCase()}
                    </span>
                    {getFeatureIcon(true)}
                  </li>
                  <li className="flex items-center justify-between text-gray-300">
                    <span>
                      {plan.features.studios_included.length}{" "}
                      {t("plans.starter.studiosIncluded", {
                        count: plan.features.studios_included.length,
                      })}
                    </span>
                    {getFeatureIcon(true)}
                  </li>
                  <li className="flex items-center justify-between text-gray-300">
                    <span>{t("plans.starter.logoBranding")}</span>
                    {getFeatureIcon(plan.features.logo_branding)}
                  </li>
                  <li className="flex items-center justify-between text-gray-300">
                    <span>{t("plans.starter.premiumAI")}</span>
                    {getFeatureIcon(plan.features.premium_ai)}
                  </li>
                  <li className="flex items-center justify-between text-gray-300">
                    <span>{t("plans.starter.priorityProcessing")}</span>
                    {getFeatureIcon(plan.features.priority_processing)}
                  </li>
                  <li className="flex items-center justify-between text-gray-300">
                    <span>
                      {t("plans.starter.support", {
                        level: plan.features.support_level,
                      })}
                    </span>
                    {getFeatureIcon(true)}
                  </li>
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.tier)}
                  disabled={isCurrentPlan || checkoutLoading !== null}
                  className={`w-full py-3 rounded-lg font-semibold transition ${
                    isCurrentPlan
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
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
        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {t("manageSubscription.title")}
              </h3>
              <p className="text-gray-400">
                {t("manageSubscription.subtitle")}
              </p>
            </div>
            <button
              onClick={handleManageSubscription}
              className="mt-4 md:mt-0 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
            >
              {t("manageSubscription.openPortal")}
            </button>
          </div>
        </section>

        {/* Usage-Based Billing Info */}
        <section className="mt-12 bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-4">
            {t("usageBasedBilling.title")}
          </h3>
          <p className="text-gray-400 mb-6">
            {t("usageBasedBilling.subtitle")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-gray-900 rounded-lg">
              <div className="text-2xl font-bold text-indigo-400">{formatCurrency(29)}</div>
              <div className="text-sm text-gray-400 mt-1">
                {t("usageBasedBilling.perExtraGeneration")}
              </div>
            </div>
            <div className="text-center p-4 bg-gray-900 rounded-lg">
              <div className="text-2xl font-bold text-indigo-400">{formatCurrency(29)}–{formatCurrency(49)}</div>
              <div className="text-sm text-gray-400 mt-1">
                {t("usageBasedBilling.perExtraStudio")}
              </div>
            </div>
            <div className="text-center p-4 bg-gray-900 rounded-lg">
              <div className="text-2xl font-bold text-indigo-400">{formatCurrency(99)}</div>
              <div className="text-sm text-gray-400 mt-1">
                {t("usageBasedBilling.perLogoBranding")}
              </div>
            </div>
            <div className="text-center p-4 bg-gray-900 rounded-lg">
              <div className="text-2xl font-bold text-indigo-400">{formatCurrency(49)}</div>
              <div className="text-sm text-gray-400 mt-1">
                {t("usageBasedBilling.perFourKExport")}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <h3 className="text-2xl font-semibold text-white mb-6">
            {t("faq.title")}
          </h3>
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h4 className="text-lg font-medium text-white mb-2">
                {t("faq.changePlans.question")}
              </h4>
              <p className="text-gray-400">{t("faq.changePlans.answer")}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h4 className="text-lg font-medium text-white mb-2">
                {t("faq.exceedLimit.question")}
              </h4>
              <p className="text-gray-400">{t("faq.exceedLimit.answer")}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h4 className="text-lg font-medium text-white mb-2">
                {t("faq.rollover.question")}
              </h4>
              <p className="text-gray-400">{t("faq.rollover.answer")}</p>
            </div>
          </div>
        </section>

      </div>
      </div>
    </main>
  );
}
