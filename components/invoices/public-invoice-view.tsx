"use client";

import { ArrowUpRight, Printer } from "lucide-react";

export interface PublicInvoiceData {
  companyName: string;
  companyRegistrationNumber: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: "Approved" | "Paid in Full" | "Installment Plan";
  description: string;
  quantity: number;
  unitRate: number;
  subtotal: number;
  applyVat: boolean;
  vatAmount: number;
  totalDue: number;
  amountPaid: number;
  balanceRemaining: number;
  currency: "NGN" | "USD";
  client: {
    company: string;
    contact: string;
    email: string;
    phone: string;
  };
  settlement: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    paymentInstructions: string;
  };
  paystackPaymentUrl: string | null;
}

function formatCurrency(value: number, currency: PublicInvoiceData["currency"]) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function PublicInvoiceView({ invoice }: { invoice: PublicInvoiceData }) {
  return (
    <main className="invoice-shell min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6">
      <nav className="invoice-screen-only mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Invoice {invoice.invoiceNumber}</p>
        <div className="flex flex-wrap gap-2">
          {invoice.paystackPaymentUrl ? (
            <a
              href={invoice.paystackPaymentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
            >
              Pay Online <ArrowUpRight className="h-4 w-4" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> Print / Save PDF
          </button>
        </div>
      </nav>

      <article className="invoice-page mx-auto min-h-[270mm] w-full max-w-[210mm] rounded-xl border border-slate-200 bg-white p-7 shadow-xl sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-5 border-b-2 border-slate-900 pb-5">
          <div className="flex items-center gap-3">
            <div className="invoice-brand-mark flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold tracking-tight text-white">
              LT
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{invoice.companyName}</h1>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Corporate Sales &amp; Technology
              </p>
            </div>
          </div>
          <address className="not-italic text-right text-xs leading-5 text-slate-600">
            {invoice.companyRegistrationNumber ? <p>RC {invoice.companyRegistrationNumber}</p> : null}
            {invoice.companyAddress ? <p>{invoice.companyAddress}</p> : null}
            {invoice.companyEmail ? <p>{invoice.companyEmail}</p> : null}
            {invoice.companyPhone ? <p>{invoice.companyPhone}</p> : null}
          </address>
        </header>

        <section className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-700">
              {invoice.applyVat ? "Tax Invoice" : "Commercial Invoice"}
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight">Invoice</h2>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              invoice.status === "Paid in Full"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : invoice.status === "Installment Plan"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            {invoice.status}
          </span>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Invoice number</p>
            <p className="mt-1 text-sm font-bold tabular-nums">{invoice.invoiceNumber}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Issue date</p>
            <p className="mt-1 text-sm font-medium">{formatDate(invoice.issueDate)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Due date</p>
            <p className="mt-1 text-sm font-medium">{formatDate(invoice.dueDate)}</p>
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Billed to</h3>
          <div className="mt-2">
            <p className="text-base font-bold">{invoice.client.company}</p>
            {invoice.client.contact ? <p className="mt-0.5 text-sm text-slate-700">Attention: {invoice.client.contact}</p> : null}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {invoice.client.email ? <span>{invoice.client.email}</span> : null}
              {invoice.client.phone ? <span>{invoice.client.phone}</span> : null}
            </div>
          </div>
        </section>

        <section className="mt-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-slate-300 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th scope="col" className="py-2.5 pr-2">Description</th>
                <th scope="col" className="w-16 px-2 py-2.5 text-right">Qty</th>
                <th scope="col" className="w-32 px-2 py-2.5 text-right">Unit rate</th>
                <th scope="col" className="w-32 py-2.5 pl-2 text-right">Net amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200 align-top">
                <td className="py-3 pr-2 font-medium">{invoice.description}</td>
                <td className="px-2 py-3 text-right tabular-nums">{invoice.quantity}</td>
                <td className="px-2 py-3 text-right tabular-nums">{formatCurrency(invoice.unitRate, invoice.currency)}</td>
                <td className="py-3 pl-2 text-right font-medium tabular-nums">{formatCurrency(invoice.subtotal, invoice.currency)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mt-5 flex justify-end">
          <dl className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Subtotal</dt>
              <dd className="tabular-nums">{formatCurrency(invoice.subtotal, invoice.currency)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">VAT (7.5%)</dt>
              <dd className="tabular-nums">{formatCurrency(invoice.vatAmount, invoice.currency)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-300 pt-2 font-semibold">
              <dt>Total due</dt>
              <dd className="tabular-nums">{formatCurrency(invoice.totalDue, invoice.currency)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Amount paid</dt>
              <dd className="tabular-nums">{formatCurrency(invoice.amountPaid, invoice.currency)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-base font-bold text-slate-900">
              <dt>Balance remaining</dt>
              <dd className="tabular-nums">{formatCurrency(invoice.balanceRemaining, invoice.currency)}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Bank settlement instructions</h3>
          {invoice.settlement.bankName || invoice.settlement.accountName || invoice.settlement.accountNumber ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3">
              {invoice.settlement.bankName ? (
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">Bank</dt>
                  <dd className="mt-0.5 text-sm font-semibold">{invoice.settlement.bankName}</dd>
                </div>
              ) : null}
              {invoice.settlement.accountName ? (
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">Account name</dt>
                  <dd className="mt-0.5 text-sm font-semibold">{invoice.settlement.accountName}</dd>
                </div>
              ) : null}
              {invoice.settlement.accountNumber ? (
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-500">NUBAN account number</dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular-nums">{invoice.settlement.accountNumber}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Please contact us for bank settlement details.</p>
          )}
          {invoice.settlement.paymentInstructions ? (
            <p className="mt-3 whitespace-pre-line border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-600">
              {invoice.settlement.paymentInstructions}
            </p>
          ) : null}
        </section>

        <footer className="mt-6 border-t border-slate-200 pt-3 text-center text-[10px] leading-relaxed text-slate-500">
          <p>Thank you for your business.</p>
          <p>{invoice.companyName}{invoice.companyEmail ? ` · ${invoice.companyEmail}` : ""}{invoice.companyPhone ? ` · ${invoice.companyPhone}` : ""}</p>
        </footer>
      </article>
    </main>
  );
}
