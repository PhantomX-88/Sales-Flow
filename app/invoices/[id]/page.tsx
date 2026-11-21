import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PublicInvoiceView, type PublicInvoiceData } from "@/components/invoices/public-invoice-view";
import { getAdminClient } from "@/lib/server/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Invoice | Lakeside Tech",
  robots: { index: false, follow: false },
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getPaystackPaymentUrl() {
  const configuredUrl = process.env.PAYSTACK_PAYMENT_URL;
  if (!configuredUrl) return null;

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("PAYSTACK_PAYMENT_URL must be a valid HTTPS URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("PAYSTACK_PAYMENT_URL must be a valid HTTPS URL.");
  }
  return url.toString();
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const supabase = getAdminClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, organization_id, opportunity_id, invoice_number, description, amount, apply_vat, vat_amount, subtotal, total_amount, due_date, status, created_at")
    .eq("id", id)
    .in("status", ["approved", "sent"])
    .maybeSingle();

  if (invoiceError) throw new Error(`Could not load invoice: ${invoiceError.message}`);
  if (!invoice) notFound();

  const [organizationResult, opportunityResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, currency, bank_name, bank_account_name, bank_account_number, bank_payment_notes")
      .eq("id", invoice.organization_id)
      .maybeSingle(),
    supabase
      .from("opportunities")
      .select("company, contact, email, phone, amount_paid")
      .eq("organization_id", invoice.organization_id)
      .eq("id", invoice.opportunity_id)
      .maybeSingle(),
  ]);
  if (organizationResult.error) throw new Error(`Could not load invoice organization: ${organizationResult.error.message}`);
  if (opportunityResult.error) throw new Error(`Could not load invoice client: ${opportunityResult.error.message}`);
  if (!organizationResult.data || !opportunityResult.data) notFound();

  const invoiceSubtotal = Number(invoice.subtotal) || Number(invoice.amount);
  const applyVat = Boolean(invoice.apply_vat);
  const vatAmount = applyVat
    ? Number(invoice.vat_amount) || Math.round((invoiceSubtotal * 0.075 + Number.EPSILON) * 100) / 100
    : 0;
  const totalDue = Number(invoice.total_amount) || Number(invoice.amount);
  const amountPaid = Number(opportunityResult.data.amount_paid ?? 0);
  const balanceRemaining = Math.max(totalDue - amountPaid, 0);
  const status: PublicInvoiceData["status"] = balanceRemaining === 0
    ? "Paid in Full"
    : amountPaid > 0
      ? "Installment Plan"
      : "Approved";

  const data: PublicInvoiceData = {
    companyName: "Lakeside Tech",
    companyRegistrationNumber: process.env.INVOICE_COMPANY_RC_NUMBER ?? "",
    companyAddress: process.env.INVOICE_COMPANY_ADDRESS ?? "Lagos, Nigeria",
    companyEmail: process.env.INVOICE_COMPANY_EMAIL ?? "",
    companyPhone: process.env.INVOICE_COMPANY_PHONE ?? "",
    invoiceNumber: invoice.invoice_number,
    issueDate: invoice.created_at,
    dueDate: invoice.due_date,
    status,
    description: invoice.description,
    quantity: 1,
    unitRate: invoiceSubtotal,
    subtotal: invoiceSubtotal,
    applyVat,
    vatAmount,
    totalDue,
    amountPaid: Math.min(amountPaid, totalDue),
    balanceRemaining,
    currency: organizationResult.data.currency === "NGN" ? "NGN" : "USD",
    client: {
      company: opportunityResult.data.company ?? "",
      contact: opportunityResult.data.contact ?? "",
      email: opportunityResult.data.email ?? "",
      phone: opportunityResult.data.phone ?? "",
    },
    settlement: {
      bankName: organizationResult.data.bank_name ?? "",
      accountName: organizationResult.data.bank_account_name ?? "",
      accountNumber: organizationResult.data.bank_account_number ?? "",
      paymentInstructions: organizationResult.data.bank_payment_notes ?? "",
    },
    paystackPaymentUrl: getPaystackPaymentUrl(),
  };

  return <PublicInvoiceView invoice={data} />;
}
