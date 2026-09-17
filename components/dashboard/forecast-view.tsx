"use client";

import { ForecastCard } from "@/components/dashboard/forecast-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { PeriodTabs } from "@/components/dashboard/page-header";
import { PipelineChart } from "@/components/dashboard/pipeline-chart";
import { PipelineFunnel } from "@/components/dashboard/pipeline-funnel";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { SalesPerformance } from "@/components/dashboard/sales-performance";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatPercent, pluralize } from "@/lib/utils";

export function ForecastView() {
  const { forecast, metrics, metadata } = usePipeline();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forecast"
        description={`Revenue forecasting for ${metadata.period} — commit, best case and pipeline coverage against target.`}
      >
        <PeriodTabs />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            Open pipeline
          </p>
          <p className="mt-1 text-[22px] font-bold leading-none tabular">
            {formatCurrency(metrics.pipelineValue)}
          </p>
          <p className="mt-2 text-2xs text-muted-foreground">
            {metrics.openCount} {pluralize(metrics.openCount, "open deal")}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            Pipeline coverage
          </p>
          <p className="mt-1 text-[22px] font-bold leading-none tabular">
            {forecast.gapToTarget
              ? `${(forecast.weightedForecast / forecast.gapToTarget).toFixed(1)}x`
              : "Target met"}
          </p>
          <p className="mt-2 text-2xs text-muted-foreground">
            Weighted pipeline vs {formatCurrency(forecast.gapToTarget)} remaining gap
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            Win rate
          </p>
          <p className="mt-1 text-[22px] font-bold leading-none tabular">
            {formatPercent(metrics.winRate)}
          </p>
          <p className="mt-2 text-2xs text-muted-foreground">
            {metrics.wonCount} won · {metrics.lostCount} lost
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <PipelineChart />
        <ForecastCard />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <SalesPerformance />
        <PipelineFunnel />
      </div>
    </div>
  );
}
