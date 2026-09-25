import type { MonthlyRevenuePoint, Owner, PipelineStage, SalesDataset, StageDefinition } from "@/lib/types";

export const STAGE_ORDER: PipelineStage[] = [
  "Lead",
  "Discovery",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

export const KANBAN_STAGES = [...STAGE_ORDER];
export const OPEN_STAGES: PipelineStage[] = ["Lead", "Discovery", "Qualified", "Proposal", "Negotiation"];
export const CLOSED_STAGES: PipelineStage[] = ["Closed Won", "Closed Lost"];
export const LEAD_SOURCES = ["Inbound", "Outbound", "Partner", "Referral", "Event", "Other"];

export const stages: StageDefinition[] = STAGE_ORDER.map((name, index) => ({
  id: name.toLowerCase().replaceAll(" ", "-"),
  name,
  probability: [10, 20, 40, 70, 85, 100, 0][index],
}));

export const STAGE_PROBABILITY: Record<PipelineStage, number> = Object.fromEntries(
  stages.map((stage) => [stage.name, stage.probability]),
) as Record<PipelineStage, number>;

export const owners: Owner[] = [];
export const ownerNames: string[] = [];
export const TODAY = new Date().toISOString().slice(0, 10);
export const monthlyRevenue: MonthlyRevenuePoint[] = [];
export const forecastTargets = {
  quarterlyTarget: 0,
  closedRevenue: 0,
  commit: 0,
  bestCase: 0,
};

export const metadata: SalesDataset["metadata"] = {
  dataset: "Supabase workspace",
  currency: "USD",
  period: "Current quarter",
  lastUpdated: new Date().toISOString(),
};

export const dataset: Pick<SalesDataset, "metadata" | "stages" | "owners" | "monthlyRevenue" | "forecast"> = {
  metadata,
  stages,
  owners,
  monthlyRevenue,
  forecast: forecastTargets,
};
