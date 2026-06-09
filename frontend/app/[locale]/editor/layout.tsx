"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import { getBadge } from "@/lib/api/editor";
import type { TicketBadge } from "@/types/editor";

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("editor.nav");
  const locale = useLocale();
  const pathname = usePathname();
  const { user, isAuthenticated, loading } = useAuth();
  const [badge, setBadge] = useState<TicketBadge | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchBadge = () => getBadge().then(setBadge).catch(() => {});
    fetchBadge();
    const id = setInterval(fetchBadge, 30000);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  if (loading) return null;
  if (!isAuthenticated || (user?.role !== "EDITOR" && user?.role !== "ADMIN")) {
    if (typeof window !== "undefined") window.location.href = `/${locale}/dashboard`;
    return null;
  }

  const badgeCount = badge ? badge.open_count + badge.in_progress_count + badge.review_count : 0;
  const availableCount = badge?.available_count ?? 0;
  const isActive = (path: string) => pathname.includes(path);

  return (
    <div className="min-h-screen flex bg-[#f5f5f7]">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-[#e8e8e8] flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-[#e8e8e8]">
          <Link href={`/${locale}`}>
            <Image src="/autostudio-logo.svg" alt="AutoStudio" width={120} height={22} className="h-[22px] w-auto" />
          </Link>
          <p className="text-[11px] text-[#999] mt-1 font-medium uppercase tracking-wide">Editor Portal</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href={`/${locale}/editor/tickets`}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive("/editor/tickets")
                ? "bg-[#CC2020]/10 text-[#CC2020]"
                : "text-[#555] hover:bg-[#f5f5f7]"
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="flex-1">{t("myTickets")}</span>
            {badgeCount > 0 && (
              <span className="bg-[#CC2020] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
            {availableCount > 0 && (
              <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center" title="Available to claim">
                +{availableCount > 99 ? "99" : availableCount}
              </span>
            )}
          </Link>

          <Link
            href={`/${locale}/editor/profile`}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive("/editor/profile")
                ? "bg-[#CC2020]/10 text-[#CC2020]"
                : "text-[#555] hover:bg-[#f5f5f7]"
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {t("myProfile")}
          </Link>
        </nav>

        <div className="px-4 py-3 border-t border-[#e8e8e8] text-xs text-[#aaa]">
          {user?.email}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
