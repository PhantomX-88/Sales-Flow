"use client";

import * as React from "react";
import { CheckCircle2, FileText, Mail, MessageCircle, Plus, TrendingDown } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { getSupabaseClient } from "@/lib/supabase";
import type { ChurnRecord, InvoiceRecord, Opportunity } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const isoToday = () => new Date().toISOString().slice(0, 10);

export function DealLifecyclePanel({ opportunity }: { opportunity: Opportunity }) {
  const { organizationId, userId, membershipRole } = useAuth();
  const { currency, moveStage } = usePipeline();
  const isAdmin = membershipRole === "owner";
  const [invoices, setInvoices] = React.useState<InvoiceRecord[]>([]);
  const [churn, setChurn] = React.useState<ChurnRecord[]>([]);
  const [invoiceOpen, setInvoiceOpen] = React.useState(false);
  const [churnOpen, setChurnOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [invoiceNumber, setInvoiceNumber] = React.useState(`INV-${Date.now().toString().slice(-6)}`);
  const [description, setDescription] = React.useState(`Sales services for ${opportunity.company}`);
  const [invoiceAmount, setInvoiceAmount] = React.useState(String(opportunity.value));
  const [dueDate, setDueDate] = React.useState(isoToday());
  const [invoiceNotes, setInvoiceNotes] = React.useState("");
  const [paymentAmount, setPaymentAmount] = React.useState("");
  const [paymentFrequency, setPaymentFrequency] = React.useState<NonNullable<Opportunity["paymentFrequency"]>>(opportunity.paymentFrequency ?? "monthly");
  const [installmentAmount, setInstallmentAmount] = React.useState(opportunity.installmentAmount ? String(opportunity.installmentAmount) : "");
  const [nextPaymentDate, setNextPaymentDate] = React.useState(opportunity.nextPaymentDate ?? "");
  const [churnDate, setChurnDate] = React.useState(isoToday());
  const [outstanding, setOutstanding] = React.useState(String(Math.max(opportunity.value - (opportunity.amountPaid ?? 0), 0)));
  const [churnReason, setChurnReason] = React.useState("");
  const [churnNotes, setChurnNotes] = React.useState("");

  const reload = React.useCallback(async () => {
    if (!organizationId) return;
    const supabase = getSupabaseClient();
    const [invoiceResult, churnResult] = await Promise.all([
      supabase.from("invoices").select("*").eq("organization_id", organizationId).eq("opportunity_id", opportunity.id).order("created_at", { ascending: false }),
      supabase.from("churn_records").select("*").eq("organization_id", organizationId).eq("opportunity_id", opportunity.id).order("churned_at", { ascending: false }),
    ]);
    if (!invoiceResult.error) setInvoices((invoiceResult.data ?? []).map((row: any) => ({ id: row.id, opportunityId: row.opportunity_id, company: opportunity.company, invoiceNumber: row.invoice_number, description: row.description, amount: Number(row.amount), dueDate: row.due_date, notes: row.notes ?? undefined, status: row.status, createdBy: row.created_by, createdAt: row.created_at })));
    if (!churnResult.error) setChurn((churnResult.data ?? []).map((row: any) => ({ id: row.id, opportunityId: row.opportunity_id, company: opportunity.company, churnedAt: row.churned_at, outstandingAmount: Number(row.outstanding_amount), reason: row.reason, notes: row.notes ?? undefined, recordedBy: row.recorded_by })));
  }, [opportunity.company, opportunity.id, organizationId]);

  React.useEffect(() => { void reload(); }, [reload]);
  React.useEffect(() => {
    if (opportunity.stage === "Invoiced" && !invoices.some((invoice) => invoice.status !== "rejected")) setInvoiceOpen(true);
  }, [invoices, opportunity.stage]);

  React.useEffect(() => {
    setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
    setDescription(`Sales services for ${opportunity.company}`);
    setInvoiceAmount(String(opportunity.value));
    setDueDate(isoToday());
    setInvoiceNotes("");
    setPaymentAmount("");
    setPaymentFrequency(opportunity.paymentFrequency ?? "monthly");
    setInstallmentAmount(opportunity.installmentAmount ? String(opportunity.installmentAmount) : "");
    setNextPaymentDate(opportunity.nextPaymentDate ?? "");
    setChurnDate(isoToday());
    setOutstanding(String(Math.max(opportunity.value - (opportunity.amountPaid ?? 0), 0)));
    setChurnReason("");
    setChurnNotes("");
  }, [opportunity]);

  const createInvoice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organizationId || !userId) return;
    setSaving(true);
    const status = isAdmin ? "approved" : "pending_approval";
    const { error } = await getSupabaseClient().from("invoices").insert({
      organization_id: organizationId, opportunity_id: opportunity.id, invoice_number: invoiceNumber.trim(),
      description: description.trim(), amount: Number(invoiceAmount), due_date: dueDate,
      notes: invoiceNotes.trim() || null, status, created_by: userId,
    });
    setSaving(false);
    if (error) { toast({ title: "Invoice could not be saved.", description: error.message, variant: "destructive" }); return; }
    setInvoiceOpen(false);
    await reload();
    if (opportunity.stage !== "Invoiced") void moveStage(opportunity.id, "Invoiced");
  };

  const recordPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organizationId || !paymentAmount) return;
    const amount = Number(paymentAmount);
    const newBalance = opportunity.value - ((opportunity.amountPaid ?? 0) + amount);
    if (!Number.isFinite(amount) || amount <= 0 || newBalance < 0 || (newBalance > 0 && (!installmentAmount || !nextPaymentDate))) return;
    setSaving(true);
    const paid = (opportunity.amountPaid ?? 0) + amount;
    const { error } = await getSupabaseClient().from("opportunities").update({
      amount_paid: paid,
      payment_frequency: paid < opportunity.value ? paymentFrequency : null,
      installment_amount: paid < opportunity.value ? Number(installmentAmount || 0) : null,
      next_payment_date: paid < opportunity.value ? nextPaymentDate || null : null,
    }).eq("organization_id", organizationId).eq("id", opportunity.id);
    setSaving(false);
    if (error) { toast({ title: "Payment could not be saved.", description: error.message, variant: "destructive" }); return; }
    window.location.reload();
  };

  const recordChurn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organizationId || !userId || !churnReason.trim()) return;
    setSaving(true);
    const { error } = await getSupabaseClient().from("churn_records").insert({
      organization_id: organizationId, opportunity_id: opportunity.id, churned_at: churnDate,
      outstanding_amount: Number(outstanding || 0), reason: churnReason.trim(), notes: churnNotes.trim() || null,
      recorded_by: userId,
    });
    setSaving(false);
    if (error) { toast({ title: "Churn could not be recorded.", description: error.message, variant: "destructive" }); return; }
    setChurnOpen(false);
    if (opportunity.stage !== "Closed Won" && opportunity.stage !== "Closed Lost") void moveStage(opportunity.id, "Closed Lost");
    await reload();
  };

  const sendInvoice = async (invoice: InvoiceRecord, channel: "email" | "whatsapp") => {
    const message = `Invoice ${invoice.invoiceNumber} for ${formatCurrency(invoice.amount, currency)} is due ${invoice.dueDate}. ${invoice.description}`;
    const target = channel === "email"
      ? `mailto:${opportunity.email ?? ""}?subject=${encodeURIComponent(`Invoice ${invoice.invoiceNumber}`)}&body=${encodeURIComponent(message)}`
      : `https://wa.me/${(opportunity.phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    window.open(target, "_blank", "noopener,noreferrer");
    const { data: wasMarkedSent, error } = await getSupabaseClient().rpc("mark_invoice_sent", { target_invoice_id: invoice.id });
    if (!error && wasMarkedSent) {
      toast({ title: "Invoice handoff opened.", description: `The ${channel === "email" ? "email" : "WhatsApp"} composer is ready. Complete sending in that app.`, variant: "success" });
      await reload();
    } else {
      toast({ title: "Invoice status could not be updated.", description: error?.message ?? "Only the invoice creator can mark it as sent.", variant: "destructive" });
    }
  };

  return <>
    <section className="space-y-3" aria-labelledby="deal-lifecycle">
      <div className="flex items-center justify-between gap-2"><h3 id="deal-lifecycle" className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Payments and invoices</h3>
        <Button size="sm" variant="outline" onClick={() => setInvoiceOpen(true)}><Plus className="h-3.5 w-3.5" /> Create invoice</Button>
      </div>
      {opportunity.stage === "Closed Won" ? <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">{formatCurrency(opportunity.amountPaid ?? 0, currency)} received</p><p className="text-xs text-muted-foreground">of {formatCurrency(opportunity.value, currency)} deal value · {formatCurrency(Math.max(opportunity.value - (opportunity.amountPaid ?? 0), 0), currency)} outstanding</p></div><Badge variant={(opportunity.amountPaid ?? 0) >= opportunity.value ? "success" : "secondary"}>{(opportunity.amountPaid ?? 0) >= opportunity.value ? "Paid in full" : "Payment plan"}</Badge></div>
        {(opportunity.amountPaid ?? 0) < opportunity.value ? <form className="space-y-3 border-t border-border pt-3" onSubmit={recordPayment}>
          <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label htmlFor={`payment-${opportunity.id}`}>Payment received</Label><Input id={`payment-${opportunity.id}`} type="number" min="0.01" step="0.01" max={opportunity.value - (opportunity.amountPaid ?? 0)} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required /></div>
          <div className="space-y-1"><Label htmlFor={`frequency-${opportunity.id}`}>Schedule</Label><select id={`frequency-${opportunity.id}`} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={paymentFrequency} onChange={(e) => setPaymentFrequency(e.target.value as NonNullable<Opportunity["paymentFrequency"]>)}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="triannual">Three times a year</option><option value="biannual">Twice a year</option></select></div></div>
          <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label htmlFor={`installment-${opportunity.id}`}>Installment amount</Label><Input id={`installment-${opportunity.id}`} type="number" min="0.01" max={opportunity.value - (opportunity.amountPaid ?? 0) - Number(paymentAmount || 0)} step="0.01" value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} required={Number(paymentAmount || 0) + (opportunity.amountPaid ?? 0) < opportunity.value} /></div><div className="space-y-1"><Label htmlFor={`next-payment-${opportunity.id}`}>Next payment date</Label><Input id={`next-payment-${opportunity.id}`} type="date" value={nextPaymentDate} onChange={(e) => setNextPaymentDate(e.target.value)} required={Number(paymentAmount || 0) + (opportunity.amountPaid ?? 0) < opportunity.value} /></div></div>
          <Button size="sm" type="submit" disabled={saving || !paymentAmount}><CheckCircle2 /> Record payment</Button>
        </form> : null}
      </Card> : null}
      {invoices.length ? <div className="space-y-2">{invoices.map((invoice) => <Card key={invoice.id} className="flex flex-wrap items-center gap-3 p-3"><FileText className="h-4 w-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{invoice.invoiceNumber} · {formatCurrency(invoice.amount, currency)}</p><p className="text-xs text-muted-foreground">Due {invoice.dueDate} · {invoice.description}</p></div><Badge variant={invoice.status === "approved" || invoice.status === "sent" ? "success" : "secondary"}>{invoice.status.replace("_", " ")}</Badge>
        {invoice.status === "approved" ? <div className="flex gap-1"><Button size="icon-sm" variant="ghost" aria-label="Send invoice by email" disabled={!opportunity.email} onClick={() => void sendInvoice(invoice, "email")}><Mail /></Button><Button size="icon-sm" variant="ghost" aria-label="Send invoice by WhatsApp" disabled={!opportunity.phone} onClick={() => void sendInvoice(invoice, "whatsapp")}><MessageCircle /></Button></div> : null}</Card>)}</div> : <p className="text-xs text-muted-foreground">No invoices recorded for this deal.</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"><div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Churn records: {churn.length}</span></div><Button size="sm" variant="outline" onClick={() => setChurnOpen(true)}>Record churn</Button></div>
      {churn.map((record) => <Card key={record.id} className="space-y-1 p-3"><p className="text-sm font-medium">Left {record.churnedAt} · {record.reason}</p><p className="text-xs text-muted-foreground">Outstanding {formatCurrency(record.outstandingAmount, currency)}{record.notes ? ` · ${record.notes}` : ""}</p></Card>)}
    </section>

    <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}><DialogContent><DialogHeader><DialogTitle>Create invoice for {opportunity.company}</DialogTitle><DialogDescription>{isAdmin ? "Admin invoices are approved immediately." : "Your invoice will be sent to an admin for approval."}</DialogDescription></DialogHeader><form className="space-y-3" onSubmit={createInvoice}><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Invoice number</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required /></div><div className="space-y-1"><Label>Amount</Label><Input type="number" min="0.01" step="0.01" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} required /></div></div><div className="space-y-1"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} required /></div><div className="space-y-1"><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></div><div className="space-y-1"><Label>Notes</Label><Textarea value={invoiceNotes} onChange={(e) => setInvoiceNotes(e.target.value)} rows={2} /></div><DialogFooter><Button type="submit" disabled={saving}>{isAdmin ? "Create approved invoice" : "Submit for approval"}</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={churnOpen} onOpenChange={setChurnOpen}><DialogContent><DialogHeader><DialogTitle>Record churn for {opportunity.company}</DialogTitle><DialogDescription>Capture when the client left, the outstanding balance, and context for the organization.</DialogDescription></DialogHeader><form className="space-y-3" onSubmit={recordChurn}><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Client left on</Label><Input type="date" value={churnDate} onChange={(e) => setChurnDate(e.target.value)} required /></div><div className="space-y-1"><Label>Outstanding amount</Label><Input type="number" min="0" step="0.01" value={outstanding} onChange={(e) => setOutstanding(e.target.value)} required /></div></div><div className="space-y-1"><Label>Reason</Label><Input value={churnReason} onChange={(e) => setChurnReason(e.target.value)} required /></div><div className="space-y-1"><Label>Admin notes</Label><Textarea value={churnNotes} onChange={(e) => setChurnNotes(e.target.value)} rows={3} /></div><DialogFooter><Button type="submit" disabled={saving || !churnReason.trim()}>Save churn record</Button></DialogFooter></form></DialogContent></Dialog>
  </>;
}
