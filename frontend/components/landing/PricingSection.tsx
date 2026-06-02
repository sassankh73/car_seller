"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

export default function PricingSection() {
  const t = useTranslations("landing.pricing");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const plans = [
    {
      key: "basic",
      name: t("plans.basic.name"),
      price: billingCycle === "monthly" ? t("plans.basic.price") : "$290",
      period: billingCycle === "monthly" ? t("plans.basic.period") : "/year",
      description: t("plans.basic.description"),
      features: [
        t("plans.basic.features.images"),
        t("plans.basic.features.studios"),
        t("plans.basic.features.branding"),
        t("plans.basic.features.export"),
        t("plans.basic.features.support"),
      ],
      cta: t("plans.basic.cta"),
      trial: t("plans.basic.trial"),
      popular: false,
    },
    {
      key: "professional",
      name: t("plans.professional.name"),
      price: billingCycle === "monthly" ? t("plans.professional.price") : "$790",
      period: billingCycle === "monthly" ? t("plans.professional.period") : "/year",
      description: t("plans.professional.description"),
      features: [
        t("plans.professional.features.images"),
        t("plans.professional.features.studios"),
        t("plans.professional.features.branding"),
        t("plans.professional.features.export"),
        t("plans.professional.features.support"),
      ],
      cta: t("plans.professional.cta"),
      trial: t("plans.professional.trial"),
      popular: true,
    },
    {
      key: "enterprise",
      name: t("plans.enterprise.name"),
      price: billingCycle === "monthly" ? t("plans.enterprise.price") : "$1990",
      period: billingCycle === "monthly" ? t("plans.enterprise.period") : "/year",
      description: t("plans.enterprise.description"),
      features: [
        t("plans.enterprise.features.images"),
        t("plans.enterprise.features.studios"),
        t("plans.enterprise.features.branding"),
        t("plans.enterprise.features.export"),
        t("plans.enterprise.features.support"),
      ],
      cta: t("plans.enterprise.cta"),
      popular: false,
    },
  ];

  return (
    <section className="py-24 md:py-32 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-graphite-800 mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-graphite-500 max-w-2xl mx-auto mb-8">
            {t("subtitle")}
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center gap-3 bg-surface-muted rounded-full p-1.5 border border-graphite-200">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                billingCycle === "monthly"
                  ? "bg-white text-graphite-800 shadow-card"
                  : "text-graphite-400 hover:text-graphite-600"
              }`}
            >
              {t("billingCycle.monthly")}
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                billingCycle === "yearly"
                  ? "bg-white text-graphite-800 shadow-card"
                  : "text-graphite-400 hover:text-graphite-600"
              }`}
            >
              {t("billingCycle.yearly")}
            </button>
            {billingCycle === "yearly" && (
              <span className="text-xs bg-secondary-50 text-secondary-600 px-3 py-1 rounded-full font-medium border border-secondary-200">
                {t("billingCycle.savePercent")}
              </span>
            )}
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.key}
              className={`relative p-8 rounded-2xl border transition-all duration-300 card-premium ${
                plan.popular
                  ? "bg-white border-primary-500 shadow-premium ring-1 ring-primary-100"
                  : "bg-white border-graphite-200 hover:border-graphite-300 shadow-card"
              }`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-warm-gradient text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-md">
                    {t("plans.professional.mostPopular")}
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-graphite-800 mb-2">
                  {plan.name}
                </h3>
                <p className="text-graphite-400 text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center">
                  <span className={`text-4xl font-bold ${plan.popular ? "text-primary-500" : "text-graphite-800"}`}>{plan.price}</span>
                  <span className="text-graphite-400 ml-1">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <svg
                      className={`w-5 h-5 mt-0.5 flex-shrink-0 ${plan.popular ? "text-primary-500" : "text-secondary-500"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-graphite-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/dashboard"
                className={`block w-full py-3 px-6 text-center rounded-lg font-semibold transition-all duration-300 ${
                  plan.popular
                    ? "bg-primary-500 text-white hover:bg-primary-600 btn-glow"
                    : "bg-surface-muted text-graphite-700 hover:bg-graphite-200 border border-graphite-200"
                }`}
              >
                {plan.cta}
              </Link>

              {plan.trial && (
                <p className="text-center text-xs text-graphite-400 mt-3">{plan.trial}</p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Extra Charges */}
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h3 className="text-xl font-semibold text-graphite-800 mb-2">
            {t("extraCharges.title")}
          </h3>
          <p className="text-graphite-400 mb-6">{t("extraCharges.subtitle")}</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <span className="text-graphite-500 bg-surface-muted px-4 py-2 rounded-full border border-graphite-200">{t("extraCharges.extraImage")}</span>
            <span className="text-graphite-500 bg-surface-muted px-4 py-2 rounded-full border border-graphite-200">{t("extraCharges.extraStudio")}</span>
            <span className="text-graphite-500 bg-surface-muted px-4 py-2 rounded-full border border-graphite-200">{t("extraCharges.fourKExport")}</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}