"use client";

import { ArrowRight, BarChart3, KanbanSquare, ListChecks, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { FollowUpPreview, PipelinePreview } from "@/components/marketing/dashboard-preview";
import { Button } from "@/components/ui/button";

const VALUE_POINTS = [
  {
    number: "01",
    icon: KanbanSquare,
    title: "See every deal, in table or Kanban",
    body: "Switch between a sortable pipeline table and a drag-and-drop Kanban board. Spot stalled deals and overdue close dates before they slip.",
  },
  {
    number: "02",
    icon: ListChecks,
    title: "Follow-ups that don't get lost",
    body: "Log calls, meetings, and emails in seconds. Add a next step and a due date, and SalesFlow turns it into a reminder in your task list.",
  },
  {
    number: "03",
    icon: Target,
    title: "A revenue target you can watch",
    body: "Set a monthly or quarterly target in NGN or USD, track closed revenue against it, and use the weighted forecast as a planning estimate — not a promise.",
  },
] as const;

const STEPS = [
  {
    title: "Add your first deals",
    body: "Enter the opportunities you are working on now — company, value, and stage. Most teams start with their live deals, not a migration.",
  },
  {
    title: "See the pipeline and target view",
    body: "Your dashboard shows open pipeline value, progress against the revenue target, and what is closing soon.",
  },
  {
    title: "Record the next step",
    body: "After every call or meeting, log what happens next. Overdue follow-ups surface in your tasks until you close them out.",
  },
] as const;

const FAQS = [
  {
    question: "Who is SalesFlow for?",
    answer:
      "Owners and sales managers at small B2B businesses who want one place for deals, follow-ups, and revenue targets — without administering a large CRM.",
  },
  {
    question: "What does it track?",
    answer:
      "Deals from first contact to Closed Won or Lost, stage changes, activities (calls, meetings, emails, notes, follow-ups), next steps with due dates, tasks, and revenue targets.",
  },
  {
    question: "Which currencies are supported?",
    answer: "NGN and USD. Your organization chooses a single currency during setup, and every value in the workspace uses it.",
  },
  {
    question: "Can my team use it?",
    answer:
      "Yes. The owner invites teammates by email. Each team member works their own deals, activities, and personal target; the owner sees the whole organization.",
  },
  {
    question: "Can I take my data out?",
    answer: "Yes. You can export your filtered pipeline to a CSV file at any time, from the pipeline view.",
  },
] as const;

export function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isReady, organizationId, organization } = useAuth();

  // Signed-in visitors belong in the app, not on the marketing page.
  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace(organizationId && organization?.onboardingCompleted ? "/dashboard" : "/onboarding");
    }
  }, [isAuthenticated, isReady, organization?.onboardingCompleted, organizationId, router]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight" aria-label="SalesFlow home">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BarChart3 className="size-4" aria-hidden="true" />
            </span>
            SalesFlow
          </Link>
          <nav aria-label="Page sections" className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
            <a href="#product" className="hover:text-foreground">Product</a>
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-1.5">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm" className="h-9 px-3.5">
              <Link href="/signup">Create an account</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section aria-labelledby="hero-heading" className="mx-auto max-w-5xl px-4 pb-12 pt-12 sm:px-6 sm:pt-16">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-primary">Sales pipeline workspace for small B2B teams</p>
            <h1 id="hero-heading" className="mt-3 text-3xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
              Know where revenue stands—and what needs to happen next.
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-6 text-muted-foreground sm:text-base">
              Track deals, follow-ups, and revenue targets in one clear workspace. SalesFlow helps a small sales
              team spot overdue opportunities and stay focused on the next step.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-11 px-6">
                <Link href="/signup">
                  Create an account
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 px-6">
                <Link href="/login">Log in</Link>
              </Button>
            </div>
            <p className="mt-4 text-[13px] text-muted-foreground">
              NGN and USD workspaces · Invite your team by email
            </p>
          </div>

          <div className="mt-10">
            <PipelinePreview />
          </div>
        </section>

        {/* ── Value points ─────────────────────────────────────── */}
        <section id="product" aria-labelledby="product-heading" className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 id="product-heading" className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
              One workspace for the three things that move revenue
            </h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-10">
              {VALUE_POINTS.map((point) => (
                <div key={point.number} className="border-t-2 border-primary/80 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-primary">{point.number}</span>
                    <point.icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <h3 className="mt-3 text-[17px] font-semibold leading-snug tracking-tight">{point.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{point.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section id="how-it-works" aria-labelledby="steps-heading" className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 id="steps-heading" className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
              From first deal to daily routine
            </h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-10">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <p className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden="true">
                    {index + 1}
                  </p>
                  <h3 className="mt-3 text-[17px] font-semibold leading-snug tracking-tight">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Product proof ────────────────────────────────────── */}
        <section aria-labelledby="proof-heading" className="border-t border-border">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="max-w-2xl">
              <h2 id="proof-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
                The next step is part of the deal record
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-[15px]">
                Activities carry a next step and a due date, so follow-ups become reminders automatically — and your
                personal target updates as deals close.
              </p>
            </div>
            <div className="mt-8">
              <FollowUpPreview />
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section id="faq" aria-labelledby="faq-heading" className="border-t border-border bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 id="faq-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">Questions, answered plainly</h2>
            <dl className="mt-8 divide-y divide-border">
              {FAQS.map((faq) => (
                <div key={faq.question} className="py-5 first:pt-0">
                  <dt className="text-[15px] font-semibold tracking-tight">{faq.question}</dt>
                  <dd className="mt-1.5 text-sm leading-6 text-muted-foreground">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        <section aria-labelledby="cta-heading" className="border-t border-border">
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-16">
            <h2 id="cta-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              See your pipeline clearly — starting today
            </h2>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="h-11 px-6">
                <Link href="/signup">Create an account</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-11 px-6">
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <BarChart3 className="size-3.5" aria-hidden="true" />
              </span>
              SalesFlow
            </p>
            <p className="mt-2 max-w-xs text-2xs leading-5 text-muted-foreground">
              Pipeline, follow-ups, and revenue targets for small B2B sales teams.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="#product" className="hover:text-foreground">Product</a>
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
            <Link href="/login" className="hover:text-foreground">Log in</Link>
            <Link href="/signup" className="font-medium text-primary hover:underline">Create an account</Link>
          </nav>
        </div>
        <div className="mx-auto max-w-5xl border-t border-border px-4 py-4 sm:px-6">
          {/* TODO(product owner): add Privacy (/privacy) and Terms (/terms) pages,
              plus a contact email, then render the links here. No policy text
              exists yet, so no links are shown on purpose. */}
          <p className="text-2xs text-muted-foreground">© 2026 SalesFlow.</p>
        </div>
      </footer>
    </div>
  );
}
