"use client";

import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";
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
import { getSupabaseClient } from "@/lib/supabase";

function getTodayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function DailyFxModal() {
  const { organization, membershipRole, resolveOrganization } = useAuth();
  const [rate, setRate] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const organizationExchangeRate = organization?.usdNgnExchangeRate;
  const isAdmin = membershipRole === "owner" || membershipRole === "admin";
  const isRequired = Boolean(
    organization && isAdmin && organization.fxRateUpdatedAt !== getTodayUtc(),
  );

  React.useEffect(() => {
    if (organizationExchangeRate !== undefined) setRate(String(organizationExchangeRate));
  }, [organizationExchangeRate]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization || pending) return;

    const parsedRate = Number(rate);
    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      setError("Enter an exchange rate greater than zero.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const { error: saveError } = await getSupabaseClient().rpc("update_organization_fx_rate", {
        target_organization_id: organization.id,
        new_usd_ngn_exchange_rate: parsedRate,
      });
      if (saveError) {
        setError(saveError.message);
        return;
      }

      const result = await resolveOrganization();
      if (result.error) {
        setError(`Rate saved, but organization data could not be refreshed: ${result.error}`);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The exchange rate could not be saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={isRequired} onOpenChange={() => undefined}>
      <DialogContent
        className="[&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Set Today&apos;s Organization Exchange Rate</DialogTitle>
          <DialogDescription>
            Set the shared USD/NGN rate for your organization. Team dashboards will use this rate
            after it is saved.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-2">
            <Label htmlFor="daily-usd-ngn-rate">USD to NGN exchange rate</Label>
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-sm font-medium">$1 = ₦</span>
              <Input
                id="daily-usd-ngn-rate"
                type="number"
                min="0.01"
                step="0.01"
                required
                autoFocus
                value={rate}
                onChange={(event) => {
                  setRate(event.target.value);
                  setError(null);
                }}
                aria-describedby="daily-usd-ngn-example"
              />
            </div>
            <p id="daily-usd-ngn-example" className="text-xs text-muted-foreground">
              Example: $1 = ₦1,650. This rate is shared across the organization.
            </p>
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending || !rate}>
              {pending ? "Saving rate..." : "Save today's rate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
