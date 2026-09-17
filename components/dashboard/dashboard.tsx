"use client";

import * as React from "react";

import { AccountsView } from "@/components/dashboard/accounts-view";
import { ActivitiesView } from "@/components/dashboard/activities-view";
import { ForecastView } from "@/components/dashboard/forecast-view";
import { OpportunityDetailDrawer } from "@/components/dashboard/opportunity-detail-drawer";
import { OpportunityFormDialog } from "@/components/dashboard/opportunity-form-dialog";
import { OverviewView } from "@/components/dashboard/overview-view";
import { PipelineView } from "@/components/dashboard/pipeline-view";
import { PipelineProvider, usePipeline } from "@/components/dashboard/pipeline-provider";
import { SettingsView } from "@/components/dashboard/settings-view";
import { SIDEBAR_WIDTH, Sidebar, SidebarContent } from "@/components/dashboard/sidebar";
import { TasksView } from "@/components/dashboard/tasks-view";
import { Topbar } from "@/components/dashboard/topbar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";

function ViewRouter() {
  const { view } = usePipeline();

  switch (view) {
    case "pipeline":
      return <PipelineView />;
    case "accounts":
      return <AccountsView />;
    case "activities":
      return <ActivitiesView />;
    case "forecast":
      return <ForecastView />;
    case "tasks":
      return <TasksView />;
    case "settings":
      return <SettingsView />;
    case "overview":
    default:
      return <OverviewView />;
  }
}

function DashboardShell() {
  const { view, setView, isCreateOpen, closeCreateDialog, editingOpportunity, closeEditDialog } =
    usePipeline();
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [view]);

  const handleNavigate = React.useCallback(
    (next: typeof view) => {
      setView(next);
      setMobileNavOpen(false);
    },
    [setView],
  );

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <Sidebar activeView={view} onNavigate={handleNavigate} />

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[272px] max-w-[86vw] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent activeView={view} onNavigate={handleNavigate} />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-[260px]" data-sidebar-width={SIDEBAR_WIDTH}>
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main
          id="dashboard-main"
          className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8"
        >
          <ViewRouter />
        </main>
      </div>

      <OpportunityFormDialog open={isCreateOpen} onOpenChange={(open) => !open && closeCreateDialog()} />
      <OpportunityFormDialog
        open={Boolean(editingOpportunity)}
        onOpenChange={(open) => !open && closeEditDialog()}
        opportunity={editingOpportunity}
      />
      <OpportunityDetailDrawer />
    </div>
  );
}

export function Dashboard() {
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      <PipelineProvider>
        <DashboardShell />
      </PipelineProvider>
    </TooltipProvider>
  );
}
