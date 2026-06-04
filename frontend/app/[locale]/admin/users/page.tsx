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
  force_password_reset?: boolean;
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
  force_password_reset?: boolean;
}

const ROLES = ["ADMIN", "PREMIUM", "FREE"];

export default function AdminUsers() {
  const t = useTranslations("admin");
  const commonT = useTranslations("common");
  const locale = useLocale();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchName, setSearchName] = useState("");

  // Modal states
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [userToDisable, setUserToDisable] = useState<number | null>(null);

  // Edit User Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUser, setEditUser] = useState<UserDetail | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("FREE");
  const [editPlan, setEditPlan] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editSaving, setEditSaving] = useState(false);

  // Password Reset Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUser, setPasswordUser] = useState<UserDetail | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordOption, setPasswordOption] = useState<"manual" | "generate" | "force">("generate");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== "ADMIN") return;
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

  const handleViewUser = async (userId: number): Promise<UserDetail | null> => {
    try {
      clearMessages();
      const response = await authFetch(`/api/admin/users/${userId}`);
      if (!response.ok) throw new Error("Failed to load user details");
      const data = await response.json();
      setSelectedUser(data);
      return data;
    } catch (error: any) {
      console.error("Failed to load user details:", error);
      setError(error.message || t("errors.loadUserDetails"));
      return null;
    }
  };

  // Edit User
  const openEditModal = (u: UserDetail) => {
    setEditUser(u);
    setEditName(u.name || "");
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditPlan(u.subscription_plan || "basic");
    setEditActive(u.is_active && !u.is_disabled);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setEditSaving(true);
    clearMessages();
    try {
      const response = await authFetch(`/api/admin/users/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          role: editRole,
          is_active: editActive,
          subscription_plan: editPlan,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to update user");
      }
      setSuccessMessage(t("userUpdated", { email: editEmail }));
      setShowEditModal(false);
      loadUsers();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setEditSaving(false);
    }
  };

  // Password Management
  const openPasswordModal = (u: UserDetail) => {
    setPasswordUser(u);
    setPasswordOption("generate");
    setNewPassword("");
    setGeneratedPassword(null);
    setShowPasswordModal(true);
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  const handlePasswordAction = async () => {
    if (!passwordUser) return;
    setPasswordSaving(true);
    clearMessages();

    try {
      if (passwordOption === "force") {
        // Force password reset on next login
        const response = await authFetch(`/api/admin/users/${passwordUser.id}/force-password-reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force_password_reset: true }),
        });
        if (!response.ok) throw new Error("Failed to set force password reset");
        setSuccessMessage(t("forcePasswordResetSuccess", { email: passwordUser.email }));
      } else {
        // Set new password (manual or generated)
        let password = newPassword;
        if (passwordOption === "generate") {
          password = generateRandomPassword();
          setGeneratedPassword(password);
        }
        if (!password || password.length < 6) {
          throw new Error(t("passwordTooShort"));
        }
        const response = await authFetch(`/api/admin/users/${passwordUser.id}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: password, generate_temp: false }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.detail || "Failed to reset password");
        }
        if (passwordOption === "generate") {
          setSuccessMessage(t("passwordGeneratedSuccess", { email: passwordUser.email }));
        } else {
          setSuccessMessage(t("passwordResetSuccess", { email: passwordUser.email }));
        }
      }
      if (passwordOption !== "generate") {
        setShowPasswordModal(false);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDisableUser = async () => {
    if (userToDisable === null) return;
    try {
      clearMessages();
      const response = await authFetch(`/api/admin/users/${userToDisable}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disable: true }),
      });
      if (!response.ok) throw new Error("Failed to disable user");
      setSuccessMessage(t("userDisabledSuccess"));
      loadUsers();
      setSelectedUser(null);
      setShowDisableConfirm(false);
      setUserToDisable(null);
    } catch (error: any) {
      setError(error.message || t("errors.disableUser"));
    }
  };

  const handleEnableUser = async () => {
    if (userToDisable === null) return;
    try {
      clearMessages();
      const response = await authFetch(`/api/admin/users/${userToDisable}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disable: false }),
      });
      if (!response.ok) throw new Error("Failed to enable user");
      setSuccessMessage(t("userEnabledSuccess"));
      loadUsers();
      setSelectedUser(null);
      setShowDisableConfirm(false);
      setUserToDisable(null);
    } catch (error: any) {
      setError(error.message || t("errors.enableUser"));
    }
  };

  const handleViewProjects = async (userId: number) => {
    try {
      const response = await authFetch(`/api/admin/users/${userId}/projects`);
      if (!response.ok) throw new Error("Failed to load projects");
      const projects = await response.json();
      alert(projects.length > 0 ? projects.map((p: any) => p.name).join(", ") : t("noProjects"));
    } catch (error: any) {
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

  if (!isAuthenticated || user?.role !== "ADMIN") {
    return (
      <main className="p-8 min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-6">You need admin privileges to access this page.</p>
          <Link href={`/${locale}/dashboard`} className="text-indigo-400 hover:text-indigo-300">← Back to Dashboard</Link>
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
            <h1 className="text-2xl font-bold text-white">{commonT("appName")}</h1>
            <span className="text-purple-400 font-medium text-sm">ADMIN</span>
            <Link href={`/${locale}/admin/dashboard`} className="text-gray-400 hover:text-white transition">{t("dashboard")}</Link>
          </div>
          <div className="flex items-center space-x-4">
            <LanguageSwitcher />
            <span className="text-gray-400 text-sm">{user?.email}</span>
            <button onClick={logout} className="text-red-400 hover:text-red-300 transition text-sm">Logout</button>
            <Link href={`/${locale}/dashboard`} className="text-indigo-400 hover:text-indigo-300 transition">← {t("backToDashboard")}</Link>
          </div>
        </nav>

        <header className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t("users")}</h1>
          <p className="text-gray-400">{t("usersSubtitle")}</p>
        </header>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-500/10 border border-green-500 rounded-xl p-4 mb-6 flex items-start gap-3">
            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-green-400 font-medium">{t("success")}</h3>
              <p className="text-green-300 text-sm">{successMessage}</p>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="ml-auto text-green-400 hover:text-green-300">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-xl p-4 mb-6 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-red-400 font-medium">{t("errors.error")}</h3>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            </button>
          </div>
        )}

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-6 bg-gray-800 p-6 rounded-xl border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t("searchEmail")}</label>
              <input type="text" value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder={t("searchEmailPlaceholder")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">{t("searchName")}</label>
              <input type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder={t("searchNamePlaceholder")} />
            </div>
          </div>
          <div className="mt-4">
            <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition">{t("search")}</button>
            <button type="button" onClick={() => { setSearchEmail(""); setSearchName(""); loadUsers(); }} className="ml-2 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition">{t("clear")}</button>
          </div>
        </form>

        {/* User List */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t("email")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t("name")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t("role")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t("status")}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{t("projects")}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">{t("noUsersFound")}</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-750">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{u.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{u.name || "-"}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${u.role === "ADMIN" ? "bg-yellow-500/20 text-yellow-400" : u.role === "PREMIUM" ? "bg-purple-500/20 text-purple-400" : "bg-gray-500/20 text-gray-400"}`}>{u.role}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-1 text-xs rounded-full ${u.is_active && !u.is_disabled ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                            {u.is_disabled ? t("disabled") : u.is_active ? t("active") : t("inactive")}
                          </span>
                          {u.force_password_reset && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400">{t("passwordResetRequired")}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{u.project_count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button onClick={() => handleViewUser(u.id)} className="text-indigo-400 hover:text-indigo-300">{t("view")}</button>
                          <button onClick={async () => { const data = await handleViewUser(u.id); if (data) openEditModal(data); }} className="text-blue-400 hover:text-blue-300">{t("edit")}</button>
                          <button onClick={async () => { const data = await handleViewUser(u.id); if (data) openPasswordModal(data); }} className="text-amber-400 hover:text-amber-300">{t("resetPassword")}</button>
                          {u.role !== "ADMIN" && u.id !== user?.id && (
                            <button onClick={() => { setUserToDisable(u.id); setShowDisableConfirm(true); }} className={u.is_disabled ? "text-green-400 hover:text-green-300" : "text-red-400 hover:text-red-300"}>
                              {u.is_disabled ? t("enable") : t("disable")}
                            </button>
                          )}
                          <button onClick={() => handleViewProjects(u.id)} className="text-gray-400 hover:text-gray-300">{t("projects")}</button>
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
        {selectedUser && !showEditModal && !showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedUser(null)}>
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">{t("userDetails")}</h2>
                <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-white"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-gray-400 text-sm">{t("email")}</span><p className="text-white">{selectedUser.email}</p></div>
                  <div><span className="text-gray-400 text-sm">{t("name")}</span><p className="text-white">{selectedUser.name || "-"}</p></div>
                  <div><span className="text-gray-400 text-sm">{t("role")}</span><p className="text-white">{selectedUser.role}</p></div>
                  <div><span className="text-gray-400 text-sm">{t("status")}</span><p className="text-white">{selectedUser.is_disabled ? t("disabled") : selectedUser.is_active ? t("active") : t("inactive")}</p></div>
                  <div><span className="text-gray-400 text-sm">{t("subscription")}</span><p className="text-white">{selectedUser.subscription_plan || "-"}</p></div>
                  <div><span className="text-gray-400 text-sm">{t("projects")}</span><p className="text-white">{selectedUser.project_count}</p></div>
                </div>
                <div><span className="text-gray-400 text-sm">{t("createdAt")}</span><p className="text-gray-300 text-sm">{new Date(selectedUser.created_at).toLocaleString(locale === "sv" ? "sv-SE" : "en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div>
                <div><span className="text-gray-400 text-sm">{t("updatedAt")}</span><p className="text-gray-300 text-sm">{new Date(selectedUser.updated_at).toLocaleString(locale === "sv" ? "sv-SE" : "en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div>
              </div>
              <div className="p-6 border-t border-gray-700 flex flex-wrap gap-2 justify-end">
                <button onClick={() => openEditModal(selectedUser)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">{t("editUser")}</button>
                <button onClick={() => openPasswordModal(selectedUser)} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm">{t("resetPassword")}</button>
                <button onClick={() => setSelectedUser(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">{t("close")}</button>
                {selectedUser.role !== "ADMIN" && selectedUser.id !== user?.id && (
                  <button onClick={() => { setUserToDisable(selectedUser.id); setShowDisableConfirm(true); }} className={`px-4 py-2 text-white rounded-lg text-sm ${selectedUser.is_disabled ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
                    {selectedUser.is_disabled ? t("enableUser") : t("disableUser")}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && editUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
            <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">{t("editUser")}</h2>
                <p className="text-gray-400 text-sm mt-1">{editUser.email}</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">{t("name")}</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">{t("email")}</label>
                  <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">{t("role")}</label>
                  <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                    {ROLES.map((r) => <option key={r} value={r}>{r === "ADMIN" ? "Admin" : r === "PREMIUM" ? "Premium" : "Free"}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">{t("subscriptionPlan")}</label>
                  <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                    <option value="basic">Basic</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div className="flex items-center space-x-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="sr-only peer" />
                    <div className={`w-11 h-6 rounded-full peer-focus:ring-2 peer-focus:ring-indigo-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${editActive ? "bg-green-500 after:translate-x-full" : "bg-gray-600"}`}></div>
                  </label>
                  <span className="text-sm text-gray-300">{editActive ? t("active") : t("inactive")}</span>
                </div>
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end space-x-3">
                <button onClick={() => setShowEditModal(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">{t("cancel")}</button>
                <button onClick={handleSaveEdit} disabled={editSaving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50">
                  {editSaving ? t("saving") : t("save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Password Reset Modal */}
        {showPasswordModal && passwordUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowPasswordModal(false)}>
            <div className="bg-gray-800 rounded-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-semibold text-white">{t("resetPassword")}</h2>
                <p className="text-gray-400 text-sm mt-1">{passwordUser.email}</p>
              </div>
              <div className="p-6 space-y-4">
                {/* Password option selection */}
                <div className="space-y-3">
                  <label className="flex items-start space-x-3 p-3 rounded-lg border border-gray-600 cursor-pointer hover:bg-gray-700">
                    <input type="radio" name="passwordOption" value="generate" checked={passwordOption === "generate"} onChange={() => setPasswordOption("generate")} className="mt-1" />
                    <div>
                      <span className="text-white font-medium">{t("generatePassword")}</span>
                      <p className="text-gray-400 text-xs mt-0.5">{t("generatePasswordDesc")}</p>
                    </div>
                  </label>
                  <label className="flex items-start space-x-3 p-3 rounded-lg border border-gray-600 cursor-pointer hover:bg-gray-700">
                    <input type="radio" name="passwordOption" value="manual" checked={passwordOption === "manual"} onChange={() => setPasswordOption("manual")} className="mt-1" />
                    <div>
                      <span className="text-white font-medium">{t("enterPassword")}</span>
                      <p className="text-gray-400 text-xs mt-0.5">{t("enterPasswordDesc")}</p>
                    </div>
                  </label>
                  <label className="flex items-start space-x-3 p-3 rounded-lg border border-gray-600 cursor-pointer hover:bg-gray-700">
                    <input type="radio" name="passwordOption" value="force" checked={passwordOption === "force"} onChange={() => setPasswordOption("force")} className="mt-1" />
                    <div>
                      <span className="text-white font-medium">{t("forcePasswordReset")}</span>
                      <p className="text-gray-400 text-xs mt-0.5">{t("forcePasswordResetDesc")}</p>
                    </div>
                  </label>
                </div>

                {passwordOption === "manual" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">{t("newPassword")}</label>
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t("newPasswordPlaceholder")} className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                    {newPassword && newPassword.length < 6 && <p className="text-red-400 text-xs mt-1">{t("passwordTooShort")}</p>}
                  </div>
                )}

                {generatedPassword && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <p className="text-green-400 text-sm font-medium mb-1">{t("generatedPassword")}:</p>
                    <div className="flex items-center gap-2">
                      <code className="text-white bg-gray-900 px-3 py-1 rounded font-mono text-sm select-all">{generatedPassword}</code>
                      <button onClick={() => navigator.clipboard.writeText(generatedPassword)} className="text-green-400 hover:text-green-300 text-xs">{t("copy")}</button>
                    </div>
                    <p className="text-amber-400 text-xs mt-2">{t("copyPasswordWarning")}</p>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-gray-700 flex justify-end space-x-3">
                <button onClick={() => { setShowPasswordModal(false); setGeneratedPassword(null); }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">{t("cancel")}</button>
                <button onClick={handlePasswordAction} disabled={passwordSaving || (passwordOption === "manual" && newPassword.length < 6)} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50">
                  {passwordSaving ? t("saving") : passwordOption === "force" ? t("forceReset") : t("setPassword")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Disable/Enable Confirmation Modal */}
        {showDisableConfirm && userToDisable !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-white mb-2">{selectedUser?.is_disabled ? t("enableUser") : t("disableUserConfirm")}</h3>
              <p className="text-gray-400 mb-4">{selectedUser?.is_disabled ? t("enableUserConfirmMessage") : t("disableUserConfirmMessage")}</p>
              <div className="flex justify-end space-x-3">
                <button onClick={() => { setShowDisableConfirm(false); setUserToDisable(null); }} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">{t("cancel")}</button>
                <button onClick={selectedUser?.is_disabled ? handleEnableUser : handleDisableUser} className={`px-4 py-2 text-white rounded-lg ${selectedUser?.is_disabled ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
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