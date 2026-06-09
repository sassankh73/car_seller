"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import MobileHeader from "./MobileHeader";
import StudioCarousel from "./StudioCarousel";
import WorkflowProgress from "./WorkflowProgress";
import MobileCapture from "./MobileCapture";
import ResultsView from "./ResultsView";
import ProjectsList from "./ProjectsList";
import Spinner from "@/components/ui/Spinner";
import { CapturedImage } from "@/components/GuidedCapture";

interface Project {
  id: number | string;
  name: string;
  background: string;
  image_url?: string;
  result_image?: string;
  created_at?: string;
  watermark_applied?: boolean;
}

interface Studio {
  key: string;
  name: string;
  image_url: string;
  preview_image_url: string;
}

interface AccountData {
  subscription: { plan_name: string; plan_tier: string };
  usage: { generation_count: number; generations_limit: number; remaining: number };
}

interface MobileDashboardProps {
  projects: Project[];
  studios: Studio[];
  account: AccountData | null;
  selectedStudio: string;
  setSelectedStudio: (key: string) => void;
  setStudioExplicitlyChosen: (v: boolean) => void;
  file: File | null;
  previewUrl: string | null;
  resultImage: string | null;
  processing: boolean;
  processingStatus: string;
  batchLabel: string | null;
  enhanceWheels: boolean;
  setEnhanceWheels: (v: boolean) => void;
  enhancePaint: boolean;
  setEnhancePaint: (v: boolean) => void;
  exportQuality: "hd" | "4k";
  setExportQuality: (v: "hd" | "4k") => void;
  apiError: string | null;
  isLoading: boolean;
  studioLabel: (key: string) => string;
  blobToFile: (blob: Blob, name: string) => File;
  pickFile: (f: File) => void;
  handleGenerate: () => Promise<void>;
  handleGenerateAll: (images: { blob: Blob; stepIndex: number }[]) => Promise<void>;
  handleDownload: () => void;
  onNewGeneration: () => void;
  onProjectDeleted?: (id: number | string) => void;
}

type MobileView = "workflow" | "projects";

export default function MobileDashboard({
  projects,
  studios,
  account,
  selectedStudio,
  setSelectedStudio,
  setStudioExplicitlyChosen,
  file,
  previewUrl,
  resultImage,
  processing,
  processingStatus,
  batchLabel,
  enhanceWheels,
  setEnhanceWheels,
  enhancePaint,
  setEnhancePaint,
  exportQuality,
  setExportQuality,
  apiError,
  isLoading,
  studioLabel,
  blobToFile,
  pickFile,
  handleGenerate,
  handleGenerateAll,
  handleDownload,
  onNewGeneration,
  onProjectDeleted,
}: MobileDashboardProps) {
  const t = useTranslations("dashboard.mobile");
  const rt = useTranslations("dashboard.redesign");

  const [mobileView, setMobileView] = useState<MobileView>("workflow");
  const [mobileStep, setMobileStep] = useState(1);
  const [showCapture, setShowCapture] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapturePress = () => {
    setShowCapture(true);
    setMobileView("workflow");
  };

  const handleCaptureComplete = (images: CapturedImage[]) => {
    setShowCapture(false);
    if (images.length > 0) {
      const last = blobToFile(
        images[images.length - 1].blob,
        `photo_step${images[images.length - 1].stepIndex + 1}.jpg`
      );
      pickFile(last);
      setMobileStep(5);
      handleGenerateAll(images);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      pickFile(f);
      setMobileStep(5);
    }
  };

  const resetWorkflow = () => {
    onNewGeneration();
    setMobileStep(1);
  };

  const TOTAL_STEPS = 5;

  // If result is showing, render results view
  if (resultImage) {
    return (
      <div className="flex flex-col min-h-dvh bg-white">
        <MobileHeader planName={account?.subscription?.plan_name} />
        <div className="flex-1 overflow-hidden">
          <ResultsView
            resultImage={resultImage}
            originalPreview={previewUrl}
            selectedStudio={selectedStudio}
            exportQuality={exportQuality}
            onDownload={handleDownload}
            onNewPhoto={resetWorkflow}
          />
        </div>
        {showCapture && (
          <MobileCapture
            onCaptureComplete={handleCaptureComplete}
            onCancel={() => setShowCapture(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[#f5f5f7]">
      <MobileHeader planName={account?.subscription?.plan_name} />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Main scrollable content */}
      <div
        className="flex-1 overflow-y-auto min-h-0 pt-0"
        style={{ paddingBottom: "calc(60px + env(safe-area-inset-bottom, 0px))" }}
      >
        {mobileView === "projects" ? (
          /* ── Projects tab ── */
          <div className="bg-white min-h-full">
            <div className="px-4 py-3 border-b border-[#f0f0f0]">
              <h2 className="text-base font-bold text-[#111111]">Projects</h2>
            </div>
            <ProjectsList
              projects={projects}
              studioLabel={studioLabel}
              onProjectDeleted={onProjectDeleted}
            />
          </div>
        ) : (
          /* ── Workflow tab ── */
          <>
            <WorkflowProgress currentStep={mobileStep} totalSteps={TOTAL_STEPS} />

            {apiError && (
              <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {apiError}
              </div>
            )}

            <div className="px-4 py-4 space-y-4">

              {/* ─ Step 1: Studio ─ */}
              {mobileStep === 1 && (
                <div className="bg-white rounded-2xl border border-[#e8e8e8] overflow-hidden">
                  <div className="px-4 pt-4 pb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#CC2020]/10 text-[10px] font-bold text-[#CC2020] uppercase tracking-wider mb-2">
                      Step 1
                    </span>
                    <h2 className="text-base font-bold text-[#111111]">{rt("step1.heading")}</h2>
                    <p className="text-xs text-[#888888] mt-0.5">{rt("step1.subtitle")}</p>
                  </div>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Spinner size="md" />
                    </div>
                  ) : (
                    <StudioCarousel
                      studios={studios}
                      selectedStudio={selectedStudio}
                      onSelect={(key) => {
                        setSelectedStudio(key);
                        setStudioExplicitlyChosen(true);
                      }}
                      studioLabel={studioLabel}
                    />
                  )}
                  <div className="px-4 pb-4 pt-3">
                    <button
                      onClick={() => setMobileStep(2)}
                      className="w-full py-4 rounded-xl bg-[#CC2020] text-white text-sm font-bold min-h-[44px]"
                    >
                      {t("step1.confirmStudio")} →
                    </button>
                  </div>
                </div>
              )}

              {/* ─ Step 2: Photo Guide ─ */}
              {mobileStep === 2 && (
                <div className="bg-white rounded-2xl border border-[#e8e8e8] p-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#CC2020]/10 text-[10px] font-bold text-[#CC2020] uppercase tracking-wider mb-2">
                    Step 2
                  </span>
                  <h2 className="text-base font-bold text-[#111111] mb-1">{rt("step2.heading")}</h2>
                  <p className="text-xs text-[#888888] mb-4">{rt("step2.subtitle")}</p>
                  <div className="space-y-2.5">
                    {(
                      [
                        { emoji: "☀️", key: "lighting" },
                        { emoji: "📐", key: "angle" },
                        { emoji: "🚗", key: "fullCar" },
                        { emoji: "🧹", key: "background" },
                        { emoji: "📱", key: "resolution" },
                        { emoji: "🚫", key: "exterior" },
                      ] as const
                    ).map(({ emoji, key }) => (
                      <div key={key} className="flex items-start gap-3 bg-[#f5f5f7] rounded-xl p-3">
                        <span className="text-lg flex-shrink-0 leading-none mt-0.5">{emoji}</span>
                        <p className="text-sm text-[#333333] leading-snug">{rt(`step2.tips.${key}`)}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setMobileStep(3)}
                    className="w-full mt-5 py-4 rounded-xl bg-[#CC2020] text-white text-sm font-bold min-h-[44px]"
                  >
                    {t("step2.continue")} →
                  </button>
                </div>
              )}

              {/* ─ Step 3: Good vs Bad ─ */}
              {mobileStep === 3 && (
                <div className="bg-white rounded-2xl border border-[#e8e8e8] p-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#CC2020]/10 text-[10px] font-bold text-[#CC2020] uppercase tracking-wider mb-2">
                    Step 3
                  </span>
                  <h2 className="text-base font-bold text-[#111111] mb-4">{rt("step3.heading")}</h2>
                  <div className="space-y-3">
                    {([
                      { icon: "💡", text: t("step3.tip1") },
                      { icon: "📐", text: t("step3.tip2") },
                      { icon: "✨", text: t("step3.tip3") },
                    ] as const).map(({ icon, text }, i) => (
                      <div key={i} className="flex items-center gap-3 bg-[#f5f5f7] rounded-xl p-3.5">
                        <span className="text-xl flex-shrink-0">{icon}</span>
                        <p className="text-sm text-[#333333]">{text}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setMobileStep(4)}
                    className="w-full mt-5 py-4 rounded-xl bg-[#CC2020] text-white text-sm font-bold min-h-[44px]"
                  >
                    {t("step3.readyToCapture")} →
                  </button>
                </div>
              )}

              {/* ─ Step 4: Capture / Upload ─ */}
              {mobileStep === 4 && (
                <div className="bg-white rounded-2xl border border-[#e8e8e8] p-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#CC2020]/10 text-[10px] font-bold text-[#CC2020] uppercase tracking-wider mb-2">
                    Step 4
                  </span>
                  <h2 className="text-base font-bold text-[#111111] mb-1">{rt("step4.heading")}</h2>
                  <p className="text-xs text-[#888888] mb-5">{rt("step4.deviceZone.hint")}</p>

                  <div className="space-y-3">
                    {/* Guided capture */}
                    <button
                      onClick={() => setShowCapture(true)}
                      className="w-full py-4 rounded-xl bg-[#CC2020] text-white text-sm font-bold flex items-center justify-center gap-2.5 min-h-[56px]"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                      </svg>
                      {t("step4.takePhotos")}
                    </button>

                    <div className="flex items-center gap-3 text-xs text-[#888888]">
                      <div className="flex-1 border-t border-[#e8e8e8]" />
                      <span>{t("step4.orLabel")}</span>
                      <div className="flex-1 border-t border-[#e8e8e8]" />
                    </div>

                    {/* Gallery upload */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 rounded-xl bg-white text-[#111111] text-sm font-bold border-2 border-[#e8e8e8] flex items-center justify-center gap-2.5 min-h-[56px]"
                    >
                      <svg className="w-5 h-5 text-[#555]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      {t("step4.uploadGallery")}
                    </button>

                    {/* Thumbnail confirmation if file is selected */}
                    {previewUrl && (
                      <>
                        <div className="rounded-xl overflow-hidden border border-[#e8e8e8] bg-[#f5f5f7]">
                          <Image
                            src={previewUrl}
                            alt="Preview"
                            width={400}
                            height={250}
                            className="w-full object-contain max-h-48"
                            unoptimized
                          />
                        </div>
                        <button
                          onClick={() => setMobileStep(5)}
                          className="w-full py-4 rounded-xl bg-[#111111] text-white text-sm font-bold min-h-[44px]"
                        >
                          {t("step4.useThis")} →
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ─ Step 5: Process ─ */}
              {mobileStep === 5 && (
                <div className="bg-white rounded-2xl border border-[#e8e8e8] p-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#CC2020]/10 text-[10px] font-bold text-[#CC2020] uppercase tracking-wider mb-2">
                    Step 5
                  </span>

                  {/* Studio confirmation */}
                  <div className="flex items-center gap-3 bg-[#f5f5f7] rounded-xl p-3 mb-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider">Studio</p>
                      <p className="text-sm font-semibold text-[#111111] truncate mt-0.5">
                        {studioLabel(selectedStudio)}
                      </p>
                    </div>
                    <button
                      onClick={() => setMobileStep(1)}
                      className="text-xs text-[#CC2020] font-semibold min-h-[44px] px-2"
                    >
                      Change
                    </button>
                  </div>

                  {/* Quality selector */}
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-xs text-[#888888]">{rt("options.quality")}:</span>
                    {(["hd", "4k"] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => setExportQuality(q)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors min-h-[36px] ${
                          exportQuality === q
                            ? "bg-[#CC2020] text-white"
                            : "bg-[#f5f5f7] text-[#888888]"
                        }`}
                      >
                        {q.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  {/* Process button */}
                  <button
                    onClick={handleGenerate}
                    disabled={!file || processing}
                    className={`w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 min-h-[56px] ${
                      file && !processing
                        ? "bg-[#CC2020] text-white shadow-lg shadow-red-500/20"
                        : "bg-[#ebebeb] text-[#aaaaaa] cursor-not-allowed"
                    }`}
                  >
                    {processing ? (
                      <>
                        <Spinner size="sm" className="text-white" />
                        {batchLabel ?? t("step5.processing")}
                      </>
                    ) : (
                      <>⚡ {t("step5.processAI")}</>
                    )}
                  </button>

                  <button
                    onClick={resetWorkflow}
                    className="w-full mt-3 py-3 rounded-xl bg-[#f5f5f7] text-[#555] text-sm font-semibold min-h-[44px]"
                  >
                    {t("step5.startNew")}
                  </button>
                </div>
              )}

            </div>
          </>
        )}
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#e8e8e8] flex items-stretch"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <button
          onClick={() => setMobileView("workflow")}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2"
        >
          <svg width="22" height="22" fill="none" stroke={mobileView === "workflow" ? "#CC2020" : "#888888"} strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          <span className="text-[10px] font-medium" style={{ color: mobileView === "workflow" ? "#CC2020" : "#888888" }}>
            {t("bottomNav.projects")}
          </span>
        </button>

        <button
          onClick={handleCapturePress}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2"
        >
          <div className="w-12 h-12 rounded-full bg-[#CC2020] flex items-center justify-center -mt-5 shadow-lg shadow-red-500/30">
            <svg width="22" height="22" fill="none" stroke="white" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
          </div>
          <span className="text-[10px] font-medium" style={{ color: "#888888" }}>
            {t("bottomNav.capture")}
          </span>
        </button>

        <button
          onClick={() => setMobileView("projects")}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2"
        >
          <svg width="22" height="22" fill="none" stroke={mobileView === "projects" ? "#CC2020" : "#888888"} strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <span className="text-[10px] font-medium" style={{ color: mobileView === "projects" ? "#CC2020" : "#888888" }}>
            {t("bottomNav.account")}
          </span>
        </button>
      </nav>

      {/* Full-screen capture modal */}
      {showCapture && (
        <MobileCapture
          onCaptureComplete={handleCaptureComplete}
          onCancel={() => setShowCapture(false)}
        />
      )}
    </div>
  );
}
