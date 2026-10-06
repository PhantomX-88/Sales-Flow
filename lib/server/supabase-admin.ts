import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

/**
 * Server-only Supabase client backed by the service-role key.
 *
 * GLOBAL RULE: this module must only be imported from Route Handlers /
 * Server code. The key lives in the non-NEXT_PUBLIC env var
 * SUPABASE_SERVICE_ROLE_KEY so it can never reach the client bundle.
 * Every route that uses this client must first verify the caller is an
 * active owner of the target organization (see lib/server/auth.ts).
 */
export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Server is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env.local / Vercel environment variables.",
    );
  }

  adminClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return adminClient;
}