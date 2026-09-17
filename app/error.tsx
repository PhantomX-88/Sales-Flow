"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/dashboard/error-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <ErrorState
          description="We couldn't load your pipeline data. Try again or reload the dashboard."
          onRetry={reset}
        />
      </div>
    </div>
  );
}
