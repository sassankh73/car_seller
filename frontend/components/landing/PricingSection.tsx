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
    <section className="py-24 bg-black">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
            {t("subtitle")}
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center gap-4 bg-gray-900 rounded-full p-1.5">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-white text-gray-900"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t("billingCycle.monthly")}
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                billingCycle === "yearly"
                  ? "bg-white text-gray-900"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t("billingCycle.yearly")}
            </button>
            {billingCycle === "yearly" && (
              <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-full">
                {t("billingCycle.savePercent")}
              </span>
            )}
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.key}
              className={`relative p-8 rounded-2xl border transition-all duration-300 ${
                plan.popular
                  ? "bg-gradient-to-b from-indigo-900/50 to-purple-900/50 border-indigo-500 shadow-lg shadow-indigo-500/20"
                  : "bg-gray-900/50 border-gray-800 hover:border-gray-700"
              }`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-indigo-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                    {t("plans.professional.mostPopular")}
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-gray-400 ml-1">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0"
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
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/dashboard"
                className={`block w-full py-3 px-6 text-center rounded-lg font-semibold transition-all ${
                  plan.popular
                    ? "bg-white text-gray-900 hover:bg-gray-100"
                    : "bg-gray-800 text-white hover:bg-gray-700"
                }`}
              >
                {plan.cta}
              </Link>

              {plan.trial && (
                <p className="text-center text-xs text-gray-500 mt-3">{plan.trial}</p>
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
          <h3 className="text-xl font-semibold text-white mb-2">
            {t("extraCharges.title")}
          </h3>
          <p className="text-gray-400 mb-6">{t("extraCharges.subtitle")}</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <span className="text-gray-500">{t("extraCharges.extraImage")}</span>
            <span className="text-gray-500">{t("extraCharges.extraStudio")}</span>
            <span className="text-gray-500">{t("extraCharges.fourKExport")}</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
