import { jsonError } from "@/lib/server/http";
import { requireActiveOwner } from "@/lib/server/auth";
import { resolveSiteUrl, sendInvitationEmail } from "@/lib/server/mailer";
import { generateInviteToken, hashInviteToken } from "@/lib/server/tokens";

const MAX_SENDS_PER_INVITE = 4; // 1 initial send + 3 resends

/**
 * POST /api/team/resend — owner only.
 * Issues a NEW token (invalidating the previous link), extends expiry by
 * 7 days, increments send_count and re-emails. Capped at 3 resends.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return jsonError("Invalid JSON body.", 400);

    const gate = await requireActiveOwner(request, body.organizationId);
    if ("response" in gate) return gate.response;
    const { owner, admin } = gate;
    const organizationId = String(body.organizationId);
    const invitationId = String(body.invitationId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(invitationId)) {
      return jsonError("A valid invitation id is required.", 400);
    }

    const { data: invitation, error: lookupError } = await admin
      .from("invitations")
      .select("id, email, status, send_count, organization_id")
      .eq("id", invitationId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (lookupError) return jsonError("Could not look up the invitation.", 500);
    if (!invitation) return jsonError("Invitation not found.", 404);
    if (invitation.status !== "pending") {
      return jsonError("Only pending invitations can be resent.", 409);
    }
    if (invitation.send_count >= MAX_SENDS_PER_INVITE) {
      return jsonError("This invitation has reached its send limit (1 initial + 3 resends).", 429);
    }

    const [{ data: organization, error: organizationError }, { data: inviterProfile, error: profileError }] =
      await Promise.all([
        admin.from("organizations").select("name, tag").eq("id", organizationId).maybeSingle(),
        admin.from("profiles").select("full_name").eq("id", owner.userId).maybeSingle(),
      ]);
    if (organizationError || profileError) {
      return jsonError("Could not load organization details for the invitation.", 500);
    }
    if (!organization) return jsonError("Organization not found.", 404);

    const rawToken = generateInviteToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: updated, error: updateError } = await admin
      .from("invitations")
      .update({
        token_hash: hashInviteToken(rawToken), // old link dies immediately
        expires_at: expiresAt,
        last_sent_at: new Date().toISOString(),
        send_count: invitation.send_count + 1,
      })
      .eq("id", invitationId)
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .select("id, email, expires_at, send_count")
      .single();
    if (updateError || !updated) {
      return jsonError("The invitation could not be resent.", 500);
    }

    const acceptUrl = `${resolveSiteUrl(request)}/accept-invite?token=${rawToken}`;
    const { sent, error: mailError } = await sendInvitationEmail({
      to: updated.email,
      organizationName: organization?.name ?? "",
      organizationTag: organization?.tag ?? "",
      inviterName: inviterProfile?.full_name ?? "",
      acceptUrl,
      expiresAt: updated.expires_at,
    });

    const { error: auditError } = await admin.from("audit_log").insert({
      organization_id: organizationId,
      actor_id: owner.userId,
      action: "invitation.resent",
      entity: "invitation",
      entity_id: invitationId,
      metadata: { email: updated.email, send_count: updated.send_count, email_sent: sent },
    });
    if (auditError) console.error("[api/team/resend] audit log insert failed:", auditError);

    const warning = [
      mailError ?? (sent ? null : "Email is not configured (RESEND_API_KEY). Share the invitation link manually."),
      auditError ? "The invitation could not be recorded in the audit log." : null,
    ]
      .filter(Boolean)
      .join(" ");

    return Response.json({
      ok: true,
      invitationId: updated.id,
      expiresAt: updated.expires_at,
      sendCount: updated.send_count,
      acceptUrl,
      emailSent: sent,
      warning: warning || null,
    });
  } catch (error) {
    console.error("[api/team/resend]", error);
    return jsonError(error instanceof Error ? error.message : "Unexpected server error.", 500);
  }
}
