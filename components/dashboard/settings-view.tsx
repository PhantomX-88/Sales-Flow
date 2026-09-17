"use client";

import * as React from "react";
import { Database, Download, MonitorPlay, RotateCcw } from "lucide-react";

import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DashboardSettings } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="mt-0.5 text-2xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2",
          checked ? "bg-primary" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150",
            checked ? "translate-x-[1.15rem]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

export function SettingsView() {
  const {
    settings,
    updateSettings,
    resetDemoData,
    exportCsv,
    simulatedError,
    toggleSimulatedError,
    metadata,
    opportunities,
    forecast,
    isLoading,
  } = usePipeline();
  const [confirmReset, setConfirmReset] = React.useState(false);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[28px]">
          Workspace settings
        </h1>
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
          Preferences apply immediately to the dashboard, table and board layouts.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[15px] font-semibold tracking-tight">Pipeline defaults</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Control how much of the pipeline is shown by default.
          </p>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="settings-view">Default pipeline layout</Label>
              <Select
                value={settings.defaultPipelineView}
                onValueChange={(value) =>
                  updateSettings({ defaultPipelineView: value as DashboardSettings["defaultPipelineView"] })
                }
              >
                <SelectTrigger id="settings-view" aria-label="Default pipeline layout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kanban">Board (Kanban)</SelectItem>
                  <SelectItem value="table">Table</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-2xs text-muted-foreground">
                Switches the opportunity board between Kanban and table immediately.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-page-size">Rows per page</Label>
              <Select
                value={String(settings.pageSize)}
                onValueChange={(value) => updateSettings({ pageSize: Number(value) })}
              >
                <SelectTrigger id="settings-page-size" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} rows
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-density">Table density</Label>
              <Select
                value={settings.density}
                onValueChange={(value) =>
                  updateSettings({ density: value as DashboardSettings["density"] })
                }
              >
                <SelectTrigger id="settings-density" aria-label="Table density">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">Comfortable</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 divide-y divide-border border-t border-border">
            <ToggleRow
              label="Show Closed Lost column on the board"
              description="Turn off to keep the Kanban board focused on live pipeline stages."
              checked={settings.showClosedLostColumn}
              onChange={(checked) => updateSettings({ showClosedLostColumn: checked })}
            />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-[15px] font-semibold tracking-tight">Data &amp; demo tools</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            This prototype runs entirely on the bundled JSON dataset — no backend calls are made.
          </p>

          <dl className="mt-4 space-y-2.5 rounded-lg border border-border bg-muted/30 p-3.5">
            {[
              { label: "Dataset", value: metadata.dataset },
              { label: "Currency", value: metadata.currency },
              { label: "Period", value: metadata.period },
              { label: "Last updated", value: new Date(metadata.lastUpdated).toUTCString() },
              { label: "Records", value: `${opportunities.length} opportunities` },
              { label: "Quarterly target", value: formatCurrency(forecast.quarterlyTarget) },
            ].map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4">
                <dt className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                  {row.label}
                </dt>
                <dd className="text-right text-[13px] font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 divide-y divide-border border-t border-border">
            <ToggleRow
              label="Simulate a data error"
              description="Preview the dashboard error state and recovery action."
              checked={simulatedError}
              onChange={toggleSimulatedError}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCsv()} disabled={isLoading}>
              <Download className="h-4 w-4" />
              Export pipeline CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="h-4 w-4" />
              Reset demo data
            </Button>
          </div>

          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-card p-3.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Database className="h-4 w-4" />
            </span>
            <p className="text-2xs leading-relaxed text-muted-foreground">
              Swap <code className="rounded bg-muted px-1 py-0.5">lib/mock-data.ts</code> for a REST,
              GraphQL or Supabase client and the UI keeps working — all state flows through the
              pipeline provider.
            </p>
          </div>

          <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-border bg-card p-3.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              aria-hidden="true"
            >
              <MonitorPlay className="h-4 w-4" />
            </span>
            <p className="text-2xs leading-relaxed text-muted-foreground">
              Dark mode is not enabled in v1, but every surface reads CSS custom properties, so a
              theme can be added without touching components.
            </p>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset demo data?"
        description="All local changes — opportunities you created, edited, moved or deleted — will be discarded."
        confirmLabel="Reset data"
        onConfirm={resetDemoData}
      />
    </div>
  );
}
