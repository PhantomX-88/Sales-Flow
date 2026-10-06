"use client";

import { Suspense } from "react";

import { AcceptInvitePage } from "@/components/auth/accept-invite-page";

export default function AcceptInviteRoute() {
  return (
    <Suspense fallback={null}>
      <AcceptInvitePage />
    </Suspense>
  );
}
