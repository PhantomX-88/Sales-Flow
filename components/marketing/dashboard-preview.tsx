import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, formatCurrency, formatCurrencyCompact } from "@/lib/utils";

/**
 * Marketing-only recreations of real SalesFlow surfaces (pipeline table,
 * follow-up timeline, target card). Every figure is fictional SAMPLE data —
 * each preview carries a visible "Sample data" badge and a caption. Values
 * use the app's own NGN formatting. Presentational only: no hooks, no data
 * fetching, no dependencies beyond the existing design system.
 */

const STAGE_STYLES: Record<string, string> = {
  Discovery: "bg-sky-50 text-sky-700 border-sky-200",
  Qualified: "bg-violet-50 text-violet-700 border-violet-200",
  Proposal: "bg-blue-50 text-blue-700 border-blue-200",
  Negotiation: "bg-amber-50 text-amber-700 border-amber-200",
  "Closed Won": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function StageTag({ stage }: { stage: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium",
        STAGE_STYLES[stage] ?? "border-border bg-secondary text-secondary-foreground",
      )}
    >
      {stage}
    </span>
  );
}

const SAMPLE_DEALS = [
  { company: "Lagos Water Solutions", stage: "Negotiation", value: 12_000_000, owner: "B. Adeyemi", next: "Confirm delivery date", overdue: false },
  { company: "Zenith Foods Ltd", stage: "Proposal", value: 8_500_000, owner: "A. Okafor", next: "Send revised quote", overdue: false },
  { company: "Kano Steel Works", stage: "Qualified", value: 6_200_000, owner: "A. Okafor", next: "Book site visit", overdue: false },
  { company: "Abuja Print Hub", stage: "Discovery", value: 3_400_000, owner: "C. Eze", next: "Follow-up overdue by 3 days", overdue: true },
  { company: "Ibadan Agro Mills", stage: "Closed Won", value: 9_000_000, owner: "B. Adeyemi", next: "—", overdue: false },
];

/**
 * Hero preview: KPI strip + pipeline table, mirroring the real dashboard's
 * numbers (open ₦30.1M, weighted ₦19.9M, 68% of a ₦50M quarterly target).
 */
export function PipelinePreview() {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="text-xs font-semibold tracking-tight">Pipeline · this quarter</p>
        <Badge variant="outline" className="text-2xs">Sample data</Badge>
      </div>

      <div className="space-y-4 p-4">
        <dl className="grid grid-cols-3 gap-3">
          <Card className="p-3">
            <dt className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Open pipeline</dt>
            <dd className="mt-1 text-[15px] font-bold tabular sm:text-lg">{formatCurrencyCompact(30_100_000, "NGN")}</dd>
            <dd className="text-2xs text-muted-foreground">4 open deals</dd>
          </Card>
          <Card className="p-3">
            <dt className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Weighted</dt>
            <dd className="mt-1 text-[15px] font-bold tabular sm:text-lg">{formatCurrencyCompact(19_910_000, "NGN")}</dd>
            <dd className="text-2xs text-muted-foreground">estimate</dd>
          </Card>
          <Card className="p-3">
            <dt className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Target</dt>
            <dd className="mt-1 text-[15px] font-bold tabular sm:text-lg">68%</dd>
            <dd className="text-2xs text-muted-foreground">₦34M of ₦50M</dd>
          </Card>
        </dl>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] border-collapse text-left text-[13px]">
            <caption className="sr-only">Sample pipeline deals with stage, value and next step</caption>
            <thead>
              <tr className="border-b border-border text-2xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">Deal</th>
                <th scope="col" className="py-2 pr-3 font-medium">Stage</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Value</th>
                <th scope="col" className="hidden py-2 pr-3 font-medium sm:table-cell">Owner</th>
                <th scope="col" className="py-2 font-medium">Next step</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_DEALS.map((deal) => (
                <tr key={deal.company} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="max-w-[10rem] truncate py-2.5 pr-3 font-medium" title={deal.company}>
                    {deal.company}
                  </th>
                  <td className="py-2.5 pr-3"><StageTag stage={deal.stage} /></td>
                  <td className="py-2.5 pr-3 text-right font-medium tabular">{formatCurrency(deal.value, "NGN")}</td>
                  <td className="hidden py-2.5 pr-3 text-muted-foreground sm:table-cell">{deal.owner}</td>
                  <td className={cn("py-2.5", deal.overdue ? "font-medium text-rose-600" : "text-muted-foreground")}>
                    {deal.next}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <figcaption className="border-t border-border bg-muted/40 px-4 py-2 text-2xs text-muted-foreground">
        Sample workspace. Company names and figures are examples, not customer results.
      </figcaption>
    </figure>
  );
}

/**
 * Proof-section preview: follow-up timeline + personal target card —
 * the daily-driver surface for a sales rep.
 */
export function FollowUpPreview() {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="text-xs font-semibold tracking-tight">Today · follow-ups</p>
        <Badge variant="outline" className="text-2xs">Sample data</Badge>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        <ol className="space-y-3">
          <li className="rounded-lg border border-rose-200 bg-rose-50 p-3">
            <p className="text-2xs font-semibold uppercase tracking-wide text-rose-600">Overdue · 3 days</p>
            <p className="mt-0.5 text-[13px] font-medium">Call back — Abuja Print Hub</p>
            <p className="text-2xs text-muted-foreground">Next step logged after discovery call</p>
          </li>
          <li className="rounded-lg border border-border p-3">
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Due Friday</p>
            <p className="mt-0.5 text-[13px] font-medium">Send contract draft — Zenith Foods Ltd</p>
            <p className="text-2xs text-muted-foreground">Follow-up · logged from a meeting note</p>
          </li>
          <li className="rounded-lg border border-border p-3">
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Logged today</p>
            <p className="mt-0.5 text-[13px] font-medium">Site visit booked — Kano Steel Works</p>
            <p className="text-2xs text-muted-foreground">Call · moved deal to Qualified</p>
          </li>
        </ol>

        <Card className="p-4">
          <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">My quarterly target</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            <span className="font-bold text-foreground">{formatCurrency(13_600_000, "NGN")}</span> closed of {formatCurrency(20_000_000, "NGN")}
          </p>
          <Progress
            value={68}
            className="mt-3 h-1.5"
            indicatorClassName="bg-primary"
            aria-label="68 percent of quarterly target closed"
          />
          <p className="mt-2 text-2xs text-muted-foreground">₦6.4M to go this quarter.</p>

          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Weighted forecast</p>
            <p className="mt-0.5 text-[13px] font-semibold tabular">{formatCurrencyCompact(19_910_000, "NGN")} expected</p>
            <p className="text-2xs text-muted-foreground">
              A planning estimate from deal probabilities — not a guaranteed outcome.
            </p>
          </div>
        </Card>
      </div>

      <figcaption className="border-t border-border bg-muted/40 px-4 py-2 text-2xs text-muted-foreground">
        Sample workspace. Figures are examples, not customer results.
      </figcaption>
    </figure>
  );
}
