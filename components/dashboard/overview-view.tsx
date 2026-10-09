"use client";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ForecastCard } from "@/components/dashboard/forecast-card";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { OpportunitiesSection } from "@/components/dashboard/opportunities-section";
import { PageHeader } from "@/components/dashboard/page-header";
import { PersonalTargetCard } from "@/components/dashboard/personal-target-card";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { PipelineFunnel } from "@/components/dashboard/pipeline-funnel";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { SalesPerformance } from "@/components/dashboard/sales-performance";

export function OverviewView() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline overview"
        description="Monitor deal health, forecast revenue, and move opportunities forward."
        showPeriod
        showFilter
      />

      <>
          <KpiGrid />

          {/* Sub-users see their own target progress here; the card renders
              nothing for owners (they use the org forecast below). */}
          <PersonalTargetCard />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
            <PipelineChart />
            <PipelineFunnel />
          </div>

          <OpportunitiesSection />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
            <SalesPerformance />
            <ForecastCard />
          </div>

          <ActivityFeed limit={6} showViewAll />
      </>
    </div>
  );
}
