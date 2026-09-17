"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { OwnerAvatar } from "@/components/dashboard/owner-avatar";
import { PerformanceSkeleton } from "@/components/dashboard/loading-skeleton";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RepPerformance } from "@/lib/types";
import { formatCurrency, formatCurrencyAxis, formatPercent } from "@/lib/utils";

interface PerformanceTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: { dataKey?: string | number; value?: number; name?: string }[];
}

function PerformanceTooltip({ active, payload, label }: PerformanceTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[10rem] rounded-lg border border-border bg-popover p-3 shadow-popover">
      <p className="text-xs font-semibold">{label}</p>
      <div className="mt-1.5 space-y-1">
        {payload.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
            <span className="text-2xs text-muted-foreground">{entry.name}</span>
            <span className="text-xs font-semibold tabular">{formatCurrency(entry.value ?? 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerformanceTable({ reps }: { reps: RepPerformance[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-9 px-3">Rep</TableHead>
            <TableHead className="h-9 px-3 text-right">Pipeline</TableHead>
            <TableHead className="h-9 px-3 text-right">Won</TableHead>
            <TableHead className="h-9 px-3 text-right">Win rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reps.map((rep, index) => (
            <TableRow key={rep.id} className="hover:bg-muted/40">
              <TableCell className="px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <OwnerAvatar name={rep.name} initials={rep.initials} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{rep.name}</p>
                    <p className="truncate text-2xs text-muted-foreground">
                      {index === 0 ? "Top performer · " : ""}
                      {rep.openCount} open
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-3 py-2.5 text-right text-[13px] font-semibold tabular">
                {formatCurrency(rep.pipeline)}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-right text-[13px] tabular text-emerald-600">
                {formatCurrency(rep.won)}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-right text-[13px] tabular">
                {formatPercent(rep.winRate, 0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function SalesPerformance({ className }: { className?: string }) {
  const { repPerformance, isLoading } = usePipeline();

  const chartData = repPerformance.map((rep) => ({
    name: rep.name.split(" ")[0],
    fullName: rep.name,
    pipeline: Math.round(rep.pipeline),
    won: Math.round(rep.won),
  }));

  return (
    <Card className={className}>
      <div className="border-b border-border p-5">
        <h2 className="text-[15px] font-semibold tracking-tight">Sales performance</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Open pipeline and closed revenue by rep
        </p>
      </div>

      {isLoading ? (
        <div className="p-5">
          <PerformanceSkeleton />
        </div>
      ) : (
        <>
          <div className="h-[190px] px-2 pt-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
                barGap={2}
              >
                <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#E2E8F0" />
                <XAxis
                  type="number"
                  tickFormatter={formatCurrencyAxis}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748B", fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tick={{ fill: "#0F172A", fontSize: 12 }}
                />
                <Tooltip content={<PerformanceTooltip />} cursor={{ fill: "#F1F5F9" }} />
                <Bar dataKey="pipeline" name="Pipeline" fill="#2563EB" radius={[0, 4, 4, 0]} barSize={10} />
                <Bar dataKey="won" name="Closed won" fill="#059669" radius={[0, 4, 4, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t border-border">
            <PerformanceTable reps={repPerformance} />
          </div>
        </>
      )}
    </Card>
  );
}
