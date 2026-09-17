"use client";

import * as React from "react";
import { CalendarDays, Clock3 } from "lucide-react";

import { OpportunityActions } from "@/components/dashboard/opportunity-actions";
import { OwnerAvatar } from "@/components/dashboard/owner-avatar";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { StageBadge } from "@/components/dashboard/stage-badge";
import type { Opportunity } from "@/lib/types";
import { closeDateTone, cn, formatCurrency, formatDateShort } from "@/lib/utils";

interface OpportunityListCardProps {
  opportunity: Opportunity;
}

/** Mobile presentation of a table row — keeps every field and action reachable. */
export function OpportunityListCard({ opportunity }: OpportunityListCardProps) {
  const { openOpportunity, today } = usePipeline();
  const tone = closeDateTone(opportunity.expectedCloseDate, today);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openOpportunity(opportunity.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openOpportunity(opportunity.id);
        }
      }}
      className="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors duration-150 hover:border-primary/30 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      aria-label={`Open ${opportunity.company}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{opportunity.company}</p>
          <p className="truncate text-2xs text-muted-foreground">
            {opportunity.contact} · {opportunity.owner}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-sm font-semibold tabular">{formatCurrency(opportunity.value)}</span>
          <OpportunityActions opportunity={opportunity} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StageBadge stage={opportunity.stage} />
        <span className="text-2xs text-muted-foreground">{opportunity.probability}% probability</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5 text-2xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3" aria-hidden="true" />
          {opportunity.age} days old
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1",
            tone === "danger" && "font-medium text-rose-600",
            tone === "warning" && "font-medium text-amber-600",
          )}
        >
          <CalendarDays className="h-3 w-3" aria-hidden="true" />
          {formatDateShort(opportunity.expectedCloseDate)}
        </span>
      </div>
    </div>
  );
}

interface KanbanCardProps {
  opportunity: Opportunity;
  onDragStart: (opportunity: Opportunity) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

export function KanbanCard({
  opportunity,
  onDragStart,
  onDragEnd,
  isDragging,
}: KanbanCardProps) {
  const { openOpportunity, today } = usePipeline();
  const tone = closeDateTone(opportunity.expectedCloseDate, today);

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", opportunity.id);
        onDragStart(opportunity);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group cursor-grab rounded-lg border border-border bg-card p-3 shadow-card transition-all duration-150 hover:border-primary/30 hover:shadow-card-hover active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => openOpportunity(opportunity.id)}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label={`Open ${opportunity.company}`}
        >
          <p className="truncate text-[13px] font-semibold leading-tight">{opportunity.company}</p>
          <p className="mt-0.5 truncate text-2xs text-muted-foreground">{opportunity.contact}</p>
        </button>
        <OpportunityActions opportunity={opportunity} />
      </div>

      <p className="mt-2.5 text-sm font-semibold tabular">{formatCurrency(opportunity.value)}</p>

      <div className="mt-2 space-y-1.5">
        <div className="flex items-center justify-between text-2xs text-muted-foreground">
          <span
            className={cn(
              tone === "danger" && "font-medium text-rose-600",
              tone === "warning" && "font-medium text-amber-600",
            )}
          >
            {formatDateShort(opportunity.expectedCloseDate)}
          </span>
          <span>{opportunity.probability}%</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              opportunity.probability >= 85
                ? "bg-emerald-500"
                : opportunity.probability >= 60
                  ? "bg-blue-500"
                  : opportunity.probability >= 30
                    ? "bg-sky-400"
                    : "bg-slate-300",
            )}
            style={{ width: `${opportunity.probability}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <OwnerAvatar name={opportunity.owner} size="sm" className="h-5 w-5 text-[9px]" />
          <span className="truncate">{opportunity.owner}</span>
        </span>
        <span className="text-2xs text-muted-foreground">{opportunity.age}d</span>
      </div>
    </article>
  );
}
