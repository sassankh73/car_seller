"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function SettingsPage() {
  const t = useTranslations("branding");
  const profileT = useTranslations("profile");
  const notificationT = useTranslations("notifications");
  const dashboardT = useTranslations("dashboard");
  const commonT = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock user data - replace with actual auth context
  const [user, setUser] = useState({
    name: "John Doe",
    email: "john@example.com",
    company: "Auto Dealership AB",
    phone: "+46 70 123 45 67",
    plan: "free", // free, basic, professional, enterprise
    logo: null as string | null,
    logoPlacement: "bottomRight" as string,
  });

  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    const validTypes = ["image/png", "image/jpeg", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      alert("Only PNG, JPG, and SVG files are supported");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
      setUser({ ...user, logo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setUser({ ...user, logo: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    // TODO: Replace with actual API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
    alert(notificationT("profileUpdateSuccess"));
  };

  const placementOptions = [
    { value: "bottomRight", label: t("logoPlacement.bottomRight") },
    { value: "bottomLeft", label: t("logoPlacement.bottomLeft") },
    { value: "topRight", label: t("logoPlacement.topRight") },
    { value: "topLeft", label: t("logoPlacement.topLeft") },
    { value: "center", label: t("logoPlacement.center") },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <nav className="border-b border-gray-700 bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link
                href={`/${locale}`}
                className="text-xl font-bold text-white"
              >
                AutoStudio AI
              </Link>
              <Link
                href={`/${locale}/dashboard`}
                className="text-gray-400 hover:text-white transition"
              >
                Dashboard
              </Link>
              <Link
                href={`/${locale}/dashboard/billing`}
                className="text-gray-400 hover:text-white transition"
              >
                {dashboardT("billing")}
              </Link>
              <Link
                href={`/${locale}/dashboard/settings`}
                className="text-white font-medium transition"
              >
                {dashboardT("settings")}
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
              <Link
                href={`/${locale}`}
                className="text-indigo-400 hover:text-indigo-300 transition text-sm"
              >
                ← {commonT("backToHome")}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Branding Section */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">
                {t("title")}
              </h2>
              <p className="text-gray-400">{t("description")}</p>
            </div>

            {/* Plan Badge */}
            <div className="mb-6">
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-700 text-gray-300">
                {t("currentPlan")}:{" "}
                <span className="ml-2 capitalize">{user.plan}</span>
              </div>
            </div>

            {user.plan === "free" && (
              <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500 rounded-lg">
                <p className="text-indigo-300 text-sm">
                  {t("freeUserWarning")}
                </p>
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
              <h3 className="text-lg font-semibold text-white mb-4">
                {t("logoUpload.title")}
              </h3>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Upload Area */}
                <div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-indigo-500 transition cursor-pointer"
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveLogo();
                          }}
                          className="text-sm text-red-400 hover:text-red-300"
                        >
                          {t("logoUpload.removeButton")}
                        </button>
                      </div>
                    ) : (
                      <div className="text-gray-400">
                        <svg
                          className="w-12 h-12 mx-auto mb-3"
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
                        <p className="text-sm">
                          {t("logoUpload.uploadButton")}
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
                    disabled={user.plan === "free"}
                  />

                  <div className="mt-3 text-xs text-gray-500">
                    <p>{t("logoUpload.supportedFormats")}</p>
                    <p>{t("logoUpload.recommendedSize")}</p>
                  </div>
                </div>

                {/* Logo Placement */}
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-3">
                    {t("logoPlacement.title")}
                  </h4>
                  <div className="space-y-2">
                    {placementOptions.map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center space-x-3 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="logoPlacement"
                          value={option.value}
                          checked={user.logoPlacement === option.value}
                          onChange={(e) =>
                            setUser({ ...user, logoPlacement: e.target.value })
                          }
                          className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 focus:ring-indigo-500"
                          disabled={user.plan === "free"}
                        />
                        <span className="text-gray-300 text-sm">
                          {option.label}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Preview Box */}
                  <div className="mt-4 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                    <p className="text-xs text-gray-400 mb-2">
                      {t("logoUpload.preview")}
                    </p>
                    <div className="relative w-full h-32 bg-gray-800 rounded border border-gray-600">
                      {logoPreview ? (
                        <Image
                          src={logoPreview}
                          alt="Placement preview"
                          width={60}
                          height={60}
                          className={`object-contain p-2 ${
                            user.logoPlacement === "bottomRight"
                              ? "absolute bottom-2 right-2"
                              : user.logoPlacement === "bottomLeft"
                                ? "absolute bottom-2 left-2"
                                : user.logoPlacement === "topRight"
                                  ? "absolute top-2 right-2"
                                  : user.logoPlacement === "topLeft"
                                    ? "absolute top-2 left-2"
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
                  <h3 className="text-lg font-semibold text-white mb-1">
                    {t("watermark.title")}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {t("watermark.description")}
                  </p>
                </div>
                {user.plan !== "free" && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                    ✓ Watermark Removed
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Profile Settings */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-2xl font-bold text-white mb-6">
              {profileT("title")}
            </h2>

            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {profileT("name")}
                  </label>
                  <input
                    type="text"
                    value={user.name}
                    onChange={(e) => setUser({ ...user, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {profileT("email")}
                  </label>
                  <input
                    type="email"
                    value={user.email}
                    onChange={(e) =>
                      setUser({ ...user, email: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {profileT("company")}
                  </label>
                  <input
                    type="text"
                    value={user.company}
                    onChange={(e) =>
                      setUser({ ...user, company: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {profileT("phone")}
                  </label>
                  <input
                    type="tel"
                    value={user.phone}
                    onChange={(e) =>
                      setUser({ ...user, phone: e.target.value })
                    }
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
