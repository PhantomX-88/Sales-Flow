import { jsonError } from "@/lib/server/http";
import { getAdminClient } from "@/lib/server/supabase-admin";
import { hashInviteToken } from "@/lib/server/tokens";

export const dynamic = "force-dynamic";

function noStoreError(message: string, status: number): Response {
  const response = jsonError(message, status);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/**
 * GET /api/invite/lookup?token=RAW — public, token-possession based.
 *
 * Validates the raw token by its SHA-256 hash and returns only what the
 * accept screen needs: the company name/tag and the LOCKED invited email.
 * Performs the on-read expiry check (pending + past due → expired).
 */
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") ?? "";
    if (token.length < 20) return noStoreError("This invitation link is invalid.", 404);

    let admin;
    try {
      admin = getAdminClient();
    } catch (error) {
      return noStoreError("Invitation lookup is not configured.", 500);
    }

    const { data: invitation, error } = await admin
      .from("invitations")
      .select("id, email, status, expires_at, organizations(name, tag)")
      .eq("token_hash", hashInviteToken(token))
      .maybeSingle();
    if (error) return noStoreError("Could not look up this invitation.", 500);
    if (!invitation) return noStoreError("This invitation link is invalid.", 404);

    if (invitation.status === "pending" && new Date(invitation.expires_at).getTime() <= Date.now()) {
      await admin
        .from("invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id)
        .eq("status", "pending");
      return noStoreError("This invitation has expired. Ask the owner to send a new one.", 410);
    }
    if (invitation.status === "expired") {
      return noStoreError("This invitation has expired. Ask the owner to send a new one.", 410);
    }
    if (invitation.status === "revoked") {
      return noStoreError("This invitation was revoked. Ask the owner to send a new one.", 410);
    }
    if (invitation.status === "accepted") {
      return noStoreError("This invitation has already been used.", 410);
    }

    const organization = invitation.organizations as { name?: string; tag?: string } | null;
    return Response.json(
      {
        email: invitation.email,
        organizationName: organization?.name ?? "",
        organizationTag: organization?.tag ?? "",
        expiresAt: invitation.expires_at,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error(
      `[api/invite/lookup] Unexpected error (${error instanceof Error ? error.name : "unknown error"}).`,
    );
    return noStoreError("Could not look up this invitation.", 500);
  }
}
