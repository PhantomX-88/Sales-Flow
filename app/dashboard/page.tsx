"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { Dashboard } from "@/components/dashboard/dashboard";

export default function DashboardRoute() {
  const router = useRouter();
  const { isAuthenticated, isReady, organizationId, organization } = useAuth();

  React.useEffect(() => {
    if (isReady && !isAuthenticated) router.replace("/");
    if (isReady && isAuthenticated && (!organizationId || !organization?.onboardingCompleted)) router.replace("/onboarding");
  }, [isAuthenticated, isReady, organization?.onboardingCompleted, organizationId, router]);

  if (!isReady || !isAuthenticated || !organizationId || !organization?.onboardingCompleted) return null;

  return <Dashboard />;
}
