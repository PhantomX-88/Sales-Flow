"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FilterX } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { TableSkeleton } from "@/components/dashboard/loading-skeleton";
import { OwnerAvatar } from "@/components/dashboard/owner-avatar";
import { OpportunityActions } from "@/components/dashboard/opportunity-actions";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { StageBadge } from "@/components/dashboard/stage-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Opportunity, SortKey } from "@/lib/types";
import {
  cn,
  closeDateTone,
  formatCurrency,
  formatDateShort,
  getPaginationRange,
  pluralize,
} from "@/lib/utils";

interface SortableHeadProps {
  label: string;
  sortKey: SortKey;
  className?: string;
}

function SortableHead({ label, sortKey, className }: SortableHeadProps) {
  const { sort, toggleSort } = usePipeline();
  const isActive = sort.key === sortKey;
  const Icon = !isActive ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead
      className={className}
      aria-sort={isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => toggleSort(sortKey)}
        className={cn(
          "group inline-flex items-center gap-1 rounded text-xs font-medium uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
        <Icon
          className={cn(
            "h-3 w-3 transition-colors",
            isActive ? "text-primary" : "text-muted-foreground/50 group-hover:text-muted-foreground",
          )}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  );
}

function OpportunityRow({ opportunity, compact }: { opportunity: Opportunity; compact: boolean }) {
  const { openOpportunity, today } = usePipeline();
  const tone = closeDateTone(opportunity.expectedCloseDate, today);
  const cellPadding = compact ? "py-2" : "py-3";

  return (
    <TableRow
      tabIndex={0}
      onClick={() => openOpportunity(opportunity.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") openOpportunity(opportunity.id);
      }}
      className="group cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none"
      aria-label={`Open ${opportunity.company}, ${opportunity.stage}, ${formatCurrency(opportunity.value)}`}
    >
      <TableCell className={cn("font-medium", cellPadding)}>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-semibold text-foreground">
            {opportunity.company}
          </span>
          <span className="truncate text-2xs text-muted-foreground">{opportunity.id}</span>
        </div>
      </TableCell>

      <TableCell className={cn("hidden lg:table-cell", cellPadding)}>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[13px]">{opportunity.contact}</span>
          <span className="truncate text-2xs text-muted-foreground">{opportunity.leadSource}</span>
        </div>
      </TableCell>

      <TableCell className={cellPadding}>
        <StageBadge stage={opportunity.stage} />
      </TableCell>

      <TableCell className={cn("text-right text-[13px] font-semibold tabular", cellPadding)}>
        {formatCurrency(opportunity.value)}
      </TableCell>

      <TableCell className={cn("hidden md:table-cell", cellPadding)}>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${opportunity.probability}%` }}
            />
          </div>
          <span className="text-2xs tabular text-muted-foreground">{opportunity.probability}%</span>
        </div>
      </TableCell>

      <TableCell className={cn("hidden lg:table-cell", cellPadding)}>
        <div className="flex items-center gap-2">
          <OwnerAvatar name={opportunity.owner} size="sm" />
          <span className="truncate text-[13px]">{opportunity.owner}</span>
        </div>
      </TableCell>

      <TableCell className={cn("hidden text-right text-[13px] tabular xl:table-cell", cellPadding)}>
        {opportunity.age}d
      </TableCell>

      <TableCell className={cn("hidden xl:table-cell", cellPadding)}>
        <div className="flex flex-col">
          <span className="text-[13px]">{opportunity.lastActivity}</span>
          <span
            className={cn(
              "text-2xs",
              tone === "danger" ? "font-medium text-rose-600" : "text-muted-foreground",
            )}
          >
            Closes {formatDateShort(opportunity.expectedCloseDate)}
          </span>
        </div>
      </TableCell>

      <TableCell className={cn("w-[56px] text-right", cellPadding)}>
        <div className="flex justify-end opacity-60 transition-opacity group-hover:opacity-100">
          <OpportunityActions opportunity={opportunity} />
        </div>
      </TableCell>
    </TableRow>
  );
}

export function OpportunityTable() {
  const {
    visible,
    isLoading,
    sort,
    page,
    totalPages,
    setPage,
    rangeStart,
    rangeEnd,
    totalFiltered,
    pageSize,
    setPageSize,
    settings,
    clearAllFilters,
  } = usePipeline();

  if (isLoading) return <TableSkeleton rows={6} />;

  if (totalFiltered === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-card">
        <EmptyState
          icon={FilterX}
          title="No opportunities found"
          description="Try changing your filters or search terms. Nothing in the current pipeline matches this combination."
          actionLabel="Clear filters"
          onAction={clearAllFilters}
        />
      </div>
    );
  }

  const pages = getPaginationRange(page, totalPages);
  const compact = settings.density === "compact";

  return (
    /* `overflow-clip` rounds the card corners without creating a scroll
       container, which keeps the sticky table header pinned to the viewport.
       Narrow screens use the responsive card list instead of horizontal
       scrolling, so no overflow container is needed. */
    <div className="overflow-clip rounded-xl border border-border bg-card shadow-card">
      <Table>
        <TableHeader className="sticky top-16 z-10 bg-card">
          <TableRow className="hover:bg-transparent">
            <SortableHead label="Opportunity" sortKey="company" />
            <TableHead className="hidden lg:table-cell">Account / Source</TableHead>
            <TableHead>Stage</TableHead>
            <SortableHead label="Value" sortKey="value" className="text-right [&>button]:justify-end" />
            <SortableHead
              label="Probability"
              sortKey="probability"
              className="hidden md:table-cell"
            />
            <TableHead className="hidden lg:table-cell">Owner</TableHead>
            <SortableHead
              label="Age"
              sortKey="age"
              className="hidden text-right xl:table-cell [&>button]:justify-end"
            />
            <SortableHead
              label="Last activity"
              sortKey="lastActivity"
              className="hidden xl:table-cell"
            />
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((opportunity) => (
            <OpportunityRow key={opportunity.id} opportunity={opportunity} compact={compact} />
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-3 border-t border-border px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-2xs text-muted-foreground">
            Showing <span className="font-semibold tabular text-foreground">{rangeStart}</span>–
            <span className="font-semibold tabular text-foreground">{rangeEnd}</span> of{" "}
            <span className="font-semibold tabular text-foreground">{totalFiltered}</span>{" "}
            {pluralize(totalFiltered, "opportunity", "opportunities")} · sorted by {sort.key}
          </p>

          <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
            <SelectTrigger
              className="h-8 w-[6.5rem] text-xs"
              aria-label="Rows per page"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <nav className="flex items-center gap-1" aria-label="Pagination">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setPage(Math.max(page - 1, 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          {pages.map((token, index) =>
            token === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="px-1.5 text-xs text-muted-foreground"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <Button
                key={token}
                variant={token === page ? "default" : "ghost"}
                size="icon-sm"
                className={cn("h-8 w-8 text-xs tabular", token !== page && "text-muted-foreground")}
                onClick={() => setPage(token)}
                aria-current={token === page ? "page" : undefined}
                aria-label={`Go to page ${token}`}
              >
                {token}
              </Button>
            ),
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setPage(Math.min(page + 1, totalPages))}
            disabled={page >= totalPages}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      </div>
    </div>
  );
}
