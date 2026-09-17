"use client";

import { CircleCheck, ShieldAlert, Target } from "lucide-react";

import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatCurrency, formatCurrencyCompact, formatPercent } from "@/lib/utils";

interface ForecastRowProps {
  label: string;
  value: number;
  hint: string;
  tone?: "default" | "success" | "muted";
}

function ForecastRow({ label, value, hint, tone = "default" }: ForecastRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help border-b border-dotted border-border text-[13px] text-muted-foreground">
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
      <span
        className={cn(
          "text-[13px] font-semibold tabular",
          tone === "success" && "text-emerald-600",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export function ForecastCard({ className }: { className?: string }) {
  const { forecast, isLoading, metadata } = usePipeline();

  if (isLoading) {
    return (
      <Card className={className}>
        <div className="space-y-3 p-5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-3 w-52" />
        </div>
      </Card>
    );
  }

  const attainment = Math.min(forecast.attainmentPercent, 100);
  const isOnTrack = forecast.status === "on-track";

  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div className="space-y-1">
          <h2 className="text-[15px] font-semibold tracking-tight">Forecast</h2>
          <p className="text-[13px] text-muted-foreground">
            {metadata.period} · quarterly target {formatCurrencyCompact(forecast.quarterlyTarget)}
          </p>
        </div>
        <Badge variant={isOnTrack ? "success" : "warning"} className="shrink-0">
          {isOnTrack ? (
            <CircleCheck className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ShieldAlert className="h-3 w-3" aria-hidden="true" />
          )}
          {isOnTrack ? "On track" : "At risk"}
        </Badge>
      </div>

      <div className="space-y-5 p-5">
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Closed revenue
              </p>
              <p className="text-[24px] font-bold leading-none tracking-tight tabular text-emerald-600">
                {formatCurrency(forecast.closedRevenue)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Target
              </p>
              <p className="text-sm font-semibold tabular">
                {formatCurrency(forecast.quarterlyTarget)}
              </p>
            </div>
          </div>

          <Progress
            value={attainment}
            className="h-2.5"
            indicatorClassName={isOnTrack ? "bg-emerald-500" : "bg-primary"}
            aria-label="Quarterly target attainment"
          />
          <div className="flex items-center justify-between text-2xs text-muted-foreground">
            <span>{formatPercent(forecast.attainmentPercent, 0)} of quarterly target achieved</span>
            <span>
              {forecast.gapToTarget > 0
                ? `${formatCurrency(forecast.gapToTarget)} to go`
                : "Target exceeded"}
            </span>
          </div>
        </div>

        <div className="divide-y divide-border rounded-lg border border-border bg-muted/30 px-3.5 py-1">
          <ForecastRow
            label="Commit"
            value={forecast.commit}
            hint="Open deals already at 85% probability or higher"
            tone="default"
          />
          <ForecastRow
            label="Best case"
            value={forecast.bestCase}
            hint="Every open deal closing at full value"
          />
          <ForecastRow
            label="Weighted forecast"
            value={forecast.weightedForecast}
            hint="Open pipeline weighted by current win probability"
          />
          <ForecastRow
            label="Gap to target"
            value={forecast.gapToTarget}
            hint="Quarterly target minus closed revenue"
            tone="muted"
          />
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full",
              isOnTrack ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600",
            )}
            aria-hidden="true"
          >
            <Target className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">
              Forecast confidence {formatPercent(forecast.confidencePercent, 0)}
            </p>
            <p className="text-2xs text-muted-foreground">
              Closed revenue plus weighted pipeline vs. quarterly target
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
