"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import * as React from "react";

import {
  useAuth,
  type OrganizationProfile,
  type OrganizationSetupDetails,
} from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FEATURES = [
  { id: "email-whatsapp", label: "Email and WhatsApp helpers" },
  { id: "quotes-proforma", label: "Quotes and proforma invoices" },
  { id: "payment-tracking", label: "Payment tracking" },
  { id: "ai-follow-up", label: "AI follow-up drafts" },
] as const;

const INDUSTRIES = [
  "Technology",
  "Professional services",
  "Financial services",
  "Healthcare",
  "Manufacturing",
  "Retail and commerce",
  "Other",
];

const EMPTY_SETUP: OrganizationSetupDetails = {
  name: "",
  tag: "",
  industry: "Technology",
  country: "",
  expectedSubUsers: 1,
  revenueTarget: 0,
  currency: "USD",
  targetPeriod: "monthly",
  expectedTransactionsPerMonth: 0,
  averageDealSize: 0,
  teamType: "inside",
  enabledFeatures: [],
};

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

const selectClass = "flex h-10 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60";

export function OrganizationSetupForm({
  mode,
  initial,
  onComplete,
}: {
  mode: "onboarding" | "settings";
  initial?: OrganizationProfile | null;
  onComplete?: (organizationId: string) => void;
}) {
  const { checkOrganizationTag, saveOrganizationSetup } = useAuth();
  const [setup, setSetup] = React.useState<OrganizationSetupDetails>(() => initial ?? EMPTY_SETUP);
  const [step, setStep] = React.useState(1);
  const [pending, setPending] = React.useState(false);
  const [tagStatus, setTagStatus] = React.useState<"idle" | "checking" | "available" | "taken" | "invalid" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const tag = setup.tag.trim().toLowerCase();
  const tagValid = /^[a-z0-9-]{3,20}$/.test(tag);

  React.useEffect(() => {
    setSetup(initial ?? EMPTY_SETUP);
  }, [initial]);

  React.useEffect(() => {
    if (!tagValid) {
      setTagStatus(tag ? "invalid" : "idle");
      return;
    }

    let active = true;
    setTagStatus("checking");
    const timer = window.setTimeout(async () => {
      const result = await checkOrganizationTag(tag, initial?.id);
      if (!active) return;
      setTagStatus(result.error ? "error" : result.available ? "available" : "taken");
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [checkOrganizationTag, initial?.id, tag, tagValid]);

  function update<K extends keyof OrganizationSetupDetails>(key: K, value: OrganizationSetupDetails[K]) {
    setSetup((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function save(features = setup.enabledFeatures) {
    setPending(true);
    setError(null);
    const result = await saveOrganizationSetup(
      { ...setup, tag, enabledFeatures: features },
      initial?.id,
    );
    setPending(false);
    if (result.error || !result.organizationId) {
      setError(result.error ?? "Organization setup could not be saved.");
      return;
    }
    onComplete?.(result.organizationId);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "onboarding" && step < 3) {
      setStep((current) => current + 1);
      return;
    }
    void save();
  }

  const settingsMode = mode === "settings";
  const tagMessage = tagStatus === "checking"
    ? "Checking availability..."
    : tagStatus === "available"
      ? "Tag is available"
      : tagStatus === "taken"
        ? "This tag is already in use"
        : tagStatus === "invalid"
          ? "Use 3-20 lowercase letters, numbers, or hyphens"
          : tagStatus === "error"
            ? "Could not check tag availability"
            : "Shown in your dashboard header";

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {mode === "onboarding" ? (
        <div>
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>{step === 3 ? "Optional features" : "Company setup"}</span>
            <span>Step {step} of 3</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((item) => (
              <span key={item} className={`h-1 rounded-full ${item <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </div>
      ) : null}

      {(settingsMode || step === 1) ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="org-name" label="Company name">
            <Input id="org-name" value={setup.name} onChange={(event) => update("name", event.target.value)} maxLength={120} required />
          </Field>
          <Field id="org-tag" label="Company tag">
            <Input
              id="org-tag"
              value={setup.tag}
              onChange={(event) => update("tag", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 20))}
              minLength={3}
              maxLength={20}
              pattern="[a-z0-9-]{3,20}"
              required
              aria-describedby="org-tag-status"
            />
            <p id="org-tag-status" aria-live="polite" className={`text-xs ${tagStatus === "available" ? "text-emerald-700" : tagStatus === "taken" || tagStatus === "invalid" || tagStatus === "error" ? "text-destructive" : "text-muted-foreground"}`}>
              {tagMessage}
            </p>
          </Field>
          <Field id="org-industry" label="Industry">
            <select id="org-industry" className={selectClass} value={setup.industry} onChange={(event) => update("industry", event.target.value)}>
              {INDUSTRIES.map((industry) => <option key={industry}>{industry}</option>)}
            </select>
          </Field>
          <Field id="org-country" label="Country">
            <Input id="org-country" value={setup.country} onChange={(event) => update("country", event.target.value)} maxLength={80} required />
          </Field>
          <Field id="org-user-count" label="Expected number of sub-users">
            <Input id="org-user-count" type="number" min={0} step={1} value={setup.expectedSubUsers} onChange={(event) => update("expectedSubUsers", Number(event.target.value))} required />
          </Field>
        </div>
      ) : null}

      {(settingsMode || step === 2) ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="org-revenue-target" label="Revenue target">
            <Input id="org-revenue-target" type="number" min={0} step="0.01" value={setup.revenueTarget} onChange={(event) => update("revenueTarget", Number(event.target.value))} required />
          </Field>
          <Field id="org-currency" label="Currency">
            <select id="org-currency" className={selectClass} value={setup.currency} onChange={(event) => update("currency", event.target.value as OrganizationSetupDetails["currency"])}>
              <option value="NGN">NGN</option><option value="USD">USD</option>
            </select>
          </Field>
          <Field id="org-period" label="Target period">
            <select id="org-period" className={selectClass} value={setup.targetPeriod} onChange={(event) => update("targetPeriod", event.target.value as OrganizationSetupDetails["targetPeriod"])}>
              <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
            </select>
          </Field>
          <Field id="org-transactions" label="Expected deals per month">
            <Input id="org-transactions" type="number" min={0} step={1} value={setup.expectedTransactionsPerMonth} onChange={(event) => update("expectedTransactionsPerMonth", Number(event.target.value))} required />
          </Field>
          <Field id="org-average-deal" label="Average deal size">
            <Input id="org-average-deal" type="number" min={0} step="0.01" value={setup.averageDealSize} onChange={(event) => update("averageDealSize", Number(event.target.value))} required />
          </Field>
          <Field id="org-team-type" label="Team type">
            <select id="org-team-type" className={selectClass} value={setup.teamType} onChange={(event) => update("teamType", event.target.value as OrganizationSetupDetails["teamType"])}>
              <option value="field">Field sales</option><option value="inside">Inside sales</option><option value="agency">Agency</option>
            </select>
          </Field>
        </div>
      ) : null}

      {(settingsMode || step === 3) ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Optional features</legend>
          <p className="text-xs text-muted-foreground">Choose modules to enable. You can change these later in Settings.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FEATURES.map((feature) => {
              const checked = setup.enabledFeatures.includes(feature.id);
              return (
                <label key={feature.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => update("enabledFeatures", checked ? setup.enabledFeatures.filter((item) => item !== feature.id) : [...setup.enabledFeatures, feature.id])}
                    className="size-4 accent-primary"
                  />
                  {feature.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        {mode === "onboarding" && step > 1 ? (
          <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)} disabled={pending}>
            <ArrowLeft /> Back
          </Button>
        ) : null}
        {mode === "onboarding" && step === 3 ? (
          <Button type="button" variant="outline" onClick={() => void save([])} disabled={pending || tagStatus !== "available"}>
            Skip features
          </Button>
        ) : null}
        <Button type="submit" className={settingsMode || step === 3 ? "ml-auto" : "ml-auto"} disabled={pending || tagStatus !== "available"}>
          {pending ? "Saving..." : settingsMode ? "Save organization" : step === 3 ? "Create organization" : "Continue"}
          {step === 3 || settingsMode ? <Check /> : <ArrowRight />}
        </Button>
      </div>
    </form>
  );
}
