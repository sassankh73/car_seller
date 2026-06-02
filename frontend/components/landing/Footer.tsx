"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations("footer");
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-graphite-200">
      <div className="container mx-auto px-6 py-16 md:py-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
          {/* Brand */}
          <Link href="/" className="text-xl font-bold text-graphite-800 tracking-tight">
            Auto<span className="text-graphite-400">Studio</span>
          </Link>

          {/* Minimal nav links */}
          <div className="flex flex-wrap gap-8">
            <Link
              href="#how-it-works"
              className="text-graphite-400 hover:text-graphite-800 text-sm transition-colors duration-200 tracking-wide"
            >
              How It Works
            </Link>
            <Link
              href="#studios"
              className="text-graphite-400 hover:text-graphite-800 text-sm transition-colors duration-200 tracking-wide"
            >
              Studios
            </Link>
            <Link
              href="#"
              className="text-graphite-400 hover:text-graphite-800 text-sm transition-colors duration-200 tracking-wide"
            >
              {t("contactUs")}
            </Link>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-graphite-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-graphite-300 text-xs tracking-wide">
            © {currentYear} AutoStudio. {t("allRightsReserved")}
          </p>
          <div className="flex gap-6">
            <Link
              href="#"
              className="text-graphite-300 hover:text-graphite-600 text-xs transition-colors duration-200 tracking-wide"
            >
              {t("termsOfService")}
            </Link>
            <Link
              href="#"
              className="text-graphite-300 hover:text-graphite-600 text-xs transition-colors duration-200 tracking-wide"
            >
              {t("privacyPolicy")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}