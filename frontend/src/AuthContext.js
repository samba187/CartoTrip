import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { API_URL as BASE_API_URL } from "./config";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem("access_token"); } catch { return null; }
  });

  const login = useCallback((newToken) => {
    try { localStorage.setItem("access_token", newToken); } catch {}
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    try { localStorage.removeItem("access_token"); } catch {}
    setToken(null);
  }, []);

  const authFetch = useCallback((input, init = {}) => {
    const headers = new Headers(init.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }, [token]);

  const value = useMemo(() => ({ token, login, logout, authFetch, API_URL: BASE_API_URL }), [token, login, logout, authFetch]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
