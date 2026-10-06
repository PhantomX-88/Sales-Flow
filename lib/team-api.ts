import { getSupabaseClient } from "@/lib/supabase";

export interface InviteResult {
  ok: boolean;
  invitationId: string;
  expiresAt?: string;
  acceptUrl?: string;
  emailSent?: boolean;
  warning?: string | null;
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Calls an owner-only /api/team/* route with the caller's access token.
 * The server independently verifies the caller is an active owner — this
 * helper never decides permissions itself.
 */
export async function callTeamRoute<T = Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("Sign in to continue.");

  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(json?.error ?? "The request could not be completed.");
  }
  return json as T;
}
