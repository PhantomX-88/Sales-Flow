"use client";

import * as React from "react";
import {
  AlarmClock,
  CalendarClock,
  CircleCheck,
  ListTodo,
  PencilLine,
  RefreshCw,
import { CentralCTA } from "@/components/dashboard/central-cta";
} from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isAttentionSnoozed,
  snoozeAttentionItem,
  STALE_ACTIVITY_DAYS,
  type AttentionItem,
} from "@/lib/attention";
import { cn } from "@/lib/utils";

const REASON_STYLES: Record<AttentionItem["reason"], { icon: typeof AlarmClock; className: string }> = {
  "overdue-close": { icon: AlarmClock, className: "icon-soft-danger" },
  "overdue-follow-up": { icon: AlarmClock, className: "icon-soft-warning" },
  "missing-next-step": { icon: ListTodo, className: "icon-soft-warning" },
  "stale-activity": { icon: CalendarClock, className: "bg-sky-50 text-sky-600" },
  "no-activity": { icon: CalendarClock, className: "bg-sky-50 text-sky-600" },
};

function QueueRow({
  item,
  onSnooze,
}: {
  item: AttentionItem;
  onSnooze: (id: string) => void;
}) {
  const { openOpportunity, openEditDialog, openActivityLog } = usePipeline();
  const meta = REASON_STYLES[item.reason];
  const Icon = meta.icon;

  const primaryAction =
    item.action === "update-close-date"
      ? { label: "Update close date", onClick: () => openEditDialog(item.opportunityId) }
      : item.action === "log-activity"
        ? { label: "Log activity", onClick: () => openActivityLog(item.opportunityId) }
        : { label: "Open deal", onClick: () => openOpportunity(item.opportunityId) };

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            meta.className,
          )}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-snug">{item.title}</p>
          <p className="mt-0.5 text-2xs text-muted-foreground">{item.detail}</p>
          <p className="mt-0.5 text-2xs text-muted-foreground">Owner · {item.owner}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <Button variant="outline" size="sm" className="h-7 text-2xs" onClick={primaryAction.onClick}>
          {primaryAction.label}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-2xs"
          onClick={() => openOpportunity(item.opportunityId)}
        >
          Open deal
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-2xs text-muted-foreground"
          onClick={() => onSnooze(item.id)}
          aria-label={`Snooze alert for ${item.company} for 7 days`}
        >
          Snooze 7d
        </Button>
      </div>
    </li>
  );
}

/**
 * Needs attention — a small, explainable queue derived from visible deal and
 * activity fields (see lib/attention.ts). One alert per deal; snoozes persist
 * per browser for 7 days; completing the action removes the alert on the next
 * recompute. No AI, no rules engine, no invented samples.
 */
export function NeedsAttentionCard({ className }: { className?: string }) {
  const { attention, isLoading, loadError, openCreateDialog, setView } = usePipeline();
  const [, setSnoozeVersion] = React.useState(0);

  const snooze = React.useCallback((id: string) => {
    snoozeAttentionItem(id);
    setSnoozeVersion((version) => version + 1);
  }, []);

  const visible = attention.filter((item) => !isAttentionSnoozed(item.id));

  if (isLoading) {
    return (
      <Card className={className}>
        <div className="space-y-3 p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className={className}>
        <EmptyState
          icon={RefreshCw}
          title="Needs attention could not load"
          description={loadError}
          actionLabel="Reload"
          onAction={() => window.location.reload()}
        />
      </Card>
    );
  }

  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="space-y-1">
          <h2 className="text-[15px] font-semibold tracking-tight">Needs attention</h2>
          <p className="text-[13px] text-muted-foreground">
            One alert per open deal, from close dates, follow-up due dates and real activity
            history — nothing hidden.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-2xs font-semibold text-muted-foreground">
          {visible.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title="Nothing needs attention"
          description={`Every open deal has a future close date, a next step, and activity logged within the last ${STALE_ACTIVITY_DAYS} days.`}
          actionLabel="Add a deal"
          onAction={openCreateDialog}
          secondaryActionLabel="Go to pipeline"
          onSecondaryAction={() => setView("pipeline")}
        />
      ) : (
        <ul className="flex-1 space-y-3 p-5">
          {visible.map((item) => (
            <QueueRow key={item.id} item={item} onSnooze={snooze} />
          ))}
        </ul>
      )}

      <div className="border-t border-border px-5 py-3 text-2xs text-muted-foreground">
        <PencilLine className="mr-1 inline h-3 w-3" aria-hidden="true" />
        Reasons come straight from the deal record — fix or snooze one and it disappears until the
        condition returns.
      </div>
    </Card>
  );
}
