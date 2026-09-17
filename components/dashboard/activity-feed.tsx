"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRightLeft,
  CalendarCheck,
  CircleX,
  FileText,
  Mail,
  NotebookPen,
  Phone,
  TriangleAlert,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";

import { ActivitySkeleton } from "@/components/dashboard/loading-skeleton";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ActivityType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const ACTIVITY_STYLES: Record<ActivityType, { icon: LucideIcon; className: string }> = {
  proposal: { icon: FileText, className: "bg-blue-50 text-blue-600" },
  stage_change: { icon: ArrowRightLeft, className: "bg-indigo-50 text-indigo-600" },
  lead: { icon: UserPlus, className: "bg-sky-50 text-sky-600" },
  overdue: { icon: TriangleAlert, className: "bg-amber-50 text-amber-600" },
  won: { icon: Trophy, className: "bg-emerald-50 text-emerald-600" },
  lost: { icon: CircleX, className: "bg-rose-50 text-rose-600" },
  note: { icon: NotebookPen, className: "bg-slate-100 text-slate-600" },
  call: { icon: Phone, className: "bg-violet-50 text-violet-600" },
  email: { icon: Mail, className: "bg-cyan-50 text-cyan-600" },
  meeting: { icon: Users, className: "bg-teal-50 text-teal-600" },
};

interface ActivityFeedProps {
  limit?: number;
  showViewAll?: boolean;
  className?: string;
}

export function ActivityFeed({ limit = 5, showViewAll = false, className }: ActivityFeedProps) {
  const { activities, isLoading, openOpportunity, setView } = usePipeline();

  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="space-y-1">
          <h2 className="text-[15px] font-semibold tracking-tight">Recent activity</h2>
          <p className="text-[13px] text-muted-foreground">
            Deals, stage moves and follow-ups across the team
          </p>
        </div>
        {showViewAll ? (
          <Button variant="ghost" size="sm" onClick={() => setView("activities")}>
            View all
          </Button>
        ) : null}
      </div>

      <div className="flex-1 p-5">
        {isLoading ? (
          <ActivitySkeleton rows={limit} />
        ) : activities.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            No activity recorded yet.
          </p>
        ) : (
          <ol className="relative space-y-4">
            {activities.slice(0, limit).map((activity) => {
              const { icon: Icon, className: iconClassName } = ACTIVITY_STYLES[activity.type];

              return (
                <li key={activity.id} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      iconClassName,
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {activity.opportunityId ? (
                      <button
                        type="button"
                        onClick={() => openOpportunity(activity.opportunityId as string)}
                        className="rounded text-left text-[13px] font-medium leading-snug text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      >
                        {activity.text}
                      </button>
                    ) : (
                      <p className="text-[13px] font-medium leading-snug text-foreground">
                        {activity.text}
                      </p>
                    )}
                    <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted-foreground">
                      <CalendarCheck className="h-3 w-3" aria-hidden="true" />
                      {activity.time}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}
