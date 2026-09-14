import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setAuthToken, loadStoredToken } from "../api/client";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  colorAccent: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredToken();
    api
      .get<CurrentUser>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const result = await api.post<CurrentUser & { token: string }>("/auth/login", { email, password });
    setAuthToken(result.token);
    setUser(result);
  }

  async function logout() {
    await api.post("/auth/logout").catch(() => {});
    setAuthToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
