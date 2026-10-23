"use client";

import * as React from "react";
import { CalendarPlus, CheckCircle2, Circle, CircleAlert, Clock } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TaskItem } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";

const TONE_META: Record<
  TaskItem["tone"],
  { label: string; icon: typeof CircleAlert; className: string }
> = {
  danger: { label: "Overdue", icon: CircleAlert, className: "icon-soft-danger" },
  warning: { label: "Closing soon", icon: Clock, className: "icon-soft-warning" },
  info: { label: "Follow-up", icon: Clock, className: "bg-sky-50 text-sky-600" },
};

export function TasksView() {
  const { tasks, openOpportunity, opportunities, createFollowUp, completeFollowUp, isLoading } = usePipeline();
  const [completed, setCompleted] = React.useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [opportunityId, setOpportunityId] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const openOpportunities = React.useMemo(
    () => opportunities.filter((opportunity) => opportunity.stage !== "Closed Won" && opportunity.stage !== "Closed Lost"),
    [opportunities],
  );

  const openTaskDialog = () => {
    setOpportunityId(openOpportunities[0]?.id ?? "");
    setTitle("");
    setDueDate("");
    setDialogOpen(true);
  };

  const handleCreateFollowUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!opportunityId || !title.trim() || !dueDate) return;
    setIsSaving(true);
    const saved = await createFollowUp(opportunityId, title, dueDate);
    setIsSaving(false);
    if (saved) setDialogOpen(false);
  };

  const toggle = async (id: string) => {
    if (completed.includes(id)) {
      setCompleted((current) => current.filter((entry) => entry !== id));
      return;
    }
    if (id.startsWith("reminder-")) {
      const saved = await completeFollowUp(id.slice("reminder-".length));
      if (!saved) return;
    }
    setCompleted((current) => [...current, id]);
  };

  const remaining = tasks.filter((task) => !completed.includes(task.id));
  const trackedTaskCount = tasks.length + completed.length;
  const progress = trackedTaskCount ? ((trackedTaskCount - remaining.length) / trackedTaskCount) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Keep follow-ups tied to your opportunities. Scheduled tasks stay here until completed, alongside reminders from your pipeline."
      >
        <Button size="sm" className="h-9" onClick={openTaskDialog} disabled={isLoading || openOpportunities.length === 0}>
          <CalendarPlus className="h-4 w-4" />
          New follow-up
        </Button>
      </PageHeader>

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-semibold">
              {remaining.length} of {trackedTaskCount} {pluralize(trackedTaskCount, "task")} remaining
            </p>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              Scheduled follow-ups are saved to the activity history and remain open until completed.
            </p>
          </div>
          {completed.length ? (
            <Button variant="ghost" size="sm" onClick={() => setCompleted([])}>
              Reset completed
            </Button>
          ) : null}
        </div>
        <Progress value={progress} className="mt-3 h-1.5" indicatorClassName="progress-tint-success" />
      </Card>

      {tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckCircle2}
            title="Nothing needs attention"
            description="Every open opportunity has a current close date and no overdue follow-ups right now."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isDone = completed.includes(task.id);
            const meta = TONE_META[task.tone];
            const Icon = meta.icon;

            return (
              <Card
                key={task.id}
                className={cn(
                  "flex flex-col gap-3 p-4 transition-colors duration-150 sm:flex-row sm:items-center sm:justify-between",
                  isDone && "opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(task.id)}
                    aria-pressed={isDone}
                    aria-label={isDone ? `Mark "${task.title}" as open` : `Complete "${task.title}"`}
                    className="mt-0.5 shrink-0 rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 on-success" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-[13px] font-semibold leading-snug",
                        isDone && "line-through",
                      )}
                    >
                      {task.title}
                    </p>
                    <p className="mt-0.5 text-2xs text-muted-foreground">{task.detail}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium",
                      meta.className,
                    )}
                  >
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    {task.dueLabel}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-2xs"
                    onClick={() => openOpportunity(task.opportunityId)}
                  >
                    Open deal
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule a follow-up</DialogTitle>
            <DialogDescription>Choose an open opportunity, describe the next step, and set its due date.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateFollowUp}>
            <div className="space-y-2">
              <Label htmlFor="follow-up-opportunity">Opportunity</Label>
              <Select value={opportunityId} onValueChange={setOpportunityId} required>
                <SelectTrigger id="follow-up-opportunity">
                  <SelectValue placeholder="Choose an opportunity" />
                </SelectTrigger>
                <SelectContent>
                  {openOpportunities.map((opportunity) => (
                    <SelectItem key={opportunity.id} value={opportunity.id}>
                      {opportunity.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="follow-up-title">Next step</Label>
              <Input
                id="follow-up-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={240}
                placeholder="Send the revised proposal"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="follow-up-due-date">Due date</Label>
              <Input
                id="follow-up-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !opportunityId || !title.trim() || !dueDate}>
                {isSaving ? "Saving…" : "Schedule follow-up"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
