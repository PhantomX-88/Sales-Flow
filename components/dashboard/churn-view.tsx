"use client";

import * as React from "react";
import { TrendingDown } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { useAuth } from "@/components/auth/auth-provider";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSupabaseClient } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

type ChurnRow = { id: string; opportunity_id: string; churned_at: string; outstanding_amount: number; reason: string; notes: string | null; company: string };

export function ChurnView() {
  const { organizationId } = useAuth();
  const { opportunities, currency } = usePipeline();
  const [records, setRecords] = React.useState<ChurnRow[]>([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!organizationId) return;
    let active = true;
    void (async () => {
      const { data, error: queryError } = await getSupabaseClient().from("churn_records").select("*").eq("organization_id", organizationId).order("churned_at", { ascending: false });
      if (!active) return;
      if (queryError) { setError(queryError.message); return; }
      const names = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity.company]));
      setRecords((data ?? []).map((row: any) => ({ ...row, company: names.get(row.opportunity_id) ?? "Former client" })));
    })();
    return () => { active = false; };
  }, [opportunities, organizationId]);

  const outstanding = records.reduce((total, row) => total + Number(row.outstanding_amount), 0);
  return <div className="space-y-6">
    <PageHeader title="Churn overview" description="A workspace view of client departures, exit dates, outstanding payments, and admin notes." />
    <div className="grid gap-4 sm:grid-cols-2"><Card className="p-5"><p className="text-sm text-muted-foreground">Recorded departures</p><p className="mt-2 text-2xl font-bold">{records.length}</p></Card><Card className="p-5"><p className="text-sm text-muted-foreground">Outstanding at departure</p><p className="mt-2 text-2xl font-bold">{formatCurrency(outstanding, currency)}</p></Card></div>
    {error ? <Card className="p-4 text-sm text-destructive">Churn records could not load: {error}. Apply the invoice, payment and churn database patch, then reload.</Card> : null}
    {records.length === 0 ? <Card><EmptyState icon={TrendingDown} title="No churn recorded" description="When a client leaves, record the departure from the opportunity details to build an organization-wide overview." /></Card> : <Card className="overflow-hidden"><ul className="divide-y divide-border">{records.map((record) => <li key={record.id} className="flex flex-wrap items-start gap-3 px-5 py-4"><div className="min-w-0 flex-1"><p className="font-semibold">{record.company}</p><p className="mt-1 text-sm text-muted-foreground">{record.reason}</p>{record.notes ? <p className="mt-1 text-xs text-muted-foreground">{record.notes}</p> : null}</div><div className="text-right"><Badge variant={Number(record.outstanding_amount) > 0 ? "warning" : "secondary"}>{formatCurrency(Number(record.outstanding_amount), currency)} outstanding</Badge><p className="mt-1 text-xs text-muted-foreground">Left {record.churned_at}</p></div></li>)}</ul></Card>}
  </div>;
}
