"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";

export default function Footer() {
  const t = useTranslations("landing.footer");
  const locale = useLocale();

  return (
    <footer className="relative bg-charcoal-900 text-white/80 pt-16 lg:pt-20 pb-8">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        {/* Top row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-16 mb-12 lg:mb-16">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
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
            <ul className="space-y-3">
              <li>
                <Link href={`/${locale}/dashboard`} className="text-sm text-white/50 hover:text-white/80 transition-colors">
                  {t("dashboard")}
                </Link>
              </li>
              <li>
                <a href="#studios" className="text-sm text-white/50 hover:text-white/80 transition-colors">
                  Studios
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-sm text-white/50 hover:text-white/80 transition-colors">
                  Pricing
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 tracking-wide">
              {t("company")}
            </h4>
            <ul className="space-y-3">
              <li>
                <Link href={`/${locale}/about`} className="text-sm text-white/50 hover:text-white/80 transition-colors">
                  {t("about")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/contact`} className="text-sm text-white/50 hover:text-white/80 transition-colors">
                  {t("contact")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-white/50 hover:text-white/80 transition-colors">
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-white/50 hover:text-white/80 transition-colors">
                  {t("terms")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Get Started */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-4 tracking-wide">
              {t("getStarted")}
            </h4>
            <Link
              href={`/${locale}/auth/register`}
              className="inline-flex items-center justify-center px-5 py-2.5 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 transition-colors"
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