"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { authFetch, useAuth } from "@/context/AuthContext";
import Spinner from "@/components/ui/Spinner";

interface AccountData {
  profile: {
    id: number;
    email: string;
    name: string | null;
    role: string;
  };
  subscription: {
    plan_tier: string;
    plan_name: string;
    watermark: boolean;
    logo_branding: boolean;
  } | null;
  has_logo: boolean;
  logo_placement: string;
  logo_scale: number;
}

const PLACEMENT_TO_API: Record<string, string> = {
  bottomRight: "bottom_right",
  bottomLeft: "bottom_left",
  topRight: "top_right",
  topLeft: "top_left",
  center: "center",
};
const API_TO_PLACEMENT: Record<string, string> = Object.fromEntries(
  Object.entries(PLACEMENT_TO_API).map(([k, v]) => [v, k])
);

export default function SettingsPage() {
  const t = useTranslations("branding");
  const profileT = useTranslations("profile");
  const notificationT = useTranslations("notifications");
  const dashboardT = useTranslations("dashboard");
  const commonT = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { updateProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [account, setAccount] = useState<AccountData | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [logoPlacement, setLogoPlacement] = useState("bottomRight");
  const [logoScale, setLogoScale] = useState(0.12);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [accountLoading, setAccountLoading] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch("/api/auth/account")
      .then((r) => r.json())
      .then((data: AccountData) => {
        setAccount(data);
        setProfileName(data.profile.name || "");
        setProfileEmail(data.profile.email);
        setLogoPlacement(API_TO_PLACEMENT[data.logo_placement] || "bottomRight");
        setLogoScale(data.logo_scale || 0.12);
        if (data.has_logo) {
          setLogoPreview("/api/auth/profile/logo-preview");
        }
      })
      .catch(() => setError("Failed to load account data"))
      .finally(() => setAccountLoading(false));
  }, []);

  const canUseLogo = account?.subscription?.logo_branding === true;
  const hasWatermark = account?.subscription?.watermark !== false;
  const planTier = account?.subscription?.plan_tier || "free";
  const planName = account?.subscription?.plan_name || "Free";

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("File size must be less than 2 MB");
      return;
    }
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      alert("Only PNG, JPG, and SVG files are supported");
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);

    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await authFetch("/api/auth/profile/logo", {
        method: "PUT",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Upload failed");
      }
      const data = await res.json();
      setAccount((prev) => prev ? { ...prev, has_logo: data.has_logo } : prev);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Logo upload failed");
      setLogoPreview(null);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    try {
      await authFetch("/api/auth/profile/logo", { method: "DELETE" });
      setAccount((prev) => prev ? { ...prev, has_logo: false } : prev);
    } catch {
      // non-fatal
    }
  };

  const handlePlacementChange = async (placement: string) => {
    setLogoPlacement(placement);
    const apiPlacement = PLACEMENT_TO_API[placement] || "bottom_right";
    try {
      await authFetch(
        `/api/auth/profile/logo-settings?placement=${apiPlacement}&scale=${logoScale}`,
        { method: "PUT" }
      );
    } catch {
      // non-fatal
    }
  };

  const handleScaleChange = async (scale: number) => {
    setLogoScale(scale);
    const apiPlacement = PLACEMENT_TO_API[logoPlacement] || "bottom_right";
    try {
      await authFetch(
        `/api/auth/profile/logo-settings?placement=${apiPlacement}&scale=${scale}`,
        { method: "PUT" }
      );
    } catch {
      // non-fatal
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await updateProfile(profileName, profileEmail);
      if (!result.success) throw new Error(result.detail || "Failed to save");
      // Update local account state so the page reflects the new name/email immediately
      if (result.user) {
        setAccount((prev) => prev ? { ...prev, profile: { ...prev.profile, name: result.user!.name || "", email: result.user!.email } } : prev);
      }
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const placementOptions = [
    { value: "bottomRight", label: t("logoPlacement.bottomRight") },
    { value: "bottomLeft", label: t("logoPlacement.bottomLeft") },
    { value: "topRight", label: t("logoPlacement.topRight") },
    { value: "topLeft", label: t("logoPlacement.topLeft") },
    { value: "center", label: t("logoPlacement.center") },
  ];

  if (accountLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-center">
          <Spinner size="lg" className="mx-auto mb-3" />
          <p>{commonT("loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <nav className="border-b border-gray-700 bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href={`/${locale}`} className="text-xl font-bold text-white">
                AutoStudio AI
              </Link>
              <Link href={`/${locale}/dashboard`} className="text-gray-400 hover:text-white transition">
                {dashboardT("navigation.projects")}
              </Link>
              <Link href={`/${locale}/dashboard/billing`} className="text-gray-400 hover:text-white transition">
                {dashboardT("navigation.billing")}
              </Link>
              <Link href={`/${locale}/dashboard/settings`} className="text-white font-medium transition border-b-2 border-indigo-400 pb-1">
                {dashboardT("navigation.settings")}
              </Link>
              <Link href={`/${locale}/dashboard/account`} className="text-gray-400 hover:text-white transition">
                {dashboardT("navigation.account")}
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
              <Link href={`/${locale}`} className="text-indigo-400 hover:text-indigo-300 transition text-sm">
                ← {commonT("backToHome")}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* Branding Section */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">{t("title")}</h2>
              <p className="text-gray-400">{t("description")}</p>
            </div>

            {/* Plan Badge */}
            <div className="mb-6">
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-700 text-gray-300">
                {t("currentPlan")}: <span className="ml-2 capitalize">{planName}</span>
              </div>
            </div>

            {!canUseLogo && (
              <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500 rounded-lg">
                <p className="text-indigo-300 text-sm">{t("freeUserWarning")}</p>
                <Link
                  href={`/${locale}/dashboard/billing`}
                  className="inline-block mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
                >
                  {t("upgradeToPro")}
                </Link>
              </div>
            )}

            {/* Logo Upload */}
            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-white mb-4">{t("logoUpload.title")}</h3>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Upload Area */}
                <div>
                  <div
                    onClick={() => canUseLogo && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
                      canUseLogo
                        ? "border-gray-600 hover:border-indigo-500 cursor-pointer"
                        : "border-gray-700 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    {logoPreview ? (
                      <div className="space-y-3">
                        <Image
                          src={logoPreview}
                          alt="Logo preview"
                          width={120}
                          height={120}
                          className="mx-auto object-contain bg-white rounded-lg p-2"
                        />
                        {canUseLogo && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                            className="text-sm text-red-400 hover:text-red-300"
                          >
                            {t("logoUpload.removeButton")}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-400">
                        <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">
                          {logoUploading ? "Uploading..." : t("logoUpload.uploadButton")}
                        </p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={!canUseLogo}
                  />
                  <div className="mt-3 text-xs text-gray-500">
                    <p>{t("logoUpload.supportedFormats")}</p>
                    <p>{t("logoUpload.recommendedSize")}</p>
                  </div>
                </div>

                {/* Logo Placement */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">{t("logoPlacement.title")}</h4>
                  <div className="space-y-2">
                    {placementOptions.map((option) => (
                      <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="logoPlacement"
                          value={option.value}
                          checked={logoPlacement === option.value}
                          onChange={(e) => handlePlacementChange(e.target.value)}
                          className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500"
                          disabled={!canUseLogo}
                        />
                        <span className="text-gray-300 text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Logo Scale Slider */}
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">{t("logoScale.title")}</h4>
                    <p className="text-xs text-gray-500 mb-3">{t("logoScale.description")}</p>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-gray-500 w-10">{t("logoScale.small")}</span>
                      <input
                        type="range"
                        min={0.05}
                        max={0.40}
                        step={0.01}
                        value={logoScale}
                        onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                        disabled={!canUseLogo}
                        className="flex-1 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className="text-xs text-gray-500 w-10 text-right">{t("logoScale.large")}</span>
                    </div>
                    <div className="mt-1 text-center text-xs text-gray-400">
                      {Math.round(logoScale * 100)}%
                    </div>
                  </div>

                  {/* Preview Box */}
                  <div className="mt-4 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-xs text-gray-400 mb-2">{t("logoUpload.preview")}</p>
                    <div className="relative w-full h-32 bg-gray-800 rounded border border-gray-600">
                      {logoPreview ? (
                        <Image
                          src={logoPreview}
                          alt="Placement preview"
                          width={60}
                          height={60}
                          className={`object-contain p-2 ${
                            logoPlacement === "bottomRight" ? "absolute bottom-2 right-2"
                            : logoPlacement === "bottomLeft" ? "absolute bottom-2 left-2"
                            : logoPlacement === "topRight" ? "absolute top-2 right-2"
                            : logoPlacement === "topLeft" ? "absolute top-2 left-2"
                            : "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                          }`}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">
                          Upload logo to preview placement
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Watermark Info */}
            <div className="border-t border-gray-700 mt-6 pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{t("watermark.title")}</h3>
                  <p className="text-gray-400 text-sm">{t("watermark.description")}</p>
                </div>
                {!hasWatermark ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                    ✓ Watermark Removed
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                    Watermark Active
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Profile Settings */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-2xl font-bold text-white mb-6">{profileT("title")}</h2>

            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{profileT("name")}</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">{profileT("email")}</label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className={`px-6 py-3 rounded-lg font-semibold transition ${
                  loading
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {loading ? "Saving..." : profileT("saveChanges")}
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
