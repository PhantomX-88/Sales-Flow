"use client";

import * as React from "react";
import { Building2, CircleCheck, Clock3, Mail, Phone, Plus, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { OwnerAvatar } from "@/components/dashboard/owner-avatar";
import { PageHeader } from "@/components/dashboard/page-header";
import { usePipeline } from "@/components/dashboard/pipeline-provider";
import { StageBadge } from "@/components/dashboard/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CentralCTA } from "@/components/dashboard/central-cta";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountRecord, AccountSummary, ContactRecord } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const HEALTH_META: Record<
  AccountSummary["health"],
  { label: string; variant: "success" | "warning" | "danger"; icon: typeof CircleCheck }
> = {
  healthy: { label: "Healthy", variant: "success", icon: CircleCheck },
  attention: { label: "Needs attention", variant: "warning", icon: Clock3 },
  "at-risk": { label: "At risk", variant: "danger", icon: TriangleAlert },
};

/** A real account record merged with its (optional) legacy deal rollup. */
interface AccountEntry {
  key: string;
  name: string;
  record: AccountRecord | null;
  summary: AccountSummary | null;
  contacts: ContactRecord[];
}

function ContactEditor({
  contact,
  onClose,
}: {
  contact: ContactRecord | null;
  onClose: () => void;
}) {
  const { updateContact } = usePipeline();
  const [draft, setDraft] = React.useState({
    fullName: contact?.fullName ?? "",
    title: contact?.title ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setDraft({
      fullName: contact?.fullName ?? "",
      title: contact?.title ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
    });
  }, [contact]);

  if (!contact) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit contact</DialogTitle>
          <DialogDescription>
            Changes apply to this contact record everywhere — deals that reference it stay intact.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">Full name</Label>
            <Input
              id="contact-name"
              value={draft.fullName}
              onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-title">Title</Label>
            <Input
              id="contact-title"
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Procurement manager"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={draft.email}
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-phone">Phone</Label>
            <Input
              id="contact-phone"
              type="tel"
              value={draft.phone}
              onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={saving || !draft.fullName.trim()}
            onClick={async () => {
              setSaving(true);
              const saved = await updateContact(contact.id, {
                fullName: draft.fullName.trim(),
                title: draft.title.trim() || undefined,
                email: draft.email.trim() || undefined,
                phone: draft.phone.trim() || undefined,
              });
              setSaving(false);
              if (saved) onClose();
            }}
          >
            {saving ? "Saving..." : "Save contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function AccountCard({
  entry,
  onEditContact,
}: {
  entry: AccountEntry;
  onEditContact: (contact: ContactRecord) => void;
}) {
  const { openOpportunity, currency } = usePipeline();
  const summary = entry.summary;
  const health = HEALTH_META[summary?.health ?? "healthy"];
  const HealthIcon = health.icon;

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{entry.name}</h3>
            <p className="truncate text-2xs text-muted-foreground">
              {entry.record?.website || (summary ? `Owner · ${summary.owner}` : "Company record")}
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
          <p className="mt-0.5 text-sm font-semibold tabular">
            {formatCurrency(summary?.openValue ?? 0, currency)}
          </p>
        </div>
        <div>
          <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            Won value
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular on-success">
            {formatCurrency(summary?.wonValue ?? 0, currency)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {summary ? <StageBadge stage={summary.primaryStage} /> : null}
        <span className="text-2xs text-muted-foreground">
          {summary
            ? `${summary.opportunityCount} ${summary.opportunityCount === 1 ? "deal" : "deals"}`
            : "No deals yet"}
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Contacts</p>
        {entry.contacts.length ? (
          <ul className="space-y-1">
            {entry.contacts.map((contact) => (
              <li key={contact.id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
                  <span className="truncate">{contact.fullName}</span>
                  {contact.email ? <Mail className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
                  {contact.phone ? <Phone className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
                </span>
                <button
                  type="button"
                  onClick={() => onEditContact(contact)}
                  className="shrink-0 text-2xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  Edit
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-2xs text-muted-foreground">
            {summary ? summary.contact : "Add a deal to attach contacts."}
          </p>
        )}
      </div>

      {summary ? (
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <OwnerAvatar name={summary.owner} size="sm" className="h-5 w-5 text-[9px]" />
            Last activity {summary.lastActivity.toLowerCase()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-2xs"
            onClick={() => openOpportunity(summary.opportunityId)}
          >
            View deal
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export function AccountsView() {
  const {
    accounts,
    accountRecords,
    contactRecords,
    searchQuery,
    isLoading,
    loadError,
    recordsLoadError,
    openCreateDialog,
    openImportDialog,
  } = usePipeline();
  const [editingContact, setEditingContact] = React.useState<ContactRecord | null>(null);

  const entries = React.useMemo<AccountEntry[]>(() => {
    const byKey = new Map<string, AccountEntry>();
    for (const record of accountRecords) {
      const key = record.name.trim().toLowerCase();
      byKey.set(key, {
        key,
        name: record.name,
        record,
        summary: null,
        contacts: contactRecords.filter((contact) => contact.accountId === record.id),
      });
    }
    for (const summary of accounts) {
      const key = summary.company.trim().toLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        existing.summary = summary;
      } else {
        byKey.set(key, { key, name: summary.company, record: null, summary, contacts: [] });
      }
    }
    return [...byKey.values()].sort(
      (a, b) =>
        (b.summary?.openValue ?? 0) +
        (b.summary?.wonValue ?? 0) -
        ((a.summary?.openValue ?? 0) + (a.summary?.wonValue ?? 0)),
    );
  }, [accountRecords, accounts, contactRecords]);

  const filtered = React.useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((entry) =>
      [entry.name, entry.summary?.owner ?? "", entry.summary?.contact ?? ""].some((field) =>
        field.toLowerCase().includes(term),
      ),
    );
  }, [entries, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Accounts"
          description="Reusable company and contact records linked to your deals."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-56 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      </div>
    );
  }

  if (loadError || recordsLoadError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Accounts"
          description="Reusable company and contact records linked to your deals."
        />
        <Card>
          <EmptyState
            title="Accounts could not load"
            description={recordsLoadError ?? loadError ?? "Try reloading the workspace."}
            actionLabel="Reload"
            onAction={() => window.location.reload()}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Company and contact records you can reuse across deals. Legacy deals without records still appear here."
      />

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={Plus}
            title="No accounts yet"
            description="Accounts and contacts are created automatically when you add a deal, import a CSV, or type a company name that does not exist yet."
            actionLabel="Add a deal"
            onAction={openCreateDialog}
            secondaryActionLabel="Import CSV"
            onSecondaryAction={openImportDialog}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title="No accounts found"
            description="No company matches your current search. Clear the search to see the full account list."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry) => (
            <AccountCard key={entry.key} entry={entry} onEditContact={setEditingContact} />
          ))}
        </div>
      )}

      <ContactEditor contact={editingContact} onClose={() => setEditingContact(null)} />
    </div>
  );
}
