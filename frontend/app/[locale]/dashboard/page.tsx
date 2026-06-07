"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import DragDropUpload from "@/components/DragDropUpload";
import GuidedCapture from "@/components/GuidedCapture";
import { useAuth, authFetch, getAuthHeaders } from "@/context/AuthContext";
import Spinner from "@/components/ui/Spinner";

interface Project {
  id: string;
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

export default function Dashboard() {
  const t = useTranslations("dashboard");
  const commonT = useTranslations("common");
  const notificationT = useTranslations("notifications");
  const locale = useLocale();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [studios, setStudios] = useState<Studio[]>([]);
  const [selectedStudio, setSelectedStudio] =
    useState<string>("white_corner_light_epoxy");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [useGuidedCapture, setUseGuidedCapture] = useState(false);
  const [capturedImages, setCapturedImages] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [enhanceWheels, setEnhanceWheels] = useState(true);
  const [enhancePaint, setEnhancePaint] = useState(true);
  const [exportQuality, setExportQuality] = useState<"hd" | "4k">("hd");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingStatus, setProcessingStatus] = useState<string>("idle");
  const [batchLabel, setBatchLabel] = useState<string | null>(null);
  const resultBlobUrlRef = useRef<string | null>(null);

  // Revoke blob URL on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (resultBlobUrlRef.current) {
        URL.revokeObjectURL(resultBlobUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;

    const loadData = async () => {
      try {
        const studiosRes = await fetch("/api/studio");
        const projectsRes = await authFetch("/api/projects");

        if (!studiosRes.ok || !projectsRes.ok) {
          throw new Error(`API error: studios=${studiosRes.status}, projects=${projectsRes.status}`);
        }

        const studiosData = await studiosRes.json();
        const projectsData = await projectsRes.json();
        setStudios(studiosData);
        setProjects(projectsData);
        setApiError(null);
      } catch (error) {
        console.error("Failed to load data:", error);
        setApiError(notificationT("generationError"));
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [authLoading, isAuthenticated, notificationT]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  // Helper function to convert blob to File for processing
  const blobToFile = (blob: Blob, fileName: string): File => {
    const type = blob.type || 'image/jpeg';
    return new File([blob], fileName, { type });
  };

  const handleDragDropFiles = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      const url = URL.createObjectURL(files[0]);
      setPreviewUrl(url);
    }
  };

  const handleCapturedImage = (blob: Blob) => {
    const file = blobToFile(blob, `captured_${Date.now()}.jpg`);
    setFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const statusSteps = ["uploading", "preparing", "applying", "finalizing"] as const;

  const handleGenerate = async () => {
    if (!file) return;
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
    const statusInterval = setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, statusSteps.length - 1);
      setProcessingStatus(statusSteps[stepIndex]);
    }, 3000);

    try {
      const authHeaders = getAuthHeaders();
      const response = await fetch("/api/studio/process", {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Processing failed");
      }

      const blob = await response.blob();
      if (resultBlobUrlRef.current) URL.revokeObjectURL(resultBlobUrlRef.current);
      const imageUrl = URL.createObjectURL(blob);
      resultBlobUrlRef.current = imageUrl;
      setResultImage(imageUrl);

      const newProject: Project = {
        id: Date.now().toString(),
        name: file.name,
        background: selectedStudio,
        result_image: imageUrl,
      };
      setProjects((prev) => [newProject, ...prev]);
      setProcessingStatus("completed");
    } catch (error: any) {
      console.error("Processing failed:", error);
      const errorMessage = error.message || notificationT("generationError");
      setApiError(errorMessage);
      setProcessingStatus("idle");
    } finally {
      clearInterval(statusInterval);
      setProcessing(false);
    }
  };

  const handleGenerateAll = async (images: { blob: Blob; stepIndex: number }[]) => {
    if (images.length === 0) return;
    setProcessing(true);
    setResultImage(null);
    setApiError(null);

    for (let i = 0; i < images.length; i++) {
      setBatchLabel(`Processing photo ${i + 1} of ${images.length}…`);

      const imageFile = blobToFile(
        images[i].blob,
        `photo_step${images[i].stepIndex + 1}_${Date.now()}.jpg`
      );
      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("studio_key", selectedStudio);
      formData.append("enhance_wheels", enhanceWheels.toString());
      formData.append("enhance_paint", enhancePaint.toString());
      formData.append("export_quality", exportQuality);

      try {
        const authHeaders = getAuthHeaders();
        const response = await fetch("/api/studio/process", {
          method: "POST",
          headers: authHeaders,
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`Photo ${i + 1} failed:`, errorData.detail);
          continue;
        }

        const blob = await response.blob();
        if (resultBlobUrlRef.current) URL.revokeObjectURL(resultBlobUrlRef.current);
        const imageUrl = URL.createObjectURL(blob);
        resultBlobUrlRef.current = imageUrl;
        setResultImage(imageUrl);

        const angleNames = ["Front Left 45°", "Side View", "Rear Left 45°", "Rear/Front View"];
        const newProject: Project = {
          id: `${Date.now()}-${i}`,
          name: angleNames[images[i].stepIndex] ?? `Photo ${i + 1}`,
          background: selectedStudio,
          result_image: imageUrl,
        };
        setProjects((prev) => [newProject, ...prev]);
      } catch (error) {
        console.error(`Photo ${i + 1} processing error:`, error);
      }
    }

    setBatchLabel(null);
    setProcessing(false);
    setProcessingStatus("completed");
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const link = document.createElement("a");
    link.href = resultImage;
    link.download = `autostudio_${selectedStudio}_${exportQuality}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-warm-cream flex items-center justify-center">
        <div className="text-charcoal-400">
          <Spinner size="lg" className="mx-auto mb-3" />
          <p>{commonT("loading")}</p>
        </div>
      </main>
    );
  }

  const studioTranslations: Record<string, string> = {
    white_corner_light_epoxy: t("studio.studios.white_corner_light_epoxy"),
    white_corner_ceramic_tile: t("studio.studios.white_corner_ceramic_tile"),
    light_gray_corner_medium_epoxy: t("studio.studios.light_gray_corner_medium_epoxy"),
    dark_gray_corner_concrete: t("studio.studios.dark_gray_corner_concrete"),
    black_corner_dark_epoxy: t("studio.studios.black_corner_dark_epoxy"),
    commercial_showroom_tile: t("studio.studios.commercial_showroom_tile"),
    industrial_concrete: t("studio.studios.industrial_concrete"),
    matte_black_automotive: t("studio.studios.matte_black_automotive"),
  };

  return (
    <main className="min-h-screen bg-warm-cream">
      {/* Dashboard Navigation */}
      <nav className="bg-white border-b border-charcoal-200/50 sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link href={`/${locale}`} className="flex items-center gap-0">
                <span className="text-xl font-bold tracking-tight text-charcoal-900">Auto</span>
                <span className="text-xl font-bold tracking-tight text-red-500">Studio</span>
              </Link>
              <div className="hidden sm:flex items-center gap-1">
                <Link
                  href={`/${locale}/dashboard`}
                  className="text-sm font-medium text-white bg-red-500 hover:bg-red-600 px-4 py-1.5 rounded-full transition-colors"
                >
                  {t("navigation.projects")}
                </Link>
                <Link
                  href={`/${locale}/dashboard/billing`}
                  className="text-sm font-medium text-charcoal-500 hover:text-red-500 px-4 py-1.5 rounded-full transition-colors"
                >
                  {t("navigation.billing")}
                </Link>
                <Link
                  href={`/${locale}/dashboard/settings`}
                  className="text-sm font-medium text-charcoal-500 hover:text-red-500 px-4 py-1.5 rounded-full transition-colors"
                >
                  {t("navigation.settings")}
                </Link>
                <Link
                  href={`/${locale}/dashboard/account`}
                  className="text-sm font-medium text-charcoal-500 hover:text-red-500 px-4 py-1.5 rounded-full transition-colors"
                >
                  {t("navigation.account")}
                </Link>
                {user?.role === "ADMIN" && (
                  <Link
                    href={`/${locale}/admin/dashboard`}
                    className="text-sm font-medium text-accent-coral hover:text-accent-terracotta px-4 py-1.5 rounded-full transition-colors"
                  >
                    Admin
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              {user && (
                <span className="hidden md:block text-sm text-charcoal-400">
                  {user.email}
                </span>
              )}
              <button
                onClick={logout}
                className="text-sm text-charcoal-400 hover:text-red-500 transition-colors"
              >
                {t("navigation.logout")}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-charcoal-900 tracking-[-0.02em] mb-1">
            {t("title")}
          </h1>
          <p className="text-charcoal-500">{t("subtitle")}</p>
        </header>

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
          {/* Upload Card */}
          <div className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-card hover:shadow-card-hover transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-charcoal-900 mb-1">{t("cards.uploadPhoto.title")}</h3>
            <p className="text-xs text-charcoal-400 leading-relaxed">{t("cards.uploadPhoto.description")}</p>
          </div>

          {/* Interior Photos Card */}
          <div className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-card hover:shadow-card-hover transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-charcoal-900 mb-1">{t("interiorPhotos.title")}</h3>
            <p className="text-xs text-charcoal-400 leading-relaxed">{t("interiorPhotos.description")}</p>
            <p className="text-xs text-charcoal-500 mt-2 italic">{t("interiorPhotos.examples")}</p>
          </div>

          {/* Select Studio Card */}
          <div className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-card hover:shadow-card-hover transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-warm-beige/60 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-accent-terracotta" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-charcoal-900 mb-1">{t("cards.selectStudio.title")}</h3>
            <p className="text-xs text-charcoal-400 leading-relaxed">{t("cards.selectStudio.description")}</p>
          </div>

          {/* Recent Projects Card */}
          <div className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-card hover:shadow-card-hover transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-accent-coral" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-charcoal-900 mb-1">{t("cards.recentProjects.title")}</h3>
            <p className="text-xs text-charcoal-400 leading-relaxed">
              {projects.length > 0
                ? `${projects.length} ${t("cards.recentProjects.title").toLowerCase()}`
                : t("cards.recentProjects.noProjects")}
            </p>
          </div>

          {/* Subscription Card */}
          <div className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-card hover:shadow-card-hover transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-warm-cream flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-accent-gold" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-charcoal-900 mb-1">{t("cards.subscription.title")}</h3>
            <p className="text-xs text-charcoal-400 leading-relaxed">{t("cards.subscription.freePlan")}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-charcoal-400">
              <Spinner size="lg" className="mx-auto mb-3" />
              <p>{commonT("loading")}</p>
            </div>
          </div>
        ) : apiError ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-red-600 font-medium">API Connection Error</h3>
                <p className="text-red-500 text-sm mt-1">{apiError}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload & Studio Selection */}
            <div className="lg:col-span-1 space-y-5">
              {/* Smart Photo Guide Section - Only show when not capturing */}
              {!useGuidedCapture && (
                <div className="mb-6">
                  <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-6 text-white">
                    <div className="flex items-center gap-3 mb-3">
                      <svg className="w-6 h-6 text-red-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <h2 className="text-lg font-bold">{t("smartPhotoGuide.title")}</h2>
                    </div>
                    <p className="text-red-50 text-sm leading-relaxed mb-4">
                      {t("smartPhotoGuide.description")}
                    </p>
                    <button
                      onClick={() => setUseGuidedCapture(true)}
                      className="bg-white text-red-600 px-6 py-2.5 rounded-xl font-semibold hover:bg-red-50 transition-colors shadow-lg text-sm"
                    >
                      {t("smartPhotoGuide.startGuidedCapture")}
                    </button>
                    <p className="text-xs text-red-100 mt-3">
                      {t("smartPhotoGuide.useExistingUpload")}
                    </p>
                  </div>
                </div>
              )}

              {/* Guided Capture Modal */}
              {useGuidedCapture && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                  <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden">
                    <button
                      onClick={() => {
                        setUseGuidedCapture(false);
                        setCapturedImages([]);
                      }}
                      className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="h-[60vh]">
                      <GuidedCapture
                        onCaptureComplete={(images) => {
                          setCapturedImages(images);
                          setUseGuidedCapture(false);
                          if (images.length > 0) {
                            // Show preview of last captured image in the upload form
                            const lastFile = blobToFile(
                              images[images.length - 1].blob,
                              `photo_step${images[images.length - 1].stepIndex + 1}.jpg`
                            );
                            setFile(lastFile);
                            setPreviewUrl(URL.createObjectURL(lastFile));
                            // Auto-process all captured images
                            handleGenerateAll(images);
                          }
                        }}
                        onCancel={() => {
                          setUseGuidedCapture(false);
                          setCapturedImages([]);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Section with Drag & Drop */}
              {!useGuidedCapture && (
                <div className="bg-white rounded-2xl border border-black/[0.06] p-6 shadow-card">
                  <h2 className="text-base font-semibold text-charcoal-900 mb-4">
                    {t("upload.title")}
                  </h2>
                  <DragDropUpload
                    onFilesSelected={handleDragDropFiles}
                    previewUrl={previewUrl}
                    t={t}
                  />
                </div>
              )}
            </div>

            {/* Studio Selection */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-black/[0.06] p-6 shadow-card h-full">
                <h2 className="text-base font-semibold text-charcoal-900 mb-4">
                  {t("studio.title")}
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {studios.map((studio) => (
                    <button
                      key={studio.key}
                      onClick={() => setSelectedStudio(studio.key)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all group ${
                        selectedStudio === studio.key
                          ? "border-red-500 ring-2 ring-red-500/20"
                          : "border-charcoal-200/50 hover:border-charcoal-300"
                      }`}
                    >
                      <div className="aspect-[4/3] bg-warm-cream relative overflow-hidden">
                        <div
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                          style={{
                            backgroundImage: `url(${studio.preview_image_url})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                          onError={(e) => {
                            const target = e.currentTarget as HTMLElement;
                            target.style.backgroundImage = "linear-gradient(135deg, #F7F4EF 0%, #E5E0DA 100%)";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                      </div>
                      <div className="p-2.5 bg-white">
                        <div className="text-xs font-medium text-charcoal-900 truncate">
                          {studioTranslations[studio.key] || studio.name}
                        </div>
                      </div>
                      {selectedStudio === studio.key && (
                        <div className="absolute top-2 right-2 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white shadow-sm" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Options */}
                <div className="mt-6 space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enhanceWheels}
                      onChange={(e) => setEnhanceWheels(e.target.checked)}
                      className="w-4 h-4 rounded border-charcoal-300 text-red-500 focus:ring-red-500"
                    />
                    <span className="text-sm text-charcoal-600">
                      {t("options.enhanceWheels")}
                    </span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enhancePaint}
                      onChange={(e) => setEnhancePaint(e.target.checked)}
                      className="w-4 h-4 rounded border-charcoal-300 text-red-500 focus:ring-red-500"
                    />
                    <span className="text-sm text-charcoal-600">
                      {t("options.enhancePaint")}
                    </span>
                  </label>
                  <div>
                    <span className="text-sm text-charcoal-600 block mb-2">
                      {t("options.exportQuality")}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setExportQuality("hd")}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          exportQuality === "hd"
                            ? "bg-red-500 text-white"
                            : "bg-warm-cream text-charcoal-600 hover:bg-warm-beige"
                        }`}
                      >
                        {t("options.hd")}
                      </button>
                      <button
                        onClick={() => setExportQuality("4k")}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          exportQuality === "4k"
                            ? "bg-red-500 text-white"
                            : "bg-warm-cream text-charcoal-600 hover:bg-warm-beige"
                        }`}
                      >
                        {t("options.fourK")}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={!file || processing}
                  className={`w-full mt-6 py-3.5 rounded-xl font-semibold text-base transition-all ${
                    !file || processing
                      ? "bg-charcoal-200 text-charcoal-400 cursor-not-allowed"
                      : "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/30"
                  }`}
                >
                  {processing ? (
                    <span className="flex items-center justify-center">
                      <Spinner size="md" className="-ml-1 mr-3 text-white" />
                      {batchLabel ?? t(`generate.status.${processingStatus}`)}
                    </span>
                  ) : (
                    t("generate.button")
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recent Projects */}
        {!isLoading && !apiError && projects.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-charcoal-900 mb-5">
              {t("projects.title")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-white rounded-2xl overflow-hidden border border-black/[0.06] shadow-card hover:shadow-card-hover transition-shadow"
                >
                  {project.result_image ? (
                    <div className="relative aspect-video">
                      <Image
                        src={project.result_image}
                        alt={project.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-warm-cream flex items-center justify-center">
                      <span className="text-charcoal-300 text-sm">
                        {t("projects.noPreview")}
                      </span>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-charcoal-900 font-medium truncate text-sm">
                      {project.name}
                    </h3>
                    <p className="text-charcoal-400 text-xs mt-1">
                      {t("projects.studio")}: {studioTranslations[project.background] || project.background}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}