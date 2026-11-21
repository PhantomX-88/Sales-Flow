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
import { formatCurrency, formatWhatsAppUrl } from "@/lib/utils";

const isoToday = () => new Date().toISOString().slice(0, 10);

export function DealLifecyclePanel({ opportunity }: { opportunity: Opportunity }) {
  const { organizationId, userId, membershipRole } = useAuth();
  const { currency, moveStage, recordOpportunityPayment } = usePipeline();
  const isAdmin = membershipRole === "owner";
  const [invoices, setInvoices] = React.useState<InvoiceRecord[]>([]);
  const [churn, setChurn] = React.useState<ChurnRecord[]>([]);
  const [invoiceOpen, setInvoiceOpen] = React.useState(false);
  const [churnOpen, setChurnOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  const [invoiceNumberLoading, setInvoiceNumberLoading] = React.useState(false);
  const [invoiceNumberError, setInvoiceNumberError] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState(`Sales services for ${opportunity.company}`);
  const [invoiceAmount, setInvoiceAmount] = React.useState(String(opportunity.value));
  const [applyVat, setApplyVat] = React.useState(false);
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
    if (!invoiceResult.error) setInvoices((invoiceResult.data ?? []).map((row: any) => ({ id: row.id, opportunityId: row.opportunity_id, company: opportunity.company, invoiceNumber: row.invoice_number, description: row.description, amount: Number(row.amount), applyVat: Boolean(row.apply_vat), vatAmount: Number(row.vat_amount ?? 0), subtotal: Number(row.subtotal ?? row.amount), totalAmount: Number(row.total_amount ?? row.amount), dueDate: row.due_date, notes: row.notes ?? undefined, status: row.status, createdBy: row.created_by, createdAt: row.created_at })));
    if (!churnResult.error) setChurn((churnResult.data ?? []).map((row: any) => ({ id: row.id, opportunityId: row.opportunity_id, company: opportunity.company, churnedAt: row.churned_at, outstandingAmount: Number(row.outstanding_amount), reason: row.reason, notes: row.notes ?? undefined, recordedBy: row.recorded_by })));
  }, [opportunity.company, opportunity.id, organizationId]);

  React.useEffect(() => { void reload(); }, [reload]);
  React.useEffect(() => {
    if (opportunity.stage === "Invoiced" && !invoices.some((invoice) => invoice.status !== "rejected")) setInvoiceOpen(true);
  }, [invoices, opportunity.stage]);

  React.useEffect(() => {
    setDescription(`Sales services for ${opportunity.company}`);
    setInvoiceAmount(String(opportunity.value));
    setApplyVat(false);
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

  React.useEffect(() => {
    if (!invoiceOpen || !organizationId) return;
    let active = true;
    setInvoiceNumber("");
    setInvoiceNumberError(null);
    setInvoiceNumberLoading(true);

    async function reserveInvoiceNumber() {
      try {
        const { data, error } = await getSupabaseClient().rpc("next_invoice_number", {
          target_org_id: organizationId,
        });
        if (!active) return;
        if (error) {
          setInvoiceNumberError(error.message);
        } else if (typeof data !== "string" || !data) {
          setInvoiceNumberError("The invoice number service returned an invalid number.");
        } else {
          setInvoiceNumber(data);
        }
      } catch (error) {
        if (active) {
          setInvoiceNumberError(error instanceof Error ? error.message : "The invoice number could not be generated.");
        }
      } finally {
        if (active) setInvoiceNumberLoading(false);
      }
    }

    void reserveInvoiceNumber();
    return () => {
      active = false;
    };
  }, [invoiceOpen, opportunity.id, organizationId]);

  const subtotal = Number(invoiceAmount);
  const vatAmount = applyVat && Number.isFinite(subtotal)
    ? Math.round((subtotal * 0.075 + Number.EPSILON) * 100) / 100
    : 0;
  const totalAmount = Number.isFinite(subtotal)
    ? Math.round((subtotal + vatAmount + Number.EPSILON) * 100) / 100
    : 0;

  const createInvoice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organizationId || !userId) return;
    setSaving(true);
    const status = isAdmin ? "approved" : "pending_approval";
    const { error } = await getSupabaseClient().from("invoices").insert({
      organization_id: organizationId, opportunity_id: opportunity.id, invoice_number: invoiceNumber.trim(),
      description: description.trim(), amount: totalAmount, apply_vat: applyVat, vat_amount: vatAmount,
      subtotal, total_amount: totalAmount, due_date: dueDate,
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
    const saved = await recordOpportunityPayment(opportunity.id, {
      amount,
      paymentFrequency: newBalance > 0 ? paymentFrequency : undefined,
      installmentAmount: newBalance > 0 ? Number(installmentAmount || 0) : undefined,
      nextPaymentDate: newBalance > 0 ? nextPaymentDate || undefined : undefined,
    });
    setSaving(false);
    if (!saved) return;
    setPaymentAmount("");
    toast({
      title: `Payment of ${formatCurrency(amount, currency)} recorded successfully.`,
      variant: "success",
    });
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
    const invoiceUrl = `${window.location.origin}/invoices/${invoice.id}`;
    const message = `Invoice ${invoice.invoiceNumber} for ${formatCurrency(invoice.amount, currency)} is due ${invoice.dueDate}. ${invoice.description}\n\nView your invoice: ${invoiceUrl}`;
    const target = channel === "email"
      ? `mailto:${opportunity.email ?? ""}?subject=${encodeURIComponent(`Invoice ${invoice.invoiceNumber}`)}&body=${encodeURIComponent(message)}`
      : formatWhatsAppUrl(opportunity.phone ?? "", message);
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

    <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create invoice for {opportunity.company}</DialogTitle>
          <DialogDescription>
            {isAdmin ? "Admin invoices are approved immediately." : "Your invoice will be sent to an admin for approval."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={createInvoice}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor={`invoice-number-${opportunity.id}`}>Invoice number</Label>
              <Input id={`invoice-number-${opportunity.id}`} value={invoiceNumberLoading ? "Generating..." : invoiceNumber} readOnly required />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`invoice-amount-${opportunity.id}`}>Subtotal / Base Deal Value</Label>
              <Input
                id={`invoice-amount-${opportunity.id}`}
                type="number"
                min="0.01"
                step="0.01"
                value={invoiceAmount}
                onChange={(event) => setInvoiceAmount(event.target.value)}
                required
              />
            </div>
          </div>
          {invoiceNumberError ? <p role="alert" className="text-sm text-destructive">{invoiceNumberError}</p> : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={applyVat}
              onChange={(event) => setApplyVat(event.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            Apply 7.5% VAT (Value Added Tax)
          </label>
          <dl className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatCurrency(Number.isFinite(subtotal) ? subtotal : 0, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">VAT (7.5%)</dt>
              <dd>{formatCurrency(vatAmount, currency)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-1 font-semibold">
              <dt>Total Payable</dt>
              <dd>{formatCurrency(totalAmount, currency)}</dd>
            </div>
          </dl>
          <div className="space-y-1">
            <Label htmlFor={`invoice-description-${opportunity.id}`}>Description</Label>
            <Input id={`invoice-description-${opportunity.id}`} value={description} onChange={(event) => setDescription(event.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`invoice-due-date-${opportunity.id}`}>Due date</Label>
            <Input id={`invoice-due-date-${opportunity.id}`} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`invoice-notes-${opportunity.id}`}>Notes</Label>
            <Textarea id={`invoice-notes-${opportunity.id}`} value={invoiceNotes} onChange={(event) => setInvoiceNotes(event.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || invoiceNumberLoading || !invoiceNumber || Boolean(invoiceNumberError) || !Number.isFinite(totalAmount) || totalAmount <= 0}>
              {isAdmin ? "Create approved invoice" : "Submit for approval"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={churnOpen} onOpenChange={setChurnOpen}><DialogContent><DialogHeader><DialogTitle>Record churn for {opportunity.company}</DialogTitle><DialogDescription>Capture when the client left, the outstanding balance, and context for the organization.</DialogDescription></DialogHeader><form className="space-y-3" onSubmit={recordChurn}><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Client left on</Label><Input type="date" value={churnDate} onChange={(e) => setChurnDate(e.target.value)} required /></div><div className="space-y-1"><Label>Outstanding amount</Label><Input type="number" min="0" step="0.01" value={outstanding} onChange={(e) => setOutstanding(e.target.value)} required /></div></div><div className="space-y-1"><Label>Reason</Label><Input value={churnReason} onChange={(e) => setChurnReason(e.target.value)} required /></div><div className="space-y-1"><Label>Admin notes</Label><Textarea value={churnNotes} onChange={(e) => setChurnNotes(e.target.value)} rows={3} /></div><DialogFooter><Button type="submit" disabled={saving || !churnReason.trim()}>Save churn record</Button></DialogFooter></form></DialogContent></Dialog>
  </>;
}
