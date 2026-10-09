"use client";

import * as React from "react";
import { Target } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";

/** Start of the current target window (monthly / quarterly / annual). */
function periodStart(period: string): Date {
  const now = new Date();
  if (period === "quarterly") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (period === "annual") return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Sub-user personal target progress (Phase 3).
 *
 * Reads the caller's own sales_targets row (RLS: owner-or-self) via the
 * pipeline provider and measures Closed Won revenue in the current period
 * against it. Renders nothing for owners — they see org targets elsewhere.
 */
export function PersonalTargetCard() {
  const { membershipRole, userId } = useAuth();
  const { opportunities, personalTarget, currency, isLoading } = usePipeline();

  const actual = React.useMemo(() => {
    if (!personalTarget || !userId) return 0;
    const start = periodStart(personalTarget.period);
    return opportunities
      .filter(
        (opportunity) =>
          opportunity.ownerId === userId &&
          opportunity.stage === "Closed Won" &&
          opportunity.closedDate &&
          new Date(opportunity.closedDate) >= start,
      )
      .reduce((sum, opportunity) => sum + opportunity.value, 0);
  }, [opportunities, personalTarget, userId]);

  if (membershipRole !== "sales_rep" || !personalTarget) return null;

  const percent =
    personalTarget.amount > 0 ? Math.min((actual / personalTarget.amount) * 100, 100) : 0;
  const remaining = Math.max(personalTarget.amount - actual, 0);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            <Target className="h-3 w-3" aria-hidden="true" />
            My {personalTarget.period} target
          </p>
          <p className="text-[13px] text-muted-foreground">
            <span className="font-semibold text-foreground">{formatCurrency(actual, currency)}</span>{" "}
            won of {formatCurrency(personalTarget.amount, currency)}
          </p>
        </div>
        <p className="text-[22px] font-bold leading-none tabular">{Math.round(percent)}%</p>
      </div>
      <Progress
        value={percent}
        className="mt-3 h-1.5"
        indicatorClassName={percent >= 100 ? "bg-emerald-500" : "bg-primary"}
      />
      <p className="mt-2 text-2xs text-muted-foreground">
        {isLoading
          ? "Loading your target…"
          : percent >= 100
            ? "Target reached — nice work."
            : `${formatCurrency(remaining, currency)} to go this ${personalTarget.period}.`}
      </p>
    </Card>
  );
}
