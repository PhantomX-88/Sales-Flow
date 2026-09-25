"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { Dashboard } from "@/components/dashboard/dashboard";

export default function DashboardRoute() {
  const router = useRouter();
  const { isAuthenticated, isReady, workspaceId } = useAuth();

  React.useEffect(() => {
    if (isReady && !isAuthenticated) router.replace("/");
    if (isReady && isAuthenticated && !workspaceId) router.replace("/onboarding");
  }, [isAuthenticated, isReady, router, workspaceId]);

  if (!isReady || !isAuthenticated || !workspaceId) return null;

  return <Dashboard />;
}
