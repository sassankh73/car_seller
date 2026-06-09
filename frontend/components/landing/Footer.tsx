"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";

export default function Footer() {
  const t = useTranslations("landing.footer");
  const locale = useLocale();

  return (
    <footer className="relative bg-charcoal-900 text-white/80 pt-16 lg:pt-20 pb-8">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        {/* Top row — 2 cols on mobile, 4 on lg */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-16 mb-12 lg:mb-16">
          {/* Brand — full width on mobile */}
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-0 mb-4">
              <span className="text-xl font-bold tracking-tight text-white">
                Auto
              </span>
              <span className="text-xl font-bold tracking-tight text-red-500">
                Studio
              </span>
            </div>
            <p className="text-sm text-white/50 leading-relaxed max-w-[260px]">
              {t("tagline")}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 tracking-wide">
              {t("product")}
            </h4>
            <ul className="space-y-1">
              {[
                { href: `/${locale}/dashboard`, label: t("dashboard") },
                { href: "#studios", label: "Studios" },
                { href: "#pricing", label: "Pricing" },
              ].map(({ href, label }) => (
                <li key={label}>
                  <a href={href} className="flex items-center py-2 text-sm text-white/50 hover:text-white/80 transition-colors min-h-[36px]">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 tracking-wide">
              {t("company")}
            </h4>
            <ul className="space-y-1">
              {[
                { href: `/${locale}/about`, label: t("about") },
                { href: `/${locale}/contact`, label: t("contact") },
                { href: "/privacy", label: t("privacy") },
                { href: "/terms", label: t("terms") },
              ].map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="flex items-center py-2 text-sm text-white/50 hover:text-white/80 transition-colors min-h-[36px]">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Get Started — full width on mobile */}
          <div className="col-span-2 lg:col-span-1">
            <h4 className="text-sm font-semibold text-white mb-4 tracking-wide">
              {t("getStarted")}
            </h4>
            <Link
              href={`/${locale}/auth/register`}
              className="inline-flex items-center justify-center px-5 py-3 bg-[#CC2020] text-white text-sm font-medium rounded-xl hover:bg-[#991818] transition-colors min-h-[44px]"
            >
              {t("startFreeTrial")}
            </Link>
          </div>
        </div>

        {/* Bottom row */}
        <div className="border-t border-white/[0.06] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} AutoStudio. {t("rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}