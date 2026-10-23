/* Churn Recording Dialog */
"use client";

import * as React from "react";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { ChurnRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ChurnRecordingDialogProps {
  organizationId: string | undefined;
  opportunityId: string | null;
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function ChurnRecordingDialog({ organizationId, opportunityId, open, setOpen }: ChurnRecordingDialogProps) {
  const {
    recordChurn,
    updateOpportunityChurnState,
    invoiceRecords,
  } = usePipeline();

  const [reason, setReason] = React.useState("");
  const [outstandingAmount, setOutstandingAmount] = React.useState(0);

  const handleRecord = async () => {
    if (!reason.trim()) return;

    await recordChurn(opportunityId!, reason.trim(), outstandingAmount);

    // Update opportunity payment state
    await updateOpportunityChurnState(opportunityId!, 0, null);

    setReason("");
    setOutstandingAmount(0);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Churn</DialogTitle>
          <DialogDescription>
            Record that this opportunity has churned
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Churn Reason</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer chose competitor, budget constraints, etc."
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Outstanding Amount</label>
            <Input
              type="number"
              value={outstandingAmount.toString()}
              onChange={(e) => setOutstandingAmount(Number(e.target.value) || 0)}
              min="0"
              placeholder="0"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Amount outstanding at time of churn
            </p>
          </div>
        </div>

        <DialogFooter className="justify-end pt-2">
          <Button
            variant="outline"
            onClick={setOpen}
          >
            Cancel
          </Button>
          <Button onClick={handleRecord}>
            Record Churn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}