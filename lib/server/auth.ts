import type { SupabaseClient } from "@supabase/supabase-js";

import { isUuid, jsonError } from "@/lib/server/http";
import { getAdminClient } from "@/lib/server/supabase-admin";

export interface OwnerContext {
  userId: string;
  email: string | null;
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

/**
 * GLOBAL RULE: every service-role route first verifies the caller is an
 * ACTIVE owner of the target organization.
 *
 * The caller's Supabase access token (Bearer) is validated against Supabase
 * Auth, then the membership is checked with the service-role client so the
 * answer cannot be tampered with from the client.
 */
export async function requireActiveOwner(
  request: Request,
  organizationId: unknown,
): Promise<{ owner: OwnerContext; admin: SupabaseClient } | { response: Response }> {
  const token = getBearerToken(request);
  if (!token) return { response: jsonError("Sign in to continue.", 401) };

  if (!isUuid(organizationId)) {
    return { response: jsonError("A valid organization id is required.", 400) };
  }

  let admin: SupabaseClient;
  try {
    admin = getAdminClient();
  } catch (error) {
    return { response: jsonError(error instanceof Error ? error.message : "Server is not configured.", 500) };
  }

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return { response: jsonError("Your session has expired. Sign in again.", 401) };
  }

  const { data: membership, error: membershipError } = await admin
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (membershipError) {
    return { response: jsonError("Could not verify organization access.", 500) };
  }
  if (!membership || membership.role !== "owner" || membership.status !== "active") {
    return { response: jsonError("Only the organization owner can manage the team.", 403) };
  }

  return {
    owner: {
      userId: userData.user.id,
      email: userData.user.email ?? null,
    },
    admin,
  };
}
