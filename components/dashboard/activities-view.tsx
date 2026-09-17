"use client";

import * as React from "react";

import { ACTIVITY_STYLES } from "@/components/dashboard/activity-feed";
import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActivityType } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS: { value: string; label: string; types: ActivityType[] | null }[] = [
  { value: "all", label: "All", types: null },
  { value: "deals", label: "Deals", types: ["proposal", "won", "lost", "note"] },
  { value: "stage", label: "Stage moves", types: ["stage_change"] },
  { value: "follow-ups", label: "Follow-ups", types: ["overdue", "lead", "call", "email", "meeting"] },
];

export function ActivitiesView() {
  const { activities, openOpportunity } = usePipeline();
  const [filter, setFilter] = React.useState("all");

  const activeFilter = FILTERS.find((entry) => entry.value === filter) ?? FILTERS[0];
  const filtered = React.useMemo(
    () =>
      activeFilter.types === null
        ? activities
        : activities.filter((activity) => activeFilter.types?.includes(activity.type)),
    [activities, activeFilter],
  );

  const counts = React.useMemo(() => {
    const won = activities.filter((activity) => activity.type === "won").length;
    const overdue = activities.filter((activity) => activity.type === "overdue").length;
    const stageMoves = activities.filter((activity) => activity.type === "stage_change").length;
    return { won, overdue, stageMoves };
  }, [activities]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activities"
        description="Every logged touchpoint across the pipeline — deals, stage moves and follow-ups."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Closed won events", value: counts.won },
          { label: "Stage moves", value: counts.stageMoves },
          { label: "Overdue follow-ups", value: counts.overdue },
        ].map((stat) => (
          <Card key={stat.label} className="p-5">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-1 text-[22px] font-bold leading-none tabular">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-[15px] font-semibold tracking-tight">Activity log</h2>
            <p className="text-[13px] text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            </p>
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList aria-label="Filter activities by type">
              {FILTERS.map((entry) => (
                <TabsTrigger key={entry.value} value={entry.value}>
                  {entry.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No activity of this type"
            description="Nothing matches this activity filter yet. Switch filters or log a new activity from an opportunity."
          />
        ) : (
          <ol className="divide-y divide-border">
            {filtered.map((activity) => {
              const { icon: Icon, className } = ACTIVITY_STYLES[activity.type];

              return (
                <li key={activity.id} className="flex items-start gap-3.5 p-5">
                  <span
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      className,
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium leading-snug">{activity.text}</p>
                    <p className="mt-0.5 text-2xs text-muted-foreground">
                      {activity.time} · {activity.type.replace("_", " ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {activity.opportunityId ? (
                      <>
                        <Badge variant="outline" className="hidden sm:inline-flex">
                          {activity.opportunityId}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-2xs"
                          onClick={() => openOpportunity(activity.opportunityId as string)}
                        >
                          Open deal
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}
