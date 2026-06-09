"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

interface ResultsViewProps {
  resultImage: string;
  originalPreview?: string | null;
  selectedStudio: string;
  exportQuality: "hd" | "4k";
  onDownload: () => void;
  onNewPhoto: () => void;
}

export default function ResultsView({
  resultImage,
  originalPreview,
  selectedStudio,
  exportQuality,
  onDownload,
  onNewPhoto,
}: ResultsViewProps) {
  const t = useTranslations("dashboard.mobile.results");
  const [toast, setToast] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "AutoStudio Result", url: resultImage });
      } catch { /* user dismissed */ }
    } else {
      try {
        await navigator.clipboard.writeText(resultImage);
        setToast(t("linkCopied"));
        setTimeout(() => setToast(null), 2500);
      } catch { /* ignore */ }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Result image */}
      <div className="flex-1 bg-[#f5f5f7] flex items-center justify-center overflow-hidden">
        {showOriginal && originalPreview ? (
          <Image
            src={originalPreview}
            alt="Original"
            width={800}
            height={600}
            className="w-full object-contain max-h-full"
            unoptimized
          />
        ) : (
          <Image
            src={resultImage}
            alt="Result"
            width={800}
            height={600}
            className="w-full object-contain max-h-full"
            unoptimized
          />
        )}
      </div>

      {/* Action row */}
      <div className="bg-white border-t border-[#e8e8e8] p-4 grid grid-cols-2 gap-3" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
        <button
          onClick={onDownload}
          className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#CC2020] text-white text-sm font-bold min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {t("download")}
        </button>

        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#f5f5f7] text-[#111111] text-sm font-bold border border-[#e8e8e8] min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
          {t("share")}
        </button>

        {originalPreview && (
          <button
            onClick={() => setShowOriginal((v) => !v)}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#f5f5f7] text-[#111111] text-sm font-semibold border border-[#e8e8e8] min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {showOriginal ? "Show Result" : t("viewOriginal")}
          </button>
        )}

        <button
          onClick={onNewPhoto}
          className={`flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#f5f5f7] text-[#111111] text-sm font-semibold border border-[#e8e8e8] min-h-[44px] ${originalPreview ? "" : "col-span-2"}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          {t("newPhoto")}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#111] text-white text-sm px-4 py-2 rounded-full shadow-lg z-[70]">
          {toast}
        </div>
      )}
    </div>
  );
}
