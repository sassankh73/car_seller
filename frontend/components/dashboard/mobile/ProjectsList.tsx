"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

interface Project {
  id: number | string;
  name: string;
  background: string;
  image_url?: string;
  result_image?: string;
  created_at?: string;
  watermark_applied?: boolean;
}

interface ProjectsListProps {
  projects: Project[];
  studioLabel: (key: string) => string;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function ProjectsList({ projects, studioLabel }: ProjectsListProps) {
  const t = useTranslations("dashboard.mobile.projects");

  if (!projects.length) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-[#bbb]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5M3.75 3h16.5"
            />
          </svg>
        </div>
        <p className="text-sm font-semibold text-[#111111]">{t("empty")}</p>
        <p className="text-xs text-[#888888] mt-1">{t("emptyHint")}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[#f0f0f0]">
      {projects.map((project) => {
        const thumb = project.result_image || project.image_url;
        return (
          <div key={project.id} className="flex items-center gap-3 px-4 py-3">
            {/* Thumbnail */}
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#f5f5f7] flex-shrink-0 border border-[#e8e8e8]">
              {thumb ? (
                <Image
                  src={thumb}
                  alt={project.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-[#bbb]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5M3.75 3h16.5"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#111111] truncate">
                {project.name}
              </p>
              <p className="text-xs text-[#888888] mt-0.5 truncate">
                {studioLabel(project.background)}
              </p>
              {project.created_at && (
                <p className="text-[10px] text-[#bbb] mt-0.5">
                  {formatDate(project.created_at)}
                </p>
              )}
            </div>

            {/* Status badge */}
            <div className="flex-shrink-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-semibold border border-emerald-100">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 8 8">
                  <circle cx="4" cy="4" r="3" />
                </svg>
                Done
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
