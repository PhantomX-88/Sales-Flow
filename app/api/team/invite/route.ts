import { jsonError } from "@/lib/server/http";
import { requireActiveOwner } from "@/lib/server/auth";
import { resolveSiteUrl, sendInvitationEmail } from "@/lib/server/mailer";
import { generateInviteToken, hashInviteToken } from "@/lib/server/tokens";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_INVITES_PER_ORG_PER_HOUR = 20;
const TARGET_PERIODS = ["monthly", "quarterly", "annual"];

/**
 * POST /api/team/invite — owner-only invitation creation.
 *
 * 1. Verify caller is an active owner (requireActiveOwner).
 * 2. Reject emails that already belong to an active member of any org.
 * 3. Store only the SHA-256 hash of a fresh 32-byte token.
 * 4. Email the raw link through our own sender (never auth.admin.inviteUserByEmail).
 * 5. Rate limit: max 20 invitations per org per hour.
 * 6. Audit log entry.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return jsonError("Invalid JSON body.", 400);

    const gate = await requireActiveOwner(request, body.organizationId);
    if ("response" in gate) return gate.response;
    const { owner, admin } = gate;
    const organizationId = String(body.organizationId);

    const email = String(body.email ?? "").trim().toLowerCase();
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      return jsonError("Enter a valid email address.", 400);
    }

    const fullName = String(body.fullName ?? "").trim().slice(0, 120);

    const personalTarget = Number(body.personalTarget ?? 0);
    if (!Number.isFinite(personalTarget) || personalTarget < 0 || personalTarget > 1_000_000_000_000) {
      return jsonError("Personal target must be a positive amount.", 400);
    }

    const targetPeriod = String(body.targetPeriod ?? "monthly");
    if (!TARGET_PERIODS.includes(targetPeriod)) {
      return jsonError("Choose a valid target period.", 400);
    }

    // Sweep overdue pendings so the partial unique index stays honest.
    const { error: expiryError } = await admin.rpc("expire_stale_invitations");
    if (expiryError) return jsonError("Could not refresh expired invitations.", 500);

    // Rate limit: max 20 invitations per organization per hour.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("created_at", hourAgo);
    if (countError) return jsonError("Could not check invitation limits.", 500);
    if ((count ?? 0) >= MAX_INVITES_PER_ORG_PER_HOUR) {
      return jsonError("Rate limit reached: at most 20 invitations per organization per hour.", 429);
    }

    // Reject when that email is already an active member of any organization.
    const { data: existingUserId, error: userLookupError } = await admin.rpc("find_auth_user_id", { check_email: email });
    if (userLookupError) return jsonError("Could not check existing membership.", 500);
    if (existingUserId) {
      const { data: activeMember, error: membershipError } = await admin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", existingUserId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (membershipError) return jsonError("Could not check existing membership.", 500);
      if (activeMember) {
        return jsonError(
          activeMember.organization_id === organizationId
            ? "That person is already an active member of this organization."
            : "That email already belongs to a member of another organization.",
          409,
        );
      }
    }

    // One pending invitation per (organization, email).
    const { data: pending, error: pendingError } = await admin
      .from("invitations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();
    if (pendingError) return jsonError("Could not check existing invitations.", 500);
    if (pending) {
      return jsonError("A pending invitation already exists for that email. Resend it instead.", 409);
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

    // Role is hardcoded to sales_rep — it never comes from the client.
    const rawToken = generateInviteToken();
    const { data: invitation, error: insertError } = await admin
      .from("invitations")
      .insert({
        organization_id: organizationId,
        email,
        full_name: fullName,
        role: "sales_rep",
        personal_target: personalTarget,
        target_period: targetPeriod,
        token_hash: hashInviteToken(rawToken),
        invited_by: owner.userId,
      })
      .select("id, expires_at")
      .single();

    if (insertError || !invitation) {
      if (insertError?.code === "23505") {
        return jsonError("A pending invitation already exists for that email.", 409);
      }
      return jsonError(insertError?.message ?? "The invitation could not be created.", 500);
    }

    const acceptUrl = `${resolveSiteUrl(request)}/accept-invite?token=${rawToken}`;
    const { sent, error: mailError } = await sendInvitationEmail({
      to: email,
      organizationName: organization?.name ?? "",
      organizationTag: organization?.tag ?? "",
      inviterName: inviterProfile?.full_name ?? "",
      acceptUrl,
      expiresAt: invitation.expires_at,
    });

    const { error: auditError } = await admin.from("audit_log").insert({
      organization_id: organizationId,
      actor_id: owner.userId,
      action: "invitation.created",
      entity: "invitation",
      entity_id: invitation.id,
      metadata: {
        email,
        personal_target: personalTarget,
        target_period: targetPeriod,
        email_sent: sent,
      },
    });
    if (auditError) console.error("[api/team/invite] audit log insert failed:", auditError);

    const warning = [
      mailError ?? (sent ? null : "Email is not configured (RESEND_API_KEY). Share the invitation link manually."),
      auditError ? "The invitation could not be recorded in the audit log." : null,
    ]
      .filter(Boolean)
      .join(" ");

    return Response.json({
      ok: true,
      invitationId: invitation.id,
      expiresAt: invitation.expires_at,
      acceptUrl,
      emailSent: sent,
      warning: warning || null,
    });
  } catch (error) {
    console.error("[api/team/invite]", error);
    return jsonError(error instanceof Error ? error.message : "Unexpected server error.", 500);
  }
}
