"use client";

import { useTranslations } from "next-intl";

const STEPS = [
  {
    key: "upload",
    number: "01",
    accent: "bg-red-500",
    ringColor: "ring-red-200",
  },
  {
    key: "chooseStudio",
    number: "02",
    accent: "bg-accent-coral",
    ringColor: "ring-orange-200",
  },
  {
    key: "download",
    number: "03",
    accent: "bg-accent-gold",
    ringColor: "ring-amber-200",
  },
];

export default function HowItWorksSection() {
  const t = useTranslations("landing.howItWorks");

  return (
    <section id="how-it-works" className="relative bg-white py-20 lg:py-32">
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

        {/* Steps — horizontal on desktop, vertical on mobile */}
        <div className="relative">
          {/* Connecting line — desktop */}
          <div className="hidden lg:block absolute top-[52px] left-[16.67%] right-[16.67%] h-[2px] bg-gradient-to-r from-red-200 via-orange-200 to-amber-200" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            {STEPS.map((step, idx) => {
              const title = t(`steps.${step.key}.title` as any) as string;
              const desc = t(`steps.${step.key}.description` as any) as string;

              return (
                <div key={step.key} className="flex flex-col items-center text-center relative">
                  {/* Large number circle */}
                  <div className={`relative w-[104px] h-[104px] rounded-full ${step.accent} flex items-center justify-center mb-6 shadow-card-lg ring-4 ${step.ringColor}`}>
                    <span className="text-3xl font-bold text-white tracking-[-0.02em]">
                      {step.number}
                    </span>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold text-charcoal-900 mb-3 tracking-[-0.01em] max-w-[280px]">
                    {title}
                  </h3>
                  <p className="text-sm text-charcoal-500 leading-relaxed max-w-[300px]">
                    {desc}
                  </p>

                  {/* Arrow between steps — mobile only */}
                  {idx < STEPS.length - 1 && (
                    <div className="lg:hidden flex justify-center my-4">
                      <svg className="w-6 h-6 text-red-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}