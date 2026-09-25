"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Building2,
  ChevronUp,
  Download,
  LogOut,
  LayoutDashboard,
  ListChecks,
  KanbanSquare,
  RotateCcw,
  Settings,
  Trash2,
  TrendingUp,
  UserRound,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { OwnerAvatar } from "@/components/dashboard/owner-avatar";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import type { DashboardView } from "@/lib/types";
import { cn, formatCurrencyCompact, formatPercent } from "@/lib/utils";

interface NavItem {
  key: DashboardView;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

export const SIDEBAR_WIDTH = 260;

function useNavSections(): { label: string; items: NavItem[] }[] {
  const { tasks } = usePipeline();

  return [
    {
      label: "Workspace",
      items: [
        { key: "overview", label: "Overview", icon: LayoutDashboard },
        { key: "pipeline", label: "Pipeline", icon: KanbanSquare },
        { key: "accounts", label: "Accounts", icon: Building2 },
        { key: "activities", label: "Activities", icon: Activity },
        { key: "forecast", label: "Forecast", icon: TrendingUp },
      ],
    },
    {
      label: "Management",
      items: [
        { key: "tasks", label: "Tasks", icon: ListChecks, badge: tasks.length },
        { key: "settings", label: "Settings", icon: Settings },
      ],
    },
  ];
}

interface SidebarContentProps {
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  className?: string;
}

export function SidebarContent({ activeView, onNavigate, className }: SidebarContentProps) {
  const sections = useNavSections();
  const { forecast, filtered, exportCsv, updateFilter, setView, ownerNames } =
    usePipeline();
  const { signOut } = useAuth();
  const router = useRouter();

  const currentUser = ownerNames[0] ?? "Emmanuel A.";
  const attainment = Math.min(Math.round(forecast.attainmentPercent), 100);

  return (
    <div className={cn("flex h-full flex-col bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-[15px] font-bold text-primary-foreground">
          S
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold tracking-tight">SalesFlow</span>
          <span className="text-2xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Revenue OS
          </span>
        </span>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {sections.map((section) => (
          <div key={section.label} className="space-y-1">
            <p className="px-2.5 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = activeView === item.key;
                const Icon = item.icon;

                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => onNavigate(item.key)}
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        isActive
                          ? "bg-primary/10 font-semibold text-primary"
                          : "font-medium text-slate-600 hover:bg-sidebar-accent hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-primary" : "text-slate-400 group-hover:text-foreground",
                        )}
                        aria-hidden="true"
                      />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-2xs font-semibold text-rose-700">
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="mx-0.5 rounded-xl border border-sidebar-border bg-muted/50 p-3.5">
          <div className="flex items-center justify-between text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{forecast.quarterlyTarget ? "Quarter target" : "Target"}</span>
            <span className="tabular text-foreground">{formatPercent(attainment, 0)}</span>
          </div>
          <p className="mt-2 text-sm font-semibold tabular">
            {formatCurrencyCompact(forecast.closedRevenue)}
            <span className="text-muted-foreground">
              {" "}
              / {formatCurrencyCompact(forecast.quarterlyTarget)}
            </span>
          </p>
          <Progress
            value={attainment}
            className="mt-2.5 h-1.5"
            indicatorClassName={
              forecast.status === "on-track" ? "bg-emerald-500" : "bg-amber-500"
            }
          />
          <p className="mt-2 text-2xs text-muted-foreground">
            {forecast.status === "on-track" ? "Tracking to target" : "Behind target"} ·{" "}
            {formatCurrencyCompact(forecast.gapToTarget)} to go
          </p>
        </div>
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors duration-150 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Open user menu"
            >
              <OwnerAvatar name={currentUser} size="md" />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[13px] font-semibold">{currentUser}</span>
                <span className="truncate text-2xs text-muted-foreground">Sales Manager</span>
              </span>
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-[15rem]">
            <DropdownMenuLabel>Signed in as {currentUser}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                updateFilter("owner", currentUser);
                setView("pipeline");
              }}
            >
              <UserRound />
              My open pipeline
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                exportCsv(
                  filtered.filter((opportunity) => opportunity.owner === currentUser),
                  `salesflow-${currentUser.split(" ")[0].toLowerCase()}-pipeline.csv`,
                )
              }
            >
              <Download />
              Export my pipeline
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setView("settings")}>
              <Settings />
              Workspace settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                signOut();
                router.replace("/");
              }}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </div>
  );
}

/** Fixed desktop sidebar (260px) — the mobile equivalent lives in a drawer. */
export function Sidebar(props: SidebarContentProps) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border lg:block"
      style={{ width: SIDEBAR_WIDTH }}
      aria-label="Sidebar"
    >
      <SidebarContent {...props} />
    </aside>
  );
}
