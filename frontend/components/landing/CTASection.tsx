"use client";

import { useTranslations } from "next-intl";

export default function CTASection() {
  const t = useTranslations("landing.cta");

  return (
    <section id="cta" className="relative bg-warm-50 py-20 lg:py-32">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="relative overflow-hidden rounded-3xl lg:rounded-[40px] bg-gradient-to-br from-red-500 via-red-500 to-accent-coral p-10 lg:p-20 text-center">
          {/* Decorative circles */}
          <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-white/[0.04]" />
          <div className="absolute bottom-[-15%] left-[-5%] w-[300px] h-[300px] rounded-full bg-white/[0.04]" />

          <div className="relative z-10 flex flex-col items-center max-w-[600px] mx-auto">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 text-white/70 text-xs font-medium uppercase tracking-[0.15em] mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
              {t("label")}
            </div>

            {/* Title */}
            <h2 className="text-3xl lg:text-[2.75rem] font-bold text-white tracking-[-0.02em] leading-[1.15] mb-5">
              {t("title")}
            </h2>

            {/* Description */}
            <p className="text-lg text-white/80 leading-relaxed mb-8">
              {t("description")}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <a
                href="/register"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-red-500 font-semibold rounded-xl hover:bg-white/90 transition-all duration-300 hover:scale-[1.02]"
              >
                {t("startFreeTrial")}
              </a>
              <a
                href="#demo"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-white/10 text-white font-medium rounded-xl border border-white/20 hover:bg-white/15 hover:border-white/30 transition-all duration-300"
              >
                {t("bookDemo")}
              </a>
            </div>

            {/* No CC */}
            <p className="text-sm text-white/60 mt-5">
              {t("noCC")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}