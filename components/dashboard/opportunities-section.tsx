"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  KanbanSquare,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} from "lucide-react";

import { ActiveFilterChips, FiltersPanel } from "@/components/dashboard/filters";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
import { OpportunityListCard } from "@/components/dashboard/opportunity-card";
import { OpportunityTable } from "@/components/dashboard/opportunity-table";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PipelineViewMode } from "@/lib/types";
import { formatCurrencyCompact, pluralize } from "@/lib/utils";

export function OpportunitiesSection() {
  const {
    pipelineView,
    setPipelineView,
    searchQuery,
    setSearchQuery,
    exportCsv,
    toggleFilters,
    filtersOpen,
    activeFilterCount,
    totalFiltered,
    visible,
    metrics,
    page,
    totalPages,
    setPage,
    rangeStart,
    rangeEnd,
    isLoading,
  } = usePipeline();

  const handleViewChange = (value: string) => {
    setPipelineView(value as PipelineViewMode);
  };

  return (
    <section aria-labelledby="opportunities-heading" className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1">
          <h2 id="opportunities-heading" className="text-[17px] font-semibold tracking-tight">
            Opportunities
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {totalFiltered} {pluralize(totalFiltered, "opportunity", "opportunities")} matching
            current filters · {formatCurrencyCompact(metrics.pipelineValue)} open pipeline ·{" "}
            {metrics.overdueCount} overdue
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search this list..."
              aria-label="Search opportunities in this list"
              className="h-9 pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <Tabs value={pipelineView} onValueChange={handleViewChange}>
            <TabsList className="h-9" aria-label="Choose pipeline layout">
              <TabsTrigger value="kanban">
                <KanbanSquare className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Board</span>
              </TabsTrigger>
              <TabsTrigger value="table">
                <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Table</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            variant={filtersOpen ? "subtle" : "outline"}
            size="sm"
            className="h-9"
            onClick={toggleFilters}
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount ? (
              <span className="rounded-full bg-primary px-1.5 text-2xs font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="h-9" onClick={() => exportCsv()}>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export the filtered view as CSV</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ActiveFilterChips />
      <FiltersPanel />

      {pipelineView === "kanban" ? (
        <KanbanBoard />
      ) : (
        <>
          <div className="hidden md:block">
            <OpportunityTable />
          </div>

          {/* Mobile: rows become cards so nothing overflows and every action stays reachable */}
          <div className="space-y-3 md:hidden">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-card" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-[13px] text-muted-foreground">
                No opportunities found. Try changing your filters or search terms.
              </div>
            ) : (
              visible.map((opportunity) => (
                <OpportunityListCard key={opportunity.id} opportunity={opportunity} />
              ))
            )}

            {totalPages > 1 ? (
              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-2xs text-muted-foreground">
                  Showing <span className="font-semibold tabular">{rangeStart}</span>–
                  <span className="font-semibold tabular">{rangeEnd}</span> of{" "}
                  <span className="font-semibold tabular">{totalFiltered}</span>
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setPage(Math.max(page - 1, 1))}
                    disabled={page === 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-1.5 text-2xs tabular text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setPage(Math.min(page + 1, totalPages))}
                    disabled={page >= totalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
