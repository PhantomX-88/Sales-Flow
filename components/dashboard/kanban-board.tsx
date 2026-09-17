"use client";

import * as React from "react";
import { Info, Plus } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { KanbanCard } from "@/components/dashboard/opportunity-card";
import { TableSkeleton } from "@/components/dashboard/loading-skeleton";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import type { Opportunity, PipelineStage } from "@/lib/types";
import { cn, formatCurrencyCompact, STAGE_DOT_STYLES } from "@/lib/utils";

export function KanbanBoard() {
  const {
    filtered,
    kanbanStages,
    moveStage,
    isLoading,
    settings,
    clearAllFilters,
    openCreateDialog,
  } = usePipeline();

  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = React.useState<PipelineStage | null>(null);

  const stages = React.useMemo(
    () =>
      settings.showClosedLostColumn
        ? kanbanStages
        : kanbanStages.filter((stage) => stage !== "Closed Lost"),
    [kanbanStages, settings.showClosedLostColumn],
  );

  const columns = React.useMemo(
    () =>
      stages.map((stage) => {
        const items = filtered.filter((opportunity) => opportunity.stage === stage);
        return {
          stage,
          items,
          total: items.reduce((sum, opportunity) => sum + opportunity.value, 0),
        };
      }),
    [filtered, stages],
  );

  const handleDragStart = React.useCallback((opportunity: Opportunity) => {
    setDraggingId(opportunity.id);
  }, []);

  const handleDragEnd = React.useCallback(() => {
    setDraggingId(null);
    setDragOverStage(null);
  }, []);

  if (isLoading) return <TableSkeleton rows={5} />;

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-card">
        <EmptyState
          title="No opportunities found"
          description="Try changing your filters or search terms. Nothing in the current pipeline matches this combination."
          actionLabel="Clear filters"
          onAction={clearAllFilters}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        Drag a card between stages to update it — probability, metrics and the funnel update
        instantly. On touch devices, use the card menu and choose “Change stage”.
      </p>

      <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-4">
          {columns.map(({ stage, items, total }) => {
            const isDragTarget = dragOverStage === stage;

            return (
              <section
                key={stage}
                aria-label={`${stage} column, ${items.length} opportunities`}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (dragOverStage !== stage) setDragOverStage(stage);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    setDragOverStage((current) => (current === stage ? null : current));
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData("text/plain");
                  if (id) moveStage(id, stage);
                  setDragOverStage(null);
                  setDraggingId(null);
                }}
                className={cn(
                  "flex w-[276px] shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors duration-150",
                  isDragTarget ? "border-primary/50 bg-primary/5" : "border-border",
                )}
              >
                <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", STAGE_DOT_STYLES[stage])}
                      aria-hidden="true"
                    />
                    <h3 className="truncate text-[13px] font-semibold">{stage}</h3>
                    <span className="rounded-full bg-card px-1.5 py-0.5 text-2xs font-medium tabular text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <span className="shrink-0 text-2xs font-semibold tabular text-muted-foreground">
                    {formatCurrencyCompact(total)}
                  </span>
                </header>

                <div className="flex min-h-[8rem] flex-1 flex-col gap-2 p-2.5">
                  {items.length === 0 ? (
                    <div
                      className={cn(
                        "flex flex-1 items-center justify-center rounded-lg border border-dashed border-border p-4 text-center text-2xs text-muted-foreground",
                        isDragTarget && "border-primary/50 text-primary",
                      )}
                    >
                      {isDragTarget ? "Drop here" : "No deals in this stage"}
                    </div>
                  ) : (
                    items.map((opportunity) => (
                      <KanbanCard
                        key={opportunity.id}
                        opportunity={opportunity}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        isDragging={draggingId === opportunity.id}
                      />
                    ))
                  )}

                  {stage === "Lead" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-auto justify-start text-muted-foreground"
                      onClick={openCreateDialog}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add opportunity
                    </Button>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
