import rawDataset from "@/sales-data.json";

import type {
  Activity,
  ActivityType,
  Opportunity,
  Owner,
  PipelineStage,
  SalesDataset,
  StageDefinition,
} from "@/lib/types";

/**
 * The mock dataset is the only place the raw JSON is touched. Everything is
 * normalised into strongly typed domain objects on load, so swapping this file
 * for a REST / GraphQL / Supabase client later only means replacing the
 * exported constants — no UI changes required.
 */

type RawOpportunity = Omit<Opportunity, "stage"> & { stage: string };
type RawStage = Omit<StageDefinition, "name"> & { name: string };
type RawActivity = Omit<Activity, "type"> & { type: string };

interface RawDataset {
  metadata: SalesDataset["metadata"];
  stages: RawStage[];
  owners: Owner[];
  opportunities: RawOpportunity[];
  monthlyRevenue: SalesDataset["monthlyRevenue"];
  forecast: SalesDataset["forecast"];
  activities: RawActivity[];
}

const raw = rawDataset as unknown as RawDataset;

export const STAGE_ORDER: PipelineStage[] = [
  "Lead",
  "Discovery",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

/** Stages shown in the Kanban board, in board order. */
export const KANBAN_STAGES: PipelineStage[] = [
  "Lead",
  "Discovery",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

export const OPEN_STAGES: PipelineStage[] = ["Lead", "Discovery", "Qualified", "Proposal", "Negotiation"];

export const CLOSED_STAGES: PipelineStage[] = ["Closed Won", "Closed Lost"];

export const LEAD_SOURCES: string[] = Array.from(
  new Set(raw.opportunities.map((opportunity) => opportunity.leadSource)),
).sort();

function toStage(value: string): PipelineStage {
  const match = STAGE_ORDER.find((stage) => stage.toLowerCase() === value.toLowerCase());
  return match ?? "Lead";
}

function toActivityType(value: string): ActivityType {
  const known: ActivityType[] = [
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
  ];
  return known.find((type) => type === value) ?? "note";
}

export const stages: StageDefinition[] = raw.stages.map((stage) => ({
  id: stage.id,
  name: toStage(stage.name),
  probability: stage.probability,
}));

/** Default win probability per stage — used when a deal changes stage. */
export const STAGE_PROBABILITY: Record<PipelineStage, number> = STAGE_ORDER.reduce(
  (accumulator, stage) => {
    const definition = stages.find((entry) => entry.name === stage);
    accumulator[stage] = definition?.probability ?? 0;
    return accumulator;
  },
  {} as Record<PipelineStage, number>,
);

export const owners: Owner[] = raw.owners;

export const ownerNames: string[] = owners.map((owner) => owner.name);

export const metadata: SalesDataset["metadata"] = raw.metadata;

/**
 * The dataset is a fixed snapshot (Q3 2026). Pinning "today" keeps relative
 * calculations and server/client rendering deterministic.
 */
export const TODAY = metadata.lastUpdated.slice(0, 10);
export const CURRENT_QUARTER_START = "2026-07-01";
export const CURRENT_QUARTER_END = "2026-09-30";
export const QUARTER_LABEL = metadata.period;

export const monthlyRevenue = raw.monthlyRevenue;

export const forecastTargets = raw.forecast;

export const initialActivities: Activity[] = raw.activities.map((activity) => ({
  id: activity.id,
  type: toActivityType(activity.type),
  text: activity.text,
  time: activity.time,
  opportunityId: activity.opportunityId,
}));

function normalizeOpportunity(opportunity: RawOpportunity): Opportunity {
  const stage = toStage(opportunity.stage);
  const defaultProbability = STAGE_PROBABILITY[stage];
  const closed =
    stage === "Closed Won" || stage === "Closed Lost"
      ? opportunity.expectedCloseDate
      : undefined;

  return {
    ...opportunity,
    stage,
    closedDate: opportunity.closedDate ?? closed,
    probabilityOverridden: opportunity.probability !== defaultProbability,
  };
}

export const initialOpportunities: Opportunity[] = raw.opportunities.map(normalizeOpportunity);

export const dataset: SalesDataset = {
  metadata,
  stages,
  owners,
  opportunities: initialOpportunities,
  monthlyRevenue,
  forecast: forecastTargets,
  activities: initialActivities,
};

/** Deep-enough clone so the "reset demo data" action cannot mutate the module. */
export function cloneInitialOpportunities(): Opportunity[] {
  return initialOpportunities.map((opportunity) => ({ ...opportunity }));
}

export function cloneInitialActivities(): Activity[] {
  return initialActivities.map((activity) => ({ ...activity }));
}
