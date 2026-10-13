import { STAGE_ORDER, STAGE_PROBABILITY } from "@/lib/pipeline-config";
import type { PipelineStage } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Format                                                              */
/* ------------------------------------------------------------------ */

/**
 * Supported import format (small on purpose, mirrors the export):
 *
 *   Company*, Contact, Email, Phone, Stage*, Value*, Probability, Owner,
 *   Expected Close Date*, Closed Date**, Lead Source, Last Activity
 *
 * (* required for every row; ** required for Closed Won/Lost rows.)
 *
 * Dates are normalized conservatively: `YYYY-MM-DD` or day-first
 * `DD/MM/YYYY` / `DD-MM-YYYY`. Amounts accept plain numbers with thousands
 * separators and the workspace currency symbol/code only — a row denominated
 * in the other currency is an error, never a silent conversion. The
 * organization's currency is never changed by an import.
 */

export type ImportField =
  | "company"
  | "contact"
  | "email"
  | "phone"
  | "stage"
  | "value"
  | "probability"
  | "owner"
  | "expectedCloseDate"
  | "closedDate"
  | "leadSource";

export const IMPORT_FIELDS: { field: ImportField; label: string; required: boolean }[] = [
  { field: "company", label: "Company", required: true },
  { field: "contact", label: "Contact", required: false },
  { field: "email", label: "Email", required: false },
  { field: "phone", label: "Phone", required: false },
  { field: "stage", label: "Stage", required: true },
  { field: "value", label: "Value", required: true },
  { field: "probability", label: "Probability", required: false },
  { field: "owner", label: "Owner", required: false },
  { field: "expectedCloseDate", label: "Expected Close Date", required: true },
  { field: "closedDate", label: "Closed Date", required: false },
  { field: "leadSource", label: "Lead Source", required: false },
];

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/** RFC-4180-ish parser: quoted fields, escaped quotes, CRLF or LF. */
export function parseCsv(text: string): ParsedCsv {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index++) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.length > 0) {
        throw new Error("A quoted CSV field must start with a quote.");
      }
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (inQuotes) {
    throw new Error("The CSV has an unclosed quoted field.");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((entry) => entry.some((cell) => cell.trim() !== ""));
  const headers = (nonEmpty.shift() ?? []).map((cell) => cell.trim());
  return { headers, rows: nonEmpty };
}

const HEADER_SYNONYMS: Record<ImportField, string[]> = {
  company: ["company", "company name", "account", "deal name", "opportunity"],
  contact: ["contact", "contact name", "contact person"],
  email: ["email", "email address", "e-mail"],
  phone: ["phone", "phone number", "telephone", "mobile"],
  stage: ["stage", "deal stage", "status"],
  value: [
    "value",
    "amount",
    "deal value",
    "deal size",
    "value (ngn)",
    "value (usd)",
    "amount (ngn)",
    "amount (usd)",
  ],
  probability: ["probability", "win probability", "probability (%)"],
  owner: ["owner", "assigned to", "sales owner"],
  expectedCloseDate: ["expected close date", "close date", "expected close"],
  closedDate: ["closed date", "closed on", "actual close date"],
  leadSource: ["lead source", "source"],
};

/* ------------------------------------------------------------------ */
/* Validation & normalization                                          */
/* ------------------------------------------------------------------ */

export interface RowContext {
  /** Organization currency — mismatched amounts are errors, never converted. */
  currency: "NGN" | "USD";
  /** Display name of the signed-in user; the default owner for every row. */
  defaultOwner: string;
  /** Display names of active members of the SAME organization (incl. default). */
  eligibleOwners: string[];
}

export interface NormalizedDeal {
  company: string;
  contact: string;
  email?: string;
  phone?: string;
  stage: PipelineStage;
  value: number;
  probability: number;
  probabilityOverridden: boolean;
  owner: string;
  expectedCloseDate: string;
  closedDate?: string;
  leadSource: string;
}

export interface ValidatedRow {
  /** 1-based data row number (header excluded). */
  rowNumber: number;
  raw: string[];
  /** Cell value per logical field (already mapped), for error reporting. */
  cells: Partial<Record<ImportField, string>>;
  errors: string[];
  deal: NormalizedDeal | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s()-]{6,}$/;

const STAGE_ALIASES: Record<string, PipelineStage> = {
  won: "Closed Won",
  "closed won": "Closed Won",
  "closed-won": "Closed Won",
  lost: "Closed Lost",
  "closed lost": "Closed Lost",
  "closed-lost": "Closed Lost",
};

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** `YYYY-MM-DD` or day-first `DD/MM/YYYY` / `DD-MM-YYYY` → ISO date, else null. */
export function normalizeDateCell(cell: string): string | null {
  const value = cell.trim();
  if (!value) return null;

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    return isRealDate(year, month, day)
      ? `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : null;
  }

  const dayFirst = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (dayFirst) {
    const [, d, m, y] = dayFirst;
    const day = Number(d);
    const month = Number(m);
    const year = Number(y);
    return isRealDate(year, month, day)
      ? `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : null;
  }

  return null;
}

/** Validate + normalize every data row; errors are human-readable per row. */
export function validateRows(
  parsed: ParsedCsv,
  mapping: Record<ImportField, number | null>,
  ctx: RowContext,
): ValidatedRow[] {
  const cell = (row: string[], field: ImportField): string => {
    const index = mapping[field];
    return index === null || index < 0 ? "" : (row[index] ?? "").trim();
  };

  const missingRequired = (["company", "stage", "value", "expectedCloseDate"] as const).filter(
    (field) => mapping[field] === null,
  );
  const valueHeader =
    mapping.value === null ? "" : (parsed.headers[mapping.value] ?? "").toLowerCase();
  const headerCurrencyMismatch =
    (ctx.currency === "NGN" && /\b(?:usd|dollars?)\b|\$/.test(valueHeader)) ||
    (ctx.currency === "USD" && /\b(?:ngn|naira)\b|₦/.test(valueHeader));
  if (missingRequired.length) {
    const labels = missingRequired
      .map((field) => IMPORT_FIELDS.find((entry) => entry.field === field)?.label ?? field)
      .join(", ");
    return parsed.rows.map((raw, index) => ({
      rowNumber: index + 1,
      raw,
      cells: {},
      errors: [`Column mapping is missing required field(s): ${labels}`],
      deal: null,
    }));
  }

  return parsed.rows.map((raw, index) => {
    const errors: string[] = [];
    const cells: Partial<Record<ImportField, string>> = {};
    for (const { field } of IMPORT_FIELDS) cells[field] = cell(raw, field);
    if (raw.length !== parsed.headers.length) {
      errors.push(
        `This row has ${raw.length} columns but the header has ${parsed.headers.length}`,
      );
    }
    if (headerCurrencyMismatch) {
      errors.push(`The Value column header conflicts with this ${ctx.currency} workspace currency`);
    }

    const company = cell(raw, "company");
    if (!company) errors.push("Company (deal name) is required");

    const contact = cell(raw, "contact") || "Unassigned";

    const stageRaw = cell(raw, "stage").toLowerCase();
    const stage = STAGE_ALIASES[stageRaw] ??
      (STAGE_ORDER.find((entry) => entry.toLowerCase() === stageRaw) as PipelineStage | undefined);
    if (!stage) errors.push(`Stage "${cell(raw, "stage")}" is not one of: ${STAGE_ORDER.join(", ")}`);

    const valueResult = normalizeValueCell(cell(raw, "value"), ctx.currency);
    if ("error" in valueResult) errors.push(valueResult.error);

    const expectedCloseDate = normalizeDateCell(cell(raw, "expectedCloseDate"));
    if (!cell(raw, "expectedCloseDate")) {
      errors.push("Expected close date is required");
    } else if (!expectedCloseDate) {
      errors.push(`Expected close date "${cell(raw, "expectedCloseDate")}" is not a valid date (use YYYY-MM-DD or DD/MM/YYYY)`);
    }

    const closedDateCell = cell(raw, "closedDate");
    let closedDate: string | undefined;
    if (closedDateCell) {
      const parsedClosed = normalizeDateCell(closedDateCell);
      if (!parsedClosed) {
        errors.push(`Closed date "${closedDateCell}" is not a valid date (use YYYY-MM-DD or DD/MM/YYYY)`);
      } else if (stage && stage !== "Closed Won" && stage !== "Closed Lost") {
        errors.push("Closed date is only valid for Closed Won / Closed Lost rows");
      } else {
        closedDate = parsedClosed;
      }
    } else if (stage === "Closed Won" || stage === "Closed Lost") {
      errors.push("Closed date is required for Closed Won / Closed Lost rows");
    }

    const email = cell(raw, "email");
    if (email && !EMAIL_PATTERN.test(email)) errors.push(`Email "${email}" is not a valid email address`);

    const phone = cell(raw, "phone");
    if (phone && (!PHONE_PATTERN.test(phone) || phone.replace(/\D/g, "").length < 6)) {
      errors.push(`Phone "${phone}" is not a valid phone number`);
    }

    let probability = STAGE_PROBABILITY[stage ?? "Lead"];
    let probabilityOverridden = false;
    const probabilityCell = cell(raw, "probability");
    if (probabilityCell) {
      const numeric = Number(probabilityCell.replace(/%$/, "").trim());
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
        errors.push(`Probability "${probabilityCell}" must be between 0 and 100`);
      } else {
        probability = Math.round(numeric);
        probabilityOverridden = stage !== undefined && probability !== STAGE_PROBABILITY[stage];
      }
    }
    if (stage === "Closed Won") { probability = 100; probabilityOverridden = false; }
    if (stage === "Closed Lost") { probability = 0; probabilityOverridden = false; }

    const owner = cell(raw, "owner") || ctx.defaultOwner;
    if (!ctx.eligibleOwners.includes(owner)) {
      errors.push(`Owner "${owner}" is not an active member of this organization`);
    }

    const deal: NormalizedDeal | null =
      errors.length === 0 && stage && "value" in valueResult
        ? {
            company,
            contact,
            email: email || undefined,
            phone: phone || undefined,
            stage,
            value: valueResult.value,
            probability,
            probabilityOverridden,
            owner,
            expectedCloseDate: expectedCloseDate as string,
            closedDate,
            leadSource: cell(raw, "leadSource") || "Other",
          }
        : null;

    return { rowNumber: index + 1, raw, cells, errors, deal };
  });
}

/* ------------------------------------------------------------------ */
/* Duplicate detection                                                 */
/* ------------------------------------------------------------------ */

/** What to do with rows that match an existing deal. */
export type DuplicatePolicy = "skip" | "import-new" | "update";

export interface ExistingDealRef {
  id: string;
  company: string;
  value: number;
  expectedCloseDate: string;
}

export interface DuplicateMatch {
  existingId?: string;
  earlierRowIndex?: number;
}

function duplicateKey(company: string, value: number, expectedCloseDate: string): string {
  return `${company.trim().toLowerCase()}|${value}|${expectedCloseDate}`;
}

/**
 * Conservative duplicate rule: same normalized company name AND same amount
 * AND same expected close date as an existing live deal. Similar text alone
 * never matches — nothing is merged or overwritten automatically; the caller
 * chooses skip / import as new / explicitly update the selected rows.
 *
 * Returns rowIndex (0-based into `rows`) → existing opportunity or earlier
 * import row. Earlier rows are reported only once, so choosing "skip" keeps
 * the first copy while "import as new" remains an explicit opt-in.
 */
export function detectDuplicates(
  rows: ValidatedRow[],
  existing: ExistingDealRef[],
): Map<number, DuplicateMatch> {
  const existingByKey = new Map<string, string>();
  for (const deal of existing) {
    existingByKey.set(duplicateKey(deal.company, deal.value, deal.expectedCloseDate), deal.id);
  }

  const firstRowByKey = new Map<string, number>();
  const matches = new Map<number, DuplicateMatch>();
  rows.forEach((row, index) => {
    if (!row.deal) return;
    const key = duplicateKey(row.deal.company, row.deal.value, row.deal.expectedCloseDate);
    const existingId = existingByKey.get(key);
    const earlierRowIndex = firstRowByKey.get(key);
    if (existingId) {
      matches.set(index, earlierRowIndex === undefined ? { existingId } : { earlierRowIndex });
      if (earlierRowIndex === undefined) firstRowByKey.set(key, index);
      return;
    }
    if (earlierRowIndex !== undefined) {
      matches.set(index, { earlierRowIndex });
      return;
    }
    firstRowByKey.set(key, index);
  });
  return matches;
}

/* ------------------------------------------------------------------ */
/* Template & error export                                             */
/* ------------------------------------------------------------------ */

/** Downloadable example file — clearly labelled sample rows. */
export function buildImportTemplate(): string {
  const rows: string[][] = [
    IMPORT_FIELDS.map(({ label }) => label),
    [
      "Example Company Ltd",
      "Ada Obi",
      "ada@example.com",
      "+234 801 234 5678",
      "Proposal",
      "1250000",
      "70%",
      "",
      "2026-12-15",
      "",
      "Referral",
    ],
    [
      "Sample Works Ltd",
      "Tunde Bello",
      "tunde@example.com",
      "",
      "Closed Won",
      "800000",
      "",
      "",
      "2026-11-30",
      "2026-10-01",
      "Inbound",
    ],
  ];
  return rows.map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(",")).join("\n");
}

/** CSV of failed rows (original cells + reasons) for correction and retry. */
export function buildErrorCsv(
  rows: ValidatedRow[],
  runtimeFailures: { rowNumber: number; error?: string }[] = [],
): string {
  const failedByRow = new Map(
    rows.filter((row) => row.errors.length > 0).map((row) => [row.rowNumber, row.errors.join("; ")]),
  );
  for (const failure of runtimeFailures) {
    failedByRow.set(
      failure.rowNumber,
      [failedByRow.get(failure.rowNumber), failure.error || "The row could not be saved."]
        .filter(Boolean)
        .join("; "),
    );
  }
  const failedRows = rows.filter((row) => failedByRow.has(row.rowNumber));
  const out: string[][] = [
    ["Row", ...IMPORT_FIELDS.map(({ label }) => label), "Errors"],
    ...failedRows.map((row) => [
      String(row.rowNumber),
      ...IMPORT_FIELDS.map(({ field }) => row.cells[field] ?? ""),
      failedByRow.get(row.rowNumber) ?? "",
    ]),
  ];
  return out
    .map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(","))
    .join("\n");
}

/**
 * Amount normalization. Returns an error string when the cell is invalid or
 * denominated in the wrong currency — the workspace currency is never changed.
 */
export function normalizeValueCell(
  cell: string,
  currency: "NGN" | "USD",
): { value: number } | { error: string } {
  const raw = cell.trim();
  if (!raw) return { error: "Value is required" };

  const otherSymbols = currency === "NGN" ? ["$", "usd"] : ["₦", "naira", "ngn"];
  const lower = raw.toLowerCase();
  if (otherSymbols.some((token) => lower.includes(token))) {
    return {
      error: `Amount is denominated in ${currency === "NGN" ? "USD" : "NGN"} but this workspace uses ${currency} — convert it before importing (imports never change your currency)`,
    };
  }

  const cleaned = raw
    .replace(/,/g, "")
    .replace(/₦/g, "")
    .replace(/\bngn\b/gi, "")
    .replace(/\busd\b/gi, "")
    .replace(/\s/g, "");

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return { error: `Value "${raw}" is not a number` };
  }

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) {
    return { error: `Value "${raw}" must be zero or positive` };
  }
  return { value };
}

function normaliseHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Best-effort column mapping from header names; unmatched fields are null. */
export function autoMapColumns(headers: string[]): Record<ImportField, number | null> {
  const mapping = Object.fromEntries(
    IMPORT_FIELDS.map(({ field }) => [field, null]),
  ) as Record<ImportField, number | null>;

  headers.forEach((header, index) => {
    const normalised = normaliseHeader(header);
    for (const { field } of IMPORT_FIELDS) {
      if (mapping[field] !== null) continue;
      if (HEADER_SYNONYMS[field].includes(normalised)) {
        mapping[field] = index;
        return;
      }
    }
  });

  return mapping;
}

/* ------------------------------------------------------------------ */
/* Import jobs (executed by the pipeline provider)                     */
/* ------------------------------------------------------------------ */

export interface ImportJob {
  /** 1-based data row number from the source file (for result reporting). */
  rowNumber: number;
  deal: NormalizedDeal;
  /** Set only when the user explicitly chose to update this existing deal. */
  updateExistingId?: string;
}

export type ImportJobResult = {
  rowNumber: number;
  status: "inserted" | "updated" | "failed";
  error?: string;
};
