import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — AutoStudio AI",
  description: "AutoStudio AI is an AI-powered vehicle photography platform built for modern car dealerships. Learn who we are and why we built it.",
};

export default async function AboutPage() {
  const locale = await getLocale();
  const t = await getTranslations("about");

  return (
    <main className="min-h-screen bg-warm-cream">
      {/* Nav bar spacer + back link */}
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-10 pb-4">
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-1.5 text-sm text-charcoal-500 hover:text-charcoal-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          {t("backHome")}
        </Link>
      </div>

      {/* Hero */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 lg:py-24">
        <div className="max-w-3xl">
          <div className="section-label mb-4">{t("eyebrow")}</div>
          <h1 className="text-4xl lg:text-[3.25rem] font-bold tracking-[-0.03em] text-charcoal-900 leading-[1.1] mb-6">
            {t("headline")}
          </h1>
          <p className="text-xl text-charcoal-500 leading-relaxed max-w-[580px]">
            {t("subheadline")}
          </p>
        </div>
      </section>

      {/* What we do */}
      <section className="bg-white border-y border-black/[0.06]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-charcoal-900 mb-4 tracking-[-0.02em]">
                {t("whatWeDoTitle")}
              </h2>
              <p className="text-charcoal-500 leading-relaxed mb-6">
                {t("whatWeDoBody")}
              </p>
              <p className="text-charcoal-500 leading-relaxed">
                {t("whatWeDoBody2")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(["feature1", "feature2", "feature3", "feature4"] as const).map((key) => (
                <div key={key} className="bg-warm-cream rounded-2xl p-5 border border-black/[0.04]">
                  <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-500 mb-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-charcoal-900 leading-snug">{t(`features.${key}`)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The problem we solve */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <div className="max-w-3xl">
          <h2 className="text-2xl lg:text-3xl font-bold text-charcoal-900 mb-4 tracking-[-0.02em]">
            {t("problemTitle")}
          </h2>
          <p className="text-charcoal-500 leading-relaxed mb-6">
            {t("problemBody")}
          </p>
          <p className="text-charcoal-500 leading-relaxed">
            {t("problemBody2")}
          </p>
        </div>
      </section>

      {/* Who we're for */}
      <section className="bg-white border-y border-black/[0.06]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 lg:py-20">
          <h2 className="text-2xl lg:text-3xl font-bold text-charcoal-900 mb-10 tracking-[-0.02em]">
            {t("whoTitle")}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(["dealers", "sellers", "marketplaces"] as const).map((key) => (
              <div key={key} className="bg-warm-cream rounded-2xl p-6 border border-black/[0.04]">
                <h3 className="text-base font-semibold text-charcoal-900 mb-2">{t(`audience.${key}.title`)}</h3>
                <p className="text-sm text-charcoal-500 leading-relaxed">{t(`audience.${key}.description`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 lg:py-20 text-center">
        <h2 className="text-2xl lg:text-3xl font-bold text-charcoal-900 mb-4 tracking-[-0.02em]">
          {t("ctaTitle")}
        </h2>
        <p className="text-charcoal-500 mb-8 max-w-md mx-auto">{t("ctaBody")}</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={`/${locale}/auth/register`} className="btn-primary">
            {t("ctaButton")}
          </Link>
          <Link href={`/${locale}/dashboard/billing`} className="btn-outline">
            {t("ctaPlans")}
          </Link>
        </div>
      </section>
    </main>
  );
}
