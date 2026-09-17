"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChartRangeKey } from "@/lib/types";
import { formatCurrency, formatCurrencyAxis, formatCurrencyCompact } from "@/lib/utils";

const CHART_COLORS = {
  pipeline: "#2563EB",
  won: "#059669",
} as const;

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: { dataKey?: string | number; value?: number; name?: string }[];
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[11rem] rounded-lg border border-border bg-popover p-3 shadow-popover">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    entry.dataKey === "won" ? CHART_COLORS.won : CHART_COLORS.pipeline,
                }}
                aria-hidden="true"
              />
              {entry.name}
            </span>
            <span className="text-xs font-semibold tabular text-foreground">
              {formatCurrency(entry.value ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const RANGE_SLICES: Record<ChartRangeKey, { months: number; offset: number; label: string }> = {
  "this-quarter": { months: 3, offset: 0, label: "Jul – Sep 2026" },
  "last-quarter": { months: 3, offset: 3, label: "Apr – Jun 2026" },
  "this-year": { months: 6, offset: 0, label: "Apr – Sep 2026" },
};

export function PipelineChart({ className }: { className?: string }) {
  const { monthlyRevenue, chartRange, isLoading } = usePipeline();

  const data = React.useMemo(() => {
    const slice = RANGE_SLICES[chartRange];
    const end = monthlyRevenue.length - slice.offset;
    return monthlyRevenue.slice(Math.max(end - slice.months, 0), Math.max(end, 1));
  }, [chartRange, monthlyRevenue]);

  const totals = React.useMemo(
    () =>
      data.reduce(
        (accumulator, point) => ({
          pipeline: accumulator.pipeline + point.pipeline,
          won: accumulator.won + point.won,
        }),
        { pipeline: 0, won: 0 },
      ),
    [data],
  );

  const conversion =
    totals.pipeline > 0 ? ((totals.won / totals.pipeline) * 100).toFixed(1) : "0.0";

  if (isLoading) {
    return (
      <Card className={className}>
        <div className="space-y-2 p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="px-5 pb-5">
          <Skeleton className="h-[264px] w-full" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-[15px] font-semibold tracking-tight">Pipeline &amp; Revenue</h2>
          <p className="text-[13px] text-muted-foreground">
            Pipeline movement over the last 6 months · {RANGE_SLICES[chartRange].label}
          </p>
        </div>
        <div className="flex gap-5">
          <div>
            <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Pipeline
            </p>
            <p className="text-sm font-semibold tabular">{formatCurrencyCompact(totals.pipeline)}</p>
          </div>
          <div>
            <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Closed
            </p>
            <p className="text-sm font-semibold tabular text-emerald-600">
              {formatCurrencyCompact(totals.won)}
            </p>
          </div>
          <div>
            <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              Conversion
            </p>
            <p className="text-sm font-semibold tabular">{conversion}%</p>
          </div>
        </div>
      </div>

      <div className="p-5 pt-6">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                dy={8}
                tick={{ fill: "#64748B", fontSize: 12 }}
              />
              <YAxis
                tickFormatter={formatCurrencyAxis}
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: "#64748B", fontSize: 12 }}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: "#CBD5E1", strokeWidth: 1, strokeDasharray: "4 4" }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={32}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: "#64748B", paddingBottom: 8 }}
              />
              <Area
                type="monotone"
                dataKey="pipeline"
                name="Pipeline value"
                stroke={CHART_COLORS.pipeline}
                strokeWidth={2}
                fill={CHART_COLORS.pipeline}
                fillOpacity={0.12}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="won"
                name="Closed revenue"
                stroke={CHART_COLORS.won}
                strokeWidth={2}
                fill={CHART_COLORS.won}
                fillOpacity={0.12}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
