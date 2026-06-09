"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/context/AuthContext";

interface DashboardNavProps {
  active: "dashboard" | "billing" | "settings" | "account";
  planName?: string;
}

export default function DashboardNav({ active, planName }: DashboardNavProps) {
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
        className={`text-sm font-medium transition-colors ${
          isActive
            ? "text-[#111111] border-b-2 border-[#CC2020] pb-1"
            : "text-[#888888] hover:text-[#111111]"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="border-b border-[#e8e8e8] bg-white sticky top-0 z-10">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        <div className="flex justify-between h-14 items-center">
          {/* Left: logo + nav links */}
          <div className="flex items-center gap-7">
            <Link href={`/${locale}`} className="flex items-center gap-2">
              <Image
                src="/autostudio-logo.svg"
                alt="AutoStudio"
                width={120}
                height={22}
                className="h-[22px] w-auto"
                priority
              />
            </Link>
            <div className="hidden md:flex items-center gap-6">
              {link(`/${locale}/dashboard`, "dashboard", t("navigation.projects"))}
              {link(`/${locale}/dashboard/billing`, "billing", t("navigation.billing"))}
              {link(`/${locale}/dashboard/settings`, "settings", t("navigation.settings"))}
              {link(`/${locale}/dashboard/account`, "account", t("navigation.account"))}
              {user?.role === "ADMIN" && (
                <Link
                  href={`/${locale}/admin/dashboard`}
                  className="text-sm font-medium text-[#CC2020] hover:text-red-700 transition-colors"
                >
                  Admin
                </Link>
              )}
            </div>
          </div>

          {/* Right: plan badge + language + logout */}
          <div className="flex items-center gap-3">
            {planName && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#f5f5f7] text-[#111111] border border-[#e8e8e8]">
                {planName}
              </span>
            )}
            <LanguageSwitcher />
            <button
              onClick={logout}
              className="text-[#888888] hover:text-[#111111] transition-colors text-sm font-medium"
            >
              {t("navigation.logout")}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
