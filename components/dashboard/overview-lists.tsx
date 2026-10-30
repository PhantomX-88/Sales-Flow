"use client";

import * as React from "react";
import { Activity, CalendarClock, CircleAlert, Clock3, Plus, ArrowUpRight } from "lucide-react";

import { ACTIVITY_STYLES } from "@/components/dashboard/activity-feed";
import { StageBadge } from "@/components/dashboard/stage-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import type { TaskItem } from "@/lib/types";
import { cn, formatCurrencyCompact, formatDateShort } from "@/lib/utils";

const TASK_TONES: Record<TaskItem["tone"], { label: string; icon: typeof Clock3; className: string }> = {
  danger: { label: "Overdue", icon: CircleAlert, className: "icon-soft-danger" },
  warning: { label: "Due soon", icon: Clock3, className: "icon-soft-warning" },
  info: { label: "Follow-up", icon: CalendarClock, className: "icon-soft-primary" },
};

export function RecentOpportunitiesCard() {
  const { opportunities, isLoading, currency, openOpportunity, setView, openCreateDialog } = usePipeline();
  const recent = React.useMemo(
    () => [...opportunities].sort((a, b) => b.createdDate.localeCompare(a.createdDate)).slice(0, 5),
    [opportunities],
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Recent opportunities</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">New and recently added deals</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setView("pipeline")}>
          View all <ArrowUpRight aria-hidden="true" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-5" aria-label="Loading recent opportunities">
          {[0, 1, 2].map((row) => <div key={row} className="h-12 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : recent.length ? (
        <ul className="divide-y divide-border">
          {recent.map((opportunity) => (
            <li key={opportunity.id}>
              <button
                type="button"
                onClick={() => openOpportunity(opportunity.id)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary" aria-hidden="true">
                  {opportunity.company.trim().slice(0, 1).toUpperCase() || "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{opportunity.company}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{opportunity.contact}</span>
                </span>
                <span className="hidden shrink-0 text-right sm:block">
                  <span className="block text-[13px] font-semibold tabular">{formatCurrencyCompact(opportunity.value, currency)}</span>
                  <span className="mt-1 block text-2xs text-muted-foreground">Added {formatDateShort(opportunity.createdDate)}</span>
                </span>
                <StageBadge stage={opportunity.stage} className="hidden md:inline-flex" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center px-5 py-8 text-center">
          <p className="text-sm font-medium">No opportunities yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add a deal to start building your pipeline.</p>
          <Button className="mt-4" size="sm" onClick={openCreateDialog}><Plus /> Add opportunity</Button>
        </div>
      )}
    </Card>
  );
}

export function TasksActivityCard() {
  const { tasks, activities, isLoading, openOpportunity, setView } = usePipeline();
  const visibleTasks = tasks.slice(0, 3);
  const visibleActivities = activities.slice(0, 2);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Tasks &amp; activity</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Follow-ups and recent team updates</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setView("tasks")}>
          View all <ArrowUpRight aria-hidden="true" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-5" aria-label="Loading tasks and activity">
          {[0, 1, 2].map((row) => <div key={row} className="h-12 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : visibleTasks.length || visibleActivities.length ? (
        <div className="space-y-4 p-5">
          {visibleTasks.length ? (
            <ul className="space-y-3">
              {visibleTasks.map((task) => {
                const tone = TASK_TONES[task.tone];
                const Icon = tone.icon;
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => openOpportunity(task.opportunityId)}
                      className="flex w-full items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone.className)} aria-hidden="true">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{task.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{task.detail}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-2xs font-medium text-muted-foreground">{task.dueLabel}</span>
                        <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-2xs text-muted-foreground">{tone.label}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No follow-ups need attention.</p>
          )}

          {visibleActivities.length ? (
            <div className="border-t border-border pt-3">
              <p className="mb-3 flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3.5 w-3.5" aria-hidden="true" /> Recent updates
              </p>
              <ul className="space-y-2.5">
                {visibleActivities.map((activity) => {
                  const { icon: Icon, className } = ACTIVITY_STYLES[activity.type];
                  return (
                    <li key={activity.id} className="flex min-w-0 items-center gap-2.5">
                      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", className)} aria-hidden="true">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-foreground">{activity.text}</span>
                      <span className="shrink-0 text-2xs text-muted-foreground">{activity.time}</span>
                    </li>
                  );
                })}
              </ul>
              <Button variant="link" size="sm" className="mt-2 h-auto px-0" onClick={() => setView("activities")}>
                Open activity feed
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">Tasks and activity will appear here as your team works.</p>
      )}
    </Card>
  );
}
