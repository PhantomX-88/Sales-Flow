"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load your pipeline data.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50/50 px-6 py-16 text-center"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-600">
        <TriangleAlert className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="text-[13px] text-muted-foreground">{description}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry ?? (() => window.location.reload())}>
        <RotateCcw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
