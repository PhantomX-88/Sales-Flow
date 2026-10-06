export interface InvitationEmailInput {
  to: string;
  organizationName: string;
  organizationTag: string;
  inviterName: string;
  acceptUrl: string;
  expiresAt: string;
}

/** SITE_URL (prod) → request origin (dev proxy) → localhost fallback. */
export function resolveSiteUrl(request: Request): string {
  const configured = process.env.SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const origin = request.headers.get("origin");
  if (origin) return origin.replace(/\/+$/, "");
  return "http://localhost:3000";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function invitationHtml(input: InvitationEmailInput): string {
  const org = escapeHtml(input.organizationName || "the organization");
  const tagLine = input.organizationTag ? ` (${escapeHtml(input.organizationTag)})` : "";
  const expiry = new Date(input.expiresAt).toUTCString();
  return [
    `<p>${escapeHtml(input.inviterName || "A team owner")} invited you to join <strong>${org}</strong>${tagLine} on SalesFlow as a sales representative.</p>`,
    `<p><a href="${escapeHtml(input.acceptUrl)}">Accept your invitation</a></p>`,
    `<p>This link expires on ${expiry}. If you were not expecting it, you can ignore this email.</p>`,
  ].join("\n");
}

/**
 * Sends the invitation through our own sender (Resend). Supabase Auth's
 * invite email is intentionally NOT used — identity is handled by Supabase,
 * invitation content and role by us.
 *
 * Returns { sent: false, error: null } when RESEND_API_KEY is unset (local
 * development): the route still returns the accept link so invites remain
 * testable without an email provider.
 */
export async function sendInvitationEmail(
  input: InvitationEmailInput,
): Promise<{ sent: boolean; error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[mail] RESEND_API_KEY is not set; skipping invitation email to ${input.to}.`);
    return { sent: false, error: null };
  }

  const from = process.env.RESEND_FROM ?? "SalesFlow <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: `Join ${input.organizationName || "your team"} on SalesFlow`,
        html: invitationHtml(input),
        text: [
          `${input.inviterName || "A team owner"} invited you to join ${input.organizationName} on SalesFlow as a sales representative.`,
          `Accept your invitation: ${input.acceptUrl}`,
          `This link expires on ${new Date(input.expiresAt).toUTCString()}.`,
        ].join("\n\n"),
      }),
    });

    if (!response.ok) {
      console.error(`[mail] Resend returned ${response.status}: ${await response.text()}`);
      return { sent: false, error: "The invitation email could not be sent. Share the link manually." };
    }
    return { sent: true, error: null };
  } catch (error) {
    console.error("[mail] Failed to send invitation email:", error);
    return { sent: false, error: "The invitation email could not be sent. Share the link manually." };
  }
}
