"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { callTeamRoute, type InviteResult } from "@/lib/team-api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onInvited?: () => void;
}

export function InviteDialog({ open, onOpenChange, organizationId, onInvited }: InviteDialogProps) {
  const [email, setEmail] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [personalTarget, setPersonalTarget] = React.useState("");
  const [targetPeriod, setTargetPeriod] = React.useState("monthly");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<InviteResult | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setEmail("");
    setFullName("");
    setPersonalTarget("");
    setTargetPeriod("monthly");
    setError(null);
    setPending(false);
    setResult(null);
    setCopied(false);
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    const target = Number(personalTarget.replace(/[^0-9.]/g, ""));
    if (personalTarget.trim() && (!Number.isFinite(target) || target < 0)) {
      setError("Enter a target of 0 or more.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const invite = await callTeamRoute<InviteResult>("/api/team/invite", {
        organizationId,
        email: normalizedEmail,
        fullName: fullName.trim(),
        personalTarget: target || 0,
        targetPeriod,
      });
      setResult(invite);
      onInvited?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The invitation could not be sent.");
    } finally {
      setPending(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.acceptUrl) return;
    try {
      await navigator.clipboard.writeText(result.acceptUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the link. Select it and copy manually.");
    }
  };

  const invitedEmail = email.trim().toLowerCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Invitation created</DialogTitle>
              <DialogDescription>
                An invitation for <span className="font-medium text-foreground">{invitedEmail}</span>{" "}
                {result.emailSent ? "has been emailed." : "was created, but email is not configured."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Label htmlFor="invite-link">Invitation link</Label>
              <div className="flex gap-2">
                <Input id="invite-link" readOnly value={result.acceptUrl ?? ""} className="text-xs" />
                <Button type="button" variant="outline" onClick={handleCopy} aria-label="Copy invitation link">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {result.warning ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  {result.warning}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Invite a team member</DialogTitle>
              <DialogDescription>
                They will join this organization as a sales representative with their own target.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Work email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  autoComplete="off"
                  placeholder="teammate@company.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-name">Full name (optional)</Label>
                <Input
                  id="invite-name"
                  autoComplete="name"
                  placeholder="Alex Morgan"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-target">Personal target</Label>
                  <Input
                    id="invite-target"
                    inputMode="numeric"
                    placeholder="0"
                    value={personalTarget}
                    onChange={(event) => {
                      setPersonalTarget(event.target.value);
                      setError(null);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-period">Target period</Label>
                  <Select value={targetPeriod} onValueChange={setTargetPeriod}>
                    <SelectTrigger id="invite-period" aria-label="Target period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {error ? (
                <p role="alert" className="text-xs font-medium text-rose-600">
                  {error}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Sending..." : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
