"use client";

import { useTranslations } from "next-intl";

const FEATURES = [
  {
    key: "backgroundReplacement",
    accent: "bg-red-50",
    iconBg: "bg-red-100",
    iconColor: "text-red-500",
    large: true,
  },
  {
    key: "professionalStudios",
    accent: "bg-warm-beige/50",
    iconBg: "bg-warm-stone/40",
    iconColor: "text-accent-terracotta",
  },
  {
    key: "instantProcessing",
    accent: null,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
  },
  {
    key: "batchProcessing",
    accent: null,
    iconBg: "bg-warm-beige/60",
    iconColor: "text-accent-gold",
  },
  {
    key: "naturalShadows",
    accent: "bg-warm-cream",
    iconBg: "bg-warm-stone/30",
    iconColor: "text-charcoal-600",
    large: true,
  },
  {
    key: "multiLanguage",
    accent: null,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
  },
  {
    key: "cloudBased",
    accent: "bg-orange-50/70",
    iconBg: "bg-orange-100/60",
    iconColor: "text-accent-coral",
  },
  {
    key: "dealerReady",
    accent: null,
    iconBg: "bg-warm-beige/60",
    iconColor: "text-accent-gold",
  },
];

export default function FeaturesBentoSection() {
  const t = useTranslations("landing.features");

  return (
    <section id="features" className="relative bg-white py-20 lg:py-32">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        {/* Section header */}
        <div className="flex flex-col items-center text-center mb-14 lg:mb-18">
          <div className="section-label mb-3">{t("label")}</div>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-[-0.02em] text-charcoal-900 mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-charcoal-500 max-w-[520px] leading-relaxed">
            {t("description")}
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {FEATURES.map((feature) => {
            const isLarge = feature.large;

            return (
              <div
                key={feature.key}
                className={`relative rounded-2xl lg:rounded-3xl p-6 lg:p-8 card-premium ${
                  isLarge ? "sm:col-span-2" : ""
                } ${
                  feature.accent
                    ? `${feature.accent} border border-black/[0.04]`
                    : "bg-white border border-black/[0.06]"
                }`}
              >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-2xl ${feature.iconBg} flex items-center justify-center ${feature.iconColor} mb-5`}>
                  {feature.key === "backgroundReplacement" && (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                  )}
                  {feature.key === "professionalStudios" && (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
                    </svg>
                  )}
                  {feature.key === "instantProcessing" && (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                  )}
                  {feature.key === "batchProcessing" && (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                    </svg>
                  )}
                  {feature.key === "naturalShadows" && (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                    </svg>
                  )}
                  {feature.key === "multiLanguage" && (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138A47.63 47.63 0 0115 5.621m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                    </svg>
                  )}
                  {feature.key === "cloudBased" && (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.824 5.25 5.25 0 00-10.233 2.332c0 .108.002.216.007.323A4.5 4.5 0 002.25 15z" />
                    </svg>
                  )}
                  {feature.key === "dealerReady" && (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-charcoal-900 mb-2 tracking-[-0.01em]">
                  {t(`items.${feature.key}.title`)}
                </h3>

                {/* Description */}
                <p className="text-sm text-charcoal-500 leading-relaxed">
                  {t(`items.${feature.key}.description`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}