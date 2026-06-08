"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";

interface Project {
  id: number | string;
  name: string;
  background: string;
  image_url?: string;
  result_image?: string;
}

interface UsageData {
  generation_count: number;
  generations_limit: number;
  remaining: number;
}

interface RightPanelProps {
  projects: Project[];
  usage: UsageData | null;
  planName: string;
  studioLabel: (key: string) => string;
}

export default function RightPanel({ projects, usage, planName, studioLabel }: RightPanelProps) {
  const t = useTranslations("dashboard.redesign.right");
  const locale = useLocale();

  const isUnlimited = usage ? usage.generations_limit <= 0 : false;

  return (
    <aside className="w-[240px] bg-white border-l border-[#e8e8e8] flex flex-col overflow-y-auto flex-shrink-0">

      {/* Recent Projects */}
      <div className="p-4 flex-1 overflow-y-auto">
        <p className="text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-3">
          {t("recentProjects")}
        </p>
        {projects.length === 0 ? (
          <p className="text-xs text-[#888888]">{t("noProjects")}</p>
        ) : (
          <div className="space-y-2">
            {projects.slice(0, 8).map((project) => {
              const thumb = project.result_image || project.image_url;
              return (
                <div key={project.id} className="flex items-center gap-2.5">
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-md overflow-hidden bg-[#f5f5f7] flex-shrink-0 border border-[#e8e8e8]">
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt={project.name}
                        width={40}
                        height={40}
                        className="object-cover w-full h-full"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-[#888888]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#111111] truncate">{project.name}</p>
                    <p className="text-[10px] text-[#888888] truncate">{studioLabel(project.background)}</p>
                    <p className="text-[10px] text-emerald-600 font-medium">✓ {t("done")}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Usage Stats */}
      <div className="p-4 border-t border-[#e8e8e8]">
        <p className="text-[11px] font-bold text-[#888888] uppercase tracking-wider mb-3">
          {t("usage.plan")}
        </p>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#888888]">{t("usage.creditsLeft")}</span>
            <span className="text-xs font-bold text-[#111111]">
              {isUnlimited
                ? t("usage.unlimited")
                : usage
                ? usage.remaining
                : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#888888]">{t("usage.thisMonth")}</span>
            <span className="text-xs font-bold text-[#111111]">
              {usage ? usage.generation_count : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#888888]">{t("usage.plan")}</span>
            <span className="text-xs font-bold text-[#111111]">{planName}</span>
          </div>
        </div>
      </div>

      {/* Upgrade Card */}
      <div className="m-3 rounded-xl p-4 text-white" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #e63946 100%)" }}>
        <p className="text-sm font-bold mb-1">🚀 {t("upgrade.title")}</p>
        <p className="text-xs text-white/80 mb-3">{t("upgrade.subtitle")}</p>
        <Link
          href={`/${locale}/dashboard/billing`}
          className="block text-center text-xs font-semibold bg-white text-[#e63946] rounded-lg py-1.5 hover:bg-white/90 transition-colors"
        >
          {t("upgrade.button")}
        </Link>
      </div>
    </aside>
  );
}
