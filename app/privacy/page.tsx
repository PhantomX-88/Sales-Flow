import type { Metadata } from "next";

import { LegalPageLayout } from "@/components/marketing/legal-page-layout";

export const metadata: Metadata = {
  title: "Privacy Policy | SalesFlow",
  description: "Learn what information SalesFlow handles, why it is used, and the choices available to you.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={title.toLowerCase().replaceAll(" ", "-")} className="space-y-3">
      <h2 id={title.toLowerCase().replaceAll(" ", "-")} className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description="This notice explains how SalesFlow handles account and workspace information when you visit or use the service."
    >
      <Section title="Who is responsible">
        <p>
          SalesFlow is operated by <strong className="text-foreground">[insert legal entity name and business address]</strong> ("SalesFlow," "we," "us"). Add the operator’s verified identity and privacy contact before treating this draft as final.
        </p>
        <p>
          For account and service administration, the operator determines how account information is used. For customer, prospect, opportunity, and activity details entered by a workspace, that workspace’s organization generally decides why the information is used; SalesFlow processes it to provide the workspace service.
        </p>
      </Section>

      <Section title="Information handled">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-foreground">Account and organization details:</strong> name, email address, login credentials handled by the authentication provider, organization name, industry, country, team settings, and targets.</li>
          <li><strong className="text-foreground">Workspace records:</strong> opportunity and company details, contact names and business contact information, deal values and stages, notes, activities, next steps, due dates, and team assignments.</li>
          <li><strong className="text-foreground">Invitation details:</strong> invitee email and name, inviter, invitation status, expiry, and security token hashes. Invitation links contain a temporary token; only its hash is stored for validation.</li>
          <li><strong className="text-foreground">Service and device information:</strong> information necessary to deliver and secure requests may be processed by the hosting, database, authentication, and email providers. Confirm provider log and retention settings before final publication.</li>
        </ul>
      </Section>

      <Section title="How information is used">
        <p>We use information to create and secure accounts, operate organization workspaces, display sales pipeline and follow-up information, deliver team invitations, respond to support requests, prevent misuse, maintain the service, and meet legal obligations.</p>
        <p>SalesFlow uses a weighted forecast as a planning estimate. It is not a promise of revenue or a substitute for professional financial advice.</p>
      </Section>

      <Section title="Legal grounds for processing">
        <p>The legal grounds for account administration, service delivery, security, and organization-managed customer records depend on the operator’s location and the customer relationship. The operator must identify the applicable legal basis for each purpose under the laws that apply before this draft is final. Where an organization controls customer or prospect records, that organization is responsible for identifying and communicating its legal basis.</p>
      </Section>

      <Section title="Browser storage">
        <p>The app uses browser storage for essential sign-in session persistence, your display theme, and your local reminder-snooze preferences. The current app code does not include an advertising pixel or third-party analytics SDK. Hosting and authentication providers may use their own necessary technologies as described in their notices.</p>
      </Section>

      <Section title="Workspace access and sharing">
        <p>Workspace information is available to authorized members of the relevant organization according to their roles and the access controls configured for the service. Organization owners are responsible for inviting the right people and managing their access.</p>
        <p>To operate SalesFlow, information is handled by infrastructure providers, including Supabase for authentication and database services, Vercel for application hosting, and Resend for invitation email delivery. Each provider handles information under its applicable service terms and configuration.</p>
        <p>We may disclose information when required by law, to protect the service and its users, or as part of a business transfer. This draft does not describe a complete list of subprocessors; the operator should confirm and publish that list before launch.</p>
      </Section>

      <Section title="Retention">
        <p>Workspace records are retained while needed to provide the service and according to the organization’s instructions, subject to applicable legal and security needs. The service currently does not offer a self-service workspace deletion or category-by-category retention control. The operator must confirm the actual backup, log, and account-deletion schedule before this notice is final.</p>
        <p>Invitation links are time-limited. Pending invitations expire after seven days, and revoked or accepted invitations cannot be used again.</p>
      </Section>

      <Section title="Your choices and rights">
        <p>You can review or correct workspace records through the service when the relevant controls are available, or ask your organization’s owner to help. Depending on your location and relationship with the organization, you may have rights to access, correct, delete, restrict, object to, or receive a copy of personal information. Send requests to <strong className="text-foreground">[insert verified privacy contact email]</strong> and identify the organization whose workspace is involved.</p>
        <p>Where your organization controls the information, it may need to respond to your request. You may also have the right to complain to the privacy regulator in your jurisdiction.</p>
      </Section>

      <Section title="Security and international processing">
        <p>SalesFlow uses authentication, organization-scoped access controls, and database policies as part of its security design. No online service can guarantee absolute security. The operator should confirm the active provider regions, transfer safeguards, incident process, and retention settings before publication.</p>
      </Section>

      <Section title="Changes and contact">
        <p>We may update this notice as the service changes. The revised date will appear at the top of this page. Material changes should be communicated to workspace owners through an appropriate channel.</p>
        <p>Privacy contact: <strong className="text-foreground">[insert verified privacy contact email and postal address]</strong>.</p>
      </Section>
    </LegalPageLayout>
  );
}
