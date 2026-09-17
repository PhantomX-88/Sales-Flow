"use client";

import * as React from "react";

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
import {
  cloneInitialActivities,
  cloneInitialOpportunities,
  dataset,
  KANBAN_STAGES,
  ownerNames,
  TODAY,
} from "@/lib/mock-data";
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

interface PipelineContextValue {
  /* dataset */
  metadata: typeof dataset.metadata;
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
  createOpportunity: (draft: OpportunityDraft) => void;
  updateOpportunity: (id: string, draft: OpportunityDraft) => void;
  moveStage: (id: string, stage: PipelineStage) => void;
  markWon: (id: string) => void;
  markLost: (id: string) => void;
  deleteOpportunity: (id: string) => void;
  addActivity: (opportunityId: string, type: ActivityType, text: string) => void;
  exportCsv: (rows?: Opportunity[], filename?: string) => void;
  resetDemoData: () => void;

  /* settings */
  settings: DashboardSettings;
  updateSettings: (patch: Partial<DashboardSettings>) => void;
  simulatedError: boolean;
  toggleSimulatedError: () => void;
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

function nextOpportunityId(opportunities: Opportunity[]): string {
  const highest = opportunities.reduce((max, opportunity) => {
    const numeric = Number(opportunity.id.replace(/[^0-9]/g, ""));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);
  return `OPP-${String(highest + 1).padStart(3, "0")}`;
}

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const [opportunities, setOpportunities] = React.useState<Opportunity[]>(() =>
    cloneInitialOpportunities(),
  );
  const [activities, setActivities] = React.useState<Activity[]>(() => cloneInitialActivities());
  const [isLoading, setIsLoading] = React.useState(true);
  const [simulatedError, setSimulatedError] = React.useState(false);

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

  /* Simulated initial fetch so loading skeletons are real, not decorative. */
  React.useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 550);
    return () => clearTimeout(timeout);
  }, []);

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
    () => computeKpis(opportunities, dataset.monthlyRevenue, TODAY),
    [opportunities],
  );
  const funnel = React.useMemo(() => computeFunnel(opportunities), [opportunities]);
  const repPerformance = React.useMemo(
    () => computeRepPerformance(opportunities, dataset.owners),
    [opportunities],
  );
  const forecast = React.useMemo(
    () => computeForecast(opportunities, dataset.forecast),
    [opportunities],
  );
  const accounts = React.useMemo(() => computeAccounts(opportunities, TODAY), [opportunities]);
  const tasks = React.useMemo(() => computeTasks(opportunities, TODAY), [opportunities]);

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
    (activity: Omit<Activity, "id" | "time">) => {
      setActivities((current) => [
        {
          ...activity,
          id: `ACT-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          time: "Just now",
        },
        ...current,
      ]);
    },
    [],
  );

  const createOpportunity = React.useCallback(
    (draft: OpportunityDraft) => {
      const id = nextOpportunityId(opportunities);
      const opportunity = draftToOpportunity(draft, TODAY, id);
      setOpportunities((current) => [opportunity, ...current]);
      pushActivity({
        type: "lead",
        text: `${opportunity.company} added to ${opportunity.stage}`,
        opportunityId: opportunity.id,
      });
      toast({
        title: "Opportunity created successfully.",
        description: `${opportunity.company} · ${opportunity.stage}`,
        variant: "success",
      });
      setCreateOpen(false);
    },
    [opportunities, pushActivity],
  );

  const updateOpportunity = React.useCallback(
    (id: string, draft: OpportunityDraft) => {
      const existing = opportunities.find((opportunity) => opportunity.id === id);
      if (!existing) return;

      const previousStage = existing.stage;
      const updated = draftToOpportunity(draft, TODAY, id, existing);
      const stageChanged = updated.stage !== previousStage;

      setOpportunities((current) =>
        current.map((opportunity) => (opportunity.id === id ? updated : opportunity)),
      );
      setEditingId(null);

      if (stageChanged) {
        pushActivity({
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
    },
    [opportunities, pushActivity],
  );

  const moveStage = React.useCallback(
    (id: string, stage: PipelineStage) => {
      const existing = opportunities.find((opportunity) => opportunity.id === id);
      if (!existing || existing.stage === stage) return;

      const isClosedStage = stage === "Closed Won" || stage === "Closed Lost";
      const keepProbability = isProbabilityOverridden(existing) && !isClosedStage;
      const probability = isClosedStage ? defaultProbabilityFor(stage) : keepProbability ? existing.probability : defaultProbabilityFor(stage);

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

      pushActivity({
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
    [opportunities, pushActivity],
  );

  const closeDeal = React.useCallback(
    (id: string, stage: "Closed Won" | "Closed Lost") => {
      const existing = opportunities.find((opportunity) => opportunity.id === id);
      if (!existing || existing.stage === stage) return;

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

      pushActivity({
        type: stage === "Closed Won" ? "won" : "lost",
        text: `${existing.company} marked ${stage}`,
        opportunityId: id,
      });

      toast({
        title: stage === "Closed Won" ? "Opportunity marked as won." : "Opportunity marked as lost.",
        description: `${existing.company} · ${formatCurrency(existing.value)}`,
        variant: stage === "Closed Won" ? "success" : "destructive",
      });
    },
    [opportunities, pushActivity],
  );

  const markWon = React.useCallback((id: string) => closeDeal(id, "Closed Won"), [closeDeal]);
  const markLost = React.useCallback((id: string) => closeDeal(id, "Closed Lost"), [closeDeal]);

  const deleteOpportunity = React.useCallback(
    (id: string) => {
      const existing = opportunities.find((opportunity) => opportunity.id === id);
      setOpportunities((current) => current.filter((opportunity) => opportunity.id !== id));
      setSelectedId((current) => (current === id ? null : current));
      toast({
        title: "Opportunity deleted.",
        description: existing?.company ?? "Record removed",
        variant: "destructive",
      });
    },
    [opportunities],
  );

  const addActivity = React.useCallback(
    (opportunityId: string, type: ActivityType, text: string) => {
      const existing = opportunities.find((opportunity) => opportunity.id === opportunityId);
      pushActivity({ type, text, opportunityId });
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
    [opportunities, pushActivity],
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

      const csv = buildCsv([EXPORT_HEADERS, ...buildExportRows(source)]);
      downloadCsv(filename ?? `salesflow-opportunities-${TODAY}.csv`, csv);
      toast({
        title: "CSV export started.",
        description: `${source.length} ${source.length === 1 ? "opportunity" : "opportunities"} exported`,
        variant: "success",
      });
    },
    [sorted],
  );

  const resetDemoData = React.useCallback(() => {
    setOpportunities(cloneInitialOpportunities());
    setActivities(cloneInitialActivities());
    setFilters(DEFAULT_FILTERS);
    setSearchQueryState("");
    setSortState(DEFAULT_SORT);
    setPageState(1);
    setSelectedId(null);
    toast({
      title: "Demo data restored.",
      description: "The original 20 opportunities are back in place.",
      variant: "success",
    });
  }, []);

  const openOpportunity = React.useCallback((id: string) => setSelectedId(id), []);
  const closeOpportunity = React.useCallback(() => setSelectedId(null), []);
  const openCreateDialog = React.useCallback(() => setCreateOpen(true), []);
  const closeCreateDialog = React.useCallback(() => setCreateOpen(false), []);
  const openEditDialog = React.useCallback((id: string) => setEditingId(id), []);
  const closeEditDialog = React.useCallback(() => setEditingId(null), []);

  const toggleSimulatedError = React.useCallback(() => {
    setSimulatedError((current) => !current);
  }, []);

  const toggleFilters = React.useCallback(() => {
    setFiltersOpen((current) => !current);
  }, []);

  const value: PipelineContextValue = {
    metadata: dataset.metadata,
    owners: dataset.owners,
    stages: dataset.stages,
    monthlyRevenue: dataset.monthlyRevenue,
    kanbanStages: KANBAN_STAGES,
    ownerNames,
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
    resetDemoData,

    settings,
    updateSettings,
    simulatedError,
    toggleSimulatedError,
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
