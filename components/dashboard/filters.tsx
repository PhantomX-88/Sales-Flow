"use client";

import { RotateCcw, X } from "lucide-react";

import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsDesktop } from "@/lib/use-media-query";
import { STAGE_ORDER } from "@/lib/pipeline-config";
import type { DateFieldKey, DateRangeKey, PipelineStage, ValueBucket } from "@/lib/types";

const VALUE_OPTIONS: { value: ValueBucket; label: string }[] = [
  { value: "all", label: "All values" },
  { value: "under-25k", label: "Under $25K" },
  { value: "25k-50k", label: "$25K – $50K" },
  { value: "50k-100k", label: "$50K – $100K" },
  { value: "over-100k", label: "Over $100K" },
];

const DATE_FIELD_OPTIONS: { value: DateFieldKey; label: string }[] = [
  { value: "expectedCloseDate", label: "Expected close date" },
  { value: "createdDate", label: "Created date" },
];

const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string; expectedOnly?: boolean }[] = [
  { value: "all", label: "Any time" },
  { value: "overdue", label: "Overdue", expectedOnly: true },
  { value: "next-30-days", label: "Next 30 days" },
  { value: "this-quarter", label: "This quarter" },
  { value: "next-quarter", label: "Next quarter" },
];

export function FiltersFields({ idPrefix = "filters" }: { idPrefix?: string }) {
  const { filters, updateFilter, ownerNames, resetFilters, activeFilterCount } = usePipeline();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-stage`}>Stage</Label>
        <Select
          value={filters.stage}
          onValueChange={(value) => updateFilter("stage", value as PipelineStage | "all")}
        >
          <SelectTrigger id={`${idPrefix}-stage`} aria-label="Filter by stage">
            <SelectValue placeholder="All stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGE_ORDER.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {stage}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-owner`}>Owner</Label>
        <Select value={filters.owner} onValueChange={(value) => updateFilter("owner", value)}>
          <SelectTrigger id={`${idPrefix}-owner`} aria-label="Filter by owner">
            <SelectValue placeholder="All owners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {ownerNames.map((owner) => (
              <SelectItem key={owner} value={owner}>
                {owner}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-value`}>Deal value</Label>
        <Select
          value={filters.valueBucket}
          onValueChange={(value) => updateFilter("valueBucket", value as ValueBucket)}
        >
          <SelectTrigger id={`${idPrefix}-value`} aria-label="Filter by deal value">
            <SelectValue placeholder="All values" />
          </SelectTrigger>
          <SelectContent>
            {VALUE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-date-field`}>Date field</Label>
        <Select
          value={filters.dateField}
          onValueChange={(value) => {
            const nextField = value as DateFieldKey;
            updateFilter("dateField", nextField);
            if (nextField === "createdDate" && filters.dateRange === "overdue") {
              updateFilter("dateRange", "all");
            }
          }}
        >
          <SelectTrigger id={`${idPrefix}-date-field`} aria-label="Choose which date to filter on">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_FIELD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-date-range`}>Date range</Label>
        <Select
          value={filters.dateRange}
          onValueChange={(value) => updateFilter("dateRange", value as DateRangeKey)}
        >
          <SelectTrigger id={`${idPrefix}-date-range`} aria-label="Filter by date range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.filter(
              (option) => !option.expectedOnly || filters.dateField === "expectedCloseDate",
            ).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="sm:col-span-2 xl:col-span-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          disabled={activeFilterCount === 0}
          className="text-muted-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset filters
        </Button>
      </div>
    </div>
  );
}

export function ActiveFilterChips() {
  const { filters, updateFilter, activeFilterCount, resetFilters, searchQuery, setSearchQuery } =
    usePipeline();

  if (activeFilterCount === 0 && !searchQuery) return null;

  const chip =
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 py-1 pl-2.5 pr-1.5 text-2xs font-medium text-muted-foreground";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {searchQuery ? (
        <span className={chip}>
          Search: {searchQuery}
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            aria-label={`Clear search filter ${searchQuery}`}
            className="rounded-full p-0.5 transition-colors hover:bg-border hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : null}

      {filters.stage !== "all" ? (
        <span className={chip}>
          Stage: {filters.stage}
          <button
            type="button"
            onClick={() => updateFilter("stage", "all")}
            aria-label="Clear stage filter"
            className="rounded-full p-0.5 transition-colors hover:bg-border hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : null}

      {filters.owner !== "all" ? (
        <span className={chip}>
          Owner: {filters.owner}
          <button
            type="button"
            onClick={() => updateFilter("owner", "all")}
            aria-label="Clear owner filter"
            className="rounded-full p-0.5 transition-colors hover:bg-border hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : null}

      {filters.valueBucket !== "all" ? (
        <span className={chip}>
          Value: {VALUE_OPTIONS.find((option) => option.value === filters.valueBucket)?.label}
          <button
            type="button"
            onClick={() => updateFilter("valueBucket", "all")}
            aria-label="Clear value filter"
            className="rounded-full p-0.5 transition-colors hover:bg-border hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : null}

      {filters.dateRange !== "all" ? (
        <span className={chip}>
          {DATE_RANGE_OPTIONS.find((option) => option.value === filters.dateRange)?.label} ·{" "}
          {filters.dateField === "expectedCloseDate" ? "close date" : "created date"}
          <button
            type="button"
            onClick={() => updateFilter("dateRange", "all")}
            aria-label="Clear date filter"
            className="rounded-full p-0.5 transition-colors hover:bg-border hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : null}

      <Button variant="link" size="sm" className="h-6 px-1 text-2xs" onClick={resetFilters}>
        Clear all
      </Button>
    </div>
  );
}

/**
 * Desktop renders the filters inline under the section header; mobile opens the
 * same fields in a bottom sheet so no control is lost on small screens. Only one
 * of the two is mounted — otherwise the modal sheet would trap the desktop page.
 */
export function FiltersPanel() {
  const { filtersOpen, toggleFilters } = usePipeline();
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    if (!filtersOpen) return null;

    return (
      <div className="animate-fade-in rounded-xl border border-border bg-card p-5 shadow-card">
        <FiltersFields />
      </div>
    );
  }

  return (
    <Sheet open={filtersOpen} onOpenChange={(open) => !open && toggleFilters()}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Filter opportunities</SheetTitle>
          <SheetDescription>
            Combine stage, owner, value and date filters to narrow the pipeline.
          </SheetDescription>
        </SheetHeader>
        <div className="px-5 pb-6">
          <FiltersFields idPrefix="mobile-filters" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
