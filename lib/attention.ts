import { OPEN_STAGES } from "@/lib/pipeline-config";
import type { Activity, Opportunity } from "@/lib/types";
import { daysBetween } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** A deal with no logged activity for this many days is "stale". */
export const STALE_ACTIVITY_DAYS = 14;

/** How long an explicitly snoozed alert stays hidden. */
export const SNOOZE_DAYS = 7;

export type AttentionReason =
  | "overdue-close"
  | "overdue-follow-up"
  | "missing-next-step"
  | "stale-activity"
  | "no-activity";

export type AttentionAction = "open-deal" | "update-close-date" | "log-activity";

export interface AttentionItem {
  /** Stable key: `${opportunityId}:${reason}`. */
  id: string;
  opportunityId: string;
  reason: AttentionReason;
  /** Lower sorts first: one item per deal, highest-priority reason only. */
  priority: number;
  /** Plain-language reason, always explainable from visible fields. */
  title: string;
  detail: string;
  company: string;
  owner: string;
  /** Primary direct action offered for this reason. */
  action: AttentionAction;
}

const REASON_PRIORITY: Record<AttentionReason, number> = {
  "overdue-close": 1,
  "overdue-follow-up": 2,
  "missing-next-step": 3,
  "stale-activity": 4,
  "no-activity": 5,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isOpen(opportunity: Opportunity): boolean {
  return OPEN_STAGES.includes(opportunity.stage);
}

/** Latest raw activity timestamp (ISO) logged against a deal, if any. */
export function lastActivityAt(activities: Activity[], opportunityId: string): string | null {
  let latest: string | null = null;
  for (const activity of activities) {
    if (activity.opportunityId !== opportunityId || !activity.createdAt) continue;
    if (!latest || activity.createdAt > latest) latest = activity.createdAt;
  }
  return latest;
}

/** Most recent activity that carries a next step + due date, if any. */
export function latestNextStep(
  activities: Activity[],
  opportunityId: string,
): { createdAt: string; nextStep: string; dueDate: string } | null {
  let latestActivity: Activity | null = null;
  for (const activity of activities) {
    if (activity.opportunityId !== opportunityId) continue;
    if (!activity.createdAt) continue;
    if (!latestActivity || activity.createdAt > (latestActivity.createdAt ?? "")) {
      latestActivity = activity;
    }
  }
  if (!latestActivity?.nextStep || !latestActivity.dueDate || !latestActivity.createdAt) return null;
  return {
    createdAt: latestActivity.createdAt,
    nextStep: latestActivity.nextStep,
    dueDate: latestActivity.dueDate,
  };
}

export function hasAnyNextStep(activities: Activity[], opportunityId: string): boolean {
  return latestNextStep(activities, opportunityId) !== null;
}

/** Whole days elapsed from an ISO date/timestamp until `today` (>=0 when past). */
export function daysSinceTimestamp(isoTimestamp: string, today: string): number {
  return daysBetween(today, isoTimestamp.slice(0, 10));
}

/* ------------------------------------------------------------------ */
/* Snooze store (per-browser, no server writes)                       */
/* ------------------------------------------------------------------ */

const SNOOZE_STORAGE_KEY = "salesflow.attention.snoozes";

type SnoozeMap = Record<string, number>; // item id -> expiry epoch ms

function readSnoozes(): SnoozeMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SNOOZE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SnoozeMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSnoozes(map: SnoozeMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — snoozes simply do not persist */
  }
}

/** Hide an alert for `SNOOZE_DAYS`. Safe to call from any environment. */
export function snoozeAttentionItem(itemId: string): void {
  const map = readSnoozes();
  map[itemId] = Date.now() + SNOOZE_DAYS * 86_400_000;
  writeSnoozes(map);
}

/** Drop expired snoozes and report whether `itemId` is currently hidden. */
export function isAttentionSnoozed(itemId: string): boolean {
  const map = readSnoozes();
  const expiry = map[itemId];
  if (!expiry) return false;
  if (expiry <= Date.now()) {
    delete map[itemId];
    writeSnoozes(map);
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Queue builder                                                       */
/* ------------------------------------------------------------------ */

function makeItem(
  opportunity: Opportunity,
  reason: AttentionReason,
  title: string,
  detail: string,
  action: AttentionAction,
): AttentionItem {
  return {
    id: `${opportunity.id}:${reason}`,
    opportunityId: opportunity.id,
    reason,
    priority: REASON_PRIORITY[reason],
    title,
    detail,
    company: opportunity.company,
    owner: opportunity.owner,
    action,
  };
}

/**
 * One alert per open deal, highest-priority reason only — a deal is never
 * shown as "missing a next step" while its only next step is overdue, and
 * every reason is explainable from visible fields (expected close date,
 * follow-up due date, presence of a next step, real activity timestamps).
 *
 * Closed deals are skipped entirely. Snoozed items are hidden until they
 * expire; completing the underlying action removes the alert naturally on the
 * next recompute.
 *
 * `today` is a YYYY-MM-DD key; date math is UTC and inclusive, matching
 * `forecastPeriodWindow`.
 */
export function buildAttentionQueue(
  opportunities: Opportunity[],
  activities: Activity[],
  today: string,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const opportunity of opportunities) {
    if (!isOpen(opportunity)) continue;

    const overdueDays = daysBetween(today, opportunity.expectedCloseDate);
    if (overdueDays > 0) {
      items.push(
        makeItem(
          opportunity,
          "overdue-close",
          "Expected close date passed",
          `${opportunity.company} · was due ${opportunity.expectedCloseDate} (${overdueDays} ${overdueDays === 1 ? "day" : "days"} ago)`,
          "update-close-date",
        ),
      );
      continue;
    }

    const nextStep = latestNextStep(activities, opportunity.id);
    if (nextStep && nextStep.dueDate < today) {
      const days = daysBetween(today, nextStep.dueDate);
      items.push(
        makeItem(
          opportunity,
          "overdue-follow-up",
          "Follow-up overdue",
          `${opportunity.company} · "${nextStep.nextStep}" was due ${nextStep.dueDate} (${days} ${days === 1 ? "day" : "days"} ago)`,
          "log-activity",
        ),
      );
      continue;
    }

    const lastAt = lastActivityAt(activities, opportunity.id);
    if (!lastAt) {
      // An activity without a timestamp is not evidence of inactivity.
      const hasUndatedActivity = activities.some(
        (activity) => activity.opportunityId === opportunity.id,
      );
      if (hasUndatedActivity) continue;

      // "Nothing ever logged" is a different alert from "old activity".
      const sinceCreated = daysBetween(today, opportunity.createdDate);
      if (sinceCreated >= STALE_ACTIVITY_DAYS) {
        items.push(
          makeItem(
            opportunity,
            "no-activity",
            "No activity logged yet",
            `${opportunity.company} · deal created ${opportunity.createdDate}, nothing logged in ${sinceCreated} days`,
            "log-activity",
          ),
        );
      }
      continue;
    }

    const quietDays = daysSinceTimestamp(lastAt, today);
    if (quietDays >= STALE_ACTIVITY_DAYS) {
      items.push(
        makeItem(
          opportunity,
          "stale-activity",
          `No activity in ${quietDays} days`,
          `${opportunity.company} · last logged activity ${lastAt.slice(0, 10)}`,
          "log-activity",
        ),
      );
      continue;
    }

    if (!hasAnyNextStep(activities, opportunity.id)) {
      items.push(
        makeItem(
          opportunity,
          "missing-next-step",
          "No next step logged",
          `${opportunity.company} · log the next action after your last conversation`,
          "log-activity",
        ),
      );
    }
  }

  return items
    .filter((item) => !isAttentionSnoozed(item.id))
    .sort((a, b) => a.priority - b.priority);
}
