"use client";

import { useTranslations } from "next-intl";

const STATS = [
  { key: "imagesGenerated", value: "2.5M+", color: "text-red-500" },
  { key: "dealersServed", value: "1,200+", color: "text-accent-coral" },
  { key: "processingSpeed", value: "<30s", color: "text-accent-gold" },
  { key: "studioTemplates", value: "8+", color: "text-red-500" },
];

const BENEFITS = [
  {
    key: "saveHours",
    accent: "bg-red-50",
    iconBg: "bg-red-100",
    iconColor: "text-red-500",
  },
  {
    key: "noPhotographer",
    accent: "bg-warm-beige/50",
    iconBg: "bg-warm-stone/40",
    iconColor: "text-accent-terracotta",
  },
  {
    key: "consistent",
    accent: "bg-warm-cream",
    iconBg: "bg-warm-stone/30",
    iconColor: "text-accent-gold",
  },
  {
    key: "marketplaceReady",
    accent: "bg-orange-50/70",
    iconBg: "bg-orange-100/60",
    iconColor: "text-accent-coral",
  },
];

export default function TrustSection() {
  const t = useTranslations("landing.trust");

  return (
    <section id="trust" className="relative bg-warm-100/50 py-20 lg:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-white via-warm-100/20 to-white pointer-events-none" />

      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10">
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

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-16">
          {STATS.map((stat) => (
            <div key={stat.key} className="flex flex-col items-center text-center p-6 rounded-2xl bg-white border border-black/[0.06] shadow-card">
              <span className={`text-3xl lg:text-4xl font-bold ${stat.color} tracking-[-0.02em] mb-1`}>
                {stat.value}
              </span>
              <span className="text-sm text-charcoal-500 font-medium">
                {t(`stats.${stat.key}` as any)}
              </span>
            </div>
          ))}
        </div>

        {/* Business Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {BENEFITS.map((benefit) => {
            const title = t(`benefits.${benefit.key}.title` as any) as string;
            const desc = t(`benefits.${benefit.key}.description` as any) as string;

            return (
              <div
                key={benefit.key}
                className={`rounded-2xl p-6 ${benefit.accent} border border-black/[0.04]`}
              >
                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl ${benefit.iconBg} flex items-center justify-center ${benefit.iconColor} mb-4`}>
                  {benefit.key === "saveHours" && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {benefit.key === "noPhotographer" && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    </svg>
                  )}
                  {benefit.key === "consistent" && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {benefit.key === "marketplaceReady" && (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  )}
                </div>

                <h3 className="text-base font-semibold text-charcoal-900 mb-2">
                  {title}
                </h3>
                <p className="text-sm text-charcoal-500 leading-relaxed">
                  {desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}