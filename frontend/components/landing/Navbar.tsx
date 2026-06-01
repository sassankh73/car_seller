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
    { href: "#value-proposition", label: t("valueProp.eyebrow") },
    { href: "#comparison", label: t("beforeAfter.before") },
    { href: "#studios", label: t("studios.title") },
    { href: "#testimonials", label: t("testimonials.title") },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-lg border-b border-graphite-200"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className={`text-xl font-bold tracking-tight transition-colors duration-300 ${
              isScrolled ? "text-graphite-800" : "text-white"
            }`}>
              Auto<span className={isScrolled ? "text-graphite-400" : "text-white/60"}>Studio</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors duration-200 tracking-wide ${
                  isScrolled
                    ? "text-graphite-400 hover:text-graphite-800"
                    : "text-white/70 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-6">
            <LanguageSwitcher />

            <Link
              href={`/${locale}/auth/login`}
              className={`px-5 py-2 text-sm font-medium transition-colors duration-200 tracking-wide ${
                isScrolled
                  ? "text-graphite-600 hover:text-graphite-800"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {authT("submit")}
            </Link>

            <Link
              href={`/${locale}/auth/register`}
              className={`px-5 py-2.5 text-sm font-semibold transition-all duration-300 tracking-wide ${
                isScrolled
                  ? "bg-graphite-800 text-white hover:bg-graphite-700"
                  : "bg-white text-graphite-800 hover:bg-white/90"
              }`}
            >
              {commonT("getStarted")}
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`md:hidden p-2 transition-colors ${
              isScrolled ? "text-graphite-600" : "text-white"
            }`}
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
          <div className="md:hidden py-6 border-t border-graphite-200 bg-white">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-graphite-600 hover:text-graphite-800 text-sm font-medium transition-colors py-2"
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex items-center gap-4 pt-4 border-t border-graphite-200">
                <LanguageSwitcher />
                <Link
                  href={`/${locale}/auth/login`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-5 py-2.5 text-graphite-600 hover:text-graphite-800 font-medium transition-colors text-sm"
                >
                  {authT("submit")}
                </Link>
                <Link
                  href={`/${locale}/auth/register`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="px-5 py-2.5 bg-graphite-800 text-white font-semibold text-sm"
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