"use client";

import { ForecastCard } from "@/components/dashboard/forecast-card";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { NeedsAttentionCard } from "@/components/dashboard/needs-attention";
import { RecentOpportunitiesCard, TasksActivityCard } from "@/components/dashboard/overview-lists";
import { PageHeader } from "@/components/dashboard/page-header";
import { PersonalTargetCard } from "@/components/dashboard/personal-target-card";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { PipelineFunnel } from "@/components/dashboard/pipeline-funnel";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { SalesPerformance } from "@/components/dashboard/sales-performance";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function OverviewView() {
  const { displayName } = useAuth();
  const { openCreateDialog } = usePipeline();
  const firstName = displayName && !displayName.includes("@") ? displayName.trim().split(/\s+/)[0] : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description="Here’s what’s happening with your pipeline today."
        showPeriod
        showFilter
      >
        <Button className="h-9" onClick={openCreateDialog}><Plus /> New opportunity</Button>
      </PageHeader>

      <KpiGrid />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
        <PipelineChart />
        <PipelineFunnel />
      </div>

      <PersonalTargetCard />
      <NeedsAttentionCard />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RecentOpportunitiesCard />
        <TasksActivityCard />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <SalesPerformance />
        <ForecastCard />
      </div>
    </div>
  );
}
