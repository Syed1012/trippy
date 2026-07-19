"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  getAccessToken,
  clearTokens,
  getUserFromToken,
  login as apiLogin,
  logout as apiLogout,
  refreshAccessToken,
  ApiError,
  type UserProfile,
  type LoginResponse,
} from "@/lib/api";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  setUser: (u: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, try to restore session from stored token
  useEffect(() => {
    const handleUnauthorized = () => {
      clearTokens();
      setUser(null);
    };

    window.addEventListener("unauthorized", handleUnauthorized);

    const token = getAccessToken();
    if (!token) {
      queueMicrotask(() => setIsLoading(false));
    } else {
      // First, immediately restore user from JWT claims (instant, no network)
      const cachedUser = getUserFromToken(token);
      if (cachedUser) {
        queueMicrotask(() => setUser(cachedUser));
      }

      // Then try to refresh the token to get a fresh one
      refreshAccessToken()
        .then((res) => setUser(res.user))
        .catch((error) => {
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            clearTokens();
            setUser(null);
          }
        })
        .finally(() => setIsLoading(false));
    }

    return () => {
      window.removeEventListener("unauthorized", handleUnauthorized);
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, rememberMe = false) => {
      const res = await apiLogin(email, password, rememberMe);
      setUser(res.user);
      return res;
    },
    [],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
