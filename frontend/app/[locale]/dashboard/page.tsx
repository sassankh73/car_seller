"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth, authFetch, getAuthHeaders } from "@/context/AuthContext";

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
  const [processing, setProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [enhanceWheels, setEnhanceWheels] = useState(true);
  const [enhancePaint, setEnhancePaint] = useState(true);
  const [exportQuality, setExportQuality] = useState<"hd" | "4k">("hd");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingStatus, setProcessingStatus] = useState<string>("idle");

  useEffect(() => {
    // Wait for auth to be ready
    if (authLoading) return;

    if (!isAuthenticated) {
      // AuthContext will handle redirect
      return;
    }

    const loadData = async () => {
      try {
        // Studios are public (no auth needed)
        const studiosRes = await fetch("/api/studio");
        // Projects require auth
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

  // Status message progression for processing states
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

    // Progress through status messages at timed intervals
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
      // Create preview URL from blob
      const imageUrl = URL.createObjectURL(blob);
      setResultImage(imageUrl);

      // Create a new project entry
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
      const errorMessage =
        error.message || notificationT("generationError");
      setApiError(errorMessage);
      setProcessingStatus("idle");
    } finally {
      clearInterval(statusInterval);
      setProcessing(false);
    }
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

  // Show loading while auth is being verified
  if (authLoading) {
    return (
      <main className="p-8 min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">
          <svg className="animate-spin h-8 w-8 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p>{commonT("loading")}</p>
        </div>
      </main>
    );
  }

  // Studio translations mapping - Automotive corner studios
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
    <main className="p-8 min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* Navigation */}
        <nav className="flex items-center justify-between mb-8 pb-6 border-b border-gray-700">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-white">
              {commonT("appName")}
            </h1>
            <Link
              href={`/${locale}/dashboard`}
              className="text-gray-400 hover:text-white transition"
            >
              {t("navigation.projects")}
            </Link>
            <Link
              href={`/${locale}/dashboard/billing`}
              className="text-gray-400 hover:text-white transition"
            >
              {t("navigation.billing")}
            </Link>
            {user?.role === "admin" && (
              <Link
                href={`/${locale}/admin/dashboard`}
                className="text-indigo-400 hover:text-indigo-300 transition"
              >
                Admin
              </Link>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            {user && (
              <span className="text-gray-400 text-sm">
                {user.email}
              </span>
            )}
            <button
              onClick={logout}
              className="text-red-400 hover:text-red-300 transition text-sm"
            >
              Logout
            </button>
            <Link
              href={`/${locale}`}
              className="text-indigo-400 hover:text-indigo-300 transition"
            >
              ← {commonT("backToHome")}
            </Link>
          </div>
        </nav>

        <header className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t("title")}</h1>
          <p className="text-gray-400">{t("subtitle")}</p>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400">
              <svg
                className="animate-spin h-8 w-8 mx-auto mb-3"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p>{commonT("loading")}</p>
            </div>
          </div>
        ) : apiError ? (
          <div className="bg-red-500/10 border border-red-500 rounded-xl p-4 mb-6">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-red-400 mt-0.5 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-red-400 font-medium">
                  API Connection Error
                </h3>
                <p className="text-red-300 text-sm mt-1">{apiError}</p>
                <p className="text-red-400 text-xs mt-2">
                  Make sure the backend server is running on port 8001
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Upload & Studio Selection */}
            <div className="lg:col-span-1 space-y-6">
              {/* Upload Section */}
              <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4">
                  {t("upload.title")}
                </h2>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-indigo-500 transition">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {previewUrl ? (
                      <Image
                        src={previewUrl}
                        alt="Preview"
                        width={200}
                        height={150}
                        className="rounded-lg mx-auto object-cover"
                      />
                    ) : (
                      <div className="text-gray-400">
                        <svg
                          className="w-12 h-12 mx-auto mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span>{t("upload.clickToUpload")}</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Studio Selection */}
              <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4">
                  {t("studio.title")}
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {studios.map((studio) => (
                    <button
                      key={studio.key}
                      onClick={() => setSelectedStudio(studio.key)}
                      className={`relative rounded-xl overflow-hidden border-2 transition group ${
                        selectedStudio === studio.key
                          ? "border-indigo-500 ring-2 ring-indigo-500/50"
                          : "border-gray-600 hover:border-gray-500"
                      }`}
                    >
                      {/* Preview Image with graceful fallback */}
                      <div className="aspect-[4/3] bg-gray-900 relative overflow-hidden">
                        <div
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                          style={{
                            backgroundImage: `url(${studio.preview_image_url})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                          onError={(e) => {
                            // Fallback when image fails to load
                            const target = e.currentTarget as HTMLElement;
                            target.style.backgroundImage =
                              "linear-gradient(135deg, #1f2937 0%, #374151 100%)";
                          }}
                        >
                          {/* Loading state placeholder */}
                          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                            Loading preview...
                          </div>
                        </div>
                        
                        {/* Overlay gradient for readability */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                      </div>
                      
                      {/* Studio info overlay */}
                      <div className="p-3 bg-gray-800">
                        <div className="text-sm font-medium text-white truncate">
                          {studioTranslations[studio.key] || studio.name}
                        </div>
                        <div className="text-xs text-gray-400 capitalize mt-0.5">
                          {studio.key.replace("_", " ")}
                        </div>
                      </div>
                      
                      {/* Selection indicator */}
                      {selectedStudio === studio.key && (
                        <div className="absolute top-2 right-2 w-3 h-3 bg-indigo-500 rounded-full border-2 border-gray-800 shadow-lg" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4">
                  {t("options.title")}
                </h2>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enhanceWheels}
                      onChange={(e) => setEnhanceWheels(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="text-gray-300">
                      {t("options.enhanceWheels")}
                    </span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enhancePaint}
                      onChange={(e) => setEnhancePaint(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="text-gray-300">
                      {t("options.enhancePaint")}
                    </span>
                  </label>
                  <div>
                    <span className="text-gray-300 block mb-2">
                      {t("options.exportQuality")}
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setExportQuality("hd")}
                        className={`px-3 py-1 rounded text-sm ${
                          exportQuality === "hd"
                            ? "bg-indigo-500 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                      >
                        {t("options.hd")}
                      </button>
                      <button
                        onClick={() => setExportQuality("4k")}
                        className={`px-3 py-1 rounded text-sm ${
                          exportQuality === "4k"
                            ? "bg-indigo-500 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                      >
                        {t("options.fourK")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!file || processing}
                className={`w-full py-4 rounded-xl font-semibold text-lg transition ${
                  !file || processing
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30"
                }`}
              >
                {processing ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t(`generate.status.${processingStatus}`)}
                  </span>
                ) : (
                  t("generate.button")
                )}
              </button>
            </div>

            {/* Preview & Results */}
            <div className="lg:col-span-2">
              <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 h-full">
                <h2 className="text-xl font-semibold text-white mb-4">
                  {t("preview.title")}
                </h2>

                {resultImage ? (
                  <div className="space-y-4">
                    <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                      <Image
                        src={resultImage}
                        alt="Generated result"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <div className="flex space-x-4">
                      <button
                        onClick={handleDownload}
                        className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
                      >
                        {t("preview.downloadImage")}
                      </button>
                      <button
                        onClick={() => setResultImage(null)}
                        className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
                      >
                        {t("preview.newGeneration")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-96 bg-gray-900 rounded-lg">
                    {previewUrl ? (
                      <div className="text-center">
                        <Image
                          src={previewUrl}
                          alt="Preview"
                          width={400}
                          height={300}
                          className="rounded-lg mx-auto mb-4 object-cover"
                        />
                        <p className="text-gray-400">
                          {t("preview.selectStudio")}
                        </p>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500">
                        <svg
                          className="w-16 h-16 mx-auto mb-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <p>{t("preview.uploadToStart")}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recent Projects */}
        {!isLoading && !apiError && projects.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold text-white mb-6">
              {t("projects.title")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700"
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
                    <div className="aspect-video bg-gray-700 flex items-center justify-center">
                      <span className="text-gray-500">
                        {t("projects.noPreview")}
                      </span>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-white font-medium truncate">
                      {project.name}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">
                      {t("projects.studio")}:{" "}
                      {studioTranslations[project.background] ||
                        project.background}
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