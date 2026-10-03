"use client";

import * as React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

interface AuthContextValue {
  isAuthenticated: boolean;
  isReady: boolean;
  configurationError: string | null;
  organizationId: string | null;
  organization: OrganizationProfile | null;
  membershipRole: string | null;
  displayName: string | null;
  resolveOrganization: () => Promise<{ organizationId: string | null; error: string | null }>;
  checkOrganizationTag: (tag: string, excludeOrganizationId?: string | null) => Promise<{ available: boolean; error: string | null }>;
  saveOrganizationSetup: (details: OrganizationSetupDetails, organizationId?: string | null) => Promise<{ organizationId: string | null; error: string | null }>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (fullName: string, email: string, password: string) => Promise<{
    error: string | null;
    needsEmailConfirmation: boolean;
  }>;
  sendPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  signOut: () => void;
}

export interface OrganizationSetupDetails {
  name: string;
  tag: string;
  industry: string;
  country: string;
  expectedSubUsers: number;
  revenueTarget: number;
  currency: "NGN" | "USD";
  targetPeriod: "monthly" | "quarterly" | "annual";
  expectedTransactionsPerMonth: number;
  averageDealSize: number;
  teamType: "field" | "inside" | "agency";
  enabledFeatures: string[];
}

export interface OrganizationProfile extends OrganizationSetupDetails {
  id: string;
  onboardingCompleted: boolean;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [isReady, setIsReady] = React.useState(false);
  const [configurationError, setConfigurationError] = React.useState<string | null>(null);
  const [organizationId, setOrganizationId] = React.useState<string | null>(null);
  const [organization, setOrganization] = React.useState<OrganizationProfile | null>(null);
  const [membershipRole, setMembershipRole] = React.useState<string | null>(null);
  const [displayName, setDisplayName] = React.useState<string | null>(null);

  const resolveOrganization = React.useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) return { organizationId: null, error: userError.message };
      if (!userData.user) return { organizationId: null, error: "Your sign-in session has expired. Sign in again." };

      const { data: membership, error } = await supabase
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", userData.user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (error) return { organizationId: null, error: error.message };

      const resolvedOrganizationId = membership?.organization_id ?? null;
      setOrganizationId(resolvedOrganizationId);
      setMembershipRole(membership?.role ?? null);
      setDisplayName(userData.user.user_metadata.full_name || userData.user.email || null);
      setIsAuthenticated(true);
      if (!resolvedOrganizationId) {
        setOrganization(null);
        return { organizationId: null, error: null };
      }

      const { data: org, error: organizationError } = await supabase
        .from("organizations")
        .select("id, name, tag, industry, country, expected_sub_users, revenue_target, currency, target_period, expected_transactions_per_month, average_deal_size, team_type, enabled_features, onboarding_completed")
        .eq("id", resolvedOrganizationId)
        .single();
      if (organizationError) return { organizationId: null, error: organizationError.message };

      setOrganization({
        id: String(org.id),
        name: String(org.name ?? ""),
        tag: String(org.tag ?? ""),
        industry: String(org.industry ?? ""),
        country: String(org.country ?? ""),
        expectedSubUsers: Number(org.expected_sub_users ?? 1),
        revenueTarget: Number(org.revenue_target ?? 0),
        currency: org.currency === "NGN" ? "NGN" : "USD",
        targetPeriod: org.target_period === "monthly" || org.target_period === "annual" ? org.target_period : "quarterly",
        expectedTransactionsPerMonth: Number(org.expected_transactions_per_month ?? 0),
        averageDealSize: Number(org.average_deal_size ?? 0),
        teamType: org.team_type === "field" || org.team_type === "agency" ? org.team_type : "inside",
        enabledFeatures: Array.isArray(org.enabled_features) ? org.enabled_features.map(String) : [],
        onboardingCompleted: Boolean(org.onboarding_completed),
      });
      return { organizationId: resolvedOrganizationId, error: null };
    } catch (error) {
      return {
        organizationId: null,
        error: error instanceof Error ? error.message : "Could not load your organization.",
      };
    }
  }, []);

  React.useEffect(() => {
    let supabase: SupabaseClient;
    try {
      supabase = getSupabaseClient();
    } catch (error) {
      setConfigurationError(error instanceof Error ? error.message : "Supabase is not configured.");
      setIsReady(true);
      return;
    }
    let mounted = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session?.user) {
        await resolveOrganization();
      }
      if (mounted) setIsReady(true);
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        setIsAuthenticated(false);
        setOrganizationId(null);
        setOrganization(null);
        setMembershipRole(null);
        setDisplayName(null);
      }
    });

    void loadSession();
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [resolveOrganization]);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return error?.message ?? "Sign-in did not return a user.";

    const membership = await resolveOrganization();
    if (membership.error) return `Signed in, but could not load your organization: ${membership.error}`;
    return null;
  }, [resolveOrganization]);

  const signUp = React.useCallback(async (fullName: string, email: string, password: string) => {
    const { data, error } = await getSupabaseClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (data.session?.user) {
      setDisplayName(data.session.user.user_metadata.full_name || data.session.user.email || null);
      setOrganizationId(null);
      setOrganization(null);
      setMembershipRole(null);
      setIsAuthenticated(true);
    }
    return {
      error: error?.message ?? null,
      needsEmailConfirmation: !error && !data.session,
    };
  }, []);

  const sendPasswordReset = React.useCallback(async (email: string) => {
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error?.message ?? null;
  }, []);

  const updatePassword = React.useCallback(async (password: string) => {
    const { error } = await getSupabaseClient().auth.updateUser({ password });
    return error?.message ?? null;
  }, []);

  const signOut = React.useCallback(() => {
    void getSupabaseClient().auth.signOut();
  }, []);

  const checkOrganizationTag = React.useCallback(async (tag: string, excludeOrganizationId?: string | null) => {
    const { data, error } = await getSupabaseClient().rpc("is_organization_tag_available", {
      check_tag: tag,
      exclude_organization_id: excludeOrganizationId ?? null,
    });
    return { available: Boolean(data), error: error?.message ?? null };
  }, []);

  const saveOrganizationSetup = React.useCallback(async (
    details: OrganizationSetupDetails,
    existingOrganizationId?: string | null,
  ) => {
    const { data, error } = await getSupabaseClient().rpc("save_organization_setup", {
      setup_organization_id: existingOrganizationId ?? null,
      setup_name: details.name,
      setup_tag: details.tag,
      setup_industry: details.industry,
      setup_country: details.country,
      setup_expected_sub_users: details.expectedSubUsers,
      setup_revenue_target: details.revenueTarget,
      setup_currency: details.currency,
      setup_target_period: details.targetPeriod,
      setup_expected_transactions_per_month: details.expectedTransactionsPerMonth,
      setup_average_deal_size: details.averageDealSize,
      setup_team_type: details.teamType,
      setup_enabled_features: details.enabledFeatures,
    });
    if (error || !data) return { organizationId: null, error: error?.message ?? "Organization setup did not return an ID." };

    const savedOrganizationId = String(data);
    setOrganizationId(savedOrganizationId);
    setMembershipRole("owner");
    const resolved = await resolveOrganization();
    if (resolved.error) return { organizationId: savedOrganizationId, error: resolved.error };
    return { organizationId: savedOrganizationId, error: null };
  }, [resolveOrganization]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isReady,
        configurationError,
        organizationId,
        organization,
        membershipRole,
        displayName,
        resolveOrganization,
        checkOrganizationTag,
        saveOrganizationSetup,
        signIn,
        signUp,
        sendPasswordReset,
        updatePassword,
        signOut,
      }}
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