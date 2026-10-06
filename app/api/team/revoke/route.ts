import { jsonError } from "@/lib/server/http";
import { requireActiveOwner } from "@/lib/server/auth";

/**
 * POST /api/team/revoke — owner only.
 * Marks the invitation revoked; the token becomes invalid immediately
 * (accept_invitation rejects non-pending rows under a row lock).
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
      .select("id, email, status")
      .eq("id", invitationId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (lookupError) return jsonError("Could not look up the invitation.", 500);
    if (!invitation) return jsonError("Invitation not found.", 404);
    if (invitation.status !== "pending") {
      return jsonError(`Only pending invitations can be revoked (this one is ${invitation.status}).`, 409);
    }

    const { data: revoked, error: updateError } = await admin
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId)
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (updateError) return jsonError("The invitation could not be revoked.", 500);
    if (!revoked) return jsonError("This invitation is no longer pending.", 409);

    const { error: auditError } = await admin.from("audit_log").insert({
      organization_id: organizationId,
      actor_id: owner.userId,
      action: "invitation.revoked",
      entity: "invitation",
      entity_id: invitationId,
      metadata: { email: invitation.email },
    });
    if (auditError) console.error("[api/team/revoke] audit log insert failed:", auditError);

    return Response.json({
      ok: true,
      warning: auditError ? "The invitation was revoked but could not be recorded in the audit log." : null,
    });
  } catch (error) {
    console.error("[api/team/revoke]", error);
    return jsonError(error instanceof Error ? error.message : "Unexpected server error.", 500);
  }
}
