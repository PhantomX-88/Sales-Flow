"use client";

import * as React from "react";

import { usePipeline } from "@/components/dashboard/pipeline-provider";
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
import { Textarea } from "@/components/ui/textarea";
import { defaultProbabilityFor } from "@/lib/metrics";
import { LEAD_SOURCES, STAGE_ORDER, TODAY } from "@/lib/pipeline-config";
import type { Opportunity, OpportunityDraft, PipelineStage } from "@/lib/types";
import { cn } from "@/lib/utils";

type FieldErrors = Partial<Record<keyof OpportunityDraft, string>>;

const BASE_SOURCES = Array.from(new Set([...LEAD_SOURCES, "Website", "Referral"])).sort();

function emptyDraft(owner: string): OpportunityDraft {
  return {
    company: "",
    contact: "",
    email: "",
    phone: "",
    value: "",
    stage: "Discovery",
    probability: String(defaultProbabilityFor("Discovery")),
    expectedCloseDate: TODAY,
    leadSource: BASE_SOURCES[0] ?? "Referral",
    owner,
    notes: "",
  };
}

function draftFromOpportunity(opportunity: Opportunity): OpportunityDraft {
  return {
    company: opportunity.company,
    contact: opportunity.contact,
    email: opportunity.email ?? "",
    phone: opportunity.phone ?? "",
    value: String(opportunity.value),
    stage: opportunity.stage,
    probability: String(opportunity.probability),
    expectedCloseDate: opportunity.expectedCloseDate,
    leadSource: opportunity.leadSource,
    owner: opportunity.owner,
    notes: opportunity.notes ?? "",
  };
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-2xs font-medium text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-2xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

interface OpportunityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: Opportunity | null;
}

export function OpportunityFormDialog({
  open,
  onOpenChange,
  opportunity = null,
}: OpportunityFormDialogProps) {
  const { createOpportunity, updateOpportunity, ownerNames, metadata } = usePipeline();
  const isEdit = Boolean(opportunity);
  const [draft, setDraft] = React.useState<OpportunityDraft>(() => emptyDraft(ownerNames[0] ?? ""));
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [probabilityTouched, setProbabilityTouched] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDraft(opportunity ? draftFromOpportunity(opportunity) : emptyDraft(ownerNames[0] ?? ""));
    setErrors({});
    setProbabilityTouched(false);
  }, [open, opportunity, ownerNames]);

  const update = <K extends keyof OpportunityDraft>(key: K, value: OpportunityDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleStageChange = (stage: PipelineStage) => {
    setDraft((current) => ({
      ...current,
      stage,
      probability: probabilityTouched ? current.probability : String(defaultProbabilityFor(stage)),
    }));
    setErrors((current) => ({ ...current, stage: undefined, probability: undefined }));
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!draft.company.trim()) next.company = "Company name is required.";
    if (!draft.contact.trim()) next.contact = "Contact name is required.";

    const value = Number(draft.value.replace(/[^0-9.]/g, ""));
    if (!draft.value.trim()) next.value = "Deal value is required.";
    else if (!Number.isFinite(value) || value <= 0) next.value = "Enter a deal value above 0.";
    else if (value > 50_000_000) next.value = "Deal value looks too large.";

    if (!draft.stage) next.stage = "Stage is required.";

    const probability = Number(draft.probability.replace(/[^0-9.]/g, ""));
    if (draft.probability.trim() === "") next.probability = "Probability is required.";
    else if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
      next.probability = "Probability must be between 0 and 100.";
    }

    if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      next.email = "Enter a valid email address.";
    }

    if (!draft.expectedCloseDate) next.expectedCloseDate = "Expected close date is required.";

    return next;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    if (isEdit && opportunity) updateOpportunity(opportunity.id, draft);
    else createOpportunity(draft);

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit opportunity" : "New opportunity"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the deal and save — every metric, chart and win-rate figure recalculates instantly."
              : `Add a deal to the ${metadata.period} pipeline. Required fields are marked below.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company name *" htmlFor="opp-company" error={errors.company}>
              <Input
                id="opp-company"
                value={draft.company}
                onChange={(event) => update("company", event.target.value)}
                placeholder="Meridian Health"
                aria-invalid={Boolean(errors.company)}
                aria-describedby={errors.company ? "opp-company-error" : undefined}
                autoComplete="organization"
              />
            </Field>

            <Field label="Contact name" htmlFor="opp-contact" error={errors.contact}>
              <Input
                id="opp-contact"
                value={draft.contact}
                onChange={(event) => update("contact", event.target.value)}
                placeholder="Chidi Okafor"
                aria-invalid={Boolean(errors.contact)}
                aria-describedby={errors.contact ? "opp-contact-error" : undefined}
                autoComplete="name"
              />
            </Field>

            <Field label="Email" htmlFor="opp-email" error={errors.email}>
              <Input
                id="opp-email"
                type="email"
                value={draft.email}
                onChange={(event) => update("email", event.target.value)}
                placeholder="contact@company.com"
                aria-invalid={Boolean(errors.email)}
              />
            </Field>

            <Field label="Phone" htmlFor="opp-phone">
              <Input
                id="opp-phone"
                type="tel"
                value={draft.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="+234 801 000 1001"
              />
            </Field>

            <Field label="Deal value (USD) *" htmlFor="opp-value" error={errors.value}>
              <Input
                id="opp-value"
                inputMode="numeric"
                value={draft.value}
                onChange={(event) => update("value", event.target.value)}
                placeholder="84000"
                aria-invalid={Boolean(errors.value)}
              />
            </Field>

            <Field label="Stage *" htmlFor="opp-stage" error={errors.stage}>
              <Select value={draft.stage} onValueChange={(value) => handleStageChange(value as PipelineStage)}>
                <SelectTrigger id="opp-stage" aria-label="Opportunity stage">
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
            </Field>

            <Field
              label="Probability (%)"
              htmlFor="opp-probability"
              error={errors.probability}
              hint={`Stage default: ${defaultProbabilityFor(draft.stage)}%`}
            >
              <Input
                id="opp-probability"
                inputMode="numeric"
                value={draft.probability}
                onChange={(event) => {
                  setProbabilityTouched(true);
                  update("probability", event.target.value);
                }}
                aria-invalid={Boolean(errors.probability)}
              />
            </Field>

            <Field label="Expected close date" htmlFor="opp-close-date" error={errors.expectedCloseDate}>
              <Input
                id="opp-close-date"
                type="date"
                value={draft.expectedCloseDate}
                onChange={(event) => update("expectedCloseDate", event.target.value)}
              />
            </Field>

            <Field label="Lead source" htmlFor="opp-source">
              <Select value={draft.leadSource} onValueChange={(value) => update("leadSource", value)}>
                <SelectTrigger id="opp-source" aria-label="Lead source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BASE_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Owner" htmlFor="opp-owner">
              <Select value={draft.owner} onValueChange={(value) => update("owner", value)}>
                <SelectTrigger id="opp-owner" aria-label="Opportunity owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ownerNames.map((owner) => (
                    <SelectItem key={owner} value={owner}>
                      {owner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Notes" htmlFor="opp-notes">
            <Textarea
              id="opp-notes"
              value={draft.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Context, next steps or blockers for this deal."
              rows={3}
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEdit ? "Save changes" : "Create opportunity"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
