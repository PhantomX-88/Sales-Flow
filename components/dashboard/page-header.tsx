"use client";

import * as React from "react";
import { Plus, SlidersHorizontal } from "lucide-react";

import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChartRangeKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const PERIODS: { value: ChartRangeKey; label: string }[] = [
  { value: "this-quarter", label: "This quarter" },
  { value: "last-quarter", label: "Last quarter" },
  { value: "this-year", label: "This year" },
];

export function PeriodTabs({ className }: { className?: string }) {
  const { chartRange, setChartRange } = usePipeline();

  return (
    <Tabs value={chartRange} onValueChange={(value) => setChartRange(value as ChartRangeKey)}>
      <TabsList className={cn("h-9", className)} aria-label="Select reporting period">
        {PERIODS.map((period) => (
          <TabsTrigger key={period.value} value={period.value}>
            {period.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function FilterToggleButton() {
  const { filtersOpen, toggleFilters, activeFilterCount, setView, view } = usePipeline();

  return (
    <Button
      variant={filtersOpen ? "subtle" : "outline"}
      size="sm"
      className="h-9"
      aria-expanded={filtersOpen}
      onClick={() => {
        if (view !== "pipeline" && view !== "overview") setView("overview");
        toggleFilters();
      }}
    >
      <SlidersHorizontal className="h-4 w-4" />
      Filters
      {activeFilterCount ? (
        <span className="rounded-full bg-primary px-1.5 text-2xs font-semibold text-primary-foreground">
          {activeFilterCount}
        </span>
      ) : null}
    </Button>
  );
}

export function NewOpportunityButton({ className }: { className?: string }) {
  const { openCreateDialog } = usePipeline();

  return (
    <Button size="sm" className={cn("h-9", className)} onClick={openCreateDialog}>
      <Plus className="h-4 w-4" />
      New opportunity
    </Button>
  );
}

interface PageHeaderProps {
  title: string;
  description: string;
  showPeriod?: boolean;
  showFilter?: boolean;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  showPeriod = false,
  showFilter = false,
  children,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="space-y-1">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[28px]">{title}</h1>
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showPeriod ? <PeriodTabs className="order-last w-full sm:order-none sm:w-auto" /> : null}
        {showFilter ? <FilterToggleButton /> : null}
        <NewOpportunityButton />
        {children}
      </div>
    </header>
  );
}
