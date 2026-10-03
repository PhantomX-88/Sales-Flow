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
  Opportunity,
  OpportunityDraft,
  PipelineMetrics,
  PipelineStage,
  PipelineViewMode,
  RepPerformance,
  SortKey,
  SortState,
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
  monthlyRevenue: typeof dataset.monthlyRevenue;
  kanbanStages: PipelineStage[];
  ownerNames: string[];
  today: string;
  isLoading: boolean;

  /* opportunities + activities */
  opportunities: Opportunity[];
  activities: Activity[];

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
  accounts: AccountSummary[];
  tasks: TaskItem[];

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
  deleteOpportunity: (id: string) => void;
  addActivity: (opportunityId: string, type: ActivityType, text: string) => void;
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

function fromActivityRow(row: Record<string, unknown>): Activity {
  return {
    id: String(row.id),
    type: row.type as ActivityType,
    text: String(row.text),
    time: row.created_at ? new Date(String(row.created_at)).toLocaleString() : "Just now",
    opportunityId: row.opportunity_id ? String(row.opportunity_id) : undefined,
  };
}

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const { displayName, isAuthenticated, isReady, organizationId, organization, resolveOrganization } = useAuth();
  const currency: OrganizationCurrency = organization?.currency ?? "USD";
  const organizationOwners = React.useMemo(
    () => displayName ? [{ id: "current-user", name: displayName, role: "Member", initials: displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() }] : [],
    [displayName],
  );
  const organizationOwnerNames = organizationOwners.map((owner) => owner.name);
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>([]);
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

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
      const [opportunitiesResult, activitiesResult] = await Promise.all([
        supabase.from("opportunities").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
        supabase.from("activities").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
      ]);
      if (!mounted) return;
      if (opportunitiesResult.error || activitiesResult.error) {
        toast({ title: "Could not load organization data.", description: "Check your Supabase tables and Row Level Security policies.", variant: "destructive" });
      } else {
        setOpportunities((opportunitiesResult.data ?? []).map((row) => fromOpportunityRow(row as Record<string, unknown>)));
        setActivities((activitiesResult.data ?? []).map((row) => fromActivityRow(row as Record<string, unknown>)));
      }
      setIsLoading(false);
    }

    void loadWorkspaceData();
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, isReady, organizationId]);

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

  const filtered = React.useMemo(
    () => filterOpportunities(opportunities, searchQuery, filters, TODAY),
    [opportunities, searchQuery, filters],
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

  const metrics = React.useMemo(() => computeMetrics(opportunities, TODAY), [opportunities]);
  const kpis = React.useMemo(
    () => computeKpis(opportunities, dataset.monthlyRevenue, TODAY, currency),
    [currency, opportunities],
  );
  const funnel = React.useMemo(() => computeFunnel(opportunities), [opportunities]);
  const repPerformance = React.useMemo(
    () => computeRepPerformance(opportunities, organizationOwners),
    [opportunities, organizationOwners],
  );
  const forecast = React.useMemo(
    () => computeForecast(opportunities, dataset.forecast),
    [opportunities],
  );
  const accounts = React.useMemo(() => computeAccounts(opportunities, TODAY), [opportunities]);
  const tasks = React.useMemo(() => computeTasks(opportunities, TODAY, currency), [currency, opportunities]);

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
    async (activity: Omit<Activity, "id" | "time">) => {
      if (!organizationId) return;
      const { data, error } = await getSupabaseClient()
        .from("activities")
        .insert({
          organization_id: organizationId,
          opportunity_id: activity.opportunityId ?? null,
          type: activity.type,
          text: activity.text,
        })
        .select("id, created_at")
        .single();
      if (error || !data) {
        toast({ title: "Activity could not be saved.", description: error?.message, variant: "destructive" });
        return;
      }
      setActivities((current) => [
        { ...activity, id: String(data.id), time: data.created_at ? new Date(data.created_at).toLocaleString() : "Just now" },
        ...current,
      ]);
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
      const { error } = await getSupabaseClient()
        .from("opportunities")
        .update(toOpportunityRow(updated, organizationId))
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) {
        toast({ title: "Opportunity could not be updated.", description: error.message, variant: "destructive" });
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
      const { error } = await getSupabaseClient()
        .from("opportunities")
        .update({ stage, probability, last_activity: "Just now", closed_date: closedDate })
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) {
        toast({ title: "Stage could not be changed.", description: error.message, variant: "destructive" });
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
      const { error } = await getSupabaseClient()
        .from("opportunities")
        .update({ stage, probability: defaultProbabilityFor(stage), closed_date: TODAY, last_activity: "Just now" })
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) {
        toast({ title: "Opportunity could not be closed.", description: error.message, variant: "destructive" });
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

  const deleteOpportunity = React.useCallback(
    async (id: string) => {
      if (!organizationId) return;
      const existing = opportunities.find((opportunity) => opportunity.id === id);
      const { error } = await getSupabaseClient()
        .from("opportunities")
        .delete()
        .eq("id", id)
        .eq("organization_id", organizationId);
      if (error) {
        toast({ title: "Opportunity could not be deleted.", description: error.message, variant: "destructive" });
        return;
      }
      setOpportunities((current) => current.filter((opportunity) => opportunity.id !== id));
      setSelectedId((current) => (current === id ? null : current));
      toast({
        title: "Opportunity deleted.",
        description: existing?.company ?? "Record removed",
        variant: "destructive",
      });
    },
    [opportunities, organizationId],
  );

  const addActivity = React.useCallback(
    async (opportunityId: string, type: ActivityType, text: string) => {
      if (!organizationId) return;
      const existing = opportunities.find((opportunity) => opportunity.id === opportunityId);
      await pushActivity({ type, text, opportunityId });
      const { error } = await getSupabaseClient()
        .from("opportunities")
        .update({ last_activity: "Just now" })
        .eq("id", opportunityId)
        .eq("organization_id", organizationId);
      if (error) {
        toast({ title: "Activity could not be saved.", description: error.message, variant: "destructive" });
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
    monthlyRevenue: dataset.monthlyRevenue,
    kanbanStages: KANBAN_STAGES,
    ownerNames: organizationOwnerNames.length ? organizationOwnerNames : configuredOwnerNames,
    today: TODAY,
    isLoading,

    opportunities,
    activities,

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
    visible,
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
