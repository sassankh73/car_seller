"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth, authFetch } from "@/context/AuthContext";
import { formatLocaleDate } from "@/utils/formatLocale";

interface AccountData {
  profile: {
    id: number;
    email: string;
    name: string | null;
    role: string;
    is_active: boolean;
    is_disabled: boolean;
    created_at: string | null;
    last_login: string | null;
    password_changed_at: string | null;
  };
  subscription: {
    plan_tier: string | null;
    plan_name: string;
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
  } | null;
  usage: {
    generation_count: number;
    generations_limit: number;
    remaining: number;
    extra_studios_used: number;
    logo_branding_used: number;
    premium_ai_uses: number;
    four_k_exports: number;
  } | null;
  security: {
    last_login: string | null;
    password_changed_at: string | null;
    account_status: string;
    force_password_reset: boolean;
  };
}

export default function AccountPage() {
  const t = useTranslations("account");
  const commonT = useTranslations("common");
  const dashboardT = useTranslations("dashboard");
  const notifT = useTranslations("notifications");
  const { user, logout, changePasswordWithToken, updateProfile } = useAuth();
  const locale = useLocale();

  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile edit state
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password strength
  const getPasswordStrength = (pw: string) => {
    if (!pw) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2) return { score, label: t("passwordStrength.weak"), color: "text-red-400" };
    if (score <= 3) return { score, label: t("passwordStrength.medium"), color: "text-yellow-400" };
    return { score, label: t("passwordStrength.strong"), color: "text-green-400" };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  useEffect(() => {
    fetchAccountData();
  }, []);

  const fetchAccountData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/api/auth/account");
      if (response.ok) {
        const data = await response.json();
        setAccountData(data);
        setEditName(data.profile?.name || "");
        setEditEmail(data.profile?.email || "");
      } else {
        setError(t("errors.loadAccount"));
      }
    } catch {
      setError(t("errors.network"));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage(null);
    try {
      const result = await updateProfile(editName, editEmail);
      if (result.success) {
        setProfileMessage({ type: "success", text: t("profile.updateSuccess") });
        setIsEditingProfile(false);
        fetchAccountData();
      } else {
        setProfileMessage({ type: "error", text: result.detail || t("profile.updateError") });
      }
    } catch {
      setProfileMessage({ type: "error", text: t("errors.network") });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: t("password.mismatch") });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: t("password.tooShort") });
      return;
    }

    setPasswordSaving(true);
    try {
      const result = await changePasswordWithToken(currentPassword, newPassword, confirmPassword);
      if (result.success) {
        setPasswordMessage({ type: "success", text: t("password.changeSuccess") });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        // If the server requires re-login, force logout
        if (result.requireRelogin) {
          setTimeout(() => {
            logout();
          }, 2000);
        } else {
          fetchAccountData();
        }
      } else {
        setPasswordMessage({ type: "error", text: result.detail || t("password.changeError") });
      }
    } catch {
      setPasswordMessage({ type: "error", text: t("errors.network") });
    } finally {
      setPasswordSaving(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return t("never");
    try {
      return formatLocaleDate(locale, dateStr, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role?.toUpperCase()) {
      case "ADMIN":
        return { label: "Admin", classes: "bg-red-500/20 text-red-400 border-red-500/30" };
      case "PREMIUM":
        return { label: "Premium", classes: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" };
      default:
        return { label: "Free", classes: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
    }
  };

  const roleBadge = getRoleBadge(user?.role || "FREE");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Header */}
      <nav className="border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href={`/${locale}`} className="text-xl font-bold text-stone-900">
                AutoStudio AI
              </Link>
              <Link
                href={`/${locale}/dashboard`}
                className="text-stone-500 hover:text-stone-900 transition text-sm font-medium"
              >
                {dashboardT("navigation.projects")}
              </Link>
              <Link
                href={`/${locale}/dashboard/billing`}
                className="text-stone-500 hover:text-stone-900 transition text-sm font-medium"
              >
                {dashboardT("navigation.billing")}
              </Link>
              <Link
                href={`/${locale}/dashboard/settings`}
                className="text-stone-500 hover:text-stone-900 transition text-sm font-medium"
              >
                {dashboardT("navigation.settings")}
              </Link>
              <Link
                href={`/${locale}/dashboard/account`}
                className="text-stone-900 font-medium transition text-sm border-b-2 border-red-500 pb-1"
              >
                {dashboardT("navigation.account")}
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
              <button
                onClick={logout}
                className="text-stone-500 hover:text-stone-900 transition text-sm font-medium"
              >
                {dashboardT("navigation.logout")}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          {/* Page Title */}
          <div>
            <h1 className="text-3xl font-bold text-stone-900">{t("title")}</h1>
            <p className="text-stone-500 mt-1">{t("subtitle")}</p>
          </div>

          {/* Profile Section */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-stone-900">{t("profile.title")}</h2>
                <p className="text-sm text-stone-500 mt-0.5">{t("profile.subtitle")}</p>
              </div>
              {!isEditingProfile && (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                >
                  {t("profile.edit")}
                </button>
              )}
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-sm font-medium text-stone-500">{t("profile.name")}</label>
                {isEditingProfile ? (
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                ) : (
                  <div className="col-span-2 text-stone-900 font-medium">
                    {accountData?.profile?.name || "—"}
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-sm font-medium text-stone-500">{t("profile.email")}</label>
                {isEditingProfile ? (
                  <div className="col-span-2">
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                ) : (
                  <div className="col-span-2 text-stone-900">{accountData?.profile?.email || user?.email}</div>
                )}
              </div>

              {/* Role / Current Plan */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-sm font-medium text-stone-500">{t("profile.currentPlan")}</label>
                <div className="col-span-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${roleBadge.classes}`}>
                    {roleBadge.label}
                  </span>
                </div>
              </div>

              {/* Account Status */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-sm font-medium text-stone-500">{t("profile.accountStatus")}</label>
                <div className="col-span-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                    accountData?.security?.account_status === "active"
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"
                  }`}>
                    {accountData?.security?.account_status === "active" ? t("status.active") : t("status.disabled")}
                  </span>
                </div>
              </div>

              {/* Created At */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-sm font-medium text-stone-500">{t("profile.createdDate")}</label>
                <div className="col-span-2 text-stone-700 text-sm">
                  {formatDate(accountData?.profile?.created_at)}
                </div>
              </div>

              {profileMessage && (
                <div className={`p-3 rounded-lg text-sm ${
                  profileMessage.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {profileMessage.text}
                </div>
              )}

              {isEditingProfile && (
                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={profileSaving}
                    className={`px-5 py-2.5 rounded-lg font-medium text-sm transition ${
                      profileSaving
                        ? "bg-stone-300 text-stone-500 cursor-not-allowed"
                        : "bg-red-600 hover:bg-red-700 text-white"
                    }`}
                  >
                    {profileSaving ? t("profile.saving") : t("profile.save")}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingProfile(false);
                      setEditName(accountData?.profile?.name || "");
                      setEditEmail(accountData?.profile?.email || "");
                      setProfileMessage(null);
                    }}
                    className="px-5 py-2.5 rounded-lg font-medium text-sm text-stone-600 hover:text-stone-900 border border-stone-300 hover:border-stone-400 transition"
                  >
                    {commonT("cancel")}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Password Section */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-stone-100">
              <h2 className="text-xl font-semibold text-stone-900">{t("password.title")}</h2>
              <p className="text-sm text-stone-500 mt-0.5">{t("password.subtitle")}</p>
            </div>

            <form onSubmit={handleChangePassword} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-500 mb-1.5">{t("password.current")}</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-500 mb-1.5">{t("password.new")}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="••••••••"
                />
                {newPassword && (
                  <div className="mt-1.5 flex items-center space-x-2">
                    <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          passwordStrength.score <= 2 ? "bg-red-400" : passwordStrength.score <= 3 ? "bg-yellow-400" : "bg-green-400"
                        }`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium ${passwordStrength.color}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-500 mb-1.5">{t("password.confirm")}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-stone-300 rounded-lg text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="••••••••"
                />
                {confirmPassword && newPassword && confirmPassword !== newPassword && (
                  <p className="mt-1 text-xs text-red-500">{t("password.mismatch")}</p>
                )}
              </div>

              {passwordMessage && (
                <div className={`p-3 rounded-lg text-sm ${
                  passwordMessage.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {passwordMessage.text}
                </div>
              )}

              <button
                type="submit"
                disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                className={`px-5 py-2.5 rounded-lg font-medium text-sm transition ${
                  passwordSaving || !currentPassword || !newPassword || !confirmPassword
                    ? "bg-stone-300 text-stone-500 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {passwordSaving ? t("password.changing") : t("password.change")}
              </button>
            </form>
          </div>

          {/* Subscription / Package Section */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-stone-100">
              <h2 className="text-xl font-semibold text-stone-900">{t("subscription.title")}</h2>
              <p className="text-sm text-stone-500 mt-0.5">{t("subscription.subtitle")}</p>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Current Plan */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-sm font-medium text-stone-500">{t("subscription.plan")}</label>
                <div className="col-span-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${roleBadge.classes}`}>
                    {roleBadge.label}
                  </span>
                  {accountData?.subscription?.plan_tier && (
                    <span className="ml-2 text-sm text-stone-500">
                      ({accountData.subscription.plan_name})
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-sm font-medium text-stone-500">{t("subscription.status")}</label>
                <div className="col-span-2 text-stone-700 text-sm capitalize">
                  {accountData?.subscription?.status || "active"}
                </div>
              </div>

              {/* Usage */}
              {accountData?.usage && (
                <>
                  <div className="border-t border-stone-100 pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-stone-700 mb-3">{t("subscription.usage")}</h3>
                  </div>

                  <div className="grid grid-cols-3 gap-4 items-center">
                    <label className="text-sm text-stone-500">{t("subscription.generations")}</label>
                    <div className="col-span-2">
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 rounded-full transition-all"
                            style={{
                              width: accountData.usage.generations_limit > 0
                                ? `${Math.min(100, (accountData.usage.generation_count / accountData.usage.generations_limit) * 100)}%`
                                : "100%",
                            }}
                          />
                        </div>
                        <span className="text-sm text-stone-700 whitespace-nowrap">
                          {accountData.usage.generation_count}
                          {accountData.usage.generations_limit > 0
                            ? ` / ${accountData.usage.generations_limit}`
                            : ` (${t("subscription.unlimited")})`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 items-center">
                    <label className="text-sm text-stone-500">{t("subscription.remaining")}</label>
                    <div className="col-span-2 text-sm text-stone-700">
                      {accountData.usage.remaining === -1
                        ? t("subscription.unlimited")
                        : accountData.usage.remaining}
                    </div>
                  </div>
                </>
              )}

              {/* Upgrade CTA for Free users */}
              {user?.role === "FREE" && (
                <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-100">
                  <p className="text-sm text-stone-700 font-medium">{t("subscription.upgradePrompt")}</p>
                  <Link
                    href={`/${locale}/dashboard/billing`}
                    className="inline-block mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
                  >
                    {t("subscription.upgrade")}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Security Section */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-stone-100">
              <h2 className="text-xl font-semibold text-stone-900">{t("security.title")}</h2>
              <p className="text-sm text-stone-500 mt-0.5">{t("security.subtitle")}</p>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-sm font-medium text-stone-500">{t("security.lastLogin")}</label>
                <div className="col-span-2 text-stone-700 text-sm">
                  {formatDate(accountData?.security?.last_login)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-sm font-medium text-stone-500">{t("security.passwordChanged")}</label>
                <div className="col-span-2 text-stone-700 text-sm">
                  {formatDate(accountData?.security?.password_changed_at)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 items-center">
                <label className="text-sm font-medium text-stone-500">{t("security.accountStatus")}</label>
                <div className="col-span-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                    accountData?.security?.account_status === "active"
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"
                  }`}>
                    {accountData?.security?.account_status === "active" ? t("status.active") : t("status.disabled")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}