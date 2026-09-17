"use client";

import * as React from "react";
import { Building2, CircleCheck, Clock3, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { OwnerAvatar } from "@/components/dashboard/owner-avatar";
import { PageHeader } from "@/components/dashboard/page-header";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { StageBadge } from "@/components/dashboard/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AccountSummary } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const HEALTH_META: Record<
  AccountSummary["health"],
  { label: string; variant: "success" | "warning" | "danger"; icon: typeof CircleCheck }
> = {
  healthy: { label: "Healthy", variant: "success", icon: CircleCheck },
  attention: { label: "Needs attention", variant: "warning", icon: Clock3 },
  "at-risk": { label: "At risk", variant: "danger", icon: TriangleAlert },
};

function AccountCard({ account }: { account: AccountSummary }) {
  const { openOpportunity } = usePipeline();
  const health = HEALTH_META[account.health];
  const HealthIcon = health.icon;

  return (
    <Card className="flex flex-col p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{account.company}</h3>
            <p className="truncate text-2xs text-muted-foreground">
              {account.contact} · {account.owner}
            </p>
          </div>
        </div>
        <Badge variant={health.variant} className="shrink-0">
          <HealthIcon className="h-3 w-3" aria-hidden="true" />
          {health.label}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            Open value
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular">{formatCurrency(account.openValue)}</p>
        </div>
        <div>
          <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            Won value
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular text-emerald-600">
            {formatCurrency(account.wonValue)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <StageBadge stage={account.primaryStage} />
        <span className="text-2xs text-muted-foreground">
          {account.opportunityCount} {account.opportunityCount === 1 ? "deal" : "deals"}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <OwnerAvatar name={account.owner} size="sm" className="h-5 w-5 text-[9px]" />
          Last activity {account.lastActivity.toLowerCase()}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-2xs"
          onClick={() => openOpportunity(account.opportunityId)}
        >
          View deal
        </Button>
      </div>
    </Card>
  );
}

export function AccountsView() {
  const { accounts, searchQuery } = usePipeline();

  const filtered = React.useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return accounts;

    return accounts.filter((account) =>
      [account.company, account.contact, account.owner].some((field) =>
        field.toLowerCase().includes(term),
      ),
    );
  }, [accounts, searchQuery]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Every company in your pipeline, rolled up with open value, health and ownership."
      />

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="No accounts found"
            description="No company matches your current search. Clear the search to see the full account list."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((account) => (
            <AccountCard key={account.company} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
