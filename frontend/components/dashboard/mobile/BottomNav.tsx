"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

interface BottomNavProps {
  onCapturePress: () => void;
  activeTab: "projects" | "capture" | "account";
}

const ACCENT = "#CC2020";
const INACTIVE = "#888888";

export default function BottomNav({ onCapturePress, activeTab }: BottomNavProps) {
  const locale = useLocale();
  const t = useTranslations("dashboard.mobile.bottomNav");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e8e8e8] flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Projects */}
      <Link
        href={`/${locale}/dashboard`}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2"
      >
        <svg
          width="22"
          height="22"
          fill="none"
          stroke={activeTab === "projects" ? ACCENT : INACTIVE}
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
          />
        </svg>
        <span
          className="text-[10px] font-medium"
          style={{ color: activeTab === "projects" ? ACCENT : INACTIVE }}
        >
          {t("projects")}
        </span>
      </Link>

      {/* Capture (FAB) */}
      <button
        onClick={onCapturePress}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2"
        aria-label={t("capture")}
      >
        <div className="w-12 h-12 rounded-full bg-[#CC2020] flex items-center justify-center -mt-5 shadow-lg shadow-red-500/30">
          <svg
            width="22"
            height="22"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
            />
          </svg>
        </div>
        <span className="text-[10px] font-medium" style={{ color: INACTIVE }}>
          {t("capture")}
        </span>
      </button>

      {/* Account */}
      <Link
        href={`/${locale}/dashboard/account`}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2"
      >
        <svg
          width="22"
          height="22"
          fill="none"
          stroke={activeTab === "account" ? ACCENT : INACTIVE}
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
          />
        </svg>
        <span
          className="text-[10px] font-medium"
          style={{ color: activeTab === "account" ? ACCENT : INACTIVE }}
        >
          {t("account")}
        </span>
      </Link>
    </nav>
  );
}
