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
  processing?: boolean;
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
      <div className="p-4 flex-1 min-h-0 overflow-y-auto">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-widest mb-3">
          {t("recentProjects")}
        </p>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-10 h-10 rounded-full bg-[#f5f5f7] border border-[#e8e8e8] flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-[#cccccc]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </div>
            <p className="text-xs text-[#aaaaaa]">{t("noProjects")}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {projects.slice(0, 8).map((project) => {
              const thumb = project.result_image || project.image_url;
              const isDone = !project.processing;
              return (
                <div
                  key={project.id}
                  className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-[#f9f9f9] transition-colors group"
                >
                  {/* Thumbnail */}
                  <div className="w-9 h-9 rounded-md overflow-hidden bg-[#f5f5f7] flex-shrink-0 border border-[#e8e8e8]">
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt={project.name}
                        width={36}
                        height={36}
                        className="object-cover w-full h-full"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-[#cccccc]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-[#111111] truncate leading-tight">
                      {project.name}
                    </p>
                    <p className="text-[10px] text-[#888888] truncate leading-tight mt-0.5">
                      {studioLabel(project.background)}
                    </p>
                    {isDone ? (
                      <p className="text-[10px] text-emerald-600 font-medium mt-0.5 leading-tight">
                        ✓ {t("done")}
                      </p>
                    ) : (
                      <p className="text-[10px] text-amber-500 font-medium mt-0.5 leading-tight">
                        ⏳ Processing
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-[#e8e8e8]" />

      {/* Usage Stats */}
      <div className="p-4">
        <p className="text-[10px] font-bold text-[#888888] uppercase tracking-widest mb-3">
          Usage
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
              {usage ? `${usage.generation_count} photos` : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#888888]">{t("usage.plan")}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f5f5f7] text-[#111111] border border-[#e8e8e8]">
              {planName}
            </span>
          </div>
        </div>
      </div>

      {/* Upgrade Card */}
      <div className="mx-3 mb-3 rounded-xl p-4 text-white overflow-hidden relative" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #e63946 100%)" }}>
        {/* Decorative circle */}
        <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-white/5" />
        <div className="absolute -right-2 -bottom-6 w-20 h-20 rounded-full bg-white/5" />
        <p className="text-sm font-bold mb-0.5 relative">🚀 {t("upgrade.title")}</p>
        <p className="text-[11px] text-white/75 mb-3 leading-relaxed relative">{t("upgrade.subtitle")}</p>
        <Link
          href={`/${locale}/dashboard/billing`}
          className="block text-center text-xs font-bold bg-white text-[#e63946] rounded-lg py-1.5 hover:bg-white/90 transition-colors relative"
        >
          {t("upgrade.button")}
        </Link>
      </div>
    </aside>
  );
}
