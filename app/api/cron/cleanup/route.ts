import { timingSafeEqual } from "node:crypto";

import { getAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";

function hasValidAuthorization(request: Request, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[api/cron/cleanup] CRON_SECRET is not configured.");
    return Response.json({ error: "Cron cleanup is not configured." }, { status: 500 });
  }
  if (!hasValidAuthorization(request, secret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const admin = getAdminClient();
    const [invitationExpiry, softDeletePurge] = await Promise.all([
      admin.rpc("expire_stale_invitations"),
      admin.rpc("purge_expired_soft_deletes"),
    ]);

    if (invitationExpiry.error || softDeletePurge.error) {
      console.error("[api/cron/cleanup] Cleanup failed.", {
        invitationExpiryCode: invitationExpiry.error?.code ?? null,
        softDeletePurgeCode: softDeletePurge.error?.code ?? null,
      });
      return Response.json({ error: "Scheduled cleanup failed." }, { status: 500 });
    }

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      `[api/cron/cleanup] Unexpected server error (${error instanceof Error ? error.name : "unknown"}).`,
    );
    return Response.json({ error: "Scheduled cleanup failed." }, { status: 500 });
  }
}
