"use client";

import * as React from "react";
import { CheckCircle2, FileText, XCircle } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSupabaseClient } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

type PendingInvoice = { id: string; opportunity_id: string; invoice_number: string; description: string; amount: number; due_date: string; company: string; created_at: string };

export function InvoiceApprovals() {
  const { organizationId, userId } = useAuth();
  const { opportunities, currency } = usePipeline();
  const [invoices, setInvoices] = React.useState<PendingInvoice[]>([]);
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  const [refresh, setRefresh] = React.useState(0);

  React.useEffect(() => {
    if (!organizationId) return;
    let active = true;
    void (async () => {
      const { data, error: queryError } = await getSupabaseClient().from("invoices").select("*").eq("organization_id", organizationId).eq("status", "pending_approval").order("created_at", { ascending: true });
      if (!active) return;
      if (queryError) { setError(queryError.message); return; }
      const names = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity.company]));
      setInvoices((data ?? []).map((row: any) => ({ ...row, company: names.get(row.opportunity_id) ?? "Opportunity" })));
    })();
    return () => { active = false; };
  }, [opportunities, organizationId, refresh]);

  const review = async (invoiceId: string, status: "approved" | "rejected") => {
    if (!organizationId || !userId) return;
    setBusy(invoiceId);
    const { error: saveError } = await getSupabaseClient().from("invoices").update({ status, reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", invoiceId);
    setBusy("");
    if (saveError) { setError(saveError.message); return; }
    setRefresh((current) => current + 1);
  };

  return <Card className="overflow-hidden"><div className="flex items-center gap-2 border-b border-border px-5 py-4"><FileText className="h-4 w-4 text-muted-foreground" /><h2 className="text-[15px] font-semibold">Invoice approvals</h2><Badge variant="secondary">{invoices.length}</Badge></div>
    {error ? <p role="alert" className="px-5 py-3 text-sm text-destructive">{error}. Apply the invoice, payment and churn database patch, then reload.</p> : null}
    {invoices.length === 0 ? <p className="px-5 py-8 text-sm text-muted-foreground">No invoices are waiting for approval.</p> : <ul className="divide-y divide-border">{invoices.map((invoice) => <li key={invoice.id} className="flex flex-wrap items-center gap-3 px-5 py-4"><div className="min-w-0 flex-1"><p className="font-semibold">{invoice.company} · {invoice.invoice_number}</p><p className="mt-0.5 text-xs text-muted-foreground">{invoice.description} · {formatCurrency(Number(invoice.amount), currency)} · due {invoice.due_date}</p></div><Button size="sm" variant="outline" disabled={busy === invoice.id} onClick={() => void review(invoice.id, "rejected")}><XCircle /> Reject</Button><Button size="sm" disabled={busy === invoice.id} onClick={() => void review(invoice.id, "approved")}><CheckCircle2 /> Approve</Button></li>)}</ul>}
  </Card>;
}
