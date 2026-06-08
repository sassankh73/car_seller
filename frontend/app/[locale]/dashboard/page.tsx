"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import DashboardNav from "@/components/DashboardNav";
import GuidedCapture from "@/components/GuidedCapture";
import WorkflowSidebar from "@/components/dashboard/WorkflowSidebar";
import RightPanel from "@/components/dashboard/RightPanel";
import { useAuth, authFetch } from "@/context/AuthContext";
import Spinner from "@/components/ui/Spinner";

interface Project {
  id: number | string;
  name: string;
  background: string;
  image_url?: string;
  result_image?: string;
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

// Studio colour swatches used when API preview image isn't loaded yet
const STUDIO_COLORS: Record<string, string> = {
  white_corner_light_epoxy: "#f0f0f0",
  white_corner_ceramic_tile: "#e8e8e4",
  light_gray_corner_medium_epoxy: "#d4d4d4",
  dark_gray_corner_concrete: "#5a5a5a",
  black_corner_dark_epoxy: "#1a1a1a",
  commercial_showroom_tile: "#c8c8c8",
  industrial_concrete: "#8a8a7a",
  matte_black_automotive: "#222222",
};

export default function Dashboard() {
  const t = useTranslations("dashboard");
  const rt = useTranslations("dashboard.redesign");
  const commonT = useTranslations("common");
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [selectedStudio, setSelectedStudio] = useState<string>("white_corner_light_epoxy");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [useGuidedCapture, setUseGuidedCapture] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [enhanceWheels, setEnhanceWheels] = useState(true);
  const [enhancePaint, setEnhancePaint] = useState(true);
  const [exportQuality, setExportQuality] = useState<"hd" | "4k">("hd");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingStatus, setProcessingStatus] = useState<string>("idle");
  const [batchLabel, setBatchLabel] = useState<string | null>(null);
  const [uploadHover, setUploadHover] = useState<"device" | "camera" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (resultBlobUrlRef.current) URL.revokeObjectURL(resultBlobUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    const load = async () => {
      try {
        const [studiosRes, projectsRes, accountRes] = await Promise.all([
          fetch("/api/studio"),
          authFetch("/api/projects"),
          authFetch("/api/auth/account"),
        ]);
        if (!studiosRes.ok || !projectsRes.ok || !accountRes.ok) {
          throw new Error("API error loading dashboard data");
        }
        const [studiosData, projectsData, accountData] = await Promise.all([
          studiosRes.json(),
          projectsRes.json(),
          accountRes.json(),
        ]);
        setStudios(studiosData);
        setProjects(projectsData);
        setAccount(accountData);
        setApiError(null);
      } catch (err) {
        console.error("Dashboard load error:", err);
        setApiError(commonT("error"));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [authLoading, isAuthenticated, commonT]);

  const blobToFile = (blob: Blob, name: string): File =>
    new File([blob], name, { type: blob.type || "image/jpeg" });

  const pickFile = (f: File) => {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResultImage(null);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
  };

  const handleDrop = (e: React.DragEvent, zone: "device") => {
    e.preventDefault();
    setUploadHover(null);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) pickFile(f);
  };

  const statusSteps = ["uploading", "preparing", "applying", "finalizing"] as const;

  const handleGenerate = async () => {
    if (!file || !selectedStudio) return;
    setProcessing(true);
    setResultImage(null);
    setProcessingStatus("uploading");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("studio_key", selectedStudio);
    formData.append("enhance_wheels", enhanceWheels.toString());
    formData.append("enhance_paint", enhancePaint.toString());
    formData.append("export_quality", exportQuality);

    let stepIndex = 0;
    const interval = setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, statusSteps.length - 1);
      setProcessingStatus(statusSteps[stepIndex]);
    }, 3000);

    try {
      const res = await fetch("/api/studio/process", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Processing failed");
      const blob = await res.blob();
      if (resultBlobUrlRef.current) URL.revokeObjectURL(resultBlobUrlRef.current);
      const url = URL.createObjectURL(blob);
      resultBlobUrlRef.current = url;
      setResultImage(url);
      setProjects((prev) => [
        { id: Date.now().toString(), name: file.name, background: selectedStudio, result_image: url },
        ...prev,
      ]);
      setProcessingStatus("completed");
    } catch (err: any) {
      setApiError(err.message || commonT("error"));
      setProcessingStatus("idle");
    } finally {
      clearInterval(interval);
      setProcessing(false);
    }
  };

  const handleGenerateAll = async (images: { blob: Blob; stepIndex: number }[]) => {
    if (!images.length) return;
    setProcessing(true);
    setResultImage(null);
    setApiError(null);
    const angleNames = ["Front Left 45°", "Side View", "Rear Left 45°", "Rear/Front View"];
    for (let i = 0; i < images.length; i++) {
      setBatchLabel(`Processing photo ${i + 1} of ${images.length}…`);
      const imgFile = blobToFile(images[i].blob, `photo_step${images[i].stepIndex + 1}_${Date.now()}.jpg`);
      const formData = new FormData();
      formData.append("file", imgFile);
      formData.append("studio_key", selectedStudio);
      formData.append("enhance_wheels", enhanceWheels.toString());
      formData.append("enhance_paint", enhancePaint.toString());
      formData.append("export_quality", exportQuality);
      try {
        const res = await fetch("/api/studio/process", { method: "POST", credentials: "include", body: formData });
        if (!res.ok) continue;
        const blob = await res.blob();
        if (resultBlobUrlRef.current) URL.revokeObjectURL(resultBlobUrlRef.current);
        const url = URL.createObjectURL(blob);
        resultBlobUrlRef.current = url;
        setResultImage(url);
        setProjects((prev) => [
          { id: `${Date.now()}-${i}`, name: angleNames[images[i].stepIndex] ?? `Photo ${i + 1}`, background: selectedStudio, result_image: url },
          ...prev,
        ]);
      } catch { /* continue batch */ }
    }
    setBatchLabel(null);
    setProcessing(false);
    setProcessingStatus("completed");
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement("a");
    a.href = resultImage;
    a.download = `autostudio_${selectedStudio}_${exportQuality}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Studio label helper — resolves translation for known keys, falls back to API name
  const studioLabel = (key: string): string => {
    const studioMap: Record<string, string> = {
      white_corner_light_epoxy: t("studio.studios.white_corner_light_epoxy"),
      white_corner_ceramic_tile: t("studio.studios.white_corner_ceramic_tile"),
      light_gray_corner_medium_epoxy: t("studio.studios.light_gray_corner_medium_epoxy"),
      dark_gray_corner_concrete: t("studio.studios.dark_gray_corner_concrete"),
      black_corner_dark_epoxy: t("studio.studios.black_corner_dark_epoxy"),
      commercial_showroom_tile: t("studio.studios.commercial_showroom_tile"),
      industrial_concrete: t("studio.studios.industrial_concrete"),
      matte_black_automotive: t("studio.studios.matte_black_automotive"),
    };
    return studioMap[key] || key;
  };

  // Derive workflow step (1-5) from real state
  const activeStep = resultImage ? 5 : processing ? 4 : file ? 3 : 2;

  const canProcess = !!file && !!selectedStudio && !processing;
  const selectedStudioObj = studios.find((s) => s.key === selectedStudio);

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-[#888888] text-center">
          <Spinner size="lg" className="mx-auto mb-3" />
          <p className="text-sm">{commonT("loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]" style={{ fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <DashboardNav active="dashboard" planName={account?.subscription?.plan_name} />

      {/* 3-column body */}
      <div className="flex" style={{ height: "calc(100vh - 56px)" }}>

        {/* ── SIDEBAR ── */}
        <div className="hidden lg:flex">
          <WorkflowSidebar
            activeStep={activeStep}
            creditsRemaining={account?.usage?.remaining ?? null}
            photosThisMonth={account?.usage?.generation_count ?? 0}
            isUnlimited={(account?.usage?.generations_limit ?? 1) <= 0}
          />
        </div>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">

            {apiError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {apiError}
              </div>
            )}

            {/* ─ STEP 1: Choose Studio ─ */}
            <section className="bg-white rounded-xl border border-[#e8e8e8] p-5">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-[#e63946] uppercase tracking-wider">Step 1</span>
                </div>
                <h2 className="text-base font-bold text-[#111111]">{rt("step1.heading")}</h2>
                <p className="text-sm text-[#888888] mt-0.5">{rt("step1.subtitle")}</p>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="md" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {studios.map((studio) => {
                    const isSelected = selectedStudio === studio.key;
                    return (
                      <button
                        key={studio.key}
                        onClick={() => setSelectedStudio(studio.key)}
                        className={`relative rounded-lg overflow-hidden border-2 transition-all text-left group ${
                          isSelected
                            ? "border-[#e63946] ring-2 ring-[#e63946]/20"
                            : "border-[#e8e8e8] hover:border-[#e63946]/40"
                        }`}
                      >
                        {/* Preview block */}
                        <div
                          className="aspect-[4/3] bg-cover bg-center"
                          style={{
                            backgroundImage: studio.preview_image_url
                              ? `url(${studio.preview_image_url})`
                              : "none",
                            backgroundColor: STUDIO_COLORS[studio.key] || "#e8e8e8",
                          }}
                        />
                        <div className="px-2 py-1.5 bg-white">
                          <p className="text-[11px] font-medium text-[#111111] truncate leading-tight">
                            {studioLabel(studio.key)}
                          </p>
                        </div>
                        {/* Checkmark badge */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-[#e63946] rounded-full flex items-center justify-center shadow">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ─ STEP 2: Photo Guide ─ */}
            <section className="bg-white rounded-xl border border-[#e8e8e8] p-5">
              <div className="mb-4">
                <span className="text-xs font-bold text-[#e63946] uppercase tracking-wider">Step 2</span>
                <h2 className="text-base font-bold text-[#111111] mt-1">{rt("step2.heading")}</h2>
                <p className="text-sm text-[#888888] mt-0.5">{rt("step2.subtitle")}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                  <div key={key} className="flex items-start gap-2 bg-[#f5f5f7] rounded-lg p-3">
                    <span className="text-base flex-shrink-0">{emoji}</span>
                    <p className="text-xs text-[#111111] leading-snug">{rt(`step2.tips.${key}`)}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ─ STEP 3: Good vs Bad Examples ─ */}
            <section className="bg-white rounded-xl border border-[#e8e8e8] p-5">
              <div className="mb-4">
                <span className="text-xs font-bold text-[#e63946] uppercase tracking-wider">Step 3</span>
                <h2 className="text-base font-bold text-[#111111] mt-1">{rt("step3.heading")}</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Good */}
                <div>
                  <p className="text-xs font-semibold text-emerald-600 mb-2">✅ {rt("step3.good")}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="aspect-square rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5M3.75 3h16.5" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Bad */}
                <div>
                  <p className="text-xs font-semibold text-[#e63946] mb-2">❌ {rt("step3.bad")}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["Too dark", "Cropped", "Cluttered"].map((label) => (
                      <div key={label} className="aspect-square rounded-md bg-red-50 border border-red-200 flex flex-col items-center justify-center gap-1 p-1">
                        <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-[9px] text-red-500 text-center leading-tight">{label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#888888] mt-1.5">{rt("step3.badLabels")}</p>
                </div>
              </div>
            </section>

            {/* ─ STEP 4: Upload ─ */}
            <section className="bg-white rounded-xl border border-[#e8e8e8] p-5">
              <div className="mb-4">
                <span className="text-xs font-bold text-[#e63946] uppercase tracking-wider">Step 4</span>
                <h2 className="text-base font-bold text-[#111111] mt-1">{rt("step4.heading")}</h2>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
              />

              <div className="grid grid-cols-2 gap-4">
                {/* Device upload zone */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setUploadHover("device"); }}
                  onDragLeave={() => setUploadHover(null)}
                  onDrop={(e) => handleDrop(e, "device")}
                  onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                  className={`rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                    uploadHover === "device" || previewUrl
                      ? "border-[#e63946] bg-red-50"
                      : "border-[#e8e8e8] bg-[#f5f5f7] hover:border-[#e63946] hover:bg-red-50"
                  }`}
                >
                  {previewUrl ? (
                    <div className="w-full">
                      <Image
                        src={previewUrl}
                        alt="Preview"
                        width={200}
                        height={120}
                        className="rounded-lg object-cover w-full max-h-28"
                        unoptimized
                      />
                      <p className="text-[10px] text-[#888888] text-center mt-2 truncate">{file?.name}</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-white border border-[#e8e8e8] flex items-center justify-center">
                        <svg className="w-5 h-5 text-[#888888]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-[#111111]">📤 {rt("step4.deviceZone.title")}</p>
                        <p className="text-[11px] text-[#888888] mt-0.5">{rt("step4.deviceZone.hint")}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Camera zone */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setUseGuidedCapture(true)}
                  onKeyDown={(e) => e.key === "Enter" && setUseGuidedCapture(true)}
                  className={`rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                    uploadHover === "camera"
                      ? "border-[#e63946] bg-red-50"
                      : "border-[#e8e8e8] bg-[#f5f5f7] hover:border-[#e63946] hover:bg-red-50"
                  }`}
                  onMouseEnter={() => setUploadHover("camera")}
                  onMouseLeave={() => setUploadHover(null)}
                >
                  <div className="w-10 h-10 rounded-full bg-white border border-[#e8e8e8] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#888888]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-[#111111]">📷 {rt("step4.cameraZone.title")}</p>
                    <p className="text-[11px] text-[#888888] mt-0.5">{rt("step4.cameraZone.hint")}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ─ STEP 5: CTA ─ */}
            <section className="bg-white rounded-xl border border-[#e8e8e8] p-5">
              <div className="mb-4">
                <span className="text-xs font-bold text-[#e63946] uppercase tracking-wider">Step 5</span>
              </div>

              {/* Enhancement toggles */}
              <div className="flex flex-wrap gap-4 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enhanceWheels}
                    onChange={(e) => setEnhanceWheels(e.target.checked)}
                    className="w-4 h-4 rounded border-[#e8e8e8] accent-[#e63946]"
                  />
                  <span className="text-xs text-[#111111]">{rt("options.enhanceWheels")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enhancePaint}
                    onChange={(e) => setEnhancePaint(e.target.checked)}
                    className="w-4 h-4 rounded border-[#e8e8e8] accent-[#e63946]"
                  />
                  <span className="text-xs text-[#111111]">{rt("options.enhancePaint")}</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#888888]">{rt("options.quality")}:</span>
                  {(["hd", "4k"] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => setExportQuality(q)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        exportQuality === q
                          ? "bg-[#e63946] text-white"
                          : "bg-[#f5f5f7] text-[#888888] hover:bg-[#e8e8e8]"
                      }`}
                    >
                      {q.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Process button */}
              <button
                onClick={handleGenerate}
                disabled={!canProcess}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  canProcess
                    ? "bg-[#e63946] hover:bg-red-700 text-white shadow-lg shadow-red-500/25"
                    : "bg-[#e8e8e8] text-[#888888] cursor-not-allowed"
                }`}
              >
                {processing ? (
                  <>
                    <Spinner size="sm" className="text-white" />
                    {batchLabel ?? t(`generate.status.${processingStatus}`)}
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    {rt("step5.cta")} →
                  </>
                )}
              </button>

              {/* Context line below button */}
              <p className="text-[11px] text-[#888888] text-center mt-2">
                {canProcess
                  ? rt("step5.ctaInfo", { studio: studioLabel(selectedStudio) })
                  : rt("step5.ctaSelectBoth")}
              </p>

              {/* Result */}
              {resultImage && (
                <div className="mt-5 border-t border-[#e8e8e8] pt-5">
                  <p className="text-xs font-semibold text-emerald-600 mb-3">✓ {rt("step5.result")}</p>
                  <div className="relative rounded-xl overflow-hidden border border-[#e8e8e8]">
                    <Image
                      src={resultImage}
                      alt="Result"
                      width={800}
                      height={500}
                      className="w-full object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="flex gap-3 mt-3">
                    <button
                      onClick={handleDownload}
                      className="flex-1 py-2.5 rounded-lg bg-[#e63946] text-white text-sm font-semibold hover:bg-red-700 transition-colors"
                    >
                      {rt("step5.download")}
                    </button>
                    <button
                      onClick={() => { setResultImage(null); setFile(null); setPreviewUrl(null); setProcessingStatus("idle"); }}
                      className="flex-1 py-2.5 rounded-lg bg-[#f5f5f7] text-[#111111] text-sm font-semibold hover:bg-[#e8e8e8] transition-colors border border-[#e8e8e8]"
                    >
                      {rt("step5.newGeneration")}
                    </button>
                  </div>
                </div>
              )}
            </section>

          </div>
        </main>

        {/* ── RIGHT PANEL ── */}
        <div className="hidden lg:flex">
          <RightPanel
            projects={projects}
            usage={account?.usage ?? null}
            planName={account?.subscription?.plan_name ?? "Free"}
            studioLabel={studioLabel}
          />
        </div>

      </div>

      {/* Guided Capture Modal */}
      {useGuidedCapture && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden">
            <button
              onClick={() => { setUseGuidedCapture(false); }}
              className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="h-[70vh]">
              <GuidedCapture
                onCaptureComplete={(images) => {
                  setUseGuidedCapture(false);
                  if (images.length > 0) {
                    const last = blobToFile(images[images.length - 1].blob, `photo_step${images[images.length - 1].stepIndex + 1}.jpg`);
                    setFile(last);
                    setPreviewUrl(URL.createObjectURL(last));
                    handleGenerateAll(images);
                  }
                }}
                onCancel={() => setUseGuidedCapture(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
