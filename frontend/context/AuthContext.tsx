"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

interface User {
  id: number;
  email: string;
  name?: string;
  role: string;
  is_active: boolean;
  is_disabled?: boolean;
  force_password_reset?: boolean;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  changePassword: (email: string, currentPassword: string, newPassword: string) => Promise<boolean>;
  changePasswordWithToken: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<{ success: boolean; requireRelogin?: boolean; detail?: string }>;
  updateProfile: (name?: string, email?: string) => Promise<{ success: boolean; user?: User; detail?: string }>;
  refreshUser: () => Promise<User | null>;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  needsPasswordReset: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Create an authenticated fetch wrapper that attaches the JWT Authorization header.
 */
export function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(input, { ...init, headers });
}

/**
 * Create an axios-compatible request config with auth headers.
 */
export function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("auth");

  // Fetch current user from /api/auth/me using a token
  const fetchCurrentUser = useCallback(async (authToken: string): Promise<User | null> => {
    try {
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        return {
          id: data.id,
          email: data.email,
          name: data.name,
          role: data.role || "FREE",
          is_active: data.is_active ?? true,
          is_disabled: data.is_disabled ?? false,
          force_password_reset: data.force_password_reset ?? false,
          created_at: data.created_at,
        };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Check for existing auth on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token");

    if (storedToken) {
      // Verify token with backend and get real user data
      fetchCurrentUser(storedToken)
        .then((userData) => {
          if (userData) {
            setUser(userData);
            setToken(storedToken);
          } else {
            // Token invalid — clear it
            localStorage.removeItem("auth_token");
          }
          setLoading(false);
        })
        .catch(() => {
          localStorage.removeItem("auth_token");
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        // Store token first
        localStorage.setItem("auth_token", data.access_token);
        setToken(data.access_token);

        // Fetch real user data from /api/auth/me
        const userData = await fetchCurrentUser(data.access_token);
        if (userData) {
          setUser(userData);
          if (data.force_password_reset) {
            setNeedsPasswordReset(true);
          }
          router.push(`/${locale}/dashboard`);
        } else {
          // /me failed — don't fabricate a fake user, show an error instead
          localStorage.removeItem("auth_token");
          setError("Could not load your account. Please try signing in again.");
          setLoading(false);
        }
      } else {
        const data = await response.json();
        setError(data.detail || t("loginFailed"));
        setLoading(false);
      }
    } catch (err) {
      setError(t("networkError"));
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      if (response.ok) {
        const data = await response.json();
        // Store token first
        localStorage.setItem("auth_token", data.access_token);
        setToken(data.access_token);

        // Fetch real user data from /api/auth/me
        const userData = await fetchCurrentUser(data.access_token);
        if (userData) {
          setUser(userData);
          router.push(`/${locale}/dashboard`);
        } else {
          // /me failed — don't fabricate a fake user, show an error instead
          localStorage.removeItem("auth_token");
          setError("Could not load your account. Please try signing in again.");
          setLoading(false);
        }
      } else {
        const data = await response.json();
        setError(data.detail || t("registerFailed"));
        setLoading(false);
      }
    } catch (err) {
      setError(t("networkError"));
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setNeedsPasswordReset(false);
    localStorage.removeItem("auth_token");
    router.push("/");
    router.refresh();
  }, [router]);

  const changePassword = async (email: string, currentPassword: string, newPassword: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ email, current_password: currentPassword, new_password: newPassword }),
      });
      if (response.ok) {
        setNeedsPasswordReset(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const changePasswordWithToken = async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ success: boolean; requireRelogin?: boolean; detail?: string }> => {
    try {
      const response = await authFetch("/api/auth/change-password-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setNeedsPasswordReset(false);
        return { success: true, requireRelogin: data.require_relogin || false, detail: data.detail };
      } else {
        return { success: false, detail: data.detail || "Failed to change password" };
      }
    } catch {
      return { success: false, detail: "Network error" };
    }
  };

  const updateProfile = async (name?: string, email?: string): Promise<{ success: boolean; user?: User; detail?: string }> => {
    try {
      const response = await authFetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await response.json();

      if (response.ok) {
        // Refresh user data
        const updatedUser = await fetchCurrentUser(localStorage.getItem("auth_token") || "");
        if (updatedUser) {
          setUser(updatedUser);
          return { success: true, user: updatedUser };
        }
        return { success: true };
      } else {
        return { success: false, detail: data.detail || "Failed to update profile" };
      }
    } catch {
      return { success: false, detail: "Network error" };
    }
  };

  const refreshUser = async (): Promise<User | null> => {
    const storedToken = localStorage.getItem("auth_token");
    if (!storedToken) return null;

    const userData = await fetchCurrentUser(storedToken);
    if (userData) {
      setUser(userData);
    }
    return userData;
  };

  // Redirect unauthenticated users away from protected routes
  useEffect(() => {
    if (!loading && !user) {
      const currentPath = pathname || "";
      // Match /<locale>/dashboard/* or /<locale>/admin/*
      const isProtected = /^\/[a-z]{2}(\/dashboard|\/admin)(\/|$)/.test(currentPath);
      if (isProtected) {
        router.push(`/${locale}/auth/login`);
      }
    }
  }, [user, loading, pathname, router, locale]);

  // Redirect authenticated users away from auth pages (exact auth-page segments only)
  useEffect(() => {
    if (user && !loading) {
      const currentPath = pathname || "";
      // Match /<locale>/auth/login, /register, /forgot-password — exact segment match
      const isAuthPage = /^\/[a-z]{2}\/auth\/(login|register|forgot-password)(\/|$)/.test(currentPath);
      if (isAuthPage) {
        router.push(`/${locale}/dashboard`);
      }
    }
  }, [user, loading, pathname, router, locale]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        changePassword,
        changePasswordWithToken,
        updateProfile,
        refreshUser,
        loading,
        error,
        isAuthenticated: !!user && !!token,
        needsPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}