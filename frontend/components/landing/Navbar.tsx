"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "../LanguageSwitcher";

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const t = useTranslations("landing");
  const commonT = useTranslations("common");
  const authT = useTranslations("auth.login");
  const locale = useLocale();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "#how-it-works", label: t("howItWorks.title") },
    { href: "#features", label: t("features.title") },
    { href: "#studios", label: t("studios.title") },
    { href: "#pricing", label: t("pricing.title") },
    { href: "#faq", label: t("faq.title") },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-black/80 backdrop-blur-lg border-b border-gray-800"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold text-white">
            AutoStudio AI
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-300 hover:text-white text-sm transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-4">
            <LanguageSwitcher />

            <Link
              href={`/${locale}/auth/login`}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-600/90 transition-all duration-300 text-sm"
            >
              {authT("submit")}
            </Link>

            <Link
              href={`/${locale}/auth/register`}
              className="px-5 py-2.5 bg-gray-800 border border-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-all duration-300 text-sm"
            >
              {commonT("getStarted")}
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-800">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-gray-300 hover:text-white text-sm transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex items-center gap-4 pt-4 border-t border-gray-800">
                <LanguageSwitcher />
                <Link
                  href={`/${locale}/auth/login`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-600/90 transition-all duration-300 text-sm"
                >
                  {authT("submit")}
                </Link>
                <Link
                  href={`/${locale}/auth/register`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-5 py-2.5 bg-gray-800 border border-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-all duration-300 text-sm"
                >
                  {commonT("getStarted")}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
