"use client";

import * as React from "react";

const AUTH_STORAGE_KEY = "salesflow-authenticated";

interface AuthContextValue {
  isAuthenticated: boolean;
  isReady: boolean;
  signIn: () => void;
  signOut: () => void;
  deleteAccount: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    setIsAuthenticated(window.localStorage.getItem(AUTH_STORAGE_KEY) === "true");
    setIsReady(true);
  }, []);

  const signIn = React.useCallback(() => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "true");
    setIsAuthenticated(true);
  }, []);

  const signOut = React.useCallback(() => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
  }, []);

  const deleteAccount = React.useCallback(() => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isReady, signIn, signOut, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}