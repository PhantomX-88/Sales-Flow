"use client";

import * as React from "react";
import { CheckCircle2, Circle, CircleAlert, Clock } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { TaskItem } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";

const TONE_META: Record<
  TaskItem["tone"],
  { label: string; icon: typeof CircleAlert; className: string }
> = {
  danger: { label: "Overdue", icon: CircleAlert, className: "bg-rose-50 text-rose-600" },
  warning: { label: "Closing soon", icon: Clock, className: "bg-amber-50 text-amber-600" },
  info: { label: "Stalled", icon: Clock, className: "bg-sky-50 text-sky-600" },
};

export function TasksView() {
  const { tasks, openOpportunity } = usePipeline();
  const [completed, setCompleted] = React.useState<string[]>([]);

  const toggle = (id: string) =>
    setCompleted((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  const remaining = tasks.filter((task) => !completed.includes(task.id));
  const progress = tasks.length ? ((tasks.length - remaining.length) / tasks.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Follow-ups generated from your pipeline: overdue close dates, deals closing this week and stalled opportunities."
      />

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-semibold">
              {remaining.length} of {tasks.length} {pluralize(tasks.length, "task")} remaining
            </p>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              Tasks are derived live from opportunity stage, age and expected close date.
            </p>
          </div>
          {completed.length ? (
            <Button variant="ghost" size="sm" onClick={() => setCompleted([])}>
              Reset completed
            </Button>
          ) : null}
        </div>
        <Progress value={progress} className="mt-3 h-1.5" indicatorClassName="bg-emerald-500" />
      </Card>

      {tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckCircle2}
            title="Nothing needs attention"
            description="Every open opportunity is on track — no overdue close dates or stalled deals right now."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isDone = completed.includes(task.id);
            const meta = TONE_META[task.tone];
            const Icon = meta.icon;

            return (
              <Card
                key={task.id}
                className={cn(
                  "flex flex-col gap-3 p-4 transition-colors duration-150 sm:flex-row sm:items-center sm:justify-between",
                  isDone && "opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(task.id)}
                    aria-pressed={isDone}
                    aria-label={isDone ? `Mark "${task.title}" as open` : `Complete "${task.title}"`}
                    className="mt-0.5 shrink-0 rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-[13px] font-semibold leading-snug",
                        isDone && "line-through",
                      )}
                    >
                      {task.title}
                    </p>
                    <p className="mt-0.5 text-2xs text-muted-foreground">{task.detail}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium",
                      meta.className,
                    )}
                  >
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    {task.dueLabel}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-2xs"
                    onClick={() => openOpportunity(task.opportunityId)}
                  >
                    Open deal
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
