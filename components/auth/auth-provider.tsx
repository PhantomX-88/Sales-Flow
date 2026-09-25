"use client";

import * as React from "react";
import { getSupabaseClient } from "@/lib/supabase";

interface AuthContextValue {
  isAuthenticated: boolean;
  isReady: boolean;
  workspaceId: string | null;
  displayName: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (fullName: string, email: string, password: string) => Promise<{
    error: string | null;
    needsEmailConfirmation: boolean;
  }>;
  signOut: () => void;
  createWorkspace: (name: string, teamSize: string) => Promise<string | null>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);
  const [workspaceId, setWorkspaceId] = React.useState<string | null>(null);
  const [displayName, setDisplayName] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = getSupabaseClient();
    let mounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setIsAuthenticated(Boolean(data.session));
      if (data.session?.user) {
        setDisplayName(
          data.session.user.user_metadata.full_name || data.session.user.email || null,
        );
        const { data: membership } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", data.session.user.id)
          .limit(1)
          .maybeSingle();
        if (mounted) setWorkspaceId(membership?.workspace_id ?? null);
      }
      setIsReady(true);
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setIsAuthenticated(Boolean(session));
      if (session?.user) {
        setDisplayName(session.user.user_metadata.full_name || session.user.email || null);
      }
      if (event === "SIGNED_OUT") {
        setWorkspaceId(null);
        setDisplayName(null);
      }
    });

    void loadSession();
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signUp = React.useCallback(async (fullName: string, email: string, password: string) => {
    const { data, error } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return {
      error: error?.message ?? null,
      needsEmailConfirmation: !error && !data.session,
    };
  }, []);

  const signOut = React.useCallback(() => {
    void getSupabaseClient().auth.signOut();
  }, []);

  const createWorkspace = React.useCallback(async (name: string, teamSize: string) => {
    const { data, error } = await getSupabaseClient().rpc("create_workspace", {
      workspace_name: name,
      workspace_team_size: teamSize,
    });
    if (!error && data) setWorkspaceId(data as string);
    return error?.message ?? null;
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isReady, workspaceId, displayName, signIn, signUp, signOut, createWorkspace }}
    >
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