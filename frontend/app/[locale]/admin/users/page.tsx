"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth, authFetch } from "@/context/AuthContext";

interface UserSearchResult {
  id: number;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  is_disabled: boolean;
  created_at: string;
  subscription_plan: string | null;
  project_count: number;
}

interface UserDetail {
  id: number;
  email: string;
  name: string | null;
  role: string;
  is_active: boolean;
  is_disabled: boolean;
  created_at: string;
  updated_at: string;
  project_count: number;
  subscription_plan: string | null;
}

export default function AdminUsers() {
  const t = useTranslations("admin");
  const commonT = useTranslations("common");
  const locale = useLocale();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchName, setSearchName] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [userToDisable, setUserToDisable] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== "admin") return;
    loadUsers();
  }, [authLoading, isAuthenticated, user]);

  const loadUsers = async () => {
    try {
      const params = new URLSearchParams();
      if (searchEmail) params.append("email", searchEmail);
      if (searchName) params.append("name", searchName);

      const response = await authFetch(`/api/admin/users/search?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load users");
      const data = await response.json();
      setUsers(data);
      setError(null);
    } catch (error: any) {
      console.error("Failed to load users:", error);
      setError(error.message || t("errors.loadUsers"));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers();
  };

  const handleViewUser = async (userId: number) => {
    try {
      const response = await authFetch(`/api/admin/users/${userId}`);
      if (!response.ok) throw new Error("Failed to load user details");
      const data = await response.json();
      setSelectedUser(data);
    } catch (error: any) {
      console.error("Failed to load user details:", error);
      setError(error.message || t("errors.loadUserDetails"));
    }
  };

  const handleDisableUser = async () => {
    if (userToDisable === null) return;
    try {
      const response = await authFetch(`/api/admin/users/${userToDisable}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disable: true }),
      });
      if (!response.ok) throw new Error("Failed to disable user");
      loadUsers();
      setSelectedUser(null);
      setShowDisableConfirm(false);
      setUserToDisable(null);
    } catch (error: any) {
      console.error("Failed to disable user:", error);
      setError(error.message || t("errors.disableUser"));
    }
  };

  const handleEnableUser = async () => {
    if (userToDisable === null) return;
    try {
      const response = await authFetch(`/api/admin/users/${userToDisable}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disable: false }),
      });
      if (!response.ok) throw new Error("Failed to enable user");
      loadUsers();
      setSelectedUser(null);
      setShowDisableConfirm(false);
      setUserToDisable(null);
    } catch (error: any) {
      console.error("Failed to enable user:", error);
      setError(error.message || t("errors.enableUser"));
    }
  };

  const handleViewProjects = async (userId: number) => {
    try {
      const response = await authFetch(`/api/admin/users/${userId}/projects`);
      if (!response.ok) throw new Error("Failed to load projects");
      const projects = await response.json();
      alert(
        projects.length > 0
          ? projects.map((p: any) => p.name).join(", ")
          : t("noProjects")
      );
    } catch (error: any) {
      console.error("Failed to load user projects:", error);
      setError(error.message || t("errors.loadProjects"));
    }
  };

  // Auth guard
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

  if (!isAuthenticated || user?.role !== "admin") {
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

  if (loading && users.length === 0) {
    return (
      <main className="p-8 min-h-screen bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400">
              <svg className="animate-spin h-8 w-8 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p>{commonT("loading")}</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

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
              href={`/${locale}/admin/dashboard`}
              className="text-gray-400 hover:text-white transition"
            >
              {t("dashboard")}
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
          <h1 className="text-4xl font-bold text-white mb-2">{t("users")}</h1>
          <p className="text-gray-400">{t("usersSubtitle")}</p>
        </header>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-6 bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                {t("searchEmail")}
              </label>
              <input
                type="text"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder={t("searchEmailPlaceholder")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                {t("searchName")}
              </label>
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder={t("searchNamePlaceholder")}
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition"
            >
              {t("search")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchEmail("");
                setSearchName("");
                loadUsers();
              }}
              className="ml-2 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
            >
              {t("clear")}
            </button>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-xl p-4 mb-6">
            <h3 className="text-red-400 font-medium">{t("errors.error")}</h3>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* User List */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
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
                    {t("role")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {t("status")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {t("projects")}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {t("actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                      {t("noUsersFound")}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-750">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {u.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {u.name || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full font-medium ${
                            u.role === "admin"
                              ? "bg-purple-500/20 text-purple-400"
                              : u.role === "premium"
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-gray-500/20 text-gray-400"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            u.is_active && !u.is_disabled
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {u.is_disabled
                            ? t("disabled")
                            : u.is_active
                            ? t("active")
                            : t("inactive")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {u.project_count}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleViewUser(u.id)}
                            className="text-indigo-400 hover:text-indigo-300"
                          >
                            {t("view")}
                          </button>
                          {u.role !== "admin" && (
                            <button
                              onClick={() => {
                                setUserToDisable(u.id);
                                setShowDisableConfirm(true);
                              }}
                              className={`${
                                u.is_disabled ? "text-green-400 hover:text-green-300" : "text-red-400 hover:text-red-300"
                              }`}
                            >
                              {u.is_disabled ? t("enable") : t("disable")}
                            </button>
                          )}
                          <button
                            onClick={() => handleViewProjects(u.id)}
                            className="text-gray-400 hover:text-gray-300"
                          >
                            {t("projects")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* User Detail Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">
                  {t("userDetails")}
                </h2>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400 text-sm">{t("email")}</span>
                    <p className="text-white">{selectedUser.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">{t("name")}</span>
                    <p className="text-white">{selectedUser.name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">{t("role")}</span>
                    <p className="text-white">{selectedUser.role}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">{t("status")}</span>
                    <p className="text-white">
                      {selectedUser.is_disabled ? t("disabled") : selectedUser.is_active ? t("active") : t("inactive")}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">{t("subscription")}</span>
                    <p className="text-white">{selectedUser.subscription_plan || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-sm">{t("projects")}</span>
                    <p className="text-white">{selectedUser.project_count}</p>
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">{t("createdAt")}</span>
                  <p className="text-gray-300 text-sm">{new Date(selectedUser.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">{t("updatedAt")}</span>
                  <p className="text-gray-300 text-sm">{new Date(selectedUser.updated_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="p-6 border-t border-gray-700">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                  >
                    {t("close")}
                  </button>
                  {!selectedUser.is_disabled && (
                    <button
                      onClick={() => {
                        setUserToDisable(selectedUser.id);
                        setShowDisableConfirm(true);
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                    >
                      {t("disableUser")}
                    </button>
                  )}
                  {selectedUser.is_disabled && (
                    <button
                      onClick={() => {
                        setUserToDisable(selectedUser.id);
                        setShowDisableConfirm(true);
                      }}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                    >
                      {t("enableUser")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Disable/Enable Confirmation Modal */}
        {showDisableConfirm && userToDisable !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                {selectedUser?.is_disabled ? t("enableUser") : t("disableUserConfirm")}
              </h3>
              <p className="text-gray-400 mb-4">
                {selectedUser?.is_disabled ? t("enableUserConfirmMessage") : t("disableUserConfirmMessage")}
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDisableConfirm(false);
                    setUserToDisable(null);
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={selectedUser?.is_disabled ? handleEnableUser : handleDisableUser}
                  className={`px-4 py-2 text-white rounded-lg ${
                    selectedUser?.is_disabled ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {selectedUser?.is_disabled ? t("enable") : t("disable")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}