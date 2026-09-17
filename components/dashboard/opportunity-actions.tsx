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

import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { STAGE_ORDER } from "@/lib/mock-data";
import type { Opportunity } from "@/lib/types";

interface OpportunityActionsProps {
  opportunity: Opportunity;
  align?: "start" | "end";
}

export function OpportunityActions({ opportunity, align = "end" }: OpportunityActionsProps) {
  const { openOpportunity, openEditDialog, moveStage, markWon, markLost, deleteOpportunity } =
    usePipeline();
  const [confirmDelete, setConfirmDelete] = React.useState(false);

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
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-rose-600" onSelect={() => setConfirmDelete(true)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${opportunity.company}?`}
        description={`This removes ${opportunity.id} from the pipeline. This action cannot be undone in the demo session.`}
        confirmLabel="Delete opportunity"
        onConfirm={() => deleteOpportunity(opportunity.id)}
      />
    </>
  );
}
