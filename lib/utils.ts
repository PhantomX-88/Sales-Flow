import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { PipelineStage } from "@/lib/types";

/** Merge conditional class names with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ------------------------------------------------------------------ */
/* Currency & number formatting                                        */
/* ------------------------------------------------------------------ */

const currencyOptions = {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
} as const;

/** `$84,000` — full precision, used in tables, drawers and forms. */
export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", currencyOptions).format(value);
}

/** `$1.4M` / `$486K` — compact form for KPI cards, axes and charts. */
export function formatCurrencyCompact(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    ...currencyOptions,
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 || value <= -1_000_000 ? 2 : 1,
  }).format(value);
}

/** `$1.40M` — always uses one decimal unit modifier for chart axes. */
export function formatCurrencyAxis(value: number): string {
  if (value === 0) return "$0";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/** `24.8%` */
export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(fractionDigits)}%`;
}

/** `+18.6%` / `-4.2%` */
export function formatSigned(value: number, fractionDigits = 1, suffix = "%"): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)}${suffix}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

/** Parse an ISO `yyyy-mm-dd` string as a UTC date to stay timezone-stable. */
export function parseDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** `Sep 25, 2026` */
export function formatDate(iso: string): string {
  if (!iso) return "—";
  return dateFormatter.format(parseDate(iso));
}

/** `Sep 25` */
export function formatDateShort(iso: string): string {
  if (!iso) return "—";
  return shortDateFormatter.format(parseDate(iso));
}

export function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Whole-day difference between two ISO date strings (`a - b`). */
export function daysBetween(a: string, b: string): number {
  const diff = parseDate(a).getTime() - parseDate(b).getTime();
  return Math.round(diff / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const next = new Date(parseDate(iso).getTime() + days * 86_400_000);
  return toDateKey(next);
}

export function startOfQuarter(iso: string): string {
  const date = parseDate(iso);
  const month = date.getUTCMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return toDateKey(new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1)));
}

export function endOfQuarter(iso: string): string {
  const start = parseDate(startOfQuarter(iso));
  return toDateKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0)));
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
    parseDate(iso),
  );
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export const STAGE_BADGE_STYLES: Record<PipelineStage, string> = {
  Lead: "border-slate-200 bg-slate-50 text-slate-500",
  Discovery: "border-slate-200 bg-slate-100 text-slate-600",
  Qualified: "border-sky-200 bg-sky-50 text-sky-700",
  Proposal: "border-blue-200 bg-blue-50 text-blue-700",
  Negotiation: "border-indigo-200 bg-indigo-50 text-indigo-700",
  "Closed Won": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Closed Lost": "border-rose-200 bg-rose-50 text-rose-700",
};

export const STAGE_DOT_STYLES: Record<PipelineStage, string> = {
  Lead: "bg-slate-300",
  Discovery: "bg-slate-400",
  Qualified: "bg-sky-500",
  Proposal: "bg-blue-600",
  Negotiation: "bg-indigo-600",
  "Closed Won": "bg-emerald-600",
  "Closed Lost": "bg-rose-500",
};

export const STAGE_HEX_COLORS: Record<PipelineStage, string> = {
  Lead: "#94A3B8",
  Discovery: "#64748B",
  Qualified: "#0EA5E9",
  Proposal: "#2563EB",
  Negotiation: "#4F46E5",
  "Closed Won": "#059669",
  "Closed Lost": "#E11D48",
};

/** Health of a deal relative to its expected close date. */
export function closeDateTone(iso: string, today: string): "danger" | "warning" | "muted" {
  const diff = daysBetween(iso, today);
  if (diff < 0) return "danger";
  if (diff <= 7) return "warning";
  return "muted";
}

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

function escapeCsvCell(cell: string | number): string {
  const value = String(cell ?? "");
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

/** Client-side CSV download — no backend required. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

export type PageToken = number | "ellipsis";

/** `[1, 2, 3, "ellipsis", 12]` style window with stable ellipsis positions. */
export function getPaginationRange(current: number, total: number): PageToken[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((page) => pages.add(page));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((page) => pages.add(page));

  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const tokens: PageToken[] = [];
  let previous = 0;

  for (const page of sorted) {
    if (previous && page - previous > 1) tokens.push("ellipsis");
    tokens.push(page);
    previous = page;
  }

  return tokens;
}
