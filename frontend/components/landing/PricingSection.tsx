"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";

interface Plan {
  tier: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  features: {
    generations_per_month: number;
    max_resolution: string;
    studios_included: string[];
    logo_branding: boolean;
    premium_ai: boolean;
    priority_processing: boolean;
    support_level: string;
  };
}

function formatSEK(öre: number) {
  if (öre <= 0) return "SEK 0";
  return `SEK ${Math.round(öre / 100).toLocaleString("sv-SE")}`;
}

function formatGenerations(n: number) {
  if (n < 0) return "Unlimited";
  return `${n} / month`;
}

const CHECK = (
  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const DASH = (
  <svg className="w-4 h-4 text-charcoal-300 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
  </svg>
);

export default function PricingSection() {
  const t = useTranslations("landing.pricing");
  const locale = useLocale();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    fetch("/api/billing/plans")
      .then((r) => r.json())
      .then((data: Plan[]) => setPlans(data))
      .catch(() => {});
  }, []);

  return (
    <section id="pricing" className="relative bg-warm-cream py-20 lg:py-32">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-12">
          <div className="section-label mb-3">{t("label")}</div>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-[-0.02em] text-charcoal-900 mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-charcoal-500 max-w-[520px] leading-relaxed mb-8">
            {t("description")}
          </p>

          {/* Billing toggle */}
          <div className="bg-white border border-black/[0.08] rounded-xl p-1 inline-flex shadow-card-sm">
            <button
              onClick={() => setCycle("monthly")}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                cycle === "monthly"
                  ? "bg-red-500 text-white shadow-sm"
                  : "text-charcoal-600 hover:text-charcoal-900"
              }`}
            >
              {t("monthly")}
            </button>
            <button
              onClick={() => setCycle("yearly")}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                cycle === "yearly"
                  ? "bg-red-500 text-white shadow-sm"
                  : "text-charcoal-600 hover:text-charcoal-900"
              }`}
            >
              {t("yearly")}
              <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full font-semibold">
                {t("savePercent")}
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        {plans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {plans.map((plan) => {
              const isPopular = plan.tier === "professional";
              const price = cycle === "monthly" ? plan.price_monthly : plan.price_yearly;
              const priceLabel = cycle === "monthly"
                ? `${formatSEK(price)} / ${t("monthly").toLowerCase()}`
                : `${formatSEK(price)} / ${t("yearly").toLowerCase()}`;

              return (
                <div
                  key={plan.tier}
                  className={`relative rounded-2xl lg:rounded-3xl p-8 border transition-all card-premium ${
                    isPopular
                      ? "bg-white border-red-500 shadow-xl shadow-red-100"
                      : "bg-white border-black/[0.08] shadow-card"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-red-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                        {t("mostPopular")}
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-charcoal-900 mb-2">{plan.name}</h3>
                    <p className="text-3xl font-bold text-charcoal-900 tracking-tight">{priceLabel}</p>
                  </div>

                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-2.5 text-sm text-charcoal-700">
                      {CHECK}
                      <span>{formatGenerations(plan.features.generations_per_month)}</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-sm text-charcoal-700">
                      {CHECK}
                      <span>
                        {plan.features.studios_included.length === 1
                          ? t("studioCount.one")
                          : t("studioCount.other", { count: plan.features.studios_included.length })}
                      </span>
                    </li>
                    <li className="flex items-center gap-2.5 text-sm text-charcoal-700">
                      {CHECK}
                      <span>Max {plan.features.max_resolution.toUpperCase()}</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-sm text-charcoal-700">
                      {plan.features.logo_branding ? CHECK : DASH}
                      <span className={plan.features.logo_branding ? "" : "text-charcoal-400"}>{t("logoBranding")}</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-sm text-charcoal-700">
                      {plan.features.premium_ai ? CHECK : DASH}
                      <span className={plan.features.premium_ai ? "" : "text-charcoal-400"}>{t("premiumAI")}</span>
                    </li>
                    <li className="flex items-center gap-2.5 text-sm text-charcoal-700">
                      {plan.features.priority_processing ? CHECK : DASH}
                      <span className={plan.features.priority_processing ? "" : "text-charcoal-400"}>{t("priorityProcessing")}</span>
                    </li>
                  </ul>

                  <Link
                    href={`/${locale}/auth/register`}
                    className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                      isPopular
                        ? "bg-red-500 text-white hover:bg-red-600 hover:shadow-lg hover:shadow-red-100"
                        : "bg-charcoal-100 text-charcoal-900 hover:bg-charcoal-200"
                    }`}
                  >
                    {plan.price_monthly === 0 ? t("getStartedFree") : t("getStarted")}
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-charcoal-500 mb-6">{t("loadingPlans")}</p>
            <Link
              href={`/${locale}/dashboard/billing`}
              className="btn-primary"
            >
              {t("viewPlans")}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
