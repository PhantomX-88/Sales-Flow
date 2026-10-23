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
  | "Invoiced"
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
  /**
   * Authoritative owner (organization_members.user_id). The `owner` text is a
   * legacy display column kept in sync by a Postgres trigger.
   */
  ownerId?: string;
  /** Auth user who created the deal; drives sub-user deletion requests. */
  createdBy?: string;
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
  /** Soft-delete markers (Phase 5). `deletedAt` set means the row is trashed. */
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
  /** True when an open deletion request exists for this deal. */
  deletionPending?: boolean;
  /** Optional link to a shared account record (legacy `company` text is kept). */
  accountId?: string;
  /** Optional link to a shared contact record (legacy `contact` text is kept). */
  contactId?: string;
  /* Payment tracking for Closed Won deals */
  amountPaid?: number;
  installmentFrequency?: "none" | "monthly" | "quarterly" | "triannual" | "biannual";
  nextPaymentDate?: string;
}

export interface DeletionRequest {
  id: string;
  opportunityId: string;
  opportunityCompany: string;
  requestedBy: string;
  requestedByName?: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewComment?: string;
  createdAt: string;
  reviewedAt?: string;
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
  | "meeting"
  | "follow-up";

export interface Activity {
  id: string;
  type: ActivityType;
  text: string;
  time: string;
  /** Raw ISO timestamp from `created_at`; drives real last-activity math. */
  createdAt?: string;
  opportunityId?: string;
  /** Optional next step logged with the activity (drives reminders). */
  nextStep?: string;
  /** Optional due date (YYYY-MM-DD) for the next step. */
  dueDate?: string;
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
  /** Deals currently sitting in this stage (a snapshot, not stage history). */
  reachedCount: number;
  reachedValue: number;
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
  /** Configured org target for the period. */
  target: number;
  period: "monthly" | "quarterly" | "annual";
  /**
   * Inclusive UTC window (YYYY-MM-DD) the forecast figures belong to.
   * Open deals count only when `expectedCloseDate` falls inside it; closed
   * revenue counts only when `closedDate` falls inside it.
   */
  windowStart: string;
  windowEnd: string;
  /** Open deals whose expected close date falls inside the window. */
  openInPeriodCount: number;
  closedRevenue: number;
  /** Open deals at the 85%+ probability threshold — a planning label, not a guarantee. */
  commit: number;
  bestCase: number;
  weightedForecast: number;
  gapToTarget: number;
  attainmentPercent: number;
  /**
   * Projected target coverage = (closed revenue + weighted forecast) / target.
   * A plain ratio, not a statistical confidence figure.
   */
  projectedCoveragePercent: number;
  status: "on-track" | "at-risk";
}

export interface PipelineMetrics {
  /** Sum of all open deal values, regardless of period (view-level stat). */
  pipelineValue: number;
  openCount: number;
  winRate: number;
  averageDealSize: number;
  averageSalesCycle: number;
  wonValue: number;
  lostValue: number;
  wonCount: number;
  lostCount: number;
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
  | "team"
  | "approvals"
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
  /** Selected existing account record (resolved from the company text). */
  accountId?: string;
  /** Selected existing contact record (resolved from the contact text). */
  contactId?: string;
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

/* ------------------------------------------------------------------ */
/* Accounts & contacts (Phase 1 CRM layer)                            */
/* ------------------------------------------------------------------ */

export interface AccountRecord {
  id: string;
  organizationId: string;
  name: string;
  website?: string;
  industry?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ContactRecord {
  id: string;
  organizationId: string;
  accountId?: string;
  fullName: string;
  title?: string;
  email?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

/* ------------------------------------------------------------------ */
/* Invoices (Phase 2 — invoicing & payment tracking)                  */
/* ------------------------------------------------------------------ */

export type InvoiceStatus = "draft" | "pending_approval" | "approved" | "sent" | "paid";

export interface Invoice {
  id: string;
  organizationId: string;
  opportunityId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  amount: number;
  status: InvoiceStatus;
  dueDate?: string;
  lineItems: InvoiceLineItem[];
  notes?: string;
  createdBy: string;
  createdByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  sentAt?: string;
  sentMethod?: "email" | "whatsapp";
  sentUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceDraft {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  amount: number;
  dueDate?: string;
  lineItems: InvoiceLineItem[];
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* Churn records (Phase 2 — churn tracking)                           */
/* ------------------------------------------------------------------ */

export interface ChurnRecord {
  id: string;
  organizationId: string;
  opportunityId: string;
  churnedAt: string;
  reason: string;
  outstandingAmount: number;
  notes?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

