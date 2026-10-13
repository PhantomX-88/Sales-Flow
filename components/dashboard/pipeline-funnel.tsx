"use client";

import { TrendingDown } from "lucide-react";

import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatCurrency, formatCurrencyCompact, STAGE_DOT_STYLES } from "@/lib/utils";

export function PipelineFunnel({ className }: { className?: string }) {
  const { funnel, isLoading, currency } = usePipeline();

  if (isLoading) {
    return (
      <Card className={className}>
        <div className="space-y-2 p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="space-y-4 p-5 pt-0">
          {[90, 74, 58, 42, 26, 16].map((width, index) => (
            <Skeleton key={index} className="h-9" style={{ width: `${width}%` }} />
          ))}
        </div>
      </Card>
    );
  }

  const maxCount = Math.max(...funnel.map((stage) => stage.reachedCount), 1);
  const totalDeals = funnel.reduce((total, stage) => total + stage.reachedCount, 0);

  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="space-y-1">
          <h2 className="text-[15px] font-semibold tracking-tight">Deals by stage</h2>
          <p className="text-[13px] text-muted-foreground">
            How many deals sit in each stage right now — a snapshot, not stage-to-stage conversion
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-2xs font-semibold text-muted-foreground">
          <TrendingDown className="h-3 w-3" aria-hidden="true" />
          {totalDeals} total
        </span>
      </div>

      <div className="flex-1 space-y-3.5 p-5">
        {funnel.map((stage, index) => {
          const width = Math.max((stage.reachedCount / maxCount) * 100, 6);

          return (
            <div key={stage.stage} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn("h-2 w-2 shrink-0 rounded-full", STAGE_DOT_STYLES[stage.stage])}
                    aria-hidden="true"
                  />
                  <span className="truncate font-medium">{stage.stage}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3 text-2xs text-muted-foreground">
                  <span className="tabular">
                    {stage.reachedCount} {stage.reachedCount === 1 ? "deal" : "deals"}
                  </span>
                  <span className="tabular font-medium text-foreground/80">
                    {formatCurrencyCompact(stage.reachedValue, currency)}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="h-7 flex-1 overflow-hidden rounded-md bg-muted/70">
                      <div
                        className={cn(
                          "flex h-full items-center rounded-md px-2 text-2xs font-semibold text-white transition-all duration-300",
                          index === 0
                            ? "fill-primary"
                            : index === 1
                              ? "fill-sky-400"
                              : index === 2
                                ? "fill-blue-600"
                                : index === 3
                                  ? "fill-indigo-600"
                                  : "fill-success",
                        )}
                        style={{ width: `${width}%` }}
                      >
                        {width > 18 ? formatCurrencyCompact(stage.reachedValue, currency) : null}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {stage.stage}: {stage.reachedCount} deals · {formatCurrency(stage.reachedValue, currency)}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border px-5 py-3 text-2xs text-muted-foreground">
        Counts reflect where deals are today. SalesFlow does not track when deals entered a stage,
        so no historical conversion is shown.
      </div>
    </Card>
  );
}
