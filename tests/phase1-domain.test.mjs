import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("./register-typescript.cjs");

const { buildAttentionQueue } = require("../lib/attention.ts");
const { computeForecast, forecastPeriodWindow } = require("../lib/metrics.ts");
const {
  autoMapColumns,
  buildErrorCsv,
  detectDuplicates,
  normalizeDateCell,
  parseCsv,
  validateRows,
} = require("../lib/csv-import.ts");

function opportunity(overrides = {}) {
  return {
    id: "deal-1",
    company: "Example Ltd",
    contact: "Ada Obi",
    stage: "Proposal",
    value: 100,
    probability: 50,
    owner: "Ada Obi",
    expectedCloseDate: "2026-06-30",
    createdDate: "2026-06-01",
    ...overrides,
  };
}

test("forecast windows include exact UTC date boundaries", () => {
  assert.deepEqual(forecastPeriodWindow("quarterly", "2026-06-30"), {
    start: "2026-04-01",
    end: "2026-06-30",
  });
  assert.deepEqual(forecastPeriodWindow("quarterly", "2026-07-01"), {
    start: "2026-07-01",
    end: "2026-09-30",
  });
  assert.deepEqual(forecastPeriodWindow("monthly", "2026-02-12"), {
    start: "2026-02-01",
    end: "2026-02-28",
  });
});

test("forecast weights only open deals expected to close inside the target period", () => {
  const deals = [
    opportunity({ id: "inside", expectedCloseDate: "2026-06-30", value: 100, probability: 50 }),
    opportunity({ id: "next-quarter", expectedCloseDate: "2026-07-01", value: 500, probability: 80 }),
    opportunity({ id: "won-inside", stage: "Closed Won", closedDate: "2026-06-30", value: 40 }),
    opportunity({ id: "won-outside", stage: "Closed Won", closedDate: "2026-07-01", value: 900 }),
    opportunity({ id: "lost", stage: "Closed Lost", closedDate: "2026-06-30", value: 300, probability: 100 }),
  ];
  const forecast = computeForecast(
    deals,
    { amount: 500, period: "quarterly" },
    "2026-06-30",
  );

  assert.equal(forecast.openInPeriodCount, 1);
  assert.equal(forecast.weightedForecast, 50);
  assert.equal(forecast.closedRevenue, 40);
  assert.equal(forecast.commit, 0);

  deals[1].expectedCloseDate = "2026-06-30";
  assert.equal(
    computeForecast(deals, { amount: 500, period: "quarterly" }, "2026-06-30").weightedForecast,
    450,
  );
});

test("empty periods produce zero forecast values", () => {
  const forecast = computeForecast([], { amount: 0, period: "annual" }, "2026-10-13");
  assert.equal(forecast.openInPeriodCount, 0);
  assert.equal(forecast.weightedForecast, 0);
  assert.equal(forecast.closedRevenue, 0);
  assert.equal(forecast.projectedCoveragePercent, 0);
});

test("attention queue distinguishes no activity, stale activity, and completed next steps", () => {
  const today = "2026-06-30";
  const deals = [
    opportunity({ id: "none", createdDate: "2026-06-01", expectedCloseDate: "2026-07-10" }),
    opportunity({ id: "old", createdDate: "2026-06-01", expectedCloseDate: "2026-07-10" }),
    opportunity({ id: "done-step", expectedCloseDate: "2026-07-10" }),
    opportunity({ id: "closed", stage: "Closed Won", expectedCloseDate: "2026-06-01" }),
  ];
  const activities = [
    {
      id: "old-activity",
      opportunityId: "old",
      createdAt: "2026-06-01T12:00:00.000Z",
      nextStep: "Call again",
      dueDate: "2026-07-10",
    },
    {
      id: "old-step",
      opportunityId: "done-step",
      createdAt: "2026-06-10T12:00:00.000Z",
      nextStep: "Send quote",
      dueDate: "2026-06-20",
    },
    {
      id: "completed",
      opportunityId: "done-step",
      createdAt: "2026-06-29T12:00:00.000Z",
      text: "Quote discussion completed",
    },
  ];

  const queue = buildAttentionQueue(deals, activities, today);
  const reasons = new Map(queue.map((item) => [item.opportunityId, item.reason]));
  assert.equal(reasons.get("none"), "no-activity");
  assert.equal(reasons.get("old"), "stale-activity");
  assert.equal(reasons.get("done-step"), "missing-next-step");
  assert.equal(reasons.has("closed"), false);
});

test("attention queue does not report today's close or undated activity as overdue/inactive", () => {
  const deal = opportunity({ expectedCloseDate: "2026-06-30" });
  const queue = buildAttentionQueue(
    [deal],
    [{ id: "undated", opportunityId: deal.id, text: "Existing activity" }],
    "2026-06-30",
  );
  assert.equal(queue.some((item) => item.reason === "overdue-close"), false);
  assert.equal(queue.some((item) => item.reason === "no-activity"), false);
});

test("CSV parser supports quoted commas and rejects unclosed quotes", () => {
  assert.deepEqual(parseCsv('Company,Notes\r\n"Acme, Inc.","Said ""yes"""\r\n').rows, [
    ["Acme, Inc.", 'Said "yes"'],
  ]);
  assert.throws(() => parseCsv('Company,Notes\n"unfinished,row'), /unclosed quoted field/i);
});

test("CSV validation normalizes dates and amounts and rejects foreign currency headers", () => {
  assert.equal(normalizeDateCell("31/12/2026"), "2026-12-31");
  assert.equal(normalizeDateCell("2026-02-30"), null);

  const headers = ["Company", "Stage", "Value (USD)", "Expected Close Date", "Owner"];
  const parsed = parseCsv(`${headers.join(",")}\nExample Ltd,Proposal,1,31/12/2026,Ada Obi`);
  const rows = validateRows(parsed, autoMapColumns(headers), {
    currency: "NGN",
    defaultOwner: "Ada Obi",
    eligibleOwners: ["Ada Obi"],
  });
  assert.equal(rows[0].deal, null);
  assert.match(rows[0].errors.join(" "), /conflicts with this NGN workspace currency/i);
});

test("CSV validation rejects rows that do not match the header width", () => {
  const headers = ["Company", "Stage", "Value", "Expected Close Date", "Owner"];
  const parsed = parseCsv(`${headers.join(",")}\nExample Ltd,Proposal,100,2026-12-31`);
  const rows = validateRows(parsed, autoMapColumns(headers), {
    currency: "NGN",
    defaultOwner: "Ada Obi",
    eligibleOwners: ["Ada Obi"],
  });
  assert.equal(rows[0].deal, null);
  assert.match(rows[0].errors.join(" "), /4 columns but the header has 5/i);
});

test("CSV duplicate detection matches existing deals and repeated rows in the file", () => {
  const headers = ["Company", "Stage", "Value", "Expected Close Date", "Owner"];
  const parsed = parseCsv([
    headers.join(","),
    "Existing Ltd,Proposal,100,2026-12-31,Ada Obi",
    "Existing Ltd,Proposal,100,2026-12-31,Ada Obi",
    "Example Ltd,Proposal,100,2026-12-31,Ada Obi",
    " example ltd ,Proposal,100,2026-12-31,Ada Obi",
  ].join("\n"));
  const rows = validateRows(parsed, autoMapColumns(headers), {
    currency: "NGN",
    defaultOwner: "Ada Obi",
    eligibleOwners: ["Ada Obi"],
  });
  const duplicates = detectDuplicates(rows, [
    { id: "existing", company: "existing ltd", value: 100, expectedCloseDate: "2026-12-31" },
  ]);
  assert.deepEqual([...duplicates.entries()], [
    [0, { existingId: "existing" }],
    [1, { earlierRowIndex: 0 }],
    [3, { earlierRowIndex: 2 }],
  ]);
});

test("runtime import failures export the original row for correction and retry", () => {
  const headers = ["Company", "Stage", "Value", "Expected Close Date", "Owner"];
  const parsed = parseCsv([
    headers.join(","),
    '"Example, Ltd",Proposal,100,2026-12-31,Ada Obi',
  ].join("\n"));
  const rows = validateRows(parsed, autoMapColumns(headers), {
    currency: "NGN",
    defaultOwner: "Ada Obi",
    eligibleOwners: ["Ada Obi"],
  });
  const csv = buildErrorCsv(rows, [{ rowNumber: 1, error: "Database temporarily unavailable" }]);
  const retry = parseCsv(csv);
  assert.equal(retry.rows.length, 1);
  assert.equal(retry.rows[0][1], "Example, Ltd");
  assert.match(retry.rows[0].at(-1), /Database temporarily unavailable/);
});
