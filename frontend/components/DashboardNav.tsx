"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/context/AuthContext";

interface DashboardNavProps {
  /** The nav key that is currently active — used to highlight the right link */
  active: "dashboard" | "billing" | "settings" | "account";
}

export default function DashboardNav({ active }: DashboardNavProps) {
  const t = useTranslations("dashboard");
  const { logout, user } = useAuth();
  const locale = useLocale();

  const link = (
    href: string,
    key: DashboardNavProps["active"],
    label: string
  ) => {
    const isActive = key === active;
    return (
      <Link
        href={href}
        className={`text-sm font-medium transition ${
          isActive
            ? "text-stone-900 border-b-2 border-red-500 pb-1"
            : "text-stone-500 hover:text-stone-900"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href={`/${locale}`} className="text-xl font-bold text-stone-900">
              AutoStudio AI
            </Link>
            {link(`/${locale}/dashboard`, "dashboard", t("navigation.projects"))}
            {link(`/${locale}/dashboard/billing`, "billing", t("navigation.billing"))}
            {link(`/${locale}/dashboard/settings`, "settings", t("navigation.settings"))}
            {link(`/${locale}/dashboard/account`, "account", t("navigation.account"))}
            {user?.role === "ADMIN" && (
              <Link
                href={`/${locale}/admin/dashboard`}
                className="text-sm font-medium text-red-500 hover:text-red-600 transition"
              >
                Admin
              </Link>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            <button
              onClick={logout}
              className="text-stone-500 hover:text-stone-900 transition text-sm font-medium"
            >
              {t("navigation.logout")}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
