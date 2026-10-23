"use client";

import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { toast } from "@/components/ui/use-toast";
import { buildAttentionQueue, type AttentionItem } from "@/lib/attention";
import type { ImportJob, ImportJobResult, NormalizedDeal } from "@/lib/csv-import";
import {
  buildExportRows,
  computeAccounts,
  computeForecast,
  computeFunnel,
  computeKpis,
  computeMetrics,
  computeMonthlyRevenue,
  computeReminders,
  computeRepPerformance,
  computeTasks,
  countActiveFilters,
  defaultProbabilityFor,
  EXPORT_HEADERS,
  filterOpportunities,
  isProbabilityOverridden,
  sortOpportunities,
} from "@/lib/metrics";
import { dataset, KANBAN_STAGES, ownerNames as configuredOwnerNames, TODAY } from "@/lib/pipeline-config";
import type {
  AccountRecord,
  AccountSummary,
  Activity,
  ActivityType,
  ChartRangeKey,
  ChurnRecord,
  ContactRecord,
  DashboardSettings,
  DashboardView,
  Filters,
  ForecastSummary,
  FunnelStage,
  Invoice,
  KpiMetric,
  MonthlyRevenuePoint,
  Opportunity,
  OpportunityDraft,
  PipelineMetrics,
  PipelineStage,
  PipelineViewMode,
  RepPerformance,
  SortKey,
  SortState,
  DeletionRequest,
  TaskItem,
} from "@/lib/types";
import { buildCsv, daysBetween, downloadCsv, formatCurrency } from "@/lib/utils";
import { getSupabaseClient } from "@/lib/supabase";

const DEFAULT_FILTERS: Filters = {
  stage: "all",
  owner: "all",
  valueBucket: "all",
  dateField: "expectedCloseDate",
  dateRange: "all",
};

type AccountContactInput = {
  company: string;
  contact: string;
  email?: string;
  phone?: string;
  accountId?: string;
  contactId?: string;
};

type AccountContactCache = {
  accounts: AccountRecord[];
  contacts: ContactRecord[];
};

const DEFAULT_SORT: SortState = { key: "value", direction: "desc" };

const DEFAULT_SETTINGS: DashboardSettings = {
  pageSize: 10,
  density: "comfortable",
  showClosedLostColumn: true,
  defaultPipelineView: "table",
};

const ASCENDING_KEYS: SortKey[] = ["company", "lastActivity"];
type OrganizationCurrency = "NGN" | "USD";

interface PipelineContextValue {
  /* dataset */
  metadata: typeof dataset.metadata;
  currency: OrganizationCurrency;
  owners: typeof dataset.owners;
  stages: typeof dataset.stages;
  kanbanStages: PipelineStage[];
  ownerNames: string[];
  today: string;
  isLoading: boolean;

  /* opportunities + activities */
  opportunities: Opportunity[];
  activities: Activity[];
  /** Personal sales_targets row for the signed-in sub-user (null for owners). */
  personalTarget: { amount: number; period: string } | null;

  /* query state */
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filters: Filters;
  updateFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  resetFilters: () => void;
  clearAllFilters: () => void;
  activeFilterCount: number;
  sort: SortState;
  toggleSort: (key: SortKey) => void;
  setSort: (sort: SortState) => void;

  /* results */
  filtered: Opportunity[];
  visible: Opportunity[];
  totalFiltered: number;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;

  /* derived */
  metrics: PipelineMetrics;
  kpis: KpiMetric[];
  funnel: FunnelStage[];
  repPerformance: RepPerformance[];
  forecast: ForecastSummary;
  monthlyRevenue: MonthlyRevenuePoint[];
  accounts: AccountSummary[];
  tasks: TaskItem[];

  /* Phase 5 — soft-deleted rows (owner trash view) */
  deletedOpportunities: Opportunity[];

  /* navigation */
  view: DashboardView;
  setView: (view: DashboardView) => void;
  pipelineView: PipelineViewMode;
  setPipelineView: (view: PipelineViewMode) => void;
  chartRange: ChartRangeKey;
  setChartRange: (range: ChartRangeKey) => void;

  /* toolbar UI */
  filtersOpen: boolean;
  toggleFilters: () => void;

  /* selection */
  selectedOpportunity: Opportunity | null;
  openOpportunity: (id: string) => void;
  closeOpportunity: () => void;
  isCreateOpen: boolean;
  openCreateDialog: () => void;
  closeCreateDialog: () => void;
  isImportOpen: boolean;
  openImportDialog: () => void;
  closeImportDialog: () => void;
  editingOpportunity: Opportunity | null;
  openEditDialog: (id: string) => void;
  closeEditDialog: () => void;

  /* actions */
  createOpportunity: (draft: OpportunityDraft) => Promise<boolean>;
  updateOpportunity: (id: string, draft: OpportunityDraft) => Promise<boolean>;
  moveStage: (id: string, stage: PipelineStage) => void;
  markWon: (id: string) => void;
  markLost: (id: string) => void;
  /* Phase 5 deletion flow */
  deleteOpportunity: (id: string, reason?: string) => Promise<boolean>;
  requestDeletion: (id: string, reason: string) => Promise<boolean>;
  reviewDeletionRequest: (
    requestId: string,
    decision: "approve" | "reject",
    comment?: string,
  ) => Promise<boolean>;
  restoreOpportunity: (id: string) => Promise<boolean>;
  deletionRequests: DeletionRequest[];
  pendingDeletionCount: number;
  reassignOpportunity: (id: string, newOwnerId: string) => Promise<boolean>;
  addActivity: (
    opportunityId: string,
    type: ActivityType,
    text: string,
    meta?: { nextStep?: string; dueDate?: string },
  ) => void;
  exportCsv: (rows?: Opportunity[], filename?: string) => void;

  /* Phase 1 — attention queue */
  attention: AttentionItem[];
  loadError: string | null;
  recordsLoadError: string | null;
  /** Opens the deal drawer with the activity/next-step form ready. */
  openActivityLog: (id: string) => void;
  /** Opportunity id whose drawer should start on the activity form. */
  logActivityIntent: string | null;
  clearLogActivityIntent: () => void;

  /* Phase 1 — CSV import (RLS-scoped, sequential with per-row results) */
  importDeals: (jobs: ImportJob[]) => Promise<ImportJobResult[]>;
  /** Display names of active members eligible to own imported deals. */
  eligibleOwners: string[];

  /* Phase 1 — accounts & contacts */
  accountRecords: AccountRecord[];
  contactRecords: ContactRecord[];
  saveAccount: (name: string) => Promise<AccountRecord | null>;
  saveContact: (input: {
    fullName: string;
    email?: string;
    phone?: string;
    accountId?: string;
  }) => Promise<ContactRecord | null>;
  updateAccount: (
    id: string,
    patch: Partial<Pick<AccountRecord, "name" | "website" | "industry" | "notes">>,
  ) => Promise<boolean>;
  updateContact: (
    id: string,
    patch: Partial<Pick<ContactRecord, "fullName" | "title" | "email" | "phone" | "notes" | "accountId">>,
  ) => Promise<boolean>;

  /* settings */
  settings: DashboardSettings;
  updateSettings: (patch: Partial<DashboardSettings>) => void;
}

const PipelineContext = React.createContext<PipelineContextValue | null>(null);

function draftToOpportunity(
  draft: OpportunityDraft,
  today: string,
  id: string,
  existing?: Opportunity,
): Opportunity {
  const value = Number(draft.value.replace(/[^0-9.]/g, "")) || 0;
  const probability = Math.min(
    Math.max(Math.round(Number(draft.probability.replace(/[^0-9.]/g, "")) || 0), 0),
    100,
  );
  const createdDate = existing?.createdDate ?? today;
  const isClosedStage = draft.stage === "Closed Won" || draft.stage === "Closed Lost";

  return {
    id,
    company: draft.company.trim(),
    contact: draft.contact.trim() || "Unassigned",
    email: draft.email.trim() || undefined,
    phone: draft.phone.trim() || undefined,
    stage: draft.stage,
    value,
    probability: isClosedStage ? defaultProbabilityFor(draft.stage) : probability,
    owner: draft.owner,
    age: Math.max(daysBetween(today, createdDate), 0),
    expectedCloseDate: draft.expectedCloseDate || existing?.expectedCloseDate || today,
    createdDate,
    lastActivity: "Just now",
    leadSource: draft.leadSource,
    notes: draft.notes.trim() || undefined,
    closedDate: isClosedStage ? (existing?.closedDate ?? today) : undefined,
    probabilityOverridden:
      !isClosedStage && probability !== defaultProbabilityFor(draft.stage),
    accountId: draft.accountId,
    contactId: draft.contactId,
  };
}

function toOpportunityRow(
  opportunity: Opportunity,
  organizationId: string,
  includeCrmLinks = true,
) {
  return {
    organization_id: organizationId,
    company: opportunity.company,
    contact: opportunity.contact,
    email: opportunity.email ?? null,
    phone: opportunity.phone ?? null,
    stage: opportunity.stage,
    value: opportunity.value,
    probability: opportunity.probability,
    owner: opportunity.owner,
    age: opportunity.age,
    expected_close_date: opportunity.expectedCloseDate,
    created_date: opportunity.createdDate,
    last_activity: opportunity.lastActivity,
    lead_source: opportunity.leadSource,
    notes: opportunity.notes ?? null,
    closed_date: opportunity.closedDate ?? null,
    probability_overridden: opportunity.probabilityOverridden ?? false,
    ...(includeCrmLinks
      ? {
          account_id: opportunity.accountId ?? null,
          contact_id: opportunity.contactId ?? null,
        }
      : {}),
  };
}

function fromOpportunityRow(row: Record<string, unknown>): Opportunity {
  return {
    id: String(row.id),
    company: String(row.company),
    contact: String(row.contact),
    email: row.email ? String(row.email) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    stage: row.stage as PipelineStage,
    value: Number(row.value),
    probability: Number(row.probability),
    owner: String(row.owner),
    ownerId: row.owner_id ? String(row.owner_id) : undefined,
    createdBy: row.created_by ? String(row.created_by) : undefined,
    deletedAt: row.deleted_at ? String(row.deleted_at) : undefined,
    deletedBy: row.deleted_by ? String(row.deleted_by) : undefined,
    deleteReason: row.delete_reason ? String(row.delete_reason) : undefined,
    age: Number(row.age),
    expectedCloseDate: String(row.expected_close_date),
    createdDate: String(row.created_date),
    lastActivity: String(row.last_activity),
    leadSource: String(row.lead_source),
    notes: row.notes ? String(row.notes) : undefined,
    closedDate: row.closed_date ? String(row.closed_date) : undefined,
    probabilityOverridden: Boolean(row.probability_overridden),
    accountId: row.account_id ? String(row.account_id) : undefined,
    contactId: row.contact_id ? String(row.contact_id) : undefined,
  };
}

const ACTIVITY_TYPES: ActivityType[] = [
  "proposal",
  "stage_change",
  "lead",
  "overdue",
  "won",
  "lost",
  "note",
  "call",
  "email",
  "meeting",
  "follow-up",
];

function fromActivityRow(row: Record<string, unknown>): Activity {
  const type = ACTIVITY_TYPES.includes(row.type as ActivityType)
    ? (row.type as ActivityType)
    : "note";
  return {
    id: String(row.id),
    type,
    text: String(row.text),
    time: row.created_at ? new Date(String(row.created_at)).toLocaleString() : "Just now",
    createdAt: row.created_at ? String(row.created_at) : undefined,
    opportunityId: row.opportunity_id ? String(row.opportunity_id) : undefined,
    nextStep: row.next_step ? String(row.next_step) : undefined,
    dueDate: row.due_date ? String(row.due_date) : undefined,
  };
}

function fromAccountRow(row: Record<string, unknown>): AccountRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name),
    website: row.website ? String(row.website) : undefined,
    industry: row.industry ? String(row.industry) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function fromContactRow(row: Record<string, unknown>): ContactRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    accountId: row.account_id ? String(row.account_id) : undefined,
    fullName: String(row.full_name),
    title: row.title ? String(row.title) : undefined,
    email: row.email ? String(row.email) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const { displayName, isAuthenticated, isReady, organizationId, organization, membershipRole, userId, resolveOrganization } = useAuth();
  const currency: OrganizationCurrency = organization?.currency ?? "USD";
  const organizationOwners = React.useMemo(
    () => displayName ? [{ id: "current-user", name: displayName, role: "Member", initials: displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() }] : [],
    [displayName],
  );
  const organizationOwnerNames = organizationOwners.map((owner) => owner.name);
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>([]);
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [deletionRequests, setDeletionRequests] = React.useState<DeletionRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [recordsLoadError, setRecordsLoadError] = React.useState<string | null>(null);
  const [accountRecords, setAccountRecords] = React.useState<AccountRecord[]>([]);
  const [contactRecords, setContactRecords] = React.useState<ContactRecord[]>([]);
  const [memberNames, setMemberNames] = React.useState<{ userId: string; fullName: string }[]>([]);
  const [logActivityIntent, setLogActivityIntent] = React.useState<string | null>(null);
  const [organizationName, setOrganizationName] = React.useState<string>("Your Organization");

  const [searchQuery, setSearchQueryState] = React.useState("");
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSortState] = React.useState<SortState>(DEFAULT_SORT);
  const [page, setPageState] = React.useState(1);
  const [settings, setSettings] = React.useState<DashboardSettings>(DEFAULT_SETTINGS);

  const [view, setView] = React.useState<DashboardView>(\"overview\");

  const [invoiceRecords, setInvoiceRecords] = React.useState<Invoice[]>([]);
  const [churnRecords, setChurnRecords] = React.useState<ChurnRecord[]>([]);

  const [view, setView] = React.useState<DashboardView>("overview");
  const [pipelineView, setPipelineViewState] = React.useState<PipelineViewMode>(
    DEFAULT_SETTINGS.defaultPipelineView,
  );
  const [chartRange, setChartRange] = React.useState<ChartRangeKey>("this-quarter");
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = React.useState(false);
  const [isImportOpen, setImportOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isReady || !isAuthenticated || !organizationId) {
      if (isReady) setIsLoading(false);
      return;
    }

    let mounted = true;
    async function loadWorkspaceData() {
      setIsLoading(true);
      const supabase = getSupabaseClient();
      // Sub-users load only their own deals; RLS enforces the same rule
      // server-side — the explicit filter just narrows the payload.
      const scopeToSelf = membershipRole === "sales_rep" && Boolean(userId);
      let opportunitiesQuery = supabase
        .from("opportunities")
        .select("*")
        .eq("organization_id", organizationId);
      if (scopeToSelf) {
        opportunitiesQuery = opportunitiesQuery.eq("owner_id", userId as string);
      }
      // Sentinel UUID keeps the query valid while userId is still null;
      // it never matches a real row.
      const targetUserId = userId ?? "00000000-0000-0000-0000-000000000000";
      const [opportunitiesResult, activitiesResult, targetResult, deletionResult, accountsResult, contactsResult, membersResult, orgResult] = await Promise.all([
        opportunitiesQuery.order("created_at", { ascending: false }),
        supabase.from("activities").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        supabase
          .from("sales_targets")
          .select("target_amount, period")
          .eq("organization_id", organizationId)
          .eq("user_id", targetUserId)
          .maybeSingle(),
        // Phase 5: owners get the approvals queue; sub-users get their own
        // request statuses ("Deletion pending" badge). RLS narrows rows.
        supabase
          .from("deletion_requests")
          .select(
            "id, opportunity_id, requested_by, reason, status, reviewed_by, review_comment, created_at, reviewed_at",
          )
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false }),
        // Phase 1: shared account/contact records — RLS scopes them to the org.
        supabase.from("accounts").select("*").eq("organization_id", organizationId).order("name"),
        supabase.from("contacts").select("*").eq("organization_id", organizationId).order("full_name"),
        // Eligible owners for imports/assignment (RLS: reps see themselves only).
        supabase
          .from("organization_members")
          .select("user_id, status")
          .eq("organization_id", organizationId)
          .eq("status", "active"),
      ]);
      if (!mounted) return;
      if (opportunitiesResult.error || activitiesResult.error) {
        setLoadError("Could not load organization data. Check your connection and Row Level Security policies, then reload.");
        toast({ title: "Could not load organization data.", description: "Check your Supabase tables and Row Level Security policies.", variant: "destructive" });
      } else {
        setLoadError(null);
        const loadedOpportunities = (opportunitiesResult.data ?? []).map((row) =>
          fromOpportunityRow(row as Record<string, unknown>),
        );
        const companyNameById = new Map(loadedOpportunities.map((o) => [o.id, o.company]));
        setOpportunities(loadedOpportunities);
        const org = orgResult.data?.[0] as OrganizationRecord | undefined;
        setOrganizationName(org?.name ?? "Your Organization");
        setActivities((activitiesResult.data ?? []).map((row) => fromActivityRow(row as Record<string, unknown>)));
        setDeletionRequests(
          ((deletionResult.data ?? []) as Record<string, unknown>[]).map((row) => ({
            id: String(row.id),
            opportunityId: String(row.opportunity_id),
            opportunityCompany: companyNameById.get(String(row.opportunity_id)) ?? "Opportunity",
            requestedBy: String(row.requested_by),
            reason: String(row.reason ?? ""),
            status: String(row.status ?? "pending") as DeletionRequest["status"],
            reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
            reviewComment: row.review_comment ? String(row.review_comment) : undefined,
            createdAt: String(row.created_at),
            reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
          })),
        );
        if (accountsResult.error || contactsResult.error) {
          setRecordsLoadError(
            "Company and contact records could not load. Check the Phase 1 database migration and Row Level Security policies, then reload.",
          );
        } else {
          setRecordsLoadError(null);
          setAccountRecords(
            ((accountsResult.data ?? []) as Record<string, unknown>[]).map(fromAccountRow),
          );
          setContactRecords(
            ((contactsResult.data ?? []) as Record<string, unknown>[]).map(fromContactRow),
          );
        }
        const memberRows = ((membersResult.data ?? []) as { user_id: string }[]) ?? [];
        if (memberRows.length) {
          const profilesResult = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", memberRows.map((row) => row.user_id));
          if (!profilesResult.error && mounted) {
            const namesById = new Map(
              ((profilesResult.data ?? []) as { id: string; full_name: string | null }[]).map(
                (profile) => [profile.id, profile.full_name?.trim() ?? ""],
              ),
            );
            setMemberNames(
              memberRows.map((row) => ({
                userId: row.user_id,
                fullName: namesById.get(row.user_id) || displayName || "Team member",
              })),
            );
          }
        } else if (userId && displayName) {
          setMemberNames([{ userId, fullName: displayName }]);
        }
      }
      if (!targetResult.error) {
        setPersonalTarget(
          targetResult.data
            ? { amount: Number(targetResult.data.target_amount ?? 0), period: String(targetResult.data.period ?? "monthly") }
            : null,
        );
      }
      setIsLoading(false);
    }

    void loadWorkspaceData();
    return () => {
      mounted = false;
    };
  }, [displayName, isAuthenticated, isReady, organizationId, membershipRole, userId]);

  const setSearchQuery = React.useCallback((value: string) => {
    setSearchQueryState(value);
    setPageState(1);
  }, []);

  const updateFilter = React.useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters((current) => ({ ...current, [key]: value }));
      setPageState(1);
    },
    [],
  );

  const resetFilters = React.useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPageState(1);
  }, []);

  const clearAllFilters = React.useCallback(() => {
    setSearchQueryState("");
    setFilters(DEFAULT_FILTERS);
    setPageState(1);
  }, []);

  const toggleSort = React.useCallback((key: SortKey) => {
    setSortState((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: ASCENDING_KEYS.includes(key) ? "asc" : "desc" },
    );
    setPageState(1);
  }, []);

  const setSort = React.useCallback((next: SortState) => {
    setSortState(next);
    setPageState(1);
  }, []);

  const setPageSize = React.useCallback((size: number) => {
    setSettings((current) => ({ ...current, pageSize: size }));
    setPageState(1);
  }, []);

  const updateSettings = React.useCallback((patch: Partial<DashboardSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    if (patch.defaultPipelineView) setPipelineViewState(patch.defaultPipelineView);
  }, []);

  const setPipelineView = React.useCallback((next: PipelineViewMode) => {
    setPipelineViewState(next);
  }, []);

  /* ------------------------------------------------------------------ */
  /* Derived data — every widget reads from these memoised selectors      */
  /* ------------------------------------------------------------------ */

  /* Phase 5: soft-deleted rows stay out of every metric, list and chart.
     Owners reach them through the Deleted-deals view. */
  const liveOpportunities = React.useMemo(
    () => opportunities.filter((opportunity) => !opportunity.deletedAt),
    [opportunities],
  );
  const deletedOpportunities = React.useMemo(
    () => opportunities.filter((opportunity) => Boolean(opportunity.deletedAt)),
    [opportunities],
  );

  const filtered = React.useMemo(
    () => filterOpportunities(liveOpportunities, searchQuery, filters, TODAY),
    [liveOpportunities, searchQuery, filters],
  );

  const sorted = React.useMemo(
    () => sortOpportunities(filtered, sort, TODAY),
    [filtered, sort],
  );

  const activeFilterCount = React.useMemo(() => countActiveFilters(filters), [filters]);

  const totalFiltered = sorted.length;
  const totalPages = Math.max(Math.ceil(totalFiltered / settings.pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const rangeStart = totalFiltered === 0 ? 0 : (safePage - 1) * settings.pageSize + 1;
  const rangeEnd = Math.min(safePage * settings.pageSize, totalFiltered);

  const visible = React.useMemo(
    () => sorted.slice((safePage - 1) * settings.pageSize, safePage * settings.pageSize),
    [sorted, safePage, settings.pageSize],
  );

  /* Phase 5: overlay "Deletion pending" onto visible rows without touching
     the sort/filter pipeline. */
  const pendingDeletionIds = React.useMemo(
    () => new Set(deletionRequests.filter((r) => r.status === "pending").map((r) => r.opportunityId)),
    [deletionRequests],
  );
  const visibleWithDeletionState = React.useMemo(
    () =>
      visible.map((opportunity) => ({
        ...opportunity,
        deletionPending: pendingDeletionIds.has(opportunity.id),
      })),
    [visible, pendingDeletionIds],
  );

  const metrics = React.useMemo(() => computeMetrics(liveOpportunities, TODAY), [liveOpportunities]);
  const monthlyRevenue = React.useMemo(
    () => computeMonthlyRevenue(liveOpportunities, TODAY),
    [liveOpportunities],
  );
  const funnel = React.useMemo(() => computeFunnel(liveOpportunities), [liveOpportunities]);
  const repPerformance = React.useMemo(
    () => computeRepPerformance(liveOpportunities, organizationOwners),
    [liveOpportunities, organizationOwners],
  );
  // Single target-period definition shared by the forecast card, the KPI
  // strip and the forecast view — see computeForecast for the rules.
  const forecastTargets = React.useMemo(() => {
    const resolvedPeriod =
      membershipRole === "sales_rep" &&
      personalTarget &&
      (personalTarget.period === "monthly" ||
        personalTarget.period === "quarterly" ||
        personalTarget.period === "annual")
        ? personalTarget.period
        : organization?.targetPeriod ?? "quarterly";
    const resolvedTarget =
      membershipRole === "sales_rep" && personalTarget ? personalTarget.amount : organization?.revenueTarget ?? 0;
    return { amount: resolvedTarget, period: resolvedPeriod };
  }, [membershipRole, organization?.targetPeriod, organization?.revenueTarget, personalTarget]);

  const forecast = React.useMemo(
    () => computeForecast(liveOpportunities, forecastTargets, TODAY),
    [liveOpportunities, forecastTargets],
  );
  const kpis = React.useMemo(
    () => computeKpis(liveOpportunities, monthlyRevenue, forecastTargets, TODAY, currency),
    [currency, forecastTargets, monthlyRevenue, liveOpportunities],
  );
  const accounts = React.useMemo(
    () => computeAccounts(liveOpportunities, activities, TODAY),
    [activities, liveOpportunities],
  );
  const attention = React.useMemo(
    () => buildAttentionQueue(liveOpportunities, activities, TODAY),
    [activities, liveOpportunities],
  );
  const tasks = React.useMemo(() => {
    const toneWeight = { danger: 0, warning: 1, info: 2 } as const;
    return [
      ...computeTasks(liveOpportunities, TODAY, currency),
      ...computeReminders(activities, TODAY),
    ].sort((a, b) => toneWeight[a.tone] - toneWeight[b.tone]);
  }, [activities, currency, liveOpportunities]);

  const selectedOpportunity = React.useMemo(
    () => opportunities.find((opportunity) => opportunity.id === selectedId) ?? null,
    [opportunities, selectedId],
  );

  const editingOpportunity = React.useMemo(
    () => opportunities.find((opportunity) => opportunity.id === editingId) ?? null,
    [opportunities, editingId],
  );

  /* ------------------------------------------------------------------ */
  /* Mutations                                                           */
  /* ------------------------------------------------------------------ */

  const pushActivity = React.useCallback(
    async (activity: Omit<Activity, "id" | "time">): Promise<boolean> => {
      if (!organizationId) return false;
      const { data, error } = await getSupabaseClient()
        .from("activities")
        .insert({
          organization_id: organizationId,
          opportunity_id: activity.opportunityId ?? null,
          type: activity.type,
          text: activity.text,
          next_step: activity.nextStep ?? null,
          due_date: activity.dueDate ?? null,
        })
        .select("id, created_at")
        .single();
      if (error || !data) {
        toast({ title: "Activity could not be saved.", description: error?.message, variant: "destructive" });
        return false;
      }
      setActivities((current) => [
        {
          ...activity,
          id: String(data.id),
          time: data.created_at ? new Date(data.created_at).toLocaleString() : "Just now",
          createdAt: data.created_at ? String(data.created_at) : new Date().toISOString(),
        },
        ...current,
      ]);
      return true;
    },
    [organizationId],
  );

  /**
   * Resolve shared account/contact links for a draft. Existing records are
   * matched by exact (case-insensitive) name — never by fuzzy text — and a
   * new record is created only when there is no match. Ambiguous contact
   * matches stay unlinked (legacy free-text fields remain untouched).
   */
  const resolveAccountContact = React.useCallback(
    async (
      draft: AccountContactInput,
      targetOrganizationId = organizationId,
      cache: AccountContactCache = {
        accounts: [...accountRecords],
        contacts: [...contactRecords],
      },
    ): Promise<{ accountId?: string; contactId?: string } | null> => {
      if (!targetOrganizationId) {
        toast({ title: "Company/contact links could not be resolved.", description: "Your organization is still loading.", variant: "destructive" });
        return null;
      }
      const supabase = getSupabaseClient();
      const companyName = draft.company.trim();
      const contactName = draft.contact.trim();

      let accountId = draft.accountId;
      if (!accountId && companyName) {
        const match = cache.accounts.find(
          (account) => account.name.trim().toLowerCase() === companyName.toLowerCase(),
        );
        if (match) {
          accountId = match.id;
        } else {
          const { data: created, error } = await supabase
            .from("accounts")
            .insert({ organization_id: targetOrganizationId, name: companyName })
            .select()
            .single();
          if (error?.code === "23505") {
            const { data: existing, error: lookupError } = await supabase
              .from("accounts")
              .select("*")
              .eq("organization_id", targetOrganizationId);
            const existingMatch = (existing ?? []).find(
              (row) =>
                String(row.name).trim().toLowerCase() === companyName.toLowerCase(),
            );
            if (lookupError || !existingMatch) {
              toast({
                title: "Company could not be resolved.",
                description: lookupError?.message ?? error.message,
                variant: "destructive",
              });
              return null;
            }
            const record = fromAccountRow(existingMatch as Record<string, unknown>);
            accountId = record.id;
            cache.accounts.push(record);
            setAccountRecords((current) =>
              current.some((account) => account.id === record.id)
                ? current
                : [...current, record].sort((a, b) => a.name.localeCompare(b.name)),
            );
          } else if (error || !created) {
            toast({
              title: "Company could not be saved.",
              description: error?.message ?? "No company record was returned.",
              variant: "destructive",
            });
            return null;
          } else {
            const record = fromAccountRow(created as Record<string, unknown>);
            accountId = record.id;
            cache.accounts.push(record);
            setAccountRecords((current) => [...current, record].sort((a, b) => a.name.localeCompare(b.name)));
          }
        }
      }

      let contactId = draft.contactId;
      const email = (draft.email ?? "").trim().toLowerCase();
      const phone = (draft.phone ?? "").trim();
      if (!contactId && contactName && contactName !== "Unassigned") {
        const candidates = cache.contacts.filter(
          (contact) =>
            contact.accountId === accountId &&
            contact.fullName.trim().toLowerCase() === contactName.toLowerCase(),
        );
        const linked =
          candidates.find(
            (contact) =>
              (email ? (contact.email ?? "").trim().toLowerCase() === email : !(contact.email ?? "")) &&
              (phone ? (contact.phone ?? "").trim() === phone : true),
          ) ?? null;
        if (linked) {
          contactId = linked.id;
        } else if (candidates.length === 0) {
          const { data: created, error } = await supabase
            .from("contacts")
            .insert({
              organization_id: targetOrganizationId,
              account_id: accountId ?? null,
              full_name: contactName,
              email: email || null,
              phone: phone || null,
            })
            .select()
            .single();
          if (error || !created) {
            toast({
              title: "Contact could not be saved.",
              description: error?.message ?? "No contact record was returned.",
              variant: "destructive",
            });
            return null;
          } else {
            const record = fromContactRow(created as Record<string, unknown>);
            contactId = record.id;
            cache.contacts.push(record);
            setContactRecords((current) => [...current, record].sort((a, b) => a.fullName.localeCompare(b.fullName)));
          }
        }
        // Ambiguous name with conflicting emails: leave unlinked rather than
        // guess — the user can link explicitly from the deal form.
        else {
          toast({
            title: "Contact was not linked.",
            description: "More than one contact matches this company and name. Choose the correct contact in the deal form.",
          });
        }
      }

      return { accountId, contactId };
    },
    [accountRecords, contactRecords, organizationId],
  );

  const createOpportunity = React.useCallback(
    async (draft: OpportunityDraft) => {
      let activeOrganizationId = organizationId;
      if (!activeOrganizationId) {
        const resolved = await resolveOrganization();
        activeOrganizationId = resolved.organizationId;
        if (!activeOrganizationId) {
          toast({
            title: "Opportunity could not be created.",
            description: resolved.error ?? "No organization is linked to your account. Complete organization setup and try again.",
            variant: "destructive",
          });
          return false;
        }
      }
      const id = crypto.randomUUID();
      const opportunity = draftToOpportunity(draft, TODAY, id);
      const { data, error } = await getSupabaseClient()
        .from("opportunities")
        .insert(toOpportunityRow(opportunity, activeOrganizationId, false))
        .select()
        .single();
      if (error || !data) {
        toast({ title: "Opportunity could not be created.", description: error?.message, variant: "destructive" });
        return false;
      }
      let savedOpportunity = fromOpportunityRow(data as Record<string, unknown>);
      let links: { accountId?: string; contactId?: string } | null = null;
      try {
        links = await resolveAccountContact(draft, activeOrganizationId);
      } catch (error) {
        toast({
          title: "Opportunity created, but CRM linking failed.",
          description: error instanceof Error ? error.message : "The account/contact records could not be checked.",
          variant: "destructive",
        });
      }
      let crmLinksSaved = false;
      if (links) {
        try {
          const { data: linked, error: linkError } = await getSupabaseClient()
            .from("opportunities")
            .update({
              account_id: links.accountId ?? null,
              contact_id: links.contactId ?? null,
            })
            .eq("id", id)
            .eq("organization_id", activeOrganizationId)
            .select()
            .maybeSingle();
          if (linkError || !linked) {
            toast({
              title: "Opportunity created, but CRM links could not be saved.",
              description: linkError?.message ?? "The account/contact links were not returned. You can edit the deal to retry.",
              variant: "destructive",
            });
          } else {
            savedOpportunity = fromOpportunityRow(linked as Record<string, unknown>);
            crmLinksSaved = true;
          }
        } catch (error) {
          toast({
            title: "Opportunity created, but CRM links could not be saved.",
            description: error instanceof Error ? error.message : "You can edit the deal to retry.",
            variant: "destructive",
          });
        }
      }
      setOpportunities((current) => [savedOpportunity, ...current]);
      try {
        await pushActivity({
          type: "lead",
          text: `${savedOpportunity.company} added to ${savedOpportunity.stage}`,
          opportunityId: savedOpportunity.id,
        });
      } catch (error) {
        toast({
          title: "Opportunity created, but its activity could not be recorded.",
          description: error instanceof Error ? error.message : "The activity can be added later.",
          variant: "destructive",
        });
      }
      if (crmLinksSaved) {
        toast({
          title: "Opportunity created successfully.",
          description: `${savedOpportunity.company} · ${savedOpportunity.stage}`,
          variant: "success",
        });
      } else {
        toast({
          title: "Opportunity created without CRM links.",
          description: `${savedOpportunity.company} · ${savedOpportunity.stage}. Account/contact linking needs attention.`,
        });
      }
      setCreateOpen(false);
      return true;
    },
    [pushActivity, resolveAccountContact, resolveOrganization, organizationId],
  );

  const updateOpportunity = React.useCallback(
    async (id: string, draft: OpportunityDraft) => {
      if (!organizationId) {
        toast({ title: "Opportunity could not be updated.", description: "Your organization is still loading. Refresh the page and try again.", variant: "destructive" });
        return false;
      }
      const existing = opportunities.find((opportunity) => opportunity.id === id);
      if (!existing) return false;

      const previousStage = existing.stage;
      const links = await resolveAccountContact(draft, organizationId);
      if (!links) return false;
      const updated = draftToOpportunity({ ...draft, ...links }, TODAY, id, existing);
      const stageChanged = updated.stage !== previousStage;
      const { data: saved, error } = await getSupabaseClient()
        .from("opportunities")
        .update(toOpportunityRow(updated, organizationId))
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select("id, stage")
        .maybeSingle();
      if (error || saved?.stage !== updated.stage) {
        toast({
          title: "Opportunity could not be updated.",
          description: error?.message ?? "The opportunity was not saved in the requested stage. Check your access and refresh the pipeline.",
          variant: "destructive",
        });
        return false;
      }

      setOpportunities((current) =>
        current.map((opportunity) => (opportunity.id === id ? updated : opportunity)),
      );
      setEditingId(null);

      if (stageChanged) {
        void pushActivity({
          type: "stage_change",
          text: `${updated.company} moved to ${updated.stage}`,
          opportunityId: id,
        });
      }

      toast({
        title: "Opportunity updated.",
        description: stageChanged
          ? `${updated.company} · stage changed to ${updated.stage}`
          : `${updated.company} saved`,
        variant: "success",
      });
      return true;
    },
    [opportunities, pushActivity, resolveAccountContact, organizationId],
  );

  const moveStage = React.useCallback(
    async (id: string, stage: PipelineStage) => {
      if (!organizationId) return;
      const existing = opportunities.find((opportunity) => opportunity.id === id);
      if (!existing || existing.stage === stage) return;

      const isClosedStage = stage === "Closed Won" || stage === "Closed Lost";
      const keepProbability = isProbabilityOverridden(existing) && !isClosedStage;
      const probability = isClosedStage ? defaultProbabilityFor(stage) : keepProbability ? existing.probability : defaultProbabilityFor(stage);
      const closedDate = isClosedStage ? existing.closedDate ?? TODAY : null;
      const { data: saved, error } = await getSupabaseClient()
        .from("opportunities")
        .update({ stage, probability, last_activity: "Just now", closed_date: closedDate })
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select("id, stage")
        .maybeSingle();
      if (error || saved?.stage !== stage) {
        toast({
          title: "Stage could not be changed.",
          description: error?.message ?? "The opportunity was not updated. Check your access and refresh the pipeline.",
          variant: "destructive",
        });
        return;
      }

      setOpportunities((current) =>
        current.map((opportunity) =>
          opportunity.id === id
            ? {
                ...opportunity,
                stage,
                probability,
                lastActivity: "Just now",
                closedDate: isClosedStage ? (opportunity.closedDate ?? TODAY) : undefined,
              }
            : opportunity,
        ),
      );

      void pushActivity({
        type: stage === "Closed Won" ? "won" : stage === "Closed Lost" ? "lost" : "stage_change",
        text: `${existing.contact} moved ${existing.company} to ${stage}`,
        opportunityId: id,
      });

      toast({
        title: `Stage changed to ${stage}.`,
        description: `${existing.company} · ${probability}% probability`,
        variant: stage === "Closed Lost" ? "destructive" : "success",
      });
    },
    [opportunities, pushActivity, organizationId],
  );

  const closeDeal = React.useCallback(
    async (id: string, stage: "Closed Won" | "Closed Lost") => {
      if (!organizationId) return;
      const existing = opportunities.find((opportunity) => opportunity.id === id);
      if (!existing || existing.stage === stage) return;
      const { data: saved, error } = await getSupabaseClient()
        .from("opportunities")
        .update({ stage, probability: defaultProbabilityFor(stage), closed_date: TODAY, last_activity: "Just now" })
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select("id, stage")
        .maybeSingle();
      if (error || saved?.stage !== stage) {
        toast({
          title: "Opportunity could not be closed.",
          description: error?.message ?? "The opportunity was not updated. Check your access and refresh the pipeline.",
          variant: "destructive",
        });
        return;
      }

      setOpportunities((current) =>
        current.map((opportunity) =>
          opportunity.id === id
            ? {
                ...opportunity,
                stage,
                probability: defaultProbabilityFor(stage),
                closedDate: TODAY,
                lastActivity: "Just now",
              }
            : opportunity,
        ),
      );

      void pushActivity({
        type: stage === "Closed Won" ? "won" : "lost",
        text: `${existing.company} marked ${stage}`,
        opportunityId: id,
      });

      toast({
        title: stage === "Closed Won" ? "Opportunity marked as won." : "Opportunity marked as lost.",
        description: `${existing.company} · ${formatCurrency(existing.value, currency)}`,
        variant: stage === "Closed Won" ? "success" : "destructive",
      });
    },
    [currency, opportunities, pushActivity, organizationId],
  );

  const markWon = React.useCallback((id: string) => closeDeal(id, "Closed Won"), [closeDeal]);
  const markLost = React.useCallback((id: string) => closeDeal(id, "Closed Lost"), [closeDeal]);

  /* ------------------------------------------------------------------ */
  /* Phase 4 — reassignment via the reassign_opportunity RPC.            */
  /* ------------------------------------------------------------------ */

  const reassignOpportunity = React.useCallback(
    async (id: string, newOwnerId: string) => {
      if (!organizationId || !newOwnerId) return false;
      const existing = opportunities.find((opportunity) => opportunity.id === id);
      const { data, error } = await getSupabaseClient().rpc("reassign_opportunity", {
        opportunity_id: id,
        new_owner_id: newOwnerId,
      });
      if (error) {
        toast({
          title: "Opportunity could not be reassigned.",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }
      if (data) {
        // The RPC resolves the display name server-side; refresh the row
        // fields the UI shows without clobbering the rest.
        setOpportunities((current) =>
          current.map((opportunity) =>
            opportunity.id === id
              ? { ...opportunity, ownerId: newOwnerId }
              : opportunity,
          ),
        );
      }
      toast({
        title: "Opportunity reassigned.",
        description: existing?.company ?? "New owner notified in app.",
        variant: "success",
      });
      return true;
    },
    [opportunities, organizationId],
  );

  /* ------------------------------------------------------------------ */
  /* Phase 5 — soft deletion + deletion-request approval flow.           */
  /* ------------------------------------------------------------------ */

  const deleteOpportunity = React.useCallback(
    async (id: string, reason?: string) => {
      if (!organizationId) return false;
      const trimmed = (reason ?? "").trim();
      if (trimmed.length < 3) {
        toast({
          title: "A deletion reason is required.",
          description: "Give at least 3 characters explaining why this deal is being deleted.",
          variant: "destructive",
        });
        return false;
      }
      const existing = opportunities.find((opportunity) => opportunity.id === id);
      const { error } = await getSupabaseClient().rpc("soft_delete_opportunity", {
        target_opportunity_id: id,
        reason: trimmed,
      });
      if (error) {
        toast({ title: "Opportunity could not be deleted.", description: error.message, variant: "destructive" });
        return false;
      }
      const deletedAt = new Date().toISOString();
      setOpportunities((current) =>
        current.map((opportunity) =>
          opportunity.id === id
            ? { ...opportunity, deletedAt, deleteReason: trimmed }
            : opportunity,
        ),
      );
      setDeletionRequests((current) =>
        current.map((request) =>
          request.opportunityId === id && request.status === "pending"
            ? { ...request, status: "rejected" as const, reviewComment: "Superseded by direct owner deletion." }
            : request,
        ),
      );
      setSelectedId((current) => (current === id ? null : current));
      toast({
        title: "Opportunity deleted.",
        description: `${existing?.company ?? "Record"} · restorable for 30 days from Settings > Deleted deals.`,
        variant: "destructive",
      });
      return true;
    },
    [opportunities, organizationId],
  );

  const requestDeletion = React.useCallback(
    async (id: string, reason: string) => {
      if (!organizationId) return false;
      const trimmed = (reason ?? "").trim();
      if (trimmed.length < 3) {
        toast({
          title: "A deletion reason is required.",
          description: "Explain in at least 3 characters why this deal should be removed.",
          variant: "destructive",
        });
        return false;
      }
      const existing = opportunities.find((opportunity) => opportunity.id === id);
      const { data: requestId, error } = await getSupabaseClient().rpc("request_deletion", {
        target_opportunity_id: id,
        reason: trimmed,
      });
      if (error) {
        toast({ title: "Deletion request could not be submitted.", description: error.message, variant: "destructive" });
        return false;
      }
      // Optimistic queue entry with the REAL request id from the RPC;
      // the next load re-syncs names/review state with the server.
      setDeletionRequests((current) => [
        {
          id: String(requestId),
          opportunityId: id,
          opportunityCompany: existing?.company ?? "Opportunity",
          requestedBy: userId ?? "",
          reason: trimmed,
          status: "pending",
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
      toast({
        title: "Deletion request submitted.",
        description: `${existing?.company ?? "The deal"} now shows "Deletion pending" until the owner reviews it.`,
        variant: "success",
      });
      return true;
    },
    [opportunities, organizationId, userId],
  );

  const reviewDeletionRequest = React.useCallback(
    async (requestId: string, decision: "approve" | "reject", comment?: string) => {
      if (!organizationId) return false;
      const target = deletionRequests.find((request) => request.id === requestId);
      if (!target) return false;
      if (decision === "reject" && (comment ?? "").trim().length < 3) {
        toast({
          title: "A review comment is required.",
          description: "Explain why the request was rejected so the rep can see it.",
          variant: "destructive",
        });
        return false;
      }
      const { error } = await getSupabaseClient().rpc(
        decision === "approve" ? "approve_deletion_request" : "reject_deletion_request",
        { target_request_id: requestId, review_comment: (comment ?? "").trim() || null },
      );
      if (error) {
        toast({ title: "Could not review the deletion request.", description: error.message, variant: "destructive" });
        return false;
      }
      if (decision === "approve") {
        const deletedAt = new Date().toISOString();
        setOpportunities((current) =>
          current.map((opportunity) =>
            opportunity.id === target.opportunityId
              ? { ...opportunity, deletedAt, deleteReason: target.reason }
              : opportunity,
          ),
        );
      }
      setDeletionRequests((current) =>
        current.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status: decision === "approve" ? ("approved" as const) : ("rejected" as const),
                reviewedAt: new Date().toISOString(),
                reviewComment: comment?.trim() || undefined,
              }
            : request,
        ),
      );
      toast({
        title: decision === "approve" ? "Deletion approved." : "Deletion request rejected.",
        description:
          decision === "approve"
            ? `${target.opportunityCompany} moved to deleted deals (restorable for 30 days).`
            : `${target.opportunityCompany} stays in the pipeline.`,
        variant: decision === "approve" ? "destructive" : "success",
      });
      return true;
    },
    [deletionRequests, organizationId],
  );

  const restoreOpportunity = React.useCallback(
    async (id: string) => {
      if (!organizationId) return false;
      const { error } = await getSupabaseClient().rpc("restore_opportunity", {
        target_opportunity_id: id,
      });
      if (error) {
        toast({ title: "Opportunity could not be restored.", description: error.message, variant: "destructive" });
        return false;
      }
      setOpportunities((current) =>
        current.map((opportunity) =>
          opportunity.id === id ? { ...opportunity, deletedAt: undefined, deleteReason: undefined } : opportunity,
        ),
      );
      toast({ title: "Opportunity restored.", description: "The deal is back in the live pipeline.", variant: "success" });
      return true;
    },
    [organizationId],
  );

  const pendingDeletionCount = React.useMemo(
    () => deletionRequests.filter((request) => request.status === "pending").length,
    [deletionRequests],
  );

  const addActivity = React.useCallback(
    async (
      opportunityId: string,
      type: ActivityType,
      text: string,
      meta?: { nextStep?: string; dueDate?: string },
    ) => {
      if (!organizationId) return;
      const existing = opportunities.find((opportunity) => opportunity.id === opportunityId);

      // The activity insert must succeed first — pushActivity toasts its own
      // failure, and we never show "Activity logged" for a row that was
      // rejected by the database.
      const saved = await pushActivity({
        type,
        text,
        opportunityId,
        nextStep: meta?.nextStep,
        dueDate: meta?.dueDate,
      });
      if (!saved) return;
      const { error } = await getSupabaseClient()
        .from("opportunities")
        .update({ last_activity: "Just now" })
        .eq("id", opportunityId)
        .eq("organization_id", organizationId);
      if (error) {
        toast({ title: "Deal could not be flagged as touched.", description: error.message, variant: "destructive" });
        return;
      }
      setOpportunities((current) =>
        current.map((opportunity) =>
          opportunity.id === opportunityId
            ? { ...opportunity, lastActivity: "Just now" }
            : opportunity,
        ),
      );
      toast({
        title: "Activity logged.",
        description: existing ? `${text} · ${existing.company}` : text,
        variant: "success",
      });
    },
    [opportunities, pushActivity, organizationId],
  );

  const exportCsv = React.useCallback(
    (rows?: Opportunity[], filename?: string) => {
      const source = rows ?? sorted;
      if (!source.length) {
        toast({
          title: "Nothing to export.",
          description: "No opportunities match the current filters.",
          variant: "destructive",
        });
        return;
      }

      const headers = EXPORT_HEADERS.map((header) => header === "Value" ? `Value (${currency})` : header);
      const csv = buildCsv([headers, ...buildExportRows(source)]);
      downloadCsv(filename ?? `salesflow-opportunities-${TODAY}.csv`, csv);
      toast({
        title: "CSV export started.",
        description: `${source.length} ${source.length === 1 ? "opportunity" : "opportunities"} exported`,
        variant: "success",
      });
    },
    [currency, sorted],
  );

  const openOpportunity = React.useCallback((id: string) => setSelectedId(id), []);

  /* ------------------------------------------------------------------ */
  /* Phase 1 — attention queue, CSV import, accounts & contacts          */
  /* ------------------------------------------------------------------ */

  const openActivityLog = React.useCallback((id: string) => {
    setLogActivityIntent(id);
    setSelectedId(id);
  }, []);
  const clearLogActivityIntent = React.useCallback(() => setLogActivityIntent(null), []);

  /**
   * Sequential, RLS-scoped import: every row is written with the signed-in
   * client (never a service-role key), each result is reported individually,
   * and failures never mask successes. Safe to retry — rows already imported
   * surface as duplicates on the next preview.
   */
  const importDeals = React.useCallback(
    async (jobs: ImportJob[]): Promise<ImportJobResult[]> => {
      if (!organizationId) {
        return jobs.map((job) => ({
          rowNumber: job.rowNumber,
          status: "failed",
          error: "Your organization is still loading — reload and retry.",
        }));
      }
      const supabase = getSupabaseClient();
      const results: ImportJobResult[] = [];
      const linkCache: AccountContactCache = {
        accounts: [...accountRecords],
        contacts: [...contactRecords],
      };

      for (const job of jobs) {
        const { deal, updateExistingId } = job;
        const links = await resolveAccountContact(deal, organizationId, linkCache);
        if (!links) {
          results.push({
            rowNumber: job.rowNumber,
            status: "failed",
            error: "Company/contact records could not be linked. Correct the issue and retry this row.",
          });
          continue;
        }
        const ownerId = memberNames.find((member) => member.fullName === deal.owner)?.userId;
        const shared: Record<string, unknown> = {
          company: deal.company,
          contact: deal.contact,
          email: deal.email ?? null,
          phone: deal.phone ?? null,
          stage: deal.stage,
          value: deal.value,
          probability: deal.probability,
          owner: deal.owner,
          expected_close_date: deal.expectedCloseDate,
          last_activity: "Just now",
          lead_source: deal.leadSource,
          probability_overridden: deal.probabilityOverridden,
          closed_date: deal.closedDate ?? null,
          account_id: links.accountId ?? null,
          contact_id: links.contactId ?? null,
        };
        if (ownerId) shared.owner_id = ownerId;

        if (updateExistingId) {
          const { data, error } = await supabase
            .from("opportunities")
            .update(shared)
            .eq("id", updateExistingId)
            .eq("organization_id", organizationId)
            .select("*")
            .maybeSingle();
          if (error || !data) {
            results.push({
              rowNumber: job.rowNumber,
              status: "failed",
              error: error?.message ?? "Row was not updated (it may belong to another organization).",
            });
          } else {
            const saved = fromOpportunityRow(data as Record<string, unknown>);
            setOpportunities((current) =>
              current.map((opportunity) => (opportunity.id === saved.id ? saved : opportunity)),
            );
            results.push({ rowNumber: job.rowNumber, status: "updated" });
          }
          continue;
        }

        const { data, error } = await supabase
          .from("opportunities")
          .insert({ ...shared, organization_id: organizationId, age: 0, created_date: TODAY })
          .select("*")
          .single();
        if (error || !data) {
          results.push({
            rowNumber: job.rowNumber,
            status: "failed",
            error: error?.message ?? "Row was not inserted.",
          });
        } else {
          setOpportunities((current) => [fromOpportunityRow(data as Record<string, unknown>), ...current]);
          results.push({ rowNumber: job.rowNumber, status: "inserted" });
        }
      }

      return results;
    },
    [accountRecords, contactRecords, memberNames, organizationId, resolveAccountContact],
  );

  const saveAccount = React.useCallback(
    async (name: string): Promise<AccountRecord | null> => {
      const trimmed = name.trim();
      if (!organizationId || !trimmed) return null;
      const existing = accountRecords.find(
        (account) => account.name.trim().toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) return existing;
      const { data, error } = await getSupabaseClient()
        .from("accounts")
        .insert({ organization_id: organizationId, name: trimmed })
        .select()
        .single();
      if (error || !data) {
        toast({ title: "Company could not be saved.", description: error?.message, variant: "destructive" });
        return null;
      }
      const record = fromAccountRow(data as Record<string, unknown>);
      setAccountRecords((current) => [...current, record].sort((a, b) => a.name.localeCompare(b.name)));
      return record;
    },
    [accountRecords, organizationId],
  );

  const saveContact = React.useCallback(
    async (input: {
      fullName: string;
      email?: string;
      phone?: string;
      accountId?: string;
    }): Promise<ContactRecord | null> => {
      const fullName = input.fullName.trim();
      if (!organizationId || !fullName) return null;
      const { data, error } = await getSupabaseClient()
        .from("contacts")
        .insert({
          organization_id: organizationId,
          account_id: input.accountId ?? null,
          full_name: fullName,
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
        })
        .select()
        .single();
      if (error || !data) {
        toast({ title: "Contact could not be saved.", description: error?.message, variant: "destructive" });
        return null;
      }
      const record = fromContactRow(data as Record<string, unknown>);
      setContactRecords((current) => [...current, record].sort((a, b) => a.fullName.localeCompare(b.fullName)));
      return record;
    },
    [organizationId],
  );

  const updateAccount = React.useCallback(
    async (
      id: string,
      patch: Partial<Pick<AccountRecord, "name" | "website" | "industry" | "notes">>,
    ): Promise<boolean> => {
      if (!organizationId) return false;
      const { error } = await getSupabaseClient()
        .from("accounts")
        .update(patch)
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) {
        toast({ title: "Company could not be updated.", description: error.message, variant: "destructive" });
        return false;
      }
      setAccountRecords((current) =>
        current.map((account) => (account.id === id ? { ...account, ...patch } : account)),
      );
      return true;
    },
    [organizationId],
  );

  const updateContact = React.useCallback(
    async (
      id: string,
      patch: Partial<Pick<ContactRecord, "fullName" | "title" | "email" | "phone" | "notes" | "accountId">>,
    ): Promise<boolean> => {
      if (!organizationId) return false;
      const { error } = await getSupabaseClient()
        .from("contacts")
        .update(patch)
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) {
        toast({ title: "Contact could not be updated.", description: error.message, variant: "destructive" });
        return false;
      }
      setContactRecords((current) =>
        current.map((contact) => (contact.id === id ? { ...contact, ...patch } : contact)),
      );
      return true;
    },
    [organizationId],
  );
/* ---- Invoice CRUD ---- */
  const createInvoice = React.useCallback(
    async (draft: InvoiceDraft): Promise<Invoice | null> => {
      if (!organizationId) return null;
      const invoiceNumber = `INV-${Date.now()}`;
      const { data, error } = await getSupabaseClient()
        .from("invoices")
        .insert({
          organization_id: organizationId,
          opportunity_id: draft.opportunityId ?? null,
          invoice_number: invoiceNumber,
          client_name: draft.clientName,
          client_email: draft.clientEmail,
          client_phone: draft.clientPhone,
          amount: draft.amount,
          status: "draft" as const,
          line_items: draft.lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            amount: item.amount,
          })),
          notes: draft.notes,
          created_by: (await getSupabaseClient()).getUser()?.id ?? "",
          created_by_name: draft.clientName,
        })
        .select()
        .single();
      if (error) {
        toast({ title: "Invoice could not be created.", description: error.message, variant: "destructive" });
        return null;
      }
      setInvoiceRecords((current) => [{ id: data.id, ...data } as Invoice, ...current].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      return data as Invoice;
    },
    [organizationId],
  );

  const updateInvoice = React.useCallback(
    async (id: string, patch: Partial<Pick<Invoice, "status" | "dueDate" | "notes" | "sentMethod" | "sentUrl">>): Promise<boolean> => {
      if (!organizationId) return false;
      const { error } = await getSupabaseClient()
        .from("invoices")
        .update(patch)
        .eq("id", id);
      if (error) {
        toast({ title: "Invoice could not be updated.", description: error.message, variant: "destructive" });
        return false;
      }
      setInvoiceRecords(
        current.map((invoice) => (invoice.id === id ? { ...invoice, ...patch } : invoice)),
      );
      return true;
    },
    [organizationId],
  );

  const sendInvoice = React.useCallback(
    async (id: string, method: "email" | "whatsapp"): Promise<boolean> => {
      if (!organizationId) return false;
      const { error } = await getSupabaseClient()
        .from("invoices")
        .update({ status: "sent", sent_method: method, sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        toast({ title: "Invoice could not be sent.", description: error.message, variant: "destructive" });
        return false;
      }
      setInvoiceRecords(
        current.map((invoice) => (invoice.id === id ? { ...invoice, status: "sent", sent_method: method, sent_at: new Date().toISOString() } : invoice)),
      );
      // TODO: actually send email/WhatsApp via Resend / Twilio
      toast({ title: "Invoice sent", description: `Invoice ${id} sent via ${method}` });
      return true;
    },
    [organizationId],
  );

  /* ---- Churn recording ---- */
  const recordChurn = React.useCallback(
    async (opportunityId: string, reason: string, outstandingAmount: number): Promise<ChurnRecord | null> => {
      if (!organizationId) return null;
      const { data, error } = await getSupabaseClient()
        .from("churn_records")
        .insert({
          organization_id: organizationId,
          opportunity_id: opportunityId,
          reason,
          outstanding_amount: outstandingAmount,
          created_by: (await getSupabaseClient()).getUser()?.id ?? "",
          created_by_name: (await getSupabaseClient()).getUser()?.user?.email ?? "Unknown",
        })
        .select()
        .single();
      if (error) {
        toast({ title: "Could not record churn.", description: error.message, variant: "destructive" });
        return null;
      }
      setChurnRecords((current) => [{ id: data.id, ...data } as ChurnRecord, ...current].sort((a, b) => b.churnedAt.localeCompare(a.churnedAt)));
      return data as ChurnRecord;
    },
    [organizationId],
  );

  const updateOpportunityChurnState = React.useCallback(
    async (id: string, amountPaid: number, nextPaymentDate: string | null): Promise<boolean> => {
      if (!organizationId) return false;
      const { error } = await getSupabaseClient()
        .from("opportunities")
        .update({ amount_paid: amountPaid, next_payment_date: nextPaymentDate })
        .eq("id", id);
      if (error) {
        toast({ title: "Could not update opportunity payment state.", description: error.message, variant: "destructive" });
        return false;
      }
      setOpportunities(
        current.map((opp) => (opp.id === id ? { ...opp, amount_paid: amountPaid, next_payment_date: nextPaymentDate } : opp)),
      );
      return true;
    },
    [organizationId],
  );

  const closeOpportunity = React.useCallback(() => setSelectedId(null), []);
  const openCreateDialog = React.useCallback(() => setCreateOpen(true), []);
  const closeCreateDialog = React.useCallback(() => setCreateOpen(false), []);
  const openImportDialog = React.useCallback(() => setImportOpen(true), []);
  const closeImportDialog = React.useCallback(() => setImportOpen(false), []);
  const openEditDialog = React.useCallback((id: string) => setEditingId(id), []);
  const closeEditDialog = React.useCallback(() => setEditingId(null), []);

  const toggleFilters = React.useCallback(() => {
    setFiltersOpen((current) => !current);
  }, []);

  /** Active members (plus the signed-in user) eligible to own imported deals. */
  const eligibleOwners = React.useMemo(() => {
    const names = new Set<string>();
    for (const member of memberNames) if (member.fullName) names.add(member.fullName);
    for (const name of organizationOwnerNames) names.add(name);
    if (displayName) names.add(displayName);
    return [...names];
  }, [displayName, memberNames, organizationOwnerNames]);

  const value: PipelineContextValue = {
    metadata: { ...dataset.metadata, currency },
    currency,
    owners: organizationOwners,
    stages: dataset.stages,
    monthlyRevenue,
    kanbanStages: KANBAN_STAGES,
    ownerNames: organizationOwnerNames.length ? organizationOwnerNames : configuredOwnerNames,
    today: TODAY,
    isLoading,
    loadError,
    recordsLoadError,

    opportunities,
    activities,
    personalTarget,

    searchQuery,
    setSearchQuery,
    filters,
    updateFilter,
    resetFilters,
    clearAllFilters,
    activeFilterCount,
    sort,
    toggleSort,
    setSort,

    filtered: sorted,
    visible: visibleWithDeletionState,
    totalFiltered,
    page: safePage,
    setPage: setPageState,
    pageSize: settings.pageSize,
    setPageSize,
    totalPages,
    rangeStart,
    rangeEnd,

    metrics,
    kpis,
    deletedOpportunities,
    funnel,
    repPerformance,
    forecast,
    accounts,
    tasks,
    attention,

    view,
    setView,
    pipelineView,
    setPipelineView,
    chartRange,
    setChartRange,

    filtersOpen,
    toggleFilters,

    selectedOpportunity,
    openOpportunity,
    closeOpportunity,
    isCreateOpen,
    openCreateDialog,
    closeCreateDialog,
    isImportOpen,
    openImportDialog,
    closeImportDialog,
    editingOpportunity,
    openEditDialog,
    closeEditDialog,

    createOpportunity,
    updateOpportunity,
    moveStage,
    markWon,
    markLost,
    deleteOpportunity,
    requestDeletion,
    reviewDeletionRequest,
    restoreOpportunity,
    deletionRequests,
    pendingDeletionCount,
    reassignOpportunity,
    addActivity,
    exportCsv,

    openActivityLog,
    logActivityIntent,
    clearLogActivityIntent,
    importDeals,
    eligibleOwners,
    accountRecords,
    contactRecords,
    saveAccount,
    saveContact,
    updateAccount,
    updateContact,
    /* New: Invoice & churn */
    createInvoice,
    updateInvoice,
    sendInvoice,
    invoiceRecords,
    churnRecords,
    recordChurn,
    updateOpportunityChurnState,

    settings,
    updateSettings,
  };

  return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>;
}

export function usePipeline(): PipelineContextValue {
  const context = React.useContext(PipelineContext);
  if (!context) {
    throw new Error("usePipeline must be used inside <PipelineProvider>");
  }
  return context;
}
