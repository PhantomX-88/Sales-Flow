import type { Metadata } from "next";

import { LegalPageLayout } from "@/components/marketing/legal-page-layout";

export const metadata: Metadata = {
  title: "Terms of Service | SalesFlow",
  description: "Read the draft terms for using the SalesFlow sales pipeline workspace.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={title.toLowerCase().replaceAll(" ", "-")} className="space-y-3">
      <h2 id={title.toLowerCase().replaceAll(" ", "-")} className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      description="These draft terms describe the basic rules for accessing and using the SalesFlow sales pipeline workspace."
    >
      <Section title="Agreement and provider">
        <p>
          These terms are between you and <strong className="text-foreground">[insert legal entity name and business address]</strong>, the operator of SalesFlow ("SalesFlow," "we," "us"). By creating an account or using the service, you agree to these terms. If you use SalesFlow for an organization, you confirm that you are authorized to accept these terms for it.
        </p>
      </Section>

      <Section title="Accounts and workspaces">
        <p>Provide accurate account information, keep your sign-in credentials secure, and promptly tell us if you believe an account has been accessed without permission. You are responsible for activity carried out through your account.</p>
        <p>Workspace owners manage membership and roles. Owners must invite only people who should access the organization’s information and remove access when it is no longer needed. Members must use the service in accordance with their organization’s instructions.</p>
      </Section>

      <Section title="Your information and permissions">
        <p>You retain your rights in the information you submit. You give SalesFlow permission to host, process, display, back up, and transmit that information as reasonably necessary to provide, secure, and support the service.</p>
        <p>You are responsible for having the rights and lawful authority to enter personal or business information into your workspace, including contact details and sales notes. Do not submit passwords, payment-card details, sensitive personal information, or information you are not authorized to use.</p>
      </Section>

      <Section title="Acceptable use">
        <p>You may not use SalesFlow to break the law, violate another person’s rights, send unauthorized or deceptive communications, attempt to access another organization’s workspace, interfere with service security, or upload malicious code.</p>
        <p>Do not probe, scrape, reverse engineer, or overload the service except where applicable law permits or we have given written permission.</p>
      </Section>

      <Section title="Service and third-party providers">
        <p>SalesFlow depends on third-party services for application hosting, authentication, database, and invitation email delivery. Their availability and terms may affect the service. We may change service features to maintain or improve SalesFlow, and we will use reasonable efforts to avoid disrupting core functionality.</p>
        <p>You are responsible for keeping independent copies of information that is important to your business. CSV export is available for opportunity records; it may not include every record or setting in a workspace.</p>
      </Section>

      <Section title="Sales information and forecasts">
        <p>Pipeline metrics, reminders, and forecasts depend on the information entered by workspace members and the calculations shown in the service. Forecasts are planning estimates only. SalesFlow does not guarantee deal outcomes, revenue, or business performance and does not provide legal, financial, tax, or investment advice.</p>
      </Section>

      <Section title="Suspension and ending use">
        <p>You may stop using the service at any time. We may suspend or restrict access when reasonably necessary to address security risks, unlawful use, material breach of these terms, or harm to users or the service. Where practical, we will give notice and an opportunity to resolve the issue.</p>
        <p>Before ending a workspace, its owner should export any records they need. The operator must confirm how account closure, workspace deletion, backups, and retained legal records will be handled before these terms are final.</p>
      </Section>

      <Section title="Disclaimers and liability">
        <p>To the extent permitted by law, SalesFlow is provided on an “as available” basis. We do not promise uninterrupted or error-free operation. Nothing in these terms limits a right or remedy that cannot legally be limited.</p>
        <p>Where local law requires a specific warranty or liability rule, that rule applies. Any additional customer-specific terms should be agreed in a separate written agreement.</p>
      </Section>

      <Section title="Changes, governing law, and contact">
        <p>We may revise these terms as the service changes. We will update the date on this page and provide notice of material changes where appropriate.</p>
        <p>These terms are governed by the laws of <strong className="text-foreground">[insert governing jurisdiction]</strong>, and disputes will be handled by the courts of <strong className="text-foreground">[insert venue]</strong>, subject to any mandatory rights that apply to you.</p>
        <p>Questions about these terms: <strong className="text-foreground">[insert verified legal contact email and postal address]</strong>.</p>
      </Section>
    </LegalPageLayout>
  );
}
