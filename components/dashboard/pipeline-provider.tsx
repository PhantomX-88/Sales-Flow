"use client";

import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { toast } from "@/components/ui/use-toast";
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
  AccountSummary,
  Activity,
  ActivityType,
  ChartRangeKey,
  DashboardSettings,
  DashboardView,
  Filters,
  ForecastSummary,
  FunnelStage,
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
  };
}

function toOpportunityRow(opportunity: Opportunity, organizationId: string) {
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
    opportunityId: row.opportunity_id ? String(row.opportunity_id) : undefined,
    nextStep: row.next_step ? String(row.next_step) : undefined,
    dueDate: row.due_date ? String(row.due_date) : undefined,
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
  const [personalTarget, setPersonalTarget] = React.useState<{ amount: number; period: string } | null>(null);

  const [searchQuery, setSearchQueryState] = React.useState("");
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSortState] = React.useState<SortState>(DEFAULT_SORT);
  const [page, setPageState] = React.useState(1);
  const [settings, setSettings] = React.useState<DashboardSettings>(DEFAULT_SETTINGS);

  const [view, setView] = React.useState<DashboardView>("overview");
  const [pipelineView, setPipelineViewState] = React.useState<PipelineViewMode>(
    DEFAULT_SETTINGS.defaultPipelineView,
  );
  const [chartRange, setChartRange] = React.useState<ChartRangeKey>("this-quarter");
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = React.useState(false);
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
      const [opportunitiesResult, activitiesResult, targetResult, deletionResult] = await Promise.all([
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
      ]);
      if (!mounted) return;
      if (opportunitiesResult.error || activitiesResult.error) {
        toast({ title: "Could not load organization data.", description: "Check your Supabase tables and Row Level Security policies.", variant: "destructive" });
      } else {
        const loadedOpportunities = (opportunitiesResult.data ?? []).map((row) =>
          fromOpportunityRow(row as Record<string, unknown>),
        );
        const companyNameById = new Map(loadedOpportunities.map((o) => [o.id, o.company]));
        setOpportunities(loadedOpportunities);
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
  }, [isAuthenticated, isReady, organizationId, membershipRole, userId]);

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
  const kpis = React.useMemo(
    () => computeKpis(liveOpportunities, monthlyRevenue, TODAY, currency),
    [currency, monthlyRevenue, liveOpportunities],
  );
  const funnel = React.useMemo(() => computeFunnel(liveOpportunities), [liveOpportunities]);
  const repPerformance = React.useMemo(
    () => computeRepPerformance(liveOpportunities, organizationOwners),
    [liveOpportunities, organizationOwners],
  );
  const forecast = React.useMemo(() => {
    const resolvedPeriod =
      membershipRole === "sales_rep" && personalTarget && (personalTarget.period === "monthly" || personalTarget.period === "annual")
        ? personalTarget.period
        : organization?.targetPeriod ?? "quarterly";
    const resolvedTarget =
      membershipRole === "sales_rep" && personalTarget ? personalTarget.amount : organization?.revenueTarget ?? 0;
    return computeForecast(
      liveOpportunities,
      { amount: resolvedTarget, period: resolvedPeriod },
      TODAY,
    );
  }, [membershipRole, liveOpportunities, organization?.targetPeriod, organization?.revenueTarget, personalTarget]);
  const accounts = React.useMemo(() => computeAccounts(liveOpportunities, TODAY), [liveOpportunities]);
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
        { ...activity, id: String(data.id), time: data.created_at ? new Date(data.created_at).toLocaleString() : "Just now" },
        ...current,
      ]);
      return true;
    },
    [organizationId],
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
        .insert(toOpportunityRow(opportunity, activeOrganizationId))
        .select()
        .single();
      if (error || !data) {
        toast({ title: "Opportunity could not be created.", description: error?.message, variant: "destructive" });
        return false;
      }
      const savedOpportunity = fromOpportunityRow(data as Record<string, unknown>);
      setOpportunities((current) => [savedOpportunity, ...current]);
      await pushActivity({
        type: "lead",
        text: `${savedOpportunity.company} added to ${savedOpportunity.stage}`,
        opportunityId: savedOpportunity.id,
      });
      toast({
        title: "Opportunity created successfully.",
        description: `${savedOpportunity.company} · ${savedOpportunity.stage}`,
        variant: "success",
      });
      setCreateOpen(false);
      return true;
    },
    [pushActivity, resolveOrganization, organizationId],
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
      const updated = draftToOpportunity(draft, TODAY, id, existing);
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
    [opportunities, pushActivity, organizationId],
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
  const closeOpportunity = React.useCallback(() => setSelectedId(null), []);
  const openCreateDialog = React.useCallback(() => setCreateOpen(true), []);
  const closeCreateDialog = React.useCallback(() => setCreateOpen(false), []);
  const openEditDialog = React.useCallback((id: string) => setEditingId(id), []);
  const closeEditDialog = React.useCallback(() => setEditingId(null), []);

  const toggleFilters = React.useCallback(() => {
    setFiltersOpen((current) => !current);
  }, []);

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
