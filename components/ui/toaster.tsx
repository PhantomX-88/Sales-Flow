"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

import { useToast, type ToastVariant } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const ICONS = {
  default: Info,
  success: CheckCircle2,
  destructive: AlertTriangle,
} as const;

const ICON_TONES: Record<ToastVariant, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-50 text-emerald-600",
  destructive: "bg-rose-50 text-rose-600",
};

const BORDER_TONES: Record<ToastVariant, string> = {
  default: "border-border",
  success: "border-emerald-200",
  destructive: "border-rose-200",
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center p-4 sm:justify-end"
      role="region"
      aria-label="Notifications"
    >
      <ol className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map((item) => {
          const Icon = ICONS[item.variant];

          return (
            <li
              key={item.id}
              role="status"
              aria-live="polite"
              className={cn(
                "pointer-events-auto flex animate-fade-in items-start gap-3 rounded-xl border bg-card p-4 shadow-popover",
                BORDER_TONES[item.variant],
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  ICON_TONES[item.variant],
                )}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </span>

              <div className="grid min-w-0 flex-1 gap-1">
                {item.title ? <p className="text-sm font-semibold leading-snug">{item.title}</p> : null}
                {item.description ? (
                  <p className="text-[13px] leading-snug text-muted-foreground">{item.description}</p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
