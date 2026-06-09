"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { authFetch } from "@/context/AuthContext";

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
  onProjectDeleted?: (id: number | string) => void;
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

export default function ProjectsList({
  projects,
  studioLabel,
  onProjectDeleted,
}: ProjectsListProps) {
  const t = useTranslations("dashboard.mobile.projects");
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const [confirmId, setConfirmId] = useState<number | string | null>(null);

  const handleDelete = async (id: number | string) => {
    setDeletingId(id);
    try {
      const res = await authFetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        onProjectDeleted?.(id);
      }
    } catch {
      // silently ignore — the row will remain if delete fails
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  if (!projects.length) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#bbb]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5M3.75 3h16.5" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-[#111111]">{t("empty")}</p>
        <p className="text-xs text-[#888888] mt-1">{t("emptyHint")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-[#f0f0f0]">
        {projects.map((project) => {
          const thumb = project.result_image || project.image_url;
          const isDeleting = deletingId === project.id;

          return (
            <div
              key={project.id}
              className={`flex items-center gap-3 px-4 py-3 transition-opacity ${isDeleting ? "opacity-40 pointer-events-none" : ""}`}
            >
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
                    <svg className="w-6 h-6 text-[#bbb]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5M3.75 3h16.5" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#111111] truncate">{project.name}</p>
                <p className="text-xs text-[#888888] mt-0.5 truncate">{studioLabel(project.background)}</p>
                {project.created_at && (
                  <p className="text-[10px] text-[#bbb] mt-0.5">{formatDate(project.created_at)}</p>
                )}
              </div>

              {/* Status + delete */}
              <div className="flex-shrink-0 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-semibold border border-emerald-100">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="3" />
                  </svg>
                  Done
                </span>

                {/* Delete button */}
                <button
                  onClick={() => setConfirmId(project.id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#bbb] hover:text-red-500 hover:bg-red-50 transition-colors"
                  aria-label={t("delete")}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm delete sheet */}
      {confirmId !== null && (
        <div className="fixed inset-0 z-[80] flex items-end" onClick={() => setConfirmId(null)}>
          <div
            className="w-full bg-white rounded-t-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-[#111111] text-center mb-1">{t("deleteConfirmTitle")}</p>
            <p className="text-xs text-[#888888] text-center mb-5">{t("deleteConfirmBody")}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 py-3 rounded-xl bg-[#f5f5f7] text-[#111111] text-sm font-semibold border border-[#e8e8e8] min-h-[44px]"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => handleDelete(confirmId)}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold min-h-[44px]"
              >
                {t("deleteConfirm")}
              </button>
            </div>
          </div>
          <div className="absolute inset-0 bg-black/30 -z-10" />
        </div>
      )}
    </>
  );
}
