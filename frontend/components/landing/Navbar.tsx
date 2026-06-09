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
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close drawer on escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
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

            {/* Center — Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              <Link
                href={`/${locale}/dashboard`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#CC2020] hover:bg-[#991818] px-5 py-2 rounded-full transition-all duration-300 hover:shadow-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                {t("dashboard")}
              </Link>
              <a href="#studios" className="text-sm font-medium text-charcoal-600 hover:text-[#CC2020] px-4 py-2 rounded-xl transition-colors duration-200">
                {t("studios")}
              </a>
              <a href="#pricing" className="text-sm font-medium text-charcoal-600 hover:text-[#CC2020] px-4 py-2 rounded-xl transition-colors duration-200">
                {t("pricing")}
              </a>
              <a href="#about" className="text-sm font-medium text-charcoal-600 hover:text-[#CC2020] px-4 py-2 rounded-xl transition-colors duration-200">
                {t("about")}
              </a>
            </div>

            {/* Right — Language + Avatar + Hamburger */}
            <div className="flex items-center gap-3">
              <LanguageSwitcher />

              {/* Desktop account icon */}
              <Link
                href={`/${locale}/dashboard`}
                className="hidden md:flex w-9 h-9 rounded-full bg-warm-beige/60 border border-charcoal-200/50 items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors duration-200"
                aria-label="Account"
              >
                <svg className="w-4 h-4 text-charcoal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Link>

              {/* Hamburger — mobile only */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl border border-[#e8e8e8] bg-white"
                aria-label={t("menu")}
              >
                <svg className="w-5 h-5 text-charcoal-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile slide-in drawer */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[55] bg-black/20"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer */}
          <nav
            className="fixed top-0 right-0 bottom-0 z-[60] w-[80vw] max-w-[320px] bg-white shadow-2xl flex flex-col"
            style={{
              animation: "slideInRight 250ms cubic-bezier(0.4, 0, 0.2, 1) forwards",
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            <style>{`
              @keyframes slideInRight {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
            `}</style>

            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
              <Image src="/autostudio-logo.svg" alt="AutoStudio" width={100} height={20} className="h-[20px] w-auto" />
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-10 h-10 rounded-xl border border-[#e8e8e8] flex items-center justify-center"
                aria-label={t("close")}
              >
                <svg className="w-5 h-5 text-[#555]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer links */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              <a
                href="#studios"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center px-4 py-3.5 rounded-xl text-base font-medium text-charcoal-700 hover:bg-[#f5f5f7] transition-colors min-h-[44px]"
              >
                {t("studios")}
              </a>
              <a
                href="#pricing"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center px-4 py-3.5 rounded-xl text-base font-medium text-charcoal-700 hover:bg-[#f5f5f7] transition-colors min-h-[44px]"
              >
                {t("pricing")}
              </a>
              <a
                href="#about"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center px-4 py-3.5 rounded-xl text-base font-medium text-charcoal-700 hover:bg-[#f5f5f7] transition-colors min-h-[44px]"
              >
                {t("about")}
              </a>
              <Link
                href={`/${locale}/dashboard`}
                onClick={() => setDrawerOpen(false)}
                className="flex items-center px-4 py-3.5 rounded-xl text-base font-medium text-charcoal-700 hover:bg-[#f5f5f7] transition-colors min-h-[44px]"
              >
                {t("dashboard")}
              </Link>
            </div>

            {/* CTA */}
            <div className="px-4 pb-4">
              <Link
                href={`/${locale}/auth/register`}
                onClick={() => setDrawerOpen(false)}
                className="block w-full text-center py-3.5 rounded-xl bg-[#CC2020] text-white text-sm font-bold min-h-[44px] flex items-center justify-center"
              >
                {t("startFreeTrial")}
              </Link>
            </div>
          </nav>
        </>
      )}
    </>
  );
}
