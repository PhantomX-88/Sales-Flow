"use client";

import * as React from "react";
import {
  Building2,
  CalendarDays,
  CircleX,
  Clock3,
  Mail,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Trophy,
  User,
} from "lucide-react";

import { OwnerAvatar } from "@/components/dashboard/owner-avatar";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { StageBadge } from "@/components/dashboard/stage-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { STAGE_ORDER } from "@/lib/pipeline-config";
import type { ActivityType, PipelineStage } from "@/lib/types";
import {
  cn,
  closeDateTone,
  daysBetween,
  formatCurrency,
  formatDate,
  pluralize,
} from "@/lib/utils";

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  icon?: typeof Building2;
}

function DetailRow({ label, value, icon: Icon }: DetailRowProps) {
  return (
    <div className="space-y-0.5">
      <dt className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd className="text-[13px] font-medium text-foreground">{value}</dd>
    </div>
  );
}

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "proposal", label: "Proposal sent" },
];

export function OpportunityDetailDrawer() {
  const {
    selectedOpportunity,
    closeOpportunity,
    openEditDialog,
    moveStage,
    markWon,
    markLost,
    deleteOpportunity,
    activities,
    addActivity,
    today,
  } = usePipeline();

  const [isLoggingActivity, setLoggingActivity] = React.useState(false);
  const [activityType, setActivityType] = React.useState<ActivityType>("note");
  const [activityText, setActivityText] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    setLoggingActivity(false);
    setActivityText("");
    setActivityType("note");
  }, [selectedOpportunity?.id]);

  const opportunity = selectedOpportunity;
  const timeline = React.useMemo(
    () => activities.filter((activity) => activity.opportunityId === opportunity?.id),
    [activities, opportunity?.id],
  );

  const isClosed = opportunity?.stage === "Closed Won" || opportunity?.stage === "Closed Lost";
  const tone = opportunity ? closeDateTone(opportunity.expectedCloseDate, today) : "muted";
  const daysToClose = opportunity ? daysBetween(opportunity.expectedCloseDate, today) : 0;

  return (
    <>
      <Sheet open={Boolean(opportunity)} onOpenChange={(open) => !open && closeOpportunity()}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-lg">
          {opportunity ? (
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-border pb-5 pr-12">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <SheetTitle className="truncate">{opportunity.company}</SheetTitle>
                    <SheetDescription className="truncate">
                      {opportunity.id} · {opportunity.contact}
                    </SheetDescription>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="text-[22px] font-bold leading-none tracking-tight tabular">
                    {formatCurrency(opportunity.value)}
                  </span>
                  <StageBadge stage={opportunity.stage} />
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-2xs text-muted-foreground">
                    <span>{opportunity.probability}% probability</span>
                    <span
                      className={cn(
                        tone === "danger" && "font-medium text-rose-600",
                        tone === "warning" && "font-medium text-amber-600",
                      )}
                    >
                      {isClosed
                        ? `Closed ${formatDate(opportunity.closedDate ?? opportunity.expectedCloseDate)}`
                        : daysToClose < 0
                          ? `${Math.abs(daysToClose)} ${pluralize(Math.abs(daysToClose), "day")} past close date`
                          : `Closes in ${daysToClose} ${pluralize(daysToClose, "day")}`}
                    </span>
                  </div>
                  <Progress value={opportunity.probability} className="h-1.5" />
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-6 overflow-y-auto p-5">
                <section aria-labelledby="opportunity-details">
                  <h3 id="opportunity-details" className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Opportunity details
                  </h3>
                  <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DetailRow label="Company" value={opportunity.company} icon={Building2} />
                    <DetailRow label="Owner" value={
                      <span className="flex items-center gap-2">
                        <OwnerAvatar name={opportunity.owner} size="sm" className="h-5 w-5 text-[9px]" />
                        {opportunity.owner}
                      </span>
                    } icon={User} />
                    <DetailRow
                      label="Email"
                      value={
                        opportunity.email ? (
                          <a className="text-primary hover:underline" href={`mailto:${opportunity.email}`}>
                            {opportunity.email}
                          </a>
                        ) : (
                          "—"
                        )
                      }
                      icon={Mail}
                    />
                    <DetailRow
                      label="Phone"
                      value={
                        opportunity.phone ? (
                          <a className="text-primary hover:underline" href={`tel:${opportunity.phone}`}>
                            {opportunity.phone}
                          </a>
                        ) : (
                          "—"
                        )
                      }
                      icon={Phone}
                    />
                    <DetailRow label="Expected close" value={formatDate(opportunity.expectedCloseDate)} icon={CalendarDays} />
                    <DetailRow label="Created" value={formatDate(opportunity.createdDate)} icon={CalendarDays} />
                    <DetailRow label="Deal age" value={`${opportunity.age} days`} icon={Clock3} />
                    <DetailRow label="Lead source" value={opportunity.leadSource} />
                    <DetailRow
                      label="Last activity"
                      value={opportunity.lastActivity}
                      icon={Clock3}
                    />
                  </dl>

                  <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
                    <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                      <NotebookPen className="h-3 w-3" aria-hidden="true" />
                      Notes
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90">
                      {opportunity.notes ?? "No notes captured for this opportunity yet."}
                    </p>
                  </div>
                </section>

                <section aria-labelledby="opportunity-stage">
                  <h3 id="opportunity-stage" className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Pipeline stage
                  </h3>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={opportunity.stage}
                      onValueChange={(value) => moveStage(opportunity.id, value as PipelineStage)}
                    >
                      <SelectTrigger aria-label="Change pipeline stage" className="sm:max-w-[12rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGE_ORDER.map((stage) => (
                          <SelectItem key={stage} value={stage}>
                            {stage}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-2xs text-muted-foreground">
                      Probability follows the stage unless you set it manually.
                    </p>
                  </div>
                </section>

                <section aria-labelledby="opportunity-actions">
                  <h3 id="opportunity-actions" className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Actions
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(opportunity.id)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLoggingActivity((current) => !current)}
                      aria-expanded={isLoggingActivity}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add activity
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markWon(opportunity.id)}
                      disabled={opportunity.stage === "Closed Won"}
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      Mark as Won
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markLost(opportunity.id)}
                      disabled={opportunity.stage === "Closed Lost"}
                    >
                      <CircleX className="h-3.5 w-3.5" />
                      Mark as Lost
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>

                  {isLoggingActivity ? (
                    <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3.5">
                      <div className="space-y-1.5">
                        <Label htmlFor="activity-type">Activity type</Label>
                        <Select
                          value={activityType}
                          onValueChange={(value) => setActivityType(value as ActivityType)}
                        >
                          <SelectTrigger id="activity-type" aria-label="Activity type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACTIVITY_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="activity-text">What happened?</Label>
                        <Textarea
                          id="activity-text"
                          rows={2}
                          value={activityText}
                          onChange={(event) => setActivityText(event.target.value)}
                          placeholder={`e.g. Sent updated pricing to ${opportunity.contact}`}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setLoggingActivity(false)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={!activityText.trim()}
                          onClick={() => {
                            addActivity(
                              opportunity.id,
                              activityType,
                              activityText.trim() ||
                                `Activity logged for ${opportunity.company}`,
                            );
                            setActivityText("");
                            setLoggingActivity(false);
                          }}
                        >
                          Log activity
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </section>

                <section aria-labelledby="opportunity-timeline">
                  <h3 id="opportunity-timeline" className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Timeline
                  </h3>
                  {timeline.length === 0 ? (
                    <p className="mt-3 text-[13px] text-muted-foreground">
                      No recorded activity for this opportunity yet. Log a call, email or note to start
                      the timeline.
                    </p>
                  ) : (
                    <ol className="mt-3 space-y-3 border-l border-border pl-4">
                      {timeline.map((activity) => (
                        <li key={activity.id} className="relative">
                          <span
                            className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary"
                            aria-hidden="true"
                          />
                          <p className="text-[13px] font-medium leading-snug">{activity.text}</p>
                          <p className="mt-0.5 text-2xs text-muted-foreground">
                            {activity.time} · {activity.type.replace("_", " ")}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>

              <div className="flex shrink-0 gap-2 border-t border-border bg-muted/30 p-4">
                <Button className="flex-1" onClick={() => markWon(opportunity.id)} variant="default">
                  <Trophy className="h-4 w-4" />
                  Mark as Won
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => openEditDialog(opportunity.id)}>
                  <Pencil className="h-4 w-4" />
                  Edit opportunity
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={opportunity ? `Delete ${opportunity.company}?` : "Delete opportunity?"}
        description="This permanently removes the opportunity from the pipeline and updates every metric."
        confirmLabel="Delete opportunity"
        onConfirm={() => (opportunity ? deleteOpportunity(opportunity.id) : undefined)}
      />
    </>
  );
}
