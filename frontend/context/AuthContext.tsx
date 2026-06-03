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
  force_password_reset?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  changePassword: (email: string, currentPassword: string, newPassword: string) => Promise<boolean>;
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
          role: data.role || "free",
          is_active: data.is_active ?? true,
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
        } else {
          // Fallback: use what we have from the login response
          setUser({
            id: 0,
            email: data.email,
            name: data.name,
            role: "free",
            is_active: true,
          });
        }
        router.push(`/${locale}/dashboard`);
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
        } else {
          // Fallback: use what we have from the register response
          setUser({
            id: 0,
            email: data.email,
            name: data.name,
            role: "free",
            is_active: true,
          });
        }
        router.push(`/${locale}/dashboard`);
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

  // Redirect unauthenticated users away from protected routes
  useEffect(() => {
    if (!loading && !user) {
      const protectedPaths = ["/dashboard", "/admin"];
      const currentPath = pathname || "";
      if (protectedPaths.some((p) => currentPath.includes(p))) {
        router.push(`/${locale}/auth/login`);
      }
    }
  }, [user, loading, pathname, router, locale]);

  // Redirect authenticated users away from auth pages
  useEffect(() => {
    if (user && !loading) {
      const authPaths = ["/login", "/register", "/forgot-password"];
      const currentPath = pathname || "";

      if (
        authPaths.some((p) => currentPath.includes(p)) &&
        !currentPath.includes("/dashboard")
      ) {
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