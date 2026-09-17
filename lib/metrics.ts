import {
  CLOSED_STAGES,
  OPEN_STAGES,
  STAGE_ORDER,
  STAGE_PROBABILITY,
} from "@/lib/mock-data";
import type {
  AccountSummary,
  Filters,
  ForecastSummary,
  FunnelStage,
  KpiMetric,
  MonthlyRevenuePoint,
  Opportunity,
  Owner,
  PipelineMetrics,
  PipelineStage,
  RepPerformance,
  SortState,
  TrendIndicator,
  TaskItem,
  ValueBucket,
} from "@/lib/types";
import {
  clamp,
  daysBetween,
  endOfQuarter,
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  formatSigned,
  monthKey,
  parseDate,
  pluralize,
  startOfQuarter,
} from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export function isOpen(opportunity: Opportunity): boolean {
  return OPEN_STAGES.includes(opportunity.stage);
}

export function isWon(opportunity: Opportunity): boolean {
  return opportunity.stage === "Closed Won";
}

export function isLost(opportunity: Opportunity): boolean {
  return opportunity.stage === "Closed Lost";
}

export function isClosed(opportunity: Opportunity): boolean {
  return CLOSED_STAGES.includes(opportunity.stage);
}

export function sumValues(opportunities: Opportunity[]): number {
  return opportunities.reduce((total, opportunity) => total + opportunity.value, 0);
}

export function weightedValue(opportunities: Opportunity[]): number {
  return opportunities.reduce(
    (total, opportunity) => total + (opportunity.value * opportunity.probability) / 100,
    0,
  );
}

/** Percentage change between two values; `null` when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/* ------------------------------------------------------------------ */
/* Core metrics                                                        */
/* ------------------------------------------------------------------ */

export function computeMetrics(opportunities: Opportunity[], today: string): PipelineMetrics {
  const open = opportunities.filter(isOpen);
  const won = opportunities.filter(isWon);
  const lost = opportunities.filter(isLost);

  const closed = [...won, ...lost];
  const winRate = closed.length ? (won.length / closed.length) * 100 : 0;

  const wonWithCycle = won.filter((opportunity) => opportunity.closedDate);
  const averageSalesCycle = wonWithCycle.length
    ? wonWithCycle.reduce(
        (total, opportunity) =>
          total + daysBetween(opportunity.closedDate as string, opportunity.createdDate),
        0,
      ) / wonWithCycle.length
    : 0;

  const currentMonth = monthKey(today);

  return {
    pipelineValue: sumValues(open),
    weightedForecast: weightedValue(open),
    openCount: open.length,
    winRate,
    averageDealSize: won.length ? sumValues(won) / won.length : 0,
    averageSalesCycle,
    wonValue: sumValues(won),
    lostValue: sumValues(lost),
    wonCount: won.length,
    lostCount: lost.length,
    stalledCount: open.filter((opportunity) => opportunity.age > 25).length,
    overdueCount: open.filter((opportunity) => opportunity.expectedCloseDate < today).length,
    closingThisMonth: open.filter(
      (opportunity) => monthKey(opportunity.expectedCloseDate) === currentMonth,
    ).length,
  };
}

/**
 * Funnel counts are cumulative: a deal in "Negotiation" has passed through
 * every earlier stage, which is what makes the conversion rates meaningful.
 */
export function computeFunnel(opportunities: Opportunity[]): FunnelStage[] {
  const funnelStages: PipelineStage[] = STAGE_ORDER.filter((stage) => stage !== "Closed Lost");
  const countable = opportunities.filter((opportunity) => opportunity.stage !== "Closed Lost");

  return funnelStages.map((stage, index) => {
    const reached = countable.filter(
      (opportunity) => funnelStages.indexOf(opportunity.stage) >= index,
    );
    const previousReached = index === 0 ? null : countable.filter(
      (opportunity) => funnelStages.indexOf(opportunity.stage) >= index - 1,
    );

    return {
      stage,
      reachedCount: reached.length,
      reachedValue: sumValues(reached),
      conversionRate:
        previousReached && previousReached.length
          ? (reached.length / previousReached.length) * 100
          : null,
    };
  });
}

export function computeRepPerformance(
  opportunities: Opportunity[],
  owners: Owner[],
): RepPerformance[] {
  return owners
    .map((owner) => {
      const owned = opportunities.filter((opportunity) => opportunity.owner === owner.name);
      const open = owned.filter(isOpen);
      const won = owned.filter(isWon);
      const decided = owned.filter((opportunity) => isOpen(opportunity) === false);

      return {
        id: owner.id,
        name: owner.name,
        initials: owner.initials,
        role: owner.role,
        pipeline: sumValues(open),
        won: sumValues(won),
        winRate: decided.length ? (won.length / decided.length) * 100 : 0,
        openCount: open.length,
        wonCount: won.length,
      };
    })
    .sort((a, b) => b.pipeline - a.pipeline);
}

export interface ForecastTargets {
  quarterlyTarget: number;
  closedRevenue: number;
  commit: number;
  bestCase: number;
}

export function computeForecast(
  opportunities: Opportunity[],
  targets: ForecastTargets,
): ForecastSummary {
  const open = opportunities.filter(isOpen);
  const closedRevenue = sumValues(opportunities.filter(isWon));

  // Commit = late-stage deals the team expects to land this quarter.
  const commit = sumValues(open.filter((opportunity) => opportunity.probability >= 85));
  // Best case = every open deal closes at full value.
  const bestCase = sumValues(open);
  const weighted = weightedValue(open);

  const quarterlyTarget = targets.quarterlyTarget;
  const gapToTarget = Math.max(quarterlyTarget - closedRevenue, 0);
  const attainmentPercent = quarterlyTarget ? (closedRevenue / quarterlyTarget) * 100 : 0;
  const confidencePercent = quarterlyTarget
    ? clamp(((closedRevenue + weighted) / quarterlyTarget) * 100, 0, 100)
    : 0;

  return {
    quarterlyTarget,
    closedRevenue,
    commit,
    bestCase,
    weightedForecast: weighted,
    gapToTarget,
    attainmentPercent,
    confidencePercent,
    status: closedRevenue + weighted >= quarterlyTarget ? "on-track" : "at-risk",
  };
}

/**
 * KPI cards. Every figure — including the trend indicators — is derived from
 * the dataset so the cards stay correct as deals are created, edited or moved.
 */
export function computeKpis(
  opportunities: Opportunity[],
  monthlyRevenue: MonthlyRevenuePoint[],
  today: string,
): KpiMetric[] {
  const metrics = computeMetrics(opportunities, today);
  const open = opportunities.filter(isOpen);

  const lastMonth = monthlyRevenue[monthlyRevenue.length - 1];
  const previousMonth = monthlyRevenue[monthlyRevenue.length - 2];
  const pipelineTrend =
    lastMonth && previousMonth ? percentChange(lastMonth.pipeline, previousMonth.pipeline) : null;

  const currentMonth = monthKey(today);
  const [currentYear, currentMonthNumber] = currentMonth.split("-").map(Number);
  const previousMonthKey = new Date(Date.UTC(currentYear, currentMonthNumber - 2, 1))
    .toISOString()
    .slice(0, 7);

  const createdThisMonth = opportunities.filter(
    (opportunity) => monthKey(opportunity.createdDate) === currentMonth,
  );
  const createdLastMonth = opportunities.filter(
    (opportunity) => monthKey(opportunity.createdDate) === previousMonthKey,
  );
  const weightedTrend = percentChange(
    weightedValue(createdThisMonth),
    weightedValue(createdLastMonth),
  );

  const decisionsThisMonth = opportunities.filter(
    (opportunity) =>
      isClosed(opportunity) &&
      opportunity.closedDate &&
      monthKey(opportunity.closedDate) === currentMonth,
  );
  const decisionsLastMonth = opportunities.filter(
    (opportunity) =>
      isClosed(opportunity) &&
      opportunity.closedDate &&
      monthKey(opportunity.closedDate) === previousMonthKey,
  );
  const winRateThisMonth = decisionsThisMonth.length
    ? (decisionsThisMonth.filter(isWon).length / decisionsThisMonth.length) * 100
    : 0;
  const winRateLastMonth = decisionsLastMonth.length
    ? (decisionsLastMonth.filter(isWon).length / decisionsLastMonth.length) * 100
    : 0;

  return [
    {
      id: "pipeline-value",
      label: "Pipeline value",
      value: formatCurrencyCompact(metrics.pipelineValue),
      supporting: `${pluralize(metrics.openCount, "open opportunity")} in play`,
      trend:
        pipelineTrend === null
          ? null
          : { value: pipelineTrend, kind: "percent", label: "vs previous month" },
      footnote: `Avg deal size ${formatCurrency(Math.round(metrics.averageDealSize))}`,
    },
    {
      id: "weighted-forecast",
      label: "Weighted forecast",
      value: formatCurrencyCompact(metrics.weightedForecast),
      supporting: "at current probability",
      trend:
        weightedTrend === null
          ? null
          : { value: weightedTrend, kind: "percent", label: "vs previous month" },
      footnote: `${formatCurrencyCompact(metrics.wonValue)} closed won to date`,
    },
    {
      id: "open-opportunities",
      label: "Open opportunities",
      value: String(metrics.openCount),
      supporting: `${metrics.closingThisMonth} closing this month`,
      trend: {
        value: createdThisMonth.length,
        kind: "count",
        label: "new this month",
      },
      footnote: `${metrics.overdueCount} past expected close date`,
    },
    {
      id: "win-rate",
      label: "Win rate",
      value: formatPercent(metrics.winRate),
      supporting: `${metrics.wonCount} won / ${metrics.wonCount + metrics.lostCount} closed`,
      trend: decisionsLastMonth.length
        ? {
            value: winRateThisMonth - winRateLastMonth,
            kind: "points",
            label: "vs previous month",
          }
        : null,
      footnote: `Avg sales cycle ${Math.round(metrics.averageSalesCycle)} days`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Accounts, tasks & notifications                                     */
/* ------------------------------------------------------------------ */

export function computeAccounts(opportunities: Opportunity[], today: string): AccountSummary[] {
  const grouped = new Map<string, Opportunity[]>();

  for (const opportunity of opportunities) {
    const list = grouped.get(opportunity.company) ?? [];
    list.push(opportunity);
    grouped.set(opportunity.company, list);
  }

  return [...grouped.entries()]
    .map(([company, deals]) => {
      const open = deals.filter(isOpen);
      const won = deals.filter(isWon);
      const lead = open[0] ?? deals[0];
      const overdue = open.some((deal) => deal.expectedCloseDate < today);
      const stalled = open.some((deal) => deal.age > 25);

      return {
        company,
        owner: lead.owner,
        contact: lead.contact,
        openValue: sumValues(open),
        wonValue: sumValues(won),
        opportunityCount: deals.length,
        primaryStage: lead.stage,
        lastActivity: deals[0].lastActivity,
        health: overdue ? "at-risk" : stalled ? "attention" : "healthy",
        opportunityId: lead.id,
      } satisfies AccountSummary;
    })
    .sort((a, b) => b.openValue + b.wonValue - (a.openValue + a.wonValue));
}

export function computeTasks(opportunities: Opportunity[], today: string): TaskItem[] {
  const open = opportunities.filter(isOpen);
  const tasks: TaskItem[] = [];

  for (const opportunity of open) {
    const daysToClose = daysBetween(opportunity.expectedCloseDate, today);

    if (daysToClose < 0) {
      tasks.push({
        id: `${opportunity.id}-overdue`,
        title: `Close date passed for ${opportunity.company}`,
        detail: `${formatCurrency(opportunity.value)} · expected ${opportunity.expectedCloseDate}`,
        dueLabel: `${Math.abs(daysToClose)} ${pluralize(Math.abs(daysToClose), "day")} overdue`,
        tone: "danger",
        opportunityId: opportunity.id,
      });
    } else if (daysToClose <= 7) {
      tasks.push({
        id: `${opportunity.id}-closing`,
        title: `Confirm next steps with ${opportunity.company}`,
        detail: `${formatCurrency(opportunity.value)} · closes in ${daysToClose} ${pluralize(daysToClose, "day")}`,
        dueLabel: `Due in ${daysToClose} ${pluralize(daysToClose, "day")}`,
        tone: "warning",
        opportunityId: opportunity.id,
      });
    }

    if (opportunity.age > 25 && opportunity.stage !== "Negotiation") {
      tasks.push({
        id: `${opportunity.id}-stalled`,
        title: `Re-engage ${opportunity.contact} at ${opportunity.company}`,
        detail: `${opportunity.stage} · ${opportunity.age} days old`,
        dueLabel: "Stalled deal",
        tone: "info",
        opportunityId: opportunity.id,
      });
    }
  }

  const toneWeight = { danger: 0, warning: 1, info: 2 } as const;
  return tasks.sort((a, b) => toneWeight[a.tone] - toneWeight[b.tone]);
}

/* ------------------------------------------------------------------ */
/* Filtering & sorting                                                 */
/* ------------------------------------------------------------------ */

const VALUE_BUCKETS: Record<Exclude<ValueBucket, "all">, (value: number) => boolean> = {
  "under-25k": (value) => value < 25_000,
  "25k-50k": (value) => value >= 25_000 && value < 50_000,
  "50k-100k": (value) => value >= 50_000 && value < 100_000,
  "over-100k": (value) => value >= 100_000,
};

export function matchesSearch(opportunity: Opportunity, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;

  return [
    opportunity.company,
    opportunity.contact,
    opportunity.owner,
    opportunity.stage,
    opportunity.leadSource,
    opportunity.id,
  ].some((field) => field.toLowerCase().includes(term));
}

function matchesDateRange(opportunity: Opportunity, filters: Filters, today: string): boolean {
  if (filters.dateRange === "all") return true;

  const value = opportunity[filters.dateField];
  const quarterStart = startOfQuarter(today);
  const quarterEnd = endOfQuarter(today);

  switch (filters.dateRange) {
    case "overdue":
      return filters.dateField === "expectedCloseDate" ? value < today : value > today;
    case "next-30-days": {
      const horizon = new Date(parseDate(today).getTime() + 30 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      return value >= today && value <= horizon;
    }
    case "this-quarter":
      return value >= quarterStart && value <= quarterEnd;
    case "next-quarter": {
      const nextStart = new Date(parseDate(quarterEnd).getTime() + 86_400_000)
        .toISOString()
        .slice(0, 10);
      const nextEnd = endOfQuarter(nextStart);
      return value >= nextStart && value <= nextEnd;
    }
    default:
      return true;
  }
}

export function filterOpportunities(
  opportunities: Opportunity[],
  search: string,
  filters: Filters,
  today: string,
): Opportunity[] {
  return opportunities.filter((opportunity) => {
    if (filters.stage !== "all" && opportunity.stage !== filters.stage) return false;
    if (filters.owner !== "all" && opportunity.owner !== filters.owner) return false;
    if (filters.valueBucket !== "all" && !VALUE_BUCKETS[filters.valueBucket](opportunity.value)) {
      return false;
    }
    if (!matchesDateRange(opportunity, filters, today)) return false;
    return matchesSearch(opportunity, search);
  });
}

export function countActiveFilters(filters: Filters): number {
  let count = 0;
  if (filters.stage !== "all") count += 1;
  if (filters.owner !== "all") count += 1;
  if (filters.valueBucket !== "all") count += 1;
  if (filters.dateRange !== "all") count += 1;
  return count;
}

/** Recency of the free-text `lastActivity` label, expressed as a timestamp. */
export function lastActivityTimestamp(label: string, today: string): number {
  const base = parseDate(today).getTime();
  const normalised = label.trim().toLowerCase();

  if (normalised.startsWith("today")) return base + 60 * 60 * 1000;
  if (normalised.startsWith("yesterday")) return base - 86_400_000;
  if (normalised.includes("min")) {
    const minutes = Number(normalised.replace(/[^0-9]/g, "")) || 0;
    return base + (1440 - minutes) * 60 * 1000;
  }
  if (normalised.includes("hr")) {
    const hours = Number(normalised.replace(/[^0-9]/g, "")) || 0;
    return base + (1440 - hours * 60) * 60 * 1000;
  }

  const parsed = new Date(`${label} ${today.slice(0, 4)} UTC`).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", { sensitivity: "base" });
}

export function sortOpportunities(
  opportunities: Opportunity[],
  sort: SortState,
  today: string,
): Opportunity[] {
  const sorted = [...opportunities].sort((a, b) => {
    switch (sort.key) {
      case "company":
        return compareValues(a.company, b.company);
      case "value":
        return compareValues(a.value, b.value);
      case "probability":
        return compareValues(a.probability, b.probability);
      case "age":
        return compareValues(a.age, b.age);
      case "expectedCloseDate":
        return compareValues(a.expectedCloseDate, b.expectedCloseDate);
      case "lastActivity":
        return compareValues(
          lastActivityTimestamp(a.lastActivity, today),
          lastActivityTimestamp(b.lastActivity, today),
        );
      default:
        return 0;
    }
  });

  return sort.direction === "asc" ? sorted : sorted.reverse();
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export const EXPORT_HEADERS = [
  "Company",
  "Contact",
  "Email",
  "Phone",
  "Stage",
  "Value",
  "Probability",
  "Owner",
  "Age",
  "Expected Close Date",
  "Lead Source",
  "Last Activity",
];

export function buildExportRows(opportunities: Opportunity[]): (string | number)[][] {
  return opportunities.map((opportunity) => [
    opportunity.company,
    opportunity.contact,
    opportunity.email ?? "",
    opportunity.phone ?? "",
    opportunity.stage,
    opportunity.value,
    `${opportunity.probability}%`,
    opportunity.owner,
    opportunity.age,
    opportunity.expectedCloseDate,
    opportunity.leadSource,
    opportunity.lastActivity,
  ]);
}

export function defaultProbabilityFor(stage: PipelineStage): number {
  return STAGE_PROBABILITY[stage] ?? 0;
}

export function isProbabilityOverridden(opportunity: Opportunity): boolean {
  return (
    opportunity.probabilityOverridden ??
    opportunity.probability !== defaultProbabilityFor(opportunity.stage)
  );
}

/* ------------------------------------------------------------------ */
/* Formatting helpers shared by several widgets                        */
/* ------------------------------------------------------------------ */

export function formatTrendValue(value: number, kind: TrendIndicator["kind"]): string {
  if (kind === "count") return `${value > 0 ? "+" : ""}${value}`;
  if (kind === "points") return formatSigned(value, 1, " pp");
  return formatSigned(value, 1, "%");
}

export function trendTone(value: number): "positive" | "negative" | "neutral" {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}
