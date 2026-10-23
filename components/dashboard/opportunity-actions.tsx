"use client";

import * as React from "react";
import {
  ArrowRightLeft,
  CircleX,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  Trophy,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STAGE_ORDER } from "@/lib/pipeline-config";
import type { Opportunity } from "@/lib/types";

interface OpportunityActionsProps {
  opportunity: Opportunity;
  align?: "start" | "end";
}

export function OpportunityActions({ opportunity, align = "end" }: OpportunityActionsProps) {
  const {
    openOpportunity,
    openEditDialog,
    moveStage,
    markWon,
    markLost,
    deleteOpportunity,
    requestDeletion,
    createInvoice,
    updateInvoice,
    sendInvoice,
    recordChurn,
    updateOpportunityChurnState,
  } = usePipeline();
  const { membershipRole, userId } = useAuth();
  const isOwner = membershipRole === "owner";

  // Phase 5: owners soft-delete directly; sub-users can only request
  // deletion of deals they created AND currently own (enforced by the RPC).
  const canRequestDeletion =
    !isOwner &&
    Boolean(userId) &&
    opportunity.createdBy === userId &&
    opportunity.ownerId === userId;

  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleteReason, setDeleteReason] = React.useState("");
  const [confirmRequest, setConfirmRequest] = React.useState(false);
  const [requestReason, setRequestReason] = React.useState("");
const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleteReason, setDeleteReason] = React.useState("");
  const [confirmRequest, setConfirmRequest] = React.useState(false);
  const [requestReason, setRequestReason] = React.useState("");
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = React.useState(false);
  const [createInvoiceDraft, setCreateInvoiceDraft] = React.useState<InvoiceDraft>({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    amount: 0,
    lineItems: [],
    notes: "",
  });
  const [isRecordChurnOpen, setIsRecordChurnOpen] = React.useState(false);
  const [churnReason, setChurnReason] = React.useState("");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Actions for ${opportunity.company}`}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-[13rem]">
          <DropdownMenuLabel>{opportunity.id}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => openOpportunity(opportunity.id)}>
            <Eye />
            View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openEditDialog(opportunity.id)}>
            <Pencil />
            Edit opportunity
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRightLeft />
              Change stage
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-[11rem]">
              {STAGE_ORDER.map((stage) => (
                <DropdownMenuItem
                  key={stage}
                  disabled={stage === opportunity.stage}
                  onSelect={() => moveStage(opportunity.id, stage)}
                >
                  {stage}
                  {stage === opportunity.stage ? (
                    <span className="ml-auto text-2xs text-muted-foreground">current</span>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={opportunity.stage === "Closed Won"}
            onSelect={() => markWon(opportunity.id)}
          >
            <Trophy />
            Mark as won
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={opportunity.stage === "Closed Lost"}
            onSelect={() => markLost(opportunity.id)}
          >
            <CircleX />
            Mark as lost
          </DropdownMenuItem>
<DropdownMenuItem\n            disabled={opportunity.stage !== \"Closed Won\"}\n            onSelect={() => openCreateInvoiceDialog(opportunity.id)}\n          >\n            <Invoice className=\"h-3.5 w-3.5\" />\n            Create invoice\n          </DropdownMenuItem>\n          <DropdownMenuItem\n            disabled={opportunity.stage !== \"Closed Won\"}\n            onSelect={() => openRecordChurnDialog(opportunity.id)}\n          >\n            <Trash className=\"h-3.5 w-3.5\" />\n            Record churn\n          </DropdownMenuItem>\n          <DropdownMenuSeparator />
          <DropdownMenuSeparator />
          {isOwner ? (
            <DropdownMenuItem className="on-danger" onSelect={() => setConfirmDelete(true)}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          ) : canRequestDeletion && !opportunity.deletedAt ? (
            <DropdownMenuItem onSelect={() => setConfirmRequest(true)}>
              <Trash2 />
              Request deletion
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Owner: soft delete with a required reason. Restorable for 30 days. */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          setConfirmDelete(open);
          if (!open) setDeleteReason("");
        }}
        title={`Delete ${opportunity.company}?`}
        description="Soft-deletes the deal instantly — no approval needed. It stays restorable for 30 days, then is purged permanently."
        confirmLabel="Delete opportunity"
        onConfirm={async () => {
          await deleteOpportunity(opportunity.id, deleteReason);
          setDeleteReason("");
        }}
      >
        <Label htmlFor={`delete-reason-${opportunity.id}`}>Reason (required)</Label>
        <Textarea
          id={`delete-reason-${opportunity.id}`}
          rows={3}
          value={deleteReason}
          onChange={(event) => setDeleteReason(event.target.value)}
          placeholder="e.g. Duplicate of an existing deal"
        />
      </ConfirmDialog>

      {/* Sub-user: deletion goes to the owner's approval queue. */}
      <ConfirmDialog
        open={confirmRequest}
        onOpenChange={(open) => {
          setConfirmRequest(open);
          if (!open) setRequestReason("");
        }}
        title={`Request deletion of ${opportunity.company}?`}
        description="The owner reviews your request. The deal shows “Deletion pending” until they approve or reject it."
        confirmLabel="Submit request"
        tone="default"
        onConfirm={async () => {
          await requestDeletion(opportunity.id, requestReason);
          setRequestReason("");
        }}
      >
        <Label htmlFor={`request-reason-${opportunity.id}`}>Reason (required)</Label>
        <Textarea
          id={`request-reason-${opportunity.id}`}
          rows={3}
          value={requestReason}
          onChange={(event) => setRequestReason(event.target.value)}
          placeholder="e.g. Created by mistake — same company listed twice"
        />
      </ConfirmDialog>
    </>
  );
}
