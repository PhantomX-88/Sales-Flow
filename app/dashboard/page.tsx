"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { Dashboard } from "@/components/dashboard/dashboard";

export default function DashboardRoute() {
  const router = useRouter();
  const { isAuthenticated, isReady } = useAuth();

  React.useEffect(() => {
    if (isReady && !isAuthenticated) router.replace("/");
  }, [isAuthenticated, isReady, router]);

  if (!isReady || !isAuthenticated) return null;

  return <Dashboard />;
}
