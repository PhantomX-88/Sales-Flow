import {
  CLOSED_STAGES,
  OPEN_STAGES,
  STAGE_ORDER,
  STAGE_PROBABILITY,
} from "@/lib/pipeline-config";
import type {
  AccountSummary,
  Activity,
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
  toDateKey,
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
 * Funnel counts are a stage snapshot: each deal appears once, in the stage it
 * sits in right now. Conversion is current-stage count vs the previous stage.
 */
export function computeFunnel(opportunities: Opportunity[]): FunnelStage[] {
  const funnelStages: PipelineStage[] = STAGE_ORDER.filter((stage) => stage !== "Closed Lost");

  return funnelStages.map((stage, index) => {
    const current = opportunities.filter((opportunity) => opportunity.stage === stage);
    const previousStage = index === 0 ? null : funnelStages[index - 1];
    const previous = previousStage
      ? opportunities.filter((opportunity) => opportunity.stage === previousStage)
      : null;

    return {
      stage,
      reachedCount: current.length,
      reachedValue: sumValues(current),
      conversionRate:
        previous && previous.length ? (current.length / previous.length) * 100 : null,
    };
  });
}

/**
 * Pipeline & closed-revenue movement for the trailing `months` (ending with
 * the month of `today`), derived from the live opportunities instead of a
 * static dataset so the chart moves as deals are created, moved and closed.
 *
 * A deal counts toward a month's `pipeline` once it exists (created on or
 * before the month end) and until it is decided (closed date after the month
 * end). `won` is the value of deals closed won inside that month.
 */
export function computeMonthlyRevenue(
  opportunities: Opportunity[],
  today: string,
  months = 6,
): MonthlyRevenuePoint[] {
  const base = parseDate(today);
  const points: MonthlyRevenuePoint[] = [];

  for (let offset = months - 1; offset >= 0; offset--) {
    const monthEnd = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - offset + 1, 0));
    const key = monthEnd.toISOString().slice(0, 7);

    const pipeline = sumValues(
      opportunities.filter(
        (opportunity) =>
          parseDate(opportunity.createdDate).getTime() <= monthEnd.getTime() &&
          (!opportunity.closedDate || parseDate(opportunity.closedDate).getTime() > monthEnd.getTime()),
      ),
    );
    const won = sumValues(
      opportunities.filter(
        (opportunity) =>
          isWon(opportunity) &&
          Boolean(opportunity.closedDate) &&
          monthKey(opportunity.closedDate as string) === key,
      ),
    );

    points.push({ month: key, pipeline, won });
  }

  return points;
}

/** First and last day (ISO) of the current target window for `period`. */
export function forecastPeriodWindow(
  period: "monthly" | "quarterly" | "annual",
  today: string,
): { start: string; end: string } {
  const date = parseDate(today);
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();

  if (period === "annual") {
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  if (period === "monthly") {
    return {
      start: toDateKey(new Date(Date.UTC(year, monthIndex, 1))),
      end: toDateKey(new Date(Date.UTC(year, monthIndex + 1, 0))),
    };
  }
  const quarterStartMonth = Math.floor(monthIndex / 3) * 3;
  return {
    start: toDateKey(new Date(Date.UTC(year, quarterStartMonth, 1))),
    end: toDateKey(new Date(Date.UTC(year, quarterStartMonth + 3, 0))),
  };
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
  /** Target amount for the period (organization revenue_target). */
  amount: number;
  period: "monthly" | "quarterly" | "annual";
}

/**
 * Tracks closed-won revenue **inside the current target window** against the
 * organization's configured target, so attainment moves as deals are closed
 * this period — not as an all-time total.
 */
export function computeForecast(
  opportunities: Opportunity[],
  targets: ForecastTargets,
  today: string,
): ForecastSummary {
  const window = forecastPeriodWindow(targets.period, today);
  const closedRevenue = sumValues(
    opportunities.filter(
      (opportunity) =>
        isWon(opportunity) &&
        Boolean(opportunity.closedDate) &&
        (opportunity.closedDate as string) >= window.start &&
        (opportunity.closedDate as string) <= window.end,
    ),
  );

  const open = opportunities.filter(isOpen);
  // Commit = late-stage deals the team expects to land this period.
  const commit = sumValues(open.filter((opportunity) => opportunity.probability >= 85));
  // Best case = every open deal closes at full value.
  const bestCase = sumValues(open);
  const weighted = weightedValue(open);

  const target = targets.amount;
  const gapToTarget = Math.max(target - closedRevenue, 0);
  const attainmentPercent = target ? (closedRevenue / target) * 100 : 0;
  const confidencePercent = target
    ? clamp(((closedRevenue + weighted) / target) * 100, 0, 100)
    : 0;

  return {
    target,
    period: targets.period,
    closedRevenue,
    commit,
    bestCase,
    weightedForecast: weighted,
    gapToTarget,
    attainmentPercent,
    confidencePercent,
    status: closedRevenue + weighted >= target ? "on-track" : "at-risk",
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
  currency: "NGN" | "USD" = "USD",
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
      value: formatCurrencyCompact(metrics.pipelineValue, currency),
      supporting: `${pluralize(metrics.openCount, "open opportunity")} in play`,
      trend:
        pipelineTrend === null
          ? null
          : { value: pipelineTrend, kind: "percent", label: "vs previous month" },
      footnote: `Avg deal size ${formatCurrency(Math.round(metrics.averageDealSize), currency)}`,
    },
    {
      id: "weighted-forecast",
      label: "Weighted forecast",
      value: formatCurrencyCompact(metrics.weightedForecast, currency),
      supporting: "at current probability",
      trend:
        weightedTrend === null
          ? null
          : { value: weightedTrend, kind: "percent", label: "vs previous month" },
      footnote: `${formatCurrencyCompact(metrics.wonValue, currency)} closed won to date`,
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

export function computeTasks(
  opportunities: Opportunity[],
  today: string,
  currency: "NGN" | "USD" = "USD",
): TaskItem[] {
  const open = opportunities.filter(isOpen);
  const tasks: TaskItem[] = [];

  for (const opportunity of open) {
    const daysToClose = daysBetween(opportunity.expectedCloseDate, today);

    if (daysToClose < 0) {
      tasks.push({
        id: `${opportunity.id}-overdue`,
        title: `Close date passed for ${opportunity.company}`,
        detail: `${formatCurrency(opportunity.value, currency)} · expected ${opportunity.expectedCloseDate}`,
        dueLabel: `${Math.abs(daysToClose)} ${pluralize(Math.abs(daysToClose), "day")} overdue`,
        tone: "danger",
        opportunityId: opportunity.id,
      });
    } else if (daysToClose <= 7) {
      tasks.push({
        id: `${opportunity.id}-closing`,
        title: `Confirm next steps with ${opportunity.company}`,
        detail: `${formatCurrency(opportunity.value, currency)} · closes in ${daysToClose} ${pluralize(daysToClose, "day")}`,
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

/**
 * Reminders derived from activities that carry a next step + due date.
 * Overdue and due-within-7-days steps become task items so they surface
 * in the Tasks view alongside pipeline-derived tasks (Phase 3).
 */
export function computeReminders(activities: Activity[], today: string): TaskItem[] {
  const reminders: TaskItem[] = [];

  for (const activity of activities) {
    if (!activity.nextStep || !activity.dueDate || !activity.opportunityId) continue;
    const daysUntil = daysBetween(activity.dueDate, today);

    if (daysUntil < 0) {
      reminders.push({
        id: `reminder-${activity.id}`,
        title: activity.nextStep,
        detail: activity.text,
        dueLabel: `${Math.abs(daysUntil)} ${pluralize(Math.abs(daysUntil), "day")} overdue`,
        tone: "danger",
        opportunityId: activity.opportunityId,
      });
    } else if (daysUntil <= 7) {
      reminders.push({
        id: `reminder-${activity.id}`,
        title: activity.nextStep,
        detail: activity.text,
        dueLabel:
          daysUntil === 0 ? "Due today" : `Due in ${daysUntil} ${pluralize(daysUntil, "day")}`,
        tone: "warning",
        opportunityId: activity.opportunityId,
      });
    }
  }

  return reminders;
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
