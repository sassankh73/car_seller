"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

interface User {
  id: number;
  email: string;
  name?: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("auth");

  // Check for existing auth on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token");
    const storedEmail = localStorage.getItem("user_email");

    if (storedToken && storedEmail) {
      // Verify token with backend
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then((res) => {
          if (res.ok) {
            return res.json();
          }
          throw new Error("Invalid token");
        })
        .then((data) => {
          setUser(data);
          setToken(storedToken);
          setLoading(false);
        })
        .catch(() => {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("user_email");
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

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
        setToken(data.access_token);
        setUser({ id: 1, email: data.email, name: data.name, is_active: true });
        localStorage.setItem("auth_token", data.access_token);
        localStorage.setItem("user_email", data.email);
        router.push("/dashboard");
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
        setToken(data.access_token);
        setUser({ id: 1, email: data.email, name: data.name, is_active: true });
        localStorage.setItem("auth_token", data.access_token);
        localStorage.setItem("user_email", data.email);
        router.push("/dashboard");
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

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_email");
    router.push("/");
    router.refresh();
  };

  // Redirect authenticated users away from auth pages
  useEffect(() => {
    if (user && !loading) {
      const authPaths = ["/login", "/register", "/forgot-password"];
      const currentPath = pathname || "";

      if (
        authPaths.some((p) => currentPath.includes(p)) &&
        !currentPath.includes("/dashboard")
      ) {
        router.push("/dashboard");
      }
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        loading,
        error,
        isAuthenticated: !!user && !!token,
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