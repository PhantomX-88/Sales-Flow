/**
 * Core domain types for the SalesFlow pipeline dashboard.
 *
 * These shapes mirror the Supabase payloads used by the dashboard provider.
 */

export type PipelineStage =
  | "Lead"
  | "Discovery"
  | "Qualified"
  | "Proposal"
  | "Negotiation"
  | "Closed Won"
  | "Closed Lost";

export interface Opportunity {
  id: string;
  company: string;
  contact: string;
  email?: string;
  phone?: string;
  stage: PipelineStage;
  value: number;
  probability: number;
  owner: string;
  /** Days since the opportunity was created, kept in sync with `createdDate`. */
  age: number;
  expectedCloseDate: string;
  createdDate: string;
  lastActivity: string;
  leadSource: string;
  notes?: string;
  closedDate?: string;
  /**
   * True when a user has explicitly set the probability. Stage moves then
   * leave the probability untouched instead of snapping to the stage default.
   */
  probabilityOverridden?: boolean;
}

export interface StageDefinition {
  id: string;
  name: PipelineStage;
  probability: number;
}

export interface Owner {
  id: string;
  name: string;
  role: string;
  initials: string;
}

export interface OwnerIdentity extends Owner {
  fullName?: string;
}

export type ActivityType =
  | "proposal"
  | "stage_change"
  | "lead"
  | "overdue"
  | "won"
  | "lost"
  | "note"
  | "call"
  | "email"
  | "meeting";

export interface Activity {
  id: string;
  type: ActivityType;
  text: string;
  time: string;
  opportunityId?: string;
}

export interface MonthlyRevenuePoint {
  month: string;
  pipeline: number;
  won: number;
}

export interface ForecastTargets {
  quarterlyTarget: number;
  closedRevenue: number;
  commit: number;
  bestCase: number;
}

export interface DatasetMetadata {
  dataset: string;
  currency: string;
  period: string;
  lastUpdated: string;
}

export interface SalesDataset {
  metadata: DatasetMetadata;
  stages: StageDefinition[];
  owners: Owner[];
  opportunities: Opportunity[];
  monthlyRevenue: MonthlyRevenuePoint[];
  forecast: ForecastTargets;
  activities: Activity[];
}

/* ------------------------------------------------------------------ */
/* Dashboard UI state                                                  */
/* ------------------------------------------------------------------ */

export type SortKey =
  | "company"
  | "value"
  | "probability"
  | "age"
  | "expectedCloseDate"
  | "lastActivity";

export type SortDirection = "asc" | "desc";

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

export type ValueBucket = "all" | "under-25k" | "25k-50k" | "50k-100k" | "over-100k";

export type DateRangeKey =
  | "all"
  | "overdue"
  | "next-30-days"
  | "this-quarter"
  | "next-quarter";

export type DateFieldKey = "expectedCloseDate" | "createdDate";

export interface Filters {
  stage: PipelineStage | "all";
  owner: string | "all";
  valueBucket: ValueBucket;
  dateField: DateFieldKey;
  dateRange: DateRangeKey;
}

export interface FilterQuery {
  search: string;
  filters: Filters;
}

export type ChartRangeKey = "this-quarter" | "last-quarter" | "this-year";

export type PipelineViewMode = "table" | "kanban";

export interface DashboardSettings {
  pageSize: number;
  density: "comfortable" | "compact";
  showClosedLostColumn: boolean;
  defaultPipelineView: PipelineViewMode;
}

/* ------------------------------------------------------------------ */
/* Derived metrics                                                     */
/* ------------------------------------------------------------------ */

export interface TrendIndicator {
  /** Signed value: percentage points, percent change or absolute count. */
  value: number;
  kind: "percent" | "points" | "count";
  label: string;
}

export interface KpiMetric {
  id: string;
  label: string;
  value: string;
  supporting: string;
  trend: TrendIndicator | null;
  /** Optional secondary metric rendered under the value. */
  footnote?: string;
}

export interface FunnelStage {
  stage: PipelineStage;
  /** Deals that reached this stage or beyond. */
  reachedCount: number;
  reachedValue: number;
  /** Conversion from the previous stage, 0-100. */
  conversionRate: number | null;
}

export interface RepPerformance {
  id: string;
  name: string;
  initials: string;
  role: string;
  pipeline: number;
  won: number;
  winRate: number;
  openCount: number;
  wonCount: number;
}

export interface ForecastSummary {
  quarterlyTarget: number;
  closedRevenue: number;
  commit: number;
  bestCase: number;
  weightedForecast: number;
  gapToTarget: number;
  attainmentPercent: number;
  confidencePercent: number;
  status: "on-track" | "at-risk";
}

export interface PipelineMetrics {
  pipelineValue: number;
  weightedForecast: number;
  openCount: number;
  winRate: number;
  averageDealSize: number;
  averageSalesCycle: number;
  wonValue: number;
  lostValue: number;
  wonCount: number;
  lostCount: number;
  stalledCount: number;
  overdueCount: number;
  closingThisMonth: number;
}

export type DashboardView =
  | "overview"
  | "pipeline"
  | "accounts"
  | "activities"
  | "forecast"
  | "tasks"
  | "settings";

export interface OpportunityDraft {
  company: string;
  contact: string;
  email: string;
  phone: string;
  value: string;
  stage: PipelineStage;
  probability: string;
  expectedCloseDate: string;
  leadSource: string;
  owner: string;
  notes: string;
}

export interface AccountSummary {
  company: string;
  owner: string;
  contact: string;
  openValue: number;
  wonValue: number;
  opportunityCount: number;
  primaryStage: PipelineStage;
  lastActivity: string;
  health: "healthy" | "attention" | "at-risk";
  opportunityId: string;
}

export interface TaskItem {
  id: string;
  title: string;
  detail: string;
  dueLabel: string;
  tone: "danger" | "warning" | "info";
  opportunityId: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  tone: "danger" | "warning" | "info" | "success";
  opportunityId?: string;
}
