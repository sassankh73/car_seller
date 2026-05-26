"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";

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
  const [currentPlan, setCurrentPlan] = useState<string>("professional");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    // Load plans
    axios
      .get("/api/billing/plans")
      .then((res) => setPlans(res.data))
      .catch(console.error);

    // Load usage (mock user_id for demo)
    axios
      .get("/api/billing/usage/demo_user_123")
      .then((res) => setUsage(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async (planTier: string) => {
    setCheckoutLoading(planTier);

    try {
      const response = await axios.post("/api/billing/checkout", {
        plan_tier: planTier,
        billing_cycle: billingCycle,
        user_email: "user@example.com",
        user_id: "demo_user_123",
      });

      // Redirect to Stripe Checkout
      if (response.data.checkout_url) {
        window.location.href = response.data.checkout_url;
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
      const response = await axios.get(
        "/api/billing/portal?stripe_customer_id=cus_demo_123",
      );
      if (response.data.portal_url) {
        window.open(response.data.portal_url, "_blank");
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
    return num.toLocaleString();
  };

  return (
    <main className="p-8 min-h-screen bg-gray-900">
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
                ? plan.price_monthly_display
                : plan.price_yearly_display;

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
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
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
              <div className="text-2xl font-bold text-indigo-400">$3.00</div>
              <div className="text-sm text-gray-400 mt-1">
                {t("usageBasedBilling.perExtraGeneration")}
              </div>
            </div>
            <div className="text-center p-4 bg-gray-900 rounded-lg">
              <div className="text-2xl font-bold text-indigo-400">$3-5</div>
              <div className="text-sm text-gray-400 mt-1">
                {t("usageBasedBilling.perExtraStudio")}
              </div>
            </div>
            <div className="text-center p-4 bg-gray-900 rounded-lg">
              <div className="text-2xl font-bold text-indigo-400">$10</div>
              <div className="text-sm text-gray-400 mt-1">
                {t("usageBasedBilling.perLogoBranding")}
              </div>
            </div>
            <div className="text-center p-4 bg-gray-900 rounded-lg">
              <div className="text-2xl font-bold text-indigo-400">$5</div>
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

        <div className="mt-12">
          <Link
            href={`/${locale}/dashboard`}
            className="text-indigo-400 hover:text-indigo-300 hover:underline"
          >
            ← {commonT("backToHome")}
          </Link>
        </div>
      </div>
    </main>
  );
}
