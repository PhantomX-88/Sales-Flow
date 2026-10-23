import Link from "next/link";
import type { ReactNode } from "react";

interface LegalPageLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function LegalPageLayout({ title, description, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">SalesFlow</Link>
          <nav aria-label="Main navigation" className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/login" className="hover:text-foreground">Log in</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/" className="text-sm font-medium text-primary hover:underline">Back to SalesFlow</Link>
        <div className="mt-7 border-b border-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">SalesFlow policies</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          <p className="mt-4 text-xs text-muted-foreground">Draft for review | Last updated October 23, 2026</p>
        </div>

        <aside className="mt-6 rounded-lg border border-amber-300/70 bg-amber-50/70 p-4 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          This policy draft needs the operator's legal name, contact details, governing jurisdiction, and confirmed data-retention practices before it is final.
        </aside>

        <article className="legal-copy mt-8 space-y-8">{children}</article>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <span>Copyright 2026 SalesFlow</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
