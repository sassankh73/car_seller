"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth, authFetch } from "@/context/AuthContext";
import Spinner from "@/components/ui/Spinner";
import { formatLocaleNumber, formatLocaleDate } from "@/utils/formatLocale";

interface DashboardStats {
  total_users: number;
  active_users: number;
  total_projects: number;
  total_revenue: number;
  revenue_last_30_days: number;
  revenue_last_7_days: number;
  recent_registrations: RecentRegistration[];
}

interface RecentRegistration {
  user_id: number;
  email: string;
  name: string | null;
  registered_at: string;
}

export default function AdminDashboard() {
  const t = useTranslations("admin");
  const commonT = useTranslations("common");
  const locale = useLocale();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== "ADMIN") return;

    const loadStats = async () => {
      try {
        const response = await authFetch("/api/admin/dashboard/stats");
        if (!response.ok) throw new Error("Failed to load stats");
        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (error: any) {
        console.error("Failed to load stats:", error);
        setError(error.message || t("errors.loadStats"));
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [authLoading, isAuthenticated, user, t]);

  // Auth guard
  if (authLoading) {
    return (
      <main className="p-8 min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">
          <Spinner size="lg" className="mx-auto mb-3" />
          <p>{commonT("loading")}</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || user?.role !== "ADMIN") {
    return (
      <main className="p-8 min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-6">You need admin privileges to access this page.</p>
          <Link href={`/${locale}/dashboard`} className="text-indigo-400 hover:text-indigo-300">
            ← Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="p-8 min-h-screen bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400">
              <Spinner size="lg" className="mx-auto mb-3" />
              <p>{commonT("loading")}</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-8 min-h-screen bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-500/10 border border-red-500 rounded-xl p-4 mb-6">
            <h3 className="text-red-400 font-medium">{t("errors.error")}</h3>
            <p className="text-red-300">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!stats) return null;

  return (
    <main className="p-8 min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* Navigation */}
        <nav className="flex items-center justify-between mb-8 pb-6 border-b border-gray-700">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-white">
              {commonT("appName")}
            </h1>
            <span className="text-purple-400 font-medium text-sm">ADMIN</span>
            <Link
              href={`/${locale}/admin/users`}
              className="text-gray-400 hover:text-white transition"
            >
              {t("users")}
            </Link>
            <Link
              href={`/${locale}/admin/editor-portal`}
              className="text-gray-400 hover:text-white transition"
            >
              Editor Portal
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            <span className="text-gray-400 text-sm">{user?.email}</span>
            <button onClick={logout} className="text-red-400 hover:text-red-300 transition text-sm">
              Logout
            </button>
            <Link
              href={`/${locale}/dashboard`}
              className="text-indigo-400 hover:text-indigo-300 transition"
            >
              ← {t("backToDashboard")}
            </Link>
          </div>
        </nav>

        <header className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t("title")}</h1>
          <p className="text-gray-400">{t("subtitle")}</p>
        </header>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-2">{t("stats.totalUsers")}</h3>
            <p className="text-4xl font-bold text-white">{stats.total_users}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-2">{t("stats.activeUsers")}</h3>
            <p className="text-4xl font-bold text-white">{stats.active_users}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-2">{t("stats.totalProjects")}</h3>
            <p className="text-4xl font-bold text-white">{stats.total_projects}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-2">{t("stats.totalRevenue")}</h3>
            <p className="text-4xl font-bold text-white">{formatLocaleNumber(locale, stats.total_revenue)} SEK</p>
          </div>
        </div>

        {/* Recent Registrations */}
        {stats.recent_registrations && stats.recent_registrations.length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">{t("recentRegistrations")}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {t("email")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {t("name")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {t("registeredAt")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {stats.recent_registrations.map((reg) => (
                    <tr key={reg.user_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {reg.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {reg.name || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {formatLocaleDate(locale, reg.registered_at, { year: "numeric", month: "long", day: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Revenue Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-4">{t("stats.revenueLast30Days")}</h3>
            <p className="text-3xl font-bold text-green-400">
              {formatLocaleNumber(locale, stats.revenue_last_30_days)} SEK
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <h3 className="text-gray-400 text-sm mb-4">{t("stats.revenueLast7Days")}</h3>
            <p className="text-3xl font-bold text-green-400">
              {formatLocaleNumber(locale, stats.revenue_last_7_days)} SEK
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}