"use client";

import * as React from "react";
import { Bell, CalendarClock, CheckCheck, CircleAlert, Flame } from "lucide-react";

import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isOpen } from "@/lib/metrics";
import type { NotificationItem } from "@/lib/types";
import { cn, daysBetween, formatCurrency } from "@/lib/utils";

const TONE_STYLES: Record<NotificationItem["tone"], { icon: typeof Bell; className: string }> = {
  danger: { icon: CircleAlert, className: "bg-rose-50 text-rose-600" },
  warning: { icon: CalendarClock, className: "bg-amber-50 text-amber-600" },
  info: { icon: Bell, className: "bg-primary/10 text-primary" },
  success: { icon: Flame, className: "bg-emerald-50 text-emerald-600" },
};

export function NotificationMenu() {
  const { opportunities, activities, today, openOpportunity } = usePipeline();
  const [readIds, setReadIds] = React.useState<string[]>([]);

  const notifications = React.useMemo<NotificationItem[]>(() => {
    const open = opportunities.filter(isOpen);

    const overdue: NotificationItem[] = open
      .filter((opportunity) => opportunity.expectedCloseDate < today)
      .sort((a, b) => a.expectedCloseDate.localeCompare(b.expectedCloseDate))
      .slice(0, 3)
      .map((opportunity) => ({
        id: `overdue-${opportunity.id}`,
        title: `${opportunity.company} is past its close date`,
        detail: `${formatCurrency(opportunity.value)} · ${opportunity.owner}`,
        tone: "danger" as const,
        opportunityId: opportunity.id,
      }));

    const closingSoon: NotificationItem[] = open
      .filter((opportunity) => {
        const days = daysBetween(opportunity.expectedCloseDate, today);
        return days >= 0 && days <= 7;
      })
      .sort((a, b) => a.expectedCloseDate.localeCompare(b.expectedCloseDate))
      .slice(0, 2)
      .map((opportunity) => ({
        id: `closing-${opportunity.id}`,
        title: `${opportunity.company} closes this week`,
        detail: `${formatCurrency(opportunity.value)} · ${opportunity.stage}`,
        tone: "warning" as const,
        opportunityId: opportunity.id,
      }));

    const recent: NotificationItem[] = activities.slice(0, 3).map((activity) => ({
      id: `activity-${activity.id}`,
      title: activity.text,
      detail: activity.time,
      tone: activity.type === "won" ? ("success" as const) : ("info" as const),
      opportunityId: activity.opportunityId,
    }));

    return [...overdue, ...closingSoon, ...recent];
  }, [activities, opportunities, today]);

  const unreadCount = notifications.filter((item) => !readIds.includes(item.id)).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount ? (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold">Notifications</span>
            {unreadCount ? (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-2xs font-semibold text-primary">
                {unreadCount} new
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-2xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            onClick={(event) => {
              event.preventDefault();
              setReadIds(notifications.map((item) => item.id));
            }}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        </div>

        <div className="max-h-[22rem] overflow-y-auto p-1">
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
              You&apos;re all caught up.
            </p>
          ) : (
            notifications.map((item) => {
              const { icon: Icon, className } = TONE_STYLES[item.tone];
              const isUnread = !readIds.includes(item.id);

              return (
                <DropdownMenuItem
                  key={item.id}
                  className="items-start gap-2.5 py-2.5"
                  onSelect={() => {
                    setReadIds((current) =>
                      current.includes(item.id) ? current : [...current, item.id],
                    );
                    if (item.opportunityId) openOpportunity(item.opportunityId);
                  }}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      className,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium leading-snug text-foreground">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-2xs text-muted-foreground">{item.detail}</span>
                  </span>
                  {isUnread ? (
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      aria-label="Unread"
                    />
                  ) : null}
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <p className="px-3 py-2 text-2xs text-muted-foreground">
          Alerts are generated live from your pipeline data.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
