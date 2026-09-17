"use client";

import * as React from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { OpportunitiesSection } from "@/components/dashboard/opportunities-section";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Card } from "@/components/ui/card";
import { formatCurrencyCompact, formatPercent, pluralize } from "@/lib/utils";

function SummaryStrip() {
  const { filtered } = usePipeline();

  const stats = React.useMemo(() => {
    const value = filtered.reduce((total, opportunity) => total + opportunity.value, 0);
    const weighted = filtered.reduce(
      (total, opportunity) => total + (opportunity.value * opportunity.probability) / 100,
      0,
    );
    const averageProbability = filtered.length
      ? filtered.reduce((total, opportunity) => total + opportunity.probability, 0) / filtered.length
      : 0;

    return { value, weighted, averageProbability };
  }, [filtered]);

  const items = [
    { label: "Deals in view", value: String(filtered.length) },
    { label: "Filtered value", value: formatCurrencyCompact(stats.value) },
    { label: "Weighted value", value: formatCurrencyCompact(stats.weighted) },
    { label: "Avg probability", value: formatPercent(stats.averageProbability, 0) },
  ];

  return (
    <Card className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
      {items.map((item) => (
        <div key={item.label} className="p-4">
          <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </p>
          <p className="mt-1 text-[17px] font-semibold tabular">{item.value}</p>
        </div>
      ))}
    </Card>
  );
}

export function PipelineView() {
  const { filtered } = usePipeline();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline board"
        description={`${filtered.length} ${pluralize(
          filtered.length,
          "opportunity",
          "opportunities",
        )} in view · drag deals between stages and every metric recalculates instantly.`}
        showFilter
      />

      <SummaryStrip />
      <OpportunitiesSection />
    </div>
  );
}
