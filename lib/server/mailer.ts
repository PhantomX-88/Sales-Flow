export interface InvitationEmailInput {
  to: string;
  organizationName: string;
  organizationTag: string;
  inviterName: string;
  acceptUrl: string;
  expiresAt: string;
}

/** Uses a configured public origin in production; request headers are untrusted. */
export function resolveSiteUrl(request: Request): string {
  const configured = process.env.SITE_URL;
  if (configured) {
    let site: URL;
    try {
      site = new URL(configured);
    } catch {
      throw new Error("SITE_URL must be a valid application origin.");
    }
    if (
      !["http:", "https:"].includes(site.protocol) ||
      site.username ||
      site.password ||
      site.pathname !== "/" ||
      site.search ||
      site.hash ||
      (process.env.NODE_ENV === "production" && site.protocol !== "https:")
    ) {
      throw new Error("SITE_URL must be a valid HTTPS origin in production.");
    }
    return site.origin;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SITE_URL must be configured for production invitations.");
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      if (["http:", "https:"].includes(parsedOrigin.protocol) && !parsedOrigin.username && !parsedOrigin.password) {
        return parsedOrigin.origin;
      }
    } catch {
      // Fall through to the local development URL.
    }
  }
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
    console.warn("[mail] RESEND_API_KEY is not set; skipping invitation email.");
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
      console.error(`[mail] Resend returned HTTP ${response.status}.`);
      return { sent: false, error: "The invitation email could not be sent. Share the link manually." };
    }
    return { sent: true, error: null };
  } catch (error) {
    console.error(
      `[mail] Invitation email request failed (${error instanceof Error ? error.name : "unknown error"}).`,
    );
    return { sent: false, error: "The invitation email could not be sent. Share the link manually." };
  }
}
