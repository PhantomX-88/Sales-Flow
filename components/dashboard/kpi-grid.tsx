"use client";

import type { LucideIcon } from "lucide-react";
import { Layers, Target, Trophy, Wallet, CircleDollarSign } from "lucide-react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { KpiCardsSkeleton } from "@/components/dashboard/loading-skeleton";

const ICONS: Record<string, LucideIcon> = {
  "pipeline-value": Wallet,
  "weighted-forecast": Target,
  "open-opportunities": Layers,
  "win-rate": Trophy,
  "collected-revenue": CircleDollarSign,
};

export function KpiGrid() {
  const { kpis, isLoading } = usePipeline();

  if (isLoading) return <KpiCardsSkeleton />;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <MetricCard
          key={kpi.id}
          label={kpi.label}
          value={kpi.value}
          supporting={kpi.supporting}
          trend={kpi.trend}
          footnote={kpi.footnote}
          icon={ICONS[kpi.id] ?? Wallet}
        />
      ))}
    </div>
  );
}
