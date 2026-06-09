"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "../LanguageSwitcher";

export default function Navbar() {
  const t = useTranslations("landing.nav");
  const locale = useLocale();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${
        scrolled
          ? "bg-white/95 backdrop-blur-xl border-b border-black/[0.06] shadow-card-sm"
          : "bg-white border-b border-transparent"
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
        <div className="flex items-center justify-between h-16 lg:h-18">
          {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center select-none">
            <Image
              src="/autostudio-logo.svg"
              alt="AutoStudio"
              width={130}
              height={24}
              className="h-[24px] w-auto"
              priority
            />
          </Link>

          {/* Center — Nav links */}
          <div className="hidden md:flex items-center gap-1">
            <Link
              href={`/${locale}/dashboard`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 px-5 py-2 rounded-full transition-all duration-300 hover:shadow-red-glow/40 hover:shadow-lg"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              {t("dashboard")}
            </Link>
            <Link
              href="#studios"
              className="text-sm font-medium text-charcoal-600 hover:text-red-500 px-4 py-2 rounded-xl transition-colors duration-200"
            >
              {t("studios")}
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-charcoal-600 hover:text-red-500 px-4 py-2 rounded-xl transition-colors duration-200"
            >
              {t("pricing")}
            </Link>
            <Link
              href="#about"
              className="text-sm font-medium text-charcoal-600 hover:text-red-500 px-4 py-2 rounded-xl transition-colors duration-200"
            >
              {t("about")}
            </Link>
          </div>

          {/* Right — Language + Avatar */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />

            <Link
              href={`/${locale}/dashboard`}
              className="w-9 h-9 rounded-full bg-warm-beige/60 border border-charcoal-200/50 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors duration-200"
              aria-label="Account"
            >
              <svg className="w-4 h-4 text-charcoal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}