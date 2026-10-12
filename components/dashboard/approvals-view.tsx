"use client";

import * as React from "react";
import { CheckCircle2, RotateCcw, ShieldCheck, Trash2, XCircle } from "lucide-react";

import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

function daysLeft(deletedAt: string): number {
  return Math.max(30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86_400_000), 0);
}

export function ApprovalsView() {
  const {
    opportunities,
    deletionRequests,
    pendingDeletionCount,
    reviewDeletionRequest,
    restoreOpportunity,
    currency,
    isLoading,
  } = usePipeline();

  const [decision, setDecision] = React.useState<
    { kind: "reject" | "approve"; requestId: string; company: string; requestedBy: string } | null
  >(null);
  const [comment, setComment] = React.useState("");
  const [commandLoading, setCommandLoading] = React.useState(false);

  const requestsByOpportunity = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const request of deletionRequests) {
      map.set(request.opportunityId, request.id);
    }
    return map;
  }, [deletionRequests]);

  const pending = deletionRequests.filter((request) => request.status === "pending");
  const reviewed = deletionRequests.filter((request) => request.status !== "pending").slice(0, 5);
  const deleted = opportunities.filter((opportunity) => opportunity.deletedAt);

  const submitDecision = async () => {
    if (!decision) return;
    setCommandLoading(true);
    try {
      await reviewDeletionRequest(
        decision.requestId,
        decision.kind,
        decision.kind === "reject" ? comment : comment || undefined,
      );
    } finally {
      setCommandLoading(false);
      setDecision(null);
      setComment("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[28px]">
          Approvals
        </h1>
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
          Sub-user deletion requests and soft-deleted deals. Approving soft-deletes the deal
          instantly (restorable for 30 days); rejecting returns it to the rep with your comment.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[15px] font-semibold tracking-tight">Pending deletion requests</h2>
            <span className="text-2xs text-muted-foreground">{pendingDeletionCount}</span>
          </div>
        </div>

        {isLoading ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">Loading requests…</p>
        ) : pending.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">
            No deletion requests waiting. Sub-user requests will appear here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{request.opportunityCompany}</p>
                  <p className="mt-0.5 line-clamp-2 text-2xs text-muted-foreground">
                    “{request.reason}” · requested {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDecision({
                        kind: "reject",
                        requestId: request.id,
                        company: request.opportunityCompany,
                        requestedBy: request.requestedBy,
                      })
                    }
                  >
                    <XCircle />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      setDecision({
                        kind: "approve",
                        requestId: request.id,
                        company: request.opportunityCompany,
                        requestedBy: request.requestedBy,
                      })
                    }
                  >
                    <CheckCircle2 />
                    Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[15px] font-semibold tracking-tight">Deleted deals</h2>
            <span className="text-2xs text-muted-foreground">{deleted.length}</span>
          </div>
        </div>

        {deleted.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">
            Nothing deleted. Soft-deleted and approved deals stay here for 30 days before purging.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {deleted.map((opportunity) => (
              <li key={opportunity.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{opportunity.company}</p>
                  <p className="text-2xs text-muted-foreground">
                    {formatCurrency(opportunity.value, currency)} · {opportunity.stage} ·{" "}
                    {opportunity.deleteReason ? `“${opportunity.deleteReason}” · ` : ""}
                    {daysLeft(opportunity.deletedAt as string)} day(s) left to restore
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void restoreOpportunity(opportunity.id)}
                >
                  <RotateCcw />
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {reviewed.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="flex items-center border-b border-border px-5 py-4">
            <h2 className="text-[15px] font-semibold tracking-tight">Recently reviewed</h2>
          </div>
          <ul className="divide-y divide-border">
            {reviewed.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{request.opportunityCompany}</p>
                  {request.reviewComment ? (
                    <p className="truncate text-2xs text-muted-foreground">“{request.reviewComment}”</p>
                  ) : null}
                </div>
                <Badge
                  variant={request.status === "approved" ? "success" : "secondary"}
                  className="shrink-0 capitalize"
                >
                  {request.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <ConfirmDialog
        open={Boolean(decision)}
        onOpenChange={(open) => {
          if (!open) {
            setDecision(null);
            setComment("");
          }
        }}
        title={
          decision?.kind === "approve"
            ? `Approve deleting ${decision.company}?`
            : `Reject the deletion request for ${decision?.company ?? ""}?`
        }
        description={
          decision?.kind === "approve"
            ? "The deal soft-deletes immediately — restorable for 30 days from the Deleted deals list below."
            : "The deal stays in the pipeline. The rep sees your comment in the request status."
        }
        confirmLabel={decision?.kind === "approve" ? "Approve deletion" : "Reject request"}
        onConfirm={() => void submitDecision()}
      >
        {decision?.kind === "reject" ? (
          <div className="space-y-2">
            <Label htmlFor="rejection-comment">Comment (required)</Label>
            <Textarea
              id="rejection-comment"
              rows={3}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="e.g. This deal is still active — keep working it"
            />
          </div>
        ) : (
          <Label htmlFor="approval-comment">Comment (optional)</Label>
        )}
        {decision?.kind === "approve" ? (
          <input
            id="approval-comment"
            hidden
            onChange={(event) => setComment(event.target.value)}
          />
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
