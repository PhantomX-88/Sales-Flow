"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Card } from "@/components/ui/card";
import { TrendIndicator } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatTrendValue } from "@/lib/metrics";

interface MetricCardProps {
  label: string;
  value: string;
  supporting: string;
  trend: TrendIndicator | null;
  footnote?: string;
  icon: LucideIcon;
}

function TrendBadge({ trend }: { trend: TrendIndicator | null }) {
  if (!trend) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-2xs font-medium text-muted-foreground">
        <Minus className="h-3 w-3" aria-hidden="true" />
        No prior data
      </span>
    );
  }

  const isPositive = trend.value > 0;
  const isNegative = trend.value < 0;
  const Icon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-semibold tabular",
        isPositive && "border-emerald-200 bg-emerald-50 text-emerald-700",
        isNegative && "border-rose-200 bg-rose-50 text-rose-700",
        !isPositive && !isNegative && "border-border bg-muted/60 text-muted-foreground",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {formatTrendValue(trend.value, trend.kind)}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  supporting,
  trend,
  footnote,
  icon: Icon,
}: MetricCardProps) {
  return (
    <Card className="group p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-150 group-hover:bg-primary/15">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <TrendBadge trend={trend} />
      </div>

      <p className="mt-4 text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-[26px] font-bold leading-none tracking-tight tabular sm:text-[28px]">
        {value}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-2xs text-muted-foreground">{supporting}</p>
        {trend ? <p className="text-2xs text-muted-foreground/80">{trend.label}</p> : null}
      </div>

      {footnote ? (
        <p className="mt-2 border-t border-border pt-2 text-2xs font-medium text-muted-foreground">
          {footnote}
        </p>
      ) : null}
    </Card>
  );
}
